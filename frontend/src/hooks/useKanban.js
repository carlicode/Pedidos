/**
 * Hook personalizado para gestionar la lógica del Kanban board
 * @param {Array} orders - Lista de pedidos
 * @param {Function} setOrders - Función para actualizar la lista de pedidos
 * @param {Function} logToCSV - Función para registrar logs
 * @param {Function} showNotification - Función para mostrar notificaciones
 * @param {Function} setMissingDataModal - Función para mostrar modal de datos faltantes
 * @param {Function} setDeliveryModal - Función para mostrar modal de entrega
 * @returns {Object} Funciones para gestionar el Kanban
 */
import { getApiUrl } from '../utils/api.js'

export function useKanban(orders, setOrders, logToCSV, showNotification, setMissingDataModal, setDeliveryModal) {
  
  /**
   * Maneja el inicio del drag
   */
  const handleDragStart = (e, order) => {
    e.dataTransfer.setData('application/json', JSON.stringify(order))
    e.dataTransfer.effectAllowed = 'move'
  }

  /**
   * Maneja el drag over
   */
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  /**
   * Maneja cambios de estado con información adicional
   * ACTUALIZADO: Ahora usa el endpoint unificado PUT /api/orders/:id
   */
  const handleStatusChange = async (orderId, newEstado, additionalData = {}) => {
    try {
      // Obtener el pedido actual completo
      const currentOrder = orders.find(o => o.id === orderId)
      if (!currentOrder) {
        throw new Error(`Pedido #${orderId} no encontrado`)
      }
      
      // Crear objeto actualizado con el nuevo estado y datos adicionales
      const updatedOrder = {
        ...currentOrder,
        estado: newEstado,
        ...additionalData
      }
      
      console.log('🔍 [Kanban] Pedido antes de actualizar:', { id: currentOrder.id, fecha: currentOrder.fecha, estado: currentOrder.estado })
      console.log('🔍 [Kanban] Pedido después de actualizar:', { id: updatedOrder.id, fecha: updatedOrder.fecha, estado: updatedOrder.estado })
      
      // Actualizar estado localmente primero
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? updatedOrder : order
        )
      )
      
      // Actualizar en Google Sheet usando el endpoint unificado
      // Este endpoint usa internamente filterOrderForSheet para garantizar consistencia
      try {
        const response = await fetch(getApiUrl(`/api/orders/${orderId}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOrder)
        })
        
        if (response.ok) {
          const result = await response.json()
          showNotification(`✅ Pedido #${orderId} actualizado a ${newEstado} en Google Sheet`, 'success')
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error actualizando en Google Sheet')
        }
      } catch (sheetError) {
        showNotification(`⚠️ Estado actualizado localmente, pero error en Google Sheet: ${sheetError.message}`, 'warning')
      }
      
      // Log del cambio de estado
      await logToCSV('order_status_change', { 
        orderId: orderId,
        oldStatus: currentOrder.estado,
        newStatus: newEstado,
        additionalData: additionalData
      }, 'info')
      
    } catch (error) {
      showNotification(`❌ Error al cambiar estado del pedido #${orderId}`, 'error')
    }
  }

  /**
   * Maneja el drop de un pedido en una columna
   */
  const handleDrop = async (e, newEstado, setCancelModal, getBoliviaTimeString) => {
    e.preventDefault()
    
    try {
      const orderData = JSON.parse(e.dataTransfer.getData('application/json'))
      
      if (orderData.estado === newEstado) return // No cambiar si es el mismo estado
      
      // Log: Cambio de estado de pedido
      await logToCSV('order_status_change', { 
        orderId: orderData.id,
        oldStatus: orderData.estado,
        newStatus: newEstado,
        orderData: orderData
      }, 'info')
      
      // Si se mueve a "Entregado", validar datos críticos primero
      if (newEstado === 'Entregado') {
        // Verificar si faltan datos críticos
        const sinBiker = !orderData.biker || orderData.biker.trim() === '' || orderData.biker === 'ASIGNAR BIKER'
        const sinEntrega = !orderData.entrega || orderData.entrega.trim() === ''
        const sinPrecio = !orderData.precio_bs || parseFloat(orderData.precio_bs) <= 0
        const sinDistancia = !orderData.distancia_km || parseFloat(orderData.distancia_km) <= 0
        
        if (sinBiker || sinEntrega || sinPrecio || sinDistancia) {
          // Mostrar modal de advertencia
          setMissingDataModal({ show: true, order: orderData })
          return
        }
        
        // Si todos los datos están completos, abrir modal de entrega
        setDeliveryModal({ show: true, order: orderData })
        return
      }
      
      // Si se mueve a "Cancelado", abrir modal para especificar motivo
      if (newEstado === 'Cancelado') {
        setCancelModal({ show: true, order: orderData })
        return
      }
      
      // Si se mueve a "En carrera", actualizar automáticamente con hora de inicio si no la tiene
      let additionalData = {}
      if (newEstado === 'En carrera' && !orderData.hora_ini) {
        const timeString = getBoliviaTimeString() // HH:MM format en hora Bolivia
        additionalData.hora_ini = timeString
        showNotification(`🚚 Pedido en carrera - Hora de inicio: ${timeString}`, 'success')
      }
      
      showNotification(`🔄 Moviendo pedido #${orderData.id} a ${newEstado}...`, 'info')
      
      // Usar handleStatusChange para actualizar tanto local como en Google Sheet
      await handleStatusChange(orderData.id, newEstado, additionalData)
      
    } catch (err) {
      showNotification(`❌ Error al actualizar estado`, 'error')
    }
  }

  return {
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleStatusChange
  }
}

