import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Hook personalizado para manejar la autenticación
 * Proporciona estado de usuario, funciones de login/logout y validaciones
 */
export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Cargar usuario desde localStorage al inicializar
  useEffect(() => {
    const loadUser = () => {
      try {
        const loggedIn = localStorage.getItem('auth.loggedIn')
        const userData = localStorage.getItem('auth.user')
        
        if (loggedIn === 'true' && userData) {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
        } else {
          // Si no hay datos válidos, limpiar localStorage
          localStorage.removeItem('auth.loggedIn')
          localStorage.removeItem('auth.user')
          setUser(null)
        }
      } catch (error) {
        console.error('Error cargando usuario:', error)
        // Limpiar datos corruptos
        localStorage.removeItem('auth.loggedIn')
        localStorage.removeItem('auth.user')
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
   */
  const login = (userData) => {
    try {
      localStorage.setItem('auth.loggedIn', 'true')
      localStorage.setItem('auth.user', JSON.stringify(userData))
      setUser(userData)
    } catch (error) {
      console.error('Error guardando usuario:', error)
      throw new Error('Error al iniciar sesión')
    }
  }

  /**
   * Cierra sesión y limpia datos
   */
  const logout = () => {
    try {
      localStorage.removeItem('auth.loggedIn')
      localStorage.removeItem('auth.user')
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


