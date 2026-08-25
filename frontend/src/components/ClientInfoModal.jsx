import { useState, useEffect } from 'react';
import '../styles/ClientInfoModal.css';
import { getApiUrl } from '../utils/api.js';

const CAMPOS = [
  ['cuenta', 'Cuenta'],
  ['procedimientos', 'Procedimientos'],
  ['etiqueta', 'Etiqueta'],
  ['envios', 'Envíos'],
  ['tipoPago', 'Tipo de pago'],
]

export default function ClientInfoModal({ isOpen, onClose, clientName, onPasteToDetalles }) {
  const [clientInfo, setClientInfo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && clientName) {
      fetchClientInfo();
    }
  }, [isOpen, clientName]);

  const fetchClientInfo = async () => {
    if (!clientName || clientName === '__CUSTOM__') {
      setError('Seleccione un cliente válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl(`/api/client-info/${encodeURIComponent(clientName)}`));

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Error al obtener información del cliente');
      }

      const data = await response.json();
      setClientInfo(data.data || []);

      if (data.data.length === 0) {
        setError('No se encontró información para este cliente');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tieneDatos = (info) => CAMPOS.some(([campo]) => (info[campo] || '').trim())

  const buildDetallesText = (info) => {
    return CAMPOS
      .map(([campo, etiqueta]) => [etiqueta, (info[campo] || '').trim()])
      .filter(([, valor]) => valor)
      .map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)
      .join('\n')
  }

  const handlePasteToDetalles = (info) => {
    const text = buildDetallesText(info)
    if (!text || !onPasteToDetalles) return
    onPasteToDetalles(text)
  }

  const primaryInfo = clientInfo.find((info) => buildDetallesText(info))

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content client-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ℹ️ Información del Cliente</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="client-info-search">
            <strong>Cliente:</strong> {clientName}
          </div>

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando información...</p>
            </div>
          )}

          {error && !loading && (
            <div className="error-state">
              <p>⚠️ {error}</p>
            </div>
          )}

          {!loading && !error && clientInfo.length > 0 && (
            <div className="client-info-results">
              <p className="results-count">
                Se encontraron <strong>{clientInfo.length}</strong> registro(s)
              </p>

              {clientInfo.map((info, index) => (
                <div key={index} className="client-info-card">
                  <div className="card-header">
                    <h3>{info.nombreCliente}</h3>
                    {info.aproximado && (
                      <span className="value tag">coincidencia aproximada</span>
                    )}
                  </div>

                  <div className="card-body">
                    {tieneDatos(info) ? (
                      CAMPOS.map(([campo, etiqueta]) => (
                        <div key={campo} className="info-row">
                          <span className="label">{etiqueta}:</span>
                          <span className="value">{(info[campo] || '').trim() || '-'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="info-row sin-datos">
                        <span className="value">
                          El cliente está en la hoja, pero todavía no tiene datos cargados.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {onPasteToDetalles && primaryInfo && (
            <button
              type="button"
              className="btn-paste-detalles"
              onClick={() => handlePasteToDetalles(primaryInfo)}
            >
              📋 Pegar en Detalles de la Carrera
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
