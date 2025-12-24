/**
 * Configuración automática de la URL del backend
 * Detecta si estamos en desarrollo (localhost) o en red LAN
 */

/**
 * Obtiene la URL base del backend según el entorno
 * - En desarrollo local: http://localhost:5055
 * - En red LAN: http://[IP-DEL-SERVIDOR]:5055
 */
export const getBackendUrl = () => {
  // Si hay una variable de entorno configurada, usarla
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }

  // Detectar automáticamente según el hostname actual
  const hostname = window.location.hostname
  
  // Si accedemos desde localhost o 127.0.0.1, usar localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5055'
  }
  
  // Si accedemos desde una IP en la red, usar esa misma IP para el backend
  // Esto asume que el backend está en la misma máquina que sirve el frontend
  return `http://${hostname}:5055`
}

/**
 * Realiza un fetch al backend con la URL correcta
 */
export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = getBackendUrl()
  const url = `${baseUrl}${endpoint}`
  
  const response = await fetch(url, options)
  return response
}

/**
 * Obtiene la URL completa de un endpoint del backend
 */
export const getApiUrl = (endpoint) => {
  const baseUrl = getBackendUrl()
  return `${baseUrl}${endpoint}`
}

