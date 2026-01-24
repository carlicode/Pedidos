import { getApiUrl } from '../utils/api.js'

export const useOrderLogging = () => {
  const logToCSV = async (action, data, status = 'success', error = null) => {
    try {
      const timestamp = new Date().toISOString()
      const logEntry = {
        timestamp,
        action,
        status,
        data: JSON.stringify(data),
        error: error ? error.toString() : '',
        userAgent: navigator.userAgent,
        url: window.location.href
      }
      
      // Obtener logs existentes del localStorage
      const existingLogs = localStorage.getItem('form_logs') || ''
      const logsArray = existingLogs ? existingLogs.split('\n').filter(line => line.trim()) : []
      
      // Crear línea CSV
      const csvLine = `${logEntry.timestamp},${logEntry.action},${logEntry.status},"${logEntry.data}","${logEntry.error}",${logEntry.userAgent},${logEntry.url}`
      
      // Agregar nueva entrada
      logsArray.push(csvLine)
      
      // Guardar en localStorage (limitado a 1000 líneas)
      if (logsArray.length > 1000) {
        logsArray.shift()
      }
      
      localStorage.setItem('form_logs', logsArray.join('\n'))
    } catch (err) {
      console.error('❌ Error al guardar log en localStorage:', err)
    }
  }

  const saveLogsToServer = async (logs) => {
    try {
      const url = getApiUrl('/save-logs')
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('❌ Error al guardar logs al servidor:', error)
      throw error
    }
  }

  const clearLogs = () => {
    try {
      localStorage.removeItem('form_logs')
      return true
    } catch (error) {
      console.error('❌ Error al limpiar logs:', error)
      return false
    }
  }

  const getLogs = () => {
    try {
      const logs = localStorage.getItem('form_logs') || ''
      return logs.split('\n').filter(line => line.trim())
    } catch (error) {
      console.error('❌ Error al obtener logs:', error)
      return []
    }
  }

  return {
    logToCSV,
    saveLogsToServer,
    clearLogs,
    getLogs
  }
}

