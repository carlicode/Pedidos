/**
 * Servicio para operaciones CRUD de notas del equipo
 * Maneja la interacción con el backend para la pestaña "Notas" del Google Sheet
 */

import { getBackendUrl } from '../utils/api.js'

/**
 * Carga todas las notas desde el backend
 * @returns {Promise<Array>} Array de notas
 */
export const loadNotes = async () => {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/notes`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Error al cargar notas: ${response.status}`)
  }

  const data = await response.json()
  return data.notes || []
}

/**
 * Obtiene el contador de notas pendientes
 * @returns {Promise<number>} Cantidad de notas pendientes
 */
export const getPendingCount = async () => {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/notes/pending-count`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error(`Error al cargar contador: ${response.status}`)
  }

  const data = await response.json()
  return data.count || 0
}

/**
 * Crea una nueva nota
 * @param {Object} note - Datos de la nota {operador, descripcion, estado}
 * @returns {Promise<Object>} Resultado de la operación
 */
export const createNote = async (note) => {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(note)
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Error al crear nota')
  }

  return await response.json()
}

/**
 * Marca una nota como resuelta
 * @param {string|number} noteId - ID de la nota
 * @param {string} resolvedBy - Nombre del usuario que resuelve
 * @returns {Promise<Object>} Resultado de la operación
 */
export const resolveNote = async (noteId, resolvedBy) => {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/notes/${noteId}/resolve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      resuelto_por: resolvedBy,
      estado: 'Resuelto'
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Error al resolver nota')
  }

  return await response.json()
}

/**
 * Marca una nota como pendiente (deshacer resolución)
 * @param {string|number} noteId - ID de la nota
 * @returns {Promise<Object>} Resultado de la operación
 */
export const unresolveNote = async (noteId) => {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/notes/${noteId}/unresolve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      estado: 'Pendiente'
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Error al cambiar estado')
  }

  return await response.json()
}

/**
 * Elimina una nota (opcional - por ahora no implementado)
 * @param {string|number} noteId - ID de la nota
 * @returns {Promise<Object>} Resultado de la operación
 */
export const deleteNote = async (noteId) => {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/notes/${noteId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Error al eliminar nota')
  }

  return await response.json()
}
