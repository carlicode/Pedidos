#!/usr/bin/env node

/**
 * Script para comparar el audit log con el Google Sheet actual
 * y detectar carreras que fueron creadas pero ya no existen
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const AUDIT_DIR = process.env.AUDIT_LOGS_DIR || path.join(__dirname, '..', 'logs', 'audit');
const AUDIT_LOG_JSONL_PATH = path.join(AUDIT_DIR, 'audit-log.jsonl'); // Formato actual (JSON Lines)
const AUDIT_LOG_LEGACY_PATH = path.join(AUDIT_DIR, 'audit-log.json'); // Formato viejo (fallback)
const SHEET_ID = process.env.SHEET_ID || '1_eDCxH_lNGzPMDEL6_NqCBdDk5eUO-tZuGZQEGNHpSs';

// Cargar credenciales desde secrets
async function loadCredentials() {
  try {
    // Intentar cargar desde archivo local primero
    const credPath = path.join(__dirname, '..', '..', 'pedidos-app-credentials.json');
    if (fs.existsSync(credPath)) {
      return JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }
    
    // Si no existe, intentar desde AWS Secrets Manager
    const { getSecrets } = await import('../utils/secrets.js');
    const secrets = await getSecrets();
    
    if (secrets.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(secrets.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    
    throw new Error('No se encontraron credenciales de Google');
  } catch (error) {
    console.error(color('red', '❌ Error cargando credenciales:', error.message));
    console.log(color('yellow', '\n💡 Asegúrate de que las credenciales estén configuradas:'));
    console.log(color('yellow', '   1. Archivo pedidos-app-credentials.json en la raíz, O'));
    console.log(color('yellow', '   2. AWS Secrets Manager configurado'));
    console.log('');
    process.exit(1);
  }
}

// Colores
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function color(col, text) {
  return `${c[col]}${text}${c.reset}`;
}

/**
 * Cargar audit log
 */
async function loadAuditLog() {
  try {
    let logs = [];

    if (fs.existsSync(AUDIT_LOG_JSONL_PATH)) {
      // Formato actual: rotados (más viejos primero) + archivo actual, línea por línea
      const rotated = fs.readdirSync(AUDIT_DIR)
        .filter(f => /^audit-log-\d{4}-.*\.jsonl$/.test(f))
        .sort()
        .map(f => path.join(AUDIT_DIR, f));

      for (const filePath of [...rotated, AUDIT_LOG_JSONL_PATH]) {
        const rl = readline.createInterface({
          input: fs.createReadStream(filePath, { encoding: 'utf8' }),
          crlfDelay: Infinity
        });
        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            logs.push(JSON.parse(line));
          } catch {
            // Línea corrupta: se saltea
          }
        }
      }
    } else if (fs.existsSync(AUDIT_LOG_LEGACY_PATH)) {
      // Fallback: formato legacy (un array JSON)
      logs = JSON.parse(fs.readFileSync(AUDIT_LOG_LEGACY_PATH, 'utf8'));
    } else {
      console.log(color('yellow', '⚠️  No se encontró audit log. El sistema se activó recientemente.'));
      return [];
    }
    
    console.log(color('green', `✅ Audit log cargado: ${logs.length} entradas`));
    
    return logs;
  } catch (error) {
    console.error(color('red', `❌ Error leyendo audit log: ${error.message}`));
    return [];
  }
}

/**
 * Obtener IDs del Google Sheet
 */
async function getSheetIDs(credentials) {
  try {
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(color('cyan', '📊 Consultando Google Sheet...'));
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: '2026!A2:A'  // Columna ID, desde fila 2 (sin header)
    });

    const rows = response.data.values || [];
    const ids = rows
      .map(row => row[0])
      .filter(id => id && id.trim() !== '')
      .map(id => String(id).trim());

    console.log(color('green', `✅ Google Sheet consultado: ${ids.length} carreras encontradas`));
    
    return new Set(ids);
  } catch (error) {
    console.error(color('red', `❌ Error consultando Google Sheet: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Analizar y comparar
 */
async function main() {
  console.log(color('bright', '\n🔍 COMPARACIÓN: AUDIT LOG vs GOOGLE SHEET\n'));
  console.log(color('cyan', '═'.repeat(80)));
  console.log('');

  // Cargar credenciales
  const credentials = await loadCredentials();
  
  // Cargar datos
  const logs = await loadAuditLog();
  
  if (logs.length === 0) {
    console.log('');
    console.log(color('yellow', '⚠️  El audit log está vacío o no existe.'));
    console.log(color('yellow', '   El sistema de auditoría se activó el 30/01/2026.'));
    console.log(color('yellow', '   Solo puede detectar carreras eliminadas DESPUÉS de esa fecha.'));
    console.log('');
    console.log(color('cyan', '💡 Para detectar eliminaciones antiguas:'));
    console.log('   1. Revisa el Historial de Versiones del Google Sheet');
    console.log('   2. Usa: Archivo → Historial de versiones → Ver historial de versiones');
    console.log('   3. Busca cambios donde se eliminaron filas');
    console.log('');
    process.exit(0);
  }

  const sheetIDs = await getSheetIDs(credentials);

  // Extraer IDs creados del audit log
  const createdIDs = new Set();
  const creationDates = new Map(); // ID -> fecha de creación
  
  logs.forEach(entry => {
    if (entry.action === 'CREAR') {
      const id = String(entry.orderId);
      createdIDs.add(id);
      if (!creationDates.has(id)) {
        creationDates.set(id, entry.timestamp);
      }
    }
  });

  console.log('');
  console.log(color('cyan', '═'.repeat(80)));
  console.log(color('bright', '  RESULTADOS DEL ANÁLISIS'));
  console.log(color('cyan', '═'.repeat(80)));
  console.log('');
  console.log(color('cyan', `  Carreras CREADAS (según audit log): ${createdIDs.size}`));
  console.log(color('cyan', `  Carreras ACTUALES (en Google Sheet): ${sheetIDs.size}`));
  console.log('');

  // Detectar carreras eliminadas
  const deletedIDs = Array.from(createdIDs).filter(id => !sheetIDs.has(id));

  if (deletedIDs.length > 0) {
    console.log(color('red', `  ⚠️  CARRERAS ELIMINADAS: ${deletedIDs.length}`));
    console.log('');
    console.log(color('yellow', '  Las siguientes carreras fueron CREADAS pero ya NO están en el Sheet:'));
    console.log('');
    
    deletedIDs.sort((a, b) => parseInt(a) - parseInt(b)).forEach(id => {
      const fecha = creationDates.get(id);
      const fechaFormateada = fecha ? new Date(fecha).toLocaleString('es-BO') : 'Desconocida';
      console.log(color('yellow', `    • Carrera #${id} - Creada: ${fechaFormateada}`));
    });
    
    console.log('');
    console.log(color('red', '  🚨 ACCIÓN RECOMENDADA:'));
    console.log('     1. Revisa el Historial de Versiones del Google Sheet');
    console.log('     2. Verifica quién eliminó estas filas y cuándo');
    console.log('     3. Considera restaurar si fue un error');
    console.log('');
  } else {
    console.log(color('green', '  ✅ TODAS LAS CARRERAS ESTÁN PRESENTES'));
    console.log('');
    console.log(color('green', '  No se detectaron carreras eliminadas.'));
    console.log(color('green', '  Todas las carreras creadas (según el audit log) existen en el Sheet.'));
    console.log('');
  }

  // Carreras extra en el Sheet (creadas antes del audit log)
  const extraIDs = Array.from(sheetIDs).filter(id => !createdIDs.has(id));
  
  if (extraIDs.length > 0) {
    console.log('');
    console.log(color('cyan', '═'.repeat(80)));
    console.log(color('bright', '  CARRERAS ANTERIORES AL AUDIT LOG'));
    console.log(color('cyan', '═'.repeat(80)));
    console.log('');
    console.log(color('cyan', `  El Sheet tiene ${extraIDs.length} carreras creadas ANTES del 30/01/2026`));
    console.log(color('cyan', `  (cuando se activó el sistema de auditoría)`));
    console.log('');
    console.log(color('yellow', '  💡 Para estas carreras antiguas, usa el Historial de Versiones del Sheet'));
    console.log(color('yellow', '     para detectar si alguna fue eliminada y restaurada.'));
    console.log('');
  }

  console.log(color('cyan', '═'.repeat(80)));
  console.log('');
}

main().catch(error => {
  console.error(color('red', `❌ Error: ${error.message}`));
  process.exit(1);
});
