import React, { useState } from 'react'

const DeliveryOrderForm = ({ order, onComplete, onCancel }) => {
  const [deliveryData, setDeliveryData] = useState({
    cliente: order.cliente || '',
    recojo: order.recojo || '',
    entrega: order.entrega || '',
    biker: order.biker || '',
    precio_bs: order.precio_bs || '',
    distancia_km: order.distancia_km || '',
    medio_transporte: order.medio_transporte || '',
    hora_ini: order.hora_ini || '',
    hora_fin: '',
    observaciones: order.observaciones || ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!deliveryData.hora_fin) {
      alert('Por favor ingresa la hora de finalización')
      return
    }
    onComplete(deliveryData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setDeliveryData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="delivery-form">
      {/* Información del pedido */}
      <div className="order-info">
        <h4>📋 Información del Pedido (Editable)</h4>
        <div className="info-grid">
          <div className="info-item">
            <label>Cliente:</label>
            <input
              type="text"
              name="cliente"
              value={deliveryData.cliente}
              onChange={handleChange}
              placeholder="Nombre del cliente"
            />
          </div>
          <div className="info-item">
            <label>Punto de Recojo:</label>
            <input
              type="text"
              name="recojo"
              value={deliveryData.recojo}
              onChange={handleChange}
              placeholder="Punto de recojo"
            />
          </div>
          <div className="info-item">
            <label>Punto de Entrega:</label>
            <input
              type="text"
              name="entrega"
              value={deliveryData.entrega}
              onChange={handleChange}
              placeholder="Punto de entrega"
            />
          </div>
          <div className="info-item">
            <label>Biker:</label>
            <input
              type="text"
              name="biker"
              value={deliveryData.biker}
              onChange={handleChange}
              placeholder="Nombre del biker"
            />
          </div>
          <div className="info-item">
            <label>Precio (Bs):</label>
            <input
              type="number"
              step="0.01"
              name="precio_bs"
              value={deliveryData.precio_bs}
              onChange={handleChange}
              placeholder="0.00"
            />
          </div>
          <div className="info-item">
            <label>Distancia (Km):</label>
            <input
              type="number"
              step="0.01"
              name="distancia_km"
              value={deliveryData.distancia_km}
              onChange={handleChange}
              placeholder="0.00"
            />
          </div>
          <div className="info-item">
            <label>Medio de Transporte:</label>
            <select
              name="medio_transporte"
              value={deliveryData.medio_transporte}
              onChange={handleChange}
            >
              <option value="">Seleccionar...</option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Cargo">Cargo</option>
              <option value="Scooter">Scooter</option>
              <option value="Beezero">Beezero</option>
            </select>
          </div>
          <div className="info-item">
            <label>Hora de Inicio:</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="time"
              name="hora_ini"
              value={deliveryData.hora_ini}
              onChange={handleChange}
                style={{ flex: 1 }}
              />
              <button 
                type="button"
                onClick={() => {
                  setDeliveryData(prev => ({ ...prev, hora_ini: '' }))
                }}
                style={{
                  padding: '8px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  minWidth: '36px',
                  minHeight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Limpiar hora inicio"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Campos de entrega */}
      <div className="delivery-fields">
        <h4>✅ Completar Entrega</h4>
        <div className="form-group">
          <label>Hora de Finalización <span className="required">*</span></label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="time"
            name="hora_fin"
            value={deliveryData.hora_fin}
            onChange={handleChange}
            required
            className="field-required"
              style={{ flex: 1 }}
            />
            <button 
              type="button"
              onClick={() => {
                setDeliveryData(prev => ({ ...prev, hora_fin: '' }))
              }}
              style={{
                padding: '8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                minWidth: '36px',
                minHeight: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Limpiar hora finalización"
            >
              🗑️
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>Observación Interna <span style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'normal' }}>🔒 No se comparte con el biker</span></label>
          <textarea
            name="observaciones"
            value={deliveryData.observaciones}
            onChange={handleChange}
            placeholder="Notas internas, no visibles para el biker..."
            rows="3"
          />
        </div>
      </div>

      {/* Vista previa de la ruta */}
      <div className="route-preview">
        <h4>🛣️ Ruta Completa</h4>
        <div className="route-display">
          <span className="route-from">{deliveryData.recojo || 'Sin recojo'}</span>
          <span className="route-arrow">→</span>
          <span className="route-to">{deliveryData.entrega || 'Sin entrega'}</span>
        </div>
      </div>

      {/* Botones */}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          ❌ Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
          ✅ Completar Entrega
        </button>
      </div>
    </form>
  )
}

export default DeliveryOrderForm

