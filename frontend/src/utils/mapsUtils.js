/**
 * Utilidades para Google Maps
 * Funciones para trabajar con URLs, enlaces y validaciones de Google Maps
 */

/**
 * Limpia y normaliza una URL de Google Maps removiendo espacios, caracteres problemáticos y URLs concatenadas
 * @param {string} url - URL a limpiar
 * @returns {string} URL limpia y normalizada, o null si no es válida
 */
export const cleanGoogleMapsUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  
  // Limpiar espacios al inicio y final
  let urlLimpia = url.trim()
  
  // Remover paréntesis y espacios al inicio y final
  urlLimpia = urlLimpia.replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
  
  // Si está vacío después de limpiar, retornar null
  if (!urlLimpia || urlLimpia === '') return null
  
  // Detectar URLs concatenadas (ej: https://maps.app.goo.gl/191https://maps.app.goo.gl/...)
  // Buscar patrones de URLs de Google Maps
  const patronesUrl = [
    /https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+/g,
    /https?:\/\/goo\.gl\/maps\/[a-zA-Z0-9_-]+/g,
    /https?:\/\/www\.google\.com\/maps\/[^\s\)]+/g,
    /https?:\/\/maps\.google\.com\/[^\s\)]+/g,
    /https?:\/\/google\.com\/maps\/[^\s\)]+/g,
    /https?:\/\/google\.com\.bo\/maps\/[^\s\)]+/g
  ]
  
  const urlsEncontradas = []
  patronesUrl.forEach(patron => {
    const matches = urlLimpia.match(patron)
    if (matches) {
      urlsEncontradas.push(...matches)
    }
  })
  
  // Si encontramos URLs válidas, usar la primera completa
  if (urlsEncontradas.length > 0) {
    const urlSeleccionada = urlsEncontradas[0]
    
    // Verificar si la URL está malformada (tiene otra URL dentro)
    if (urlSeleccionada.includes('https://') && urlSeleccionada.split('https://').length > 2) {
      // Extraer solo la primera URL completa
      const partes = urlSeleccionada.split('https://')
      if (partes.length > 1) {
        const primeraUrl = 'https://' + partes[1]
        const matchPrimera = primeraUrl.match(/https?:\/\/[^\s\)]+/)
        if (matchPrimera) {
          return matchPrimera[0].trim()
        }
      }
    }
    
    return urlSeleccionada.trim()
  }
  
  // Si no encontramos patrón válido pero parece una URL de maps, intentar limpiar
  if (urlLimpia.includes('maps.app.goo.gl') || urlLimpia.includes('goo.gl/maps') || urlLimpia.includes('google.com/maps')) {
    // Intentar extraer la parte válida antes del primer espacio o paréntesis
    const match = urlLimpia.match(/https?:\/\/[^\s\)]+/)
    if (match) {
      return match[0].trim()
    }
  }
  
  // Si no parece una URL de Google Maps, retornar null
  if (!urlLimpia.includes('maps') && !urlLimpia.includes('goo.gl')) {
    return null
  }
  
  return urlLimpia
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

