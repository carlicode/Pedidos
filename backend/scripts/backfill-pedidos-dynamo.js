/**
 * Backfill histórico: copia todos los pedidos de la pestaña 'Registros'
 * del Google Sheet a la tabla DynamoDB beezy-pedidos-prod (espejo).
 *
 * Re-ejecutable (Put idempotente por id) — sirve también para
 * re-sincronizar si el equipo edita el Sheet a mano y el espejo
 * se desvía.
 *
 * Uso: node backend/scripts/backfill-pedidos-dynamo.js
 * Requiere: credenciales AWS locales (aws configure) con permisos
 * secretsmanager:GetSecretValue sobre pedidos/prod/all-secrets y
 * dynamodb:BatchWriteItem sobre beezy-pedidos-prod.
 */

import { google } from 'googleapis'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { buildPedidoItem } from '../services/pedidosMirror.js'

const REGION = process.env.AWS_REGION || 'us-east-1'
const SECRET_NAME = process.env.SECRET_NAME || 'pedidos/prod/all-secrets'
const TABLE = process.env.PEDIDOS_DYNAMO_TABLE || 'beezy-pedidos-prod'
const SHEET_NAME = 'Registros'

function quoteSheet(title) {
  return `'${String(title).replace(/'/g, "''")}'`
}

async function getSecrets() {
  const client = new SecretsManagerClient({ region: REGION })
  const res = await client.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }))
  return JSON.parse(res.SecretString)
}

async function getAuthClient(secrets) {
  const creds = JSON.parse(secrets.GOOGLE_SERVICE_ACCOUNT_JSON)
  return new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  )
}

async function batchWriteWithRetry(docClient, items) {
  let toWrite = items
  let attempt = 0
  while (toWrite.length > 0 && attempt < 6) {
    attempt++
    const res = await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: toWrite.map((item) => ({ PutRequest: { Item: item } }))
      }
    }))
    const unprocessed = res.UnprocessedItems?.[TABLE] || []
    if (unprocessed.length === 0) return
    toWrite = unprocessed.map((r) => r.PutRequest.Item)
    await new Promise((r) => setTimeout(r, 300 * attempt)) // backoff simple
  }
  if (toWrite.length > 0) {
    throw new Error(`No se pudieron escribir ${toWrite.length} ítems tras ${attempt} intentos`)
  }
}

async function main() {
  console.log('🔐 Obteniendo credenciales desde Secrets Manager...')
  const secrets = await getSecrets()
  const SHEET_ID = secrets.SHEET_ID

  console.log('📖 Leyendo Google Sheet...')
  const auth = await getAuthClient(secrets)
  await auth.authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  const quoted = quoteSheet(SHEET_NAME)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${quoted}!A:AE`
  })

  const rows = response.data.values || []
  const headers = rows[0]
  const dataRows = rows.slice(1)
  console.log(`📋 Filas leídas: ${dataRows.length} (headers: ${headers.length} columnas)`)

  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))

  const items = []
  let sinId = 0
  for (const row of dataRows) {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    const id = String(obj['ID'] || '').trim()
    if (!id) { sinId++; continue }
    items.push(buildPedidoItem(obj, 'backfill'))
  }
  console.log(`✅ Filas válidas (con ID): ${items.length} | sin ID (ignoradas): ${sinId}`)

  console.log('📤 Escribiendo en DynamoDB en lotes de 25...')
  let escritos = 0
  for (let i = 0; i < items.length; i += 25) {
    const lote = items.slice(i, i + 25)
    await batchWriteWithRetry(docClient, lote)
    escritos += lote.length
    process.stdout.write(`\r   ${escritos}/${items.length}`)
  }
  console.log('')
  console.log(`✅ Backfill completo: ${escritos} ítems escritos en ${TABLE}`)
}

main().catch((err) => {
  console.error('❌ Error en backfill:', err.message)
  process.exit(1)
})
