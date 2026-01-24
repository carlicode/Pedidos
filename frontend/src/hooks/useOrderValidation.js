import { useCallback } from 'react'
import { validateForm } from '../utils/formValidator.js'

/**
 * Custom hook for order form validation
 * Wraps formValidator.js with additional UI logic
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Validation handlers
 */
export function useOrderValidation(options = {}) {
  const {
    showNotification = () => {}
  } = options

  /**
   * Validate order form and return errors
   * @param {Object} formData - Form data to validate
   * @param {Object} validationOptions - Validation options (e.g., recojoClienteAvisa)
   * @returns {Array} Array of validation error messages
   */
  const validateOrderForm = useCallback((formData, validationOptions = {}) => {
    return validateForm(formData, validationOptions)
  }, [])

  /**
   * Validate form and show notification with errors if any
   * Also scrolls to first error field
   * @param {Object} formData - Form data to validate
   * @param {Object} validationOptions - Validation options
   * @returns {boolean} True if valid, false if errors found
   */
  const validateAndNotify = useCallback((formData, validationOptions = {}) => {
    const errors = validateOrderForm(formData, validationOptions)
    
    if (errors.length > 0) {
      const errorMessage = `Por favor, corrija los siguientes errores:\n\n${errors.map(error => `• ${error}`).join('\n')}`
      showNotification(errorMessage, 'error')
      
      // Scroll to first error field
      const firstErrorField = document.querySelector('.field-required')
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
        firstErrorField.focus()
      }
      
      return false
    }
    
    return true
  }, [validateOrderForm, showNotification])

  /**
   * Add error class to field if empty
   * @param {Event} e - Event object from input
   */
  const removeErrorClassIfFilled = useCallback((e) => {
    const { value } = e.target
    if (value && value.trim() !== '' && e.target && e.target.classList) {
      e.target.classList.remove('field-required')
    }
  }, [])

  return {
    validateOrderForm,
    validateAndNotify,
    removeErrorClassIfFilled
  }
}

export default useOrderValidation
