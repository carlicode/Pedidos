import { useState, useCallback, useEffect } from 'react'
import { calculatePrice } from '../utils/priceCalculator.js'

/**
 * Custom hook for managing price calculation logic
 * Handles auto-calculation from distance and transport type
 * Manages manual price editing flag
 * 
 * @param {Object} formState - Current form state
 * @param {Object} options - Additional options
 * @returns {Object} Price calculation handlers and state
 */
export function usePriceCalculation(formState = {}, options = {}) {
  const {
    showNotification = () => {}
  } = options

  const [precioEditadoManualmente, setPrecioEditadoManualmente] = useState(false)

  /**
   * Calculate price from distance and transport type
   * Returns the calculated price or null if calculation fails
   */
  const calculatePriceFromDistance = useCallback((distanciaKm, medioTransporte) => {
    if (!distanciaKm || !medioTransporte) {
      return null
    }

    try {
      const distance = parseFloat(distanciaKm)
      if (isNaN(distance) || distance <= 0) {
        return null
      }

      const precio = calculatePrice(distance, medioTransporte)
      return precio
    } catch (error) {
      console.error('Error calculating price:', error)
      return null
    }
  }, [])

  /**
   * Handle manual price edit
   * Sets flag to prevent auto-recalculation
   */
  const handlePrecioManualEdit = useCallback((value, setFormFn, metodoPago = '') => {
    setPrecioEditadoManualmente(true)
    setFormFn(prev => ({ ...prev, precio_bs: value }))

    // Special notification for "Cuenta" payment method
    if (metodoPago === 'Cuenta') {
      showNotification('✏️ Precio editado manualmente (Cuenta del cliente)', 'info')
    }
  }, [showNotification])

  /**
   * Auto-update price when distance or transport changes
   * Only if price hasn't been manually edited
   */
  const autoUpdatePrice = useCallback((distanciaKm, medioTransporte, setFormFn, force = false) => {
    // Don't auto-update if price was manually edited (unless forced)
    if (precioEditadoManualmente && !force) {
      return
    }

    const precio = calculatePriceFromDistance(distanciaKm, medioTransporte)
    if (precio !== null) {
      setFormFn(prev => ({ ...prev, precio_bs: precio }))
    }
  }, [precioEditadoManualmente, calculatePriceFromDistance])

  /**
   * Reset manual edit flag (useful when starting a new form)
   */
  const resetPrecioManualFlag = useCallback(() => {
    setPrecioEditadoManualmente(false)
  }, [])

  /**
   * Calculate and update price with special handling for "Cuenta" payment method
   * For "Cuenta": calculates price but may display differently in UI
   */
  const calculateAndUpdatePrice = useCallback((distanciaKm, medioTransporte, metodoPago, setFormFn) => {
    const precio = calculatePriceFromDistance(distanciaKm, medioTransporte)
    
    if (precio !== null) {
      if (metodoPago === 'Cuenta') {
        // For "Cuenta", save calculated price but notify user
        setFormFn(prev => ({ ...prev, precio_bs: precio }))
        showNotification(`📏 Distancia: ${distanciaKm} km • 💳 Precio calculado: ${precio} Bs (Cuenta del cliente)`, 'success')
      } else {
        setFormFn(prev => ({ ...prev, precio_bs: precio }))
        showNotification(`📏 Distancia: ${distanciaKm} km • 💰 Precio: ${precio} Bs`, 'success')
      }
    }
  }, [calculatePriceFromDistance, showNotification])

  return {
    precioEditadoManualmente,
    setPrecioEditadoManualmente,
    calculatePriceFromDistance,
    handlePrecioManualEdit,
    autoUpdatePrice,
    resetPrecioManualFlag,
    calculateAndUpdatePrice
  }
}

export default usePriceCalculation
