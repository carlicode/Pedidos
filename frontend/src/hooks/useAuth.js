import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from '../utils/api.js'

/**
 * Hook personalizado para manejar la autenticación
 * Proporciona estado de usuario, funciones de login/logout y validaciones
 */
export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Verifica si el servidor se reinició y el token es inválido
  const checkServerRestart = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const serverStartTime = localStorage.getItem('auth.serverStartTime')
      
      if (!token || !serverStartTime) {
        return true // No hay token o info del servidor, permitir continuar
      }

      // Obtener info actual del servidor
      const response = await fetch(getApiUrl('/api/auth/server-info'))
      const data = await response.json()

      if (data.success && data.serverStartTime) {
        // Si el servidor se reinició, el serverStartTime será diferente
        if (parseInt(serverStartTime) !== data.serverStartTime) {
          console.warn('⚠️ El servidor se reinició. Cerrando sesión...')
          // Limpiar sesión automáticamente
          localStorage.removeItem('auth.loggedIn')
          localStorage.removeItem('auth.user')
          localStorage.removeItem('authToken')
          localStorage.removeItem('auth.serverStartTime')
          setUser(null)
          return false // Sesión inválida
        }
      }

      return true // Sesión válida
    } catch (error) {
      console.error('Error verificando estado del servidor:', error)
      return true // En caso de error, permitir continuar
    }
  }

  // Cargar usuario desde localStorage al inicializar
  useEffect(() => {
    const loadUser = async () => {
      try {
        const loggedIn = localStorage.getItem('auth.loggedIn')
        const userData = localStorage.getItem('auth.user')
        
        if (loggedIn === 'true' && userData) {
          // Verificar si el servidor se reinició
          const isValid = await checkServerRestart()
          
          if (!isValid) {
            // Sesión inválida por reinicio del servidor
            setIsLoading(false)
            return
          }

          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
        } else {
          // Si no hay datos válidos, limpiar localStorage
          localStorage.removeItem('auth.loggedIn')
          localStorage.removeItem('auth.user')
          localStorage.removeItem('authToken')
          localStorage.removeItem('auth.serverStartTime')
          setUser(null)
        }
      } catch (error) {
        console.error('Error cargando usuario:', error)
        // Limpiar datos corruptos
        localStorage.removeItem('auth.loggedIn')
        localStorage.removeItem('auth.user')
        localStorage.removeItem('authToken')
        localStorage.removeItem('auth.serverStartTime')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  /**
   * Inicia sesión con datos de usuario
   * @param {Object} userData - Datos del usuario (sin password)
   * @param {number} serverStartTime - Timestamp de inicio del servidor
   */
  const login = (userData, serverStartTime) => {
    try {
      localStorage.setItem('auth.loggedIn', 'true')
      localStorage.setItem('auth.user', JSON.stringify(userData))
      
      // Guardar timestamp del servidor para validación futura
      if (serverStartTime) {
        localStorage.setItem('auth.serverStartTime', serverStartTime.toString())
      }
      
      setUser(userData)
    } catch (error) {
      console.error('Error guardando usuario:', error)
      throw new Error('Error al iniciar sesión')
    }
  }

  /**
   * Cierra sesión y limpia datos
   * @param {boolean} callApi - Si debe llamar al endpoint de logout (default: true)
   */
  const logout = async (callApi = true) => {
    try {
      // Llamar al backend para invalidar el token
      if (callApi) {
        const token = localStorage.getItem('authToken')
        if (token) {
          try {
            await fetch(getApiUrl('/api/auth/logout'), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })
          } catch (error) {
            console.error('Error llamando logout API:', error)
            // Continuar con logout local aunque falle el API
          }
        }
      }

      // Limpiar localStorage
      localStorage.removeItem('auth.loggedIn')
      localStorage.removeItem('auth.user')
      localStorage.removeItem('authToken')
      localStorage.removeItem('auth.serverStartTime')
      setUser(null)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
  }

  /**
   * Verifica si el usuario tiene un rol específico
   * @param {string} role - Rol a verificar
   * @returns {boolean} - true si el usuario tiene el rol
   */
  const hasRole = (role) => {
    return user && user.role === role
  }

  /**
   * Verifica si el usuario es administrador
   * @returns {boolean} - true si es admin
   */
  const isUserAdmin = () => {
    return hasRole('admin')
  }

  /**
   * Verifica si el usuario es operador
   * @returns {boolean} - true si es operador
   */
  const isUserOperador = () => {
    return hasRole('operador')
  }

  /**
   * Verifica si el usuario es cliente
   * @returns {boolean} - true si es cliente
   */
  const isUserCliente = () => {
    return hasRole('cliente')
  }

  /**
   * Verifica si el usuario está autenticado
   * @returns {boolean} - true si está autenticado
   */
  const isAuthenticated = !!user

  /**
   * Obtiene el nombre del usuario para mostrar
   * @returns {string} - Nombre del usuario o 'Usuario'
   */
  const getUserDisplayName = () => {
    return user?.name || 'Usuario'
  }

  /**
   * Obtiene el rol del usuario para mostrar
   * @returns {string} - Rol del usuario o 'usuario'
   */
  const getUserRole = () => {
    return user?.role || 'usuario'
  }

  return {
    user,
    isLoading,
    login,
    logout,
    hasRole,
    isAdmin: isUserAdmin,
    isOperador: isUserOperador,
    isCliente: isUserCliente,
    isAuthenticated,
    getUserDisplayName,
    getUserRole
  }
}


