import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import { cleanGoogleMapsUrl } from '../utils/mapsUtils.js'

/**
 * Modal para mostrar mapa de calor de pedidos
 * Muestra puntos de recojo, entrega y zonas de mayor actividad
 */
export default function HeatMapModal({ isOpen, onClose, orders }) {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, percentage: 0 })
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const heatmapLayerRef = useRef(null)
  const markerLayerRef = useRef(null)

  // Cerrar con tecla ESC
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Obtener fecha de hoy en formato YYYY-MM-DD para input date
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Obtener fecha de hace 30 días
  const get30DaysAgo = () => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Inicializar fechas al abrir el modal
  useEffect(() => {
    if (isOpen && !fechaInicio) {
      setFechaInicio(get30DaysAgo())
      setFechaFin(getTodayDate())
    }
  }, [isOpen])

  // Cargar Google Maps API dinámicamente
  useEffect(() => {
    if (!isOpen) return

    const loadGoogleMaps = () => {
      // Verificar si ya está cargada
      if (window.google && window.google.maps) {
        setMapLoaded(true)
        return
      }

      // Verificar si ya hay un script cargándose
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Esperar a que se cargue
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkLoaded)
            setMapLoaded(true)
          }
        }, 100)
        return () => clearInterval(checkLoaded)
      }

      // Obtener API key desde el backend
      const loadAPI = async () => {
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
          const response = await fetch(`${backendUrl}/api/maps/api-key`)
          
          if (!response.ok) {
            throw new Error('Error al obtener API key')
          }
          
          const data = await response.json()
          
          if (data.apiKey) {
            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=visualization`
            script.async = true
            script.defer = true
            script.onload = () => {
              // Esperar a que Google Maps esté completamente cargado
              const checkMaps = setInterval(() => {
                if (window.google && window.google.maps) {
                  clearInterval(checkMaps)
                  // Verificar visualization después de que maps esté listo
                  if (window.google.maps.visualization && window.google.maps.visualization.HeatmapLayer) {
                    console.log('✅ Google Maps y Visualization cargados correctamente')
                    setMapLoaded(true)
                  } else {
                    // Intentar cargar visualization si no está disponible
                    console.warn('⚠️ Visualization no está disponible, intentando cargar...')
                    const checkVisualization = setInterval(() => {
                      if (window.google.maps.visualization && window.google.maps.visualization.HeatmapLayer) {
                        clearInterval(checkVisualization)
                        console.log('✅ Visualization cargado correctamente')
                        setMapLoaded(true)
                      }
                    }, 100)
                    
                    // Timeout después de 3 segundos
                    setTimeout(() => {
                      clearInterval(checkVisualization)
                      if (!window.google.maps.visualization) {
                        console.error('❌ Visualization no está disponible')
                        toast.error('Error: La librería de Google Maps Visualization no está disponible. Verifica que la API key tenga habilitada la API de Maps JavaScript y la librería de visualization en Google Cloud Console.')
                      } else {
                        setMapLoaded(true)
                      }
                    }, 3000)
                  }
                }
              }, 100)
              
              // Timeout general después de 10 segundos
              setTimeout(() => {
                clearInterval(checkMaps)
                if (!window.google || !window.google.maps) {
                  console.error('❌ Google Maps no se cargó después de timeout')
                  toast.error('Error: Google Maps no se cargó correctamente. Verifica la API key y que esté habilitada la API de Maps JavaScript.')
                }
              }, 10000)
            }
            script.onerror = () => {
              toast.error('Error al cargar Google Maps API')
            }
            document.head.appendChild(script)
          } else {
            toast.error('No se pudo obtener la API key de Google Maps')
          }
        } catch (error) {
          console.error('Error obteniendo API key:', error)
          toast.error('Error al obtener la API key de Google Maps. Verifica que el servidor esté corriendo.')
        }
      }
      
      loadAPI()
    }

    loadGoogleMaps()
  }, [isOpen])

  // Inicializar mapa cuando la API esté lista
  useEffect(() => {
    if (!isOpen || !mapLoaded || !mapRef.current) return

    // Verificar que Google Maps esté completamente cargado
    if (!window.google || !window.google.maps) {
      console.error('Google Maps no está disponible')
      return
    }

    try {
      // Centro de Cochabamba como punto inicial
      const cochabamba = { lat: -17.3935, lng: -66.1570 }

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center: cochabamba,
        mapTypeId: 'roadmap',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      mapInstanceRef.current = map
      console.log('✅ Mapa inicializado correctamente')
    } catch (error) {
      console.error('❌ Error al inicializar el mapa:', error)
      toast.error('Error al inicializar el mapa de Google Maps')
    }

    return () => {
      // Cleanup si es necesario
    }
  }, [isOpen, mapLoaded])

  // Función para parsear fecha desde diferentes formatos
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    
    // Formato DD/MM/YYYY
    const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (ddmmyyyy) {
      return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]))
    }
    
    // Formato YYYY-MM-DD
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(dateStr + 'T00:00:00')
    }
    
    // Intentar parsear directamente
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  }

  // Función para filtrar pedidos por fecha
  const filterOrdersByDate = (orders, fechaInicio, fechaFin) => {
    if (!fechaInicio && !fechaFin) return orders

    const inicio = fechaInicio ? parseDate(fechaInicio) : null
    const fin = fechaFin ? parseDate(fechaFin) : null

    // Si hay fecha fin, agregar un día completo (hasta el final del día)
    if (fin) {
      fin.setHours(23, 59, 59, 999)
    }

    return orders.filter(order => {
      const fechaRegistro = order['Fecha Registro'] || order.fecha_registro || order.fecha
      if (!fechaRegistro) return false

      const fecha = parseDate(fechaRegistro)
      if (!fecha) return false

      if (inicio && fecha < inicio) return false
      if (fin && fecha > fin) return false

      return true
    })
  }

  // Función para generar mapa de calor
  const generarMapaCalor = async () => {
    if (!fechaInicio || !fechaFin) {
      toast.warning('Por favor selecciona ambas fechas')
      return
    }

    if (!mapInstanceRef.current) {
      toast.error('El mapa no está inicializado')
      return
    }

    setLoading(true)

    try {
      console.log(`📅 Fechas seleccionadas: ${fechaInicio} a ${fechaFin}`)
      console.log(`📦 Total pedidos disponibles: ${orders.length}`)
      
      // Filtrar pedidos por fecha
      const pedidosFiltradosPorFecha = filterOrdersByDate(orders, fechaInicio, fechaFin)
      console.log(`📅 Pedidos en rango de fechas: ${pedidosFiltradosPorFecha.length}`)

      // Filtrar solo pedidos entregados
      const pedidosFiltrados = pedidosFiltradosPorFecha.filter(order => {
        const estado = order.Estado || order.estado
        return estado === 'Entregado'
      })

      console.log(`✅ Pedidos entregados en rango: ${pedidosFiltrados.length}`)
      
      // Mostrar algunos ejemplos de fechas de los pedidos filtrados
      if (pedidosFiltrados.length > 0) {
        const fechasEjemplo = pedidosFiltrados.slice(0, 5).map(o => {
          const fecha = o['Fecha Registro'] || o.fecha_registro || o.fecha
          const estado = o.Estado || o.estado
          return `Fecha: ${fecha}, Estado: ${estado}`
        })
        console.log('📋 Primeros 5 pedidos filtrados:', fechasEjemplo)
      }

      if (pedidosFiltrados.length === 0) {
        toast.warning('No hay pedidos entregados en el rango de fechas seleccionado')
        setLoading(false)
        return
      }

      // Extraer y normalizar URLs de recojo y entrega
      // Para el mapa de calor, necesitamos conservar las repeticiones para calcular el peso
      // pero normalizamos las URLs para que URLs equivalentes se traten como la misma
      const urlsMap = new Map() // Mapa para mantener URLs normalizadas y sus pedidos asociados
      const urlsList = [] // Lista de todas las URLs (normalizadas) para procesar, conservando repeticiones
      
      pedidosFiltrados.forEach(order => {
        const direccionRecojo = order['Direccion Recojo'] || order.direccion_recojo
        const direccionEntrega = order['Direccion Entrega'] || order.direccion_entrega

        // Normalizar y procesar dirección de recojo
        if (direccionRecojo && direccionRecojo.trim() !== '' && direccionRecojo !== 'Cliente avisa') {
          const urlNormalizada = cleanGoogleMapsUrl(direccionRecojo.trim())
          if (urlNormalizada && urlNormalizada.trim() !== '') {
            // Agregar a la lista (conservando repeticiones)
            urlsList.push(urlNormalizada)
            
            // Mantener en el mapa para asociar pedidos
            if (!urlsMap.has(urlNormalizada)) {
              urlsMap.set(urlNormalizada, {
                url: urlNormalizada,
                pedidos: []
              })
            }
            urlsMap.get(urlNormalizada).pedidos.push({ ...order, tipo: 'recojo' })
          }
        }

        // Normalizar y procesar dirección de entrega
        if (direccionEntrega && direccionEntrega.trim() !== '' && direccionEntrega !== 'Cliente avisa') {
          const urlNormalizada = cleanGoogleMapsUrl(direccionEntrega.trim())
          if (urlNormalizada && urlNormalizada.trim() !== '') {
            // Agregar a la lista (conservando repeticiones)
            urlsList.push(urlNormalizada)
            
            // Mantener en el mapa para asociar pedidos
            if (!urlsMap.has(urlNormalizada)) {
              urlsMap.set(urlNormalizada, {
                url: urlNormalizada,
                pedidos: []
              })
            }
            urlsMap.get(urlNormalizada).pedidos.push({ ...order, tipo: 'entrega' })
          }
        }
      })

      // Para procesar, solo necesitamos las URLs únicas (normalizadas) para no duplicar trabajo
      // Pero conservamos el conteo de repeticiones en urlsList para el peso del heatmap
      const allUrls = Array.from(new Set(urlsList)).sort()
      
      console.log(`📍 URLs únicas normalizadas a procesar: ${allUrls.length}`)
      console.log(`📍 Total de ocurrencias (con repeticiones): ${urlsList.length}`)
      console.log(`📍 Pedidos entregados procesados: ${pedidosFiltrados.length}`)
      
      if (allUrls.length === 0) {
        toast.warning('No hay direcciones válidas de Google Maps en los pedidos entregados seleccionados')
        setLoading(false)
        return
      }

      toast.info(`Procesando ${allUrls.length} direcciones...`)

      // Llamar al endpoint para convertir URLs a coordenadas
      setLoadingProgress({ current: 0, total: allUrls.length, percentage: 0 })
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      
      // Verificar primero si el servidor está disponible
      try {
        const healthCheck = await fetch(`${backendUrl}/api/maps/api-key`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // Timeout de 3 segundos
        })
        if (!healthCheck.ok) {
          throw new Error('Servidor no responde correctamente')
        }
      } catch (error) {
        setLoading(false)
        setLoadingProgress({ current: 0, total: 0, percentage: 0 })
        toast.error('❌ El servidor backend no está disponible. Por favor, inicia el servidor en el puerto 5055 antes de generar el mapa de calor.')
        console.error('Error de conexión al servidor:', error)
        return
      }
      
      // Usar fetch con tracking de progreso aproximado
      // Dividir en lotes para mostrar progreso y no sobrecargar el servidor
      const batchSize = 50 // Procesar en lotes de 50
      const batches = []
      for (let i = 0; i < allUrls.length; i += batchSize) {
        batches.push(allUrls.slice(i, i + batchSize))
      }
      
      const allCoordinates = []
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        
        try {
          const response = await fetch(`${backendUrl}/api/maps/urls-to-coordinates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: batch })
          })

          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`)
          }

          const batchData = await response.json()
          
          if (!batchData.success) {
            throw new Error(batchData.error || 'Error al procesar lote')
          }
          
          allCoordinates.push(...batchData.coordinates)
        } catch (error) {
          console.error(`Error procesando lote ${i + 1}/${batches.length}:`, error)
          
          // Si es un error de conexión, detener todo
          if (error.message.includes('Failed to fetch') || 
              error.message.includes('ERR_CONNECTION_REFUSED') ||
              error.name === 'AbortError' ||
              error.name === 'TypeError') {
            setLoading(false)
            setLoadingProgress({ current: 0, total: 0, percentage: 0 })
            toast.error('❌ Error de conexión: El servidor backend no está disponible. Verifica que el servidor esté corriendo en el puerto 5055.')
            return
          }
          
          // Para otros errores, agregar nulls para mantener el índice correcto
          allCoordinates.push(...Array(batch.length).fill(null))
        }
        
        // Actualizar progreso
        const processed = Math.min((i + 1) * batchSize, allUrls.length)
        const percentage = Math.round((processed / allUrls.length) * 100)
        setLoadingProgress({ 
          current: processed, 
          total: allUrls.length, 
          percentage 
        })
      }
      
      // Crear objeto data combinado (las coordenadas ya están procesadas en allCoordinates)

      // Procesar coordenadas usando el mapa de URLs normalizadas
      const coordenadasRecojo = []
      const coordenadasEntrega = []
      const coordenadasCombinadas = []

      // Mapear coordenadas de vuelta a las URLs normalizadas
      let coordIndex = 0
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        batch.forEach((url) => {
          const coords = allCoordinates[coordIndex]
          coordIndex++
          
          if (!coords || !coords.lat || !coords.lng) return

          const latLng = new window.google.maps.LatLng(coords.lat, coords.lng)
          const urlData = urlsMap.get(url)
          
          if (!urlData) return // Si no existe en el mapa, saltar

          // Procesar todos los pedidos asociados a esta URL normalizada
          urlData.pedidos.forEach(orderData => {
            if (orderData.tipo === 'recojo') {
              coordenadasRecojo.push(latLng)
              coordenadasCombinadas.push({
                location: latLng,
                weight: 1,
                tipo: 'recojo'
              })
            } else if (orderData.tipo === 'entrega') {
              coordenadasEntrega.push(latLng)
              coordenadasCombinadas.push({
                location: latLng,
                weight: 1,
                tipo: 'entrega'
              })
            }
          })
        })
      }

      if (coordenadasCombinadas.length === 0) {
        toast.warning('No se pudieron convertir las direcciones a coordenadas')
        setLoading(false)
        return
      }

      // Limpiar capas anteriores
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null)
      }
      if (markerLayerRef.current) {
        markerLayerRef.current.forEach(marker => marker.setMap(null))
      }

      // Agrupar coordenadas por ubicación para crear pesos
      // Ya tenemos el conteo en coordenadasCountMap, pero necesitamos consolidar
      const coordMap = new Map()
      coordenadasCombinadas.forEach(coord => {
        const key = `${coord.location.lat()},${coord.location.lng()}`
        if (!coordMap.has(key)) {
          coordMap.set(key, {
            location: coord.location,
            weight: 0,
            tipos: new Set()
          })
        }
        const entry = coordMap.get(key)
        entry.weight += coord.weight // Sumar el peso (número de ocurrencias)
        entry.tipos.add(coord.tipo)
      })

      // Crear datos para el heatmap con pesos basados en ocurrencias
      const heatmapData = Array.from(coordMap.values()).map(entry => ({
        location: entry.location,
        weight: entry.weight // El peso refleja cuántas veces aparece esta ubicación
      }))
      
      console.log(`🔥 Datos para heatmap: ${heatmapData.length} ubicaciones únicas con pesos totales`)

      // Verificar que la librería de visualization esté disponible
      if (!window.google || !window.google.maps || !window.google.maps.visualization) {
        toast.error('Error: La librería de Google Maps Visualization no está disponible. Verifica que la API key tenga habilitada la API de Maps JavaScript y la librería de visualization.')
        console.error('Google Maps Visualization no está disponible:', {
          google: !!window.google,
          maps: !!(window.google && window.google.maps),
          visualization: !!(window.google && window.google.maps && window.google.maps.visualization)
        })
        setLoading(false)
        setLoadingProgress({ current: 0, total: 0, percentage: 0 })
        return
      }

      // Crear el heatmap
      const heatmap = new window.google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: mapInstanceRef.current,
        radius: 50,
        opacity: 0.6
      })

      heatmapLayerRef.current = heatmap

      // Crear marcadores para puntos individuales (opcional, para debugging)
      const markers = []
      coordMap.forEach((entry, key) => {
        const [lat, lng] = key.split(',').map(Number)
        const tipos = Array.from(entry.tipos)
        const iconUrl = tipos.length === 2 
          ? 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' // Ambos
          : tipos[0] === 'recojo'
          ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' // Solo recojo
          : 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' // Solo entrega

        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: mapInstanceRef.current,
          icon: {
            url: iconUrl,
            scaledSize: new window.google.maps.Size(20, 20)
          },
          title: `${entry.weight} pedido(s) - ${tipos.join(', ')}`
        })

        markers.push(marker)
      })

      markerLayerRef.current = markers

      // Ajustar el zoom para mostrar todos los puntos
      if (heatmapData.length > 0) {
        const bounds = new window.google.maps.LatLngBounds()
        heatmapData.forEach(point => bounds.extend(point.location))
        mapInstanceRef.current.fitBounds(bounds)
      }

      toast.success(`Mapa de calor generado con ${heatmapData.length} ubicaciones`)
      
    } catch (error) {
      console.error('❌ Error generando mapa de calor:', error)
      toast.error(`Error: ${error.message}`)
    } finally {
      setLoading(false)
      setLoadingProgress({ current: 0, total: 0, percentage: 0 })
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1400px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid #e0e0e0',
          boxSizing: 'border-box',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          flexShrink: 0
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2c3e50' }}>
            🗺️ Mapa de Calor de Pedidos
          </h2>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '32px',
              cursor: 'pointer',
              color: '#666',
              padding: '4px 12px',
              lineHeight: '1',
              fontWeight: '300',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.color = '#000'}
            onMouseLeave={(e) => e.target.style.color = '#666'}
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          backgroundColor: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              max={fechaFin || getTodayDate()}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#fff'
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              min={fechaInicio}
              max={getTodayDate()}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#fff'
              }}
            />
          </div>
          <button
            onClick={generarMapaCalor}
            disabled={loading || !fechaInicio || !fechaFin || !mapLoaded}
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              cursor: (loading || !fechaInicio || !fechaFin || !mapLoaded) ? 'not-allowed' : 'pointer',
              opacity: (loading || !fechaInicio || !fechaFin || !mapLoaded) ? 0.6 : 1
            }}
          >
            {loading ? '🔄 Generando...' : '📍 Generar Mapa de Calor'}
          </button>
        </div>

        {/* Map Container */}
        <div style={{
          flex: 1,
          position: 'relative',
          minHeight: '500px',
          backgroundColor: '#f0f0f0',
          overflow: 'hidden'
        }}>
          {!mapLoaded && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#666',
              zIndex: 10
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
              <div>Cargando Google Maps...</div>
            </div>
          )}
          {loading && loadingProgress.total > 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '24px 32px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              zIndex: 20,
              minWidth: '300px'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔄</div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#2c3e50' }}>
                Procesando direcciones...
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                {loadingProgress.current} de {loadingProgress.total} URLs
              </div>
              <div style={{
                width: '100%',
                height: '24px',
                backgroundColor: '#e0e0e0',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: `${loadingProgress.percentage}%`,
                  height: '100%',
                  backgroundColor: '#3498db',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {loadingProgress.percentage}%
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Esto puede tomar unos momentos...
              </div>
            </div>
          )}
          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '500px'
            }}
          />
        </div>

        {/* Legend */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa',
          fontSize: '12px',
          color: '#666',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: 'rgba(255, 0, 0, 0.6)',
                borderRadius: '50%'
              }} />
              <span>Punto de Recojo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: 'rgba(0, 255, 0, 0.6)',
                borderRadius: '50%'
              }} />
              <span>Punto de Entrega</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: 'rgba(0, 0, 255, 0.6)',
                borderRadius: '50%'
              }} />
              <span>Ambos (Recojo y Entrega)</span>
            </div>
            <div style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
              Las zonas más intensas indican mayor actividad de pedidos
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

