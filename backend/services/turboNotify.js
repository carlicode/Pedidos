// Notifica a Bee Tracked Turbo cuando se asigna un biker/driver a un pedido,
// para que le llegue push al celular con la ficha de la carrera.
//
// Best-effort SIEMPRE: si Turbo no responde, el pedido ya quedó guardado en
// Sheet + Dynamo y la operación del operador NO se ve afectada. Solo se manda
// el ID — Turbo arma la ficha leyendo el espejo beezy-pedidos-prod (por eso
// este hook debe llamarse DESPUÉS de mirrorPedido).
const TURBO_NOTIFY_URL = process.env.TURBO_NOTIFY_URL
  || 'https://oc5uh4bhx8.execute-api.us-east-1.amazonaws.com/pedidos/notificar-asignacion'
const TURBO_NOTIFY_SECRET = process.env.TURBO_NOTIFY_SECRET
  || 'b456d254770cf290d61e04018cf3274192e1db8c'

/**
 * Dispara el push de "carrera asignada" si el biker cambió en esta edición.
 * @param {object} orderByHeader pedido con claves = columnas del Sheet (post-merge)
 * @param {string} bikerAnterior valor previo de la columna Biker ('' si es creación)
 */
export async function notificarAsignacionSiCambio(orderByHeader, bikerAnterior = '') {
  try {
    const pedidoId = String(orderByHeader?.['ID'] ?? '').trim()
    const bikerNuevo = String(orderByHeader?.['Biker'] ?? '').trim()
    if (!pedidoId || !bikerNuevo) return
    if (bikerNuevo === String(bikerAnterior ?? '').trim()) return // sin cambio de asignación

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const resp = await fetch(TURBO_NOTIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secreto: TURBO_NOTIFY_SECRET, pedidoId }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    const data = await resp.json().catch(() => ({}))
    console.log(`📲 Turbo notificar-asignacion #${pedidoId} → "${bikerNuevo}":`,
      data.ok ? `push enviado (${data.username})` : (data.motivo || data.error || `HTTP ${resp.status}`))
  } catch (err) {
    console.error('📲 Turbo notificar-asignacion falló (se ignora):', err.message || err)
  }
}
