import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authenticateUser } from '../data/users.js'
import { useAuth } from '../hooks/useAuth.js'
import Icon from '../components/Icon.jsx'
import NovedadesModal from '../components/NovedadesModal.jsx'
import { shouldShowNovedades } from '../components/novedadesUtils.js'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('ui.theme') || 'dark')
  const [showNovedades, setShowNovedades] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  
  // Obtener el tipo de usuario desde el state de navegación
  const userType = location.state?.userType || null

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ui.theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const handleNovedadesClose = () => {
    setShowNovedades(false)
    if (pendingNavigation) {
      navigate(pendingNavigation, { replace: true })
      setPendingNavigation(null)
    }
  }

  // Limpiar campos al cargar el componente
  useEffect(() => {
    setUsername('')
    setPassword('')
    setError('')
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Validar campos vacíos
    if (!username.trim() || !password.trim()) {
      setError('Por favor, complete todos los campos')
      return
    }

    // Autenticar usuario
    const userData = authenticateUser(username.trim(), password)
    
    if (!userData) {
      setError('Usuario o contraseña inválidos')
      return
    }

    // Validar que el rol coincida con el tipo de acceso seleccionado
    if (userType) {
      if (userType === 'cliente' && userData.role !== 'cliente') {
        setError('Este usuario no tiene acceso de Cliente. Use el botón Admin.')
        return
      }
      
      if (userType === 'admin' && userData.role === 'cliente') {
        setError('Los clientes deben usar el botón Cliente.')
        return
      }
    }

    // Iniciar sesión con datos del usuario
    try {
      login(userData)
      
      // Redirigir según el rol
      let redirectPath = '/pedidos' // Default para admin y operador
      if (userData.role === 'cliente') {
        redirectPath = '/cliente'
      } else if (userData.role === 'admin' || userData.role === 'operador') {
        redirectPath = '/pedidos'
      }
      
      const to = location.state?.from?.pathname || redirectPath
      
      // Verificar si debe mostrarse el modal de novedades
      if (shouldShowNovedades()) {
        setPendingNavigation(to)
        setShowNovedades(true)
      } else {
        navigate(to, { replace: true })
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error)
      setError('Error al iniciar sesión. Intente nuevamente.')
    }
  }

  return (
    <div className="modern-login">
      {/* Background */}
      <div className="login-bg">
        <div className="bg-pattern"></div>
        <div className="bg-gradient"></div>
      </div>

      {/* Login Form */}
      <div className="login-wrapper">
        <div className="login-card">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              color: '#6b7280',
              transition: 'all 0.2s',
              zIndex: 10,
              width: '36px',
              height: '36px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb'
              e.currentTarget.style.borderColor = '#ffc107'
              e.currentTarget.style.color = '#ffc107'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          {/* Header */}
          <div className="login-header">
            <div className="login-logo" style={{ marginBottom: '24px' }}>
              <img src="/abeja.png" alt="Beezy" className="logo-img" />
              <span className="logo-text">beezy</span>
            </div>
            <h1 className="login-title" style={{ fontSize: '28px', marginBottom: '8px' }}>
              {userType === 'cliente' ? 'Portal de Cliente' : userType === 'admin' ? 'Panel Admin' : 'Iniciar Sesión'}
            </h1>
            <p style={{ 
              fontSize: '15px', 
              color: 'var(--muted)', 
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit} autoComplete="off" data-lpignore="true">
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario"
                className="form-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                autoFocus
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="form-input"
                  style={{ paddingRight: '45px' }}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="toggle-password-btn"
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    transition: 'all 0.2s ease',
                    fontSize: '18px',
                    borderRadius: '4px',
                    width: '32px',
                    height: '32px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#374151'
                    e.currentTarget.style.background = '#f3f4f6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af'
                    e.currentTarget.style.background = 'none'
                  }}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    // Ojo con línea (ocultar)
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    // Ojo normal (mostrar)
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            
            <button className="login-button" type="submit">
              Iniciar Sesión
            </button>
          </form>

          {/* Botón para volver */}
          {userType && (
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                marginTop: '20px',
                padding: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#6b7280',
                transition: 'all 0.2s',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffc107'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280'
              }}
            >
              <Icon name="arrowLeft" size={16} />
              Volver a opciones
            </button>
          )}

          {/* Footer */}
          <div className="login-footer">
            <p>Sistema de gestión interno • Beezy</p>
          </div>
        </div>
      </div>

      {/* Modal de Novedades */}
      {showNovedades && <NovedadesModal onClose={handleNovedadesClose} />}
    </div>
  )
}
