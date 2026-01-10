import React, { useState, useEffect } from 'react'
import { cleanGoogleMapsUrl } from '../../utils/mapsUtils.js'
import { calculatePrice } from '../../utils/priceCalculator.js'
import { calculateDistance } from '../../utils/distanceCalculator.js'
import { getEmpresaMapa } from '../../utils/dataHelpers.js'

const EditOrderForm = ({ order, onComplete, onCancel, calculateDistanceWrapper, showNotification, empresas, currentOperador }) => {
  const [editData, setEditData] = useState({
    operador: currentOperador || order.operador || '', // Usar siempre el operador actual
    cliente: order.cliente || '',
    recojo: order.recojo || '',
    entrega: order.entrega || '',
    direccion_recojo: order.direccion_recojo || '',
    tiempo_espera: order.tiempo_espera || order['Tiempo de espera'] || order['Tiempo de Espera'] || '',
    info_direccion_recojo: order.info_direccion_recojo || '',
    direccion_entrega: order.direccion_entrega || '',
    info_direccion_entrega: order.info_direccion_entrega || '',
    detalles_carrera: order.detalles_carrera || '',
    distancia_km: order.distancia_km || '',
    medio_transporte: order.medio_transporte || '',
    precio_bs: order.precio_bs || '',
    metodo_pago: order.metodo_pago || '',
    estado_pago: order.estado_pago || '',
    biker: order.biker || '',
    whatsapp: order.whatsapp || '',
    fecha: order.fecha || '',
    hora_ini: order.hora_ini || '',
    hora_fin: order.hora_fin || '',
    duracion: order.duracion || '',
    estado: order.estado || '',
    observaciones: order.observaciones || '',
    pago_biker: order.pago_biker || '',
    dia_semana: order.dia_semana || '',
    cobro_pago: order.cobro_pago || '',
    monto_cobro_pago: order.monto_cobro_pago || '',
    descripcion_cobro_pago: order.descripcion_cobro_pago || ''
  })
  
  const [precioEditadoManualmente, setPrecioEditadoManualmente] = useState(false)
  
  // Función para intercambiar recojo y entrega en el formulario de edición
  const swapRecojoEntregaEdit = async () => {
    setEditData(prev => {
      const newData = {
        ...prev,
        // Intercambiar direcciones
        direccion_recojo: prev.direccion_entrega,
        direccion_entrega: prev.direccion_recojo,
        // Intercambiar info adicional
        info_direccion_recojo: prev.info_direccion_entrega,
        info_direccion_entrega: prev.info_direccion_recojo,
        // Intercambiar nombres
        recojo: prev.entrega,
        entrega: prev.recojo
      }
      
      // Recalcular distancia automáticamente después del intercambio si hay direcciones válidas
      if (newData.direccion_recojo && newData.direccion_entrega && 
          newData.direccion_recojo.includes('maps') && newData.direccion_entrega.includes('maps')) {
        setTimeout(() => {
          calculateDistanceAndPriceEdit(newData.direccion_recojo, newData.direccion_entrega, newData.medio_transporte)
        }, 100)
      }
      
      return newData
    })
    showNotification('🔄 Recojo y Entrega intercambiados', 'success')
  }
  
  // Función personalizada para calcular distancia y precio en el formulario de edición
  const calculateDistanceAndPriceEdit = async (direccionRecojo, direccionEntrega, medioTransporte) => {
    // Validar que las direcciones no estén vacías y sean URLs válidas
    if (!direccionRecojo || !direccionEntrega) {
      showNotification('⚠️ Por favor ingresa ambas direcciones (recojo y entrega)', 'warning')
      return
    }
    
    // Limpiar URLs antes de validar
    const cleanRecojo = cleanGoogleMapsUrl(direccionRecojo)
    const cleanEntrega = cleanGoogleMapsUrl(direccionEntrega)
    
    // Validar que sean URLs de Google Maps válidas
    const isValidMapsUrl = (url) => {
      if (!url || typeof url !== 'string') return false
      return url.includes('maps.app.goo.gl') || 
             url.includes('goo.gl/maps') || 
             url.includes('google.com/maps') || 
             url.includes('maps.google.com')
    }
    
    if (!isValidMapsUrl(cleanRecojo)) {
      showNotification('⚠️ La dirección de recojo debe ser un enlace válido de Google Maps', 'warning')
      return
    }
    
    if (!isValidMapsUrl(cleanEntrega)) {
      showNotification('⚠️ La dirección de entrega debe ser un enlace válido de Google Maps', 'warning')
      return
    }

    showNotification('🔄 Calculando distancia...', 'success')
    try {
      const distance = await calculateDistanceWrapper(cleanRecojo, cleanEntrega)
      
      if (distance !== null && distance > 0) {
        // Actualizar distancia en el estado local
        setEditData(prev => ({ ...prev, distancia_km: distance }))
        
        // Calcular precio si tenemos medio de transporte
        if (medioTransporte && medioTransporte.trim() !== '') {
          // Verificar si el método de pago actual es Cuenta
          const metodoPagoActual = editData.metodo_pago || 'Efectivo'
          
          // Siempre calcular el precio para guardarlo en el sheet
          const precio = calculatePrice(distance, medioTransporte)
          
          if (metodoPagoActual === 'Cuenta') {
            // Para "Cuenta", guardar el precio calculado pero mostrar "Cuenta del cliente"
            setEditData(prev => ({ 
              ...prev, 
              distancia_km: distance,
              precio_bs: precio // Guardar el precio real en el sheet
            }))
            showNotification(`📏 Distancia: ${distance} km • 💳 Precio calculado: ${precio} Bs (Cuenta del cliente)`, 'success')
          } else {
            setEditData(prev => ({ 
              ...prev, 
              distancia_km: distance,
              precio_bs: precio 
            }))
            showNotification(`📏 Distancia: ${distance} km • 💰 Precio: ${precio} Bs`, 'success')
          }
        } else {
          // Solo actualizar distancia
          setEditData(prev => ({ 
            ...prev, 
            distancia_km: distance
          }))
          showNotification(`📏 Distancia calculada: ${distance} km`, 'success')
        }
      } else {
        showNotification('⚠️ No se pudo calcular la distancia. Revisa la consola para más detalles.', 'warning')
      }
    } catch (error) {
      showNotification(`❌ Error al calcular distancia: ${error.message}`, 'error')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Siempre actualizar con el operador actual
    onComplete({ ...editData, operador: currentOperador })
  }

  const handleChange = async (e) => {
    const { name, value } = e.target
    let updatedData = { [name]: value }

    // Auto-llenar direcciones con URLs de Maps cuando se selecciona una empresa
    if (name === 'recojo') {
      const empresaMapa = getEmpresaMapa(value, empresas) || ''
      updatedData.direccion_recojo = empresaMapa
    } else if (name === 'entrega') {
      const empresaMapa = getEmpresaMapa(value, empresas) || ''
      updatedData.direccion_entrega = empresaMapa
    }
    
    // Detectar cuando el usuario edita manualmente el precio
    if (name === 'precio_bs') {
      setPrecioEditadoManualmente(true)
      // Si es modo "Cuenta", mostrar notificación especial
      if (editData.metodo_pago === 'Cuenta') {
        showNotification('✏️ Precio editado manualmente (Cuenta del cliente)', 'info')
      }
    }
    
    // Limpiar monto si se deselecciona cobro/pago
    if (name === 'cobro_pago' && (!value || value.trim() === '')) {
      updatedData.monto_cobro_pago = ''
    }
    
    // Actualizar el formulario - SIN auto-cálculos
    setEditData(prev => ({ ...prev, ...updatedData }))
  }

  // Actualizar datos cuando cambie el order
  useEffect(() => {
    const tiempoEsperaValue = order.tiempo_espera || order['Tiempo de espera'] || order['Tiempo de Espera'] || ''

    const newEditData = {
      operador: order.operador || '',
      cliente: order.cliente || '',
      recojo: order.recojo || '',
      entrega: order.entrega || '',
      direccion_recojo: order.direccion_recojo || '',
      tiempo_espera: tiempoEsperaValue,
      info_direccion_recojo: order.info_direccion_recojo || '',
      direccion_entrega: order.direccion_entrega || '',
      info_direccion_entrega: order.info_direccion_entrega || '',
      detalles_carrera: order.detalles_carrera || '',
      distancia_km: order.distancia_km || '',
      medio_transporte: order.medio_transporte || '',
      precio_bs: order.precio_bs || '',
      metodo_pago: order.metodo_pago || '',
      estado_pago: order.estado_pago || '',
      biker: order.biker || '',
      whatsapp: order.whatsapp || '',
      fecha: order.fecha || '',
      hora_ini: order.hora_ini || '',
      hora_fin: order.hora_fin || '',
      duracion: order.duracion || '',
      estado: order.estado || '',
      observaciones: order.observaciones || '',
      pago_biker: order.pago_biker || '',
      dia_semana: order.dia_semana || '',
      cobro_pago: order.cobro_pago || '',
      monto_cobro_pago: order.monto_cobro_pago || '',
      descripcion_cobro_pago: order.descripcion_cobro_pago || ''
    }

    setEditData(newEditData)
  }, [order])

  return (
    <form onSubmit={handleSubmit} className="edit-form" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
      {/* Información de Registro (Solo lectura) */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        border: '2px solid #dee2e6', 
        borderRadius: '8px', 
        padding: '16px', 
        marginBottom: '20px' 
      }}>
        <h4 style={{ marginBottom: '12px', color: '#6c757d' }}>📋 Información de Registro</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: '#6c757d' }}>ID:</label>
            <input 
              type="text" 
              value={order.id || ''} 
              readOnly 
              disabled 
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px', 
                backgroundColor: '#e9ecef', 
                color: '#495057',
                cursor: 'not-allowed'
              }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: '#6c757d' }}>Fecha Registro:</label>
            <input 
              type="text" 
              value={order.fecha_registro || order['Fecha Registro'] || ''} 
              readOnly 
              disabled 
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px', 
                backgroundColor: '#e9ecef', 
                color: '#495057',
                cursor: 'not-allowed'
              }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: '#6c757d' }}>Hora Registro:</label>
            <input 
              type="text" 
              value={order.hora_registro || order['Hora Registro'] || ''} 
              readOnly 
              disabled 
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px', 
                backgroundColor: '#e9ecef', 
                color: '#495057',
                cursor: 'not-allowed'
              }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Operador:</label>
            <input 
              type="text" 
              name="operador" 
              value={currentOperador || editData.operador} 
              readOnly
              disabled
              style={{ 
                width: '100%', 
                padding: '8px', 
                marginTop: '5px',
                backgroundColor: '#e9ecef',
                color: '#495057',
                cursor: 'not-allowed'
              }} 
              title={`Se actualizará automáticamente a: ${currentOperador}`}
            />
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              ℹ️ El operador se actualizará automáticamente al usuario actual ({currentOperador})
            </small>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {/* Columna Izquierda */}
        <div>
          <h4>📋 Información Básica</h4>
          <div style={{ marginBottom: '15px' }}>
            <label>Cliente:</label>
            <input type="text" name="cliente" value={editData.cliente} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
              </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Recojo:</label>
            <input type="text" name="recojo" value={editData.recojo} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Entrega:</label>
            <input type="text" name="entrega" value={editData.entrega} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Dirección Recojo:</label>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <input type="text" name="direccion_recojo" value={editData.direccion_recojo} onChange={handleChange} style={{ flex: 1, padding: '8px', marginTop: '5px' }} />
              {editData.direccion_recojo && (
                <a 
                  href={editData.direccion_recojo} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  title="Ver en Maps"
                  style={{
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📍 Maps
                </a>
              )}
              {editData.direccion_recojo && editData.direccion_entrega && (
                <button
                  type="button"
                  onClick={() => calculateDistanceAndPriceEdit(editData.direccion_recojo, editData.direccion_entrega, editData.medio_transporte)}
                  title="Calcular Distancia"
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📏 Calcular
                </button>
              )}
              {(editData.direccion_recojo || editData.recojo) && (editData.direccion_entrega || editData.entrega) && (
                <button
                  type="button"
                  onClick={swapRecojoEntregaEdit}
                  title="Intercambiar Recojo y Entrega"
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px'
                  }}
                >
                  ⇅
                </button>
              )}
            </div>
        </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Info. Dirección Recojo:</label>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <input type="text" name="info_direccion_recojo" value={editData.info_direccion_recojo} onChange={handleChange} placeholder="Información adicional (ej: Local 6, Piso 2)" style={{ flex: 1, padding: '8px', marginTop: '5px', backgroundColor: '#f8f9fa' }} />
              {(editData.direccion_recojo || editData.recojo) && (editData.direccion_entrega || editData.entrega) && (
                <button
                  type="button"
                  onClick={swapRecojoEntregaEdit}
                  title="Intercambiar Recojo y Entrega"
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px'
                  }}
                >
                  ⇅
                </button>
              )}
            </div>
        </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Dirección Entrega:</label>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <input type="text" name="direccion_entrega" value={editData.direccion_entrega} onChange={handleChange} style={{ flex: 1, padding: '8px', marginTop: '5px' }} />
              {editData.direccion_entrega && (
                <a 
                  href={editData.direccion_entrega} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  title="Ver en Maps"
                  style={{
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📍 Maps
                </a>
              )}
              {editData.direccion_recojo && editData.direccion_entrega && (
                <button
                  type="button"
                  onClick={() => calculateDistanceAndPriceEdit(editData.direccion_recojo, editData.direccion_entrega, editData.medio_transporte)}
                  title="Calcular Distancia"
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📏 Calcular
                </button>
              )}
              {(editData.direccion_recojo || editData.recojo) && (editData.direccion_entrega || editData.entrega) && (
                <button
                  type="button"
                  onClick={swapRecojoEntregaEdit}
                  title="Intercambiar Recojo y Entrega"
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px'
                  }}
                >
                  ⇅
                </button>
              )}
            </div>
              </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Info. Dirección Entrega:</label>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <input type="text" name="info_direccion_entrega" value={editData.info_direccion_entrega} onChange={handleChange} placeholder="Información adicional (ej: Local 6, Piso 2)" style={{ flex: 1, padding: '8px', marginTop: '5px', backgroundColor: '#f8f9fa' }} />
              {(editData.direccion_recojo || editData.recojo) && (editData.direccion_entrega || editData.entrega) && (
                <button
                  type="button"
                  onClick={swapRecojoEntregaEdit}
                  title="Intercambiar Recojo y Entrega"
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '5px'
                  }}
                >
                  ⇅
                </button>
              )}
            </div>
              </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Detalles de la Carrera:</label>
            <textarea name="detalles_carrera" value={editData.detalles_carrera} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px', height: '60px' }} />
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Distancia (Km):</label>
            <input type="text" name="distancia_km" value={editData.distancia_km} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
              </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Medio de Transporte:</label>
            <input type="text" name="medio_transporte" value={editData.medio_transporte} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Precio (Bs):</label>
            <input type="text" name="precio_bs" value={editData.precio_bs} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Método de Pago:</label>
            <input type="text" name="metodo_pago" value={editData.metodo_pago} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
        </div>

        {/* Columna Derecha */}
        <div>
          <h4>🚴‍♂️ Biker y Horarios</h4>
          <div style={{ marginBottom: '15px' }}>
            <label>Biker:</label>
            <input type="text" name="biker" value={editData.biker} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>WhatsApp:</label>
            <input type="text" name="whatsapp" value={editData.whatsapp} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Fecha:</label>
            <input type="text" name="fecha" value={editData.fecha} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Hora Inicio:</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
              <input 
                type="time" 
                name="hora_ini" 
                value={editData.hora_ini} 
                onChange={handleChange} 
                style={{ flex: 1, padding: '8px' }} 
              />
              <button 
                type="button"
                onClick={() => {
                  setEditData(prev => ({ ...prev, hora_ini: '' }))
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
          <div style={{ marginBottom: '15px' }}>
            <label>Hora Fin:</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
              <input 
                type="time" 
                name="hora_fin" 
                value={editData.hora_fin} 
                onChange={handleChange} 
                style={{ flex: 1, padding: '8px' }} 
              />
              <button 
                type="button"
                onClick={() => {
                  setEditData(prev => ({ ...prev, hora_fin: '' }))
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
                title="Limpiar hora fin"
              >
                🗑️
              </button>
            </div>
            </div>
          <div style={{ marginBottom: '15px', border: '2px solid red', padding: '10px', backgroundColor: '#fff3cd' }}>
            <label style={{ fontWeight: 'bold', color: '#856404' }}>Tiempo de Espera:</label>
            <input 
              type="text" 
              name="tiempo_espera" 
              value={editData.tiempo_espera || ''} 
              onChange={handleChange} 
              placeholder="Ej: 15 min" 
              style={{ width: '100%', padding: '8px', marginTop: '5px', border: '2px solid #ffc107' }} 
            />
            <small style={{ color: '#856404', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              DEBUG: Valor actual = "{editData.tiempo_espera || '(vacío)'}"
            </small>
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Duración:</label>
            <input type="text" name="duracion" value={editData.duracion} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          
          <h4 style={{ marginTop: '30px', marginBottom: '15px' }}>📊 Información Adicional</h4>
          <div style={{ marginBottom: '15px' }}>
            <label>Estado de Pago:</label>
            <input type="text" name="estado_pago" value={editData.estado_pago} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Estado:</label>
            <input type="text" name="estado" value={editData.estado} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
              </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Pago Biker:</label>
            <input type="text" name="pago_biker" value={editData.pago_biker} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Día de la Semana:</label>
            <input type="text" name="dia_semana" value={editData.dia_semana} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
              </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Cobro o Pago:</label>
            <input type="text" name="cobro_pago" value={editData.cobro_pago} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Monto Cobro o Pago:</label>
            <input type="text" name="monto_cobro_pago" value={editData.monto_cobro_pago} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Descripción de cobro o pago:</label>
            <input type="text" name="descripcion_cobro_pago" value={editData.descripcion_cobro_pago} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Observación Interna:</label>
            <small style={{ color: '#6c757d', fontSize: '12px', display: 'block', marginTop: '2px' }}>🔒 No se comparte con el biker</small>
            <textarea name="observaciones" value={editData.observaciones} onChange={handleChange} placeholder="Notas internas, no visibles para el biker..." style={{ width: '100%', padding: '8px', marginTop: '5px', height: '60px' }} />
          </div>
        </div>
      </div>

      {/* Botones */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '10px 20px' }}>
          ❌ Cancelar
        </button>
        <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
          ✅ Guardar Cambios
        </button>
      </div>
    </form>
  )
}

export default EditOrderForm

