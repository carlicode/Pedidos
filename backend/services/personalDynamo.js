/**
 * Lectura de personal (bikers/drivers) desde DynamoDB `bee-personal`.
 *
 * `bee-personal` es la fuente de verdad del personal, administrada por el
 * panel de Bee Tracked Turbo. Este backend SOLO LEE — nunca escribe. El alta
 * de un biker nuevo sigue yendo al Google Sheet (POST /api/bikers).
 *
 * Kill-switch: si PERSONAL_DYNAMO_TABLE no está definida, listActivePersonal
 * retorna null y el caller cae al Google Sheet como respaldo.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../utils/dynamodb.js'

const ASSIGNABLE_ROLES = ['biker', 'driver']

export function getPersonalTableName() {
  return (process.env.PERSONAL_DYNAMO_TABLE || '').trim()
}

function isActive(item) {
  const activo = item?.activo
  if (activo === true || activo === 1) return true
  if (typeof activo === 'string') {
    const normalized = activo.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí'
  }
  return false
}

function normalizeRol(rol) {
  return String(rol || '').trim().toLowerCase()
}

function toBikerRow(item) {
  return {
    Biker: String(item.nombre || '').trim(),
    Whatsapp: String(item.whatsapp || '').trim(),
    rol: normalizeRol(item.rol),
    id: item.id,
  }
}

/**
 * Lista personal activo desde bee-personal (solo lectura).
 * @returns {Promise<Array<{Biker: string, Whatsapp: string, rol: string, id: string}>|null>}
 *   null si PERSONAL_DYNAMO_TABLE no está configurada.
 */
export async function listActivePersonal({ roles = ASSIGNABLE_ROLES } = {}) {
  const tableName = getPersonalTableName()
  if (!tableName) return null

  const allowedRoles = new Set(roles.map(normalizeRol))
  const items = []
  let lastKey

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    )
    items.push(...(result.Items || []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
    .filter(isActive)
    .filter((item) => allowedRoles.has(normalizeRol(item.rol)))
    .map(toBikerRow)
    .filter((row) => row.Biker)
    .sort((a, b) => a.Biker.localeCompare(b.Biker, 'es'))
}
