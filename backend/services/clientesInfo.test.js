import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clienteId,
  buildClienteItem,
  validarCliente,
  mapearFilasSheet,
  mapearColumnasSheet,
  getClientesInfoTableName,
} from './clientesInfo.js'

test('clienteId: determinista, 32 hex, insensible a mayúsculas/acentos', () => {
  const a = clienteId('Caja Bancaria')
  assert.match(a, /^[0-9a-f]{32}$/)
  assert.equal(a, clienteId('caja  BANCARIA'))
  assert.equal(a, clienteId('Cája Bancaria', 1))
  assert.notEqual(a, clienteId('Releva'))
})

test('clienteId: la repetición n-ésima usa #n y la 1ª no lleva sufijo', () => {
  const primero = clienteId('Releva')
  const segundo = clienteId('Releva', 2)
  const tercero = clienteId('Releva', 3)
  assert.equal(primero, clienteId('Releva', 1))
  assert.notEqual(primero, segundo)
  assert.notEqual(segundo, tercero)
  assert.equal(segundo, clienteId('RELEVA', 2))
})

test('validarCliente: nombre obligatorio', () => {
  assert.equal(validarCliente({}).ok, false)
  assert.equal(validarCliente({ nombreCliente: '   ' }).ok, false)
  assert.equal(validarCliente({ nombreCliente: '!!!' }).ok, false) // sin letras ni números
  assert.equal(validarCliente(null).ok, false)
  assert.equal(validarCliente({ nombreCliente: 'Releva' }).ok, true)
})

test('validarCliente: trim y colapso de espacios', () => {
  const { ok, datos } = validarCliente({
    nombreCliente: '  Caja    Bancaria  ',
    cuenta: ' 123   456 ',
    etiqueta: ' 🟢 ',
    envios: undefined,
    tipoPago: null,
  })
  assert.equal(ok, true)
  assert.equal(datos.nombreCliente, 'Caja Bancaria')
  assert.equal(datos.cuenta, '123 456')
  assert.equal(datos.etiqueta, '🟢')
  assert.equal(datos.envios, '')
  assert.equal(datos.tipoPago, '')
})

test('validarCliente: procedimientos conserva los saltos de línea', () => {
  const { datos } = validarCliente({
    nombreCliente: 'X',
    procedimientos: '  Paso 1   uno \r\n\r\n\r\n\r\nPaso 2  ',
  })
  assert.equal(datos.procedimientos, 'Paso 1 uno\n\nPaso 2')
})

test('validarCliente: largos máximos (nombre 120, procedimientos 2000, resto 200)', () => {
  assert.equal(validarCliente({ nombreCliente: 'a'.repeat(120) }).ok, true)
  assert.equal(validarCliente({ nombreCliente: 'a'.repeat(121) }).ok, false)
  assert.equal(validarCliente({ nombreCliente: 'X', procedimientos: 'a'.repeat(2000) }).ok, true)
  assert.equal(validarCliente({ nombreCliente: 'X', procedimientos: 'a'.repeat(2001) }).ok, false)
  for (const campo of ['cuenta', 'etiqueta', 'envios', 'tipoPago']) {
    assert.equal(validarCliente({ nombreCliente: 'X', [campo]: 'a'.repeat(200) }).ok, true, campo)
    assert.equal(validarCliente({ nombreCliente: 'X', [campo]: 'a'.repeat(201) }).ok, false, campo)
  }
})

test('validarCliente: rechaza valores que no son texto', () => {
  assert.equal(validarCliente({ nombreCliente: 'X', cuenta: 123 }).ok, false)
  assert.equal(validarCliente({ nombreCliente: ['X'] }).ok, false)
})

test('buildClienteItem: forma completa del ítem', () => {
  const ahora = '2026-10-12T20:00:00.000Z'
  const item = buildClienteItem(
    { nombreCliente: ' Caja  Bancaria ', cuenta: '1', procedimientos: 'p', etiqueta: '🟢', envios: '2', tipoPago: 'QR' },
    { usuario: 'carli', ahora, origen: 'app' }
  )
  assert.deepEqual(item, {
    id: clienteId('Caja Bancaria'),
    nombreCliente: 'Caja Bancaria',
    nombreClave: 'caja bancaria',
    cuenta: '1',
    procedimientos: 'p',
    etiqueta: '🟢',
    envios: '2',
    tipoPago: 'QR',
    creadoEn: ahora,
    creadoPor: 'carli',
    actualizadoEn: ahora,
    actualizadoPor: 'carli',
    version: 1,
    origen: 'app',
  })
})

test('buildClienteItem: respeta el id recibido y el origen del backfill', () => {
  const item = buildClienteItem({ nombreCliente: 'Releva' }, { id: 'abc', usuario: 'u', origen: 'sheet-backfill' })
  assert.equal(item.id, 'abc')
  assert.equal(item.origen, 'sheet-backfill')
  assert.equal(item.version, 1)
})

test('mapearColumnasSheet: encabezados con espacios y otro orden', () => {
  const cols = mapearColumnasSheet(['TIPO DE PAGO', 'NOMBRES DE CLIENTES ', 'envios ', 'CUENTA ', 'PROCEDIMIENTOS ', 'ETIQUETA'])
  assert.deepEqual(cols, { tipoPago: 0, nombreCliente: 1, envios: 2, cuenta: 3, procedimientos: 4, etiqueta: 5 })
})

const HEADER = ['NOMBRES DE CLIENTES ', 'CUENTA ', 'PROCEDIMIENTOS ', 'ETIQUETA', 'envios ', 'TIPO DE PAGO']

test('mapearFilasSheet: duplicados no se fusionan (id con #n) y filas vacías se ignoran', () => {
  const rows = [
    HEADER,
    ['Releva', 'c1', 'p1', '🟢', '10', 'efectivo'], // fila 2
    [], // fila 3 vacía
    ['Caja Bancaria', '', '', '', '', ''], // fila 4
    ['  releva  ', 'c2', 'p2', '🔴', '5', 'QR'], // fila 5: duplicado de Releva
    ['', '', '', '', '', ''], // fila 6 vacía
    ['RELEVA', 'c3'], // fila 7: 3ª repetición, fila corta
  ]
  const { items, vacias, invalidas, duplicados } = mapearFilasSheet(rows)

  assert.equal(items.length, 4)
  assert.deepEqual(vacias, [3, 6])
  assert.deepEqual(invalidas, [])
  assert.deepEqual(duplicados, [{ nombreClave: 'releva', filas: [2, 5, 7] }])

  const releva = items.filter((i) => i.campos.nombreCliente.toLowerCase() === 'releva')
  assert.deepEqual(releva.map((i) => i.fila), [2, 5, 7])
  assert.equal(releva[0].id, clienteId('Releva', 1))
  assert.equal(releva[1].id, clienteId('Releva', 2))
  assert.equal(releva[2].id, clienteId('Releva', 3))
  assert.equal(new Set(items.map((i) => i.id)).size, 4) // todos los ids son distintos

  // mapeo de campos (con trim) y fila corta
  assert.deepEqual(releva[0].campos, {
    nombreCliente: 'Releva', cuenta: 'c1', procedimientos: 'p1', etiqueta: '🟢', envios: '10', tipoPago: 'efectivo',
  })
  assert.equal(releva[1].campos.nombreCliente, 'releva')
  assert.equal(releva[2].campos.tipoPago, '')
})

test('mapearFilasSheet: fila con datos pero sin nombre es inválida', () => {
  const { items, invalidas, vacias } = mapearFilasSheet([HEADER, ['', 'c1', 'p', '', '', ''], ['Releva']])
  assert.equal(items.length, 1)
  assert.equal(vacias.length, 0)
  assert.equal(invalidas.length, 1)
  assert.equal(invalidas[0].fila, 2)
})

test('mapearFilasSheet: falla si no está la columna de nombres', () => {
  assert.throws(() => mapearFilasSheet([['CUENTA', 'ETIQUETA'], ['x', 'y']]), /NOMBRES DE CLIENTES/)
  assert.throws(() => mapearFilasSheet([]))
})

test('getClientesInfoTableName: kill-switch por env var', () => {
  const previo = process.env.CLIENTES_INFO_DYNAMO_TABLE
  try {
    delete process.env.CLIENTES_INFO_DYNAMO_TABLE
    assert.equal(getClientesInfoTableName(), '')
    process.env.CLIENTES_INFO_DYNAMO_TABLE = '  beezy-clientes-info-dev  '
    assert.equal(getClientesInfoTableName(), 'beezy-clientes-info-dev')
  } finally {
    if (previo === undefined) delete process.env.CLIENTES_INFO_DYNAMO_TABLE
    else process.env.CLIENTES_INFO_DYNAMO_TABLE = previo
  }
})
