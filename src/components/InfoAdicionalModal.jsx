import React, { useState, useEffect } from 'react'
import Icon from './Icon.jsx'

/**
 * Modal para revisar y editar información adicional cuando se cambia
 * el punto de recojo o entrega en modo edición
 */
const InfoAdicionalModal = ({ 
  isOpen, 
  onClose, 
  onAccept, 
  onCancel,
  textoAnterior = '', 
  textoNuevo = '',
  tipo = 'recojo' // 'recojo' o 'entrega'
}) => {
  const [textoEditado, setTextoEditado] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Mostrar el texto concatenado en el campo editable
      const textoConcatenado = textoAnterior && textoAnterior.trim() !== '' 
        ? `${textoAnterior} | ${textoNuevo}`
        : textoNuevo
      setTextoEditado(textoConcatenado)
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [isOpen, textoNuevo, textoAnterior])

  const handleAccept = () => {
    if (onAccept) {
      onAccept(textoEditado)
    }
    handleClose()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    handleClose()
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      if (onClose) onClose()
    }, 300)
  }


  if (!isOpen) return null

  const tipoTexto = tipo === 'recojo' ? 'Recojo' : 'Entrega'
  const tieneTextoAnterior = textoAnterior && textoAnterior.trim() !== ''

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // No cerrar al hacer clic fuera; solo con botones
          return
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--panel)',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease',
          border: '1px solid var(--border)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%)',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon name="info" size={24} color="#fff" />
            <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 600 }}>
              Revisar Información Adicional - {tipoTexto}
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Texto Anterior */}
          {tieneTextoAnterior && (
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '8px',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon name="file-text" size={16} color="var(--muted)" />
                Información Anterior (ya guardada):
              </label>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text)',
                  minHeight: '60px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {textoAnterior}
              </div>
            </div>
          )}

          {/* Texto Editable (muestra el texto concatenado) */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'flex',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: '8px',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Icon name="edit" size={16} color="var(--brand)" />
              Información Final (puedes editarla):
            </label>
            <textarea
              value={textoEditado}
              onChange={(e) => setTextoEditado(e.target.value)}
              placeholder="Escribe o edita la información adicional..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '8px',
                color: 'var(--text)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          {/* Mensaje informativo */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid var(--yellow)',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#856404',
              display: 'flex',
              alignItems: 'start',
              gap: '8px',
            }}
          >
            <Icon name="alert-triangle" size={18} color="#856404" />
            <div>
              <strong>Nota:</strong> El campo editable muestra la información anterior concatenada con la nueva. 
              Puedes editarla como desees. Al aceptar, se sobrescribirá la información anterior con el contenido que edites aquí.
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--panel)',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--bg-secondary)'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'var(--panel)'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleAccept}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--brand)',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--brand-600)'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'var(--brand)'
            }}
          >
            <Icon name="check" size={18} />
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

export default InfoAdicionalModal
