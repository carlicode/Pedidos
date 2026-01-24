/**
 * Servicio modular para validación y cálculo de distancias con Google Maps
 * Optimizado con caching, timeouts y validación visual
 */

import { getBackendUrl } from './api.js'
import { cleanGoogleMapsUrl } from './mapsUtils.js'

// Cache para validaciones de links (evitar validar el mismo link múltiples veces)
const linkValidationCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Cache para cálculos de distancia
const distanceCache = new Map()
const DISTANCE_CACHE_TTL = 30 * 60 * 1000 // 30 minutos

// Timeout para requests
const REQUEST_TIMEOUT = 10000 // 10 segundos

/**
 * Helper para hacer fetch con timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    if (error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado tiempo. Intenta nuevamente.')
    }
    throw error
  }
}

/**
 * Valida si una URL es un link válido de Google Maps
 * @param {string} url - URL a validar
 * @returns {boolean} true si es válido
 */
export function isValidMapsUrl(url) {
  if (!url || typeof url !== 'string') return false
  
  const cleanUrl = url.trim()
  return cleanUrl.includes('maps.app.goo.gl') || 
         cleanUrl.includes('goo.gl/maps') || 
         cleanUrl.includes('google.com/maps') || 
         cleanUrl.includes('maps.google.com')
}

/**
 * Valida un link de Google Maps consultando al backend
 * Usa cache para evitar validaciones repetidas
 * 
 * @param {string} url - URL de Google Maps a validar
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateMapsLink(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, error: 'URL vacía' }
  }

  const cleanUrl = cleanGoogleMapsUrl(url)
  
  // Validación básica primero
  if (!isValidMapsUrl(cleanUrl)) {
    return { valid: false, error: 'Formato de URL inválido' }
  }

  // Verificar cache
  const cacheKey = cleanUrl
  const cached = linkValidationCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return { valid: cached.valid, cached: true }
  }

  try {
    const baseUrl = getBackendUrl()
    // Endpoint simplificado solo para validar si el link es accesible
    const response = await fetchWithTimeout(
      `${baseUrl}/api/validate-maps-link?url=${encodeURIComponent(cleanUrl)}`,
      {},
      5000 // Timeout más corto para validación
    )

    const data = await response.json()
    const result = { 
      valid: response.ok && data.valid, 
      error: data.error || null 
    }

    // Guardar en cache
    linkValidationCache.set(cacheKey, {
      valid: result.valid,
      timestamp: Date.now()
    })

    return result
  } catch (error) {
    console.warn('Error validando link de Maps:', error.message)
    // En caso de error de red, asumir que es válido si tiene formato correcto
    // (mejor UX que bloquear al usuario)
    return { valid: true, warning: 'No se pudo verificar, pero el formato es correcto' }
  }
}

/**
 * Calcula la distancia entre dos puntos usando Google Maps API
 * Optimizado con cache y timeout
 * 
 * @param {string} origin - URL de origen
 * @param {string} destination - URL de destino
 * @param {Object} options - Opciones
 * @param {number} options.buffer - Buffer en km a agregar
 * @param {boolean} options.skipCache - Saltar cache
 * @returns {Promise<{distance: number|null, duration?: string, error?: string, cached?: boolean}>}
 */
export async function calculateDistance(origin, destination, options = {}) {
  const {
    buffer = 0.025,
    skipCache = false
  } = options

  if (!origin || !destination) {
    return { distance: null, error: 'Origen y destino son requeridos' }
  }

  const cleanOrigin = cleanGoogleMapsUrl(origin)
  const cleanDestination = cleanGoogleMapsUrl(destination)

  // Validar URLs básico
  if (!isValidMapsUrl(cleanOrigin)) {
    return { distance: null, error: 'URL de origen inválida' }
  }
  if (!isValidMapsUrl(cleanDestination)) {
    return { distance: null, error: 'URL de destino inválida' }
  }

  // Verificar cache (solo si no se solicita saltarlo)
  if (!skipCache) {
    const cacheKey = `${cleanOrigin}|${cleanDestination}|${buffer}`
    const cached = distanceCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp < DISTANCE_CACHE_TTL)) {
      return { 
        distance: cached.distance, 
        duration: cached.duration,
        cached: true 
      }
    }
  }

  try {
    const baseUrl = getBackendUrl()
    const proxyUrl = `${baseUrl}/api/distance-proxy?origins=${encodeURIComponent(cleanOrigin)}&destinations=${encodeURIComponent(cleanDestination)}`

    const response = await fetchWithTimeout(proxyUrl, {}, REQUEST_TIMEOUT)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        distance: null, 
        error: errorData.error || `Error ${response.status}: No se pudo calcular` 
      }
    }

    const data = await response.json()

    // Verificar respuesta de Google Maps
    if (data.status !== 'OK') {
      return { 
        distance: null, 
        error: data.error_message || `Estado de API: ${data.status}` 
      }
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK' || !element.distance) {
      return { 
        distance: null, 
        error: 'Google Maps no pudo calcular la ruta' 
      }
    }

    // Calcular distancia con buffer
    const distanceKmRaw = element.distance.value / 1000
    const distanceKm = parseFloat((distanceKmRaw + buffer).toFixed(2))
    const duration = element.duration?.text || null

    const result = {
      distance: distanceKm,
      duration: duration,
      cached: false
    }

    // Guardar en cache
    const cacheKey = `${cleanOrigin}|${cleanDestination}|${buffer}`
    distanceCache.set(cacheKey, {
      distance: distanceKm,
      duration: duration,
      timestamp: Date.now()
    })

    return result
  } catch (error) {
    console.error('Error calculando distancia:', error)
    return { 
      distance: null, 
      error: error.message || 'Error de conexión' 
    }
  }
}

/**
 * Limpia los caches (útil para testing o cuando se detectan problemas)
 */
export function clearCaches() {
  linkValidationCache.clear()
  distanceCache.clear()
}

/**
 * Hook helper para React - valida un link y retorna el estado
 * Puede ser usado con useEffect para validación automática
 * 
 * @param {string} url - URL a validar
 * @param {Function} callback - Callback con resultado (valid, error)
 */
export async function validateLinkWithCallback(url, callback) {
  if (!url || url.trim() === '') {
    callback({ valid: null, error: null }) // null = no hay nada que validar
    return
  }

  const result = await validateMapsLink(url)
  callback(result)
}

export default {
  isValidMapsUrl,
  validateMapsLink,
  calculateDistance,
  clearCaches,
  validateLinkWithCallback
}
