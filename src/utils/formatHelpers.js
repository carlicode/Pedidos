/**
 * Funciones de formateo para datos
 * Utilidades para formatear fechas y otros datos para mostrar
 */

/**
 * Formatea una fecha para mostrar en formato DD/MM/YYYY
 * @param {string} dateString - Fecha en cualquier formato
 * @returns {string} Fecha formateada o 'N/A' si no es válida
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A'
  
  try {
    // Convertir a string si no lo es
    let fechaStr = String(dateString).trim()
    
    // Si está vacío, retornar N/A
    if (!fechaStr) return 'N/A'
    
    // Si ya está en formato DD/MM/YYYY, devolverla tal como está
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
      return fechaStr
    }
    
    // Si viene en formato YYYY-MM-DD (con o sin hora), convertir a DD/MM/YYYY
    const matchYYYYMMDD = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (matchYYYYMMDD) {
      const [, year, month, day] = matchYYYYMMDD
      return `${day}/${month}/${year}`
    }
    
    // Si es un número (serial date de Excel), convertir a fecha
    if (!isNaN(fechaStr) && !isNaN(parseFloat(fechaStr)) && isFinite(fechaStr)) {
      // Excel serial date: 1 = 1900-01-01
      const excelEpoch = new Date(1899, 11, 30) // 30 de diciembre de 1899
      const jsDate = new Date(excelEpoch.getTime() + (parseFloat(fechaStr) - 1) * 86400000)
      
      if (!isNaN(jsDate.getTime())) {
        const day = String(jsDate.getDate()).padStart(2, '0')
        const month = String(jsDate.getMonth() + 1).padStart(2, '0')
        const year = jsDate.getFullYear()
        return `${day}/${month}/${year}`
      }
    }
    
    // Intentar parsear como Date (último recurso)
    try {
      // Limpiar caracteres especiales
      fechaStr = fechaStr.replace(/[^\d\/\-]/g, ' ').trim()
      
      // Intentar diferentes formatos
      let date = null
      
      // Formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
        date = new Date(fechaStr)
      }
      // Formato DD/MM/YYYY
      else if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaStr)) {
        const parts = fechaStr.split('/')
        if (parts.length === 3) {
          // Asumir DD/MM/YYYY
          date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
        }
      }
      // Formato genérico
      else {
        date = new Date(fechaStr)
      }
      
      if (date && !isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      }
    } catch (e) {
      // Si falla el parseo, continuar
    }
    
    // Si no se pudo formatear, retornar el valor original
    return fechaStr
  } catch (error) {
    return dateString // Si hay error, devolver el valor original
  }
}

