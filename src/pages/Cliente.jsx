import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import FormularioPedidoCliente from '../components/FormularioPedidoCliente'
import { toast } from 'react-toastify'

/**
 * Página del Portal de Cliente
 * Permite a los clientes ver sus pedidos y estadísticas
 */
export default function Cliente() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroFecha, setFiltroFecha] = useState('todos')
  const [estadisticas, setEstadisticas] = useState(null)
  
  // Estado para el modal de nuevo pedido (usando el componente modular)
  const [showNuevoPedido, setShowNuevoPedido] = useState(false)

  // Cargar pedidos del cliente
  useEffect(() => {
    if (user?.empresa) {
      cargarPedidos()
    }
  }, [user])

  // Calcular estadísticas cuando cambien los pedidos
  useEffect(() => {
    if (pedidos.length > 0) {
      calcularEstadisticas()
    }
  }, [pedidos])

  /**
   * Cargar pedidos desde el backend
   */
  const cargarPedidos = async () => {
    try {
      setLoading(true)
      console.log('🔄 Cargando pedidos para cliente:', user.empresa)

      // Obtener URL del backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      const response = await fetch(`${backendUrl}/api/read-client-orders`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📊 Datos recibidos del backend (pestaña Clientes):', data)

      // Filtrar pedidos del cliente
      // Filtrar pedidos del cliente
      const pedidosCliente = data.data
        .filter(pedido => {
          const match = pedido.Cliente === user.empresa || pedido.Cliente === user.name
          if (match) {
            console.log('✅ Pedido encontrado:', pedido.ID, pedido.Cliente)
          }
          return match
        })
        .map(pedido => ({
          id: pedido.ID,
          fecha: pedido['Fecha Registro'] || pedido.Fechas || '',  // Cambiado el orden
          hora: pedido['Hora Registro'] || pedido['Hora Ini'] || '',  // Usar Hora Registro primero
          recojo: pedido.Recojo || '',
          entrega: pedido.Entrega || '',
          biker: pedido.Biker || '',
          precio: parseFloat(pedido['Precio [Bs]']) || 0,
          estado: pedido.Estado || '',
          estadoPago: pedido['Estado de pago'] || '',
          detalles: pedido['Detalles de la Carrera'] || '',
          medioTransporte: pedido['Medio Transporte'] || '',
          distancia: pedido['Dist. [Km]'] || ''
        }))
        .sort((a, b) => b.id - a.id) // Ordenar por ID descendente

      console.log(`✅ ${pedidosCliente.length} pedidos encontrados para ${user.empresa}`)
      console.log('👤 Usuario:', user.empresa, '/', user.name)
      console.log('📦 IDs de pedidos:', pedidosCliente.map(p => p.id))
      setPedidos(pedidosCliente)
    } catch (error) {
      console.error('❌ Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Calcular estadísticas de los pedidos
   */
  const calcularEstadisticas = () => {
    const stats = {
      total: pedidos.length,
      pendientes: pedidos.filter(p => p.estado === 'Pendiente').length,
      enProceso: pedidos.filter(p => p.estado === 'En proceso').length,
      entregados: pedidos.filter(p => p.estado === 'Entregado').length,
      totalGastado: pedidos.reduce((sum, p) => sum + p.precio, 0),
      promedioGasto: pedidos.length > 0 ? pedidos.reduce((sum, p) => sum + p.precio, 0) / pedidos.length : 0
    }
    setEstadisticas(stats)
  }

  /**
   * Filtrar pedidos según los filtros seleccionados
   */
  const pedidosFiltrados = pedidos.filter(pedido => {
    // Filtro por estado
    if (filtroEstado !== 'todos' && pedido.estado !== filtroEstado) {
      return false
    }

    // Filtro por fecha
    if (filtroFecha !== 'todos') {
      const hoy = new Date()
      const fechaPedido = parsearFecha(pedido.fecha)
      
      if (!fechaPedido) return false

      if (filtroFecha === 'hoy') {
        return fechaPedido.toDateString() === hoy.toDateString()
      } else if (filtroFecha === 'semana') {
        const unaSemanaAtras = new Date(hoy)
        unaSemanaAtras.setDate(hoy.getDate() - 7)
        return fechaPedido >= unaSemanaAtras
      } else if (filtroFecha === 'mes') {
        const unMesAtras = new Date(hoy)
        unMesAtras.setMonth(hoy.getMonth() - 1)
        return fechaPedido >= unMesAtras
      }
    }

    return true
  })

  /**
   * Parsear fecha en formato DD/MM/YYYY
   */
  const parsearFecha = (fechaStr) => {
    if (!fechaStr) return null
    try {
      const [dia, mes, anio] = fechaStr.split('/')
      return new Date(anio, mes - 1, dia)
    } catch (error) {
      return null
    }
  }

  /**
   * Obtener color del badge según el estado
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
   * Obtener color del badge según el estado de pago
   */
  const getEstadoPagoColor = (estadoPago) => {
    const colores = {
      'Pagado': '#28a745',
      'QR Verificado': '#20c997',
      'Debe Cliente': '#ffc107',
      'Debe Biker': '#fd7e14',
      'Error Admin': '#dc3545',
      'Error Biker': '#dc3545',
      'Espera': '#6c757d',
      'Sin Biker': '#6c757d'
    }
    return colores[estadoPago] || '#6c757d'
  }

  /**
   * Abrir modal de nuevo pedido (usando componente modular)
   */
  const abrirNuevoPedido = () => {
    setShowNuevoPedido(true)
  }

  /**
   * Manejar éxito al crear pedido
   */
  const handlePedidoCreado = (result) => {
    console.log('✅ Pedido creado exitosamente:', result)
    cargarPedidos() // Recargar lista de pedidos
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p>Cargando tus pedidos...</p>
      </div>
    )
  }

  return (
    <div className="cliente-container" style={{ padding: '40px 24px', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="card" style={{ 
        marginBottom: '32px', 
        padding: '32px',
        background: 'linear-gradient(135deg, var(--panel) 0%, rgba(255,255,255,0.95) 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid var(--border)'
      }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%)',
              padding: '20px',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(16,185,129,0.3)',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-50%',
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />
              <Icon name="building" style={{ width: '36px', height: '36px', color: 'white', position: 'relative', zIndex: 1 }} />
            </div>
        <div>
              <h1 style={{ 
                margin: 0, 
                marginBottom: '8px',
                fontSize: '36px',
                fontWeight: '900',
                color: 'var(--text)',
                letterSpacing: '-0.5px'
              }}>
                Portal de Cliente
              </h1>
              <p style={{ 
                color: 'var(--muted)', 
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Icon name="user" size={16} color="var(--muted)" />
            Bienvenido, {user?.name} ({user?.empresa})
          </p>
        </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <button
              onClick={() => navigate('/inventario')}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.3)'
              }}
            >
              <Icon name="package" size={20} />
              Ver Inventario
            </button>
        <button
          onClick={abrirNuevoPedido}
          style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)',
            color: '#000',
            border: 'none',
                borderRadius: '12px',
            fontSize: '15px',
                fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(255, 193, 7, 0.3)'
          }}
          onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 193, 7, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 193, 7, 0.3)'
          }}
        >
          <Icon name="plus" size={20} />
               Pedido
        </button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {[
            { label: 'Total Pedidos', value: estadisticas.total, icon: 'package', bgColor: 'var(--bg-secondary)', iconColor: 'var(--sky)' },
            { label: 'Entregados', value: estadisticas.entregados, icon: 'check-circle', bgColor: 'var(--brand-light)', iconColor: 'var(--brand)' },
            { label: 'En Proceso', value: estadisticas.enProceso, icon: 'clock', bgColor: 'rgba(23,162,184,0.1)', iconColor: '#17a2b8' },
            { label: 'Total Gastado', value: `${estadisticas.totalGastado.toFixed(2)} Bs`, icon: 'creditCard', bgColor: 'rgba(139,92,246,0.1)', iconColor: '#8b5cf6' }
          ].map((stat, idx) => (
            <div
              key={stat.label}
              className="card"
              style={{
                background: stat.bgColor,
                padding: '24px',
            border: '1px solid var(--border)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  background: 'var(--panel)',
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  border: `1px solid ${stat.iconColor}25`
                }}>
                  <Icon name={stat.icon} size={24} color={stat.iconColor} />
          </div>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', letterSpacing: '0.3px' }}>{stat.label}</span>
          </div>
              <p style={{ margin: 0, fontSize: '40px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-1px', lineHeight: '1' }}>
                {stat.value}
              </p>
          </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid var(--border)'
      }}>
        <div className="section-title" style={{ marginBottom: '20px' }}>
          <Icon name="filter" style={{ width: '20px', height: '20px' }} />
          Filtros
        </div>
      <div style={{
        display: 'flex',
          gap: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label style={{ marginBottom: '8px', display: 'block', fontSize: '14px', fontWeight: '600' }}>Estado:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px',
                width: '100%',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand)'
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--input-border)'
                e.target.style.boxShadow = 'none'
            }}
          >
            <option value="todos">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En proceso">En Proceso</option>
            <option value="Entregado">Entregado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label style={{ marginBottom: '8px', display: 'block', fontSize: '14px', fontWeight: '600' }}>Fecha:</label>
          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px',
                width: '100%',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand)'
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--input-border)'
                e.target.style.boxShadow = 'none'
            }}
          >
            <option value="todos">Todos</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Última semana</option>
            <option value="mes">Último mes</option>
          </select>
        </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', flex: '0 0 auto' }}>
        <button
          onClick={cargarPedidos}
          style={{
                padding: '10px 20px',
                borderRadius: '8px',
            border: 'none',
                background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%)',
            color: 'white',
            cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                height: '42px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)'
          }}
        >
              <Icon name="refresh-cw" size={18} />
              Actualizar
        </button>
          </div>
        </div>
      </div>

      {/* Lista de pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className="card" style={{
          padding: '60px 20px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid var(--border)'
        }}>
          <Icon name="package" style={{ width: '64px', height: '64px', color: 'var(--muted)', marginBottom: '20px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
            No hay pedidos
          </h3>
          <p style={{ fontSize: '16px', color: 'var(--muted)' }}>
            {filtroEstado !== 'todos' || filtroFecha !== 'todos' 
              ? 'No se encontraron pedidos que coincidan con los filtros aplicados.' 
              : 'Aún no has registrado ningún pedido.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pedidosFiltrados.map(pedido => (
            <div
              key={pedido.id}
              className="card"
              style={{
                padding: '28px',
                background: 'linear-gradient(135deg, var(--panel) 0%, rgba(255,255,255,0.95) 100%)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ 
                      fontSize: '28px', 
                      fontWeight: '900', 
                      color: 'var(--text)',
                      letterSpacing: '-0.5px'
                    }}>
                      #{pedido.id}
                    </span>
                    <span
                      style={{
                        padding: '6px 14px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        background: getEstadoColor(pedido.estado) + '20',
                        color: getEstadoColor(pedido.estado),
                        border: `1px solid ${getEstadoColor(pedido.estado)}40`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                      }}
                    >
                      {pedido.estado}
                    </span>
                    <span
                      style={{
                        padding: '6px 14px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        background: getEstadoPagoColor(pedido.estadoPago) + '20',
                        color: getEstadoPagoColor(pedido.estadoPago),
                        border: `1px solid ${getEstadoPagoColor(pedido.estadoPago)}40`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                      }}
                    >
                      {pedido.estadoPago}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name="calendar" size={16} color="var(--muted)" />
                      {pedido.fecha}
                    </span>
                    {pedido.hora && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="clock" size={16} color="var(--muted)" />
                        {pedido.hora}
                      </span>
                  )}
                </div>
              </div>
                <div style={{ 
                  textAlign: 'right',
                  paddingLeft: '20px',
                  borderLeft: '2px solid var(--border)'
                }}>
                  <div style={{ 
                    fontSize: '32px', 
                    fontWeight: '900',
                    color: 'var(--text)',
                    letterSpacing: '-1px',
                    marginBottom: '4px'
                  }}>
                    {pedido.precio.toFixed(2)} Bs
                </div>
                  {pedido.medioTransporte && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px'
                    }}>
                      <Icon name="bike" size={14} color="var(--muted)" />
                      {pedido.medioTransporte}
                </div>
              )}
                </div>
            </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px', 
                marginBottom: '20px'
              }}>
                <div style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(14,165,233,0.05) 100%)',
                  borderRadius: '14px',
                  border: '1px solid rgba(59,130,246,0.2)',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.1)',
                  transition: 'all 0.3s ease'
          }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.1)'
            }}
          >
            <div style={{
                    fontSize: '10px', 
                    color: '#3b82f6', 
                    marginBottom: '10px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(59,130,246,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                      justifyContent: 'center'
                }}>
                      <Icon name="truck" size={16} color="#3b82f6" />
                    </div>
                    Recojo
                  </div>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: 'var(--text)',
                    lineHeight: '1.5',
                    minHeight: '22px'
                }}>
                    {pedido.recojo || <span style={{ color: 'var(--muted)', fontWeight: '500' }}>No especificado</span>}
              </div>
                </div>
                <div style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.05) 100%)',
                  borderRadius: '14px',
                  border: '1px solid rgba(16,185,129,0.2)',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.1)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.1)'
                }}
                >
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#10b981', 
                    marginBottom: '10px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(16,185,129,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon name="package" size={16} color="#10b981" />
                    </div>
                    Entrega
                    </div>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: 'var(--text)',
                    lineHeight: '1.5',
                    minHeight: '22px'
                  }}>
                    {pedido.entrega || <span style={{ color: 'var(--muted)', fontWeight: '500' }}>No especificado</span>}
                    </div>
                  </div>
                </div>

              {pedido.detalles && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '20px',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(124,58,237,0.05) 100%)',
                  borderRadius: '14px',
                  border: '1px solid rgba(139,92,246,0.2)',
                  boxShadow: '0 2px 8px rgba(139,92,246,0.1)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(139,92,246,0.1)'
                }}
                >
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#8b5cf6', 
                    marginBottom: '12px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(139,92,246,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon name="fileText" size={16} color="#8b5cf6" />
                    </div>
                    Detalles
                    </div>
                  <div style={{ 
                    fontSize: '15px', 
                    color: 'var(--text)', 
                    lineHeight: '1.7',
                    fontWeight: '500'
                  }}>
                    {pedido.detalles}
                    </div>
                  </div>
              )}

              {pedido.biker && (
                <div style={{
                  display: 'flex', 
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    flex: '1 1 200px',
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.05) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(251,191,36,0.2)',
                    boxShadow: '0 2px 8px rgba(251,191,36,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(251,191,36,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon name="user" size={18} color="#f59e0b" />
                  </div>
                  <div>
                      <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                        Biker
                  </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                        {pedido.biker}
                </div>
              </div>
                  </div>
                  {pedido.distancia && (
              <div style={{
                      flex: '1 1 200px',
                      padding: '16px 20px',
                      background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(2,132,199,0.05) 100%)',
                      borderRadius: '12px',
                      border: '1px solid rgba(14,165,233,0.2)',
                      boxShadow: '0 2px 8px rgba(14,165,233,0.1)',
                display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
              }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(14,165,233,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Icon name="activity" size={18} color="#0ea5e9" />
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                          Distancia
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                          {pedido.distancia} km
                        </div>
                      </div>
                    </div>
                  )}
              </div>
              )}
          </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo Pedido - Componente Modular */}
      <FormularioPedidoCliente
        isOpen={showNuevoPedido}
        onClose={() => setShowNuevoPedido(false)}
        onSuccess={handlePedidoCreado}
        cliente={user?.empresa}
      />
    </div>
  )
}
