/**
 * Configuración automática de la URL del backend
 * Detecta si estamos en desarrollo (localhost) o en producción (AWS)
 */

/**
 * Obtiene la URL base del backend según el entorno
 * - En producción (Amplify): usa VITE_API_URL de variables de entorno
 * - En desarrollo local con Vite: '' (URLs relativas /api/* → proxy → backend, sin CORS)
 * - En red LAN: http://[IP-DEL-SERVIDOR]:5055
 */
export const getBackendUrl = () => {
  // 1. Variable de entorno (producción en AWS Amplify)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // 2. Variable de build alternativa (Amplify auto-inject)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // 3. Desarrollo local con Vite: usar URLs relativas para que el proxy /api → :5055 funcione
  // Así evitamos CORS y las peticiones llegan correctamente al backend
  const hostname = window.location.hostname
  if (import.meta.env.DEV && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return ''
  }
  
  // 4. Red LAN (ej. acceso desde otro dispositivo): misma IP para el backend
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return `http://${hostname}:5055`
  }
  
  // 5. Producción sin configuración
  if (import.meta.env.PROD) {
    console.error('Backend URL no configurada. Configure VITE_API_URL en Amplify.')
    throw new Error('Backend URL no configurada. Configure VITE_API_URL.')
  }
  
  return 'http://localhost:5055'
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

