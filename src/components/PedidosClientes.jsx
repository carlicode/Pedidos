import { useState, useEffect, useRef } from 'react'
import Icon from './Icon'
import { toast } from 'react-toastify'

/**
 * Componente modular para gestionar pedidos de clientes
 * Muestra pedidos del sheet "Clientes" con alertas de nuevos pedidos
 */
export default function PedidosClientes() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)
  const [nuevoPedidoDetectado, setNuevoPedidoDetectado] = useState(false)
  const audioRef = useRef(null)
  const pedidosAnterioresRef = useRef([])
  const intervalRef = useRef(null)

  // Cargar pedidos al montar el componente
  useEffect(() => {
    cargarPedidos()
    
    // TODO: El polling automático se reemplazará con N8N + Webhooks
    // N8N detectará nuevos pedidos en Google Sheets y enviará notificaciones
    // en tiempo real mediante webhooks al backend
    
    // Descomentar para polling manual (deshabilitado por ahora):
    // intervalRef.current = setInterval(() => {
    //   cargarPedidos(true) // true = modo silencioso
    // }, 30000) // 30 segundos
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  /**
   * Cargar pedidos desde el backend
   */
  const cargarPedidos = async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true)

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      const response = await fetch(`${backendUrl}/api/read-client-orders`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📦 Pedidos de clientes recibidos:', data)

      const pedidosFormateados = data.data.map(pedido => {
        // Debug: Verificar nombres de columnas disponibles
        if (data.data.indexOf(pedido) === 0) {
          console.log('📋 Columnas disponibles en el primer pedido:', Object.keys(pedido))
          console.log('🔍 Estado Pedido encontrado:', pedido['Estado Pedido'])
        }
        
        const pedidoFormateado = {
          id: pedido.ID,
          fechaRegistro: pedido['Fecha Registro'] || '',
          horaRegistro: pedido['Hora Registro'] || '',
          cliente: pedido.Cliente || '',
          direccionRecojo: pedido['Direccion Recojo'] || pedido['Dirección Recojo'] || '',
          direccionEntrega: pedido['Direccion Entrega'] || pedido['Dirección Entrega'] || pedido['DireccionEntrega'] || '',
          infoRecojo: pedido['Info. Adicional Recojo'] || pedido['Info Adicional Recojo'] || '',
          infoEntrega: pedido['Info. Adicional Entrega'] || pedido['Info Adicional Entrega'] || '',
          detalles: pedido['Detalles de la Carrera'] || pedido['Detalles de la Carrera'] || '',
          distancia: pedido['Dist. [Km]'] || pedido['Dist [Km]'] || '',
          precio: pedido['Precio [Bs]'] || pedido['Precio [Bs]'] || '',
          fechaDeseada: pedido.Fechas || '',
          horaDeseada: pedido['Hora Ini'] || '',
          estado: pedido['Estado Pedido'] || 'Pendiente',
          estadoPago: pedido['Estado de pago'] || pedido['Estado de pago'] || '',
          cobroPago: pedido['Cobro o pago'] || '',
          montoCobroPago: pedido['Monto cobro o pago'] || '',
          descripcionCobroPago: pedido['Descripcion de cobro o pago'] || '',
          biker: pedido.Biker || '',
          operador: pedido.Operador || 'Portal Web',
          idPedidoCreado: pedido.ID_pedido || '' // ID del pedido creado en el sistema principal
        }
        
        // Debug: Log de pedidos cancelados
        if (pedidoFormateado.estado === 'CANCELADO') {
          console.log('🚫 Pedido CANCELADO detectado:', pedidoFormateado.id, pedidoFormateado.cliente)
        }
        
        return pedidoFormateado
      }).sort((a, b) => b.id - a.id)
      
      // Debug: Contar pedidos por estado
      console.log('📊 Resumen de pedidos:')
      console.log('  - Total:', pedidosFormateados.length)
      console.log('  - Cancelados:', pedidosFormateados.filter(p => p.estado === 'CANCELADO').length)
      console.log('  - Con ID_pedido:', pedidosFormateados.filter(p => p.idPedidoCreado).length)
      console.log('  - Pendientes:', pedidosFormateados.filter(p => p.estado !== 'CANCELADO' && !p.idPedidoCreado).length)

      // Detectar nuevos pedidos
      // Solo detectar si hay pedidos anteriores (para evitar notificaciones en la primera carga)
      if (pedidosAnterioresRef.current.length > 0) {
        const idsAnteriores = new Set(pedidosAnterioresRef.current.map(p => p.id))
        const pedidosNuevos = pedidosFormateados.filter(p => !idsAnteriores.has(p.id))
        
        if (pedidosNuevos.length > 0) {
          console.log('🔔 Nuevo pedido detectado:', pedidosNuevos)
          // ¡Nuevo pedido detectado!
          setNuevoPedidoDetectado(true)
          
          // Reproducir sonido de notificación
          if (audioRef.current) {
            audioRef.current.play().catch(err => console.log('No se pudo reproducir audio:', err))
          }
          
          // Mostrar toast con información del nuevo pedido
          pedidosNuevos.forEach(pedido => {
            toast.success(
              `🚨 ¡Nuevo pedido de cliente!\n#${pedido.id} - ${pedido.cliente}\n${pedido.direccionRecojo} → ${pedido.direccionEntrega}`,
              {
                autoClose: 10000,
                position: 'top-center',
                style: {
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '15px'
                }
              }
            )
          })
        }
      }

      pedidosAnterioresRef.current = pedidosFormateados
      setPedidos(pedidosFormateados)
      setUltimaActualizacion(new Date())
    } catch (error) {
      console.error('❌ Error cargando pedidos de clientes:', error)
      if (!silencioso) {
        toast.error(`Error: ${error.message}`)
      }
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  /**
   * Marcar alerta como vista
   */
  const marcarAlertaVista = () => {
    setNuevoPedidoDetectado(false)
  }

  /**
   * Crear pedido desde pedido de cliente
   * Guarda los datos en localStorage y cambia al tab de agregar pedido
   */
  const crearPedidoDesdeCliente = (pedidoCliente) => {
    // Guardar datos del pedido cliente en localStorage
    const datosPedido = {
      cliente: pedidoCliente.cliente,
      recojo: 'Manual', // Campo requerido - marcar como "Manual" para pedidos de clientes
      entrega: 'Manual', // Campo requerido - marcar como "Manual" para pedidos de clientes
      direccion_recojo: pedidoCliente.direccionRecojo,
      info_direccion_recojo: pedidoCliente.infoRecojo,
      direccion_entrega: pedidoCliente.direccionEntrega,
      info_direccion_entrega: pedidoCliente.infoEntrega,
      detalles_carrera: pedidoCliente.detalles,
      distancia_km: pedidoCliente.distancia,
      precio_bs: pedidoCliente.precio,
      hora_ini: pedidoCliente.horaDeseada,
      cobro_pago: pedidoCliente.cobroPago,
      monto_cobro_pago: pedidoCliente.montoCobroPago,
      descripcion_cobro_pago: pedidoCliente.descripcionCobroPago,
      idPedidoCliente: pedidoCliente.id, // ID del pedido en el sheet de clientes
      desdePedidoCliente: true // Flag para identificar que viene de pedido cliente
    }
    
    localStorage.setItem('pedidoClienteParaCrear', JSON.stringify(datosPedido))
    
    // Disparar evento personalizado para que Orders.jsx lo detecte
    window.dispatchEvent(new CustomEvent('crearPedidoDesdeCliente', {
      detail: datosPedido
    }))
    
    toast.success('Datos cargados. Cambiando al formulario...', {
      autoClose: 2000
    })
  }

  /**
   * Cancelar pedido de cliente
   * Actualiza el estado a "CANCELADO" en Google Sheets
   */
  const cancelarPedidoCliente = async (pedidoCliente) => {
    const confirmar = window.confirm(
      `¿Estás seguro de que deseas cancelar el pedido #${pedidoCliente.id} de ${pedidoCliente.cliente}?`
    )
    
    if (!confirmar) return

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      const response = await fetch(`${backendUrl}/api/cliente/cancelar-pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idPedido: pedidoCliente.id
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error cancelando pedido')
      }

      toast.success(`Pedido #${pedidoCliente.id} cancelado exitosamente`)
      
      // Recargar pedidos para reflejar el cambio
      await cargarPedidos()

    } catch (error) {
      console.error('❌ Error cancelando pedido:', error)
      toast.error(`Error: ${error.message}`)
    }
  }

  /**
   * Separar pedidos en pendientes, entregados y cancelados
   */
  const pedidosPendientes = pedidos.filter(pedido => 
    pedido.estado !== 'CANCELADO' && (!pedido.idPedidoCreado || pedido.idPedidoCreado === '')
  )
  
  const pedidosEntregados = pedidos.filter(pedido => 
    pedido.estado !== 'CANCELADO' && pedido.idPedidoCreado && pedido.idPedidoCreado !== ''
  )

  const pedidosCancelados = pedidos.filter(pedido => 
    pedido.estado === 'CANCELADO'
  )

  /**
   * Filtrar pedidos pendientes
   */
  const pedidosPendientesFiltrados = pedidosPendientes.filter(pedido => {
    // Filtro por estado
    if (filtroEstado !== 'todos' && pedido.estado !== filtroEstado) {
      return false
    }

    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase()
      const matchCliente = pedido.cliente.toLowerCase().includes(searchLower)
      const matchId = pedido.id.toString().includes(searchLower)
      const matchRecojo = pedido.direccionRecojo.toLowerCase().includes(searchLower)
      const matchEntrega = pedido.direccionEntrega.toLowerCase().includes(searchLower)
      
      if (!matchCliente && !matchId && !matchRecojo && !matchEntrega) {
        return false
      }
    }

    return true
  })

  /**
   * Filtrar pedidos entregados
   */
  const pedidosEntregadosFiltrados = pedidosEntregados.filter(pedido => {
    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase()
      const matchCliente = pedido.cliente.toLowerCase().includes(searchLower)
      const matchId = pedido.id.toString().includes(searchLower)
      const matchIdPedido = pedido.idPedidoCreado.toString().includes(searchLower)
      const matchRecojo = pedido.direccionRecojo.toLowerCase().includes(searchLower)
      const matchEntrega = pedido.direccionEntrega.toLowerCase().includes(searchLower)
      
      if (!matchCliente && !matchId && !matchIdPedido && !matchRecojo && !matchEntrega) {
        return false
      }
    }

    return true
  })

  /**
   * Filtrar pedidos cancelados
   */
  const pedidosCanceladosFiltrados = pedidosCancelados.filter(pedido => {
    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase()
      const matchCliente = pedido.cliente.toLowerCase().includes(searchLower)
      const matchId = pedido.id.toString().includes(searchLower)
      const matchRecojo = pedido.direccionRecojo.toLowerCase().includes(searchLower)
      const matchEntrega = pedido.direccionEntrega.toLowerCase().includes(searchLower)
      
      if (!matchCliente && !matchId && !matchRecojo && !matchEntrega) {
        return false
      }
    }

    return true
  })

  // Mantener compatibilidad con código existente
  const pedidosFiltrados = [...pedidosPendientesFiltrados, ...pedidosEntregadosFiltrados, ...pedidosCanceladosFiltrados]

  /**
   * Obtener color del badge de estado
   */
  const getEstadoColor = (estado) => {
    const colores = {
      'Pendiente': '#ffc107',
      'En proceso': '#17a2b8',
      'Entregado': '#28a745',
      'Cancelado': '#dc3545'
    }
    return colores[estado] || '#6c757d'
  }

  /**
   * Obtener estadísticas
   */
  const stats = {
    total: pedidos.length,
    pendientes: pedidos.filter(p => p.estado === 'Pendiente').length,
    enProceso: pedidos.filter(p => p.estado === 'En proceso').length,
    entregados: pedidos.filter(p => p.estado === 'Entregado').length
  }

  const paletteDireccion = {
    recojo: {
      text: '#3b82f6',
      border: 'rgba(59,130,246,0.2)',
      badge: 'rgba(59,130,246,0.15)'
    },
    entrega: {
      text: '#10b981',
      border: 'rgba(16,185,129,0.2)',
      badge: 'rgba(16,185,129,0.15)'
    }
  }

  const isMapsLink = (valor = '') => {
    if (!valor) return false
    const normalized = valor.toLowerCase()
    return normalized.includes('http') || normalized.includes('maps.') || normalized.includes('goo.gl') || normalized.includes('google.com/maps')
  }

  const renderDireccionCard = ({ titulo, color, icon, direccion, info }) => (
    <div style={{
      padding: '10px 12px',
      borderRadius: '10px',
      border: `1px solid ${color.border}`,
      background: '#f1f3f5 !important',
      boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start'
    }}>
      <div style={{ 
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: color.badge,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon name={icon} size={14} color={color.text} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: '9px', 
          color: color.text, 
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '4px'
        }}>
          {titulo}
        </div>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: '600', 
          color: 'var(--text)',
          lineHeight: '1.4',
          wordBreak: 'break-word'
        }}>
          {direccion ? (
            isMapsLink(direccion) ? (
              <a 
                href={direccion.startsWith('http') ? direccion : `https://${direccion}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pedido-direccion-link"
                style={{
                  color: color.text,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  wordBreak: 'break-all'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="external-link" size={12} color={color.text} />
                {direccion}
              </a>
            ) : (
              direccion
            )
          ) : (
            <span style={{ color: 'var(--muted)', fontWeight: '500' }}>No especificado</span>
          )}
        </div>
        {info && (
          <div style={{
            fontSize: '10px',
            color: 'var(--muted)',
            fontStyle: 'italic',
            marginTop: '4px'
          }}>
            ℹ️ {info}
          </div>
        )}
      </div>
    </div>
  )

  const renderDetallesChip = (label, value, icon, highlightColor = '#475569') => {
    if (!value) return null
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 600,
        color: highlightColor,
        background: '#f1f3f5 !important',
        border: '1px solid var(--border)',
        borderRadius: '999px',
        padding: '6px 12px'
      }}>
        <Icon name={icon} size={14} color={highlightColor} />
        <span>{label}: {value}</span>
      </span>
    )
  }

  const renderDetallesCard = (pedido) => (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      background: '#f1f3f5 !important',
      boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
      fontSize: '12px',
      color: 'var(--text)'
    }}>
      <strong style={{ fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#6366f1' }}>
        Detalles
      </strong>
      <div style={{ fontSize: '13px', lineHeight: '1.5', marginTop: '4px' }}>
        {pedido.detalles || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Sin detalles adicionales</span>}
      </div>
    </div>
  )

  const renderScheduleCard = (pedido) => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px'
    }}>
      {renderDetallesChip('Fecha', pedido.fechaDeseada, 'calendar', '#92400e')}
      {renderDetallesChip('Hora', pedido.horaDeseada, 'clock', '#92400e')}
    </div>
  )

  const renderCobroCard = (pedido) => {
    if (!pedido.cobroPago || pedido.cobroPago === 'Ninguno') {
      return renderDetallesChip('Cobro/Pago', 'Sin monto', 'creditCard', '#475569')
    }
    const color = pedido.cobroPago === 'Cobrar' ? '#92400e' : '#1e40af'
    const text = `${pedido.cobroPago === 'Cobrar' ? 'Cobrar' : 'Pagar'} ${pedido.montoCobroPago || ''} Bs`.trim()
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {renderDetallesChip('Operación', text, 'creditCard', color)}
        {pedido.descripcionCobroPago && renderDetallesChip('Detalle', pedido.descripcionCobroPago, 'fileText', color)}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p>Cargando pedidos de clientes...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Audio para notificación */}
      <audio ref={audioRef} src="/music/new-notification.mp3" />

      {/* Alerta de nuevo pedido */}
      {nuevoPedidoDetectado && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: '3px solid #10b981',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              background: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              animation: 'bounce 1s ease-in-out infinite'
            }}>
              🚨
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '700' }}>
                ¡Nuevos Pedidos de Clientes!
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
                Se han detectado nuevos pedidos que requieren atención
              </p>
            </div>
          </div>
          <button
            onClick={marcarAlertaVista}
            style={{
              background: 'white',
              color: '#10b981',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Entendido
          </button>
        </div>
      )}

      {/* Header con estadísticas */}
      <div style={{
        background: '#f1f3f5 !important',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
              📱 Pedidos de Clientes
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>
              Pedidos realizados desde el portal web
              {ultimaActualizacion && (
                <span style={{ marginLeft: '8px' }}>
                  • Última actualización: {ultimaActualizacion.toLocaleTimeString('es-BO')}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => cargarPedidos()}
            className="btn"
            style={{
              padding: '10px 20px',
              background: 'var(--brand)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Icon name="refresh-cw" size={16} />
            Actualizar
          </button>
        </div>

        {/* Estadísticas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '2px solid #93c5fd',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e40af' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
              Total
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #fcd34d',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#92400e' }}>
              {stats.pendientes}
            </div>
            <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600' }}>
              Pendientes
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
            border: '2px solid #67e8f9',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#164e63' }}>
              {stats.enProceso}
            </div>
            <div style={{ fontSize: '12px', color: '#06b6d4', fontWeight: '600' }}>
              En Proceso
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            border: '2px solid #6ee7b7',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#065f46' }}>
              {stats.entregados}
            </div>
            <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
              Entregados
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        background: '#f1f3f5 !important',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
              Buscar
            </label>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)'
              }} />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Cliente, #ID, dirección..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  border: '1px solid var(--input-border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'var(--input-bg)'
                }}
              />
            </div>
          </div>

          <div style={{ minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--input-border)',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'var(--input-bg)',
                cursor: 'pointer'
              }}
            >
              <option value="todos">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En proceso">En Proceso</option>
              <option value="Entregado">Entregado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sección: Pedidos Pendientes */}
      <>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '700', 
          color: '#111827',
          marginTop: '20px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>⏳</span>
          Pendientes ({pedidosPendientesFiltrados.length})
        </h3>
        {pedidosPendientesFiltrados.length > 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {pedidosPendientesFiltrados.map(pedido => {
            // Verificar si el pedido está atrasado
            const isAtrasado = () => {
              if (pedido.estado !== 'Pendiente') return false
              if (!pedido.fechaDeseada || !pedido.horaDeseada) return false
              
              try {
                // Parsear fecha y hora deseada
                const [dia, mes, año] = pedido.fechaDeseada.split('/').map(n => parseInt(n))
                const [hora, minuto] = pedido.horaDeseada.split(':').map(n => parseInt(n))
                
                // Crear fecha/hora deseada
                const fechaDeseada = new Date(año, mes - 1, dia, hora, minuto)
                
                // Comparar con fecha actual
                const ahora = new Date()
                
                return ahora > fechaDeseada
              } catch (e) {
                return false
              }
            }
            
            const atrasado = isAtrasado()
            
            return (
              <div
                key={pedido.id}
                className="card"
                style={{
                  background: `${atrasado ? '#fef2f2' : '#f1f3f5'} !important`,
                  border: `2px solid ${atrasado ? '#fca5a5' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  padding: '0',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
              {/* Header estilo Kanban */}
              <div style={{
                background: atrasado ? '#dc2626' : getEstadoColor(pedido.estado),
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'white'
                  }}>
                    #{pedido.id}
                  </span>
                  {pedido.idPedidoCreado && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.25)',
                      color: 'white'
                    }}>
                      ✓ #{pedido.idPedidoCreado}
                    </span>
                  )}
                  {pedido.operador === 'Portal Web' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.25)',
                      color: 'white'
                    }}>
                      🌐 WEB
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: '500'
                }}>
                  {pedido.fechaRegistro}
                </div>
              </div>

              {/* Contenido */}
              <div style={{ padding: '16px' }}>

                {/* Nombre del cliente y biker */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '700', 
                    color: '#0f172a',
                    marginBottom: '4px'
                  }}>
                    {pedido.cliente}
                  </div>
                  {pedido.biker && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      👤 {pedido.biker}
                    </div>
                  )}
                </div>

                {/* Precio destacado */}
                {pedido.precio && (
                  <div style={{
                    background: '#f1f3f5 !important',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ 
                      fontSize: '22px', 
                      fontWeight: '900', 
                      color: '#78350f'
                    }}>
                      {pedido.precio} Bs
                    </div>
                    {pedido.distancia && (
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '700', 
                        color: '#92400e'
                      }}>
                        📏 {pedido.distancia} km
                      </div>
                    )}
                  </div>
                )}

                {/* Recojo y Entrega en estilo compacto */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '12px',
                  fontSize: '13px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#64748b',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Hotel Cochabamba
                    </div>
                    <div>
                      {pedido.direccionRecojo ? (
                        isMapsLink(pedido.direccionRecojo) ? (
                          <a 
                            href={pedido.direccionRecojo.startsWith('http') ? pedido.direccionRecojo : `https://${pedido.direccionRecojo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'none',
                              fontWeight: '600',
                              fontSize: '12px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Aldeas SOS
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '500' }}>
                            {pedido.direccionRecojo}
                          </span>
                        )
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>No especificado</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#94a3b8'
                  }}>
                    →
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#64748b',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Aldeas SOS
                    </div>
                    <div>
                      {pedido.direccionEntrega ? (
                        isMapsLink(pedido.direccionEntrega) ? (
                          <a 
                            href={pedido.direccionEntrega.startsWith('http') ? pedido.direccionEntrega : `https://${pedido.direccionEntrega}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#10b981',
                              textDecoration: 'none',
                              fontWeight: '600',
                              fontSize: '12px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver mapa →
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '500' }}>
                            {pedido.direccionEntrega}
                          </span>
                        )
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>No especificado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalles */}
                {pedido.detalles && (
                  <div style={{
                    background: '#f1f3f5 !important',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      color: '#9ca3af',
                      marginBottom: '6px',
                      letterSpacing: '0.1em'
                    }}>
                      Detalles
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#374151',
                      lineHeight: '1.5',
                      fontWeight: '500'
                    }}>
                      {pedido.detalles}
                    </div>
                  </div>
                )}

                {/* Fecha y Hora deseada */}
                {(pedido.fechaDeseada || pedido.horaDeseada) && (
                  <div style={{
                    background: '#f1f3f5 !important',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      color: '#9ca3af',
                      marginBottom: '6px',
                      letterSpacing: '0.1em'
                    }}>
                      Fecha/Hora Deseada
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#374151',
                      fontWeight: '600',
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      {pedido.fechaDeseada && <span>📅 {pedido.fechaDeseada}</span>}
                      {pedido.horaDeseada && <span>⏰ {pedido.horaDeseada}</span>}
                    </div>
                  </div>
                )}

                {/* Cobro/Pago */}
                {pedido.cobroPago && pedido.cobroPago !== 'Ninguno' && (
                  <div style={{
                    background: '#f1f3f5 !important',
                    padding: '12px',
                    borderRadius: '8px',
                    border: pedido.cobroPago === 'Cobrar'
                      ? '1px solid #6ee7b7'
                      : '1px solid #93c5fd'
                  }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      color: pedido.cobroPago === 'Cobrar' ? '#065f46' : '#1e40af',
                      marginBottom: '6px',
                      letterSpacing: '0.1em'
                    }}>
                      Cobro/Pago
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: pedido.cobroPago === 'Cobrar' ? '#064e3b' : '#1e3a8a',
                      fontWeight: '700',
                      marginBottom: pedido.descripcionCobroPago ? '6px' : '0'
                    }}>
                      {pedido.cobroPago === 'Cobrar' ? '💰 Cobrar' : '💸 Pagar'} 
                      {pedido.montoCobroPago && ` ${pedido.montoCobroPago} Bs`}
                    </div>
                    {pedido.descripcionCobroPago && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: pedido.cobroPago === 'Cobrar' ? '#065f46' : '#1e40af',
                        fontWeight: '500'
                      }}>
                        {pedido.descripcionCobroPago}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Botones de acción */}
                {pedido.estado === 'Pendiente' && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <button
                      onClick={() => crearPedidoDesdeCliente(pedido)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#059669'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#10b981'
                      }}
                    >
                      ✓ Crear Pedido
                    </button>
                    
                    <button
                      onClick={() => cancelarPedidoCliente(pedido)}
                      style={{
                        padding: '10px 16px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#dc2626'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ef4444'
                      }}
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                )}
              </div>
              </div>
            )
          })}
          </div>
        ) : (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            No hay pedidos pendientes
          </div>
        )}
      </>

      {/* Sección: Pedidos Entregados */}
      <>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '700', 
          color: '#111827',
          marginTop: '32px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          Entregados ({pedidosEntregadosFiltrados.length})
        </h3>
        {pedidosEntregadosFiltrados.length > 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {pedidosEntregadosFiltrados.map(pedido => {
              return (
                <div
                  key={pedido.id}
                  className="card"
                  style={{
                    background: '#f1f3f5 !important',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    position: 'relative',
                    opacity: 0.85
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                    e.currentTarget.style.borderColor = '#d1d5db'
                    e.currentTarget.style.opacity = '1'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.opacity = '0.85'
                  }}
                >
                  {/* Header compacto */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#111827'
                      }}>
                        Pedido #{pedido.id}
                      </span>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: '#10b981',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ✓ CREADO #{pedido.idPedidoCreado}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '12px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      <span>📅 {pedido.fechaRegistro}</span>
                      <span>⏰ {pedido.horaRegistro}</span>
                    </div>
                  </div>

                  {/* Información en grid compacto */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    {/* Cliente */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#9ca3af',
                        marginBottom: '6px',
                        letterSpacing: '0.1em'
                      }}>
                        Cliente
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {pedido.cliente}
                      </div>
                      {pedido.biker && (
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#6b7280',
                          marginTop: '6px',
                          fontWeight: '500'
                        }}>
                          👤 {pedido.biker}
                        </div>
                      )}
                    </div>

                    {/* Precio y Distancia */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#92400e',
                        marginBottom: '6px',
                        letterSpacing: '0.1em'
                      }}>
                        Precio / Distancia
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '800', 
                        color: '#78350f',
                        lineHeight: '1'
                      }}>
                        {pedido.precio ? `${pedido.precio} Bs` : 'Sin precio'}
                      </div>
                      {pedido.distancia && (
                        <div style={{ 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#92400e',
                          marginTop: '4px'
                        }}>
                          📏 {pedido.distancia} km
                        </div>
                      )}
                    </div>

                    {/* Recojo */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#1e40af',
                        marginBottom: '8px',
                        letterSpacing: '0.1em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>🚚</span> Recojo
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e3a8a', fontWeight: '500' }}>
                        {pedido.direccionRecojo ? (
                          isMapsLink(pedido.direccionRecojo) ? (
                            <a 
                              href={pedido.direccionRecojo.startsWith('http') ? pedido.direccionRecojo : `https://${pedido.direccionRecojo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver ubicación en mapa →
                            </a>
                          ) : (
                            pedido.direccionRecojo
                          )
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No especificado</span>
                        )}
                      </div>
                      {pedido.infoRecojo && (
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#475569',
                          marginTop: '6px',
                          fontStyle: 'italic'
                        }}>
                          ℹ️ {pedido.infoRecojo}
                        </div>
                      )}
                    </div>

                    {/* Entrega */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#065f46',
                        marginBottom: '8px',
                        letterSpacing: '0.1em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>📦</span> Entrega
                      </div>
                      <div style={{ fontSize: '12px', color: '#064e3b', fontWeight: '500' }}>
                        {pedido.direccionEntrega ? (
                          isMapsLink(pedido.direccionEntrega) ? (
                            <a 
                              href={pedido.direccionEntrega.startsWith('http') ? pedido.direccionEntrega : `https://${pedido.direccionEntrega}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#059669',
                                textDecoration: 'none',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver ubicación en mapa →
                            </a>
                          ) : (
                            pedido.direccionEntrega
                          )
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No especificado</span>
                        )}
                      </div>
                      {pedido.infoEntrega && (
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#475569',
                          marginTop: '6px',
                          fontStyle: 'italic'
                        }}>
                          ℹ️ {pedido.infoEntrega}
                        </div>
                      )}
                    </div>

                    {/* Detalles */}
                    {pedido.detalles && (
                      <div style={{
                        background: '#f1f3f5 !important',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: '#9ca3af',
                          marginBottom: '6px',
                          letterSpacing: '0.1em'
                        }}>
                          Detalles
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#374151',
                          lineHeight: '1.5',
                          fontWeight: '500'
                        }}>
                          {pedido.detalles}
                        </div>
                      </div>
                    )}

                    {/* Fecha y Hora deseada */}
                    {(pedido.fechaDeseada || pedido.horaDeseada) && (
                      <div style={{
                        background: '#f1f3f5 !important',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: '#9ca3af',
                          marginBottom: '6px',
                          letterSpacing: '0.1em'
                        }}>
                          Fecha/Hora Deseada
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#374151',
                          fontWeight: '600',
                          display: 'flex',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          {pedido.fechaDeseada && <span>📅 {pedido.fechaDeseada}</span>}
                          {pedido.horaDeseada && <span>⏰ {pedido.horaDeseada}</span>}
                        </div>
                      </div>
                    )}

                    {/* Cobro/Pago */}
                    {pedido.cobroPago && pedido.cobroPago !== 'Ninguno' && (
                      <div style={{
                        background: '#f1f3f5 !important',
                        padding: '12px',
                        borderRadius: '8px',
                        border: pedido.cobroPago === 'Cobrar'
                          ? '1px solid #6ee7b7'
                          : '1px solid #93c5fd'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: pedido.cobroPago === 'Cobrar' ? '#065f46' : '#1e40af',
                          marginBottom: '6px',
                          letterSpacing: '0.1em'
                        }}>
                          Cobro/Pago
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: pedido.cobroPago === 'Cobrar' ? '#064e3b' : '#1e3a8a',
                          fontWeight: '700',
                          marginBottom: pedido.descripcionCobroPago ? '6px' : '0'
                        }}>
                          {pedido.cobroPago === 'Cobrar' ? '💰 Cobrar' : '💸 Pagar'} 
                          {pedido.montoCobroPago && ` ${pedido.montoCobroPago} Bs`}
                        </div>
                        {pedido.descripcionCobroPago && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: pedido.cobroPago === 'Cobrar' ? '#065f46' : '#1e40af',
                            fontWeight: '500'
                          }}>
                            {pedido.descripcionCobroPago}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            No hay pedidos entregados
          </div>
        )}
      </>

      {/* Sección: Pedidos Cancelados */}
      <>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '700', 
          color: '#111827',
          marginTop: '32px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>🚫</span>
          Cancelados ({pedidosCanceladosFiltrados.length})
        </h3>
        {pedidosCanceladosFiltrados.length > 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {pedidosCanceladosFiltrados.map(pedido => {
              return (
                <div
                  key={pedido.id}
                  className="card"
                  style={{
                    background: '#fafafa !important',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.2s ease',
                    cursor: 'default',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    position: 'relative',
                    opacity: 0.7
                  }}
                >
                  {/* Header compacto */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#6b7280',
                        textDecoration: 'line-through'
                      }}>
                        Pedido #{pedido.id}
                      </span>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: '#ef4444',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ❌ CANCELADO
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '12px',
                      color: '#9ca3af',
                      fontWeight: '500'
                    }}>
                      <span>📅 {pedido.fechaRegistro}</span>
                      <span>⏰ {pedido.horaRegistro}</span>
                    </div>
                  </div>

                  {/* Información en grid compacto */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    {/* Cliente */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#9ca3af',
                        marginBottom: '6px',
                        letterSpacing: '0.1em'
                      }}>
                        Cliente
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        {pedido.cliente}
                      </div>
                      {pedido.biker && (
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#9ca3af',
                          marginTop: '6px',
                          fontWeight: '500'
                        }}>
                          👤 {pedido.biker}
                        </div>
                      )}
                    </div>

                    {/* Precio y Distancia */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#9ca3af',
                        marginBottom: '6px',
                        letterSpacing: '0.1em'
                      }}>
                        Precio / Distancia
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '800', 
                        color: '#6b7280',
                        lineHeight: '1'
                      }}>
                        {pedido.precio ? `${pedido.precio} Bs` : 'Sin precio'}
                      </div>
                      {pedido.distancia && (
                        <div style={{ 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#9ca3af',
                          marginTop: '4px'
                        }}>
                          📏 {pedido.distancia} km
                        </div>
                      )}
                    </div>

                    {/* Recojo */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#9ca3af',
                        marginBottom: '8px',
                        letterSpacing: '0.1em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>🚚</span> Recojo
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                        {pedido.direccionRecojo ? (
                          isMapsLink(pedido.direccionRecojo) ? (
                            <a 
                              href={pedido.direccionRecojo.startsWith('http') ? pedido.direccionRecojo : `https://${pedido.direccionRecojo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#6b7280',
                                textDecoration: 'none',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver ubicación en mapa →
                            </a>
                          ) : (
                            pedido.direccionRecojo
                          )
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No especificado</span>
                        )}
                      </div>
                      {pedido.infoRecojo && (
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#9ca3af',
                          marginTop: '6px',
                          fontStyle: 'italic'
                        }}>
                          ℹ️ {pedido.infoRecojo}
                        </div>
                      )}
                    </div>

                    {/* Entrega */}
                    <div style={{
                      background: '#f1f3f5 !important',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: '#9ca3af',
                        marginBottom: '8px',
                        letterSpacing: '0.1em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>📦</span> Entrega
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                        {pedido.direccionEntrega ? (
                          isMapsLink(pedido.direccionEntrega) ? (
                            <a 
                              href={pedido.direccionEntrega.startsWith('http') ? pedido.direccionEntrega : `https://${pedido.direccionEntrega}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#6b7280',
                                textDecoration: 'none',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver ubicación en mapa →
                            </a>
                          ) : (
                            pedido.direccionEntrega
                          )
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No especificado</span>
                        )}
                      </div>
                      {pedido.infoEntrega && (
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#9ca3af',
                          marginTop: '6px',
                          fontStyle: 'italic'
                        }}>
                          ℹ️ {pedido.infoEntrega}
                        </div>
                      )}
                    </div>

                    {/* Detalles */}
                    {pedido.detalles && (
                      <div style={{
                        background: '#f1f3f5 !important',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: '#9ca3af',
                          marginBottom: '6px',
                          letterSpacing: '0.1em'
                        }}>
                          Detalles
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          lineHeight: '1.5',
                          fontWeight: '500'
                        }}>
                          {pedido.detalles}
                        </div>
                      </div>
                    )}

                    {/* Fecha y Hora deseada */}
                    {(pedido.fechaDeseada || pedido.horaDeseada) && (
                      <div style={{
                        background: '#f1f3f5 !important',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: '#9ca3af',
                          marginBottom: '6px',
                          letterSpacing: '0.1em'
                        }}>
                          Fecha/Hora Deseada
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontWeight: '600',
                          display: 'flex',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          {pedido.fechaDeseada && <span>📅 {pedido.fechaDeseada}</span>}
                          {pedido.horaDeseada && <span>⏰ {pedido.horaDeseada}</span>}
                        </div>
                      </div>
                    )}

                    {/* Cobro/Pago */}
                    {pedido.cobroPago && pedido.cobroPago !== 'Ninguno' && (
                      <div style={{
                        background: '#f1f3f5 !important',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: '#9ca3af',
                          marginBottom: '6px',
                          letterSpacing: '0.1em'
                        }}>
                          Cobro/Pago
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#6b7280',
                          fontWeight: '700',
                          marginBottom: pedido.descripcionCobroPago ? '6px' : '0'
                        }}>
                          {pedido.cobroPago === 'Cobrar' ? '💰 Cobrar' : '💸 Pagar'} 
                          {pedido.montoCobroPago && ` ${pedido.montoCobroPago} Bs`}
                        </div>
                        {pedido.descripcionCobroPago && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#9ca3af',
                            fontWeight: '500'
                          }}>
                            {pedido.descripcionCobroPago}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            No hay pedidos cancelados
          </div>
        )}
      </>

      {/* Mensaje si no hay pedidos */}
      {pedidosFiltrados.length === 0 && (
        <div style={{
          background: '#f1f3f5 !important',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
            No hay pedidos
          </h3>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
            {busqueda || filtroEstado !== 'todos'
              ? 'No se encontraron pedidos con los filtros aplicados'
              : 'Los pedidos de clientes aparecerán aquí'}
          </p>
        </div>
      )}
      
      {/* Estilo para animaciones */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        /* Estilos para links de direcciones */
        .pedido-direccion-link {
          transition: all 0.2s ease;
        }
        
        .pedido-direccion-link:hover {
          opacity: 0.8;
          text-decoration: underline !important;
        }
      `}</style>
    </div>
  )
}

