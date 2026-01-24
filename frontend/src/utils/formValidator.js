/**
 * Validador de formularios para pedidos
 * Funciones para validar datos de formularios antes de guardar
 */

/**
 * Valida un formulario de pedido
 * @param {Object} form - Objeto del formulario a validar
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.recojoClienteAvisa - Si el recojo es "Cliente avisa"
 * @param {boolean} options.entregaClienteAvisa - Si la entrega es "Cliente avisa"
 * @returns {Array<string>} Array de mensajes de error (vacío si no hay errores)
 */
export const validateForm = (form, options = {}) => {
  const { recojoClienteAvisa = false, entregaClienteAvisa = false } = options
  const errors = []
  
  const requiredFields = {
    cliente: 'Cliente',
    medio_transporte: 'Medio de Transporte',
    metodo_pago: 'Método de Pago',
    biker: 'Biker Asignado',
    fecha: 'Fecha del Pedido',
    estado: 'Estado del Pedido',
    estado_pago: 'Estado de Pago'
  }

  // Solo requerir recojo y entrega si no está en modo "Cliente avisa"
  if (!recojoClienteAvisa) {
    requiredFields.recojo = 'Punto de Recojo'
  }
  if (!entregaClienteAvisa) {
    requiredFields.entrega = 'Punto de Entrega'
  }

  // Validar que si hay recojo/entrega, también debe haber dirección (solo si no es "Cliente avisa")
  if (form.recojo && form.recojo !== 'Cliente avisa' && !form.direccion_recojo) {
    errors.push('El punto de recojo debe tener una dirección asociada')
  }
  if (form.entrega && form.entrega !== 'Cliente avisa' && !form.direccion_entrega) {
    errors.push('El punto de entrega debe tener una dirección asociada')
  }

  // Validar campos obligatorios básicos
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!form[field] || String(form[field]).trim() === '') {
      errors.push(`${label} es obligatorio`)
    }
  }

  // Validaciones específicas
  // Removida la validación de fecha futura - ahora se permiten fechas futuras

  if (form.precio_bs && (isNaN(form.precio_bs) || parseFloat(form.precio_bs) < 0)) {
    errors.push('El precio debe ser un número mayor o igual a 0')
  }

  if (form.whatsapp && form.whatsapp.length > 0 && form.whatsapp.length < 8) {
    errors.push('El número de WhatsApp debe tener al menos 8 dígitos')
  }

  // Validar cobro/pago
  if (form.cobro_pago && form.cobro_pago.trim() !== '') {
    if (!form.monto_cobro_pago || isNaN(form.monto_cobro_pago) || parseFloat(form.monto_cobro_pago) <= 0) {
      errors.push('Si hay cobro o pago, el monto debe ser mayor a 0')
    }
  }

  return errors
}

