/**
 * Utilidades para generar mensajes y URLs de WhatsApp
 */

/**
 * Construye un mensaje de WhatsApp formateado para enviar al biker
 * @param {Object} order - Objeto con los datos del pedido
 * @returns {string} Mensaje formateado para WhatsApp
 */
export const buildWhatsAppMessage = (order) => {
  // Obtener solo el nombre del cliente (sin la descripción completa)
  const clienteNombre = order.cliente || 'Sin especificar'
  
  const recojo = order.recojo || 'Sin especificar'
  const direccionRecojo = order.direccion_recojo || 'Sin dirección'
  const infoRecojo = order.info_direccion_recojo || ''
  
  // Formatear el recojo correctamente
  let recojoCompleto = recojo
  if (recojo === 'Cliente avisa') {
    recojoCompleto = 'Cliente avisa'
  } else if (direccionRecojo && direccionRecojo !== 'Sin dirección') {
    if (direccionRecojo.includes('http')) {
      recojoCompleto = `${recojo}: ${direccionRecojo}`
    } else {
      recojoCompleto = `${recojo}: ${direccionRecojo}`
    }
  }
  
  // Agregar información adicional de recojo si existe (en línea separada)
  if (infoRecojo) {
    recojoCompleto += `\nInfo Recoger: ${infoRecojo}`
  }
  
  const entrega = order.entrega || 'Sin especificar'
  const direccionEntrega = order.direccion_entrega || ''
  const infoEntrega = order.info_direccion_entrega || ''
  
  // Formatear la entrega
  let entregaCompleta = entrega
  if (entrega === 'Cliente avisa') {
    entregaCompleta = 'Cliente avisa'
  } else if (direccionEntrega && direccionEntrega.includes('http')) {
    entregaCompleta = `${entrega}: ${direccionEntrega}`
  }
  
  // Agregar información adicional de entrega si existe (en línea separada)
  if (infoEntrega) {
    entregaCompleta += `\nInfo Entrega: ${infoEntrega}`
  }
  
  const infoExtra = order.detalles_carrera || ''
  const metodoPago = order.metodo_pago || 'Efectivo'
  
  // Construir el mensaje base
  let mensaje = `🐝 Beezy dice: 

CLIENTE: ${clienteNombre}

Recoger: ${recojoCompleto}

Entrega: ${entregaCompleta}

Info Extra: ${infoExtra}

Carrera: `
  
  // Agregar precio y método de pago para Carrera
  if (metodoPago === 'Cuenta' || metodoPago === 'cuenta' || metodoPago.toLowerCase() === 'cuenta' || 
      metodoPago === 'A cuenta' || metodoPago === 'a cuenta' || metodoPago.toLowerCase() === 'a cuenta') {
    // Para "Cuenta" o "A cuenta", solo mostrar el método sin precio
    mensaje += `${metodoPago}`
  } else if (order.precio_bs) {
    // Para otros métodos, mostrar precio y método
    const precio = parseFloat(order.precio_bs) || 0
    mensaje += `Bs ${precio.toFixed(2)} - ${metodoPago}`
  } else {
    // Si no hay precio, solo mostrar método
    mensaje += `${metodoPago}`
  }
  
  // Agregar cobro/pago si existe
  if (order.cobro_pago && order.cobro_pago.trim() !== '' && order.monto_cobro_pago) {
    const montoCobro = parseFloat(order.monto_cobro_pago) || 0
    mensaje += `\n\n${order.cobro_pago.toUpperCase()}: Bs ${montoCobro.toFixed(2)}`
    
    // Agregar descripción de cobro o pago si existe
    if (order.descripcion_cobro_pago && order.descripcion_cobro_pago.trim() !== '') {
      mensaje += `\n📝 ${order.descripcion_cobro_pago}`
    }
  }
  
  return mensaje
}

/**
 * Genera una URL de WhatsApp para enviar un mensaje al biker
 * @param {Object} order - Objeto con los datos del pedido
 * @param {Array} bikersAgregar - Lista de bikers disponibles con sus datos de WhatsApp
 * @param {string|null} customMessage - Mensaje personalizado (opcional)
 * @returns {string} URL completa de WhatsApp
 */
export const generateWhatsAppURL = (order, bikersAgregar = [], customMessage = null) => {
  // Obtener el número de WhatsApp del biker asignado
  let phoneNumber = '59169499202' // Número por defecto si no hay biker
  
  if (order.biker) {
    const selectedBiker = bikersAgregar.find(biker => (biker.nombre || biker) === order.biker)
    if (selectedBiker && selectedBiker.whatsapp && selectedBiker.whatsapp !== 'N/A') {
      // Limpiar el número de WhatsApp (remover espacios, guiones, etc.)
      phoneNumber = selectedBiker.whatsapp.replace(/[\s\-\(\)]/g, '')
    } else if (order.whatsapp && order.whatsapp.trim()) {
      // Usar el WhatsApp del formulario como fallback
      phoneNumber = order.whatsapp.replace(/[\s\-\(\)]/g, '')
    }
  }
  
  // Usar el mensaje personalizado si existe, sino construir uno nuevo
  const mensaje = customMessage || buildWhatsAppMessage(order)

  // Codificar el mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje)
  
  // Generar la URL completa
  const whatsappURL = `https://api.whatsapp.com/send/?phone=${phoneNumber}&text=${mensajeCodificado}`
  
  return whatsappURL
}

