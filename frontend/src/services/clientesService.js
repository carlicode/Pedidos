/**
 * Servicio para gestión de clientes y empresas
 * Maneja la carga y gestión de clientes, empresas y cobros/pagos
 */

import Papa from 'papaparse'
import { loadFromEnvCSV } from './sheetsService.js'
import { apiFetch } from '../utils/api.js'
import { getBoliviaDateTime } from '../utils/dateUtils.js'

/**
 * Carga clientes desde el backend (que a su vez lee los CSVs)
 * @returns {Promise<Object>} Objeto con arrays de empresas y clientes
 * @throws {Error} Si falla la carga
 */
export const loadClientes = async () => {
  try {
    const response = await apiFetch('/api/clientes-empresas')
    
    if (!response.ok) {
      throw new Error('No se pudieron cargar los clientes')
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Error al cargar clientes')
    }
    
    return {
      empresas: data.empresas || [],
      clientes: data.clientes || []
    }
  } catch (error) {
    console.error('Error loading clientes:', error)
    throw new Error('No se pudieron cargar los clientes: ' + error.message)
  }
}

/**
 * Carga empresas desde el backend para Agregar Nuevo
 * @returns {Promise<Array>} Array de empresas
 * @throws {Error} Si falla la carga
 */
export const loadEmpresas = async () => {
  try {
    const response = await apiFetch('/api/clientes-empresas')
    
    if (!response.ok) {
      throw new Error('No se pudieron cargar las empresas')
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Error al cargar empresas')
    }
    
    return data.empresas || []
  } catch (error) {
    console.error('Error loading empresas:', error)
    throw new Error('No se pudieron cargar las empresas: ' + error.message)
  }
}

/**
 * Agrega una nueva empresa
 * @param {Object} empresaData - Datos de la empresa
 * @param {string} empresaData.empresa - Nombre de la empresa
 * @param {string} empresaData.mapa - URL del mapa
 * @param {string} empresaData.descripcion - Descripción
 * @param {string} empresaData.operador - Operador (opcional)
 * @param {string} operadorDefault - Operador por defecto
 * @returns {Promise<Object>} Respuesta del servidor
 * @throws {Error} Si faltan campos requeridos o falla el servidor
 */
export const addEmpresa = async (empresaData, operadorDefault = '') => {
  // Validar campos requeridos
  if (!empresaData.empresa || !empresaData.descripcion) {
    throw new Error('Empresa y Descripción son campos requeridos')
  }

  // Siempre usar la fecha actual de Bolivia
  const { fechaRegistro } = getBoliviaDateTime()
  const fecha = fechaRegistro

  // Obtener operador actual si no se proporcionó
  const operador = empresaData.operador || operadorDefault

  // Preparar datos para enviar al servidor en el orden: Fecha, Operador, Empresa, Mapa, Descripción
  const dataToSend = {
    'Fecha': fecha,
    'Operador': operador,
    'Empresa': empresaData.empresa,
    'Mapa': empresaData.mapa || '',
    'Descripción': empresaData.descripcion
  }

  // Enviar al servidor
  const response = await apiFetch('/api/empresas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataToSend)
  })

  if (!response.ok) {
    throw new Error('Error del servidor al agregar empresa')
  }

  return await response.json()
}

/**
 * Calcula datos de cobros y pagos por cliente
 * @param {Array} orders - Array de pedidos
 * @param {Object} descuentosClientes - Objeto con descuentos por cliente
 * @returns {Array} Array de datos de clientes con información financiera
 */
export const calculateCobrosPagos = (orders, descuentosClientes = {}) => {
  // Agrupar TODOS los pedidos por cliente
  const clientesData = {}
  
  orders.forEach(pedido => {
    const cliente = pedido.cliente || 'Sin Cliente'
    
    if (!clientesData[cliente]) {
      clientesData[cliente] = {
        cliente: cliente,
        totalCobros: 0,      // Lo que el cliente nos debe pagar (adicional a carreras)
        totalPagos: 0,       // Lo que el cliente ya pagó
        totalCarreras: 0,    // Valor total de todas las carreras realizadas
        saldoFinal: 0,       // Balance final (carreras + cobros - pagos)
        pedidos: [],         // Todos los pedidos del cliente
        cobrosExtras: [],    // Solo pedidos con cobros adicionales
        pagosRealizados: []  // Solo pedidos con pagos
      }
    }
    
    // Agregar el pedido a la lista del cliente
    clientesData[cliente].pedidos.push(pedido)
    
    // Sumar el precio de la carrera (siempre se suma)
    const precioCarrera = parseFloat(pedido.precio_bs) || 0
    clientesData[cliente].totalCarreras += precioCarrera
    
    // Procesar cobros y pagos adicionales si existen
    if (pedido.cobro_pago && pedido.cobro_pago.trim() !== '') {
      const monto = parseFloat(pedido.monto_cobro_pago) || 0
    
      if (pedido.cobro_pago === 'Cobro') {
        clientesData[cliente].totalCobros += monto
        clientesData[cliente].cobrosExtras.push({
          id: pedido.id,
          fecha: pedido.fecha,
          monto: monto,
          descripcion: pedido.observaciones || 'Cobro adicional'
        })
      } else if (pedido.cobro_pago === 'Pago') {
        clientesData[cliente].totalPagos += monto
        clientesData[cliente].pagosRealizados.push({
          id: pedido.id,
          fecha: pedido.fecha,
          monto: monto,
          descripcion: pedido.observaciones || 'Pago realizado'
        })
      }
    }
  })
  
  // Calcular saldo final para cada cliente
  Object.values(clientesData).forEach(cliente => {
    // Subtotal General = Carreras + Pagos - Cobros
    const subtotalGeneral = cliente.totalCarreras + cliente.totalPagos - cliente.totalCobros
    
    // Aplicar descuento solo a las carreras (como porcentaje)
    const porcentajeDescuento = descuentosClientes[cliente.cliente] || 0
    const montoDescuento = (cliente.totalCarreras * porcentajeDescuento) / 100
    
    // Saldo final con descuento aplicado solo a las carreras
    cliente.saldoFinal = subtotalGeneral - montoDescuento
  })
  
  // Filtrar solo clientes que tienen actividad (carreras, cobros o pagos)
  const clientesConActividad = Object.values(clientesData).filter(cliente => 
    cliente.totalCarreras > 0 || cliente.totalCobros > 0 || cliente.totalPagos > 0
  )
  
  return clientesConActividad
}

/**
 * Filtra pedidos por rango de fechas
 * @param {Array} pedidos - Array de pedidos
 * @param {string} fechaInicio - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} fechaFin - Fecha de fin en formato YYYY-MM-DD
 * @returns {Array} Array de pedidos filtrados
 */
export const filtrarPedidosPorFecha = (pedidos, fechaInicio, fechaFin) => {
  if (!fechaInicio && !fechaFin) {
    return pedidos
  }
  
  return pedidos.filter(pedido => {
    const fechaPedido = pedido.fecha || pedido['Fecha Registro'] || pedido['Fechas'] || ''
    if (!fechaPedido || fechaPedido === 'N/A') return false
    
    // Convertir fecha del pedido a formato comparable
    let fechaPedidoDate = null
    try {
      // Intentar parsear diferentes formatos
      if (fechaPedido.includes('/')) {
        // Formato DD/MM/YYYY
        const [day, month, year] = fechaPedido.split('/')
        fechaPedidoDate = new Date(year, month - 1, day)
      } else if (fechaPedido.includes('-')) {
        // Formato YYYY-MM-DD
        fechaPedidoDate = new Date(fechaPedido)
      } else {
        return false
      }
      
      if (isNaN(fechaPedidoDate.getTime())) return false
      
      // Convertir a formato YYYY-MM-DD para comparación
      const fechaPedidoStr = fechaPedidoDate.toISOString().split('T')[0]
      
      // Comparar con rango
      if (fechaInicio && fechaFin) {
        return fechaPedidoStr >= fechaInicio && fechaPedidoStr <= fechaFin
      } else if (fechaInicio) {
        return fechaPedidoStr >= fechaInicio
      } else if (fechaFin) {
        return fechaPedidoStr <= fechaFin
      }
      
      return true
    } catch (error) {
      return false
    }
  })
}
