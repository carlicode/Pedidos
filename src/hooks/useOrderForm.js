import { useState, useCallback } from 'react'

/**
 * Custom hook for generic order form state management
 * Mode-agnostic: works for create, edit, or delivery modes
 * 
 * @param {Object} initialValues - Initial form values
 * @returns {Object} Form state and handlers
 */
export function useOrderForm(initialValues = {}) {
  const [form, setForm] = useState(initialValues)

  /**
   * Generic field change handler
   * Updates a single field in the form state
   */
  const handleFieldChange = useCallback((name, value) => {
    setForm(prev => ({ ...prev, [name]: value }))
  }, [])

  /**
   * Batch update multiple fields at once
   */
  const updateFields = useCallback((updates) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Reset form to initial values
   */
  const resetForm = useCallback((newInitialValues) => {
    setForm(newInitialValues || initialValues)
  }, [initialValues])

  /**
   * Get a specific field value
   */
  const getFieldValue = useCallback((name) => {
    return form[name]
  }, [form])

  /**
   * Standard onChange handler for input elements
   */
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target
    handleFieldChange(name, value)
  }, [handleFieldChange])

  return {
    form,
    setForm,
    handleFieldChange,
    updateFields,
    resetForm,
    getFieldValue,
    handleInputChange
  }
}

export default useOrderForm
