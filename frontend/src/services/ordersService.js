/**
 * Servicio para operaciones CRUD de pedidos
 * Maneja la interacción con Google Sheets para pedidos
 */

import { getBackendUrl, getApiUrl } from '../utils/api.js'
import { formatToStandardDate, prepareDateForSheet } from './dateService.js'
import { SHEET_COLUMNS } from '../constants/sheetColumns.js'
import { getBoliviaDateTimeForSheet } from '../utils/dateUtils.js'

/**
 * Normaliza un string eliminando acentos, caracteres especiales y convirtiendo a minúsculas
 * @param {string} s - String a normalizar
 * @returns {string} String normalizado
 */
const normalize = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]/g, '')

/**
 * Mapa de headers de Google Sheets a propiedades del objeto
 */
const headerMap = {
  fecharegistro: 'fecha', // Usar "Fecha Registro" como fecha principal del pedido
  fechas: 'fechas', // "Fechas" es un campo separado (fecha de entrega)
  horaregistro: 'hora_registro',
  operador: 'operador',
  cliente: 'cliente',
  recojo: 'recojo',
  entrega: 'entrega',
  direccionrecojo: 'direccion_recojo', direcciondelrecojo: 'direccion_recojo', direccionderecojo: 'direccion_recojo',
  informaciondireccionrecojo: 'info_direccion_recojo', infodireccionrecojo: 'info_direccion_recojo', infoadicionalrecojo: 'info_direccion_recojo',
  direccionentrega: 'direccion_entrega', direcciondeentrega: 'direccion_entrega',
  informaciondireccionentrega: 'info_direccion_entrega', infodireccionentrega: 'info_direccion_entrega', infoadicionalentrega: 'info_direccion_entrega',
  detallescarrera: 'detalles_carrera', detallesdelacarrera: 'detalles_carrera',
  distanciakm: 'distancia_km', distkm: 'distancia_km', distancia: 'distancia_km',
  mediotransporte: 'medio_transporte', transporte: 'medio_transporte',
  preciobs: 'precio_bs', precio: 'precio_bs',
  metodopago: 'metodo_pago', metododepago: 'metodo_pago', metodopagopago: 'metodo_pago',
  estadopago: 'estado_pago', estadodepago: 'estado_pago',
  bikers: 'biker', biker: 'biker',
  whatsapp: 'whatsapp',
  horaini: 'hora_ini', horainicio: 'hora_ini',
  horafin: 'hora_fin',
  duracion: 'duracion',
  tiempodeespera: 'tiempo_espera',
  estado: 'estado',
  observaciones: 'observaciones',
  pagobiker: 'pago_biker',
  diadelasem: 'dia_semana', diadelasemana: 'dia_semana',
  cobropago: 'cobro_pago', cobroopago: 'cobro_pago',
  montocobropago: 'monto_cobro_pago', montocobroopago: 'monto_cobro_pago',
  descripcioncobropago: 'descripcion_cobro_pago', descripciondecobroopago: 'descripcion_cobro_pago'
}

/**
 * Convierte fecha de Excel a formato DD/MM/YYYY
 * @param {string|number} excelDate - Fecha en formato Excel
 * @returns {string} Fecha en formato DD/MM/YYYY
 */
const convertExcelDate = (excelDate) => {
  if (!excelDate || excelDate === 'N/A') return ''
  
  // Limpiar comillas simples al inicio (Google Sheets a veces las agrega para forzar texto)
  let cleanDate = String(excelDate).trim()
  if (cleanDate.startsWith("'")) {
    cleanDate = cleanDate.substring(1)
  }
  
  // Si ya es una fecha en formato estándar, devolverla limpia
  if (cleanDate.includes('/') || cleanDate.includes('-')) {
    return cleanDate
  }
  
  // Convertir número de Excel a fecha
  const excelNum = parseFloat(cleanDate)
  if (isNaN(excelNum)) return cleanDate
  
  // Excel cuenta desde 1900-01-01, pero tiene un bug con 1900 siendo año bisiesto
  const excelEpoch = new Date(1900, 0, 1)
  const date = new Date(excelEpoch.getTime() + (excelNum - 1) * 24 * 60 * 60 * 1000)
  
  // Formato DD/MM/YYYY
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  
  return `${day}/${month}/${year}`
}

/**
 * Mapea una fila de Google Sheets a un objeto de pedido
 * @param {Object} rowObj - Objeto con los datos de la fila
 * @param {number} index - Índice de la fila
 * @param {Object} initialOrder - Objeto con valores por defecto
 * @param {string} operadorDefault - Operador por defecto
 * @returns {Object} Objeto de pedido mapeado
 */
export const mapRowToOrder = (rowObj, index = 0, initialOrder = {}, operadorDefault = '') => {
  const mapped = { id: index.toString(), ...initialOrder }
  const entries = Object.entries(rowObj || {})
  
  for (const [k, v] of entries) {
    if (k.toLowerCase() === 'id') {
      // Si viene un ID del sheet, usarlo, sino usar el índice
      const sheetId = String(v ?? '').trim()
      mapped.id = sheetId && !isNaN(parseInt(sheetId)) ? sheetId : index.toString()
    } else {
      const normalizedKey = normalize(k)
      const key = headerMap[normalizedKey]
      
      if (key) {
        let value = String(v ?? '').trim()
        
        // Convertir fechas de Excel a formato estándar
        if (key === 'fecha' || key === 'fechas') {
          value = convertExcelDate(value)
        }
        
        mapped[key] = value
      }
    }
  }
  if (!mapped.operador) mapped.operador = operadorDefault
  
  return mapped
}

/**
 * Filtra un pedido para enviar solo los campos necesarios a Google Sheets
 * @param {Object} order - Objeto de pedido completo
 * @returns {Object} Objeto filtrado con los campos para Google Sheets
 */
export const filterOrderForSheet = (order) => {
  // NOTA: La función formatDateForSheet ahora se importa desde dateService.js
  // Esto asegura consistencia en TODO el sistema (crear, editar, duplicar)

  const formatTimeForSheet = (timeString) => {
    if (!timeString) return ''
    try {
      // Si ya está en formato HH:MM:SS, devolverla
      if (timeString.includes(':') && !timeString.includes('T')) return timeString
      
      // Si es un timestamp, convertirlo a hora de Bolivia (UTC-4)
      const date = new Date(timeString)
      
      // Ajustar a hora de Bolivia (UTC-4)
      const boliviaOffset = -4 * 60 // -4 horas en minutos
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000)
      const boliviaTime = new Date(utcTime + (boliviaOffset * 60000))
      
      const hours = boliviaTime.getHours().toString().padStart(2, '0')
      const minutes = boliviaTime.getMinutes().toString().padStart(2, '0')
      const seconds = boliviaTime.getSeconds().toString().padStart(2, '0')
      return `${hours}:${minutes}:${seconds}`
    } catch (error) {
      return timeString // Si hay error, devolver el valor original
    }
  }

  // Usar la función centralizada de shared/utils/dateUtils.js
  // Si no hay fecha ni hora, generar automáticamente con hora de Bolivia
  let currentDate = order.fecha_registro || ''
  let currentTime = order.hora_registro || ''
  
  if (!currentDate || !currentTime) {
    const boliviaDateTime = getBoliviaDateTimeForSheet()
    
    if (!currentDate) {
      currentDate = boliviaDateTime.fecha
    }
    
    if (!currentTime) {
      currentTime = boliviaDateTime.hora
    }
  }
  
  console.log('🔍 [filterOrderForSheet] Checking:', { 
    id: order.id, 
    fecha: order.fecha, // Fecha programada del pedido (Fechas en Sheet)
    fecha_registro: order.fecha_registro, // Fecha de creación (Fecha Registro en Sheet)
    hora_registro: order.hora_registro,
    currentDate,
    currentTime
  })

  console.log('🔍 [filterOrderForSheet] ANTES de prepareDateForSheet:', {
    'order.fecha': order.fecha,
    'tipo': typeof order.fecha,
    'currentDate': currentDate,
    'SHEET_COLUMNS.FECHAS': SHEET_COLUMNS.FECHAS
  })

  // Función auxiliar para detectar mapas válidos
  const hasValidMapsLink = (direccion) => {
    if (!direccion || typeof direccion !== 'string') return false
    const trimmed = direccion.trim()
    return (
      trimmed.includes('maps.app.goo.gl') ||
      trimmed.includes('goo.gl/maps') ||
      trimmed.includes('maps.google.com') ||
      trimmed.includes('google.com/maps')
    ) && trimmed !== 'Cliente avisa'
  }
  
  // Corregir recojo si hay mapa pero dice "Cliente avisa"
  let recojoFinal = order.recojo
  if (hasValidMapsLink(order.direccion_recojo)) {
    if (recojoFinal === 'Cliente avisa' || !recojoFinal || recojoFinal.trim() === '') {
      recojoFinal = 'Sin especificar'
    }
  }
  
  // Corregir entrega si hay mapa pero dice "Cliente avisa"
  let entregaFinal = order.entrega
  if (hasValidMapsLink(order.direccion_entrega)) {
    if (entregaFinal === 'Cliente avisa' || !entregaFinal || entregaFinal.trim() === '') {
      entregaFinal = 'Sin especificar'
    }
  }
  
  // Usar constantes centralizadas para garantizar consistencia
  const fechaParaSheet = prepareDateForSheet(order.fecha, currentDate)
  
  console.log('🔍 [filterOrderForSheet] DESPUÉS de prepareDateForSheet:', {
    'resultado': fechaParaSheet,
    'tipo': typeof fechaParaSheet,
    'SHEET_COLUMNS.FECHAS key': SHEET_COLUMNS.FECHAS
  })
  
  const ordenFiltrada = {
    [SHEET_COLUMNS.ID]: order.id,
    [SHEET_COLUMNS.FECHA_REGISTRO]: currentDate,
    [SHEET_COLUMNS.HORA_REGISTRO]: currentTime,
    [SHEET_COLUMNS.OPERADOR]: order.operador,
    [SHEET_COLUMNS.CLIENTE]: order.cliente,
    [SHEET_COLUMNS.RECOJO]: recojoFinal,
    [SHEET_COLUMNS.ENTREGA]: entregaFinal,
    [SHEET_COLUMNS.DIRECCION_RECOJO]: order.direccion_recojo,
    [SHEET_COLUMNS.DIRECCION_ENTREGA]: order.direccion_entrega,
    [SHEET_COLUMNS.DETALLES_CARRERA]: order.detalles_carrera,
    [SHEET_COLUMNS.DISTANCIA_KM]: order.distancia_km,
    [SHEET_COLUMNS.MEDIO_TRANSPORTE]: order.medio_transporte,
    [SHEET_COLUMNS.PRECIO_BS]: order.precio_bs,
    [SHEET_COLUMNS.METODO_PAGO]: order.metodo_pago,
    [SHEET_COLUMNS.BIKER]: order.biker || '',
    [SHEET_COLUMNS.WHATSAPP]: order.whatsapp,
    [SHEET_COLUMNS.FECHAS]: fechaParaSheet,
    [SHEET_COLUMNS.HORA_INI]: formatTimeForSheet(order.hora_ini),
    [SHEET_COLUMNS.HORA_FIN]: formatTimeForSheet(order.hora_fin),
    [SHEET_COLUMNS.DURACION]: order.duracion,
    [SHEET_COLUMNS.TIEMPO_ESPERA]: order.tiempo_espera || '',
    [SHEET_COLUMNS.ESTADO]: order.estado || 'Pendiente',
    [SHEET_COLUMNS.ESTADO_PAGO]: order.estado_pago || 'Debe Cliente',
    [SHEET_COLUMNS.OBSERVACIONES]: order.observaciones,
    [SHEET_COLUMNS.PAGO_BIKER]: order.pago_biker,
    [SHEET_COLUMNS.DIA_SEMANA]: order.dia_semana,
    [SHEET_COLUMNS.COBRO_PAGO]: order.cobro_pago || '',
    [SHEET_COLUMNS.MONTO_COBRO_PAGO]: order.monto_cobro_pago || '',
    [SHEET_COLUMNS.DESCRIPCION_COBRO_PAGO]: order.descripcion_cobro_pago || '',
    [SHEET_COLUMNS.INFO_ADICIONAL_RECOJO]: order.info_direccion_recojo || '',
    [SHEET_COLUMNS.INFO_ADICIONAL_ENTREGA]: order.info_direccion_entrega || ''
  }
  
  console.log('🔍 [filterOrderForSheet] OBJETO FINAL A ENVIAR:', {
    'Fechas': ordenFiltrada[SHEET_COLUMNS.FECHAS],
    'Fecha Registro': ordenFiltrada[SHEET_COLUMNS.FECHA_REGISTRO],
    'ID': ordenFiltrada[SHEET_COLUMNS.ID],
    'objetoCompleto': ordenFiltrada
  })
  
  return ordenFiltrada
}

/**
 * Guarda un pedido en Google Sheets
 * @param {Object} order - Pedido a guardar
 * @param {boolean} silent - Si es true, no muestra notificaciones
 * @param {string} SHEET_URL - URL del endpoint para guardar
 * @param {string} SHEET_TOKEN - Token de autenticación opcional
 * @returns {Promise<void>}
 * @throws {Error} Si falla al guardar
 */
export const saveOrderToSheet = async (order, silent = false, SHEET_URL, SHEET_TOKEN) => {
  console.log('🔍 [saveOrderToSheet] Iniciando guardado:', { SHEET_URL, orderId: order.id })
  
  if (!SHEET_URL) {
    console.error('❌ [saveOrderToSheet] SHEET_URL no configurada')
    throw new Error('URL del servidor no configurada')
  }
  
  // Filtrar solo los campos que van al Google Sheet
  const filteredOrder = filterOrderForSheet(order)
  console.log('📋 [saveOrderToSheet] Orden filtrada:', filteredOrder)

  console.log('🚀 [saveOrderToSheet] Enviando POST a:', SHEET_URL)
  const res = await fetch(SHEET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SHEET_TOKEN ? { 'X-API-KEY': SHEET_TOKEN } : {})
    },
    body: JSON.stringify(filteredOrder)
  })
  console.log('✅ [saveOrderToSheet] Respuesta recibida:', res.status, res.statusText)

  if (res.ok) {
    const responseData = await res.json()
    return { success: true, data: responseData }
  } else {
    const errorText = await res.text()
    throw new Error(`Fallo al guardar en Google Sheet: ${res.status}`)
  }
}

/**
 * Actualiza un pedido en Google Sheets
 * IMPORTANTE: Ahora usa filterOrderForSheet para garantizar consistencia con saveOrderToSheet
 * @param {Object} order - Pedido a actualizar
 * @returns {Promise<Object>} Respuesta del servidor
 * @throws {Error} Si falla la actualización
 */
export const updateOrderInSheet = async (order) => {
  // Usar el nuevo endpoint unificado para actualizar pedidos
  const updateUrl = getApiUrl('/api/orders/' + order.id)

  // Usar el MISMO filtro que para crear pedidos
  // Esto garantiza que TODOS los campos (incluido biker) se formateen correctamente
  const filteredOrder = filterOrderForSheet(order)
  
  const res = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(filteredOrder)
  })

  if (res.ok) {
    const responseData = await res.json()
    return { success: true, data: responseData }
  } else {
    const errorText = await res.text()
    throw new Error(`Error ${res.status}: ${errorText}`)
  }
}

/**
 * Carga pedidos desde Google Sheets
 * @returns {Promise<Array>} Array de pedidos
 * @throws {Error} Si falla la carga
 */
export const loadOrdersFromSheet = async () => {
  console.log('🌐 [ordersService] loadOrdersFromSheet iniciando...')
  const backendUrl = getBackendUrl()
  console.log('🌐 [ordersService] backendUrl:', backendUrl)
  const readUrl = `${backendUrl}/api/read-orders`
  console.log('🌐 [ordersService] readUrl completa:', readUrl)

  console.log('🌐 [ordersService] Ejecutando fetch...')
  const res = await fetch(readUrl, { cache: 'no-store' })
  console.log('🌐 [ordersService] Respuesta recibida:', {
    status: res.status,
    ok: res.ok,
    statusText: res.statusText,
    headers: {
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length')
    }
  })

  if (!res.ok) {
    console.error('❌ [ordersService] Respuesta no OK:', res.status)
    // Si es error 503 (sin conexión), lanzar error especial
    if (res.status === 503) {
      const errorData = await res.json().catch(() => ({}))
      const error = new Error(errorData.message || 'Sin conexión a internet')
      error.code = 'NO_CONNECTION'
      error.status = 503
      throw error
    }
    
    const errorText = await res.text()
    console.error('❌ [ordersService] Error text:', errorText)
    throw new Error(`Error al cargar datos: ${res.status}`)
  }
  
  console.log('🌐 [ordersService] Parseando JSON...')
  const response = await res.json()
  console.log('🌐 [ordersService] JSON parseado:', {
    hasData: !!response.data,
    dataLength: response.data?.length || 0,
    hasHeaders: !!response.headers,
    count: response.count
  })

  if (response.data && response.data.length > 0) {
    console.log('✅ [ordersService] Retornando', response.data.length, 'pedidos')
    return response.data
  } else {
    console.log('⚠️ [ordersService] No hay datos, retornando array vacío')
    return []
  }
}

/**
 * Guarda logs en el servidor
 * @param {Array} logs - Array de logs a guardar
 * @returns {Promise<Object>} Resultado de la operación
 */
export const saveLogsToServer = async (logs) => {
  try {
    const baseUrl = getBackendUrl()
    const response = await fetch(`${baseUrl}/api/save-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs })
    })
    
    if (response.ok) {
      const result = await response.json()
      return { success: true, data: result }
    } else {
      return { success: false, error: 'Error en respuesta del servidor' }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Obtiene el siguiente ID disponible para un pedido
 * @returns {Promise<number>} Siguiente ID disponible
 */
export const getNextId = async () => {
  try {
    const { apiFetch } = await import('../utils/api.js')
    const response = await apiFetch('/api/next-id', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // Timeout de 10 segundos
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        return data.nextId
      } else {
        throw new Error(data.error || 'Error en respuesta del backend')
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
  } catch (error) {
    // NO usar timestamp como fallback - esto causa IDs inválidos
    // En su lugar, lanzar el error para que el frontend lo maneje apropiadamente
    console.error('❌ Error obteniendo siguiente ID:', error.message)
    throw new Error('No se pudo obtener el siguiente ID. Verifica tu conexión e intenta nuevamente.')
  }
}
