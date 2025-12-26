/**
 * Servicio para gestión de bikers
 * Maneja la carga y gestión de bikers para diferentes contextos
 */

import Papa from 'papaparse'
import { loadFromEnvCSV } from './sheetsService.js'
import { apiFetch } from '../utils/api.js'

/**
 * Carga bikers desde Google Sheets para formulario de Agregar Pedido
 * @returns {Promise<Array>} Array de bikers con estructura completa
 * @throws {Error} Si falla la carga
 */
export const loadBikersForAgregar = async () => {
  const bikersUrl = import.meta.env.VITE_BIKERS_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQ4OczeaNEWit2STNFO1e4V9aEP5JJY6TTPG3K4kRcIZhrRLLMCRIQXcccjUaL_Ltx9XTUPvE_dr9S/pub?gid=0&single=true&output=csv'

  const res = await fetch(bikersUrl, { 
    cache: 'no-store',
    mode: 'cors',
    headers: {
      'Accept': 'text/csv'
    }
  })
  
  if (!res.ok) {
    throw new Error('No se pudieron cargar los bikers')
  }
  
  const csvText = await res.text()
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  
  const bikersData = parsed.data
    .filter(row => row.Biker?.trim() || row.biker?.trim() || row.BIKER?.trim())
    .map(row => {
      const biker = {
        id: row.ID || row.id || (row.Biker || row.biker || row.BIKER),
        nombre: (row.Biker || row.biker || row.BIKER).trim(),
        telefono: row['Contacto'] || row['contacto'] || row.Telefono || row.telefono || 'N/A',
        whatsapp: row['WhatsApp'] || row['whatsapp'] || row['Whatsapp'] || 'N/A',
        linkContacto: row['Link'] || row['link'] || 'N/A'
      }
      return biker
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  
  // Agregar "ASIGNAR BIKER" como primera opción
  const bikersConAsignar = [
    {
      id: 'ASIGNAR_BIKER',
      nombre: 'ASIGNAR BIKER',
      telefono: 'N/A',
      whatsapp: 'N/A',
      linkContacto: 'N/A'
    },
    ...bikersData
  ]
  
  return bikersConAsignar
}

/**
 * Carga bikers desde Google Sheets para Agregar Nuevo
 * @returns {Promise<Array>} Array de bikers
 * @throws {Error} Si falla la carga
 */
export const loadBikersAgregar = async () => {
  const data = await loadFromEnvCSV('VITE_BIKERS_CSV_URL')
  return data
}

/**
 * Extrae bikers únicos de pedidos para cuentas
 * @param {Array} orders - Array de pedidos
 * @returns {Array} Array de bikers únicos con id y nombre
 */
export const loadBikersForCuentas = (orders) => {
  const bikersSet = new Set()
  
  orders.forEach(order => {
    const bikerName = order['Biker'] || order.biker
    const operadorName = order['Operador'] || order.operador
    const estado = order['Estado'] || order.estado
    
    // Excluir pedidos cancelados y "ASIGNAR BIKER"
    if (estado === 'Cancelado') return
    
    if (bikerName && bikerName.trim() && bikerName !== 'N/A' && bikerName !== 'ASIGNAR BIKER') {
      bikersSet.add(bikerName.trim())
    }
    if (operadorName && operadorName.trim() && operadorName !== 'N/A' && operadorName !== 'ASIGNAR BIKER') {
      bikersSet.add(operadorName.trim())
    }
  })
  
  const bikersData = Array.from(bikersSet)
    .map((nombre, index) => ({
      id: `biker-${index}`,
      nombre: nombre
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  
  return bikersData
}

/**
 * Agrega un nuevo biker
 * @param {Object} bikerData - Datos del biker
 * @param {string} bikerData.biker - Nombre del biker
 * @param {string} bikerData.whatsapp - WhatsApp del biker
 * @returns {Promise<Object>} Respuesta del servidor
 * @throws {Error} Si faltan campos requeridos o falla el servidor
 */
export const addBiker = async (bikerData) => {
  // Validar campos requeridos
  if (!bikerData.biker || !bikerData.whatsapp) {
    throw new Error('Biker y WhatsApp son campos requeridos')
  }

  // Preparar datos para enviar al servidor
  const dataToSend = {
    'Biker': bikerData.biker,
    'Whatsapp': bikerData.whatsapp
  }

  // Enviar al servidor
  const response = await apiFetch('/api/bikers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataToSend)
  })

  if (!response.ok) {
    throw new Error('Error del servidor al agregar biker')
  }

  return await response.json()
}

/**
 * Calcula cuentas de bikers filtradas por fecha
 * @param {Array} orders - Array de pedidos
 * @param {Array} bikersList - Lista de bikers a procesar
 * @param {Object} opciones - Opciones de filtrado
 * @param {string} opciones.tipo - Tipo de filtro: 'dia' o 'rango'
 * @param {string} opciones.fechaDiaria - Fecha para filtro diario (YYYY-MM-DD)
 * @param {string} opciones.fechaInicio - Fecha inicio para filtro de rango (YYYY-MM-DD)
 * @param {string} opciones.fechaFin - Fecha fin para filtro de rango (YYYY-MM-DD)
 * @param {boolean} opciones.filtroEfectivo - Si debe filtrar solo efectivo
 * @returns {Object} Objeto con datos de bikers y totales
 */
export const calcularCuentasBiker = (orders, bikersList, opciones = {}) => {
  const {
    tipo = 'dia',
    fechaDiaria,
    fechaInicio,
    fechaFin,
    filtroEfectivo = false
  } = opciones

  const esRango = tipo === 'rango'

  if (orders.length === 0) {
    throw new Error('No hay pedidos cargados')
  }

  // Validar fechas según el tipo de filtro
  if (esRango) {
    if (!fechaInicio || !fechaFin) {
      throw new Error('Por favor selecciona ambas fechas para calcular el rango')
    }
    if (fechaInicio > fechaFin) {
      throw new Error('La fecha de inicio debe ser anterior a la fecha de fin')
    }
  } else {
    if (!fechaDiaria) {
      throw new Error('Por favor selecciona una fecha para calcular las cuentas del día')
    }
  }

  // Si no hay bikers, extraerlos directamente de los pedidos
  let bikersAProcesar = bikersList
  if (!bikersAProcesar || bikersAProcesar.length === 0) {
    bikersAProcesar = loadBikersForCuentas(orders)
  }

  if (bikersAProcesar.length === 0) {
    throw new Error('No hay bikers para procesar')
  }

  // Calcular para cada biker
  const resultadosBikers = bikersAProcesar.map(biker => {
    // Filtrar pedidos del biker (excluyendo cancelados y ASIGNAR BIKER)
    let pedidosBiker = orders.filter(order => {
      const bikerEnPedido = order['Biker'] || order.biker || order['Operador'] || order.operador
      const estado = order['Estado'] || order.estado
      
      // Excluir pedidos cancelados y "ASIGNAR BIKER"
      if (estado === 'Cancelado' || bikerEnPedido === 'ASIGNAR BIKER') {
        return false
      }
      
      return bikerEnPedido === biker.nombre
    })
    
    // Filtrar pedidos por fecha
    pedidosBiker = pedidosBiker.filter(pedido => {
      const fechaPedido = pedido['Fecha Registro'] || 
                        pedido['Fechas'] || 
                        pedido.fecha ||
                        pedido['Fecha pedido']
      
      if (!fechaPedido) return false
      
      try {
        // Convertir fecha del pedido a formato normalizado (YYYY-MM-DD)
        let fechaPedidoNormalizada
        if (fechaPedido.includes('/')) {
          // Formato DD/MM/YYYY
          const [dia, mes, ano] = fechaPedido.split('/')
          fechaPedidoNormalizada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
        } else if (fechaPedido.includes('-')) {
          // Ya está en formato YYYY-MM-DD o similar
          fechaPedidoNormalizada = fechaPedido.split('T')[0] // Quitar hora si la tiene
        } else {
          // Intentar parsear como fecha
          const fecha = new Date(fechaPedido)
          if (!isNaN(fecha.getTime())) {
            fechaPedidoNormalizada = fecha.toISOString().split('T')[0]
          } else {
            return false
          }
        }
        
        // Comparar según tipo de filtro
        if (esRango) {
          return fechaPedidoNormalizada >= fechaInicio && fechaPedidoNormalizada <= fechaFin
        } else {
          return fechaPedidoNormalizada === fechaDiaria
        }
      } catch (error) {
        return false
      }
    })

    if (pedidosBiker.length === 0) {
      return null // No incluir bikers sin pedidos en el rango
    }
    
    // Calcular totales
    const totalEntregas = pedidosBiker.length
    const totalCarreras = pedidosBiker.reduce((sum, pedido) => {
      const precio = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
      return sum + precio
    }, 0)
    
    // Calcular total de carreras que SÍ se pagan al biker (excluyendo "A cuenta")
    const totalCarrerasPagables = pedidosBiker.reduce((sum, pedido) => {
      const metodoPago = pedido['Método pago pago'] || pedido.metodo_pago || 'Efectivo'
      // Excluir carreras con método "A cuenta" del pago al biker
      if (metodoPago === 'A cuenta') {
        return sum
      }
      const precio = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
      return sum + precio
    }, 0)
    
    // El pago del biker es el 70% del total de carreras PAGABLES
    const pagoBiker = totalCarrerasPagables * 0.7
    
    // Crear detalle de entregas
    const entregas = pedidosBiker.map(pedido => {
      const precioCarrera = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
      const metodoPago = pedido['Método pago pago'] || pedido.metodo_pago || 'Efectivo'
      const pagoBikerIndividual = metodoPago === 'A cuenta' ? 0 : precioCarrera * 0.7
      
      return {
        id: pedido.id || pedido.ID,
        fecha: pedido['Fechas'] || pedido.fecha || 'N/A',
        cliente: pedido['Cliente'] || pedido.cliente || 'N/A',
        precio: precioCarrera,
        metodoPago: metodoPago,
        pagoBiker: pagoBikerIndividual,
        recojo: pedido['Recojo'] || pedido.recojo || 'N/A',
        entrega: pedido['Entrega'] || pedido.entrega || 'N/A'
      }
    })
    
    return {
      biker: biker.nombre,
      totalEntregas,
      totalCarreras,
      totalCarrerasPagables,
      pagoBiker,
      entregas
    }
  }).filter(Boolean) // Filtrar bikers sin pedidos (null)

  // Calcular totales generales
  const totalesGenerales = resultadosBikers.reduce((acc, biker) => ({
    totalEntregas: acc.totalEntregas + biker.totalEntregas,
    totalCarreras: acc.totalCarreras + biker.totalCarreras,
    totalPagoBikers: acc.totalPagoBikers + biker.pagoBiker
  }), { totalEntregas: 0, totalCarreras: 0, totalPagoBikers: 0 })

  return {
    bikers: resultadosBikers,
    totales: totalesGenerales,
    periodo: esRango ? `${fechaInicio} a ${fechaFin}` : fechaDiaria
  }
}
