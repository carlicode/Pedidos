/**
 * Servicio para la info de clientes (DynamoDB) - endpoints /api/clientes-info.
 * Estos endpoints exigen JWT: se manda el token guardado en localStorage ('authToken').
 *
 * Los errores llevan `code` tipado para que la UI muestre el mensaje correcto:
 *  - 401 -> 'SESION_EXPIRADA'
 *  - 409 -> 'CONFLICTO' (otro operador editó, o nombre repetido)
 *  - 503 -> 'NO_CONFIGURADO' (la tabla todavía no está activada)
 *  - 400 -> 'VALIDACION' | otros -> 'ERROR'
 */

import { getApiUrl } from '../utils/api.js'

const BASE = '/api/clientes-info'

/** Error de la API con código tipado */
export class ClientesInfoApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'ClientesInfoApiError'
    this.code = code
    this.status = status
  }
}

const CODIGOS_POR_STATUS = {
  400: 'VALIDACION',
  401: 'SESION_EXPIRADA',
  409: 'CONFLICTO',
  503: 'NO_CONFIGURADO',
}

/** Hace el request autenticado y devuelve `data`, o lanza ClientesInfoApiError */
async function request(path = '', options = {}) {
  const token = localStorage.getItem('authToken')
  let response
  try {
    response = await fetch(getApiUrl(`${BASE}${path}`), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
  } catch (err) {
    throw new ClientesInfoApiError('ERROR', 'No se pudo conectar con el servidor', 0)
  }

  let body = null
  try {
    body = await response.json()
  } catch (err) {
    // respuesta sin JSON: se maneja abajo por status
  }

  if (!response.ok) {
    const code = CODIGOS_POR_STATUS[response.status] || 'ERROR'
    const mensaje = body?.error || `Error ${response.status} al procesar la info de clientes`
    throw new ClientesInfoApiError(code, mensaje, response.status)
  }

  return body?.data
}

/** Lista todos los clientes (ordenados por nombre desde el backend) */
export const listClientesInfo = async () => {
  const data = await request('')
  return Array.isArray(data) ? data : []
}

/**
 * Crea un cliente
 * @param {Object} campos - { nombreCliente, cuenta, procedimientos, etiqueta, envios, tipoPago }
 */
export const crearClienteInfo = (campos) =>
  request('', { method: 'POST', body: JSON.stringify(campos) })

/**
 * Edita un cliente con control optimista
 * @param {string} id
 * @param {Object} campos - mismos campos que el alta
 * @param {number} version - versión que el operador vio al abrir la edición
 */
export const actualizarClienteInfo = (id, campos, version) =>
  request(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...campos, version }),
  })
