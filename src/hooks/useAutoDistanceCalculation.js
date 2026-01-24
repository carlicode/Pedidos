import { useCallback, useEffect, useRef } from 'react'

/**
 * Custom hook for automatic distance calculation when addresses change
 * Monitors form state and automatically calculates distance when both addresses are available
 * 
 * @param {Object} formState - Current form state
 * @param {Function} calculateDistanceFn - Function to call for distance calculation
 * @param {Object} options - Configuration options
 * @returns {Object} Auto-calculation handlers
 */
export function useAutoDistanceCalculation(formState, calculateDistanceFn, options = {}) {
  const {
    recojoClienteAvisa = false,
    entregaClienteAvisa = false,
    debounceMs = 300 // Debounce delay in milliseconds
  } = options

  const timeoutRef = useRef(null)
  const lastCalculatedRef = useRef({ recojo: '', entrega: '' })

  /**
   * Check if we should calculate distance and trigger calculation
   */
  const checkAndCalculate = useCallback(() => {
    const direccionRecojo = formState.direccion_recojo || ''
    const direccionEntrega = formState.direccion_entrega || ''
    const medioTransporte = formState.medio_transporte || ''

    // Check if we have both addresses
    const tieneRecojo = direccionRecojo.trim() !== ''
    const tieneEntrega = direccionEntrega.trim() !== ''
    
    // Check if addresses have changed
    const recojoChanged = direccionRecojo !== lastCalculatedRef.current.recojo
    const entregaChanged = direccionEntrega !== lastCalculatedRef.current.entrega
    
    // Only calculate if:
    // 1. Both addresses exist
    // 2. Not in "Cliente avisa" mode
    // 3. Addresses have changed
    // 4. We have a valid calculate function
    if (
      tieneRecojo && 
      tieneEntrega && 
      !recojoClienteAvisa && 
      !entregaClienteAvisa &&
      (recojoChanged || entregaChanged) &&
      calculateDistanceFn
    ) {
      // Clear any pending calculation
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounce the calculation
      timeoutRef.current = setTimeout(async () => {
        try {
          await calculateDistanceFn(direccionRecojo, direccionEntrega, medioTransporte)
          // Update last calculated values
          lastCalculatedRef.current = {
            recojo: direccionRecojo,
            entrega: direccionEntrega
          }
        } catch (error) {
          console.error('Error in auto distance calculation:', error)
        }
      }, debounceMs)
    }
  }, [
    formState.direccion_recojo,
    formState.direccion_entrega,
    formState.medio_transporte,
    recojoClienteAvisa,
    entregaClienteAvisa,
    calculateDistanceFn,
    debounceMs
  ])

  /**
   * Manually trigger calculation (useful for button clicks)
   */
  const triggerCalculation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    checkAndCalculate()
  }, [checkAndCalculate])

  /**
   * Reset the last calculated values (useful when form is reset)
   */
  const resetLastCalculated = useCallback(() => {
    lastCalculatedRef.current = { recojo: '', entrega: '' }
  }, [])

  // Auto-calculate when addresses change
  useEffect(() => {
    checkAndCalculate()

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [checkAndCalculate])

  return {
    triggerCalculation,
    resetLastCalculated
  }
}

export default useAutoDistanceCalculation
