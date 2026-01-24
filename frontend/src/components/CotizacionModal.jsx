import React, { useState, useEffect } from 'react'
import Icon from './Icon'
import { toast } from 'react-toastify'
import { getBackendUrl } from '../utils/api'
import SearchableSelect from './SearchableSelect'
import Papa from 'papaparse'
import { calculatePrice } from '../utils/priceCalculator.js'

const CotizacionModal = ({ isOpen, onClose, onCrearCarrera, initialData = null }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [form, setForm] = useState({
    recojo: '',
    direccion_recojo: '',
    entrega: '',
    direccion_entrega: '',
    medio_transporte: ''
  })
  const [distancia, setDistancia] = useState(null)
  const [precio, setPrecio] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [validacionRecojo, setValidacionRecojo] = useState({ estado: null, mensaje: '' })
  const [validacionEntrega, setValidacionEntrega] = useState({ estado: null, mensaje: '' })
  
  // Estados para modo Empresas/Manual
  const [recojoManual, setRecojoManual] = useState(false)
  const [entregaManual, setEntregaManual] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [mensajeCopiado, setMensajeCopiado] = useState(false)

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

  // Agregar funcionalidad de ESC para cerrar el modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      // Resetear formulario cuando se cierra (solo si no hay datos iniciales)
      if (!initialData) {
        setForm({
          recojo: '',
          direccion_recojo: '',
          entrega: '',
          direccion_entrega: '',
          medio_transporte: ''
        })
        setDistancia(null)
        setPrecio(null)
        setRecojoManual(false)
        setEntregaManual(false)
      }
      setValidacionRecojo({ estado: null, mensaje: '' })
      setValidacionEntrega({ estado: null, mensaje: '' })
    }
  }, [isOpen, initialData])

  // Cargar empresas cuando se abre el modal
  useEffect(() => {
    if (isOpen && empresas.length === 0) {
      loadEmpresas()
    }
  }, [isOpen])

  // Detectar y cargar datos iniciales cuando se abren empresas y hay datos iniciales
  useEffect(() => {
    if (isOpen && empresas.length > 0 && initialData) {
      cargarDatosIniciales(initialData)
    }
  }, [isOpen, empresas, initialData])

  // Función para detectar si un valor es una empresa válida
  const esEmpresaValida = (valor) => {
    if (!valor || !valor.trim()) return false
    return empresas.some(emp => emp.empresa === valor.trim())
  }

  // Función para detectar si un valor es una dirección (mapa)
  const esDireccionMapa = (valor) => {
    if (!valor || !valor.trim()) return false
    const url = valor.trim().toLowerCase()
    return url.includes('maps') || url.includes('goo.gl') || url.includes('google.com/maps')
  }

  // Función para cargar datos iniciales y detectar el modo correcto
  const cargarDatosIniciales = (datos) => {
    // Procesar Punto de Recojo
    if (datos.recojo || datos.direccion_recojo) {
      const recojoNombre = datos.recojo || ''
      const recojoDireccion = datos.direccion_recojo || ''
      
      if (esEmpresaValida(recojoNombre)) {
        // Es una empresa válida - usar modo Empresas
        setRecojoManual(false)
        setForm(prev => ({
          ...prev,
          recojo: recojoNombre,
          direccion_recojo: getEmpresaMapa(recojoNombre) || recojoDireccion
        }))
      } else if (recojoDireccion && esDireccionMapa(recojoDireccion)) {
        // Es una dirección (mapa) - usar modo Manual
        setRecojoManual(true)
        setForm(prev => ({
          ...prev,
          recojo: recojoNombre || 'Sin especificar',
          direccion_recojo: recojoDireccion
        }))
      } else if (recojoNombre && !esEmpresaValida(recojoNombre)) {
        // Tiene nombre pero no es empresa válida - modo Manual
        setRecojoManual(true)
        setForm(prev => ({
          ...prev,
          recojo: recojoNombre,
          direccion_recojo: recojoDireccion
        }))
      }
    }

    // Procesar Punto de Entrega
    if (datos.entrega || datos.direccion_entrega) {
      const entregaNombre = datos.entrega || ''
      const entregaDireccion = datos.direccion_entrega || ''
      
      if (esEmpresaValida(entregaNombre)) {
        // Es una empresa válida - usar modo Empresas
        setEntregaManual(false)
        setForm(prev => ({
          ...prev,
          entrega: entregaNombre,
          direccion_entrega: getEmpresaMapa(entregaNombre) || entregaDireccion
        }))
      } else if (entregaDireccion && esDireccionMapa(entregaDireccion)) {
        // Es una dirección (mapa) - usar modo Manual
        setEntregaManual(true)
        setForm(prev => ({
          ...prev,
          entrega: entregaNombre || 'Sin especificar',
          direccion_entrega: entregaDireccion
        }))
      } else if (entregaNombre && !esEmpresaValida(entregaNombre)) {
        // Tiene nombre pero no es empresa válida - modo Manual
        setEntregaManual(true)
        setForm(prev => ({
          ...prev,
          entrega: entregaNombre,
          direccion_entrega: entregaDireccion
        }))
      }
    }

    // Cargar otros datos si existen
    if (datos.medio_transporte) {
      setForm(prev => ({ ...prev, medio_transporte: datos.medio_transporte }))
    }
    if (datos.distancia_km) {
      setDistancia(datos.distancia_km)
    }
    if (datos.precio_bs) {
      setPrecio(datos.precio_bs)
    }
  }

  // Función para cargar empresas desde CSV
  const loadEmpresas = async () => {
    try {
      const csvUrl = import.meta.env.VITE_EMPRESAS_CSV_URL || import.meta.env.VITE_CLIENTES_CSV_URL
      if (!csvUrl) {
        console.warn('⚠️ No hay URL configurada para empresas')
        return
      }
      
      const res = await fetch(csvUrl, { 
        cache: 'no-store',
        mode: 'cors',
        headers: {
          'Accept': 'text/csv'
        }
      })
      
      if (!res.ok) {
        console.warn('⚠️ No se pudieron cargar las empresas')
        return
      }
      
      const csvText = await res.text()
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
      
      // Cargar empresas con sus mapas
      const empresasData = parsed.data
        .filter(row => row.Empresa?.trim() && row.Mapa?.trim())
        .map(row => ({
          empresa: row.Empresa.trim(),
          mapa: row.Mapa.trim(),
          descripcion: row.Descripción?.trim() || ''
        }))
      
      setEmpresas(empresasData)
    } catch (error) {
      console.error('❌ Error cargando empresas:', error)
    }
  }

  // Función para obtener el mapa de una empresa
  const getEmpresaMapa = (empresaNombre) => {
    const empresa = empresas.find(emp => emp.empresa === empresaNombre)
    return empresa ? empresa.mapa : ''
  }

  // Función para generar el mensaje de cotización
  const generarMensajeCotizacion = () => {
    const direccionRecojo = form.direccion_recojo || ''
    const direccionEntrega = form.direccion_entrega || ''
    const precioTexto = precio ? `${precio} Bs` : 'Pendiente'
    
    if (!direccionRecojo || !direccionEntrega) {
      return 'Completa los puntos de recojo y entrega para generar el mensaje'
    }
    
    let mensaje = `*Cotización de Carrera*\n\n`
    mensaje += `*Ubicación recojo:*\n${direccionRecojo}\n\n`
    mensaje += `*Ubicación entrega:*\n${direccionEntrega}\n\n`
    mensaje += `*Precio:* ${precioTexto}`
    
    return mensaje
  }

  // Función para copiar el mensaje al portapapeles
  const copiarMensaje = async () => {
    const mensaje = generarMensajeCotizacion()
    try {
      await navigator.clipboard.writeText(mensaje)
      setMensajeCopiado(true)
      toast.success('✅ Mensaje copiado al portapapeles')
      setTimeout(() => setMensajeCopiado(false), 2000)
    } catch (error) {
      console.error('Error copiando mensaje:', error)
      toast.error('❌ Error al copiar el mensaje')
    }
  }

  // Funciones para manejar cambio de modo
  const handleRecojoModeChange = (isManual) => {
    setRecojoManual(isManual)
    if (isManual) {
      // Cambiar a modo manual: limpiar selección de empresa
      setForm(prev => ({
        ...prev,
        recojo: '',
        direccion_recojo: ''
      }))
    } else {
      // Cambiar a modo empresas: limpiar dirección manual
      setForm(prev => ({
        ...prev,
        recojo: '',
        direccion_recojo: ''
      }))
    }
  }

  const handleEntregaModeChange = (isManual) => {
    setEntregaManual(isManual)
    if (isManual) {
      // Cambiar a modo manual: limpiar selección de empresa
      setForm(prev => ({
        ...prev,
        entrega: '',
        direccion_entrega: ''
      }))
    } else {
      // Cambiar a modo empresas: limpiar dirección manual
      setForm(prev => ({
        ...prev,
        entrega: '',
        direccion_entrega: ''
      }))
    }
  }

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
    let updatedForm = { [name]: value }
    
    // Si se selecciona una empresa en modo dropdown, auto-completar dirección
    if (name === 'recojo' && !recojoManual && value) {
      const empresaMapa = getEmpresaMapa(value) || ''
      updatedForm.direccion_recojo = empresaMapa
    } else if (name === 'entrega' && !entregaManual && value) {
      const empresaMapa = getEmpresaMapa(value) || ''
      updatedForm.direccion_entrega = empresaMapa
    }
    
    setForm(prev => ({ ...prev, ...updatedForm }))
    
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

  // Función para calcular precio usando el módulo centralizado de priceCalculator.js
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

    const basePrice = calculatePrice(dist, medioTransporte)
    
    if (basePrice === 0) {
      // Para Scooter u otros medios sin cálculo automático
      setPrecio(null)
      return
    }

    setPrecio(basePrice.toFixed(2))
  }

  // Función para calcular distancia
  const calcularDistancia = async () => {
    const direccionRecojo = form.direccion_recojo || ''
    const direccionEntrega = form.direccion_entrega || ''
    
    if (!direccionRecojo || !direccionEntrega) {
      toast.error('Por favor ingresa ambos puntos de recojo y entrega')
      return
    }

    setIsCalculating(true)
    setDistancia(null)
    setPrecio(null)

    try {
      const baseUrl = getBackendUrl()
      const origen = cleanGoogleMapsUrl(direccionRecojo)
      const destino = cleanGoogleMapsUrl(direccionEntrega)

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
    const direccionRecojo = form.direccion_recojo || ''
    const direccionEntrega = form.direccion_entrega || ''
    
    if (!direccionRecojo || !direccionEntrega) {
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
    // Si está en modo Empresas, pasar el nombre de la empresa
    // Si está en modo Manual, pasar "Sin especificar" o el nombre si existe
    const recojoNombre = !recojoManual && form.recojo ? form.recojo : (form.recojo || 'Sin especificar')
    const entregaNombre = !entregaManual && form.entrega ? form.entrega : (form.entrega || 'Sin especificar')
    
    onCrearCarrera({
      recojo: recojoNombre,
      direccion_recojo: direccionRecojo,
      entrega: entregaNombre,
      direccion_entrega: direccionEntrega,
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
          backgroundColor: isDarkMode ? 'var(--bg-secondary)' : 'var(--panel)',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease, background-color 0.3s ease',
          border: `1px solid var(--border)`,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón X en la esquina superior derecha */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            transition: 'all 0.2s',
            zIndex: 10001,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
          title="Cerrar (ESC)"
        >
          <Icon name="xCircle" size={18} />
        </button>

        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%)`,
            padding: '24px',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'white',
          }}
        >
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
                color: 'var(--text)',
              }}
            >
              Punto de Recojo *
            </label>
            {/* Botones de modo */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              <button 
                type="button" 
                onClick={() => handleRecojoModeChange(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: !recojoManual ? 'var(--sky)' : 'var(--input-bg)',
                  color: !recojoManual ? 'white' : 'var(--muted)',
                  border: `1px solid var(--border)`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: !recojoManual ? '600' : '400'
                }}
              >
                📋 Empresas
              </button>
              <button 
                type="button" 
                onClick={() => handleRecojoModeChange(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: recojoManual ? 'var(--brand)' : 'var(--input-bg)',
                  color: recojoManual ? 'white' : 'var(--muted)',
                  border: `1px solid var(--border)`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: recojoManual ? '600' : '400'
                }}
              >
                ✏️ Manual
              </button>
            </div>
            
            {/* Input según el modo */}
            {!recojoManual ? (
              // Modo Empresas - Dropdown
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect
                    name="recojo"
                    options={empresas.map(emp => emp.empresa)}
                    value={form.recojo}
                    onChange={handleChange}
                    placeholder="Seleccionar empresa"
                    searchPlaceholder="Buscar empresa..."
                    style={{ width: '100%' }}
                  />
                </div>
                {form.recojo && getEmpresaMapa(form.recojo) && (
                  <a 
                    href={getEmpresaMapa(form.recojo)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--accent)',
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
                )}
              </div>
            ) : (
              // Modo Manual - Input de URL
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
                    border: validacionRecojo.estado === 'invalido' ? '2px solid var(--red)' : 
                            validacionRecojo.estado === 'valido' ? '2px solid var(--brand)' : '2px solid var(--border)',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text)',
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
                        backgroundColor: 'var(--accent)',
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
            )}
            {validacionRecojo.estado === 'invalido' && (
              <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>
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
                color: 'var(--text)',
              }}
            >
              Punto de Entrega *
            </label>
            {/* Botones de modo */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              <button 
                type="button" 
                onClick={() => handleEntregaModeChange(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: !entregaManual ? 'var(--sky)' : 'var(--input-bg)',
                  color: !entregaManual ? 'white' : 'var(--muted)',
                  border: `1px solid var(--border)`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: !entregaManual ? '600' : '400'
                }}
              >
                📋 Empresas
              </button>
              <button 
                type="button" 
                onClick={() => handleEntregaModeChange(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: entregaManual ? 'var(--brand)' : 'var(--input-bg)',
                  color: entregaManual ? 'white' : 'var(--muted)',
                  border: `1px solid var(--border)`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: entregaManual ? '600' : '400'
                }}
              >
                ✏️ Manual
              </button>
            </div>
            
            {/* Input según el modo */}
            {!entregaManual ? (
              // Modo Empresas - Dropdown
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect
                    name="entrega"
                    options={empresas.map(emp => emp.empresa)}
                    value={form.entrega}
                    onChange={handleChange}
                    placeholder="Seleccionar empresa"
                    searchPlaceholder="Buscar empresa..."
                    style={{ width: '100%' }}
                  />
                </div>
                {form.entrega && getEmpresaMapa(form.entrega) && (
                  <a 
                    href={getEmpresaMapa(form.entrega)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--accent)',
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
                )}
              </div>
            ) : (
              // Modo Manual - Input de URL
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
                    border: validacionEntrega.estado === 'invalido' ? '2px solid var(--red)' : 
                            validacionEntrega.estado === 'valido' ? '2px solid var(--brand)' : '2px solid var(--border)',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text)',
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
                        backgroundColor: 'var(--accent)',
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
            )}
            {validacionEntrega.estado === 'invalido' && (
              <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>
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
                color: 'var(--text)',
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
                border: '2px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text)',
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
                  backgroundColor: form.direccion_recojo && form.direccion_entrega && !isCalculating ? 'var(--brand)' : 'var(--muted)',
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

          {/* Resultados - Solo mostrar después de calcular */}
          {distancia && (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg)',
                borderRadius: '12px',
                border: `1px solid var(--border)`,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '24px',
              }}
            >
              {distancia && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Distancia
                </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>
                    {distancia} km
                  </div>
                </div>
              )}
              {precio && (
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Precio Estimado
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--brand)' }}>
                    {precio} Bs
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Campo de texto para mensaje de cotización - Solo mostrar después de calcular */}
          {distancia && form.direccion_recojo && form.direccion_entrega && (
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text)',
                }}
              >
                Mensaje de Cotización
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  value={generarMensajeCotizacion()}
                  readOnly
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '12px',
                    paddingRight: '50px',
                    border: '2px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={copiarMensaje}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '8px 12px',
                    backgroundColor: mensajeCopiado ? 'var(--brand-600)' : 'var(--brand)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!mensajeCopiado) {
                      e.currentTarget.style.backgroundColor = 'var(--brand-600)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!mensajeCopiado) {
                      e.currentTarget.style.backgroundColor = 'var(--brand)'
                    }
                  }}
                >
                  {mensajeCopiado ? (
                    <>
                      <Icon name="checkCircle" size={14} />
                      Copiado
                    </>
                  ) : (
                    <>
                      📋 Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer con botón Crear Carrera */}
        <div
            style={{
              padding: '20px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
        >
          <button
            onClick={handleCrearCarrera}
            disabled={!form.direccion_recojo || !form.direccion_entrega || !form.medio_transporte || !distancia}
            style={{
              padding: '12px 32px',
              backgroundColor: form.direccion_recojo && form.direccion_entrega && form.medio_transporte && distancia ? 'var(--brand)' : 'var(--muted)',
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
                e.currentTarget.style.backgroundColor = 'var(--brand-600)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (form.direccion_recojo && form.direccion_entrega && form.medio_transporte && distancia) {
                e.currentTarget.style.backgroundColor = 'var(--brand)'
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

