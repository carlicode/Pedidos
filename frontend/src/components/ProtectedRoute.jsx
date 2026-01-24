import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute({ children, requiredRole = null, customCheck = null }) {
  const location = useLocation()
  const { isAuthenticated, user, isLoading } = useAuth()

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="loading">
        <p>Verificando acceso...</p>
      </div>
    )
  }

  // Si no está autenticado o no hay usuario, limpiar localStorage y redirigir
  if (!isAuthenticated || !user) {
    // Limpiar cualquier sesión corrupta
    localStorage.removeItem('auth.loggedIn')
    localStorage.removeItem('auth.user')
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Si se requiere un rol específico, verificar
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />
  }

  // Si hay una verificación personalizada, ejecutarla
  if (customCheck && !customCheck(user)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
