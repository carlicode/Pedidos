/**
 * Espejo de pedidos en DynamoDB (tabla beezy-pedidos-prod).
 *
 * El Google Sheet (pestaña Registros) SIGUE SIENDO LA FUENTE DE VERDAD.
 * Este módulo replica cada pedido creado/editado a DynamoDB de forma
 * best-effort para que el panel admin de bee-tracked-turbo pueda leerlos
 * sin consumir cuota de Google Sheets API.
 *
 * Garantías:
 * - Kill-switch: si PEDIDOS_DYNAMO_TABLE no está definida, es un no-op.
 * - JAMÁS lanza: cualquier error se loguea con console.warn y la request
 *   del pedido continúa normal. Beezy no puede caerse por este espejo.
 *
 * Si el espejo se desincroniza (ej. ediciones manuales directas en el
 * Sheet), re-correr scripts/backfill-pedidos-dynamo.js (idempotente).
 */

import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../utils/dynamodb.js'

/**
 * Normaliza la fecha de la columna 'Fechas' (DD/MM/YYYY) a YYYY-MM-DD
 * para el GSI fecha-index. Si no es parseable, retorna 'sin-fecha'.
 */
export function normalizarFechaISO(fechaDDMMYYYY) {
  const s = String(fechaDDMMYYYY || '').trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 'sin-fecha'
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

/**
 * Construye el ítem de DynamoDB a partir del pedido como objeto por header
 * (las 31 columnas de HEADER_ORDER). Exportado para reuso en el backfill.
 */
export function buildPedidoItem(orderPorHeader, origen) {
  const precio = parseFloat(orderPorHeader['Precio [Bs]'])
  return {
    id: String(orderPorHeader['ID'] || '').trim(),
    fecha: normalizarFechaISO(orderPorHeader['Fechas']),
    estado: orderPorHeader['Estado'] || '',
    biker: orderPorHeader['Biker'] || '',
    cliente: orderPorHeader['Cliente'] || '',
    operador: orderPorHeader['Operador'] || '',
    precioBs: Number.isFinite(precio) ? precio : 0,
    horaIni: orderPorHeader['Hora Ini'] || '',
    horaFin: orderPorHeader['Hora Fin'] || '',
    datos: orderPorHeader,
    actualizadoEn: new Date().toISOString(),
    origen
  }
}

/**
 * Replica un pedido a DynamoDB (best-effort, nunca lanza).
 * @param {Object} orderPorHeader - Pedido como objeto {header: valor} con las 31 columnas
 * @param {string} origen - 'crear' | 'editar' | 'estado' | 'backfill'
 */
export async function mirrorPedido(orderPorHeader, origen) {
  const tabla = process.env.PEDIDOS_DYNAMO_TABLE
  if (!tabla) return // kill-switch: espejo desactivado

  try {
    const item = buildPedidoItem(orderPorHeader, origen)
    if (!item.id) {
      console.warn('[pedidosMirror] Pedido sin ID, no se espeja')
      return
    }
    await docClient.send(new PutCommand({ TableName: tabla, Item: item }))
    console.log(`[pedidosMirror] ✅ Pedido #${item.id} espejado (${origen})`)
  } catch (err) {
    console.warn(`[pedidosMirror] ⚠️ Falló espejo del pedido (${origen}):`, err.message || err)
  }
}
