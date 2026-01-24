/**
 * HTTP Interceptor - Maneja automáticamente errores de autenticación
 * Intercepta respuestas 401 y redirige al login cuando es necesario
 */

import { getApiUrl } from './api.js'

/**
 * Wrapper de fetch que maneja automáticamente errores de autenticación
 * @param {string} url - URL del endpoint (relativa o absoluta)
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>} - Response del fetch
 */
export async function fetchWithAuth(url, options = {}) {
  // Si la URL es relativa, convertirla a absoluta
  const finalUrl = url.startsWith('http') ? url : getApiUrl(url)

  // Agregar token automáticamente si existe
  const token = localStorage.getItem('authToken')
  if (token && !options.headers?.['Authorization']) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    }
  }

  // Realizar el fetch
  const response = await fetch(finalUrl, options)

  // Manejar errores de autenticación
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}))

    // Si es una sesión inválida por reinicio del servidor
    if (data.code === 'SESSION_INVALID' || data.error?.includes('Sesión inválida')) {
      console.warn('⚠️ Sesión inválida detectada. Cerrando sesión...')
      
      // Limpiar localStorage
      localStorage.removeItem('auth.loggedIn')
      localStorage.removeItem('auth.user')
      localStorage.removeItem('authToken')
      localStorage.removeItem('auth.serverStartTime')

      // Mostrar mensaje al usuario
      const message = 'El servidor se reinició. Por favor, inicie sesión nuevamente.'
      
      // Si estamos en el navegador, mostrar alerta y redirigir
      if (typeof window !== 'undefined') {
        alert(message)
        window.location.href = '/'
      }
    }
  }

  return response
}

/**
 * Verifica si el token actual es válido
 * @returns {Promise<boolean>} - true si el token es válido
 */
export async function validateToken() {
  try {
    const token = localStorage.getItem('authToken')
    
    if (!token) {
      return false
    }

    const response = await fetch(getApiUrl('/api/auth/me'), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      const data = await response.json().catch(() => ({}))
      
      // Limpiar sesión si es inválida
      if (data.code === 'SESSION_INVALID') {
        localStorage.removeItem('auth.loggedIn')
        localStorage.removeItem('auth.user')
        localStorage.removeItem('authToken')
        localStorage.removeItem('auth.serverStartTime')
        return false
      }
    }

    return response.ok
  } catch (error) {
    console.error('Error validando token:', error)
    return false
  }
}

/**
 * Configura un interceptor global para fetch (opcional)
 * Sobrescribe el fetch global para manejar automáticamente auth
 */
export function setupGlobalInterceptor() {
  const originalFetch = window.fetch

  window.fetch = async function (...args) {
    const [url, options] = args

    // Solo interceptar llamadas a la API
    if (url.includes('/api/')) {
      return fetchWithAuth(url, options)
    }

    return originalFetch(...args)
  }

  console.log('🔐 Interceptor de autenticación configurado')
}
