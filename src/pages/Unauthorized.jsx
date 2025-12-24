import React from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'

export default function Unauthorized() {
  const navigate = useNavigate()

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <div className="unauthorized-icon">
          <Icon name="shield" size={64} />
        </div>
        <h1>Acceso No Autorizado</h1>
        <p>No tienes permisos para acceder a esta página.</p>
        <p>Contacta al administrador si crees que esto es un error.</p>
        
        <div className="button-group">
          <button 
            className="btn secondary" 
            onClick={handleGoBack}
          >
            <Icon name="arrowLeft" size={16} style={{ marginRight: '6px' }} />
            Volver
          </button>
          <button 
            className="btn primary" 
            onClick={handleGoHome}
          >
            <Icon name="home" size={16} style={{ marginRight: '6px' }} />
            Ir al Inicio
          </button>
        </div>
      </div>
    </div>
  )
}


