import { useState, useCallback } from 'react'
import { getEmpresaMapa, getEmpresaDescripcion } from '../utils/dataHelpers.js'

/**
 * Custom hook for handling address auto-fill logic
 * Manages direccion_recojo, direccion_entrega, and info adicional fields
 * 
 * @param {Array} empresas - List of empresas with maps URLs and descriptions
 * @param {string} mode - 'create' or 'edit' mode
 * @param {Object} options - Additional options
 * @returns {Object} Address handlers and modal state
 */
export function useAddressAutofill(empresas = [], mode = 'create', options = {}) {
  const {
    recojoManual = false,
    entregaManual = false,
    showNotification = () => {}
  } = options

  // Modal state for edit mode
  const [infoModalState, setInfoModalState] = useState({
    show: false,
    tipo: 'recojo',
    textoAnterior: '',
    textoNuevo: '',
    onAccept: null,
    onCancel: null
  })

  /**
   * Handle recojo (pickup) field changes
   * Auto-fills direccion_recojo and optionally shows InfoAdicionalModal in edit mode
   */
  const handleRecojoChange = useCallback((value, currentForm, setFormFn) => {
    if (recojoManual) {
      // In manual mode, just update the field
      setFormFn(prev => ({ ...prev, recojo: value }))
      return
    }

    // Get empresa data
    const empresaMapa = getEmpresaMapa(value, empresas) || ''
    const empresaDescripcion = getEmpresaDescripcion(value, empresas) || ''

    // Update recojo and direccion_recojo
    const updates = {
      recojo: value,
      direccion_recojo: empresaMapa
    }

    if (mode === 'edit' && empresaDescripcion) {
      // In edit mode, show modal to review and edit additional info
      const infoAnterior = currentForm.info_direccion_recojo || ''
      
      setInfoModalState({
        show: true,
        tipo: 'recojo',
        textoAnterior: infoAnterior,
        textoNuevo: empresaDescripcion,
        onAccept: (textoEditado) => {
          setFormFn(prev => ({
            ...prev,
            ...updates,
            info_direccion_recojo: textoEditado
          }))
          setInfoModalState(prev => ({ ...prev, show: false }))
        },
        onCancel: () => {
          // Revert to previous value
          setInfoModalState(prev => ({ ...prev, show: false }))
        }
      })
      
      // Update select and direccion immediately
      setFormFn(prev => ({ ...prev, ...updates }))
    } else if (empresaDescripcion) {
      // In create mode, auto-fill info_direccion_recojo
      updates.info_direccion_recojo = empresaDescripcion
      setFormFn(prev => ({ ...prev, ...updates }))
    } else {
      // No description available, just update basic fields
      setFormFn(prev => ({ ...prev, ...updates }))
    }
  }, [empresas, mode, recojoManual])

  /**
   * Handle entrega (delivery) field changes
   * Auto-fills direccion_entrega and optionally shows InfoAdicionalModal in edit mode
   */
  const handleEntregaChange = useCallback((value, currentForm, setFormFn) => {
    if (entregaManual) {
      // In manual mode, just update the field
      setFormFn(prev => ({ ...prev, entrega: value }))
      return
    }

    // Get empresa data
    const empresaMapa = getEmpresaMapa(value, empresas) || ''
    const empresaDescripcion = getEmpresaDescripcion(value, empresas) || ''

    // Update entrega and direccion_entrega
    const updates = {
      entrega: value,
      direccion_entrega: empresaMapa
    }

    if (mode === 'edit' && empresaDescripcion) {
      // In edit mode, show modal to review and edit additional info
      const infoAnterior = currentForm.info_direccion_entrega || ''
      
      setInfoModalState({
        show: true,
        tipo: 'entrega',
        textoAnterior: infoAnterior,
        textoNuevo: empresaDescripcion,
        onAccept: (textoEditado) => {
          setFormFn(prev => ({
            ...prev,
            ...updates,
            info_direccion_entrega: textoEditado
          }))
          setInfoModalState(prev => ({ ...prev, show: false }))
        },
        onCancel: () => {
          // Revert to previous value
          setInfoModalState(prev => ({ ...prev, show: false }))
        }
      })
      
      // Update select and direccion immediately
      setFormFn(prev => ({ ...prev, ...updates }))
    } else if (empresaDescripcion) {
      // In create mode, auto-fill info_direccion_entrega
      updates.info_direccion_entrega = empresaDescripcion
      setFormFn(prev => ({ ...prev, ...updates }))
    } else {
      // No description available, just update basic fields
      setFormFn(prev => ({ ...prev, ...updates }))
    }
  }, [empresas, mode, entregaManual])

  /**
   * Close the InfoAdicionalModal
   */
  const closeInfoModal = useCallback(() => {
    setInfoModalState(prev => ({ ...prev, show: false }))
  }, [])

  return {
    handleRecojoChange,
    handleEntregaChange,
    infoModalState,
    closeInfoModal,
    setInfoModalState
  }
}

export default useAddressAutofill
