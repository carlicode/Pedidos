import { useState } from 'react'
import Icon from './Icon'
import { toast } from 'react-toastify'

/**
 * Componente modular para el formulario de creación de pedidos de clientes
 * Usa los mismos estilos que Orders.jsx para consistencia
 */
export default function FormularioPedidoCliente({ 
  isOpen, 
  onClose, 
  onSuccess, 
  cliente 
}) {
  const [enviando, setEnviando] = useState(false)
  const [calculandoDistancia, setCalculandoDistancia] = useState(false)
  const DISTANCE_BUFFER_KM = 0.025
  const TIPOS_COBRO_PAGO = ['', 'Cobro', 'Pago']
  const twoColumnRowStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  }
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    direccionRecojo: '',
    infoAdicionalRecojo: '',
    direccionEntrega: '',
    infoAdicionalEntrega: '',
    detallesCarrera: '',
    distanciaKm: '',
    precioBs: '',
    fechaDeseada: '',
    horaDeseada: '',
    cobroPago: '',
    montoCobroPago: '',
    descripcionCobroPago: ''
  })

  /**
   * Limpiar y validar URL de Google Maps
   * Extrae solo la URL válida si está concatenada o malformada
   */
  const limpiarUrlGoogleMaps = (url) => {
    if (!url || typeof url !== 'string') return url
    
    // Limpiar espacios
    let urlLimpia = url.trim()
    
    // Detectar si hay múltiples URLs concatenadas (ej: https://maps.app.goo.gl/191https://maps.app.goo.gl/...)
    // Buscar patrones de URLs de Google Maps
    const patronesUrl = [
      /https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+/g,
      /https?:\/\/goo\.gl\/maps\/[a-zA-Z0-9_-]+/g,
      /https?:\/\/www\.google\.com\/maps\/[^\s]+/g,
      /https?:\/\/maps\.google\.com\/[^\s]+/g
    ]
    
    // Buscar todas las URLs válidas en el texto
    const urlsEncontradas = []
    patronesUrl.forEach(patron => {
      const matches = urlLimpia.match(patron)
      if (matches) {
        urlsEncontradas.push(...matches)
      }
    })
    
    // Si encontramos múltiples URLs, usar la primera completa y válida
    if (urlsEncontradas.length > 0) {
      // Si hay múltiples URLs, la primera suele ser la correcta
      const urlSeleccionada = urlsEncontradas[0]
      
      // Verificar si la URL está malformada (tiene otra URL dentro)
      // Ejemplo: https://maps.app.goo.gl/191https://maps.app.goo.gl/...
      if (urlSeleccionada.includes('https://') && urlSeleccionada.split('https://').length > 2) {
        // Extraer solo la primera URL completa
        const primeraUrl = urlSeleccionada.split('https://')[0] + 'https://' + urlSeleccionada.split('https://')[1]
        // Buscar dónde termina realmente la primera URL
        const matchPrimera = primeraUrl.match(/https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+/)
        if (matchPrimera) {
          console.log('🔗 URL limpiada (múltiples URLs detectadas):', matchPrimera[0], 'de:', urlLimpia)
          return matchPrimera[0]
        }
      }
      
      console.log('🔗 URL limpiada:', urlSeleccionada, 'de:', urlLimpia)
      return urlSeleccionada
    }
    
    // Si no encontramos patrón válido, pero parece una URL, intentar limpiar
    if (urlLimpia.includes('maps.app.goo.gl') || urlLimpia.includes('goo.gl/maps')) {
      // Buscar la primera ocurrencia de una URL válida
      const match = urlLimpia.match(/(https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+)/)
      if (match) {
        console.log('🔗 URL extraída:', match[1], 'de:', urlLimpia)
        return match[1]
      }
    }
    
    return urlLimpia
  }

  const actualizarCampo = (campo, valor) => {
    if (campo === 'direccionRecojo' || campo === 'direccionEntrega') {
      const valorLimpio = limpiarUrlGoogleMaps(valor)
      setFormData(prev => ({ ...prev, [campo]: valorLimpio }))
      return
    }

    if (campo === 'cobroPago') {
      setFormData(prev => ({
        ...prev,
        cobroPago: valor,
        ...(valor ? {} : { montoCobroPago: '', descripcionCobroPago: '' })
      }))
      return
    }

    setFormData(prev => ({ ...prev, [campo]: valor }))
  }

  /**
   * Calcular distancia usando Google Maps
   */
  const calcularDistancia = async () => {
    if (!formData.direccionRecojo || !formData.direccionEntrega) {
      toast.warning('Ingresa ambos links de Google Maps para calcular la distancia')
      return
    }

    try {
      setCalculandoDistancia(true)
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      const proxyUrl = `${backendUrl}/api/distance-proxy?origins=${encodeURIComponent(formData.direccionRecojo)}&destinations=${encodeURIComponent(formData.direccionEntrega)}`
      const response = await fetch(proxyUrl)
      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo calcular la distancia con los links proporcionados')
      }

      const element = data.rows?.[0]?.elements?.[0]
      if (!element || element.status !== 'OK' || !element.distance) {
        throw new Error('Google Maps no pudo calcular la ruta entre los links ingresados')
      }

      const distanceKmRaw = element.distance.value / 1000
      const distanciaConBuffer = (distanceKmRaw + DISTANCE_BUFFER_KM).toFixed(2)
      actualizarCampo('distanciaKm', distanciaConBuffer)
      
      // Calcular precio
      const precioBase = 10
      const tarifaPorKm = 3
      const precio = (precioBase + (parseFloat(distanciaConBuffer) * tarifaPorKm)).toFixed(2)
      actualizarCampo('precioBs', precio)
      
      toast.success(`Distancia (Maps): ${distanciaConBuffer} km - Precio: ${precio} Bs`)
      
    } catch (error) {
      console.error('❌ Error calculando distancia:', error)
      toast.error(`Error: ${error.message}`)
    } finally {
      setCalculandoDistancia(false)
    }
  }

  const getLocalDateInputValue = () => {
    const now = new Date()
    const timezoneOffset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - timezoneOffset * 60000)
    return local.toISOString().split('T')[0]
  }

  const aplicarFechaHoy = () => {
    actualizarCampo('fechaDeseada', getLocalDateInputValue())
  }

  const aplicarHoraActual = () => {
    const now = new Date()
    const horas = now.getHours().toString().padStart(2, '0')
    const minutos = now.getMinutes().toString().padStart(2, '0')
    actualizarCampo('horaDeseada', `${horas}:${minutos}`)
  }

  /**
   * Enviar pedido
   */
  const enviarPedido = async (e) => {
    e.preventDefault()
    
    // Validar campos requeridos
    if (!formData.direccionRecojo || !formData.direccionEntrega || !formData.fechaDeseada || !formData.horaDeseada) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    try {
      setEnviando(true)

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      const response = await fetch(`${backendUrl}/api/cliente/crear-pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: cliente,
          ...formData
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error creando pedido')
      }

      toast.success(`¡Pedido #${result.orderId} creado exitosamente!`)
      
      resetFormulario()
      onClose()
      
      if (onSuccess) {
        onSuccess(result)
      }

    } catch (error) {
      console.error('❌ Error creando pedido:', error)
      toast.error(`Error: ${error.message}`)
    } finally {
      setEnviando(false)
    }
  }

  const resetFormulario = () => {
    setFormData({
      direccionRecojo: '',
      infoAdicionalRecojo: '',
      direccionEntrega: '',
      infoAdicionalEntrega: '',
      detallesCarrera: '',
      distanciaKm: '',
      precioBs: '',
      fechaDeseada: '',
      horaDeseada: '',
      cobroPago: '',
      montoCobroPago: '',
      descripcionCobroPago: ''
    })
  }

  if (!isOpen) return null

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => {
        if (e.target.className === 'modal-overlay') {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div 
        className="modal-content card"
        style={{
          background: 'var(--panel)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            Nuevo Pedido
          </h2>
          <button
            onClick={onClose}
            className="btn-icon"
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={enviarPedido} style={{ 
          padding: '32px', 
          overflowY: 'auto',
          flex: 1
        }}>
          {/* SECCIÓN 1: INFORMACIÓN DEL PEDIDO */}
          <div className="form-section">
            <h3 className="section-title">
              <Icon name="package" size={18} />
              Información del Pedido
            </h3>

            {/* Detalles de la Carrera */}
            <div className="form-row" style={twoColumnRowStyle}>
              <div className="form-group" style={{flex: 1}}>
                <label style={{marginBottom: '4px', display: 'block'}}>Detalles de la Carrera</label>
                <input 
                  type="text"
                  value={formData.detallesCarrera}
                  onChange={(e) => actualizarCampo('detallesCarrera', e.target.value)}
                  placeholder="Descripción adicional del pedido"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'var(--input-bg)'
                  }}
                />
              </div>
            </div>

            {/* Punto de Recojo */}
            <div className="form-row" style={twoColumnRowStyle}>
              <div className="form-group" style={{flex: 1}}>
                <label style={{marginBottom: '4px', display: 'block'}}>
                  Link de Maps (Recojo) <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.direccionRecojo}
                  onChange={(e) => actualizarCampo('direccionRecojo', e.target.value)}
                  placeholder="Ej: https://maps.app.goo.gl/XXXXXX"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'var(--input-bg)',
                    marginBottom: '8px'
                  }}
                />
                <div style={{
                  background: '#d1fae5',
                  border: '1px solid #6ee7b7',
                  borderRadius: '4px',
                  padding: '8px 12px'
                }}>
                  <label style={{
                    fontSize: '12px',
                    color: '#065f46',
                    fontWeight: '500',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    📍 Info. Adicional Recojo
                  </label>
                  <input
                    type="text"
                    value={formData.infoAdicionalRecojo}
                    onChange={(e) => actualizarCampo('infoAdicionalRecojo', e.target.value)}
                    placeholder="Ej: Local 6, Piso 2, preguntar por Maria..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #6ee7b7',
                      borderRadius: '4px',
                      fontSize: '13px',
                      background: 'white'
                    }}
                  />
                </div>
              </div>

              {/* Punto de Entrega */}
              <div className="form-group" style={{flex: 1}}>
                <label style={{marginBottom: '4px', display: 'block'}}>
                  Link de Maps (Entrega) <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.direccionEntrega}
                  onChange={(e) => actualizarCampo('direccionEntrega', e.target.value)}
                  placeholder="Ej: https://maps.app.goo.gl/YYYYYY"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'var(--input-bg)',
                    marginBottom: '8px'
                  }}
                />
                <div style={{
                  background: '#d1fae5',
                  border: '1px solid #6ee7b7',
                  borderRadius: '4px',
                  padding: '8px 12px'
                }}>
                  <label style={{
                    fontSize: '12px',
                    color: '#065f46',
                    fontWeight: '500',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    📍 Info. Adicional Entrega
                  </label>
                  <input
                    type="text"
                    value={formData.infoAdicionalEntrega}
                    onChange={(e) => actualizarCampo('infoAdicionalEntrega', e.target.value)}
                    placeholder="Ej: Local 6, Piso 2, preguntar por Maria..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #6ee7b7',
                      borderRadius: '4px',
                      fontSize: '13px',
                      background: 'white'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Calcular Distancia */}
            <div className="form-row" style={{marginBottom: '16px'}}>
              <div style={{
                background: '#fef9c3',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{flex: 1}}>
                  {formData.distanciaKm && (
                    <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                      <span style={{fontSize: '14px', color: '#92400e'}}>
                        📏 <strong>{formData.distanciaKm} km</strong>
                      </span>
                      <span style={{fontSize: '14px', color: '#92400e'}}>
                        💰 <strong>{formData.precioBs} Bs</strong>
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={calcularDistancia}
                  disabled={calculandoDistancia || !formData.direccionRecojo || !formData.direccionEntrega}
                  className="btn btn-warning"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    background: calculandoDistancia ? 'var(--yellow)' : 'var(--yellow)', /* Amarillo unificado */
                    color: '#1f2933',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    boxShadow: calculandoDistancia ? 'none' : '0 8px 20px rgba(234,179,8,0.35)',
                    cursor: calculandoDistancia ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                >
                  {calculandoDistancia ? '🔄 Calculando...' : '🗺️ Calcular Distancia'}
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: FECHA Y HORA */}
          <div className="form-section">
            <h3 className="section-title">
              <Icon name="calendar" size={18} />
              Fecha y Hora del Pedido
            </h3>

            <div className="form-row" style={twoColumnRowStyle}>
              <div className="form-group" style={{flex: 1}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                  <label>
                    Fecha Deseada <span className="required">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={aplicarFechaHoy}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--brand)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Hoy
                  </button>
                </div>
                <input
                  type="date"
                  value={formData.fechaDeseada}
                  onChange={(e) => actualizarCampo('fechaDeseada', e.target.value)}
                  min={getLocalDateInputValue()}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'var(--input-bg)'
                  }}
                />
              </div>

              <div className="form-group" style={{flex: 1}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                  <label>
                    Hora Deseada <span className="required">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={aplicarHoraActual}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--brand)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Ahora
                  </button>
                </div>
                <input
                  type="time"
                  value={formData.horaDeseada}
                  onChange={(e) => actualizarCampo('horaDeseada', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'var(--input-bg)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: COBROS/PAGOS */}
          <div className="form-section">
            <h3 className="section-title">
              <Icon name="dollar-sign" size={18} />
              Cobros/Pagos
            </h3>

            <div className="form-row" style={{...twoColumnRowStyle, marginBottom: '12px'}}>
              <div className="form-group" style={{flex: 1}}>
                <label style={{marginBottom: '4px', display: 'block'}}>Tipo de Operación</label>
                <select
                  value={formData.cobroPago}
                  onChange={(e) => actualizarCampo('cobroPago', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'var(--input-bg)',
                    cursor: 'pointer'
                  }}
                >
                  {TIPOS_COBRO_PAGO.map(tipo => (
                    <option key={tipo || 'sin-operacion'} value={tipo}>
                      {tipo || 'Sin operación'}
                    </option>
                  ))}
                </select>
                <small style={{color: '#6c757d', fontSize: '12px'}}>
                  Cobro = cliente paga, Pago = Beezy desembolsa.
                </small>
              </div>

              <div className="form-group" style={{flex: 1}}>
                <label style={{marginBottom: '4px', display: 'block'}}>
                  Monto (Bs) {formData.cobroPago && <span className="required">*</span>}
                </label>
                <input
                  type="number"
                  value={formData.montoCobroPago}
                  onChange={(e) => actualizarCampo('montoCobroPago', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={!formData.cobroPago}
                  required={Boolean(formData.cobroPago)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: formData.cobroPago ? 'var(--input-bg)' : '#f1f5f9',
                    opacity: formData.cobroPago ? 1 : 0.6
                  }}
                />
              </div>
            </div>

            <div className="form-row" style={{...twoColumnRowStyle, marginBottom: 0}}>
              <div className="form-group" style={{flex: 1}}>
                <label style={{marginBottom: '4px', display: 'block'}}>Descripción del cobro/pago</label>
                <input
                  type="text"
                  value={formData.descripcionCobroPago}
                  onChange={(e) => actualizarCampo('descripcionCobroPago', e.target.value)}
                  placeholder="Ej: Pago por productos"
                  disabled={!formData.cobroPago}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: formData.cobroPago ? 'var(--input-bg)' : '#f1f5f9',
                    opacity: formData.cobroPago ? 1 : 0.6
                  }}
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="btn"
              style={{
                padding: '10px 24px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: enviando ? 'not-allowed' : 'pointer',
                opacity: enviando ? 0.5 : 1
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '10px 32px',
                background: enviando ? '#9ca3af' : 'var(--brand)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: enviando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {enviando ? (
                <>
                  <div className="spinner" style={{width: '14px', height: '14px'}}></div>
                  Creando pedido...
                </>
              ) : (
                <>
                  <Icon name="check-circle" size={16} />
                  Crear Pedido
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
