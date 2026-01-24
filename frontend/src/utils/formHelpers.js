// Helpers de formulario para Orders.jsx

/**
 * Función helper para limpiar campos de cobro/pago cuando se deselecciona
 */
export const clearCobroPagoFields = (cobroPago) => {
  if (!cobroPago || cobroPago.trim() === '') {
    return {
      monto_cobro_pago: '',
      descripcion_cobro_pago: ''
    }
  }
  return {}
}

/**
 * Calcula el pago total entregado por un biker
 */
export const calcularPagoTotalEntregado = (biker) => {
  // Esta función debería recibir las órdenes del biker y calcular el total
  // Por ahora retorna 0 como placeholder
  return 0
}

/**
 * Obtiene la fecha actual en formato Bolivia
 */
export const getCurrentBoliviaDate = () => {
  const now = new Date()
  const boliviaOffset = -4 * 60 // Bolivia es UTC-4
  const boliviaTime = new Date(now.getTime() + (boliviaOffset + now.getTimezoneOffset()) * 60000)
  return boliviaTime.toISOString().split('T')[0]
}
