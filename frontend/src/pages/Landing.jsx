import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, user, isLoading } = useAuth()

  // Redirigir usuarios autenticados (solo admin/operador) a pedidos
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'admin' || user.role === 'operador') {
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
          <ThemeToggle showLabel={true} size="medium" />
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
              
              <div className="hero-cta-wrap">
                <button 
                  type="button"
                  className="cta-button"
                  onClick={() => navigate('/login')}
                >
                  <Icon name="shield" size={20} />
                  Iniciar sesión
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

