import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Logger de auditoría para rastrear todas las operaciones de pedidos
 * Guarda logs en formato JSON con rotación diaria
 */

// Configuración
const LOGS_DIR = path.join(__dirname, '..', 'logs', 'audit');
const LOG_FILENAME = 'audit-log.json'; // Un solo archivo para todo
const MAX_LOG_SIZE = 100 * 1024 * 1024; // 100MB - cuando llegue a este tamaño, se rotará

/**
 * Asegurar que el directorio de logs existe
 */
function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    console.log('📁 Directorio de audit logs creado:', LOGS_DIR);
  }
}

/**
 * Obtener ruta completa del archivo de log principal
 */
function getLogFilePath() {
  return path.join(LOGS_DIR, LOG_FILENAME);
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
 * Escribir entrada de auditoría
 * @param {string} action - Tipo de acción: 'CREAR', 'EDITAR', 'ELIMINAR', etc.
 * @param {Object} data - Datos del pedido (completos)
 * @param {Object} metadata - Metadata adicional (usuario, IP, etc.)
 * @param {Object} before - Datos antes del cambio (solo para EDITAR)
 */
export function logAuditEntry(action, data, metadata = {}, before = null) {
  try {
    ensureLogsDirectory();
    
    const logFilePath = getLogFilePath();
    
    // Construir entrada de log
    const entry = {
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
    
    // Leer archivo existente o crear array vacío
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        logs = content.trim() ? JSON.parse(content) : [];
      } catch (parseError) {
        console.error('⚠️ Error parseando log existente, creando nuevo:', parseError.message);
        // Si el archivo está corrupto, hacer backup y empezar de nuevo
        const backupPath = `${logFilePath}.backup.${Date.now()}`;
        fs.copyFileSync(logFilePath, backupPath);
        logs = [];
      }
    }
    
    // Agregar nueva entrada
    logs.push(entry);
    
    // Verificar tamaño del archivo y rotar si es necesario
    const logSize = Buffer.byteLength(JSON.stringify(logs, null, 2), 'utf8');
    if (logSize > MAX_LOG_SIZE) {
      // Rotar el archivo actual a backup con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(LOGS_DIR, `audit-log-backup-${timestamp}.json`);
      
      fs.writeFileSync(backupPath, JSON.stringify(logs.slice(0, -1), null, 2), 'utf8');
      console.log(`📦 Log alcanzó ${formatBytes(logSize)}, rotado a: ${path.basename(backupPath)}`);
      console.log(`📝 Iniciando nuevo archivo de audit log`);
      
      logs = [entry]; // Empezar nuevo archivo con solo la entrada actual
    }
    
    // Escribir archivo
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
    
    console.log(`✅ [AUDIT] ${action} - Pedido #${entry.orderId} - ${entry.operator}`);
    
    return entry;
    
  } catch (error) {
    console.error('❌ Error escribiendo audit log:', error);
    // No lanzar error para no interrumpir la operación principal
    return null;
  }
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
 * Obtener logs de auditoría para un pedido específico
 * @param {string} orderId - ID del pedido
 * @returns {Array} Array de entradas de log para ese pedido
 */
export function getAuditLogsForOrder(orderId) {
  try {
    ensureLogsDirectory();
    const logFilePath = getLogFilePath();
    const results = [];
    
    // Leer archivo principal
    if (fs.existsSync(logFilePath)) {
      try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        const logs = content.trim() ? JSON.parse(content) : [];
        
        // Filtrar por orderId
        const orderLogs = logs.filter(entry => 
          String(entry.orderId) === String(orderId)
        );
        
        results.push(...orderLogs);
      } catch (error) {
        console.error('⚠️ Error leyendo audit log:', error.message);
      }
    }
    
    // También buscar en archivos de backup
    const files = fs.readdirSync(LOGS_DIR);
    const backupFiles = files.filter(f => f.startsWith('audit-log-backup-'));
    
    for (const backupFile of backupFiles) {
      try {
        const content = fs.readFileSync(path.join(LOGS_DIR, backupFile), 'utf8');
        const logs = JSON.parse(content);
        
        const orderLogs = logs.filter(entry => 
          String(entry.orderId) === String(orderId)
        );
        
        results.push(...orderLogs);
      } catch (error) {
        console.error(`⚠️ Error leyendo ${backupFile}:`, error.message);
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
 * @returns {Object} Estadísticas
 */
export function getAuditStats() {
  try {
    ensureLogsDirectory();
    const logFilePath = getLogFilePath();
    
    const stats = {
      totalOperations: 0,
      byAction: {},
      byOperator: {},
      byDate: {},
      recentOverwrites: [],
      suspiciousActivities: []
    };
    
    // Leer archivo principal
    if (fs.existsSync(logFilePath)) {
      try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        const logs = content.trim() ? JSON.parse(content) : [];
        
        stats.totalOperations = logs.length;
        
        logs.forEach(entry => {
          // Por acción
          stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
          
          // Por operador
          stats.byOperator[entry.operator] = (stats.byOperator[entry.operator] || 0) + 1;
          
          // Por fecha (solo día)
          const date = entry.timestamp.split('T')[0];
          stats.byDate[date] = (stats.byDate[date] || 0) + 1;
          
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
        });
      } catch (error) {
        console.error('⚠️ Error procesando audit log:', error.message);
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}

/**
 * Listar archivos de audit log disponibles (principal + backups)
 * @returns {Object} Información de archivos
 */
export function listAuditLogFiles() {
  try {
    ensureLogsDirectory();
    
    const result = {
      main: null,
      backups: []
    };
    
    const files = fs.readdirSync(LOGS_DIR);
    
    // Archivo principal
    const mainFile = LOG_FILENAME;
    const mainPath = path.join(LOGS_DIR, mainFile);
    if (fs.existsSync(mainPath)) {
      const stats = fs.statSync(mainPath);
      const content = fs.readFileSync(mainPath, 'utf8');
      const logs = content.trim() ? JSON.parse(content) : [];
      
      result.main = {
        filename: mainFile,
        path: mainPath,
        size: stats.size,
        sizeHuman: formatBytes(stats.size),
        entries: logs.length,
        created: stats.birthtime,
        modified: stats.mtime,
        oldestEntry: logs.length > 0 ? logs[0].timestamp : null,
        newestEntry: logs.length > 0 ? logs[logs.length - 1].timestamp : null
      };
    }
    
    // Archivos de backup
    const backupFiles = files
      .filter(f => f.startsWith('audit-log-backup-') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(LOGS_DIR, f);
        const stats = fs.statSync(filePath);
        
        return {
          filename: f,
          path: filePath,
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);
    
    result.backups = backupFiles;
    
    return result;
    
  } catch (error) {
    console.error('❌ Error listando audit logs:', error);
    return { main: null, backups: [] };
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
