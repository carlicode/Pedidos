import React from 'react'
import Icon from './Icon'

/**
 * Componente visual para indicar el estado de validación de un link de Google Maps
 * Muestra:
 * - ✓ Verde: Link válido
 * - ✗ Roja: Link inválido
 * - ⟳ Amarillo: Validando...
 * - ∅ Gris: Sin validar (idle)
 * 
 * @param {Object} props
 * @param {string} props.status - Estado: 'idle' | 'validating' | 'valid' | 'invalid'
 * @param {string} props.error - Mensaje de error (opcional)
 * @param {string} props.warning - Mensaje de advertencia (opcional)
 * @param {boolean} props.cached - Si el resultado viene de caché
 * @param {string} props.size - Tamaño del ícono (default: '20px')
 * @param {boolean} props.showTooltip - Mostrar tooltip con detalles (default: true)
 */
export default function MapsLinkValidator({ 
  status = 'idle',
  error = null,
  warning = null,
  cached = false,
  size = '20px',
  showTooltip = true
}) {
  const getStatusConfig = () => {
    switch (status) {
      case 'validating':
        return {
          icon: '⟳',
          color: '#eab308',
          backgroundColor: '#fef9c3',
          borderColor: '#fcd34d',
          tooltip: 'Validando link...',
          animate: true
        }
      case 'valid':
        return {
          icon: '✓',
          color: '#10b981',
          backgroundColor: '#d1fae5',
          borderColor: '#6ee7b7',
          tooltip: cached ? 'Link válido (caché)' : (warning || 'Link válido'),
          animate: false
        }
      case 'invalid':
        return {
          icon: '✗',
          color: '#ef4444',
          backgroundColor: '#fee2e2',
          borderColor: '#fca5a5',
          tooltip: error || 'Link inválido',
          animate: false
        }
      case 'idle':
      default:
        return {
          icon: '∅',
          color: '#9ca3af',
          backgroundColor: '#f3f4f6',
          borderColor: '#d1d5db',
          tooltip: 'Link no validado',
          animate: false
        }
    }
  }

  const config = getStatusConfig()

  const iconStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    fontSize: `calc(${size} * 0.6)`,
    fontWeight: 'bold',
    color: config.color,
    backgroundColor: config.backgroundColor,
    border: `2px solid ${config.borderColor}`,
    borderRadius: '50%',
    cursor: showTooltip ? 'help' : 'default',
    transition: 'all 0.2s ease',
    animation: config.animate ? 'spin 1s linear infinite' : 'none',
    flexShrink: 0
  }

  const tooltipText = config.tooltip

  return (
    <span
      style={iconStyle}
      title={showTooltip ? tooltipText : ''}
      aria-label={tooltipText}
      role="status"
    >
      {config.icon}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </span>
  )
}

/**
 * Componente de input con validación visual integrada
 * Combina un input de texto con el indicador de validación
 * 
 * @param {Object} props - Props del input + props de validación
 */
export function MapsLinkInput({
  value,
  onChange,
  placeholder = 'https://maps.app.goo.gl/...',
  validation = { status: 'idle' },
  onValidate = null,
  required = false,
  disabled = false,
  style = {},
  inputStyle = {},
  label = null,
  ...inputProps
}) {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    ...style
  }

  const inputWrapperStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const defaultInputStyle = {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--input-border)',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'var(--input-bg)',
    ...inputStyle
  }

  return (
    <div style={containerStyle}>
      {label && (
        <label style={{ marginBottom: '4px', display: 'block', fontSize: '14px' }}>
          {label}
          {required && <span style={{ color: 'var(--error)', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      
      <div style={inputWrapperStyle}>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          style={defaultInputStyle}
          {...inputProps}
        />
        
        {value && value.trim() !== '' && (
          <MapsLinkValidator
            status={validation.status}
            error={validation.error}
            warning={validation.warning}
            cached={validation.cached}
            size="24px"
          />
        )}
        
        {onValidate && value && value.trim() !== '' && validation.status !== 'validating' && (
          <button
            type="button"
            onClick={() => onValidate(value)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--brand)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
            title="Validar link manualmente"
          >
            Validar
          </button>
        )}
      </div>

      {validation.status === 'invalid' && validation.error && (
        <div style={{
          fontSize: '12px',
          color: '#ef4444',
          marginTop: '2px'
        }}>
          {validation.error}
        </div>
      )}

      {validation.status === 'valid' && validation.warning && (
        <div style={{
          fontSize: '12px',
          color: '#eab308',
          marginTop: '2px'
        }}>
          ⚠️ {validation.warning}
        </div>
      )}
    </div>
  )
}
