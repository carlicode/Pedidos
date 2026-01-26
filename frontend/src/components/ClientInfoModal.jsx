import { useState, useEffect } from 'react';
import '../styles/ClientInfoModal.css';
import { getApiUrl } from '../utils/api.js';

export default function ClientInfoModal({ isOpen, onClose, clientName }) {
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
        throw new Error('Error al obtener información del cliente');
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
                  </div>
                  
                  <div className="card-body">
                    <div className="info-row">
                      <span className="label">Cuenta:</span>
                      <span className="value">{info.cuenta || '-'}</span>
                    </div>
                    
                    <div className="info-row">
                      <span className="label">Procedimientos:</span>
                      <span className="value">{info.procedimientos || '-'}</span>
                    </div>
                    
                    <div className="info-row">
                      <span className="label">Etiqueta:</span>
                      <span className="value tag">{info.etiqueta || '-'}</span>
                    </div>
                    
                    <div className="info-row">
                      <span className="label">Envíos:</span>
                      <span className="value">{info.envios || '-'}</span>
                    </div>
                    
                    <div className="info-row">
                      <span className="label">Tipo de Pago:</span>
                      <span className="value payment-type">{info.tipoPago || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
