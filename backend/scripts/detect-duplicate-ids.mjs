#!/usr/bin/env node

/**
 * Script para detectar IDs duplicados en el Google Sheet de Pedidos
 * 
 * Este script:
 * 1. Lee todos los IDs de la columna A
 * 2. Identifica IDs que aparecen más de una vez
 * 3. Genera un reporte detallado con las filas afectadas
 * 4. Sugiere acciones correctivas
 * 
 * Uso:
 *   node backend/scripts/detect-duplicate-ids.mjs
 */

import { google } from 'googleapis'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const SHEET_ID = process.env.SHEET_ID || '1a8M19WHhfM2SWKSiWbTIpVU76gdAFCJ9uv7y0fnPA4g'
const SHEET_NAME = process.env.SHEET_NAME || 'Registros'

console.log('🔍 Detector de IDs Duplicados')
console.log('═══════════════════════════════════════\n')

/**
 * Obtener cliente de autenticación
 */
async function getAuthClient() {
  // Intentar múltiples métodos de autenticación (mismo orden que el backend principal)
  
  // Método 1: Variable de entorno con JSON completo (GOOGLE_SERVICE_ACCOUNT_JSON)
  const serviceAccountJSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (serviceAccountJSON) {
    try {
      console.log('🔐 Intentando autenticar con GOOGLE_SERVICE_ACCOUNT_JSON...')
      const credentials = JSON.parse(serviceAccountJSON)
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })
      console.log('✅ Autenticación exitosa con GOOGLE_SERVICE_ACCOUNT_JSON')
      return auth
    } catch (error) {
      console.warn('⚠️ No se pudo usar GOOGLE_SERVICE_ACCOUNT_JSON:', error.message)
    }
  }
  
  // Método 2: Archivo de credenciales (GOOGLE_SERVICE_ACCOUNT_FILE)
  const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
  if (serviceAccountFile) {
    try {
      console.log('🔐 Intentando autenticar con GOOGLE_SERVICE_ACCOUNT_FILE...')
      
      if (fs.existsSync(serviceAccountFile)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: serviceAccountFile,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        })
        console.log('✅ Autenticación exitosa con GOOGLE_SERVICE_ACCOUNT_FILE')
        return auth
      } else {
        console.warn(`⚠️ Archivo no encontrado: ${serviceAccountFile}`)
      }
    } catch (error) {
      console.warn('⚠️ No se pudo usar GOOGLE_SERVICE_ACCOUNT_FILE:', error.message)
    }
  }
  
  throw new Error(`
No se encontraron credenciales de Google válidas.

Por favor, configura una de las siguientes opciones en tu archivo .env:

1. GOOGLE_SERVICE_ACCOUNT_JSON="<contenido del archivo JSON de credenciales>"
2. GOOGLE_SERVICE_ACCOUNT_FILE="/ruta/al/archivo/credenciales.json"

Ubicación esperada del .env: ${path.join(__dirname, '..', '..', '.env')}
`)
}

/**
 * Función para "quotear" nombres de hojas con caracteres especiales
 */
function quoteSheet(name) {
  if (!name) return name
  if (/^[A-Za-z0-9_]+$/.test(name)) return name
  return `'${name.replace(/'/g, "''")}'`
}

/**
 * Detectar IDs duplicados en el sheet
 */
async function detectDuplicateIds() {
  try {
    console.log('📊 Conectando con Google Sheets...\n')
    
    const auth = await getAuthClient()
    await auth.authorize()
    
    const sheets = google.sheets({ version: 'v4', auth })
    const quoted = quoteSheet(SHEET_NAME)
    
    // Leer toda la columna A (IDs)
    console.log(`📖 Leyendo columna A del sheet "${SHEET_NAME}"...\n`)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A:A`
    })
    
    const rows = response.data.values || []
    
    if (rows.length === 0) {
      console.log('⚠️ No se encontraron datos en la columna A')
      return
    }
    
    console.log(`✅ Total de filas leídas: ${rows.length}`)
    console.log(`   (Incluyendo header)\n`)
    
    // Mapa de ID -> array de filas donde aparece
    const idMap = new Map()
    
    // Procesar cada fila (saltando header en índice 0)
    for (let i = 1; i < rows.length; i++) {
      const id = rows[i] && rows[i][0]
      
      if (!id || String(id).trim() === '') {
        continue // Saltar filas vacías
      }
      
      const idStr = String(id).trim()
      const rowNumber = i + 1 // Filas de Google Sheets empiezan en 1
      
      if (!idMap.has(idStr)) {
        idMap.set(idStr, [])
      }
      
      idMap.get(idStr).push(rowNumber)
    }
    
    console.log(`✅ Total de IDs únicos procesados: ${idMap.size}\n`)
    
    // Filtrar solo los IDs que aparecen más de una vez
    const duplicates = []
    
    for (const [id, rowNumbers] of idMap.entries()) {
      if (rowNumbers.length > 1) {
        duplicates.push({
          id,
          count: rowNumbers.length,
          rows: rowNumbers
        })
      }
    }
    
    // Ordenar por número de duplicados (descendente)
    duplicates.sort((a, b) => b.count - a.count)
    
    // Generar reporte
    console.log('═══════════════════════════════════════')
    console.log('📋 REPORTE DE IDs DUPLICADOS')
    console.log('═══════════════════════════════════════\n')
    
    if (duplicates.length === 0) {
      console.log('✅ ¡EXCELENTE! No se encontraron IDs duplicados.')
      console.log('   El sistema está limpio.\n')
      return
    }
    
    console.log(`🚨 CRÍTICO: Se encontraron ${duplicates.length} IDs duplicados\n`)
    
    // Calcular total de filas afectadas
    const totalAffectedRows = duplicates.reduce((sum, dup) => sum + dup.count, 0)
    console.log(`📊 Total de filas afectadas: ${totalAffectedRows}\n`)
    
    console.log('Detalle de duplicados:\n')
    
    duplicates.forEach((dup, index) => {
      console.log(`${index + 1}. ID: ${dup.id}`)
      console.log(`   Aparece: ${dup.count} veces`)
      console.log(`   Filas: ${dup.rows.join(', ')}`)
      console.log(`   🔗 Ver en Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0&range=A${dup.rows[0]}:A${dup.rows[dup.rows.length - 1]}`)
      console.log('')
    })
    
    // Generar archivo de reporte
    const reportPath = path.join(__dirname, '..', '..', 'DUPLICATE_IDS_REPORT.json')
    const reportData = {
      timestamp: new Date().toISOString(),
      totalDuplicates: duplicates.length,
      totalAffectedRows,
      duplicates: duplicates.map(dup => ({
        id: dup.id,
        occurrences: dup.count,
        rows: dup.rows,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0&range=A${dup.rows[0]}`
      }))
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
    console.log('═══════════════════════════════════════')
    console.log(`📄 Reporte guardado en: ${reportPath}\n`)
    
    // Sugerencias de acción
    console.log('═══════════════════════════════════════')
    console.log('🛠️ ACCIONES RECOMENDADAS')
    console.log('═══════════════════════════════════════\n')
    
    console.log('1. REVISAR MANUALMENTE cada ID duplicado:')
    console.log('   - Abrir el Google Sheet')
    console.log('   - Ver las filas indicadas')
    console.log('   - Determinar cuál es el pedido correcto\n')
    
    console.log('2. CORREGIR los duplicados:')
    console.log('   - Cambiar el ID de uno de los pedidos al siguiente disponible')
    console.log('   - Documentar el cambio en Observaciones')
    console.log('   - Guardar captura de pantalla ANTES de modificar\n')
    
    console.log('3. VERIFICAR en el audit log:')
    console.log('   - Revisar cuándo se crearon los duplicados')
    console.log('   - Identificar si hubo pérdida de datos')
    console.log('   - Ver el "before" de ediciones para recuperar datos\n')
    
    console.log('4. EJECUTAR este script NUEVAMENTE después de corregir')
    console.log('   - Para confirmar que ya no hay duplicados\n')
    
    console.log('═══════════════════════════════════════\n')
    
    // Exit con código de error si hay duplicados
    process.exit(1)
    
  } catch (error) {
    console.error('❌ Error detectando duplicados:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Ejecutar
detectDuplicateIds()
