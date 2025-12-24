import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, user, isLoading } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('ui.theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ui.theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // Redirigir según el rol del usuario
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'cliente') {
        navigate('/cliente')
      } else if (user.role === 'admin' || user.role === 'operador') {
        navigate('/pedidos')
      }
    }
  }, [isAuthenticated, user, isLoading, navigate])

  if (isLoading) {
    return null // O un spinner mientras carga
  }

  return (
    <div className="modern-landing">
      {/* Header */}
      <header className="modern-header">
        <div className="header-content">
          <div className="logo-container">
            <img src="/abeja.png" alt="Beezy" className="header-logo" />
            <span className="brand-name">beezy</span>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              color: 'var(--text)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--input-bg)'
              e.currentTarget.style.borderColor = 'var(--primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                Plataforma de <span className="highlight">gestión interna</span> para el equipo
              </h1>
              <p className="hero-description">
                Sistema centralizado para <strong>gestionar pedidos, horarios de drivers, cobros y reportes</strong> de manera eficiente y organizada.
              </p>
              
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginTop: '32px',
                flexWrap: 'wrap'
              }}>
                {/* Botón Admin */}
                <button 
                  onClick={() => navigate('/login', { state: { userType: 'admin' } })}
                  style={{
                    padding: '14px 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: '2px solid #f49f10',
                    background: '#f49f10',
                    color: '#1f2937',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontFamily: 'inherit',
                    boxShadow: '0 8px 20px rgba(244, 159, 16, 0.35)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fbbf24'
                    e.currentTarget.style.borderColor = '#fbbf24'
                    e.currentTarget.style.color = '#1a1a1a'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(244, 159, 16, 0.45)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f49f10'
                    e.currentTarget.style.borderColor = '#f49f10'
                    e.currentTarget.style.color = '#1f2937'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(244, 159, 16, 0.35)'
                  }}
                >
                  <Icon name="shield" size={20} />
                  Admin
                </button>

                {/* Botón Cliente */}
                <button 
                  onClick={() => navigate('/login', { state: { userType: 'cliente' } })}
                  style={{
                    padding: '14px 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: '2px solid #f49f10',
                    background: '#f49f10',
                    color: '#1f2937',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontFamily: 'inherit',
                    boxShadow: '0 8px 20px rgba(244, 159, 16, 0.35)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fbbf24'
                    e.currentTarget.style.borderColor = '#fbbf24'
                    e.currentTarget.style.color = '#1a1a1a'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(244, 159, 16, 0.45)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f49f10'
                    e.currentTarget.style.borderColor = '#f49f10'
                    e.currentTarget.style.color = '#1f2937'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(244, 159, 16, 0.35)'
                  }}
                >
                  <Icon name="user" size={20} />
                  Cliente
                </button>
              </div>
            </div>
            <div className="hero-visual">
              <div className="feature-showcase">
                <div className="showcase-card main-card">
                  <div className="card-icon">📦</div>
                  <h3>Pedidos</h3>
                  <p>Gestión completa</p>
                </div>
                <div className="showcase-card">
                  <div className="card-icon">🚚</div>
                  <h3>Delivery</h3>
                </div>
                <div className="showcase-card">
                  <div className="card-icon">💰</div>
                  <h3>Cobros</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">Funcionalidades principales del sistema</h2>
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">📦</div>
              </div>
              <h3>Gestión de Pedidos</h3>
              <p>Registro, seguimiento y administración de todos los pedidos del sistema con actualizaciones en tiempo real</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">📅</div>
              </div>
              <h3>Horarios de Drivers</h3>
              <p>Configuración de horarios, disponibilidad de conductores y gestión de asignaciones de vehículos</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">💰</div>
              </div>
              <h3>Cobros y Pagos</h3>
              <p>Registro de transacciones, seguimiento de pagos y gestión del estado financiero de las operaciones</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">📊</div>
              </div>
              <h3>Dashboard Ejecutivo</h3>
              <p>Visualización de métricas, reportes operativos y análisis de rendimiento del sistema</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="benefits-container">
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">⚡</div>
              <h4>Acceso rápido y eficiente</h4>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🔄</div>
              <h4>Actualizaciones en tiempo real</h4>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🔒</div>
              <h4>Acceso seguro para el equipo</h4>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="modern-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/abeja.png" alt="Beezy" className="footer-logo" />
            <span className="footer-brand-name">beezy</span>
          </div>
          <p className="footer-text">
            © {new Date().getFullYear()} Beezy - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  )
}

