/**
 * Servicio centralizado para manejo de fechas en el sistema de pedidos
 * 
 * Todos los pedidos deben usar DD/MM/YYYY como formato estándar para la columna 'Fechas'
 * Este servicio asegura consistencia en:
 * - Crear pedidos
 * - Editar pedidos
 * - Duplicar pedidos
 * - Mostrar fechas
 */

/**
 * Formatea cualquier fecha al formato estándar DD/MM/YYYY
 * Este es el formato que se usa en la columna 'Fechas' del Google Sheet
 * 
 * @param {string|Date} dateInput - Fecha en cualquier formato
 * @returns {string} Fecha en formato DD/MM/YYYY o string vacío si no es válida
 * 
 * @example
 * formatToStandardDate('2026-01-09') // returns '09/01/2026'
 * formatToStandardDate('09/01/2026') // returns '09/01/2026'
 * formatToStandardDate(new Date())   // returns '09/01/2026'
 */
export const formatToStandardDate = (dateInput) => {
  if (!dateInput) return ''
  
  try {
    const trimmed = String(dateInput).trim()
    if (!trimmed) return ''
    
    // Ya está en formato DD/MM/YYYY - retornar tal cual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      console.log(`📅 [dateService] Fecha ya en formato estándar: "${trimmed}"`)
      return trimmed
    }
    
    // Formato YYYY-MM-DD (del input type="date" o ISO) - CONVERTIR
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split('-')
      const year = parts[0]
      const month = parts[1].padStart(2, '0')
      const day = parts[2].split('T')[0].padStart(2, '0') // Por si viene con hora
      const resultado = `${day}/${month}/${year}`
      console.log(`📅 [dateService] Convertido YYYY-MM-DD -> DD/MM/YYYY: "${trimmed}" -> "${resultado}"`)
      return resultado
    }
    
    // Formato DD-MM-YYYY (con guiones) - CONVERTIR
    if (/^\d{2}-\d{2}-\d{4}/.test(trimmed)) {
      const parts = trimmed.split('-')
      const resultado = `${parts[0]}/${parts[1]}/${parts[2]}`
      console.log(`📅 [dateService] Convertido DD-MM-YYYY -> DD/MM/YYYY: "${trimmed}" -> "${resultado}"`)
      return resultado
    }
    
    // Número de Excel (serial date) - CONVERTIR
    const num = parseFloat(trimmed)
    if (!isNaN(num) && !trimmed.includes('/') && !trimmed.includes('-')) {
      const excelEpoch = new Date(1899, 11, 30)
      const jsDate = new Date(excelEpoch.getTime() + num * 86400000)
      if (!isNaN(jsDate.getTime())) {
        const day = String(jsDate.getDate()).padStart(2, '0')
        const month = String(jsDate.getMonth() + 1).padStart(2, '0')
        const year = jsDate.getFullYear()
        const resultado = `${day}/${month}/${year}`
        console.log(`📅 [dateService] Convertido Excel serial -> DD/MM/YYYY: "${trimmed}" -> "${resultado}"`)
        return resultado
      }
    }
    
    // Intentar parsear como Date object (último recurso)
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const resultado = `${day}/${month}/${year}`
      console.log(`📅 [dateService] Convertido con Date() -> DD/MM/YYYY: "${trimmed}" -> "${resultado}"`)
      return resultado
    }
    
    console.warn(`⚠️ [dateService] No se pudo convertir fecha: "${trimmed}"`)
    return ''
  } catch (error) {
    console.error('❌ [dateService] Error formateando fecha:', dateInput, error)
    return ''
  }
}

/**
 * Formatea una fecha para mostrarla en la UI
 * Asegura que siempre se muestre en formato DD/MM/YYYY legible
 * 
 * @param {string} dateString - Fecha en cualquier formato
 * @returns {string} Fecha formateada para mostrar o 'N/A'
 * 
 * @example
 * formatDateForDisplay('2026-01-09') // returns '09/01/2026'
 * formatDateForDisplay('09/01/2026') // returns '09/01/2026'
 * formatDateForDisplay(null)         // returns 'N/A'
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A'
  
  const formatted = formatToStandardDate(dateString)
  return formatted || 'N/A'
}

/**
 * Convierte una fecha DD/MM/YYYY a formato ISO YYYY-MM-DD
 * Útil para filtros y comparaciones de fechas
 * 
 * @param {string} dateString - Fecha en formato DD/MM/YYYY
 * @returns {string} Fecha en formato YYYY-MM-DD o string vacío
 * 
 * @example
 * convertToISO('09/01/2026') // returns '2026-01-09'
 */
export const convertToISO = (dateString) => {
  if (!dateString) return ''
  
  try {
    const trimmed = String(dateString).trim()
    
    // Ya está en formato ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.split('T')[0]
    }
    
    // Formato DD/MM/YYYY - convertir a ISO
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/')
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    
    return ''
  } catch (error) {
    console.error('❌ [dateService] Error convirtiendo a ISO:', dateString, error)
    return ''
  }
}

/**
 * Valida si una fecha está en el formato estándar DD/MM/YYYY
 * 
 * @param {string} dateString - Fecha a validar
 * @returns {boolean} true si está en formato DD/MM/YYYY
 */
export const isStandardFormat = (dateString) => {
  if (!dateString) return false
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(dateString).trim())
}

/**
 * Prepara la fecha para guardar en Google Sheets
 * Siempre retorna DD/MM/YYYY o usa la fecha actual como fallback
 * 
 * @param {string} dateInput - Fecha del pedido
 * @param {string} currentDate - Fecha de registro actual (fallback)
 * @returns {string} Fecha en formato DD/MM/YYYY
 */
export const prepareDateForSheet = (dateInput, currentDate) => {
  const formatted = formatToStandardDate(dateInput)
  const result = formatted || currentDate
  console.log(`📅 [dateService] Fecha preparada para sheet: input="${dateInput}" -> output="${result}"`)
  return result
}

/**
 * Normaliza la fecha de un pedido antes de cualquier operación
 * Debe usarse ANTES de crear, editar o duplicar un pedido
 * 
 * @param {Object} order - Pedido con campo fecha
 * @returns {Object} Pedido con fecha normalizada
 */
export const normalizeOrderDate = (order) => {
  if (!order) return order
  
  return {
    ...order,
    fecha: formatToStandardDate(order.fecha) || order.fecha
  }
}

/**
 * Obtiene la fecha actual de Bolivia en formato DD/MM/YYYY
 * 
 * @returns {string} Fecha actual en formato DD/MM/YYYY
 */
export const getCurrentBoliviaDateStandard = () => {
  // Bolivia es UTC-4
  const now = new Date()
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
  const boliviaTime = new Date(utcTime + (-4 * 3600000))
  
  const day = String(boliviaTime.getDate()).padStart(2, '0')
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0')
  const year = boliviaTime.getFullYear()
  
  return `${day}/${month}/${year}`
}
