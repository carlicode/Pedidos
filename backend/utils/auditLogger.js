import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Logger de auditoría para rastrear todas las operaciones de pedidos.
 *
 * Formato: JSON Lines (una entrada JSON por línea, sin pretty-print).
 * - Escritura: SOLO append asíncrono (fs.promises.appendFile). Nunca se lee ni se
 *   parsea el archivo para escribir, así que el costo es constante sin importar
 *   el tamaño del log y no bloquea el event loop.
 * - Rotación barata: stat del archivo antes de cada append; si supera
 *   AUDIT_MAX_BYTES se renombra a `audit-log-<timestamp>.jsonl` y se conservan
 *   solo los AUDIT_MAX_FILES rotados más recientes.
 * - Lectura: línea por línea con readline + createReadStream (nunca el archivo entero).
 * - El archivo legacy `audit-log.json` (array JSON gigante) NO se lee jamás.
 *
 * Variables de entorno (se leen en cada llamada, para que los tests sean deterministas):
 * - AUDIT_LOGS_DIR:  directorio de los logs (default: backend/logs/audit)
 * - AUDIT_MAX_BYTES: tamaño máximo del archivo actual antes de rotar (default: 20 MB)
 * - AUDIT_MAX_FILES: cantidad de archivos rotados a conservar (default: 5)
 */

// Configuración por defecto
const DEFAULT_LOGS_DIR = path.join(__dirname, '..', 'logs', 'audit');
const LOG_FILENAME = 'audit-log.jsonl'; // Archivo actual (JSON Lines)
const LEGACY_LOG_FILENAME = 'audit-log.json'; // Formato viejo: solo se lista, nunca se lee
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const DEFAULT_MAX_FILES = 5;

// audit-log-2026-10-12T13-28-00-123Z.jsonl (o con sufijo -N si hubo colisión en el mismo ms)
const ROTATED_REGEX = /^audit-log-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(?:-(\d+))?\.jsonl$/;

/**
 * Directorio de logs (se resuelve en cada llamada)
 */
function getLogsDir() {
  return process.env.AUDIT_LOGS_DIR || DEFAULT_LOGS_DIR;
}

function getMaxBytes() {
  const value = Number(process.env.AUDIT_MAX_BYTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_BYTES;
}

function getMaxFiles() {
  const value = Number(process.env.AUDIT_MAX_FILES);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_MAX_FILES;
}

/**
 * Obtener ruta completa del archivo de log actual
 */
function getLogFilePath() {
  return path.join(getLogsDir(), LOG_FILENAME);
}

// Directorios ya anunciados en consola (solo para no repetir el log)
const announcedDirs = new Set();

/**
 * Asegurar (async) que el directorio de logs existe.
 * mkdir recursive es idempotente y barato; no se cachea para tolerar que
 * el directorio sea borrado mientras el proceso sigue vivo.
 */
async function ensureLogsDirectory() {
  const dir = getLogsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  if (!announcedDirs.has(dir)) {
    announcedDirs.add(dir);
    console.log('📁 Directorio de audit logs:', dir);
  }
  return dir;
}

/**
 * ¿Existe el archivo? (async, sin lanzar)
 */
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtener fecha y hora en formato ISO para Bolivia (UTC-4)
 */
function getBoliviaTimestamp() {
  const now = new Date();
  
  // Ajustar a Bolivia (UTC-4)
  const boliviaOffset = -4 * 60; // -4 horas en minutos
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const boliviaTime = new Date(utcTime + (boliviaOffset * 60000));
  
  return boliviaTime.toISOString();
}

/**
 * Detectar cambios entre dos versiones del pedido
 * @param {Object} before - Estado anterior
 * @param {Object} after - Estado actual
 * @returns {Object} Objeto con los cambios detectados
 */
function detectChanges(before, after) {
  const changes = {};
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  for (const key of allKeys) {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    
    // Comparar valores (convertir a string para comparación)
    if (String(beforeValue) !== String(afterValue)) {
      changes[key] = {
        before: beforeValue,
        after: afterValue
      };
    }
  }
  
  return changes;
}

/**
 * Lista los archivos rotados (.jsonl) del directorio, del más viejo al más nuevo.
 * Los `audit-log-backup-*.json` del formato viejo no matchean y se ignoran.
 * @returns {Promise<string[]>} Nombres de archivo ordenados
 */
async function listRotatedFilenames(dir) {
  let files;
  try {
    files = await fs.promises.readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  return files
    .map(name => ({ name, match: ROTATED_REGEX.exec(name) }))
    .filter(item => item.match)
    .sort((a, b) => {
      // Primero por timestamp (ISO ordena lexicográficamente), luego por sufijo de colisión
      if (a.match[1] !== b.match[1]) return a.match[1] < b.match[1] ? -1 : 1;
      return Number(a.match[2] || 0) - Number(b.match[2] || 0);
    })
    .map(item => item.name);
}

/**
 * Rotar el archivo actual si superó el tamaño máximo.
 * Solo hace stat (barato); nunca lee el contenido.
 */
async function rotateIfNeeded(dir, logFilePath) {
  let stats;
  try {
    stats = await fs.promises.stat(logFilePath);
  } catch (error) {
    if (error.code === 'ENOENT') return; // Todavía no existe, nada que rotar
    throw error;
  }

  const maxBytes = getMaxBytes();
  if (stats.size <= maxBytes) return;

  // Nombre único: si hay colisión en el mismo milisegundo, agregar sufijo -N
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let rotatedName = `audit-log-${stamp}.jsonl`;
  for (let n = 2; await fileExists(path.join(dir, rotatedName)); n++) {
    rotatedName = `audit-log-${stamp}-${n}.jsonl`;
  }

  await fs.promises.rename(logFilePath, path.join(dir, rotatedName));
  console.log(`📦 Audit log alcanzó ${formatBytes(stats.size)}, rotado a: ${rotatedName}`);

  // Conservar solo los AUDIT_MAX_FILES rotados más recientes
  const maxFiles = getMaxFiles();
  const rotated = await listRotatedFilenames(dir);
  const toDelete = rotated.slice(0, Math.max(0, rotated.length - maxFiles));
  for (const oldName of toDelete) {
    try {
      await fs.promises.unlink(path.join(dir, oldName));
      console.log(`🗑️ Audit log rotado antiguo eliminado: ${oldName}`);
    } catch (error) {
      console.error(`⚠️ No se pudo borrar ${oldName}:`, error.message);
    }
  }
}

// Cola de escrituras: cada append espera al anterior, así dos pedidos simultáneos
// no se pisan durante la rotación. Nunca queda en estado rechazado.
let writeQueue = Promise.resolve();

/**
 * Escribir entrada de auditoría (fire-and-forget).
 *
 * No bloquea el event loop ni lanza errores: los callers no hacen await. Devuelve
 * una promesa que SIEMPRE resuelve (con la entrada, o null si falló), útil para tests.
 *
 * @param {string} action - Tipo de acción: 'CREAR', 'EDITAR', 'ELIMINAR', etc.
 * @param {Object} data - Datos del pedido (completos)
 * @param {Object} metadata - Metadata adicional (usuario, IP, etc.)
 * @param {Object} before - Datos antes del cambio (solo para EDITAR)
 * @returns {Promise<Object|null>} Entrada escrita, o null si hubo error
 */
export function logAuditEntry(action, data, metadata = {}, before = null) {
  let entry;
  let line;

  try {
    // Construir entrada de log (síncrono y barato: solo objetos en memoria)
    entry = {
      timestamp: getBoliviaTimestamp(),
      action: action.toUpperCase(),
      orderId: data.ID || data.id || 'UNKNOWN',
      operator: metadata.operator || data.Operador || data.operador || 'SYSTEM',
      ip: metadata.ip || 'UNKNOWN',
      userAgent: metadata.userAgent || 'UNKNOWN',
      
      // Datos completos del pedido
      data: {
        ...data
      },
      
      // Metadata adicional
      metadata: {
        ...metadata,
        logFile: LOG_FILENAME
      }
    };
    
    // Si es una edición, incluir estado anterior
    if (action.toUpperCase() === 'EDITAR' && before) {
      entry.before = { ...before };
      entry.changes = detectChanges(before, data);
    }

    // Una sola línea JSON (sin pretty-print)
    line = JSON.stringify(entry) + '\n';
  } catch (error) {
    // No lanzar error para no interrumpir la operación principal
    console.error('❌ Error construyendo audit log:', error);
    return Promise.resolve(null);
  }

  const task = async () => {
    try {
      const dir = await ensureLogsDirectory();
      const logFilePath = path.join(dir, LOG_FILENAME);

      await rotateIfNeeded(dir, logFilePath);
      await fs.promises.appendFile(logFilePath, line, 'utf8');

      console.log(`✅ [AUDIT] ${action} - Pedido #${entry.orderId} - ${entry.operator}`);
      return entry;
    } catch (error) {
      // No lanzar error para no interrumpir la operación principal
      console.error('❌ Error escribiendo audit log:', error);
      return null;
    }
  };

  // Encadenar: task() nunca rechaza, así la cola nunca se rompe
  const result = writeQueue.then(task);
  writeQueue = result;
  return result;
}

/**
 * Lee un archivo .jsonl línea por línea (sin cargarlo entero en memoria).
 * Salta líneas vacías o inválidas. Si el archivo no existe, no produce nada.
 * @param {string} filePath - Ruta del archivo
 * @param {string} [needle] - Si se indica, solo se parsean las líneas que contengan este texto
 */
async function* readJsonLines(filePath, needle = null) {
  try {
    await fs.promises.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (needle && !line.includes(needle)) continue; // Evita parsear líneas irrelevantes
      try {
        yield JSON.parse(line);
      } catch {
        // Línea corrupta o truncada: se saltea sin romper
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}

/**
 * Archivos .jsonl a leer: el actual + los rotados
 * @returns {Promise<string[]>} Rutas completas
 */
async function getReadablePaths(dir) {
  const rotated = await listRotatedFilenames(dir);
  return [path.join(dir, LOG_FILENAME), ...rotated.map(name => path.join(dir, name))];
}

/**
 * Obtener logs de auditoría para un pedido específico
 * @param {string} orderId - ID del pedido
 * @returns {Promise<Array>} Array de entradas de log para ese pedido
 */
export async function getAuditLogsForOrder(orderId) {
  try {
    const dir = await ensureLogsDirectory();
    const results = [];
    const target = String(orderId);
    // Texto tal como aparecería dentro del JSON (prefiltro barato antes de JSON.parse)
    const needle = JSON.stringify(target).slice(1, -1);

    for (const filePath of await getReadablePaths(dir)) {
      try {
        for await (const entry of readJsonLines(filePath, needle)) {
          if (String(entry.orderId) === target) results.push(entry);
        }
      } catch (error) {
        console.error(`⚠️ Error leyendo ${path.basename(filePath)}:`, error.message);
      }
    }
    
    // Ordenar por timestamp (más reciente primero)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return results;
    
  } catch (error) {
    console.error('❌ Error obteniendo audit logs:', error);
    return [];
  }
}

/**
 * Obtener estadísticas de auditoría
 * @returns {Promise<Object|null>} Estadísticas
 */
export async function getAuditStats() {
  try {
    const dir = await ensureLogsDirectory();
    
    const stats = {
      totalOperations: 0,
      byAction: {},
      byOperator: {},
      byDate: {},
      recentOverwrites: [],
      suspiciousActivities: []
    };

    for (const filePath of await getReadablePaths(dir)) {
      try {
        for await (const entry of readJsonLines(filePath)) {
          stats.totalOperations++;

          // Por acción
          stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
          
          // Por operador
          stats.byOperator[entry.operator] = (stats.byOperator[entry.operator] || 0) + 1;
          
          // Por fecha (solo día)
          if (typeof entry.timestamp === 'string') {
            const date = entry.timestamp.split('T')[0];
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;
          }
          
          // Detectar posibles sobrescrituras (CREAR con ID existente)
          if (entry.action === 'CREAR' && entry.metadata?.existingId) {
            stats.recentOverwrites.push({
              orderId: entry.orderId,
              timestamp: entry.timestamp,
              operator: entry.operator
            });
          }
          
          // Detectar actividades sospechosas
          if (entry.metadata?.warning || entry.metadata?.suspicious) {
            stats.suspiciousActivities.push({
              orderId: entry.orderId,
              action: entry.action,
              timestamp: entry.timestamp,
              operator: entry.operator,
              reason: entry.metadata.warning || entry.metadata.suspicious
            });
          }
        }
      } catch (error) {
        console.error(`⚠️ Error procesando ${path.basename(filePath)}:`, error.message);
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}

/**
 * Listar archivos de audit log disponibles (actual + rotados + legacy)
 * @returns {Promise<Object>} Información de archivos
 */
export async function listAuditLogFiles() {
  try {
    const dir = await ensureLogsDirectory();
    
    const result = {
      main: null,
      backups: [],
      legacy: null
    };
    
    // Archivo actual: recorrido en streaming para contar entradas y primera/última fecha
    const mainPath = path.join(dir, LOG_FILENAME);
    let mainStats = null;
    try {
      mainStats = await fs.promises.stat(mainPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (mainStats) {
      let entries = 0;
      let oldestEntry = null;
      let newestEntry = null;
      for await (const entry of readJsonLines(mainPath)) {
        entries++;
        if (oldestEntry === null) oldestEntry = entry.timestamp ?? null;
        newestEntry = entry.timestamp ?? newestEntry;
      }

      result.main = {
        filename: LOG_FILENAME,
        path: mainPath,
        size: mainStats.size,
        sizeHuman: formatBytes(mainStats.size),
        entries,
        created: mainStats.birthtime,
        modified: mainStats.mtime,
        oldestEntry,
        newestEntry
      };
    }
    
    // Archivos rotados (solo stat, sin leerlos)
    const rotatedNames = await listRotatedFilenames(dir);
    const backups = [];
    for (const name of rotatedNames) {
      const filePath = path.join(dir, name);
      try {
        const stats = await fs.promises.stat(filePath);
        backups.push({
          filename: name,
          path: filePath,
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          created: stats.birthtime,
          modified: stats.mtime
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error; // Rotado/borrado mientras listábamos
      }
    }
    result.backups = backups.sort((a, b) => b.modified - a.modified);

    // Archivo legacy: solo se informa su tamaño vía stat, NUNCA se lee
    try {
      const legacyPath = path.join(dir, LEGACY_LOG_FILENAME);
      const legacyStats = await fs.promises.stat(legacyPath);
      result.legacy = {
        filename: LEGACY_LOG_FILENAME,
        path: legacyPath,
        size: legacyStats.size,
        sizeHuman: formatBytes(legacyStats.size),
        created: legacyStats.birthtime,
        modified: legacyStats.mtime
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error listando audit logs:', error);
    return { main: null, backups: [], legacy: null };
  }
}

/**
 * Formatear bytes a tamaño legible
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default {
  logAuditEntry,
  getAuditLogsForOrder,
  getAuditStats,
  listAuditLogFiles
};
