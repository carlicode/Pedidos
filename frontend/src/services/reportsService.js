/**
 * Servicio para generación de reportes
 * Maneja la generación de PDFs y otros reportes
 */

/**
 * NOTA: La función generatePDFResumen es muy extensa y tiene múltiples dependencias
 * del componente Orders (showNotification, jsPDF, html2canvas, etc.).
 * 
 * Para una refactorización mínima, se mantiene en Orders.jsx.
 * Una refactorización más profunda requeriría:
 * - Extraer toda la lógica de generación de PDF a este servicio
 * - Pasar las dependencias (toast, notificaciones) como parámetros
 * - Crear componentes React separados para las plantillas de PDF
 */

/**
 * Filtra pedidos por rango de fechas para reportes
 * @param {Array} pedidos - Array de pedidos
 * @param {string} fechaInicio - Fecha de inicio (YYYY-MM-DD o null)
 * @param {string} fechaFin - Fecha de fin (YYYY-MM-DD o null)
 * @returns {Array} Pedidos filtrados
 */
export const filtrarPedidosParaPDF = (pedidos, fechaInicio = null, fechaFin = null) => {
  if (!fechaInicio && !fechaFin) {
    return pedidos
  }

  return pedidos.filter(pedido => {
    if (!pedido.fecha) return false
    
    const pedidoFecha = new Date(pedido.fecha)
    const inicio = fechaInicio ? new Date(fechaInicio) : null
    const fin = fechaFin ? new Date(fechaFin) : null
    
    if (inicio && fin) {
      return pedidoFecha >= inicio && pedidoFecha <= fin
    } else if (inicio) {
      return pedidoFecha >= inicio
    } else if (fin) {
      return pedidoFecha <= fin
    }
    return true
  })
}

/**
 * Calcula totales de cobros, pagos y carreras
 * @param {Array} pedidos - Array de pedidos
 * @returns {Object} Objeto con totales calculados
 */
export const calcularTotalesResumen = (pedidos) => {
  // Cobros: dinero que el biker cobró por servicios/productos vendidos
  const totalCobros = pedidos
    .filter(p => p.cobro_pago === 'Cobro')
    .reduce((sum, p) => sum + (parseFloat(p.monto_cobro_pago) || 0), 0)
  
  // Pagos: dinero que el biker pagó en nombre del cliente
  const totalPagos = pedidos
    .filter(p => p.cobro_pago === 'Pago')
    .reduce((sum, p) => sum + (parseFloat(p.monto_cobro_pago) || 0), 0)
  
  // Carreras: precio del servicio de delivery
  const totalCarreras = pedidos
    .filter(p => p.precio_bs && parseFloat(p.precio_bs) > 0)
    .reduce((sum, p) => sum + (parseFloat(p.precio_bs) || 0), 0)
  
  return {
    subtotalCobros: totalCobros,
    subtotalPagos: totalPagos,
    subtotalCarreras: totalCarreras
  }
}

/**
 * Calcula el total general con descuento
 * @param {Object} totales - Objeto con subtotales
 * @param {number} porcentajeDescuento - Porcentaje de descuento (0-100)
 * @returns {Object} Objeto con totales y descuento aplicado
 */
export const calcularTotalConDescuento = (totales, porcentajeDescuento = 0) => {
  const { subtotalCobros, subtotalPagos, subtotalCarreras } = totales
  
  // Subtotal General = Carreras + Pagos - Cobros
  const subtotalGeneral = subtotalCarreras + subtotalPagos - subtotalCobros
  
  // Aplicar descuento solo a las carreras
  const montoDescuento = (subtotalCarreras * porcentajeDescuento) / 100
  
  // Total final con descuento
  const totalFinal = subtotalGeneral - montoDescuento
  
  return {
    subtotalGeneral,
    montoDescuento,
    porcentajeDescuento,
    totalFinal
  }
}
