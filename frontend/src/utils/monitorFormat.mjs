// Funciones puras para la página /monitor. Sin React, sin DOM, sin imports:
// por eso es .mjs, para poder probarlas con `node --test` sin instalar nada.

const MIN_POR_DIA = 1440
const OFFSET_BOLIVIA_MIN = 4 * 60 // Bolivia es UTC-4 y no tiene horario de verano

function aMinutos(hhmm) {
  const [h, m] = String(hhmm ?? '').split(':')
  const total = Number(h) * 60 + Number(m)
  return Number.isFinite(total) ? total : NaN
}

function dosDigitos(n) {
  return String(n).padStart(2, '0')
}

function cruzaMedianoche(franja) {
  return franja.hasta <= franja.desde
}

/**
 * Ordena por `desde` y fusiona franjas consecutivas (anterior.hasta === siguiente.desde),
 * salvo que alguna cruce medianoche. No muta la entrada.
 * @param {Array<{desde:string, hasta:string, placa?:string}>} bloques
 * @returns {Array<{desde:string, hasta:string, placas:string[]}>}
 */
export function fusionarFranjas(bloques) {
  const ordenados = [...(bloques || [])]
    .filter((b) => b && b.desde && b.hasta)
    .sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0))

  const resultado = []
  for (const b of ordenados) {
    const actual = { desde: b.desde, hasta: b.hasta, placas: b.placa ? [b.placa] : [] }
    const ultimo = resultado[resultado.length - 1]
    if (
      ultimo
      && ultimo.hasta === actual.desde
      && !cruzaMedianoche(ultimo)
      && !cruzaMedianoche(actual)
    ) {
      ultimo.hasta = actual.hasta
      for (const p of actual.placas) {
        if (!ultimo.placas.includes(p)) ultimo.placas.push(p)
      }
    } else {
      resultado.push(actual)
    }
  }
  return resultado
}

/** '06:00-14:00, 16:00-22:00'. Cadena vacía si no hay bloques. */
export function textoHorario(bloques) {
  return fusionarFranjas(bloques)
    .map((f) => `${f.desde}-${f.hasta}`)
    .join(', ')
}

/** Quita un sufijo final ' Bee Zero' (sin importar mayúsculas). */
export function nombreVisible(nombre) {
  return String(nombre ?? '').trim().replace(/\s+bee zero$/i, '').trim()
}

/**
 * Grupo en el que se muestra la persona. Un 'sin-iniciar' que no se pudo
 * vincular a una cuenta es 'sin-vincular' (puede estar trabajando con otra cuenta).
 */
export function grupoDe(persona) {
  if (
    persona?.estado === 'sin-iniciar'
    && (persona?.vinculo === 'sin-candidato' || persona?.vinculo === 'ambiguo')
  ) {
    return 'sin-vincular'
  }
  return persona?.estado
}

/** Ordena por hora del primer bloque fusionado (sin bloques al final) y luego por nombre. No muta. */
export function ordenarGrupo(lista) {
  const clave = (p) => {
    const primero = fusionarFranjas(p?.bloques)[0]
    const min = primero ? aMinutos(primero.desde) : NaN
    return Number.isFinite(min) ? min : Infinity
  }
  return [...(lista || [])].sort((a, b) => {
    const ka = clave(a)
    const kb = clave(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return nombreVisible(a?.nombre).localeCompare(nombreVisible(b?.nombre), 'es')
  })
}

/** Totales sumando ambas listas. 'sin-vincular' y 'fuera-de-horario' no suman a sinIniciar. */
export function contadores(drivers, bikers) {
  const total = { trabajando: 0, sinIniciar: 0, porLlegar: 0, terminaron: 0 }
  for (const p of [...(drivers || []), ...(bikers || [])]) {
    switch (grupoDe(p)) {
      case 'trabajando': total.trabajando += 1; break
      case 'sin-iniciar': total.sinIniciar += 1; break
      case 'por-llegar': total.porLlegar += 1; break
      case 'termino': total.terminaron += 1; break
      default: break
    }
  }
  return total
}

/**
 * '3h 12m', '45m', '0m'. horaInicio es 'HH:MM'; ahoraMin son minutos desde las 00:00
 * (hora de Bolivia). Si ahoraMin < inicio se asume que cruzó medianoche.
 */
export function tiempoTranscurrido(horaInicio, ahoraMin) {
  const inicio = aMinutos(horaInicio)
  if (!Number.isFinite(inicio) || !Number.isFinite(ahoraMin)) return ''
  let diff = ahoraMin - inicio
  if (diff < 0) diff += MIN_POR_DIA
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function minutosBoliviaDeDate(date) {
  const utc = date.getUTCHours() * 60 + date.getUTCMinutes()
  return (((utc - OFFSET_BOLIVIA_MIN) % MIN_POR_DIA) + MIN_POR_DIA) % MIN_POR_DIA
}

/** Minutos desde medianoche en UTC-4. Calcula con UTC, sin zonas horarias del navegador. */
export function ahoraBoliviaMin(date = new Date()) {
  return minutosBoliviaDeDate(date)
}

/** 'HH:MM' en UTC-4 a partir de un ISO UTC. Cadena vacía si el ISO no es válido. */
export function horaBolivia(isoUtc) {
  const date = new Date(isoUtc)
  if (Number.isNaN(date.getTime())) return ''
  const min = minutosBoliviaDeDate(date)
  return `${dosDigitos(Math.floor(min / 60))}:${dosDigitos(min % 60)}`
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** '2026-10-28' → 'miércoles 28 de octubre'. Fijo en español, sin depender del navegador. */
export function fechaLarga(fechaIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaIso ?? ''))
  if (!m) return ''
  const [, a, mes, d] = m
  const dia = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)))
  if (Number.isNaN(dia.getTime())) return ''
  return `${DIAS[dia.getUTCDay()]} ${Number(d)} de ${MESES[Number(mes) - 1]}`
}
