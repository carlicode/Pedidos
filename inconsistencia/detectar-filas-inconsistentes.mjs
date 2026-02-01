#!/usr/bin/env node

/**
 * Script para detectar filas inconsistentes en el CSV de Registros.
 *
 * Reglas:
 * 1. Fecha inconsistente: si la Fecha Registro difiere de la mayoría de las filas vecinas (ventana).
 * 2. Fecha "invertida": si al ir por ID creciente, la fecha de una fila es muy posterior a la siguiente (posible fila reemplazada/insertada).
 * 3. IDs duplicados: mismo ID en más de una fila.
 * 4. Hueco de fechas: fila con fecha aislada (muy diferente al bloque anterior y siguiente).
 *
 * Uso: node detectar-filas-inconsistentes.mjs
 *      node detectar-filas-inconsistentes.mjs --csv "ruta/alternativa.csv"
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CSV_PATH = process.argv.find(a => a.startsWith('--csv='))
  ? process.argv.find(a => a.startsWith('--csv=')).slice(6)
  : path.join(__dirname, 'Pedidos Ecodelivery - Beezero - Septiembre - Registros.csv')

const WINDOW_SIZE = 5
const MAX_DAYS_DIFFERENCE = 3

function parseDDMMYYYY(str) {
  if (!str || typeof str !== 'string') return null
  let t = str.trim()
  if (t.startsWith("'")) t = t.slice(1).trim()
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, month, y] = m
  const date = new Date(parseInt(y), parseInt(month) - 1, parseInt(d))
  return isNaN(date.getTime()) ? null : date
}

function parseCSV(text) {
  const rows = []
  let i = 0
  const len = text.length

  while (i < len) {
    const row = []
    while (i < len) {
      if (text[i] === '"') {
        let field = ''
        i++
        while (i < len) {
          if (text[i] === '"') {
            i++
            if (text[i] === '"') {
              field += '"'
              i++
            } else break
          } else {
            field += text[i]
            i++
          }
        }
        row.push(field)
        if (text[i] === ',') {
          i++
        } else if (text[i] === '\n' || text[i] === '\r') {
          if (text[i] === '\r') i++
          if (text[i] === '\n') i++
          break
        } else {
          break
        }
        continue
      }
      let field = ''
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i]
        i++
      }
      row.push(field.trim())
      if (text[i] === ',') {
        i++
      } else if (text[i] === '\n' || text[i] === '\r') {
        if (text[i] === '\r') i++
        if (text[i] === '\n') i++
        break
      } else {
        break
      }
    }
    if (row.length) rows.push(row)
  }
  return rows
}

function main() {
  console.log('📂 Leyendo CSV:', CSV_PATH)
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ No se encontró el archivo:', CSV_PATH)
    process.exit(1)
  }

  const text = fs.readFileSync(CSV_PATH, 'utf8')
  const rawRows = parseCSV(text)
  const header = rawRows[0]
  const dataRows = rawRows.slice(1)

  const idxId = header.indexOf('ID')
  const idxFechaRegistro = header.indexOf('Fecha Registro')
  const idxHoraRegistro = header.indexOf('Hora Registro')
  const idxOperador = header.indexOf('Operador')
  const idxCliente = header.indexOf('Cliente')

  if (idxId === -1 || idxFechaRegistro === -1) {
    console.error('❌ Columnas ID o Fecha Registro no encontradas. Header:', header.slice(0, 5))
    process.exit(1)
  }

  const rows = dataRows.map((r, i) => ({
    rowNumber: i + 2,
    id: (r[idxId] || '').trim(),
    fechaRegistro: (r[idxFechaRegistro] || '').trim(),
    horaRegistro: (r[idxHoraRegistro] || '').trim(),
    operador: (r[idxOperador] || '').trim(),
    cliente: (r[idxCliente] || '').trim(),
    date: parseDDMMYYYY(r[idxFechaRegistro])
  }))

  const inconsistent = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const reasons = []

    if (!r.date) {
      if (r.fechaRegistro) reasons.push({ rule: 'FECHA_INVALIDA', detail: `Fecha no parseable: "${r.fechaRegistro}"` })
      else reasons.push({ rule: 'FECHA_VACIA', detail: 'Sin Fecha Registro' })
    } else {
      const start = Math.max(0, i - WINDOW_SIZE)
      const end = Math.min(rows.length, i + WINDOW_SIZE + 1)
      const window = rows.slice(start, end).filter(x => x.date)
      const dates = window.map(x => x.date.getTime())
      const medianTime = dates.length ? dates.sort((a, b) => a - b)[Math.floor(dates.length / 2)] : 0
      const medianDate = medianTime ? new Date(medianTime) : null

      if (medianDate && window.length >= 2) {
        const diffDays = Math.round((r.date - medianDate) / (24 * 60 * 60 * 1000))
        if (Math.abs(diffDays) > MAX_DAYS_DIFFERENCE) {
          reasons.push({
            rule: 'FECHA_INCONSISTENTE',
            detail: `Fecha ${r.fechaRegistro} difiere ${diffDays} días de la mediana de la ventana (${WINDOW_SIZE} filas antes/después)`
          })
        }
      }

      const nextRow = rows[i + 1]
      if (nextRow && nextRow.date && r.date > nextRow.date) {
        const diffDays = Math.round((r.date - nextRow.date) / (24 * 60 * 60 * 1000))
        if (diffDays > MAX_DAYS_DIFFERENCE) {
          reasons.push({
            rule: 'FECHA_INVERTIDA',
            detail: `Fecha (${r.fechaRegistro}) es posterior a la siguiente fila (${nextRow.fechaRegistro}). Posible fila reemplazada o insertada.`
          })
        }
      }
    }

    if (reasons.length) {
      inconsistent.push({
        rowNumber: r.rowNumber,
        id: r.id,
        fechaRegistro: r.fechaRegistro,
        horaRegistro: r.horaRegistro,
        operador: r.operador,
        cliente: r.cliente,
        reasons
      })
    }
  }

  const idCount = {}
  for (const r of rows) {
    if (r.id) idCount[r.id] = (idCount[r.id] || 0) + 1
  }
  const duplicateIds = Object.entries(idCount).filter(([, c]) => c > 1).map(([id]) => id)
  for (const r of rows) {
    if (duplicateIds.includes(r.id)) {
      const already = inconsistent.find(x => x.rowNumber === r.rowNumber)
      if (already) {
        already.reasons.push({ rule: 'ID_DUPLICADO', detail: `ID ${r.id} aparece ${idCount[r.id]} veces en el archivo` })
      } else {
        inconsistent.push({
          rowNumber: r.rowNumber,
          id: r.id,
          fechaRegistro: r.fechaRegistro,
          horaRegistro: r.horaRegistro,
          operador: r.operador,
          cliente: r.cliente,
          reasons: [{ rule: 'ID_DUPLICADO', detail: `ID ${r.id} aparece ${idCount[r.id]} veces en el archivo` }]
        })
      }
    }
  }

  inconsistent.sort((a, b) => a.rowNumber - b.rowNumber)

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('📋 FILAS INCONSISTENTES (observadas)')
  console.log('═══════════════════════════════════════════════════════════\n')
  console.log(`Total filas de datos: ${rows.length}`)
  console.log(`Filas marcadas como inconsistentes: ${inconsistent.length}`)
  if (duplicateIds.length) console.log(`IDs duplicados encontrados: ${duplicateIds.join(', ')}`)
  console.log('')

  if (inconsistent.length === 0) {
    console.log('✅ No se detectaron filas inconsistentes con las reglas actuales.\n')
    return
  }

  for (const row of inconsistent) {
    console.log(`───────────────────────────────────────────────────────────────`)
    console.log(`Fila (Sheet): ${row.rowNumber}  |  ID: ${row.id}  |  Fecha: ${row.fechaRegistro}  |  Operador: ${row.operador}  |  Cliente: ${row.cliente}`)
    for (const r of row.reasons) {
      console.log(`  • [${r.rule}] ${r.detail}`)
    }
    console.log('')
  }

  const outPath = path.join(__dirname, 'filas-inconsistentes-reporte.json')
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        csvFile: CSV_PATH,
        totalDataRows: rows.length,
        inconsistentCount: inconsistent.length,
        duplicateIds,
        rows: inconsistent
      },
      null,
      2
    )
  )
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`📄 Reporte guardado en: ${outPath}`)
  console.log('═══════════════════════════════════════════════════════════\n')
}

main()
