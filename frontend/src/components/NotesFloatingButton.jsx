import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/NotesFloatingButton.css'

/**
 * Burbuja flotante para acceder a las notas del equipo
 * Muestra contador de notas pendientes
 */
export default function NotesFloatingButton() {
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar contador de notas pendientes
  useEffect(() => {
    loadPendingCount()
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadPendingCount()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadPendingCount = async () => {
    try {
      const response = await fetch('/api/notes/pending-count')
      if (response.ok) {
        const data = await response.json()
        setPendingCount(data.count || 0)
      } else {
        // Si el endpoint no existe aún, mostrar 0 y continuar
        console.warn('Endpoint de notas aún no disponible:', response.status)
        setPendingCount(0)
      }
    } catch (error) {
      // Si hay error (endpoint no existe), continuar normalmente
      console.warn('Error al cargar contador de notas (endpoint no disponible aún):', error.message)
      setPendingCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = () => {
    navigate('/notas')
  }

  return (
    <div className="notes-floating-button" onClick={handleClick} title="Notas del Equipo">
      <div className="notes-icon">📝</div>
      {!isLoading && pendingCount > 0 && (
        <div className="notes-badge">{pendingCount}</div>
      )}
    </div>
  )
}
