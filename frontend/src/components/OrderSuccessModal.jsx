import React from 'react'
import Icon from './Icon.jsx'
import { formatCurrency } from '../utils/dateUtils.js'

/**
 * Modal de confirmación cuando se agrega un pedido.
 * Componente estable (no definido dentro de Orders) para evitar remounts
 * y parpadeo al recargar datos tras agregar.
 */
export default function OrderSuccessModal({ show, order, onStayInForm, onViewOrders }) {
  if (!show || !order) return null

  const o = order
  const bikerVal = o.biker || 'N/A'
  const bikerPending = !bikerVal || bikerVal.toUpperCase().includes('ASIGNAR')

  const infoRows = [
    { icon: 'tag', label: 'ID', value: String(o.id || 'N/A') },
    { icon: 'user', label: 'Operador', value: o.operador || 'N/A' },
    { icon: 'users', label: 'Cliente', value: o.cliente || 'N/A' },
    { icon: 'mapPin', label: 'Recojo', value: o.recojo || 'N/A' },
    { icon: 'mapPin', label: 'Entrega', value: o.entrega || 'N/A' },
    { icon: 'creditCard', label: 'Precio', value: formatCurrency(o.precio_bs ?? 0), highlight: true },
    { icon: 'bike', label: 'Biker', value: bikerVal, pending: bikerPending },
    { icon: 'calendar', label: 'Fecha', value: o.fecha || 'N/A' },
    { icon: 'clock', label: 'Hora inicio', value: o.hora_ini || 'N/A' },
    { icon: 'bike', label: 'Medio', value: o.medio_transporte || 'N/A' }
  ]
  if (o.cobro_pago && String(o.cobro_pago).trim() !== '') {
    infoRows.push({
      icon: 'creditCard',
      label: o.cobro_pago,
      value: formatCurrency(o.monto_cobro_pago ?? 0)
    })
    if (o.descripcion_cobro_pago) {
      infoRows.push({
        icon: 'fileText',
        label: 'Descripción',
        value: o.descripcion_cobro_pago
      })
    }
  }

  return (
    <div
      className="success-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        className="success-modal"
        role="dialog"
        aria-labelledby="success-modal-title"
        aria-describedby="success-modal-desc"
        style={{
          background: 'var(--panel)',
          color: 'var(--text)',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px var(--border)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.35)'
          }}>
            <Icon name="checkCircle" size={28} color="#fff" />
          </div>
          <h2
            id="success-modal-title"
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--text)',
              letterSpacing: '-0.02em'
            }}
          >
            ¡Pedido agregado!
          </h2>
          <p
            id="success-modal-desc"
            style={{
              margin: '6px 0 0',
              fontSize: '0.9rem',
              color: 'var(--muted)'
            }}
          >
            Revisa los datos del pedido #{o.id}
          </p>
        </div>

        {/* Info grid — títulos más destacados que el contenido */}
        <div
          className="success-modal-info"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
            background: 'var(--bg-secondary)'
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px 20px'
          }}>
            {infoRows.map(({ icon, label, value, highlight, pending }) => (
              <div
                key={label + value}
                style={{
                  gridColumn: label === 'Cliente' || (value && value.length > 35) ? '1 / -1' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Icon name={icon} size={15} color="var(--text)" />
                  {label}
                </span>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: highlight ? '700' : '400',
                  color: highlight ? 'var(--brand)' : pending ? 'var(--muted)' : 'var(--muted)',
                  wordBreak: 'break-word',
                  lineHeight: 1.4
                }}>
                  {value}
                  {pending && value !== 'N/A' && (
                    <span style={{
                      marginLeft: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: 'var(--muted)',
                      fontStyle: 'italic'
                    }}>
                      (pendiente)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          gap: '12px',
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          background: 'var(--panel)'
        }}>
          <button
            type="button"
            onClick={onStayInForm}
            className="btn btn-success-modal-add"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '0.95rem',
              fontWeight: '600',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--brand)',
              color: '#fff',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <Icon name="plus" size={18} />
            Agregar otro
          </button>
          <button
            type="button"
            onClick={onViewOrders}
            className="btn btn-success-modal-view"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '0.95rem',
              fontWeight: '600',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--text)',
              transition: 'transform 0.15s, border-color 0.15s, background 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.borderColor = 'var(--brand)'
              e.currentTarget.style.background = 'var(--bg-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <Icon name="listChecks" size={18} />
            Ver Pedidos
          </button>
        </div>
      </div>
    </div>
  )
}
