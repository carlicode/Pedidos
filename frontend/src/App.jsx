import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Orders from './pages/Orders.jsx'
import Horarios from './pages/Horarios.jsx'
import InventarioAdmin from './pages/InventarioAdmin.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import Notes from './pages/Notes.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Icon from './components/Icon.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useTheme } from './contexts/ThemeContext.jsx'

export default function App() {
  const { theme } = useTheme()
  const { user, logout, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // No mostrar header en landing page ni en login
  const showHeader = location.pathname !== '/' && location.pathname !== '/login'

  // SSE global: notificar nuevos pedidos de clientes en cualquier página
  const sseReconnectRef = useRef(null)
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'operador')) return

    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'https://d1tufgzki2ukr8.cloudfront.net'
    let eventSource = null

    const connect = () => {
      eventSource = new EventSource(`${backendUrl}/api/sse/pedidos-clientes`)

      eventSource.addEventListener('nuevo_pedido', (e) => {
        try {
          const pedido = JSON.parse(e.data)
          toast(`🚨 ¡Nuevo pedido de cliente! #${pedido.id} - ${pedido.cliente}`, {
            autoClose: 12000,
            position: 'top-center',
            style: {
              background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '15px',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(249,115,22,0.5)'
            },
            progressStyle: { background: 'rgba(255,255,255,0.5)' }
          })
          const playSound = () => {
            try {
              const audio = new Audio('/music/new-notification.mp3')
              audio.play().catch(() => {
                try {
                  const AudioCtx = window.AudioContext || window.webkitAudioContext
                  if (AudioCtx) {
                    const ctx = new AudioCtx()
                    const osc = ctx.createOscillator()
                    const gain = ctx.createGain()
                    osc.connect(gain)
                    gain.connect(ctx.destination)
                    osc.frequency.value = 880
                    gain.gain.setValueAtTime(0.3, ctx.currentTime)
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                    osc.start(ctx.currentTime)
                    osc.stop(ctx.currentTime + 0.5)
                  }
                } catch (_) {}
              })
            } catch (_) {}
          }
          let count = 0
          const interval = setInterval(() => {
            playSound()
            count++
            if (count >= 5) clearInterval(interval)
          }, 1500)
          playSound()
        } catch (err) {
          console.error('Error procesando evento SSE:', err)
        }
      })

      eventSource.onerror = () => {
        console.warn('SSE error, reconectando en 5s...')
        eventSource.close()
        sseReconnectRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      if (eventSource) eventSource.close()
      if (sseReconnectRef.current) clearTimeout(sseReconnectRef.current)
    }
  }, [user])

  return (
    <div className="app-container">
      {showHeader && (
        <header className="app-header">
          <div 
            className="brand" 
            onClick={() => navigate('/pedidos')}
            style={{ cursor: 'pointer' }}
            title="Volver a Pedidos"
          >
            <img src="/logo.jpg" alt="Beezy" className="brand-logo" />
            <span className="brand-text">Beezy</span>
          </div>
          <div className="user-area">
            <ThemeToggle showLabel={true} size="medium" />
            <button className="btn" onClick={handleLogout}>
              <Icon name="logOut" size={16} style={{ marginRight: '6px' }} />
              Salir
            </button>
          </div>
        </header>
      )}

      <main className={showHeader ? "app-main" : "app-main-full"}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/pedidos"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/horarios"
            element={
              <ProtectedRoute requiredRole="admin">
                <Horarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventario-admin"
            element={
              <ProtectedRoute requiredRole="admin" customCheck={(user) => {
                const usuariosPermitidosInventario = ['miguel', 'carli', 'ale']
                return user && user.username && usuariosPermitidosInventario.includes(user.username.toLowerCase())
              }}>
                <InventarioAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notas"
            element={
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showHeader && (
        <footer className="app-footer">© {new Date().getFullYear()} Beezy - Sistema de Gestión de Pedidos</footer>
      )}
      
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme}
      />
    </div>
  )
}
