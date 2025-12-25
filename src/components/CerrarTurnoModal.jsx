import React, { useState, useEffect, useMemo } from 'react'
import Icon from './Icon.jsx'

/**
 * Función auxiliar para obtener la fecha actual de Bolivia en formato DD/MM/YYYY
 */
const getBoliviaDateFormatted = () => {
  const now = new Date()
  const boliviaOffset = -4 * 60 // UTC-4 en minutos
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
  const boliviaTime = new Date(utcTime + (boliviaOffset * 60000))
  
  const day = String(boliviaTime.getDate()).padStart(2, '0')
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0')
  const year = boliviaTime.getFullYear()
  
  return `${day}/${month}/${year}`
}

/**
 * Normaliza una fecha para comparación (acepta DD/MM/YYYY o YYYY-MM-DD)
 */
const normalizeDate = (dateString) => {
  if (!dateString) return ''
  
  // Si ya está en formato DD/MM/YYYY, dejarlo así
  if (dateString.includes('/')) {
    return dateString.trim()
  }
  
  // Si está en formato YYYY-MM-DD, convertir a DD/MM/YYYY
  if (dateString.includes('-')) {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }
  
  return dateString.trim()
}

/**
 * Verifica si un valor numérico está vacío o es 0
 */
const isEmptyOrZero = (value) => {
  if (!value) return true
  const num = parseFloat(String(value))
  return isNaN(num) || num <= 0
}

const CerrarTurnoModal = ({ orders = [], operador, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  // Filtrar carreras del turno actual (día actual del operador)
  const carrerasTurno = useMemo(() => {
    if (!orders || orders.length === 0 || !operador) return []
    
    // Obtener fecha actual de Bolivia (recalcular cada vez)
    const fechaActual = getBoliviaDateFormatted()
    
    return orders.filter(order => {
      // Obtener fecha de registro de la carrera
      const fechaRegistro = normalizeDate(
        order['Fecha Registro'] || order.fecha_registro || order.fecha || ''
      )
      
      // Obtener operador de la carrera
      const operadorCarrera = order.Operador || order.operador || ''
      
      // Filtrar por fecha y operador
      return fechaRegistro === fechaActual && operadorCarrera === operador
    })
  }, [orders, operador])

  // Filtrar solo carreras entregadas
  const carrerasEntregadas = useMemo(() => {
    return carrerasTurno.filter(order => {
      const estado = order.Estado || order.estado || ''
      return estado.toLowerCase() === 'entregado'
    })
  }, [carrerasTurno])

  // Analizar carreras con datos faltantes
  const analisis = useMemo(() => {
    const sinPrecio = []
    const sinDistancia = []
    const sinAmbos = []

    carrerasEntregadas.forEach(order => {
      const precio = order['Precio [Bs]'] || order.precio_bs || order.precio || ''
      const distancia = order['Dist. [Km]'] || order.distancia_km || order.distancia || ''
      
      const faltaPrecio = isEmptyOrZero(precio)
      const faltaDistancia = isEmptyOrZero(distancia)
      
      if (faltaPrecio && faltaDistancia) {
        sinAmbos.push(order)
      } else if (faltaPrecio) {
        sinPrecio.push(order)
      } else if (faltaDistancia) {
        sinDistancia.push(order)
      }
    })

    return {
      totalCarreras: carrerasTurno.length,
      totalEntregadas: carrerasEntregadas.length,
      sinPrecio: sinPrecio.length,
      sinDistancia: sinDistancia.length,
      sinAmbos: sinAmbos.length,
      listadoSinPrecio: sinPrecio,
      listadoSinDistancia: sinDistancia,
      listadoSinAmbos: sinAmbos,
    }
  }, [carrerasEntregadas, carrerasTurno])

  const tieneProblemas = analisis.sinPrecio > 0 || analisis.sinDistancia > 0 || analisis.sinAmbos > 0

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--panel)',
          borderRadius: '16px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '24px',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}
            >
              📊
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                Cerrar Turno
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                {getBoliviaDateFormatted()} • {operador || 'Operador'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <Icon name="xCircle" size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Resumen General */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text)',
              }}
            >
              Resumen del Turno
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Total de carreras
                </p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>
                  {analisis.totalCarreras}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Carreras entregadas
                </p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                  {analisis.totalEntregadas}
                </p>
              </div>
            </div>
          </div>

          {/* Alertas de Datos Faltantes */}
          {tieneProblemas && (
            <div
              style={{
                backgroundColor: '#fef3c7',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: '1px solid #fbbf24',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px',
                  }}
                >
                  ⚠️
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#92400e',
                  }}
                >
                  Datos Faltantes en Carreras Entregadas
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analisis.sinAmbos > 0 && (
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #fbbf24',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>❌</span>
                      <span style={{ fontWeight: '600', color: '#92400e' }}>
                        {analisis.sinAmbos} carrera{analisis.sinAmbos !== 1 ? 's' : ''} sin precio NI distancia
                      </span>
                    </div>
                    {analisis.listadoSinAmbos.length > 0 && (
                      <div style={{ marginLeft: '28px', fontSize: '13px', color: '#78350f' }}>
                        IDs: {analisis.listadoSinAmbos.map(o => o.id || o.ID || 'N/A').join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {analisis.sinPrecio > 0 && (
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #fbbf24',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>💰</span>
                      <span style={{ fontWeight: '600', color: '#92400e' }}>
                        {analisis.sinPrecio} carrera{analisis.sinPrecio !== 1 ? 's' : ''} sin precio
                      </span>
                    </div>
                    {analisis.listadoSinPrecio.length > 0 && (
                      <div style={{ marginLeft: '28px', fontSize: '13px', color: '#78350f' }}>
                        IDs: {analisis.listadoSinPrecio.map(o => o.id || o.ID || 'N/A').join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {analisis.sinDistancia > 0 && (
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #fbbf24',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>📏</span>
                      <span style={{ fontWeight: '600', color: '#92400e' }}>
                        {analisis.sinDistancia} carrera{analisis.sinDistancia !== 1 ? 's' : ''} sin distancia
                      </span>
                    </div>
                    {analisis.listadoSinDistancia.length > 0 && (
                      <div style={{ marginLeft: '28px', fontSize: '13px', color: '#78350f' }}>
                        IDs: {analisis.listadoSinDistancia.map(o => o.id || o.ID || 'N/A').join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mensaje de éxito si no hay problemas */}
          {!tieneProblemas && analisis.totalEntregadas > 0 && (
            <div
              style={{
                backgroundColor: '#d1fae5',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: '1px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                ✅
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#065f46' }}>
                  ¡Excelente trabajo!
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#047857' }}>
                  Todas las carreras entregadas tienen precio y distancia registrados.
                </p>
              </div>
            </div>
          )}

          {/* Información adicional */}
          {analisis.totalEntregadas === 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '16px', color: 'var(--muted)' }}>
                No hay carreras entregadas en este turno.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: '12px 32px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10b981'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Entendido
            <Icon name="checkCircle" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CerrarTurnoModal

