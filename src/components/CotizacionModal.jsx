import React, { useState, useEffect } from 'react'
import Icon from './Icon'
import { toast } from 'react-toastify'
import { getBackendUrl } from '../utils/api'

const CotizacionModal = ({ isOpen, onClose, onCrearCarrera }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [form, setForm] = useState({
    direccion_recojo: '',
    direccion_entrega: '',
    medio_transporte: ''
  })
  const [distancia, setDistancia] = useState(null)
  const [precio, setPrecio] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [validacionRecojo, setValidacionRecojo] = useState({ estado: null, mensaje: '' })
  const [validacionEntrega, setValidacionEntrega] = useState({ estado: null, mensaje: '' })

  const MEDIOS_TRANSPORTE = ['Bicicleta', 'Cargo', 'Scooter', 'Beezero']

  useEffect(() => {
    // Detectar dark mode
    const checkDarkMode = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      setIsDarkMode(theme === 'dark')
    }
    
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    
    return () => observer.disconnect()
  }, [])
  
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 100)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      // Resetear formulario cuando se cierra
      setForm({
        direccion_recojo: '',
        direccion_entrega: '',
        medio_transporte: ''
      })
      setDistancia(null)
      setPrecio(null)
      setValidacionRecojo({ estado: null, mensaje: '' })
      setValidacionEntrega({ estado: null, mensaje: '' })
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  // Función para validar un link de Google Maps
  const validarLinkGoogleMaps = async (url, tipo) => {
    if (!url || !url.trim()) {
      if (tipo === 'recojo') {
        setValidacionRecojo({ estado: null, mensaje: '' })
      } else {
        setValidacionEntrega({ estado: null, mensaje: '' })
      }
      return
    }
    
    if (tipo === 'recojo') {
      setValidacionRecojo({ estado: 'validando', mensaje: 'Validando link...' })
    } else {
      setValidacionEntrega({ estado: 'validando', mensaje: 'Validando link...' })
    }
    
    try {
      const baseUrl = getBackendUrl()
      const response = await fetch(`${baseUrl}/api/validate-maps-link?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      
      if (data.valid) {
        if (tipo === 'recojo') {
          setValidacionRecojo({ estado: 'valido', mensaje: data.message || 'Link válido' })
        } else {
          setValidacionEntrega({ estado: 'valido', mensaje: data.message || 'Link válido' })
        }
      } else {
        if (tipo === 'recojo') {
          setValidacionRecojo({ estado: 'invalido', mensaje: data.reason || 'Link no válido' })
        } else {
          setValidacionEntrega({ estado: 'invalido', mensaje: data.reason || 'Link no válido' })
        }
      }
    } catch (error) {
      console.error('Error validando link:', error)
      if (tipo === 'recojo') {
        setValidacionRecojo({ estado: 'invalido', mensaje: 'Error al validar' })
      } else {
        setValidacionEntrega({ estado: 'invalido', mensaje: 'Error al validar' })
      }
    }
  }

  // Función para limpiar URLs de Google Maps
  const cleanGoogleMapsUrl = (url) => {
    if (!url || typeof url !== 'string') return url
    return url.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    
    // Si cambia una dirección, validar automáticamente
    if ((name === 'direccion_recojo' || name === 'direccion_entrega') && value) {
      const urlLimpia = cleanGoogleMapsUrl(value)
      setTimeout(() => {
        if (name === 'direccion_recojo') {
          validarLinkGoogleMaps(urlLimpia, 'recojo')
        } else {
          validarLinkGoogleMaps(urlLimpia, 'entrega')
        }
      }, 500)
    }

    // Si cambia el medio de transporte y ya hay distancia, recalcular precio
    if (name === 'medio_transporte' && distancia) {
      calcularPrecio(distancia, value)
    }
  }

  // Función para calcular precio basado en distancia y medio de transporte (igual que Orders.jsx)
  const calcularPrecio = (distanciaKm, medioTransporte) => {
    if (!distanciaKm || !medioTransporte) {
      setPrecio(null)
      return
    }

    const dist = parseFloat(distanciaKm)
    if (isNaN(dist) || dist <= 0) {
      setPrecio(null)
      return
    }

    let basePrice = 0

    // Esquema de precios para Bicicleta (COSTOS TRANSPARENTES)
    if (medioTransporte === 'Bicicleta') {
      if (dist <= 1) {
        basePrice = 8
      } else if (dist <= 2) {
        basePrice = 10
      } else if (dist <= 3) {
        basePrice = 12
      } else if (dist <= 4) {
        basePrice = 14
      } else if (dist <= 5) {
        basePrice = 16
      } else if (dist <= 6) {
        basePrice = 18
      } else if (dist <= 7) {
        basePrice = 20
      } else if (dist <= 8) {
        basePrice = 22
      } else if (dist <= 9) {
        basePrice = 24
      } else if (dist <= 10) {
        basePrice = 26
      } else {
        // Para distancias mayores a 10km: 26 Bs + 2 Bs por km adicional
        const kmAdicionales = Math.ceil(dist - 10)
        basePrice = 26 + (kmAdicionales * 2)
      }
    }
    // Esquema de precios para BeeZero (inicia en 10 Bs)
    else if (medioTransporte === 'Beezero') {
      if (dist <= 1) {
        basePrice = 10
      } else if (dist <= 2) {
        basePrice = 12
      } else if (dist <= 3) {
        basePrice = 14
      } else if (dist <= 4) {
        basePrice = 16
      } else if (dist <= 5) {
        basePrice = 18
      } else if (dist <= 6) {
        basePrice = 20
      } else if (dist <= 7) {
        basePrice = 22
      } else if (dist <= 8) {
        basePrice = 24
      } else if (dist <= 9) {
        basePrice = 26
      } else if (dist <= 10) {
        basePrice = 28
      } else {
        // Para distancias mayores a 10km: 28 Bs + 2 Bs por km adicional
        const kmAdicionales = Math.ceil(dist - 10)
        basePrice = 28 + (kmAdicionales * 2)
      }
    }
    // Esquema de precios para Cargo: Bicicleta + 6 Bs
    else if (medioTransporte === 'Cargo') {
      // Calcular precio base de Bicicleta
      let precioBicicleta = 0
      if (dist <= 1) {
        precioBicicleta = 8
      } else if (dist <= 2) {
        precioBicicleta = 10
      } else if (dist <= 3) {
        precioBicicleta = 12
      } else if (dist <= 4) {
        precioBicicleta = 14
      } else if (dist <= 5) {
        precioBicicleta = 16
      } else if (dist <= 6) {
        precioBicicleta = 18
      } else if (dist <= 7) {
        precioBicicleta = 20
      } else if (dist <= 8) {
        precioBicicleta = 22
      } else if (dist <= 9) {
        precioBicicleta = 24
      } else if (dist <= 10) {
        precioBicicleta = 26
      } else {
        // Para distancias mayores a 10km: 26 Bs + 2 Bs por km adicional
        const kmAdicionales = Math.ceil(dist - 10)
        precioBicicleta = 26 + (kmAdicionales * 2)
      }
      
      // Cargo = Bicicleta + 6 Bs
      basePrice = precioBicicleta + 6
    }
    // Para Scooter no se calcula precio automáticamente
    else if (medioTransporte === 'Scooter') {
      setPrecio(null)
      return
    } else {
      setPrecio(null)
      return
    }

    setPrecio(basePrice.toFixed(2))
  }

  // Función para calcular distancia
  const calcularDistancia = async () => {
    if (!form.direccion_recojo || !form.direccion_entrega) {
      toast.error('Por favor ingresa ambos puntos de recojo y entrega')
      return
    }

    setIsCalculating(true)
    setDistancia(null)
    setPrecio(null)

    try {
      const baseUrl = getBackendUrl()
      const origen = cleanGoogleMapsUrl(form.direccion_recojo)
      const destino = cleanGoogleMapsUrl(form.direccion_entrega)

      const response = await fetch(
        `${baseUrl}/api/distance-proxy?origins=${encodeURIComponent(origen)}&destinations=${encodeURIComponent(destino)}`
      )

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        setIsCalculating(false)
        return
      }

      console.log('📊 Respuesta del servidor:', data)

      // Procesar respuesta - puede venir en diferentes formatos
      let distanciaValue = null
      
      if (data.distance && data.distance.value) {
        distanciaValue = data.distance.value
      } else if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
        const element = data.rows[0].elements[0]
        if (element.status === 'OK' && element.distance && element.distance.value) {
          distanciaValue = element.distance.value
        }
      }

      if (distanciaValue) {
        const distanciaKm = (distanciaValue / 1000).toFixed(2)
        setDistancia(distanciaKm)
        console.log('✅ Distancia calculada:', distanciaKm, 'km')
        
        // Calcular precio automáticamente si hay medio de transporte
        if (form.medio_transporte) {
          console.log('💰 Calculando precio para:', form.medio_transporte, 'distancia:', distanciaKm)
          calcularPrecio(distanciaKm, form.medio_transporte)
        } else {
          toast.info('Distancia calculada. Selecciona un medio de transporte para calcular el precio.')
        }
      } else {
        console.error('❌ No se pudo extraer la distancia de la respuesta:', data)
        toast.error('No se pudo calcular la distancia. Revisa la consola para más detalles.')
      }
    } catch (error) {
      console.error('Error calculando distancia:', error)
      toast.error('Error al calcular la distancia')
    } finally {
      setIsCalculating(false)
    }
  }

  const handleCrearCarrera = () => {
    if (!form.direccion_recojo || !form.direccion_entrega) {
      toast.error('Por favor ingresa ambos puntos de recojo y entrega')
      return
    }

    if (!form.medio_transporte) {
      toast.error('Por favor selecciona un medio de transporte')
      return
    }

    if (!distancia) {
      toast.error('Por favor calcula la distancia primero')
      return
    }

    // Llamar a la función callback para llenar el formulario
    onCrearCarrera({
      direccion_recojo: form.direccion_recojo,
      direccion_entrega: form.direccion_entrega,
      medio_transporte: form.medio_transporte,
      distancia_km: distancia,
      precio_bs: precio
    })

    handleClose()
    toast.success('Información cargada en el formulario de pedido')
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: isVisible ? 'auto' : 'none',
        overflowY: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease, background-color 0.3s ease',
          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #96c226 0%, #7ba01e 100%)',
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
              💰
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
                Cotización de Carrera
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                Calcula distancia y precio rápidamente
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
          {/* Punto de Recojo */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: isDarkMode ? '#f1f5f9' : '#1e293b',
              }}
            >
              Punto de Recojo *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                name="direccion_recojo"
                value={form.direccion_recojo}
                onChange={handleChange}
                placeholder="Pega aquí el enlace de Google Maps..."
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: validacionRecojo.estado ? '100px' : '80px',
                  border: validacionRecojo.estado === 'invalido' ? '2px solid #dc3545' : 
                          validacionRecojo.estado === 'valido' ? '2px solid #28a745' : `2px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                  color: isDarkMode ? '#f1f5f9' : '#1e293b',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {form.direccion_recojo && (
                <>
                  <a
                    href={form.direccion_recojo}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: 'absolute',
                      right: validacionRecojo.estado ? '50px' : '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '6px 12px',
                      backgroundColor: '#ff9500',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    📍 Maps
                  </a>
                  {validacionRecojo.estado && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '22px',
                        lineHeight: '1',
                      }}
                      title={validacionRecojo.mensaje}
                    >
                      {validacionRecojo.estado === 'validando' && '⏳'}
                      {validacionRecojo.estado === 'valido' && '✅'}
                      {validacionRecojo.estado === 'invalido' && '❌'}
                    </span>
                  )}
                </>
              )}
            </div>
            {validacionRecojo.estado === 'invalido' && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                ⚠️ {validacionRecojo.mensaje}
              </div>
            )}
          </div>

          {/* Punto de Entrega */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: isDarkMode ? '#f1f5f9' : '#1e293b',
              }}
            >
              Punto de Entrega *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                name="direccion_entrega"
                value={form.direccion_entrega}
                onChange={handleChange}
                placeholder="Pega aquí el enlace de Google Maps..."
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: validacionEntrega.estado ? '100px' : '80px',
                  border: validacionEntrega.estado === 'invalido' ? '2px solid #dc3545' : 
                          validacionEntrega.estado === 'valido' ? '2px solid #28a745' : `2px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                  color: isDarkMode ? '#f1f5f9' : '#1e293b',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {form.direccion_entrega && (
                <>
                  <a
                    href={form.direccion_entrega}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: 'absolute',
                      right: validacionEntrega.estado ? '50px' : '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '6px 12px',
                      backgroundColor: '#ff9500',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    📍 Maps
                  </a>
                  {validacionEntrega.estado && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '22px',
                        lineHeight: '1',
                      }}
                      title={validacionEntrega.mensaje}
                    >
                      {validacionEntrega.estado === 'validando' && '⏳'}
                      {validacionEntrega.estado === 'valido' && '✅'}
                      {validacionEntrega.estado === 'invalido' && '❌'}
                    </span>
                  )}
                </>
              )}
            </div>
            {validacionEntrega.estado === 'invalido' && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                ⚠️ {validacionEntrega.mensaje}
              </div>
            )}
          </div>

          {/* Medio de Transporte */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: isDarkMode ? '#f1f5f9' : '#1e293b',
              }}
            >
              Medio de Transporte *
            </label>
            <select
              name="medio_transporte"
              value={form.medio_transporte}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '12px',
                border: `2px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                color: isDarkMode ? '#f1f5f9' : '#1e293b',
              }}
            >
              <option value="">Seleccionar medio de transporte</option>
              {MEDIOS_TRANSPORTE.map((medio) => (
                <option key={medio} value={medio}>
                  {medio}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Calcular Distancia */}
          <button
            onClick={calcularDistancia}
            disabled={!form.direccion_recojo || !form.direccion_entrega || isCalculating}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: form.direccion_recojo && form.direccion_entrega && !isCalculating ? '#96c226' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: form.direccion_recojo && form.direccion_entrega && !isCalculating ? 'pointer' : 'not-allowed',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isCalculating ? '⏳ Calculando...' : '🔄 Calcular Distancia'}
          </button>

          {/* Resultados */}
          {(distancia || precio) && (
            <div
              style={{
                padding: '16px',
                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                borderRadius: '12px',
                border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                marginBottom: '20px',
              }}
            >
              {distancia && (
                <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                  Distancia
                </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                    {distancia} km
                  </div>
                </div>
              )}
              {precio && (
                <div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                    Precio Estimado
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#96c226' }}>
                    {precio} Bs
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con botón Crear Carrera */}
        <div
            style={{
              padding: '20px 24px',
              borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
        >
          <button
            onClick={handleCrearCarrera}
            disabled={!form.direccion_recojo || !form.direccion_entrega || !form.medio_transporte || !distancia}
            style={{
              padding: '12px 32px',
              backgroundColor: form.direccion_recojo && form.direccion_entrega && form.medio_transporte && distancia ? '#96c226' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: form.direccion_recojo && form.direccion_entrega && form.medio_transporte && distancia ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (form.direccion_recojo && form.direccion_entrega && form.medio_transporte && distancia) {
                e.currentTarget.style.backgroundColor = '#7ba01e'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (form.direccion_recojo && form.direccion_entrega && form.medio_transporte && distancia) {
                e.currentTarget.style.backgroundColor = '#96c226'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            Crear carrera
            <Icon name="checkCircle" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CotizacionModal

