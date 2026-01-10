import React from 'react'

/**
 * Modal que muestra los datos faltantes de un pedido antes de marcarlo como entregado
 * @param {boolean} show - Si el modal debe mostrarse
 * @param {Object} order - El pedido con datos faltantes
 * @param {Function} onClose - Callback para cerrar el modal
 * @param {Function} onEdit - Callback para editar el pedido
 */
export default function MissingDataModal({ show, order, onClose, onEdit }) {
  if (!show || !order) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
        <div className="modal-header">
          <h3>⚠️ Datos Faltantes</h3>
          <button 
            className="modal-close" 
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.6' }}>
            El pedido <strong>#{order.id}</strong> no puede marcarse como entregado porque faltan datos críticos:
          </p>
          
          <div style={{
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
              {(!order.biker || order.biker.trim() === '' || order.biker === 'ASIGNAR BIKER') && (
                <li style={{ marginBottom: '8px' }}>❌ <strong>Biker asignado</strong></li>
              )}
              {(!order.entrega || order.entrega.trim() === '') && (
                <li style={{ marginBottom: '8px' }}>❌ <strong>Lugar de entrega</strong></li>
              )}
              {(!order.precio_bs || parseFloat(order.precio_bs) <= 0) && (
                <li style={{ marginBottom: '8px' }}>❌ <strong>Precio (Bs)</strong></li>
              )}
              {(!order.distancia_km || parseFloat(order.distancia_km) <= 0) && (
                <li style={{ marginBottom: '8px' }}>❌ <strong>Distancia (Km)</strong></li>
              )}
            </ul>
          </div>
          
          <p style={{ marginBottom: '20px', fontSize: '15px', color: '#6c757d' }}>
            Por favor, edita el pedido primero para completar estos campos antes de marcarlo como entregado.
          </p>
          
          <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-secondary" 
              onClick={onClose}
              style={{ padding: '10px 20px' }}
            >
              Cerrar
            </button>
            <button 
              className="btn btn-primary" 
              onClick={onEdit}
              style={{ padding: '10px 20px' }}
            >
              ✏️ Editar Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

