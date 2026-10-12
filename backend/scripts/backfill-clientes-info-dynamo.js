/**
 * Backfill de la info de clientes: copia el Google Sheet de "Información del Cliente"
 * (NOMBRES DE CLIENTES | CUENTA | PROCEDIMIENTOS | ETIQUETA | envios | TIPO DE PAGO)
 * a la tabla DynamoDB indicada en CLIENTES_INFO_DYNAMO_TABLE.
 *
 * - Por defecto es --dry-run: NO escribe nada, solo informa qué insertaría.
 * - Con --apply: Put con ConditionExpression attribute_not_exists(id). Re-correrlo JAMÁS pisa
 *   ediciones hechas desde la app (los ítems ya existentes se saltean).
 * - Duplicados del Sheet: no se fusionan; cada fila es un ítem (id con '#n' desde la 2ª repetición).
 * - Después del backfill el Sheet queda congelado: la DB es la fuente de verdad.
 *
 * Uso:
 *   CLIENTES_INFO_DYNAMO_TABLE=beezy-clientes-info-dev node backend/scripts/backfill-clientes-info-dynamo.js           # dry-run
 *   CLIENTES_INFO_DYNAMO_TABLE=beezy-clientes-info-dev node backend/scripts/backfill-clientes-info-dynamo.js --apply
 *
 * Requiere credenciales AWS locales con secretsmanager:GetSecretValue sobre pedidos/prod/all-secrets
 * y dynamodb:PutItem (y Scan para el chequeo del dry-run) sobre la tabla.
 */

import { google } from 'googleapis'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { mapearFilasSheet, buildClienteItem } from '../services/clientesInfo.js'

const REGION = process.env.AWS_REGION || 'us-east-1'
const SECRET_NAME = process.env.SECRET_NAME || 'pedidos/prod/all-secrets'
const TABLE = (process.env.CLIENTES_INFO_DYNAMO_TABLE || '').trim()
const USUARIO_BACKFILL = 'backfill-sheet'

// Mismos defaults que routes/clientInfo.js (getSheetConfig)
const DEFAULT_SHEET_ID = '1YhEpo6EBdCEm15y6xnEeUDiViJEItQAU23yHTzBkRIM'
const DEFAULT_SHEET_NAME = 'Hoja 1'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
if (APPLY && args.includes('--dry-run')) {
  console.error('❌ Usá --apply o --dry-run, no ambos')
  process.exit(1)
}

if (!TABLE) {
  console.error('❌ Falta CLIENTES_INFO_DYNAMO_TABLE en el entorno. Abortando.')
  process.exit(1)
}

function quoteSheet(title) {
  return `'${String(title).replace(/'/g, "''")}'`
}

async function getSecrets() {
  const client = new SecretsManagerClient({ region: REGION })
  const res = await client.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }))
  return JSON.parse(res.SecretString)
}

/** env -> Secrets Manager -> default (igual que getSheetConfig del backend) */
function getSheetConfig(secrets) {
  return {
    sheetId: process.env.CLIENT_INFO_SHEET_ID || secrets.CLIENT_INFO_SHEET_ID || DEFAULT_SHEET_ID,
    sheetName: process.env.CLIENT_INFO_SHEET_NAME || secrets.CLIENT_INFO_SHEET_NAME || DEFAULT_SHEET_NAME,
  }
}

async function leerSheet(secrets, { sheetId, sheetName }) {
  const creds = JSON.parse(secrets.GOOGLE_SERVICE_ACCOUNT_JSON)
  const auth = new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  )
  await auth.authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${quoteSheet(sheetName)}!A:F`,
  })
  return res.data.values || []
}

/** ids que ya existen en la tabla (Scan paginado solo de la clave) */
async function idsExistentes(docClient) {
  const ids = new Set()
  let lastKey
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: TABLE,
      ProjectionExpression: 'id',
      ExclusiveStartKey: lastKey,
    }))
    for (const it of res.Items || []) ids.add(it.id)
    lastKey = res.LastEvaluatedKey
  } while (lastKey)
  return ids
}

async function main() {
  console.log(`🚀 Backfill info de clientes -> tabla ${TABLE} (${APPLY ? 'APLICAR' : 'dry-run, no escribe'})`)

  const secrets = await getSecrets()
  const config = getSheetConfig(secrets)
  console.log(`📊 Leyendo Sheet ${config.sheetId} / ${config.sheetName}`)
  const rows = await leerSheet(secrets, config)

  const { items, vacias, invalidas, duplicados } = mapearFilasSheet(rows)
  console.log(`📄 Filas de datos: ${Math.max(rows.length - 1, 0)}`)
  console.log(`   - Válidas: ${items.length}`)
  console.log(`   - Vacías (ignoradas): ${vacias.length}${vacias.length ? ` -> filas ${vacias.join(', ')}` : ''}`)
  console.log(`   - Inválidas: ${invalidas.length}`)
  invalidas.forEach((x) => console.log(`       fila ${x.fila}: ${x.errores.join('; ')}`))
  console.log(`   - Nombres duplicados: ${duplicados.length}`)
  duplicados.forEach((d) => console.log(`       "${d.nombreClave}" -> filas ${d.filas.join(', ')} (ids con #n desde la 2ª)`))

  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))

  if (!APPLY) {
    try {
      const existentes = await idsExistentes(docClient)
      const nuevas = items.filter((it) => !existentes.has(it.id)).length
      console.log(`\n🔎 DRY-RUN: se insertarían ${nuevas} y se saltearían ${items.length - nuevas} (ya existen en la tabla)`)
    } catch (err) {
      console.warn(`\n⚠️ No se pudo consultar la tabla (${err.message}).`)
      console.log(`🔎 DRY-RUN: se intentarían insertar ${items.length} (sin verificar existentes)`)
    }
    console.log('ℹ️ Para escribir: agregá --apply')
    return
  }

  const ahora = new Date().toISOString()
  let insertadas = 0
  let existentes = 0
  for (const it of items) {
    const item = buildClienteItem(it.campos, {
      id: it.id,
      usuario: USUARIO_BACKFILL,
      ahora,
      origen: 'sheet-backfill',
    })
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(id)',
      }))
      insertadas++
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        existentes++
      } else {
        console.error(`❌ Error insertando fila ${it.fila} ("${it.campos.nombreCliente}"):`, err.message)
        throw err
      }
    }
  }

  console.log('\n✅ Resumen:')
  console.log(`   Insertadas: ${insertadas}`)
  console.log(`   Ya existentes (salteadas): ${existentes}`)
  console.log(`   Inválidas: ${invalidas.length}`)
}

main().catch((err) => {
  console.error('💥 Backfill falló:', err.message || err)
  process.exit(1)
})
