/**
 * Utilidades para manejo de fechas y horas en zona horaria de Bolivia (UTC-4)
 * Funciones reutilizables para formateo de fechas, horas y monedas
 */

/**
 * Obtiene la fecha y hora actual en zona horaria de Bolivia (UTC-4)
 * @returns {Date} Fecha ajustada a Bolivia
 */
export const getBoliviaTime = () => {
  const now = new Date()
  const boliviaOffset = -4 * 60 // -4 horas en minutos
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  return new Date(utc + (boliviaOffset * 60000))
}

/**
 * Genera fecha y hora en formato boliviano (UTC-4) para registro de pedidos
 * @returns {Object} Objeto con fechaRegistro y horaRegistro formateados
 */
export const getBoliviaDateTime = () => {
  const boliviaTime = getBoliviaTime()
  
  // Formatear fecha como DD/MM/YYYY
  const dia = String(boliviaTime.getDate()).padStart(2, '0')
  const mes = String(boliviaTime.getMonth() + 1).padStart(2, '0')
  const año = boliviaTime.getFullYear()
  const fechaRegistro = `${dia}/${mes}/${año}`
  
  // Formatear hora como HH:MM:SS
  const horas = String(boliviaTime.getHours()).padStart(2, '0')
  const minutos = String(boliviaTime.getMinutes()).padStart(2, '0')
  const segundos = String(boliviaTime.getSeconds()).padStart(2, '0')
  const horaRegistro = `${horas}:${minutos}:${segundos}`
  
  return {
    fechaRegistro,
    horaRegistro,
    boliviaTime
  }
}

/**
 * Obtiene la fecha actual de Bolivia en formato YYYY-MM-DD para filtros
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const getBoliviaDateISO = () => {
  const boliviaTime = getBoliviaTime()
  const year = boliviaTime.getFullYear()
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0')
  const day = String(boliviaTime.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Obtiene la hora actual de Bolivia en formato HH:MM
 * @returns {string} Hora en formato HH:MM
 */
export const getBoliviaTimeString = () => {
  const boliviaTime = getBoliviaTime()
  const hours = String(boliviaTime.getHours()).padStart(2, '0')
  const minutes = String(boliviaTime.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Obtiene la hora actual de Bolivia en formato HH:MM para campos de hora por defecto
 * @returns {string} Hora actual en formato HH:MM (zona horaria Bolivia UTC-4)
 */
export const getCurrentBoliviaTime = () => {
  const boliviaTime = getBoliviaTime()
  const hours = String(boliviaTime.getHours()).padStart(2, '0')
  const minutes = String(boliviaTime.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Formatea un número con separadores de miles y decimales
 * @param {number} value - Valor numérico a formatear
 * @param {number} decimals - Número de decimales (default: 2)
 * @returns {string} Número formateado (ej: "1,234.56")
 */
export const formatCurrency = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0.00'
  return parseFloat(value).toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Convierte un tiempo en formato HH:MM a minutos
 * @param {string} time - Tiempo en formato HH:MM
 * @returns {number|null} Minutos totales o null si es inválido
 */
export const toMinutes = (time) => {
  if (!time) return null
  const [hour, minute] = time.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

/**
 * Fusiona slots de tiempo consecutivos
 * @param {Array<string>} slots - Array de slots en formato "HH:MM-HH:MM"
 * @returns {Array<string>} Array de slots fusionados
 */
export const mergeTimeSlots = (slots = []) => {
  if (!slots.length) return []
  const parsed = slots
    .map(slot => {
      const [startRaw, endRaw] = slot.split('-')
      const start = startRaw?.trim()
      const end = endRaw?.trim()
      return {
        start,
        end,
        startMinutes: toMinutes(start),
        endMinutes: toMinutes(end)
      }
    })
    .filter(item => item.startMinutes !== null && item.endMinutes !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  if (!parsed.length) return []

  const merged = [parsed[0]]
  for (let i = 1; i < parsed.length; i++) {
    const current = merged[merged.length - 1]
    const next = parsed[i]
    if (current.endMinutes === next.startMinutes) {
      current.end = next.end
      current.endMinutes = next.endMinutes
    } else {
      merged.push(next)
    }
  }

  return merged.map(item => `${item.start}-${item.end}`)
}

/**
 * Obtiene la inicial de un día de la semana
 * @param {string} dayName - Nombre del día
 * @returns {string} Primera letra en mayúscula
 */
export const getDayInitial = (dayName = '') => {
  if (typeof dayName !== 'string') return ''
  return dayName.trim().charAt(0).toUpperCase()
}

