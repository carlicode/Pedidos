import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Icon from '../components/Icon'
import { toast } from 'react-toastify'
import { getApiUrl } from '../utils/api.js'

/**
 * Página de Inventario para Administradores
 * Gestión completa del inventario del sistema
 * Solo accesible para: miguel, carli, ale
 */
export default function InventarioAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Usuarios permitidos para acceder al Inventario
  const usuariosPermitidosInventario = ['miguel', 'carli', 'ale']
  
  const [loading, setLoading] = useState(false)
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)
  const [empresas, setEmpresas] = useState([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [inventario, setInventario] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [productosEditados, setProductosEditados] = useState({})

  useEffect(() => {
    // Verificar acceso al montar el componente
    if (!user) {
      // Esperar a que el usuario se cargue
      return
    }
    
    if (!user.role || user.role !== 'admin') {
      toast.error('No tienes permisos para acceder al Inventario')
      navigate('/pedidos', { replace: true })
      return
    }
    
    const usernameLower = user.username?.toLowerCase()
    if (!usernameLower || !usuariosPermitidosInventario.includes(usernameLower)) {
      toast.error('No tienes permisos para acceder al Inventario')
      navigate('/pedidos', { replace: true })
      return
    }
    
    // Si el usuario tiene acceso, cargar empresas
    cargarEmpresas()
  }, [user, navigate])

  useEffect(() => {
    if (empresaSeleccionada) {
      cargarInventario()
    }
  }, [empresaSeleccionada])

  const cargarEmpresas = async () => {
    if (!user || !user.username) {
      console.warn('⚠️ Usuario no disponible para cargar empresas')
      return
    }
    
    try {
      setLoadingEmpresas(true)
      const url = getApiUrl('/api/admin/inventario/empresas')
      console.log('🔍 Cargando empresas desde:', url)
      console.log('👤 Usuario:', user.username)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-username': user.username
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Error response:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
      }
      
      const data = await response.json()
      console.log('✅ Empresas cargadas:', data)
      
      if (data.success) {
        setEmpresas(data.empresas || [])
        if (data.empresas && data.empresas.length > 0) {
          setEmpresaSeleccionada(data.empresas[0])
        }
      } else {
        throw new Error(data.error || 'Error cargando empresas')
      }
    } catch (error) {
      console.error('❌ Error cargando empresas:', error)
      let errorMessage = 'Error al cargar las empresas.'
      
      if (error.message && error.message.includes('Failed to fetch')) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica que el servidor esté corriendo en el puerto 5055.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage, { autoClose: 5000 })
      console.error('URL intentada:', getApiUrl('/api/admin/inventario/empresas'))
    } finally {
      setLoadingEmpresas(false)
    }
  }

  const cargarInventario = async () => {
    if (!empresaSeleccionada) return
    
    if (!user || !user.username) {
      console.warn('⚠️ Usuario no disponible para cargar inventario')
      return
    }
    
    try {
      setLoading(true)
      const url = getApiUrl(`/api/admin/inventario/${encodeURIComponent(empresaSeleccionada)}`)
      console.log('🔍 Cargando inventario desde:', url)
      console.log('👤 Usuario:', user.username)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-username': user.username
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Error response:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
      }
      
      const data = await response.json()
      console.log('✅ Inventario cargado:', data)
      
      if (data.success) {
        setInventario(data.data || [])
        setProductosEditados({})
        toast.success(`Inventario de ${empresaSeleccionada} cargado correctamente`)
      } else {
        throw new Error(data.error || 'Error cargando inventario')
      }
    } catch (error) {
      console.error('❌ Error cargando inventario:', error)
      let errorMessage = 'Error al cargar el inventario.'
      
      if (error.message && error.message.includes('Failed to fetch')) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica que el servidor esté corriendo en el puerto 5055.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage, { autoClose: 5000 })
      console.error('URL intentada:', getApiUrl(`/api/admin/inventario/${encodeURIComponent(empresaSeleccionada)}`))
    } finally {
      setLoading(false)
    }
  }

  const handleStockChange = (codigo, valor) => {
    const numValor = Math.max(0, parseInt(valor) || 0) // No permitir valores negativos
    setProductosEditados(prev => ({
      ...prev,
      [codigo]: {
        stockActual: numValor
      }
    }))
  }

  const incrementarStock = (codigo, item) => {
    const editado = productosEditados[codigo] || {}
    const stockActual = editado.stockActual !== undefined ? editado.stockActual : item.stockActual
    handleStockChange(codigo, stockActual + 1)
  }

  const decrementarStock = (codigo, item) => {
    const editado = productosEditados[codigo] || {}
    const stockActual = editado.stockActual !== undefined ? editado.stockActual : item.stockActual
    handleStockChange(codigo, Math.max(0, stockActual - 1))
  }

  const guardarCambios = async () => {
    if (!user || !user.username) {
      toast.error('Usuario no disponible')
      return
    }
    
    try {
      setLoading(true)
      const updates = Object.entries(productosEditados).map(([codigo, cambios]) => ({
        codigo,
        stockActual: cambios.stockActual
      }))

      for (const update of updates) {
        const response = await fetch(
          getApiUrl(`/api/admin/inventario/${encodeURIComponent(empresaSeleccionada)}/actualizar`),
          {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'x-username': user.username
            },
            body: JSON.stringify(update)
          }
        )

        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || 'Error actualizando producto')
        }
      }

      toast.success(`${updates.length} producto(s) actualizado(s) correctamente`)
      setProductosEditados({})
      await cargarInventario() // Recargar para ver cambios
    } catch (error) {
      console.error('Error guardando cambios:', error)
      toast.error('Error al guardar los cambios')
    } finally {
      setLoading(false)
    }
  }

  const categorias = [...new Set(inventario.map(p => p.categoria).filter(Boolean))]

  const inventarioFiltrado = inventario.filter(item => {
    if (busqueda) {
      const searchLower = busqueda.toLowerCase()
      return (
        (item.producto || '').toLowerCase().includes(searchLower) ||
        (item.categoria || '').toLowerCase().includes(searchLower) ||
        (item.codigo || '').toString().includes(searchLower)
      )
    }
    if (filtroCategoria !== 'todos') {
      return (item.categoria || '').toLowerCase() === filtroCategoria.toLowerCase()
    }
    return true
  })

  const tieneCambios = Object.keys(productosEditados).length > 0

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '28px', 
            fontWeight: '700',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Icon name="package" size={28} />
            Inventario
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: '14px', 
            color: 'var(--text-secondary)' 
          }}>
            Gestión completa del inventario del sistema
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {modoEdicion && tieneCambios && (
            <button
              onClick={guardarCambios}
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1
              }}
            >
              <Icon name="save" size={18} />
              Guardar Cambios
            </button>
          )}
          <button
            onClick={() => setModoEdicion(!modoEdicion)}
            style={{
              padding: '12px 24px',
              background: modoEdicion 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #96c226 0%, #7ba01e 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Icon name={modoEdicion ? "xCircle" : "edit"} size={18} />
            {modoEdicion ? 'Salir de Edición' : 'Modo Edición'}
          </button>
          <button
            onClick={cargarInventario}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1
            }}
          >
            <Icon name="refreshCw" size={18} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Selector de Empresa */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          Seleccionar Empresa:
        </label>
        <select
          value={empresaSeleccionada}
          onChange={(e) => setEmpresaSeleccionada(e.target.value)}
          disabled={loadingEmpresas}
          style={{
            padding: '12px 16px',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            fontSize: '15px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            outline: 'none',
            minWidth: '300px',
            fontWeight: '500'
          }}
        >
          {loadingEmpresas ? (
            <option>Cargando empresas...</option>
          ) : (
            empresas.map(empresa => (
              <option key={empresa} value={empresa}>{empresa}</option>
            ))
          )}
        </select>
      </div>

      {/* Filtros y Búsqueda */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              fontSize: '14px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#96c226'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(150, 194, 38, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          style={{
            padding: '12px 16px',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            fontSize: '14px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            outline: 'none',
            minWidth: '180px'
          }}
        >
          <option value="todos">Todas las categorías</option>
          {categorias.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Tabla de Inventario */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            <Icon name="refreshCw" size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px' }}>Cargando inventario...</p>
          </div>
        ) : inventarioFiltrado.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            <Icon name="package" size={48} />
            <p style={{ marginTop: '16px', fontSize: '16px' }}>
              {busqueda ? 'No se encontraron productos con esa búsqueda' : 'No hay productos en el inventario'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{
                  background: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border-color)'
                }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Imagen</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Código</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Producto</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoría</th>
                  <th style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Stock Actual</th>
                  <th style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Stock Mínimo</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {inventarioFiltrado.map((item, index) => {
                  const editado = productosEditados[item.codigo] || {}
                  const stockActual = editado.stockActual !== undefined ? editado.stockActual : item.stockActual
                  const stockMinimo = item.stockMinimo || 0
                  const bajoStock = stockActual < stockMinimo
                  const tieneCambios = editado.stockActual !== undefined
                  
                  return (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.2s',
                        backgroundColor: tieneCambios ? 'rgba(150, 194, 38, 0.1)' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!modoEdicion) {
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!modoEdicion) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      <td style={{ padding: '16px' }}>
                        {item.urlImagen ? (
                          <img
                            src={item.urlImagen}
                            alt={item.producto}
                            style={{
                              width: '60px',
                              height: '60px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '8px',
                            background: 'var(--bg-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)'
                          }}>
                            <Icon name="image" size={24} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px', fontWeight: '500' }}>{item.codigo || '-'}</td>
                      <td style={{ padding: '16px', fontWeight: '500' }}>{item.producto || '-'}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: 'var(--bg-secondary)',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {item.categoria || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        {modoEdicion ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '8px'
                          }}>
                            <button
                              onClick={() => decrementarStock(item.codigo, item)}
                              style={{
                                width: '36px',
                                height: '36px',
                                border: '2px solid #ef4444',
                                borderRadius: '8px',
                                background: 'white',
                                color: '#ef4444',
                                fontSize: '20px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                lineHeight: '1'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#ef4444'
                                e.currentTarget.style.color = 'white'
                                e.currentTarget.style.transform = 'scale(1.1)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white'
                                e.currentTarget.style.color = '#ef4444'
                                e.currentTarget.style.transform = 'scale(1)'
                              }}
                              title="Decrementar stock"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={stockActual}
                              onChange={(e) => handleStockChange(item.codigo, e.target.value)}
                              min="0"
                              style={{
                                width: '90px',
                                padding: '8px 12px',
                                border: tieneCambios ? '2px solid #96c226' : '2px solid #e5e7eb',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '700',
                                textAlign: 'center',
                                background: tieneCambios ? '#f0fdf4' : 'white',
                                color: '#1f2937',
                                outline: 'none',
                                transition: 'all 0.2s'
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#96c226'
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(150, 194, 38, 0.1)'
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = tieneCambios ? '#96c226' : '#e5e7eb'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            />
                            <button
                              onClick={() => incrementarStock(item.codigo, item)}
                              style={{
                                width: '36px',
                                height: '36px',
                                border: '2px solid #10b981',
                                borderRadius: '8px',
                                background: 'white',
                                color: '#10b981',
                                fontSize: '20px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                lineHeight: '1'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#10b981'
                                e.currentTarget.style.color = 'white'
                                e.currentTarget.style.transform = 'scale(1.1)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white'
                                e.currentTarget.style.color = '#10b981'
                                e.currentTarget.style.transform = 'scale(1)'
                              }}
                              title="Incrementar stock"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: '600', fontSize: '16px' }}>{stockActual || 0}</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{stockMinimo || 0}</span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: bajoStock ? '#ef4444' : '#10b981',
                          color: 'white'
                        }}>
                          {bajoStock ? '❌ Bajo stock' : '✅ Ok'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
