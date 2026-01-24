import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Orders from './pages/Orders.jsx'
import Horarios from './pages/Horarios.jsx'
import InventarioAdmin from './pages/InventarioAdmin.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import Notes from './pages/Notes.jsx'
import Icon from './components/Icon.jsx'
import { useAuth } from './hooks/useAuth.js'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ui.theme') || 'dark')
  const { user, logout, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ui.theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // No mostrar header en landing page ni en login
  const showHeader = location.pathname !== '/' && location.pathname !== '/login'

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
            <button
              className="btn icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              <span style={{ marginLeft: '6px', fontSize: '12px' }}>
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </span>
            </button>
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
