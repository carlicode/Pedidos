import { useState, useEffect, useCallback, useRef } from 'react'
import { validateMapsLink, calculateDistance } from '../services/mapsValidationService.js'

/**
 * Hook optimizado para validación de links de Google Maps
 * Muestra check verde si es válido, X roja si es inválido
 * Incluye debounce para no hacer requests mientras el usuario escribe
 * 
 * @param {string} url - URL a validar
 * @param {Object} options - Opciones
 * @param {number} options.debounceMs - Tiempo de debounce en ms (default: 800)
 * @param {boolean} options.validateOnMount - Validar al montar (default: false)
 * @returns {Object} Estado de validación y funciones
 */
export function useMapsLinkValidation(url, options = {}) {
  const {
    debounceMs = 800,
    validateOnMount = false
  } = options

  const [validation, setValidation] = useState({
    status: 'idle', // 'idle' | 'validating' | 'valid' | 'invalid'
    error: null,
    cached: false
  })

  const timeoutRef = useRef(null)
  const lastValidatedRef = useRef('')

  const validate = useCallback(async (urlToValidate) => {
    if (!urlToValidate || urlToValidate.trim() === '') {
      setValidation({ status: 'idle', error: null, cached: false })
      return
    }

    // Evitar validar la misma URL dos veces seguidas
    if (urlToValidate === lastValidatedRef.current) {
      return
    }

    setValidation({ status: 'validating', error: null, cached: false })

    try {
      const result = await validateMapsLink(urlToValidate)
      
      lastValidatedRef.current = urlToValidate

      setValidation({
        status: result.valid ? 'valid' : 'invalid',
        error: result.error || null,
        cached: result.cached || false,
        warning: result.warning || null
      })
    } catch (error) {
      console.error('Error en validación:', error)
      setValidation({
        status: 'invalid',
        error: 'Error de conexión',
        cached: false
      })
    }
  }, [])

  const debouncedValidate = useCallback((urlToValidate) => {
    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Programar nueva validación
    timeoutRef.current = setTimeout(() => {
      validate(urlToValidate)
    }, debounceMs)
  }, [validate, debounceMs])

  const reset = useCallback(() => {
    setValidation({ status: 'idle', error: null, cached: false })
    lastValidatedRef.current = ''
  }, [])

  // Efecto para validar cuando cambia la URL
  useEffect(() => {
    if (!url || url.trim() === '') {
      reset()
      return
    }

    if (validateOnMount || lastValidatedRef.current !== '') {
      debouncedValidate(url)
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [url, debouncedValidate, validateOnMount, reset])

  return {
    validation,
    validate: () => validate(url),
    reset
  }
}

/**
 * Hook optimizado para cálculo de distancia con caching
 * Maneja estado de carga, errores y resultados cacheados
 * 
 * @param {Object} options - Opciones
 * @returns {Object} Estado y funciones
 */
export function useOptimizedDistanceCalculation(options = {}) {
  const {
    buffer = 0.025,
    onSuccess = null,
    onError = null
  } = options

  const [state, setState] = useState({
    isCalculating: false,
    distance: null,
    duration: null,
    error: null,
    cached: false
  })

  const abortControllerRef = useRef(null)

  const calculate = useCallback(async (origin, destination, skipCache = false) => {
    // Cancelar cálculo anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setState({
      isCalculating: true,
      distance: null,
      duration: null,
      error: null,
      cached: false
    })

    try {
      const result = await calculateDistance(origin, destination, {
        buffer,
        skipCache
      })

      if (result.distance !== null) {
        setState({
          isCalculating: false,
          distance: result.distance,
          duration: result.duration,
          error: null,
          cached: result.cached || false
        })

        if (onSuccess) {
          onSuccess(result)
        }

        return result.distance
      } else {
        setState({
          isCalculating: false,
          distance: null,
          duration: null,
          error: result.error || 'No se pudo calcular',
          cached: false
        })

        if (onError) {
          onError(result.error)
        }

        return null
      }
    } catch (error) {
      setState({
        isCalculating: false,
        distance: null,
        duration: null,
        error: error.message,
        cached: false
      })

      if (onError) {
        onError(error.message)
      }

      return null
    }
  }, [buffer, onSuccess, onError])

  const reset = useCallback(() => {
    setState({
      isCalculating: false,
      distance: null,
      duration: null,
      error: null,
      cached: false
    })
  }, [])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    ...state,
    calculate,
    reset
  }
}

export default {
  useMapsLinkValidation,
  useOptimizedDistanceCalculation
}
