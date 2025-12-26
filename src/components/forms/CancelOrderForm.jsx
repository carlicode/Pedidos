import React, { useState } from 'react'

const CancelOrderForm = ({ order, onComplete, onCancel }) => {
  const [cancelData, setCancelData] = useState({
    motivo: order.detalles_carrera || ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!cancelData.motivo.trim()) {
      alert('Por favor ingresa el motivo de la cancelación')
      return
    }
    onComplete(cancelData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setCancelData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="cancel-form">
      {/* Información del pedido */}
      <div className="order-info">
        <h4>📋 Información del Pedido</h4>
        <div className="info-grid">
          <div className="info-item">
            <label>Cliente:</label>
            <span>{order.cliente}</span>
          </div>
          <div className="info-item">
            <label>Ruta:</label>
            <span>{order.recojo} → {order.entrega}</span>
          </div>
          <div className="info-item">
            <label>Biker:</label>
            <span>{order.biker}</span>
          </div>
          <div className="info-item">
            <label>Precio:</label>
            <span>{order.precio_bs} Bs</span>
          </div>
          <div className="info-item">
            <label>Estado Actual:</label>
            <span>{order.estado}</span>
          </div>
        </div>
      </div>

      {/* Motivo de cancelación */}
      <div className="cancel-fields">
        <h4>❌ Motivo de Cancelación</h4>
        <div className="form-group">
          <label>Motivo <span className="required">*</span></label>
          <textarea
            name="motivo"
            value={cancelData.motivo}
            onChange={handleChange}
            placeholder="Especifica el motivo de la cancelación..."
            rows="4"
            required
            className="field-required"
          />
        </div>
      </div>

      {/* Botones */}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          ❌ Cancelar
        </button>
        <button type="submit" className="btn btn-danger">
          🚫 Confirmar Cancelación
        </button>
      </div>
    </form>
  )
}

export default CancelOrderForm

