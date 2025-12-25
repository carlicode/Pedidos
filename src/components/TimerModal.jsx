import React, { useState, useEffect } from 'react'
import Icon from './Icon'
import { toast } from 'react-toastify'

const TimerModal = ({ isOpen, onClose, onIniciarTimer, timerActivo, tiempoRestante, formatearTiempo, onDetenerTimer, mensajeTimer }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [minutos, setMinutos] = useState('0')
  const [segundos, setSegundos] = useState('0')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    // Detectar dark mode
    const checkDarkMode = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      setIsDarkMode(theme === 'dark')
    }
    
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 100)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen && !timerActivo) {
      // Resetear campos cuando se cierra (solo si no hay timer activo)
      setMinutos('0')
      setSegundos('0')
      setMensaje('')
    }
  }, [isOpen, timerActivo])

  // Agregar funcionalidad de ESC para cerrar
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  const iniciarTimer = () => {
    const exito = onIniciarTimer(minutos, segundos, mensaje)
    if (exito) {
      // Cerrar el modal después de iniciar el timer
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: isVisible ? 'auto' : 'none',
        overflowY: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: isDarkMode ? 'var(--bg-secondary)' : 'var(--panel)',
          borderRadius: '16px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease, background-color 0.3s ease',
          border: '1px solid var(--border)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón X en la esquina superior derecha */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            transition: 'all 0.2s',
            zIndex: 10001,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
          title="Cerrar (ESC)"
        >
          <Icon name="xCircle" size={18} />
        </button>

        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%)`,
            padding: '24px',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'white',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            ⏰
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              Timer / Recordatorio
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              Configura un recordatorio con tiempo
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Tiempo */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text)',
              }}
            >
              Tiempo *
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>
                  Minutos
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutos}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                      setMinutos(val)
                    }
                  }}
                  disabled={timerActivo}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    backgroundColor: timerActivo ? 'var(--bg)' : 'var(--input-bg)',
                    color: 'var(--text)',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)', marginTop: '20px' }}>
                :
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>
                  Segundos
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={segundos}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                      setSegundos(val)
                    }
                  }}
                  disabled={timerActivo}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    backgroundColor: timerActivo ? 'var(--bg)' : 'var(--input-bg)',
                    color: 'var(--text)',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Mensaje */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text)',
              }}
            >
              Mensaje Recordatorio *
            </label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej: Revisar pedido #123, Llamar a cliente..."
              disabled={timerActivo}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                border: '2px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: timerActivo ? 'var(--bg)' : 'var(--input-bg)',
                color: 'var(--text)',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Timer activo - mostrar tiempo restante */}
          {timerActivo && tiempoRestante !== null && (
            <div
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg)',
                borderRadius: '12px',
                border: '2px solid var(--brand)',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                Tiempo Restante
              </div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--brand)', fontFamily: 'monospace' }}>
                {formatearTiempo(tiempoRestante)}
              </div>
              <button
                onClick={onDetenerTimer}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--red)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Detener Timer
              </button>
            </div>
          )}

          {/* Botones */}
          {!timerActivo && (
            <button
              onClick={iniciarTimer}
              disabled={!minutos && !segundos || !mensaje.trim()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: (minutos || segundos) && mensaje.trim() ? 'var(--brand)' : 'var(--muted)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (minutos || segundos) && mensaje.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Icon name="clock" size={18} />
              Iniciar Timer
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

export default TimerModal

