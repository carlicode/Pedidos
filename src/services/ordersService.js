/**
 * Servicio para operaciones CRUD de pedidos
 * Maneja la interacción con Google Sheets para pedidos
 */

import { getBackendUrl, getApiUrl } from '../utils/api.js'
import { formatToStandardDate, prepareDateForSheet } from './dateService.js'

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
  fecha: 'fecha', fechas: 'fecha',
  fecharegistro: 'fecha_registro',
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
  
  // Si ya es una fecha en formato estándar, devolverla
  if (String(excelDate).includes('/') || String(excelDate).includes('-')) {
    return String(excelDate)
  }
  
  // Convertir número de Excel a fecha
  const excelNum = parseFloat(excelDate)
  if (isNaN(excelNum)) return String(excelDate)
  
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
      const key = headerMap[normalize(k)]
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

  // Usar los valores de fecha y hora que ya vienen formateados del pedido
  const currentDate = order.fecha_registro || ''
  const currentTime = order.hora_registro || ''

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
  
  return {
    'ID': order.id,
    'Fecha Registro': currentDate, // Con RAW no necesitamos comilla simple
    'Hora Registro': currentTime,  // Con RAW no necesitamos comilla simple
    'Operador': order.operador,
    'Cliente': order.cliente,
    'Recojo': recojoFinal,
    'Entrega': entregaFinal,
    'Direccion Recojo': order.direccion_recojo,
    'Direccion Entrega': order.direccion_entrega,
    'Detalles de la Carrera': order.detalles_carrera,
    'Dist. [Km]': order.distancia_km,
    'Medio Transporte': order.medio_transporte,
    'Precio [Bs]': order.precio_bs,
    'Método pago pago': order.metodo_pago,
    'Biker': order.biker,
    'WhatsApp': order.whatsapp,
    'Fechas': (() => {
      // Usar el servicio centralizado de fechas para GARANTIZAR consistencia
      console.log(`📅 [Fechas] Valor original de order.fecha: "${order.fecha}"`)
      const fechaConvertida = prepareDateForSheet(order.fecha, currentDate)
      console.log(`📅 [Fechas] Valor final que se enviará: "${fechaConvertida}"`)
      return fechaConvertida
    })(),
    'Hora Ini': formatTimeForSheet(order.hora_ini), // Con RAW no necesitamos comilla simple
    'Hora Fin': formatTimeForSheet(order.hora_fin), // Con RAW no necesitamos comilla simple
    'Duracion': order.duracion,
    'Estado': order.estado || 'Pendiente',
    'Estado de pago': order.estado_pago || 'Debe Cliente',
    'Observaciones': order.observaciones,
    'Pago biker': order.pago_biker,
    'Dia de la semana': order.dia_semana,
    'Cobro o pago': order.cobro_pago || '',
    'Monto cobro o pago': order.monto_cobro_pago || '',
    'Descripcion de cobro o pago': order.descripcion_cobro_pago || '',
    'Info. Adicional Recojo': order.info_direccion_recojo || '',
    'Info. Adicional Entrega': order.info_direccion_entrega || '',
    'Tiempo de espera': order.tiempo_espera || ''
  }
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
  if (!SHEET_URL) {
    throw new Error('URL del servidor no configurada')
  }
  
  // Filtrar solo los campos que van al Google Sheet
  const filteredOrder = filterOrderForSheet(order)

  const res = await fetch(SHEET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SHEET_TOKEN ? { 'X-API-KEY': SHEET_TOKEN } : {})
    },
    body: JSON.stringify(filteredOrder)
  })

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
 * @param {Object} order - Pedido a actualizar
 * @returns {Promise<Object>} Respuesta del servidor
 * @throws {Error} Si falla la actualización
 */
export const updateOrderInSheet = async (order) => {
  // Usar el endpoint específico para actualizar pedidos
  const updateUrl = getApiUrl('/api/update-order-status')

  // Preparar datos para el endpoint de actualización
  const updateData = {
    orderId: String(order.id),
    newStatus: order.estado || 'En proceso',
    additionalData: {
      operador: order.operador,
      cliente: order.cliente,
      recojo: order.recojo,
      entrega: order.entrega,
      direccion_recojo: order.direccion_recojo,
      info_direccion_recojo: order.info_direccion_recojo !== undefined && order.info_direccion_recojo !== null 
        ? String(order.info_direccion_recojo) 
        : (order['Info. Adicional Recojo'] !== undefined && order['Info. Adicional Recojo'] !== null 
          ? String(order['Info. Adicional Recojo']) 
          : ''),
      direccion_entrega: order.direccion_entrega,
      info_direccion_entrega: order.info_direccion_entrega !== undefined && order.info_direccion_entrega !== null 
        ? String(order.info_direccion_entrega) 
        : (order['Info. Adicional Entrega'] !== undefined && order['Info. Adicional Entrega'] !== null 
          ? String(order['Info. Adicional Entrega']) 
          : ''),
      detalles_carrera: order.detalles_carrera,
      distancia: order.distancia || order.distancia_km,
      medio_transporte: order.medio_transporte,
      precio: order.precio || order.precio_bs,
      metodo_pago: order.metodo_pago,
      estado_pago: order.estado_pago,
      biker: order.biker,
      whatsapp: order.whatsapp,
      fecha: order.fecha,
      hora_ini: order.hora_ini,
      hora_fin: order.hora_fin,
      duracion: order.duracion,
      tiempo_espera: order.tiempo_espera || order['Tiempo de espera'] || order['Tiempo de Espera'] || '',
      observaciones: order.observaciones,
      pago_biker: order.pago_biker,
      dia_semana: order.dia_semana,
      cobro_pago: order.cobro_pago,
      monto_cobro_pago: order.monto_cobro_pago,
      descripcion_cobro_pago: order.descripcion_cobro_pago
    }
  }
  
  const res = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
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
  const backendUrl = getBackendUrl()
  const readUrl = `${backendUrl}/api/read-orders`

  const res = await fetch(readUrl, { cache: 'no-store' })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Error al cargar datos: ${res.status}`)
  }
  
  const response = await res.json()

  if (response.data && response.data.length > 0) {
    return response.data
  } else {
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
    const response = await fetch('/api/next-id', {
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
    // Fallback: usar timestamp como ID único
    const timestampId = Date.now()
    return timestampId
  }
}
