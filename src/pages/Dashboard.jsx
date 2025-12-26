import { useState, useEffect } from 'react'
import HeatMapModal from '../components/HeatMapModal.jsx'
import { useAuth } from '../hooks/useAuth.js'

const Dashboard = ({ orders, loadOrdersFromSheet, showNotification }) => {
  const [dashboardData, setDashboardData] = useState(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [showHeatMapModal, setShowHeatMapModal] = useState(false)
  const { user } = useAuth()
  
  // Verificar si el usuario actual es "carli"
  const isCarli = user && user.username && user.username.toLowerCase() === 'carli'

  // Función helper para convertir minutos a formato horas:minutos:segundos
  const formatDuracion = (minutos) => {
    if (!minutos || isNaN(minutos) || minutos <= 0) return '0:00:00'
    const horas = Math.floor(minutos / 60)
    const mins = Math.floor(minutos % 60)
    const segs = Math.round((minutos % 1) * 60) // Convertir la parte decimal a segundos
    return `${horas}:${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`
  }

  // Función para parsear duración desde diferentes formatos
  const parseDuracion = (duracionStr) => {
    if (!duracionStr || typeof duracionStr !== 'string') return null
    
    const duracion = duracionStr.trim()
    
    // Formato HH:MM:SS o HH:MM
    const timeFormat = /^(\d{1,2}):(\d{2})(:(\d{2}))?$/
    const timeMatch = duracion.match(timeFormat)
    if (timeMatch) {
      const horas = parseInt(timeMatch[1], 10)
      const minutos = parseInt(timeMatch[2], 10)
      const segundos = timeMatch[4] ? parseInt(timeMatch[4], 10) : 0
      return horas * 60 + minutos + segundos / 60 // Convertir a minutos
    }
    
    // Formato con texto: "30 min", "1h 30min", "1h", etc.
    const textFormat = /(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*min(?:utes?)?)?/i
    const textMatch = duracion.match(textFormat)
    if (textMatch) {
      const horas = textMatch[1] ? parseInt(textMatch[1], 10) : 0
      const minutos = textMatch[2] ? parseInt(textMatch[2], 10) : 0
      return horas * 60 + minutos
    }
    
    // Si es solo un número, asumir que son minutos
    const soloNumero = parseFloat(duracion.replace(/[^\d.]/g, ''))
    if (!isNaN(soloNumero) && soloNumero > 0) {
      return soloNumero
    }
    
    return null
  }

  // Cargar datos del dashboard cuando se monta o cambian los pedidos
  useEffect(() => {
    if (orders.length > 0) {
      calcularDashboard()
    } else {
      loadOrdersFromSheet()
    }
  }, [orders.length])

  // Cargar dashboard cuando se carguen los pedidos
  useEffect(() => {
    if (orders.length > 0 && !dashboardData) {
      calcularDashboard()
    }
  }, [orders.length])

  // Función para calcular datos del dashboard
  const calcularDashboard = () => {
    try {
      console.log('📊 Calculando dashboard...')
      setLoadingDashboard(true)
      
      if (orders.length === 0) {
        showNotification('❌ No hay pedidos cargados para el dashboard', 'error')
        setLoadingDashboard(false)
        return
      }

      // Filtrar solo pedidos entregados
      const pedidosEntregados = orders.filter(pedido => {
        const estado = pedido.Estado || pedido.estado
        return estado === 'Entregado'
      })

      console.log(`📊 Total pedidos: ${orders.length}, Entregados: ${pedidosEntregados.length}`)

      // ===== 1. TOP BIKERS POR CANTIDAD DE CARRERAS =====
      const bikersCarreras = {}
      pedidosEntregados.forEach(pedido => {
        const biker = pedido.Biker || pedido.biker
        if (biker && biker !== 'ASIGNAR BIKER' && biker !== 'N/A') {
          if (!bikersCarreras[biker]) {
            bikersCarreras[biker] = {
              nombre: biker,
              cantidadCarreras: 0,
              gananciasTotales: 0
            }
          }
          bikersCarreras[biker].cantidadCarreras += 1
          const precio = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
          bikersCarreras[biker].gananciasTotales += precio
        }
      })

      // Ordenar por cantidad de carreras
      const topBikersPorCantidad = Object.values(bikersCarreras)
        .sort((a, b) => b.cantidadCarreras - a.cantidadCarreras)
        .slice(0, 10)

      // ===== 2. TOP BIKER POR GANANCIAS =====
      const topBikerPorGanancias = Object.values(bikersCarreras)
        .sort((a, b) => b.gananciasTotales - a.gananciasTotales)
        .slice(0, 10)

      // ===== 3. CANTIDAD DE CARRERAS POR ESTADO =====
      const carrerasPorEstado = {}
      orders.forEach(pedido => {
        const estado = pedido.Estado || pedido.estado || 'Sin Estado'
        if (!carrerasPorEstado[estado]) {
          carrerasPorEstado[estado] = 0
        }
        carrerasPorEstado[estado] += 1
      })

      // ===== 4. TOP EMPRESAS POR CANTIDAD DE CARRERAS =====
      const empresasCarreras = {}
      pedidosEntregados.forEach(pedido => {
        const cliente = pedido.Cliente || pedido.cliente
        if (cliente && cliente !== 'N/A' && cliente.trim()) {
          if (!empresasCarreras[cliente]) {
            empresasCarreras[cliente] = {
              nombre: cliente,
              cantidadCarreras: 0,
              totalPagado: 0
            }
          }
          empresasCarreras[cliente].cantidadCarreras += 1
          const precio = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
          empresasCarreras[cliente].totalPagado += precio
        }
      })

      // Ordenar por cantidad de carreras
      const topEmpresasPorCantidad = Object.values(empresasCarreras)
        .sort((a, b) => b.cantidadCarreras - a.cantidadCarreras)
        .slice(0, 10)

      // ===== 5. TOP EMPRESA POR PAGO TOTAL =====
      const topEmpresasPorPago = Object.values(empresasCarreras)
        .sort((a, b) => b.totalPagado - a.totalPagado)
        .slice(0, 10)

      // ===== 6. CARRERAS SIN HORA FIN =====
      const carrerasSinHoraFin = orders.filter(pedido => {
        const estado = pedido.Estado || pedido.estado
        if (estado !== 'Entregado') return false
        const horaFin = pedido['Hora Fin'] || pedido.hora_fin
        return !horaFin || horaFin.trim() === '' || horaFin === 'N/A'
      })

      // ===== 7. TOP 3 OPERADORES CON CARRERAS SIN HORA FIN O SIN HORA INI =====
      const operadoresProblemas = {}
      orders.forEach(pedido => {
        // Solo considerar carreras con Estado = 'Entregado'
        const estado = pedido.Estado || pedido.estado
        if (estado !== 'Entregado') return

        const horaFin = pedido['Hora Fin'] || pedido.hora_fin
        const horaIni = pedido['Hora Ini'] || pedido.hora_ini
        const operador = pedido.Operador || pedido.operador
        
        if (operador && operador !== 'N/A' && operador.trim()) {
          const sinHoraFin = !horaFin || horaFin.trim() === '' || horaFin === 'N/A'
          const sinHoraIni = !horaIni || horaIni.trim() === '' || horaIni === 'N/A'
          
          if (sinHoraFin || sinHoraIni) {
            if (!operadoresProblemas[operador]) {
              operadoresProblemas[operador] = {
                nombre: operador,
                sinHoraFin: 0,
                sinHoraIni: 0,
                total: 0
              }
            }
            if (sinHoraFin) operadoresProblemas[operador].sinHoraFin += 1
            if (sinHoraIni) operadoresProblemas[operador].sinHoraIni += 1
            operadoresProblemas[operador].total += 1
          }
        }
      })

      const topOperadoresProblemas = Object.values(operadoresProblemas)
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)

      // ===== 8. CARRERAS SIN PRECIO =====
      const carrerasSinPrecio = orders.filter(pedido => {
        const estado = pedido.Estado || pedido.estado
        if (estado !== 'Entregado') return false
        const precio = pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio
        return !precio || precio === '' || precio === '0' || parseFloat(precio) === 0
      })

      // ===== 9. ANÁLISIS DE DURACIÓN =====
      const duraciones = []
      orders.forEach(pedido => {
        const duracion = pedido.Duracion || pedido.duracion
        if (duracion && duracion.trim() && duracion !== 'N/A') {
          const duracionMin = parseDuracion(duracion)
          if (duracionMin !== null && duracionMin > 0) {
            duraciones.push({
              pedido: pedido,
              duracionMin: duracionMin,
              duracionOriginal: duracion
            })
          }
        }
      })

      // Calcular duración promedio (solo de carreras entregadas)
      const duracionesEntregadas = duraciones.filter(d => {
        const estado = d.pedido.Estado || d.pedido.estado
        return estado === 'Entregado'
      })

      const duracionPromedio = duracionesEntregadas.length > 0
        ? duracionesEntregadas.reduce((sum, d) => sum + d.duracionMin, 0) / duracionesEntregadas.length
        : 0

      // Las 15 carreras que duraron más (solo entregadas)
      const carrerasMasLargas = [...duracionesEntregadas]
        .sort((a, b) => b.duracionMin - a.duracionMin)
        .slice(0, 15)

      // Las 15 carreras que duraron menos (solo entregadas)
      const carrerasMasCortas = [...duracionesEntregadas]
        .sort((a, b) => a.duracionMin - b.duracionMin)
        .slice(0, 15)

      // ===== 10. CARRERAS PROBLEMÁTICAS PARA OBSERVAR =====
      const carrerasProblematicas = []
      
      orders.forEach(pedido => {
        // Solo considerar carreras con Estado = 'Entregado'
        const estado = pedido.Estado || pedido.estado
        if (estado !== 'Entregado') {
          return // Saltar esta carrera si no está entregada
        }

        const problemas = []
        const horaFin = pedido['Hora Fin'] || pedido.hora_fin
        const horaIni = pedido['Hora Ini'] || pedido.hora_ini
        const precio = pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio
        const duracion = pedido.Duracion || pedido.duracion
        
        if (!horaFin || horaFin.trim() === '' || horaFin === 'N/A') {
          problemas.push('Sin Hora Fin')
        }
        if (!horaIni || horaIni.trim() === '' || horaIni === 'N/A') {
          problemas.push('Sin Hora Ini')
        }
        if (!precio || precio === '' || precio === '0' || parseFloat(precio) === 0) {
          problemas.push('Sin Precio')
        }
        if (!duracion || duracion.trim() === '' || duracion === 'N/A') {
          problemas.push('Sin Duración')
        }

        if (problemas.length > 0) {
          carrerasProblematicas.push({
            id: pedido.ID || pedido.id || 'N/A',
            fecha: pedido['Fecha Registro'] || pedido.fecha_registro || pedido.fecha || 'N/A',
            operador: pedido.Operador || pedido.operador || 'N/A',
            cliente: pedido.Cliente || pedido.cliente || 'N/A',
            biker: pedido.Biker || pedido.biker || 'N/A',
            estado: pedido.Estado || pedido.estado || 'N/A',
            precio: precio || '0',
            horaIni: horaIni || 'N/A',
            horaFin: horaFin || 'N/A',
            duracion: duracion || 'N/A',
            problemas: problemas
          })
        }
      })

      // Ordenar por cantidad de problemas (más problemas primero)
      carrerasProblematicas.sort((a, b) => b.problemas.length - a.problemas.length)

      // ===== RESULTADO FINAL =====
      const resultado = {
        resumen: {
          totalPedidos: orders.length,
          pedidosEntregados: pedidosEntregados.length,
          totalBikers: Object.keys(bikersCarreras).length,
          totalEmpresas: Object.keys(empresasCarreras).length,
          carrerasSinHoraFin: carrerasSinHoraFin.length,
          carrerasSinPrecio: carrerasSinPrecio.length,
          duracionPromedio: duracionPromedio
        },
        topBikersPorCantidad,
        topBikersPorGanancias: topBikerPorGanancias,
        carrerasPorEstado,
        topEmpresasPorCantidad,
        topEmpresasPorPago,
        carrerasSinHoraFin: carrerasSinHoraFin.slice(0, 20), // Limitar para mostrar
        topOperadoresProblemas,
        carrerasSinPrecio: carrerasSinPrecio.slice(0, 20), // Limitar para mostrar
        duracionPromedio,
        carrerasMasLargas,
        carrerasMasCortas,
        carrerasProblematicas: carrerasProblematicas.slice(0, 50) // Top 50 más problemáticas
      }

      setDashboardData(resultado)
      console.log('✅ Dashboard calculado:', resultado)
      showNotification('✅ Dashboard actualizado correctamente', 'success')
      
    } catch (error) {
      console.error('❌ Error calculando dashboard:', error)
      showNotification('❌ Error al calcular dashboard', 'error')
    } finally {
      setLoadingDashboard(false)
    }
  }

  return (
    <section className="card">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #e9ecef'
      }}>
        <h2 style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: 0,
          color: '#2c3e50',
          fontSize: '28px',
          fontWeight: '600'
        }}>
          📊 Dashboard Ejecutivo
        </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              {isCarli && (
                <button
                  className="btn"
                  onClick={() => setShowHeatMapModal(true)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🗺️ Mapa de Calor
                </button>
              )}
          <button
            className="btn btn-primary"
            onClick={calcularDashboard}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 'bold',
              borderRadius: '8px'
            }}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Modal de Mapa de Calor */}
      <HeatMapModal
        isOpen={showHeatMapModal}
        onClose={() => setShowHeatMapModal(false)}
        orders={orders}
      />

      {loadingDashboard && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
          <h3>Calculando estadísticas...</h3>
          <p>Analizando datos de pedidos entregados</p>
        </div>
      )}

      {!loadingDashboard && !dashboardData && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
          <h3>Dashboard Ejecutivo</h3>
          <p>Analizando datos de pedidos...</p>
          <div style={{ 
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong>Total de pedidos:</strong> {orders.length}
            </p>
            {orders.length === 0 && (
              <div>
                <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#6c757d' }}>
                  Cargando datos desde Google Sheets...
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    console.log('🔄 Cargando datos manualmente...')
                    loadOrdersFromSheet()
                  }}
                  style={{
                    marginTop: '15px',
                    padding: '10px 20px',
                    fontSize: '14px'
                  }}
                >
                  🔄 Cargar Datos Ahora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!loadingDashboard && dashboardData && (
        <div>
          {/* Resumen General */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'center',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>TOTAL PEDIDOS</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {dashboardData.resumen.totalPedidos}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'center',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>ENTREGADOS</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {dashboardData.resumen.pedidosEntregados}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'center',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚴‍♂️</div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>TOTAL BIKERS</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {dashboardData.resumen.totalBikers}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'center',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏢</div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>TOTAL EMPRESAS</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {dashboardData.resumen.totalEmpresas}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'center',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏱️</div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>DURACIÓN PROMEDIO</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {formatDuracion(dashboardData.resumen.duracionPromedio)}
              </div>
            </div>
          </div>

          {/* Carreras por Estado */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              📋 Carreras por Estado
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px'
            }}>
              {Object.entries(dashboardData.carrerasPorEstado)
                .sort((a, b) => b[1] - a[1])
                .map(([estado, cantidad]) => (
                  <div key={estado} style={{
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '5px' }}>
                      {estado}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>
                      {cantidad}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Bikers por Cantidad */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              🏆 Top 10 Bikers por Cantidad de Carreras (Entregadas)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '15px'
            }}>
              {dashboardData.topBikersPorCantidad.map((biker, index) => {
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#3498db', '#95a5a6', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
                
                return (
                  <div key={biker.nombre} style={{
                    background: `linear-gradient(135deg, ${colors[index] || '#95a5a6'}22 0%, ${colors[index] || '#95a5a6'}11 100%)`,
                    padding: '15px',
                    borderRadius: '10px',
                    border: `2px solid ${colors[index] || '#95a5a6'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {medals[index]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: '#2c3e50',
                        marginBottom: '5px'
                      }}>
                        {biker.nombre}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        📦 {biker.cantidadCarreras} carreras
                      </div>
                      <div style={{ fontSize: '13px', color: '#999', marginTop: '3px' }}>
                        💰 Bs{biker.gananciasTotales.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Bikers por Ganancias */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              💰 Top 10 Bikers por Ganancias Totales (Entregadas)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '15px'
            }}>
              {dashboardData.topBikersPorGanancias.map((biker, index) => {
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#3498db', '#95a5a6', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
                
                return (
                  <div key={biker.nombre} style={{
                    background: `linear-gradient(135deg, ${colors[index] || '#95a5a6'}22 0%, ${colors[index] || '#95a5a6'}11 100%)`,
                    padding: '15px',
                    borderRadius: '10px',
                    border: `2px solid ${colors[index] || '#95a5a6'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {medals[index]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: '#2c3e50',
                        marginBottom: '5px'
                      }}>
                        {biker.nombre}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                        💰 Bs{biker.gananciasTotales.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '13px', color: '#999', marginTop: '3px' }}>
                        📦 {biker.cantidadCarreras} carreras
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Empresas por Cantidad */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              🏢 Top 10 Empresas por Cantidad de Carreras (Entregadas)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '15px'
            }}>
              {dashboardData.topEmpresasPorCantidad.map((empresa, index) => {
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#3498db', '#95a5a6', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
                
                return (
                  <div key={empresa.nombre} style={{
                    background: `linear-gradient(135deg, ${colors[index] || '#95a5a6'}22 0%, ${colors[index] || '#95a5a6'}11 100%)`,
                    padding: '15px',
                    borderRadius: '10px',
                    border: `2px solid ${colors[index] || '#95a5a6'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {medals[index]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: '#2c3e50',
                        marginBottom: '5px'
                      }}>
                        {empresa.nombre}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        📦 {empresa.cantidadCarreras} carreras
                      </div>
                      <div style={{ fontSize: '13px', color: '#999', marginTop: '3px' }}>
                        💰 Bs{empresa.totalPagado.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Empresas por Pago */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              💵 Top 10 Empresas por Pago Total (Entregadas)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '15px'
            }}>
              {dashboardData.topEmpresasPorPago.map((empresa, index) => {
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#3498db', '#95a5a6', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
                
                return (
                  <div key={empresa.nombre} style={{
                    background: `linear-gradient(135deg, ${colors[index] || '#95a5a6'}22 0%, ${colors[index] || '#95a5a6'}11 100%)`,
                    padding: '15px',
                    borderRadius: '10px',
                    border: `2px solid ${colors[index] || '#95a5a6'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {medals[index]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: '#2c3e50',
                        marginBottom: '5px'
                      }}>
                        {empresa.nombre}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                        💰 Bs{empresa.totalPagado.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '13px', color: '#999', marginTop: '3px' }}>
                        📦 {empresa.cantidadCarreras} carreras
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top 3 Operadores con Problemas */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              👨‍💼 Top 3 Operadores con Carreras Incompletas
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '15px'
            }}>
              {dashboardData.topOperadoresProblemas.map((operador, index) => {
                const colors = ['#e74c3c', '#f39c12', '#e67e22']
                const medals = ['🥇', '🥈', '🥉']
                
                return (
                  <div key={operador.nombre} style={{
                    background: `linear-gradient(135deg, ${colors[index] || '#e74c3c'}22 0%, ${colors[index] || '#e74c3c'}11 100%)`,
                    padding: '15px',
                    borderRadius: '10px',
                    border: `2px solid ${colors[index] || '#e74c3c'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {medals[index]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: '#2c3e50',
                        marginBottom: '5px'
                      }}>
                        {operador.nombre}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        ⚠️ {operador.total} carreras con problemas
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                        Sin Hora Fin: {operador.sinHoraFin} | Sin Hora Ini: {operador.sinHoraIni}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Análisis de Duración */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              ⏱️ Análisis de Duración de Carreras
            </h3>
            
            <div style={{
              background: '#d1ecf1',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #bee5eb',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '16px', color: '#0c5460', marginBottom: '5px' }}>
                Duración Promedio por Carrera
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5460' }}>
                {formatDuracion(dashboardData.duracionPromedio)}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Carreras Más Largas */}
              <div>
                <h4 style={{ 
                  marginBottom: '15px',
                  color: '#e74c3c', 
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  🐌 Top 15 Carreras Más Largas
                </h4>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  paddingRight: '10px'
                }}>
                  {dashboardData.carrerasMasLargas.map((carrera, index) => (
                    <div key={index} style={{
                      background: '#fee',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #fcc',
                      flexShrink: 0
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#721c24', marginBottom: '5px' }}>
                        ID: {carrera.pedido.ID || carrera.pedido.id || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Cliente: {carrera.pedido.Cliente || carrera.pedido.cliente || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Biker: {carrera.pedido.Biker || carrera.pedido.biker || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                        Precio: Bs{parseFloat(carrera.pedido['Precio [Bs]'] || carrera.pedido.precio_bs || carrera.pedido.precio || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e74c3c', marginTop: '5px' }}>
                        ⏱️ {formatDuracion(carrera.duracionMin)} ({carrera.duracionOriginal})
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carreras Más Cortas */}
              <div>
                <h4 style={{ 
                  marginBottom: '15px',
                  color: '#2ecc71', 
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  ⚡ Top 15 Carreras Más Cortas
                </h4>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  paddingRight: '10px'
                }}>
                  {dashboardData.carrerasMasCortas.map((carrera, index) => (
                    <div key={index} style={{
                      background: '#efe',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cfc',
                      flexShrink: 0
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#155724', marginBottom: '5px' }}>
                        ID: {carrera.pedido.ID || carrera.pedido.id || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Cliente: {carrera.pedido.Cliente || carrera.pedido.cliente || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Biker: {carrera.pedido.Biker || carrera.pedido.biker || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                        Precio: Bs{parseFloat(carrera.pedido['Precio [Bs]'] || carrera.pedido.precio_bs || carrera.pedido.precio || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2ecc71', marginTop: '5px' }}>
                        ⏱️ {formatDuracion(carrera.duracionMin)} ({carrera.duracionOriginal})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Carreras Problemáticas */}
          <div style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <h3 style={{ 
              marginBottom: '20px',
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              🔍 Carreras Problemáticas para Observar
            </h3>
            <div style={{
              background: '#fff3cd',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #ffc107'
            }}>
              <div style={{ fontSize: '14px', color: '#856404' }}>
                Total: {dashboardData.carrerasProblematicas.length} carreras con problemas detectados
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    background: '#f8f9fa',
                    borderBottom: '2px solid #dee2e6'
                  }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Fecha</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Operador</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Biker</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Estado</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Precio</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Hora Ini</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Hora Fin</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.carrerasProblematicas.map((carrera, index) => (
                    <tr 
                      key={index}
                      style={{
                        borderBottom: '1px solid #dee2e6',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                      }}
                    >
                      <td style={{ padding: '10px', color: '#2c3e50', fontWeight: '600' }}>
                        {carrera.id}
                      </td>
                      <td style={{ padding: '10px', color: '#666' }}>
                        {carrera.fecha}
                      </td>
                      <td style={{ padding: '10px', color: '#666' }}>
                        {carrera.operador}
                      </td>
                      <td style={{ padding: '10px', color: '#666' }}>
                        {carrera.biker}
                      </td>
                      <td style={{ padding: '10px', color: '#666' }}>
                        {carrera.estado}
                      </td>
                      <td style={{ padding: '10px', color: carrera.precio === '0' || carrera.precio === '' ? '#e74c3c' : '#666' }}>
                        {carrera.precio === '0' || carrera.precio === '' ? '⚠️ Sin precio' : `Bs${carrera.precio}`}
                      </td>
                      <td style={{ padding: '10px', color: carrera.horaIni === 'N/A' ? '#e74c3c' : '#666' }}>
                        {carrera.horaIni === 'N/A' ? '⚠️' : carrera.horaIni}
                      </td>
                      <td style={{ padding: '10px', color: carrera.horaFin === 'N/A' ? '#e74c3c' : '#666' }}>
                        {carrera.horaFin === 'N/A' ? '⚠️' : carrera.horaFin}
                      </td>
                      <td style={{ padding: '10px', color: carrera.duracion === 'N/A' ? '#e74c3c' : '#666' }}>
                        {carrera.duracion === 'N/A' ? '⚠️' : carrera.duracion}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Dashboard
