// Pide a Bee Tracked Turbo quién está trabajando hoy (drivers y bikers) para la
// página /monitor. Turbo es la fuente de verdad; aquí solo se hace de proxy con
// caché corta para que muchas pestañas abiertas no se traduzcan en muchas
// llamadas a Turbo.
//
// obtenerMonitorHoy() NUNCA lanza. Devuelve siempre uno de:
//   { ok: true,  data, stale: false }
//   { ok: true,  data, stale: true, staleDesde: '<ISO>' }   (Turbo falló, se sirve la última copia)
//   { ok: false, error: 'SECRETO_NO_CONFIGURADO' }
//   { ok: false, error: 'TURBO_NO_DISPONIBLE' }
//
// El secreto se manda en el header x-beezy-secret y NUNCA se loguea.
const TURBO_NOTIFY_URL_POR_DEFECTO =
  'https://oc5uh4bhx8.execute-api.us-east-1.amazonaws.com/pedidos/notificar-asignacion'

export function crearTurboMonitor({
  fetchFn = fetch,
  ahora = () => Date.now(),
  env = process.env,
  ttlMs = 30_000,
  timeoutMs = 5_000,
} = {}) {
  let cache = null // { data, guardadoEn }
  let enVuelo = null // Promise compartida entre llamadas simultáneas

  function urlMonitor() {
    const base = env.TURBO_API_URL
      || new URL(env.TURBO_NOTIFY_URL || TURBO_NOTIFY_URL_POR_DEFECTO).origin
    return `${base}/beezy/monitor-hoy`
  }

  // Respuesta ante un fallo: la última copia buena (aunque vencida) o error.
  function respuestaDeFallo(motivo, secreto) {
    const motivoSeguro = String(motivo).split(secreto).join('***')
    console.warn(`🖥️ monitor: ${motivoSeguro}`)
    if (cache) {
      return {
        ok: true,
        data: cache.data,
        stale: true,
        staleDesde: new Date(cache.guardadoEn).toISOString(),
      }
    }
    return { ok: false, error: 'TURBO_NO_DISPONIBLE' }
  }

  async function pedirATurbo(secreto) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await fetchFn(urlMonitor(), {
        headers: { 'x-beezy-secret': secreto },
        signal: controller.signal,
      })
      if (resp.status !== 200) return respuestaDeFallo(`Turbo respondió ${resp.status}`, secreto)

      const data = await resp.json().catch(() => null)
      if (!data || !Array.isArray(data.drivers) || !Array.isArray(data.bikers)) {
        return respuestaDeFallo('respuesta de Turbo con forma inválida', secreto)
      }

      cache = { data, guardadoEn: ahora() }
      return { ok: true, data, stale: false }
    } catch (err) {
      return respuestaDeFallo(err?.message || err?.name || 'error desconocido', secreto)
    } finally {
      clearTimeout(timer)
    }
  }

  async function obtenerMonitorHoy() {
    try {
      const secreto = env.TURBO_NOTIFY_SECRET
      if (!secreto) return { ok: false, error: 'SECRETO_NO_CONFIGURADO' }

      if (cache && ahora() - cache.guardadoEn < ttlMs) {
        return { ok: true, data: cache.data, stale: false }
      }

      if (!enVuelo) {
        enVuelo = pedirATurbo(secreto).finally(() => { enVuelo = null })
      }
      return await enVuelo
    } catch (err) {
      console.warn(`🖥️ monitor: ${err?.message || 'error inesperado'}`)
      return { ok: false, error: 'TURBO_NO_DISPONIBLE' }
    }
  }

  return { obtenerMonitorHoy }
}

export const { obtenerMonitorHoy } = crearTurboMonitor()
