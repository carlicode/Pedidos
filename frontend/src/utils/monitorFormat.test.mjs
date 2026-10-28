import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fusionarFranjas,
  textoHorario,
  nombreVisible,
  grupoDe,
  ordenarGrupo,
  contadores,
  tiempoTranscurrido,
  ahoraBoliviaMin,
  horaBolivia,
  fechaLarga,
} from './monitorFormat.mjs'

// ---------- fusionarFranjas ----------

test('fusionarFranjas: contiguas se fusionan', () => {
  assert.deepEqual(
    fusionarFranjas([{ desde: '06:00', hasta: '10:00' }, { desde: '10:00', hasta: '14:00' }]),
    [{ desde: '06:00', hasta: '14:00', placas: [] }],
  )
})

test('fusionarFranjas: con hueco NO se fusionan', () => {
  assert.deepEqual(
    fusionarFranjas([{ desde: '06:00', hasta: '14:00' }, { desde: '16:00', hasta: '22:00' }]),
    [
      { desde: '06:00', hasta: '14:00', placas: [] },
      { desde: '16:00', hasta: '22:00', placas: [] },
    ],
  )
})

test('fusionarFranjas: desordenadas se ordenan', () => {
  assert.deepEqual(
    fusionarFranjas([{ desde: '16:00', hasta: '22:00' }, { desde: '06:00', hasta: '14:00' }]).map((f) => f.desde),
    ['06:00', '16:00'],
  )
})

test('fusionarFranjas: caso real partido en tres → una sola 06:00-16:00', () => {
  const bloques = [
    { desde: '07:30', hasta: '16:00' },
    { desde: '06:00', hasta: '07:00' },
    { desde: '07:00', hasta: '07:30' },
  ]
  assert.deepEqual(fusionarFranjas(bloques), [{ desde: '06:00', hasta: '16:00', placas: [] }])
})

test('fusionarFranjas: una franja que cruza medianoche no se fusiona con nada', () => {
  // 22:00-02:00 cruza medianoche; la siguiente empieza justo a las 02:00 y NO se une.
  assert.deepEqual(
    fusionarFranjas([{ desde: '22:00', hasta: '02:00' }, { desde: '02:00', hasta: '06:00' }]),
    [
      { desde: '02:00', hasta: '06:00', placas: [] },
      { desde: '22:00', hasta: '02:00', placas: [] },
    ],
  )
  // La que cruza tampoco absorbe a la anterior que termina a las 22:00.
  assert.deepEqual(
    fusionarFranjas([{ desde: '18:00', hasta: '22:00' }, { desde: '22:00', hasta: '02:00' }]),
    [
      { desde: '18:00', hasta: '22:00', placas: [] },
      { desde: '22:00', hasta: '02:00', placas: [] },
    ],
  )
})

test('fusionarFranjas: no muta la entrada', () => {
  const entrada = [
    { desde: '10:00', hasta: '14:00', placa: 'A' },
    { desde: '06:00', hasta: '10:00' },
  ]
  const copia = JSON.parse(JSON.stringify(entrada))
  fusionarFranjas(entrada)
  assert.deepEqual(entrada, copia)
})

test('fusionarFranjas: placas únicas y sin vacías', () => {
  const r = fusionarFranjas([
    { desde: '06:00', hasta: '10:00', placa: '6265 LUH' },
    { desde: '10:00', hasta: '12:00', placa: '6265 LUH' },
    { desde: '12:00', hasta: '14:00', placa: '' },
    { desde: '14:00', hasta: '16:00', placa: '1234 ABC' },
  ])
  assert.deepEqual(r, [{ desde: '06:00', hasta: '16:00', placas: ['6265 LUH', '1234 ABC'] }])
})

// ---------- textoHorario ----------

test('textoHorario: dos franjas separadas', () => {
  assert.equal(
    textoHorario([{ desde: '16:00', hasta: '22:00' }, { desde: '06:00', hasta: '14:00' }]),
    '06:00-14:00, 16:00-22:00',
  )
})

test('textoHorario: lista vacía → cadena vacía', () => {
  assert.equal(textoHorario([]), '')
  assert.equal(textoHorario(undefined), '')
})

// ---------- nombreVisible ----------

test('nombreVisible: quita el sufijo " Bee Zero" (cualquier mayúscula)', () => {
  assert.equal(nombreVisible('Fabricio Rodriguez Bee Zero'), 'Fabricio Rodriguez')
  assert.equal(nombreVisible('Fabricio Rodriguez bee zero'), 'Fabricio Rodriguez')
  assert.equal(nombreVisible('  Ana Pérez Bee Zero  '), 'Ana Pérez')
})

test('nombreVisible: no toca nombres sin el sufijo', () => {
  assert.equal(nombreVisible('William Montaño'), 'William Montaño')
})

test('nombreVisible: no rompe un nombre que contiene "Zero" en medio', () => {
  assert.equal(nombreVisible('Zero Pérez López'), 'Zero Pérez López')
  assert.equal(nombreVisible('Juan Zero Gómez'), 'Juan Zero Gómez')
})

// ---------- grupoDe ----------

test('grupoDe: sin-iniciar + sin-candidato → sin-vincular', () => {
  assert.equal(grupoDe({ estado: 'sin-iniciar', vinculo: 'sin-candidato' }), 'sin-vincular')
})

test('grupoDe: sin-iniciar + ambiguo → sin-vincular', () => {
  assert.equal(grupoDe({ estado: 'sin-iniciar', vinculo: 'ambiguo' }), 'sin-vincular')
})

test('grupoDe: sin-iniciar + manual → sin-iniciar', () => {
  assert.equal(grupoDe({ estado: 'sin-iniciar', vinculo: 'manual' }), 'sin-iniciar')
})

test('grupoDe: trabajando + sin-candidato → trabajando', () => {
  assert.equal(grupoDe({ estado: 'trabajando', vinculo: 'sin-candidato' }), 'trabajando')
})

// ---------- ordenarGrupo ----------

test('ordenarGrupo: por hora del primer bloque, luego nombre; sin bloques al final; no muta', () => {
  const lista = [
    { nombre: 'Zoe', bloques: [] },
    { nombre: 'Carla Bee Zero', bloques: [{ desde: '08:00', hasta: '12:00' }] },
    { nombre: 'Beto', bloques: [{ desde: '08:00', hasta: '12:00' }] },
    { nombre: 'Ana', bloques: [{ desde: '07:00', hasta: '07:30' }, { desde: '06:00', hasta: '07:00' }] },
  ]
  const copia = JSON.parse(JSON.stringify(lista))
  assert.deepEqual(ordenarGrupo(lista).map((p) => p.nombre), ['Ana', 'Beto', 'Carla Bee Zero', 'Zoe'])
  assert.deepEqual(lista, copia)
})

// ---------- contadores ----------

test('contadores: los sin-vincular no suman a sinIniciar; suma drivers + bikers', () => {
  const drivers = [
    { estado: 'trabajando', vinculo: 'manual' },
    { estado: 'sin-iniciar', vinculo: 'manual' },
    { estado: 'sin-iniciar', vinculo: 'sin-candidato' }, // sin-vincular
    { estado: 'fuera-de-horario', vinculo: 'auto' },
  ]
  const bikers = [
    { estado: 'trabajando', vinculo: 'auto' },
    { estado: 'sin-iniciar', vinculo: 'ambiguo' }, // sin-vincular
    { estado: 'por-llegar', vinculo: 'manual' },
    { estado: 'termino', vinculo: 'manual' },
    { estado: 'termino', vinculo: 'auto' },
  ]
  assert.deepEqual(contadores(drivers, bikers), {
    trabajando: 2,
    sinIniciar: 1,
    porLlegar: 1,
    terminaron: 2,
  })
})

// ---------- tiempoTranscurrido ----------

test('tiempoTranscurrido: 05:49 con ahoraMin 12:36 → 6h 47m', () => {
  assert.equal(tiempoTranscurrido('05:49', 12 * 60 + 36), '6h 47m')
})

test('tiempoTranscurrido: menos de una hora y cero', () => {
  assert.equal(tiempoTranscurrido('12:00', 12 * 60 + 45), '45m')
  assert.equal(tiempoTranscurrido('12:00', 12 * 60), '0m')
})

test('tiempoTranscurrido: cruce de medianoche (23:30 → 00:10) → 40m', () => {
  assert.equal(tiempoTranscurrido('23:30', 10), '40m')
})

// ---------- hora Bolivia ----------

test('ahoraBoliviaMin: 2026-10-28T16:36:00Z → 12:36 en minutos', () => {
  assert.equal(ahoraBoliviaMin(new Date('2026-10-28T16:36:00Z')), 12 * 60 + 36)
})

test('ahoraBoliviaMin: cruza la medianoche hacia atrás (02:00Z → 22:00 del día anterior)', () => {
  assert.equal(ahoraBoliviaMin(new Date('2026-10-28T02:00:00Z')), 22 * 60)
})

test('horaBolivia: ISO UTC → HH:MM en UTC-4', () => {
  assert.equal(horaBolivia('2026-10-28T16:36:54.486Z'), '12:36')
  assert.equal(horaBolivia('2026-10-28T04:05:00Z'), '00:05')
  assert.equal(horaBolivia('no-es-fecha'), '')
})

// ---------- fechaLarga ----------

test('fechaLarga: 2026-10-28 → miércoles 28 de octubre', () => {
  assert.equal(fechaLarga('2026-10-28'), 'miércoles 28 de octubre')
  assert.equal(fechaLarga('2026-01-01'), 'jueves 1 de enero')
  assert.equal(fechaLarga('basura'), '')
})
