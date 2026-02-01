import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth.js'
import { getApiUrl } from '../utils/api.js'
import '../styles/Notes.css'

/**
 * Página de Notas del Equipo
 * Permite a los operadores crear notas y marcarlas como resueltas
 */
export default function Notes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'all', 'pending', 'resolved' - Por defecto 'pending'
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState({ show: false, note: null })
  const [showResolveModal, setShowResolveModal] = useState({ show: false, noteId: null })
  const [newNote, setNewNote] = useState({
    descripcion: ''
  })
  const [editNote, setEditNote] = useState({
    descripcion: ''
  })
  const [descripcionResolucion, setDescripcionResolucion] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Obtener usuario actual del hook de autenticación
  const currentUser = user?.username || user?.name || 'Usuario'

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiUrl('/api/notes'))
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
        console.error('❌ Error del servidor:', response.status, errorData)
        throw new Error(errorData.error || `Error ${response.status}: Error al cargar notas`)
      }
      
      const data = await response.json()
      console.log('📝 Notas recibidas del backend:', data.notes)
      console.log('📝 Primera nota (ejemplo):', data.notes?.[0])
      setNotes(data.notes || [])
    } catch (error) {
      console.error('❌ Error cargando notas:', error)
      toast.error(`❌ Error al cargar las notas: ${error.message}`)
      // En caso de error, al menos mostrar array vacío
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNote = async () => {
    // Prevenir múltiples llamadas simultáneas
    if (isCreating) {
      return
    }

    if (!newNote.descripcion.trim()) {
      toast.warning('⚠️ Por favor escribe una descripción')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(getApiUrl('/api/notes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operador: currentUser, // Usuario actual del localStorage
          descripcion: newNote.descripcion,
          estado: 'Pendiente'
        })
      })

      if (response.ok) {
        toast.success('✅ Nota creada exitosamente')
        setNewNote({ descripcion: '' })
        setShowModal(false)
        loadNotes()
      } else {
        throw new Error('Error al crear nota')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('❌ Error al crear la nota')
    } finally {
      setIsCreating(false)
    }
  }

  const handleResolveNote = async () => {
    if (!showResolveModal.noteId) return

    try {
      const response = await fetch(`/api/notes/${showResolveModal.noteId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resuelto_por: currentUser, // Usuario actual del localStorage
          estado: 'Resuelto',
          descripcion_resolucion: descripcionResolucion.trim()
        })
      })

      if (response.ok) {
        toast.success('✅ Nota marcada como resuelta')
        setShowResolveModal({ show: false, noteId: null })
        setDescripcionResolucion('')
        loadNotes()
      } else {
        throw new Error('Error al resolver nota')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('❌ Error al resolver la nota')
    }
  }

  const handleUnresolveNote = async (noteId) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/unresolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'Pendiente'
        })
      })

      if (response.ok) {
        toast.success('✅ Nota marcada como pendiente')
        loadNotes()
      } else {
        throw new Error('Error al cambiar estado')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('❌ Error al cambiar estado de la nota')
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      return
    }

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('✅ Nota eliminada exitosamente')
        loadNotes()
      } else {
        throw new Error('Error al eliminar nota')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('❌ Error al eliminar la nota')
    }
  }

  const handleEditNote = (note) => {
    const descripcion = note.descripcion || note.Descripción || note['Descripción'] || ''
    setEditNote({ descripcion })
    setShowEditModal({ show: true, note })
  }

  const handleUpdateNote = async () => {
    if (isEditing) {
      return
    }

    if (!editNote.descripcion.trim()) {
      toast.warning('⚠️ Por favor escribe una descripción')
      return
    }

    if (!showEditModal.note) {
      return
    }

    const noteId = showEditModal.note.id || showEditModal.note.ID || showEditModal.note['ID']
    
    setIsEditing(true)
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: editNote.descripcion
        })
      })

      if (response.ok) {
        toast.success('✅ Nota actualizada exitosamente')
        setShowEditModal({ show: false, note: null })
        setEditNote({ descripcion: '' })
        loadNotes()
      } else {
        throw new Error('Error al actualizar nota')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('❌ Error al actualizar la nota')
    } finally {
      setIsEditing(false)
    }
  }

  // Filtrar notas (excluir eliminadas)
  const filteredNotes = notes.filter(note => {
    // Intentar múltiples formas de acceder al estado
    const estado = note.estado || note.Estado || note['Estado'] || ''
    const estadoLower = estado.toLowerCase()
    
    // Siempre excluir notas eliminadas
    if (estadoLower === 'eliminado') return false
    
    if (filter === 'pending') return estadoLower !== 'resuelto'
    if (filter === 'resolved') return estadoLower === 'resuelto'
    return true
  })
  
  console.log('🔍 Notas filtradas:', filteredNotes.length, 'de', notes.length)

  const pendingCount = notes.filter(n => n.estado !== 'Resuelto').length

  return (
    <div className="notes-page">
      {/* Header */}
      <div className="notes-header">
        <div className="notes-header-left">
          <button 
            className="btn-back"
            onClick={() => navigate(-1)}
            title="Volver"
          >
            ← Volver
          </button>
          <h1>📝 Notas del Equipo</h1>
          {pendingCount > 0 && (
            <span className="pending-badge">{pendingCount} pendientes</span>
          )}
        </div>
        
        <button 
          className="btn-create-note"
          onClick={() => setShowModal(true)}
        >
          ➕ Nueva Nota
        </button>
      </div>

      {/* Filtros */}
      <div className="notes-filters">
        <button 
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pendientes ({pendingCount})
        </button>
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas ({notes.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          Resueltas ({notes.length - pendingCount})
        </button>
      </div>

      {/* Lista de Notas */}
      <div className="notes-container">
        {loading ? (
          <div className="notes-loading">Cargando notas...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-empty">
            <span style={{ fontSize: '48px' }}>📝</span>
            <p>No hay notas {filter !== 'all' ? filter === 'pending' ? 'pendientes' : 'resueltas' : ''}</p>
          </div>
        ) : (
          <div className="notes-list">
            {filteredNotes.map((note, index) => {
              // Intentar múltiples formas de acceder a las propiedades
              const id = note.id || note.ID || note['ID'] || index
              const operador = note.operador || note.Operador || note['Operador'] || 'Usuario'
              const descripcion = note.descripcion || note.Descripción || note['Descripción'] || ''
              const estado = note.estado || note.Estado || note['Estado'] || 'Pendiente'
              const fechaCreacion = note.fecha_creacion || note['Fecha Creación'] || note['Fecha Creación'] || ''
              const resueltoPor = note.resuelto_por || note['Resuelto por'] || note['Resuelto por'] || ''
              const fechaResolucion = note.fecha_resolucion || note['Fecha Resolución'] || note['Fecha Resolución'] || ''
              const descripcionResolucion = note.descripcion_resolucion || note['Descripción resolución'] || note['Descripción resolución'] || ''
              
              return (
                <div 
                  key={id} 
                  className={`note-card ${estado === 'Resuelto' ? 'resolved' : ''}`}
                >
                  <div className="note-header">
                    <div className="note-meta">
                      <span className="note-author">👤 {operador}</span>
                      {fechaCreacion && (
                        <span className="note-date">📅 {fechaCreacion}</span>
                      )}
                    </div>
                    <span className={`note-status ${estado === 'Resuelto' ? 'resolved' : 'pending'}`}>
                      {estado === 'Resuelto' ? '✅' : '⏳'} {estado}
                    </span>
                  </div>
                  
                  <div className="note-body">
                    <p>{descripcion}</p>
                  </div>
                  
                  {estado === 'Resuelto' && resueltoPor && (
                    <div className="note-resolved-by">
                      <div style={{ marginBottom: '8px' }}>
                        Resuelto por: <strong>{resueltoPor}</strong>
                        {fechaResolucion && ` el ${fechaResolucion}`}
                      </div>
                      {descripcionResolucion && (
                        <div className="note-resolved-detail">
                          <strong>Nota de resolución:</strong> {descripcionResolucion}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="note-actions">
                    {estado !== 'Resuelto' ? (
                      <>
                        <button 
                          className="btn-edit"
                          onClick={() => handleEditNote(note)}
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          className="btn-resolve"
                          onClick={() => setShowResolveModal({ show: true, noteId: id })}
                        >
                          ✅ Marcar como Resuelta
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteNote(id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="btn-unresolve"
                          onClick={() => handleUnresolveNote(id)}
                        >
                          ↩️ Marcar como Pendiente
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteNote(id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal para crear nota */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✍️ Nueva Nota</h2>
              <button 
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              
              <div className="form-group">
                <label>Descripción de la Nota: *</label>
                <textarea
                  value={newNote.descripcion}
                  onChange={(e) => setNewNote({ ...newNote, descripcion: e.target.value })}
                  placeholder="Escribe aquí tu nota para el equipo..."
                  rows={6}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleCreateNote()
                }}
                disabled={isCreating}
              >
                {isCreating ? '⏳ Creando...' : '💾 Crear Nota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para resolver nota */}
      {showResolveModal.show && (
        <div className="modal-overlay" onClick={() => {
          setShowResolveModal({ show: false, noteId: null })
          setDescripcionResolucion('')
        }}>
          <div className="modal-content note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✅ Marcar Nota como Resuelta</h2>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowResolveModal({ show: false, noteId: null })
                  setDescripcionResolucion('')
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Resuelto por:</label>
                <input 
                  type="text" 
                  value={currentUser} 
                  disabled
                  className="form-input-disabled"
                />
              </div>
              
              <div className="form-group">
                <label>Descripción de Resolución (Opcional):</label>
                <textarea
                  value={descripcionResolucion}
                  onChange={(e) => setDescripcionResolucion(e.target.value)}
                  placeholder="Escribe una nota sobre cómo se resolvió esta nota..."
                  rows={4}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowResolveModal({ show: false, noteId: null })
                  setDescripcionResolucion('')
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleResolveNote}
              >
                ✅ Marcar como Resuelta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar nota */}
      {showEditModal.show && showEditModal.note && (
        <div className="modal-overlay" onClick={() => {
          setShowEditModal({ show: false, note: null })
          setEditNote({ descripcion: '' })
        }}>
          <div className="modal-content note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Editar Nota</h2>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowEditModal({ show: false, note: null })
                  setEditNote({ descripcion: '' })
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Descripción de la Nota: *</label>
                <textarea
                  value={editNote.descripcion}
                  onChange={(e) => setEditNote({ ...editNote, descripcion: e.target.value })}
                  placeholder="Escribe aquí tu nota para el equipo..."
                  rows={6}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowEditModal({ show: false, note: null })
                  setEditNote({ descripcion: '' })
                }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleUpdateNote()
                }}
                disabled={isEditing}
              >
                {isEditing ? '⏳ Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
