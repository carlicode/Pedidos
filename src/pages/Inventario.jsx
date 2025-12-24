import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { toast } from 'react-toastify'

/**
 * Página de Inventario para Clientes
 * Muestra el inventario del cliente desde su pestaña en Google Sheets
 */
export default function Inventario() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [inventario, setInventario] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sheetTab, setSheetTab] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (user?.username) {
      cargarInventario()
    }
  }, [user])

  /**
   * Cargar inventario desde el backend
   */
  const cargarInventario = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔄 Cargando inventario para usuario:', user.username)

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
      const response = await fetch(`${backendUrl}/api/inventario/${user.username}`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}`)
      }

      const data = await response.json()
      console.log('📦 Inventario recibido:', data)

      setInventario(data.data || [])
      setSheetTab(data.sheetTab || '')
      setEmpresa(data.empresa || '')
      setError(null)
    } catch (error) {
      console.error('❌ Error cargando inventario:', error)
      setError(error.message)
      // No mostrar toast aquí, lo manejamos en la UI
    } finally {
      setLoading(false)
    }
  }

  /**
   * Filtrar inventario según criterios
   */
  const inventarioFiltrado = inventario.filter(producto => {
    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase()
      const productoMatch = (producto.Producto || '').toLowerCase().includes(searchLower)
      const categoriaMatch = (producto.Categoria || '').toLowerCase().includes(searchLower)
      if (!productoMatch && !categoriaMatch) return false
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      const estado = (producto.Estado || '').toLowerCase()
      if (filtroEstado === 'ok' && !estado.includes('ok')) return false
      if (filtroEstado === 'bajo' && !estado.includes('bajo')) return false
    }

    // Filtro por categoría
    if (filtroCategoria !== 'todos') {
      if ((producto.Categoria || '').toLowerCase() !== filtroCategoria.toLowerCase()) return false
    }

    return true
  }).sort((a, b) => {
    // Ordenar: productos bajo stock primero
    const stockActualA = parseInt(a['Stock actual'] || 0)
    const stockMinimoA = parseInt(a['Stock mínimo'] || a['Stock minimo'] || 0)
    const bajoStockA = stockActualA < stockMinimoA
    
    const stockActualB = parseInt(b['Stock actual'] || 0)
    const stockMinimoB = parseInt(b['Stock mínimo'] || b['Stock minimo'] || 0)
    const bajoStockB = stockActualB < stockMinimoB
    
    // Si uno está bajo stock y el otro no, el bajo stock va primero
    if (bajoStockA && !bajoStockB) return -1
    if (!bajoStockA && bajoStockB) return 1
    
    // Si ambos están en el mismo estado, mantener el orden original
    return 0
  })

  /**
   * Obtener categorías únicas
   */
  const categorias = [...new Set(inventario.map(p => p.Categoria).filter(Boolean))]

  /**
   * Obtener estadísticas del inventario
   */
  const stats = {
    total: inventario.length,
    ok: inventario.filter(p => (p.Estado || '').toLowerCase().includes('ok')).length,
    bajo: inventario.filter(p => (p.Estado || '').toLowerCase().includes('bajo')).length,
    stockTotal: inventario.reduce((sum, p) => sum + (parseInt(p['Stock actual']) || 0), 0)
  }

  /**
   * Determinar color del badge de estado
   */
  const getEstadoStyles = (estado) => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px 18px',
      borderRadius: '12px',
      fontWeight: '700',
      fontSize: '13px',
      border: '1px solid transparent',
      minHeight: '40px',
      height: '40px',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }

    const estadoLower = (estado || '').toLowerCase()
    if (estadoLower.includes('ok')) {
      return {
        ...base,
        background: '#ecfdf3',
        borderColor: '#bbf7d0',
        color: '#15803d'
      }
    }
    if (estadoLower.includes('bajo')) {
      return {
        ...base,
        background: '#fef2f2',
        borderColor: '#fecaca',
        color: '#b91c1c'
      }
    }
    return {
      ...base,
      background: '#f3f4f6',
      borderColor: '#e5e7eb',
      color: '#374151'
    }
  }

  /**
   * Determinar color de la categoría
   */
  const getCategoriaStyles = (categoria) => {
    const base = {
      border: '1px solid #e5e7eb',
      shadow: '0 10px 25px rgba(15,23,42,0.08)',
      badgeBg: '#e0f2fe',
      badgeColor: '#0369a1'
    }
    const cat = (categoria || '').toLowerCase()

    if (cat.includes('crema')) {
      return {
        ...base,
        border: '1px solid #bbf7d0',
        shadow: '0 15px 35px rgba(16,185,129,0.18)',
        badgeBg: '#dcfce7',
        badgeColor: '#15803d'
      }
    }
    if (cat.includes('capsula')) {
      return {
        ...base,
        border: '1px solid #fef3c7',
        shadow: '0 15px 35px rgba(245,158,11,0.18)',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309'
      }
    }
    if (cat.includes('polvo')) {
      return {
        ...base,
        border: '1px solid #dbeafe',
        shadow: '0 15px 35px rgba(59,130,246,0.18)',
        badgeBg: '#dbeafe',
        badgeColor: '#1d4ed8'
      }
    }

    return base
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <Icon name="package" style={{ width: '40px', height: '40px', color: 'white' }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '18px', fontWeight: '500' }}>
            Cargando inventario...
          </p>
        </div>
      </div>
    )
  }

  // Pantalla de error/sin acceso
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        padding: '20px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={() => navigate('/cliente')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b'
                }}
              >
                <Icon name="arrow-left" style={{ width: '24px', height: '24px' }} />
              </button>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                  Mi Inventario
                </h1>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                  {empresa || user?.empresa || 'Cliente'}
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje de Error/Sin Acceso */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            padding: '48px 32px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="lock" style={{ width: '60px', height: '60px', color: '#f59e0b' }} />
            </div>

            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '28px',
              fontWeight: '700',
              color: '#1e293b'
            }}>
              Configuración Pendiente
            </h2>

            <p style={{
              margin: '0 0 32px 0',
              fontSize: '16px',
              color: '#64748b',
              lineHeight: '1.6',
              maxWidth: '500px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Tu inventario estará disponible pronto. Estamos configurando el acceso a tu almacén.
            </p>

            {/* Información del error técnico (colapsable) */}
            <details style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '32px',
              textAlign: 'left'
            }}>
              <summary style={{
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: '600',
                userSelect: 'none'
              }}>
                🔧 Información técnica
              </summary>
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'white',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#64748b',
                fontFamily: 'monospace'
              }}>
                {error}
              </div>
            </details>

            {/* Pasos necesarios */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '2px solid #93c5fd',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Icon name="info" style={{ width: '20px', height: '20px' }} />
                Pasos para activar tu inventario:
              </h3>
              <ol style={{
                margin: 0,
                paddingLeft: '24px',
                color: '#1e40af',
                fontSize: '14px',
                lineHeight: '2'
              }}>
                <li>El administrador debe compartir el Google Sheet de "Inventarios"</li>
                <li>Agregar el correo: <code style={{
                  background: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>sheets-access@beezero.iam.gserviceaccount.com</code></li>
                <li>Configurar el ID del Sheet en el servidor</li>
              </ol>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/cliente')}
                style={{
                  padding: '12px 24px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
              >
                <Icon name="arrow-left" style={{ width: '18px', height: '18px' }} />
                Volver al Portal
              </button>

              <button
                onClick={cargarInventario}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#3b82f6',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eff6ff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                }}
              >
                <Icon name="refresh-cw" style={{ width: '18px', height: '18px' }} />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }


  return (
    <>
      <style>{`
        .inventario-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        
        @media (max-width: 1200px) {
          .inventario-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        
        @media (max-width: 900px) {
          .inventario-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 600px) {
          .inventario-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .product-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        
        .product-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 32px 64px -12px rgba(15, 23, 42, 0.25) !important;
        }
        
        [data-theme="dark"] .product-card:hover {
          box-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.5) !important;
        }
        
        [data-theme="dark"] .product-card {
          background: var(--panel) !important;
          border-color: var(--border) !important;
        }
        
        .product-image-container {
          position: relative !important;
          overflow: hidden;
          width: 100%;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
        }
        
        .product-image-container img {
          max-width: calc(100% - 32px);
          max-height: calc(100% - 32px);
          width: auto;
          height: auto;
          object-fit: contain;
          object-position: center;
          margin: auto;
          display: block;
        }
        
        .product-image-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.02) 100%);
          pointer-events: none;
        }
        
        .product-image {
          max-width: calc(100% - 32px) !important;
          max-height: calc(100% - 32px) !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          object-position: center !important;
          margin: auto !important;
          display: block !important;
        }
        
        .product-name {
          font-size: 18px !important;
          font-weight: 800 !important;
          line-height: 1.3 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          min-height: 46px !important;
          margin-bottom: 4px !important;
          text-align: center !important;
        }
        
        .stock-badge {
          transition: all 0.2s ease;
        }
        
        .stock-badge:hover {
          transform: scale(1.05);
        }
        
        .status-badge {
          transition: all 0.2s ease;
          min-height: 40px !important;
          height: 40px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          white-space: nowrap !important;
        }
        
        .status-badge:hover {
          transform: scale(1.05);
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .product-card {
          animation: fadeIn 0.5s ease-out;
        }
        
        .product-card:nth-child(1) { animation-delay: 0.05s; }
        .product-card:nth-child(2) { animation-delay: 0.1s; }
        .product-card:nth-child(3) { animation-delay: 0.15s; }
        .product-card:nth-child(4) { animation-delay: 0.2s; }
        .product-card:nth-child(5) { animation-delay: 0.25s; }
        .product-card:nth-child(6) { animation-delay: 0.3s; }
        .product-card:nth-child(7) { animation-delay: 0.35s; }
        .product-card:nth-child(8) { animation-delay: 0.4s; }
        
        /* Dark mode styles */
        [data-theme="dark"] .product-card {
          background: var(--panel) !important;
          border-color: var(--border) !important;
        }
        
        [data-theme="dark"] .product-card:hover {
          box-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.5) !important;
        }
        
        [data-theme="dark"] .product-name {
          color: var(--text) !important;
        }
        
        [data-theme="dark"] .stock-badge {
          background: var(--bg-secondary) !important;
          border-color: var(--border) !important;
          color: var(--text) !important;
        }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px', position: 'relative', transition: 'background 0.3s ease' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Header */}
        <div className="card" style={{ 
          padding: '36px', 
          background: 'linear-gradient(135deg, var(--panel) 0%, rgba(255,255,255,0.95) 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigate('/cliente')
                }}
                type="button"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                  e.currentTarget.style.borderColor = 'var(--brand)'
                  e.currentTarget.style.transform = 'translateX(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--panel)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.transform = 'translateX(0)'
                }}
                title="Volver a mis pedidos"
              >
                <Icon name="arrow-left" size={20} color="var(--text)" />
              </button>
              <div style={{
                background: 'var(--brand)',
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
                <Icon name="package" style={{ width: '36px', height: '36px', color: 'white', position: 'relative', zIndex: 1 }} />
              </div>
              <div>
                <h1 style={{ 
                  margin: 0, 
                  fontSize: '36px', 
                  fontWeight: '900', 
                  color: 'var(--text)',
                  letterSpacing: '-0.5px'
                }}>
                  Mi Inventario
                </h1>
                <p style={{ 
                  margin: '8px 0 0 0', 
                  color: 'var(--muted)', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Icon name="building" style={{ width: '16px', height: '16px', color: 'var(--muted)' }} />
                  {empresa || sheetTab}
                </p>
              </div>
            </div>

            <button
              onClick={cargarInventario}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 28px',
                fontSize: '15px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%)',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.3s ease'
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
              <Icon name="refresh-cw" style={{ width: '18px', height: '18px' }} />
              Actualizar
            </button>
          </div>

          {/* Estadísticas */}
          <div style={{
            marginTop: '32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px'
          }}>
            {[
              { label: 'Total productos', value: stats.total, icon: 'package', bgColor: 'var(--bg-secondary)', iconColor: 'var(--sky)' },
              { label: 'Stock OK', value: stats.ok, icon: 'check-circle', bgColor: 'var(--brand-light)', iconColor: 'var(--brand)' },
              { label: 'Bajo stock', value: stats.bajo, icon: 'alert-triangle', bgColor: 'rgba(239,68,68,0.1)', iconColor: 'var(--red)' },
              { label: 'Stock total', value: stats.stockTotal, icon: 'layers', bgColor: 'rgba(139,92,246,0.1)', iconColor: '#8b5cf6' }
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
                    border: `1px solid ${stat.iconColor}25`,
                    transition: 'all 0.3s ease'
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
        </div>

        {/* Filtros */}
        <div className="card" style={{
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid var(--border)'
        }}>
          <div className="section-title" style={{ marginBottom: '20px' }}>
            <Icon name="filter" style={{ width: '20px', height: '20px' }} />
            Filtros
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '20px' }}>
            <div className="form-group">
              <label>Buscar producto</label>
              <div style={{ position: 'relative' }}>
                <Icon 
                  name="search" 
                  size={18}
                  color="var(--muted)"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1,
                    pointerEvents: 'none'
                  }} 
                />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o categoría..."
                  className="search"
                  style={{ 
                    width: '100%',
                    padding: '10px 12px 10px 42px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'var(--input-bg)',
                    color: 'var(--text)',
                    transition: 'all 0.2s ease',
                    lineHeight: '1.5',
                    height: '42px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    zIndex: 2
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--brand)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--input-border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ok">Stock OK</option>
                <option value="bajo">Bajo stock</option>
              </select>
            </div>

            <div className="form-group">
              <label>Categoría</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <option value="todos">Todas</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista de productos */}
        {inventarioFiltrado.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Icon name="package" style={{ width: '60px', height: '60px', color: 'var(--muted)', marginBottom: '16px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>No hay productos</h3>
            <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
              {busqueda || filtroEstado !== 'todos' || filtroCategoria !== 'todos'
                ? 'No se encontraron productos con los filtros aplicados.'
                : 'Aún no registraste productos en tu inventario.'}
            </p>
          </div>
        ) : (
          <div className="inventario-grid">
            {inventarioFiltrado.map((producto, index) => {
              const categoriaStyles = getCategoriaStyles(producto.Categoria)
              // Verificar si está bajo stock
              const stockActual = parseInt(producto['Stock actual'] || 0)
              const stockMinimo = parseInt(producto['Stock mínimo'] || producto['Stock minimo'] || 0)
              const bajoStock = stockActual < stockMinimo
              
              return (
                <div
                  key={index}
                  className="product-card card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: bajoStock ? '2px solid var(--red)' : '1px solid var(--border)',
                    boxShadow: bajoStock ? '0 20px 40px -12px rgba(239,68,68,0.25)' : '0 4px 20px rgba(0,0,0,.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!bajoStock) {
                      e.currentTarget.style.transform = 'translateY(-8px)'
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.15)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    if (!bajoStock) {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.08)'
                    }
                  }}
                >
                  {(() => {
                    // Buscar foto en diferentes variaciones del nombre de columna
                    // Prioridad: url_imagen > Foto
                    const fotoUrl = producto.url_imagen || producto['url_imagen'] || producto.urlImagen || 
                                   producto.Foto || producto.foto || producto.Photo || producto.photo || 
                                   producto['Foto'] || producto['foto']
                    
                    if (fotoUrl && fotoUrl.trim()) {
                      // Limpiar URL si tiene espacios o caracteres extra
                      let cleanUrl = fotoUrl.trim()
                      
                      // Si es una URL de Google Drive, convertirla al formato correcto
                      if (cleanUrl.includes('drive.google.com')) {
                        // Extraer ID de diferentes formatos
                        let driveId = null
                        
                        // Formato: /file/d/ID/view o /file/d/ID
                        const match1 = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
                        if (match1) driveId = match1[1]
                        
                        // Formato: ?id=ID o &id=ID
                        if (!driveId) {
                          const match2 = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
                          if (match2) driveId = match2[1]
                        }
                        
                        // Formato: /d/ID
                        if (!driveId) {
                          const match3 = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
                          if (match3) driveId = match3[1]
                        }
                        
                        if (driveId) {
                          // Usar el proxy del servidor para acceder a imágenes de Drive
                          // El servidor usa las credenciales del service account
                          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
                          cleanUrl = `${backendUrl}/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`
                          console.log(`🖼️ URL de Drive convertida a proxy: ${cleanUrl.substring(0, 100)}...`)
                        }
                      }
                      
                      // Si la URL parece estar truncada, intentar completarla
                      if (cleanUrl.includes('drive.google.com/file/d/') && !cleanUrl.includes('proxy-image') && !cleanUrl.includes('export=view')) {
                        const idMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
                        if (idMatch && idMatch[1]) {
                          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5055'
                          cleanUrl = `${backendUrl}/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`
                          console.log(`🖼️ URL truncada completada con proxy: ${cleanUrl.substring(0, 100)}...`)
                        }
                      }
                      
                      return (
                        <div className="product-image-container" style={{
                          borderRadius: '24px 24px 0 0',
                          position: 'relative'
                        }}>
                          <img
                            src={cleanUrl}
                            alt={producto.Producto || 'Producto'}
                            className="product-image"
                            style={{
                              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                              loading: 'lazy'
                            }}
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error(`❌ Error cargando imagen para ${producto.Producto}:`, cleanUrl)
                              // Si falla la imagen, mostrar placeholder
                              e.target.style.display = 'none'
                              const parent = e.target.parentElement
                              if (parent) {
                                parent.innerHTML = `
                                  <div style="
                                    height: 100%;
                                    background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(14,165,233,0.15));
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    flex-direction: column;
                                    gap: 12px;
                                    color: #60a5fa;
                                  ">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                      <circle cx="8.5" cy="8.5" r="1.5"/>
                                      <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                    <span style="font-size: 12px; font-weight: 600;">Sin imagen</span>
                                    <span style="font-size: 10px; color: #94a3b8; margin-top: 4px;">URL: ${cleanUrl.substring(0, 50)}...</span>
                                  </div>
                                `
                              }
                            }}
                            onLoad={() => {
                              console.log(`✅ Imagen cargada exitosamente para ${producto.Producto}`)
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.transform = 'scale(1.05)'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.transform = 'scale(1)'
                            }}
                          />
                        </div>
                      )
                    }
                    
                    // Placeholder cuando no hay foto
                    return (
                      <div className="product-image-container" style={{
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(14,165,233,0.12))',
                        borderRadius: '24px 24px 0 0',
                        flexDirection: 'column',
                        gap: '12px',
                        position: 'relative'
                      }}>
                        <Icon name="image" style={{ width: '48px', height: '48px', color: 'var(--muted)', opacity: 0.5 }} />
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>
                          Sin imagen
                        </span>
                      </div>
                    )
                  })()}

                  <div style={{ padding: '24px 28px 20px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <h3 className="product-name" style={{ 
                        margin: '0 auto', 
                        fontSize: '18px', 
                        fontWeight: '800', 
                        color: 'var(--text)',
                        lineHeight: '1.3',
                        letterSpacing: '-0.2px',
                        textAlign: 'center',
                        marginBottom: '8px'
                      }}>
                        {producto.Producto}
                      </h3>
                      {producto.Categoria && (
                        <span style={{
                          marginTop: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: categoriaStyles.badgeBg,
                          color: categoriaStyles.badgeColor,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          border: `1px solid ${categoriaStyles.badgeColor}25`,
                          transition: 'all 0.2s ease'
                        }}>
                          <Icon name="tag" style={{ width: '14px', height: '14px' }} />
                          {producto.Categoria}
                        </span>
                      )}
                    </div>


                    {/* Stock info en la parte inferior */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'stretch', 
                      gap: '10px', 
                      padding: '16px 20px',
                      background: 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.01) 100%)',
                      borderTop: '1px solid var(--border)'
                    }}>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '44px',
                        minWidth: '72px',
                        flex: 1,
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ fontSize: '7px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px', lineHeight: '1', textAlign: 'center' }}>Stock</div>
                        <div style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text)', lineHeight: '1', textAlign: 'center' }}>
                          {producto['Stock actual'] || '0'}
                        </div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 247, 237, 0.6)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        border: '1px solid rgba(254, 215, 170, 0.6)',
                        boxShadow: '0 2px 8px rgba(249,115,22,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '44px',
                        minWidth: '72px',
                        flex: 1,
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ fontSize: '7px', color: '#f97316', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px', lineHeight: '1', textAlign: 'center' }}>Mínimo</div>
                        <div style={{ fontSize: '17px', fontWeight: '900', color: '#c2410c', lineHeight: '1', textAlign: 'center' }}>
                          {producto['Stock mínimo'] || producto['Stock minimo'] || '0'}
                        </div>
                      </div>
                      {producto.Código && (
                        <div style={{ 
                          padding: '8px 12px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: '44px',
                          minWidth: '72px',
                          flex: 1,
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{ fontSize: '7px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px', lineHeight: '1', textAlign: 'center', opacity: 0.7 }}>Código</div>
                          <div style={{ fontSize: '17px', fontWeight: '900', color: 'var(--muted)', lineHeight: '1', textAlign: 'center' }}>
                            #{producto.Código}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

