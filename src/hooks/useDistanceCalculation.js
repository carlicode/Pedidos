import { useState, useCallback } from 'react'
import { calculateDistance } from '../utils/distanceCalculator.js'
import { cleanGoogleMapsUrl } from '../utils/mapsUtils.js'

/**
 * Custom hook for distance calculation
 * Handles API calls to calculate distance between two points
 * Manages loading and error states
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Distance calculation handlers and state
 */
export function useDistanceCalculation(options = {}) {
  const {
    showNotification = () => {},
    distanceBuffer = 0, // Buffer to add to calculated distance (in km)
    onError: externalOnError = null, // Optional external error handler
    onLog: externalOnLog = null // Optional external log handler
  } = options

  const [isCalculating, setIsCalculating] = useState(false)
  const [lastError, setLastError] = useState(null)

  /**
   * Validate that a URL is a valid Google Maps link
   */
  const isValidMapsUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false
    return url.includes('maps.app.goo.gl') || 
           url.includes('goo.gl/maps') || 
           url.includes('google.com/maps') || 
           url.includes('maps.google.com')
  }, [])

  /**
   * Calculate distance between two Google Maps URLs
   * Returns distance in km or null if calculation fails
   */
  const calculateDistanceBetween = useCallback(async (direccionRecojo, direccionEntrega) => {
    // Validate inputs
    if (!direccionRecojo || !direccionEntrega) {
      showNotification('⚠️ Por favor ingresa ambas direcciones (recojo y entrega)', 'warning')
      return null
    }

    // Clean URLs
    const cleanRecojo = cleanGoogleMapsUrl(direccionRecojo)
    const cleanEntrega = cleanGoogleMapsUrl(direccionEntrega)

    // Validate URLs
    if (!isValidMapsUrl(cleanRecojo)) {
      showNotification('⚠️ La dirección de recojo debe ser un enlace válido de Google Maps', 'warning')
      return null
    }

    if (!isValidMapsUrl(cleanEntrega)) {
      showNotification('⚠️ La dirección de entrega debe ser un enlace válido de Google Maps', 'warning')
      return null
    }

    setIsCalculating(true)
    setLastError(null)
    showNotification('🔄 Calculando distancia...', 'success')

    try {
      // Pass callbacks to calculateDistance if provided
      const callbacks = {}
      if (externalOnError) callbacks.onError = externalOnError
      if (externalOnLog) callbacks.onLog = externalOnLog
      
      const distance = await calculateDistance(cleanRecojo, cleanEntrega, Object.keys(callbacks).length > 0 ? callbacks : undefined)
      
      if (distance !== null && distance > 0) {
        // Apply buffer if configured (but note: calculateDistance already applies DISTANCE_BUFFER_KM)
        // So we only apply additional buffer if distanceBuffer > DISTANCE_BUFFER_KM
        const finalDistance = distanceBuffer > 0 
          ? (parseFloat(distance) + distanceBuffer).toFixed(2) 
          : distance

        setIsCalculating(false)
        return parseFloat(finalDistance)
      } else {
        const error = new Error('No se pudo calcular la distancia. Revisa la consola para más detalles.')
        setLastError(error)
        if (externalOnError) {
          externalOnError({
            message: error.message,
            origin: cleanRecojo,
            destination: cleanEntrega
          })
        }
        showNotification('⚠️ ' + error.message, 'warning')
        setIsCalculating(false)
        return null
      }
    } catch (error) {
      console.error('Error calculating distance:', error)
      setLastError(error)
      if (externalOnError) {
        externalOnError({
          message: error.message,
          origin: cleanRecojo,
          destination: cleanEntrega,
          fullError: error.stack || error.toString()
        })
      }
      showNotification(`❌ Error al calcular distancia: ${error.message}`, 'error')
      setIsCalculating(false)
      return null
    }
  }, [showNotification, distanceBuffer, isValidMapsUrl, externalOnError, externalOnLog])

  /**
   * Calculate distance and update form state
   * Convenience method that combines calculation with form update
   */
  const calculateAndUpdateDistance = useCallback(async (direccionRecojo, direccionEntrega, setFormFn) => {
    const distance = await calculateDistanceBetween(direccionRecojo, direccionEntrega)
    
    if (distance !== null) {
      setFormFn(prev => ({ ...prev, distancia_km: distance }))
      return distance
    }
    
    return null
  }, [calculateDistanceBetween])

  /**
   * Clear the last error
   */
  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    isCalculating,
    lastError,
    calculateDistanceBetween,
    calculateAndUpdateDistance,
    clearError
  }
}

export default useDistanceCalculation
