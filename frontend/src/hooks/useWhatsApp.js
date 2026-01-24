import { useState, useEffect } from 'react'
import { buildWhatsAppMessage } from '../utils/whatsAppUtils.js'

/**
 * Hook personalizado para gestionar mensajes de WhatsApp
 * @param {Object} form - Objeto con los datos del formulario del pedido
 * @returns {Object} Estado y funciones para gestionar mensajes de WhatsApp
 */
export function useWhatsApp(form) {
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [whatsappMessageEdited, setWhatsappMessageEdited] = useState(false)

  // Actualizar mensaje de WhatsApp automáticamente cuando cambien los campos relevantes
  useEffect(() => {
    // Solo actualizar si el usuario no ha editado manualmente el mensaje
    // Generar el mensaje SIEMPRE, incluso si los campos están vacíos (mostrará "Sin especificar")
    if (!whatsappMessageEdited) {
      const newMessage = buildWhatsAppMessage(form)
      setWhatsappMessage(newMessage)
    }
  }, [
    form.id, // Agregar ID para actualizar cuando se cree el pedido
    form.cliente, 
    form.recojo, 
    form.entrega, 
    form.direccion_recojo,
    form.info_direccion_recojo,
    form.direccion_entrega,
    form.info_direccion_entrega,
    form.detalles_carrera,
    form.precio_bs,
    form.metodo_pago,
    form.cobro_pago,
    form.monto_cobro_pago,
    form.descripcion_cobro_pago,
    whatsappMessageEdited
  ])

  /**
   * Actualiza el mensaje de WhatsApp manualmente
   * @param {string} message - Nuevo mensaje
   */
  const updateWhatsappMessage = (message) => {
    setWhatsappMessage(message)
    setWhatsappMessageEdited(true)
  }

  /**
   * Resetea el estado del mensaje de WhatsApp
   */
  const resetWhatsappMessage = () => {
    setWhatsappMessage('')
    setWhatsappMessageEdited(false)
  }

  return {
    whatsappMessage,
    whatsappMessageEdited,
    setWhatsappMessage: updateWhatsappMessage,
    setWhatsappMessageEdited, // Exportar también el setter directo
    resetWhatsappMessage
  }
}

