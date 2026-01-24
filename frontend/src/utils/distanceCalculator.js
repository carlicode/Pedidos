/**
 * Calculador de distancias usando Google Maps API
 * Maneja el cálculo de distancias entre direcciones
 */

import { getBackendUrl } from '../utils/api.js'
import { cleanGoogleMapsUrl } from './mapsUtils.js'
import { DISTANCE_BUFFER_KM } from '../constants/orderConstants.js'

/**
 * Calcula la distancia entre dos puntos usando Google Maps API
 * @param {string} origin - Dirección de origen
 * @param {string} destination - Dirección de destino
 * @param {Object} callbacks - Callbacks para efectos secundarios
 * @param {Function} callbacks.onError - Callback cuando hay error (recibe error object)
 * @param {Function} callbacks.onLog - Callback para logging (recibe action, data, status, error)
 * @returns {Promise<string|null>} Distancia en km o null si hay error
 */
export const calculateDistance = async (origin, destination, callbacks = {}) => {
  const { onError, onLog } = callbacks

  if (!origin || !destination) {
    return null
  }
  
  // Limpiar URLs antes de procesar
  const cleanOrigin = cleanGoogleMapsUrl(origin)
  const cleanDestination = cleanGoogleMapsUrl(destination)
  
  // Log: Inicio de cálculo de distancia
  if (onLog) {
    await onLog('distance_calculation_start', { 
      origin: cleanOrigin,
      destination: cleanDestination
    }, 'info')
  }
  
  try {
    // Usar el proxy del backend
    const baseUrl = getBackendUrl()
    const proxyUrl = `${baseUrl}/api/distance-proxy?origins=${encodeURIComponent(cleanOrigin)}&destinations=${encodeURIComponent(cleanDestination)}`

    const response = await fetch(proxyUrl)
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      
      const errorMessage = errorData.error || errorText || `Error ${response.status}: ${response.statusText}`
      const errorObj = {
        message: errorMessage,
        status: response.status,
        origin: cleanOrigin,
        destination: cleanDestination,
        fullError: JSON.stringify(errorData, null, 2)
      }
      
      if (onError) {
        onError(errorObj)
      }
      
      if (onLog) {
        await onLog('distance_calculation_error', { 
          origin: cleanOrigin,
          destination: cleanDestination,
          error: errorMessage
        }, 'error', errorMessage)
      }
      
      return null
    }
    
    const data = await response.json()
    
    // Verificar errores en la respuesta
    if (data.error) {
      const errorObj = {
        message: data.error,
        origin: cleanOrigin,
        destination: cleanDestination,
        fullError: JSON.stringify(data, null, 2)
      }
      
      if (onError) {
        onError(errorObj)
      }
      
      if (onLog) {
        await onLog('distance_calculation_error', { 
          origin: cleanOrigin,
          destination: cleanDestination,
          error: data.error
        }, 'error', data.error)
      }
      
      return null
    }
    
    if (data.status === 'OK' && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0]
      
      if (element.status === 'OK' && element.distance) {
        const distanceKmRaw = element.distance.value / 1000
        // Agregar buffer como margen de error para percances
        const distanceKmWithBuffer = distanceKmRaw + DISTANCE_BUFFER_KM
        const distanceKm = distanceKmWithBuffer.toFixed(2)
        const duration = element.duration ? element.duration.text : ''
        
        // Log: Cálculo de distancia exitoso
        if (onLog) {
          await onLog('distance_calculation_success', { 
            origin: cleanOrigin,
            destination: cleanDestination,
            distanceKmRaw: distanceKmRaw,
            distanceKmWithBuffer: distanceKm,
            buffer: DISTANCE_BUFFER_KM,
            duration: duration
          }, 'success')
        }
        
        return distanceKm
      } else {
        const errorMessage = element.error_message || `Element status: ${element.status}`
        const errorObj = {
          message: errorMessage,
          elementStatus: element.status,
          origin: cleanOrigin,
          destination: cleanDestination,
          fullError: JSON.stringify(data, null, 2)
        }
        
        if (onError) {
          onError(errorObj)
        }

        // Log: Error en cálculo de distancia
        if (onLog) {
          await onLog('distance_calculation_error', { 
            origin: cleanOrigin,
            destination: cleanDestination,
            elementStatus: element.status
          }, 'error', `Element status: ${element.status}`)
        }
        
        return null
      }
    } else {
      const errorMessage = data.error_message || `Status: ${data.status} - No se pudo calcular la distancia`
      const errorObj = {
        message: errorMessage,
        status: data.status,
        origin: origin,
        destination: destination,
        fullError: JSON.stringify(data, null, 2)
      }
      
      if (onError) {
        onError(errorObj)
      }
      
      // Log: Error en API de distancia
      if (onLog) {
        await onLog('distance_calculation_error', { 
          origin: origin,
          destination: destination,
          apiStatus: data.status,
          errorMessage: data.error_message
        }, 'error', `API status: ${data.status}`)
      }
      
      return null
    }
  } catch (error) {
    const errorObj = {
      message: error.message,
      origin: origin,
      destination: destination,
      fullError: error.stack || error.toString()
    }
    
    if (onError) {
      onError(errorObj)
    }

    // Log: Error de red en cálculo de distancia
    if (onLog) {
      await onLog('distance_calculation_error', { 
        origin: origin,
        destination: destination,
        error: error.message
      }, 'error', error)
    }
    
    return null
  }
}

