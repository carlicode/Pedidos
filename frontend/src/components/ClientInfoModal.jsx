import { useState, useEffect } from 'react';
import '../styles/ClientInfoModal.css';
import { getApiUrl } from '../utils/api.js';

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

  const buildDetallesText = (info) => {
    const parts = []
    const descripcion = (info.descripcion || info.cuenta || '').trim()
    const mapa = (info.mapa || '').trim()
    if (descripcion) parts.push(descripcion)
    if (mapa) parts.push(mapa)
    return parts.join('\n')
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
                    {info.fuente && (
                      <span className="value tag">{info.fuente}</span>
                    )}
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <span className="label">Descripción:</span>
                      <span className="value">{info.descripcion || '-'}</span>
                    </div>

                    {info.mapa && (
                      <div className="info-row">
                        <span className="label">Mapa:</span>
                        <span className="value">
                          <a href={info.mapa} target="_blank" rel="noopener noreferrer">
                            Ver en Google Maps
                          </a>
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
