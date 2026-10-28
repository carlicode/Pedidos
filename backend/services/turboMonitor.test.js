import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearTurboMonitor } from './turboMonitor.js'

const SECRETO = 'secreto-falso-solo-para-tests'
const URL_NOTIFY = 'https://turbo.example.com/pedidos/notificar-asignacion'

const DATA = {
  fecha: '2026-10-28',
  generadoEn: '2026-10-28T16:36:54.486Z',
  horarioVigenteDesde: '2026-10-01',
  drivers: [{ nombre: 'Ana', usuario: 'ana', vinculo: 'x', bloques: [], estado: 'en_turno', turno: null }],
  bikers: [{ nombre: 'Beto', usuario: null, vinculo: 'y', bloques: [], estado: 'en_turno', turno: null }],
}

const ok = (body = DATA) => ({ status: 200, json: async () => body })
const conStatus = (status) => ({ status, json: async () => ({}) })

/** fetch falso: registra cada llamada y responde con lo que devuelva `responder`. */
function fetchFalso(responder = () => ok()) {
  const llamadas = []
  const fn = async (url, opts) => {
    llamadas.push({ url, opts })
    return responder(llamadas.length)
  }
  fn.llamadas = llamadas
  return fn
}

/** Reloj falso controlable. */
function relojFalso(inicio = 1_000_000) {
  let t = inicio
  const fn = () => t
  fn.avanzar = (ms) => { t += ms }
  return fn
}

/** Espía console.warn durante el test y devuelve lo escrito. */
function espiarWarn() {
  const original = console.warn
  const mensajes = []
  console.warn = (...args) => { mensajes.push(args.join(' ')) }
  return { mensajes, restaurar: () => { console.warn = original } }
}

function crear({ fetchFn = fetchFalso(), ahora = relojFalso(), env = {}, ...resto } = {}) {
  return crearTurboMonitor({
    fetchFn,
    ahora,
    env: { TURBO_NOTIFY_SECRET: SECRETO, TURBO_NOTIFY_URL: URL_NOTIFY, ...env },
    ...resto,
  })
}

function errorAbort() {
  const e = new Error('The operation was aborted')
  e.name = 'AbortError'
  return e
}

test('1. sin TURBO_NOTIFY_SECRET → SECRETO_NO_CONFIGURADO y no llama a fetch', async () => {
  const fetchFn = fetchFalso()
  const { obtenerMonitorHoy } = crear({ fetchFn, env: { TURBO_NOTIFY_SECRET: '' } })
  assert.deepEqual(await obtenerMonitorHoy(), { ok: false, error: 'SECRETO_NO_CONFIGURADO' })

  const sinVariable = crearTurboMonitor({ fetchFn, env: {} })
  assert.deepEqual(await sinVariable.obtenerMonitorHoy(), { ok: false, error: 'SECRETO_NO_CONFIGURADO' })
  assert.equal(fetchFn.llamadas.length, 0)
})

test('2. éxito → ok:true, stale:false y los mismos drivers/bikers', async () => {
  const { obtenerMonitorHoy } = crear()
  const r = await obtenerMonitorHoy()
  assert.equal(r.ok, true)
  assert.equal(r.stale, false)
  assert.deepEqual(r.data.drivers, DATA.drivers)
  assert.deepEqual(r.data.bikers, DATA.bikers)
})

test('3. manda x-beezy-secret y apunta a /beezy/monitor-hoy', async () => {
  const fetchFn = fetchFalso()
  const { obtenerMonitorHoy } = crear({ fetchFn })
  await obtenerMonitorHoy()
  assert.equal(fetchFn.llamadas.length, 1)
  const { url, opts } = fetchFn.llamadas[0]
  assert.ok(url.endsWith('/beezy/monitor-hoy'))
  assert.equal(opts.headers['x-beezy-secret'], SECRETO)
  assert.ok(opts.signal)
})

test('4. TURBO_API_URL tiene prioridad; con solo TURBO_NOTIFY_URL se usa su origen', async () => {
  const f1 = fetchFalso()
  await crear({ fetchFn: f1, env: { TURBO_API_URL: 'https://api.example.com' } }).obtenerMonitorHoy()
  assert.equal(f1.llamadas[0].url, 'https://api.example.com/beezy/monitor-hoy')

  const f2 = fetchFalso()
  await crear({ fetchFn: f2 }).obtenerMonitorHoy()
  assert.equal(f2.llamadas[0].url, 'https://turbo.example.com/beezy/monitor-hoy')
  assert.ok(!f2.llamadas[0].url.includes('/pedidos/'))
})

test('5. dos llamadas dentro de 30 s → fetch una sola vez', async () => {
  const fetchFn = fetchFalso()
  const reloj = relojFalso()
  const { obtenerMonitorHoy } = crear({ fetchFn, ahora: reloj })
  await obtenerMonitorHoy()
  reloj.avanzar(29_000)
  const r = await obtenerMonitorHoy()
  assert.equal(fetchFn.llamadas.length, 1)
  assert.equal(r.stale, false)
})

test('6. una llamada a los 31 s → fetch otra vez', async () => {
  const fetchFn = fetchFalso()
  const reloj = relojFalso()
  const { obtenerMonitorHoy } = crear({ fetchFn, ahora: reloj })
  await obtenerMonitorHoy()
  reloj.avanzar(31_000)
  await obtenerMonitorHoy()
  assert.equal(fetchFn.llamadas.length, 2)
})

test('7. cinco llamadas simultáneas → fetch una sola vez', async () => {
  const fetchFn = fetchFalso()
  const { obtenerMonitorHoy } = crear({ fetchFn })
  const resultados = await Promise.all(Array.from({ length: 5 }, () => obtenerMonitorHoy()))
  assert.equal(fetchFn.llamadas.length, 1)
  for (const r of resultados) {
    assert.equal(r.ok, true)
    assert.deepEqual(r.data.drivers, DATA.drivers)
  }
})

test('8. Turbo responde 500 con caché previa → ok:true, stale:true y staleDesde', async () => {
  const espia = espiarWarn()
  try {
    const reloj = relojFalso(1_000_000)
    const fetchFn = fetchFalso((n) => (n === 1 ? ok() : conStatus(500)))
    const { obtenerMonitorHoy } = crear({ fetchFn, ahora: reloj })
    await obtenerMonitorHoy()
    reloj.avanzar(60_000)
    const r = await obtenerMonitorHoy()
    assert.equal(r.ok, true)
    assert.equal(r.stale, true)
    assert.equal(r.staleDesde, new Date(1_000_000).toISOString())
    assert.deepEqual(r.data.drivers, DATA.drivers)
    assert.equal(fetchFn.llamadas.length, 2)
  } finally {
    espia.restaurar()
  }
})

test('9. Turbo responde 500 sin caché → TURBO_NO_DISPONIBLE', async () => {
  const espia = espiarWarn()
  try {
    const { obtenerMonitorHoy } = crear({ fetchFn: fetchFalso(() => conStatus(500)) })
    assert.deepEqual(await obtenerMonitorHoy(), { ok: false, error: 'TURBO_NO_DISPONIBLE' })
  } finally {
    espia.restaurar()
  }
})

test('10. el fetch lanza AbortError (timeout), con y sin caché', async () => {
  const espia = espiarWarn()
  try {
    // sin caché
    const sin = crear({ fetchFn: fetchFalso(() => { throw errorAbort() }) })
    assert.deepEqual(await sin.obtenerMonitorHoy(), { ok: false, error: 'TURBO_NO_DISPONIBLE' })

    // con caché previa
    const reloj = relojFalso()
    const fetchFn = fetchFalso((n) => { if (n === 1) return ok(); throw errorAbort() })
    const con = crear({ fetchFn, ahora: reloj })
    await con.obtenerMonitorHoy()
    reloj.avanzar(31_000)
    const r = await con.obtenerMonitorHoy()
    assert.equal(r.ok, true)
    assert.equal(r.stale, true)
    assert.ok(r.staleDesde)
  } finally {
    espia.restaurar()
  }
})

test('11. 200 sin arreglos drivers/bikers → fallo y NO se cachea', async () => {
  const espia = espiarWarn()
  try {
    const malo = { fecha: '2026-10-28', drivers: 'no-es-arreglo', bikers: [] }
    const fetchFn = fetchFalso((n) => (n === 1 ? ok(malo) : ok()))
    const { obtenerMonitorHoy } = crear({ fetchFn })

    assert.deepEqual(await obtenerMonitorHoy(), { ok: false, error: 'TURBO_NO_DISPONIBLE' })
    // la siguiente vuelve a ir a Turbo (no quedó nada cacheado)
    const r = await obtenerMonitorHoy()
    assert.equal(fetchFn.llamadas.length, 2)
    assert.equal(r.ok, true)
    assert.equal(r.stale, false)
  } finally {
    espia.restaurar()
  }
})

test('12. avisos de Turbo llegan en data.avisos, también desde la caché', async () => {
  const conAvisos = { ...DATA, avisos: ['Fuente secundaria no disponible'] }
  const fetchFn = fetchFalso(() => ok(conAvisos))
  const { obtenerMonitorHoy } = crear({ fetchFn })

  const primera = await obtenerMonitorHoy()
  assert.deepEqual(primera.data.avisos, ['Fuente secundaria no disponible'])

  const desdeCache = await obtenerMonitorHoy()
  assert.equal(fetchFn.llamadas.length, 1)
  assert.deepEqual(desdeCache.data.avisos, ['Fuente secundaria no disponible'])
})

test('13. el secreto no aparece en el resultado ni en console.warn', async () => {
  const espia = espiarWarn()
  try {
    const reloj = relojFalso()
    const fetchFn = fetchFalso((n) => {
      if (n === 1) return ok()
      if (n === 2) return conStatus(401)
      // un error cuyo mensaje (mal hecho) incluye el secreto: el log debe taparlo
      throw new Error(`fallo con header ${SECRETO}`)
    })
    const { obtenerMonitorHoy } = crear({ fetchFn, ahora: reloj })

    const resultados = [await obtenerMonitorHoy()]
    reloj.avanzar(31_000)
    resultados.push(await obtenerMonitorHoy()) // 401 con caché
    reloj.avanzar(31_000)
    resultados.push(await obtenerMonitorHoy()) // error de red con caché

    for (const r of resultados) assert.ok(!JSON.stringify(r).includes(SECRETO))
    assert.ok(espia.mensajes.length >= 2, 'debe haber logueado los fallos')
    for (const m of espia.mensajes) assert.ok(!m.includes(SECRETO))

    // y sin secreto configurado tampoco se filtra nada
    const sinSecreto = crearTurboMonitor({ fetchFn, env: {} })
    assert.ok(!JSON.stringify(await sinSecreto.obtenerMonitorHoy()).includes(SECRETO))
  } finally {
    espia.restaurar()
  }
})
