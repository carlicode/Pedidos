/**
 * Info de clientes en DynamoDB (tabla beezy-clientes-info).
 *
 * La DB es la FUENTE DE VERDAD de la "Información del Cliente" (Cuenta, Procedimientos,
 * Etiqueta, Envíos, Tipo de pago). El Google Sheet original queda congelado tras el backfill.
 *
 * Kill-switch: si CLIENTES_INFO_DYNAMO_TABLE no está definida, el endpoint público
 * /api/client-info sigue leyendo el Sheet y los endpoints /api/clientes-info responden 503.
 *
 * Las funciones puras (validación, ids, mapeo del Sheet) NO tocan Dynamo y se testean sin red.
 */

import crypto from 'node:crypto'
import { PutCommand, ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../utils/dynamodb.js'
import { normalizarNombre, matchLevel } from '../utils/clientMatch.js'

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

/** Nombre de la tabla ('' = desactivado) */
export function getClientesInfoTableName() {
  return (process.env.CLIENTES_INFO_DYNAMO_TABLE || '').trim()
}

/** Campos editables del cliente y su largo máximo */
export const CAMPOS_CLIENTE = ['nombreCliente', 'cuenta', 'procedimientos', 'etiqueta', 'envios', 'tipoPago']
export const LARGOS_MAXIMOS = {
  nombreCliente: 120,
  cuenta: 200,
  procedimientos: 2000,
  etiqueta: 200,
  envios: 200,
  tipoPago: 200,
}

const ETIQUETAS_CAMPOS = {
  nombreCliente: 'El nombre del cliente',
  cuenta: 'La cuenta',
  procedimientos: 'Los procedimientos',
  etiqueta: 'La etiqueta',
  envios: 'Los envíos',
  tipoPago: 'El tipo de pago',
}

/** Error con status HTTP, para que las rutas respondan sin adivinar */
export class ClienteInfoError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ClienteInfoError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

/**
 * Limpia un texto: trim y colapso de espacios.
 * En `procedimientos` se conservan los saltos de línea (el Sheet y el textarea los usan):
 * solo se colapsan espacios/tabs repetidos y se limitan las líneas vacías consecutivas.
 */
function limpiarTexto(valor, conservarSaltos = false) {
  const texto = String(valor ?? '')
  if (!conservarSaltos) return texto.replace(/\s+/g, ' ').trim()
  return texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * id = sha256(nombreClave [+ '#' + n si es la n-ésima repetición]).slice(0, 32)
 * La 1ª ocurrencia NO lleva sufijo. El id no cambia nunca, aunque se renombre el cliente.
 */
export function clienteId(nombre, ocurrencia = 1) {
  const clave = normalizarNombre(nombre)
  const base = ocurrencia > 1 ? `${clave}#${ocurrencia}` : clave
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32)
}

/**
 * Valida y limpia los campos de un cliente.
 * @returns {{ ok: boolean, errores: string[], datos: Object }} `datos` ya viene limpio (trim/espacios colapsados)
 */
export function validarCliente(campos) {
  const entrada = campos && typeof campos === 'object' ? campos : {}
  const errores = []
  const datos = {}

  for (const campo of CAMPOS_CLIENTE) {
    const valor = entrada[campo]
    if (valor !== undefined && valor !== null && typeof valor !== 'string') {
      errores.push(`${ETIQUETAS_CAMPOS[campo]} debe ser texto`)
      datos[campo] = ''
      continue
    }
    datos[campo] = limpiarTexto(valor, campo === 'procedimientos')
    if (datos[campo].length > LARGOS_MAXIMOS[campo]) {
      errores.push(`${ETIQUETAS_CAMPOS[campo]} supera el máximo de ${LARGOS_MAXIMOS[campo]} caracteres`)
    }
  }

  if (!datos.nombreCliente) errores.push('El nombre del cliente es obligatorio')
  else if (!normalizarNombre(datos.nombreCliente)) errores.push('El nombre del cliente debe tener letras o números')

  return { ok: errores.length === 0, errores, datos }
}

/**
 * Construye el ítem de DynamoDB (alta). `campos` se limpia igual que en validarCliente.
 * @param {Object} campos
 * @param {{ id?: string, usuario: string, ahora?: string, origen?: 'sheet-backfill'|'app' }} opciones
 */
export function buildClienteItem(campos, { id, usuario, ahora, origen = 'app' } = {}) {
  const { datos } = validarCliente(campos)
  const ts = ahora || new Date().toISOString()
  return {
    id: id || clienteId(datos.nombreCliente),
    nombreCliente: datos.nombreCliente,
    nombreClave: normalizarNombre(datos.nombreCliente),
    cuenta: datos.cuenta,
    procedimientos: datos.procedimientos,
    etiqueta: datos.etiqueta,
    envios: datos.envios,
    tipoPago: datos.tipoPago,
    creadoEn: ts,
    creadoPor: usuario,
    actualizadoEn: ts,
    actualizadoPor: usuario,
    version: 1,
    origen,
  }
}

// Encabezado normalizado del Sheet -> campo (mismo mapeo que routes/clientInfo.js)
const COLUMNAS_SHEET = {
  'nombres de clientes': 'nombreCliente',
  'cuenta': 'cuenta',
  'procedimientos': 'procedimientos',
  'etiqueta': 'etiqueta',
  'envios': 'envios',
  'tipo de pago': 'tipoPago',
}

/** Mapea la fila de encabezados a índices de columna, así el orden puede cambiar sin romper nada */
export function mapearColumnasSheet(headerRow) {
  const indices = {}
  ;(headerRow || []).forEach((header, i) => {
    const campo = COLUMNAS_SHEET[normalizarNombre(header)]
    if (campo && indices[campo] === undefined) indices[campo] = i
  })
  return indices
}

/**
 * Convierte las filas crudas del Sheet (la primera es el encabezado) en ítems a insertar.
 * Los duplicados NO se fusionan: cada fila es un ítem y las repeticiones usan id con '#n'.
 *
 * @returns {{ items: Array<{fila:number, id:string, campos:Object}>, vacias: number[],
 *             invalidas: Array<{fila:number, errores:string[]}>,
 *             duplicados: Array<{nombreClave:string, filas:number[]}> }}
 */
export function mapearFilasSheet(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('El Sheet no tiene filas')
  }
  const cols = mapearColumnasSheet(rows[0])
  if (cols.nombreCliente === undefined) {
    throw new Error('No se encontró la columna "NOMBRES DE CLIENTES" en el Sheet')
  }

  const celda = (row, campo) => (cols[campo] === undefined ? '' : String((row || [])[cols[campo]] ?? ''))

  const items = []
  const vacias = []
  const invalidas = []
  const ocurrencias = new Map() // nombreClave -> cantidad de filas vistas
  const filasPorClave = new Map()

  for (let i = 1; i < rows.length; i++) {
    const fila = i + 1 // número de fila real en el Sheet
    const crudo = {}
    for (const campo of CAMPOS_CLIENTE) crudo[campo] = celda(rows[i], campo)

    if (CAMPOS_CLIENTE.every((c) => !limpiarTexto(crudo[c]))) {
      vacias.push(fila)
      continue
    }

    const { ok, errores, datos } = validarCliente(crudo)
    if (!ok) {
      invalidas.push({ fila, errores })
      continue
    }

    const clave = normalizarNombre(datos.nombreCliente)
    const n = (ocurrencias.get(clave) || 0) + 1
    ocurrencias.set(clave, n)
    filasPorClave.set(clave, [...(filasPorClave.get(clave) || []), fila])

    items.push({ fila, id: clienteId(datos.nombreCliente, n), campos: datos })
  }

  const duplicados = [...filasPorClave.entries()]
    .filter(([, filas]) => filas.length > 1)
    .map(([nombreClave, filas]) => ({ nombreClave, filas }))

  return { items, vacias, invalidas, duplicados }
}

// ---------------------------------------------------------------------------
// Dynamo
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60 * 1000
let cache = { items: null, expira: 0 }

/** Invalida la caché en memoria (se llama en cada escritura) */
export function invalidarCacheClientes() {
  cache = { items: null, expira: 0 }
}

function exigirTabla() {
  const tabla = getClientesInfoTableName()
  if (!tabla) throw new ClienteInfoError(503, 'CLIENTES_INFO_DYNAMO_TABLE no configurada')
  return tabla
}

/**
 * Lista todos los clientes (Scan paginado + caché de 60 s).
 * @param {{ forzar?: boolean }} opciones - forzar=true ignora la caché (usado antes de validar duplicados)
 */
export async function listClientes({ forzar = false } = {}) {
  const tabla = exigirTabla()
  if (!forzar && cache.items && Date.now() < cache.expira) return cache.items

  const items = []
  let lastKey
  do {
    const res = await docClient.send(new ScanCommand({ TableName: tabla, ExclusiveStartKey: lastKey }))
    items.push(...(res.Items || []))
    lastKey = res.LastEvaluatedKey
  } while (lastKey)

  cache = { items, expira: Date.now() + CACHE_TTL_MS }
  return items
}

/**
 * Busca clientes por nombre con matchLevel y devuelve SOLO el mejor nivel encontrado
 * (igual que el Sheet), con la misma forma de respuesta + `id` y fuente 'dynamo'.
 */
export async function buscarClientePorNombre(nombre) {
  const clientes = await listClientes()
  const porNivel = { 3: [], 2: [], 1: [] }

  for (const c of clientes) {
    const nivel = matchLevel(c.nombreCliente, nombre)
    if (!nivel) continue
    porNivel[nivel].push({
      id: c.id,
      nombreCliente: c.nombreCliente || '',
      cuenta: c.cuenta || '',
      procedimientos: c.procedimientos || '',
      etiqueta: c.etiqueta || '',
      envios: c.envios || '',
      tipoPago: c.tipoPago || '',
      fuente: 'dynamo',
      aproximado: nivel < 3,
    })
  }

  const mejor = porNivel[3].length ? porNivel[3] : porNivel[2].length ? porNivel[2] : porNivel[1]
  return mejor.sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente, 'es'))
}

/**
 * Alta de un cliente nuevo desde la app. 400 si no valida, 409 si ya existe ese nombreClave.
 */
export async function crearCliente(campos, usuario) {
  const tabla = exigirTabla()
  const { ok, errores, datos } = validarCliente(campos)
  if (!ok) throw new ClienteInfoError(400, errores.join('. '))

  const clave = normalizarNombre(datos.nombreCliente)
  const existentes = await listClientes({ forzar: true })
  if (existentes.some((c) => c.nombreClave === clave)) {
    throw new ClienteInfoError(409, 'Ya existe un cliente con ese nombre')
  }

  const item = buildClienteItem(datos, { usuario, origen: 'app' })
  try {
    await docClient.send(new PutCommand({
      TableName: tabla,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)',
    }))
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new ClienteInfoError(409, 'Ya existe un cliente con ese nombre')
    }
    throw err
  } finally {
    invalidarCacheClientes()
  }
  return item
}

/**
 * Edición con control optimista (`version`). version + 1 en cada guardado.
 * 400 validación | 404 no existe | 409 versión cambiada o nombre repetido en otro cliente.
 */
export async function actualizarCliente(id, campos, versionEsperada, usuario) {
  const tabla = exigirTabla()
  const { ok, errores, datos } = validarCliente(campos)
  if (!ok) throw new ClienteInfoError(400, errores.join('. '))
  if (!Number.isInteger(versionEsperada) || versionEsperada < 1) {
    throw new ClienteInfoError(400, 'version es obligatoria y debe ser un entero positivo')
  }

  const clave = normalizarNombre(datos.nombreCliente)
  const existentes = await listClientes({ forzar: true })
  if (existentes.some((c) => c.id !== id && c.nombreClave === clave)) {
    throw new ClienteInfoError(409, 'Ya existe otro cliente con ese nombre')
  }

  try {
    const res = await docClient.send(new UpdateCommand({
      TableName: tabla,
      Key: { id },
      UpdateExpression:
        'SET #nombre = :nombre, #clave = :clave, #cuenta = :cuenta, #proc = :proc, #etiqueta = :etiqueta, ' +
        '#envios = :envios, #pago = :pago, #actEn = :actEn, #actPor = :actPor, #version = :nuevaVersion',
      ConditionExpression: 'attribute_exists(id) AND #version = :v',
      ExpressionAttributeNames: {
        '#nombre': 'nombreCliente',
        '#clave': 'nombreClave',
        '#cuenta': 'cuenta',
        '#proc': 'procedimientos',
        '#etiqueta': 'etiqueta',
        '#envios': 'envios',
        '#pago': 'tipoPago',
        '#actEn': 'actualizadoEn',
        '#actPor': 'actualizadoPor',
        '#version': 'version',
      },
      ExpressionAttributeValues: {
        ':nombre': datos.nombreCliente,
        ':clave': clave,
        ':cuenta': datos.cuenta,
        ':proc': datos.procedimientos,
        ':etiqueta': datos.etiqueta,
        ':envios': datos.envios,
        ':pago': datos.tipoPago,
        ':actEn': new Date().toISOString(),
        ':actPor': usuario,
        ':nuevaVersion': versionEsperada + 1,
        ':v': versionEsperada,
      },
      ReturnValues: 'ALL_NEW',
    }))
    return res.Attributes
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      // Distinguir "no existe" de "otro operador guardó antes"
      const actual = await docClient.send(new GetCommand({ TableName: tabla, Key: { id } }))
      if (!actual.Item) throw new ClienteInfoError(404, 'Cliente no encontrado')
      throw new ClienteInfoError(409, 'Otro operador modificó este cliente. Recargá la lista.')
    }
    throw err
  } finally {
    invalidarCacheClientes()
  }
}
