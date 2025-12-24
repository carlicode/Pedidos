import React, { useState, useEffect } from 'react'
import Icon from './Icon.jsx'
import { NOVEDADES_KEY } from './novedadesUtils.js'

const NovedadesModal = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      localStorage.setItem(NOVEDADES_KEY, 'true')
      onClose()
    }, 300)
  }

  const novedades = [
    {
      icon: 'dollarSign',
      title: 'Cotización Rápida de Carreras',
      description: '¡Nueva función! Ahora puedes usar el botón flotante 💰 en la esquina inferior derecha para abrir un modal de cotización rápida. Solo ingresa los puntos de recojo y entrega, selecciona el medio de transporte, y el sistema calculará automáticamente la distancia y el precio. Luego puedes hacer clic en "Crear carrera" para llenar automáticamente el formulario de pedido con esa información. ¡Perfecto para cotizar rápidamente sin llenar todo el formulario!'
    },
    {
      icon: 'checkCircle',
      title: 'Validación Automática de Links de Google Maps',
      description: 'Ahora el sistema valida automáticamente los links de Google Maps cuando los pegas en los campos de Recojo y Entrega. Verás un emoji de validación (✅ si el link es válido, ❌ si no lo es) al lado derecho del botón "Maps". Esto te ayuda a saber inmediatamente si el link se puede usar para calcular la distancia automáticamente, evitando errores y ahorrando tiempo.'
    },
    {
      icon: 'alertTriangle',
      title: 'Modal de Error Mejorado para Cálculo de Distancia',
      description: 'Cuando el cálculo de distancia falla, ahora verás un modal con el mensaje "¿Revisa los links?" que te ayudará a identificar el problema. Además, podrás copiar el error completo de la terminal con un solo clic para reportarlo fácilmente al equipo técnico.'
    },
    {
      icon: 'mapPin',
      title: 'Botón Switch (⇅) para Intercambiar Rutas',
      description: 'Hemos agregado un botón de intercambio (⇅) al lado del botón "Cliente avisa" en la sección de Punto de Entrega. Con un solo clic puedes intercambiar automáticamente las direcciones de recojo y entrega, incluyendo sus links de Google Maps e información adicional. Esta función también está disponible al editar pedidos existentes.'
    },
    {
      icon: 'refreshCw',
      title: 'Interfaz Simplificada',
      description: 'Eliminamos el botón de ruta en Google Maps para mantener la interfaz más limpia y enfocada en las funciones principales. Ahora puedes concentrarte en gestionar los pedidos de manera más eficiente.'
    }
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #96c226 0%, #7ba01e 100%)',
            padding: '24px',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              ✨
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
                ¡Novedades del Sistema!
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                Mensaje de una sola vez
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <Icon name="xCircle" size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--text-primary)',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}
          >
            Hemos realizado mejoras importantes en el sistema. Aquí te contamos las novedades:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {novedades.map((novedad, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#96c226',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'white',
                  }}
                >
                  <Icon name={novedad.icon} size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '18px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {novedad.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    {novedad.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: '#96c226',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
              }}
            >
              ℹ️
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--text-secondary)',
                flex: 1,
              }}
            >
              <strong>Nota:</strong> Este mensaje aparecerá solo una vez. Si necesitas ver esta información nuevamente, puedes contactar al administrador del sistema.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: '12px 32px',
              backgroundColor: '#96c226',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7ba01e'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#96c226'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Entendido, continuar
            <Icon name="checkCircle" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default NovedadesModal

