/**
 * Utilidades para Google Maps
 * Funciones para trabajar con URLs, enlaces y validaciones de Google Maps
 */

/**
 * Limpia una URL de Google Maps removiendo espacios y caracteres problemáticos
 * @param {string} url - URL a limpiar
 * @returns {string} URL limpia
 */
export const cleanGoogleMapsUrl = (url) => {
  if (!url || typeof url !== 'string') return url
  // Limpiar espacios, paréntesis y otros caracteres problemáticos al inicio y final
  return url.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
}

/**
 * Genera un enlace de Google Maps desde una dirección
 * @param {string} address - Dirección para generar el enlace
 * @returns {string} URL de Google Maps o string vacío si no hay dirección
 */
export const generateGoogleMapsLink = (address) => {
  if (!address || address.trim() === '') return ''
  
  // Si ya es un enlace de Google Maps, devolverlo tal como está
  if (address.includes('maps.google.com') || address.includes('goo.gl/maps')) {
    return address
  }
  
  // Generar enlace de Google Maps desde la dirección
  const encodedAddress = encodeURIComponent(address.trim())
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
}

/**
 * Verifica si un valor es un enlace de Google Maps
 * @param {string} value - Valor a verificar
 * @returns {boolean} True si es un enlace de Google Maps
 */
export const isGoogleMapsLink = (value) => {
  return value && (value.includes('maps.google.com') || value.includes('goo.gl/maps'))
}

/**
 * Verifica si una dirección tiene un enlace válido de Google Maps
 * @param {string} direccion - Dirección a verificar
 * @returns {boolean} True si tiene un enlace válido
 */
export const hasValidMapsLink = (direccion) => {
  if (!direccion || typeof direccion !== 'string') return false
  const trimmed = direccion.trim()
  // Detectar varios formatos de enlaces de Google Maps
  return (
    trimmed.includes('maps.app.goo.gl') ||
    trimmed.includes('goo.gl/maps') ||
    trimmed.includes('maps.google.com') ||
    trimmed.includes('google.com/maps')
  ) && trimmed !== 'Cliente avisa'
}

/**
 * Valida el formato de una URL de Google Maps
 * @param {string} url - URL a validar
 * @returns {boolean} True si el formato es válido (permite campos vacíos)
 */
export const validateGoogleMapsLink = (url) => {
  if (!url || url.trim() === '') return true // Permitir campos vacíos
  
  const trimmedUrl = url.trim()
  
  // Patrones válidos de Google Maps:
  // 1. https://maps.app.goo.gl/xxxxx (enlaces cortos)
  // 2. https://www.google.com/maps/place/... (enlaces completos)
  // 3. También aceptar con @ al inicio como en el ejemplo
  const validPatterns = [
    /^@?https:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+/,
    /^@?https:\/\/www\.google\.com\/maps\/place\/.+/,
    /^@?https:\/\/maps\.google\.com\/.*\/@-?\d+\.\d+,-?\d+\.\d+/
  ]
  
  return validPatterns.some(pattern => pattern.test(trimmedUrl))
}

