/**
 * Helpers para manipulación de datos
 * Funciones auxiliares para trabajar con datos de empresas, clientes y fechas
 */

import { DIAS_SEMANA } from '../constants/orderConstants.js'

/**
 * Obtiene el mapa (URL de Google Maps) de una empresa
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @param {Array} empresas - Array de empresas con estructura {empresa, mapa, descripcion}
 * @returns {string} URL del mapa o string vacío si no se encuentra
 */
export const getEmpresaMapa = (nombreEmpresa, empresas = []) => {
  const empresa = empresas.find(e => e.empresa === nombreEmpresa)
  return empresa ? empresa.mapa : ''
}

/**
 * Obtiene la descripción de una empresa
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @param {Array} empresas - Array de empresas con estructura {empresa, mapa, descripcion}
 * @returns {string} Descripción de la empresa o string vacío si no se encuentra
 */
export const getEmpresaDescripcion = (nombreEmpresa, empresas = []) => {
  const empresa = empresas.find(e => e.empresa === nombreEmpresa)
  return empresa ? (empresa.descripcion || '') : ''
}

/**
 * Obtiene la información de un cliente
 * @param {string} nombreCliente - Nombre del cliente
 * @param {Array} empresas - Array de empresas con estructura {empresa, descripcion}
 * @returns {string} Información del cliente o mensaje por defecto
 */
export const getClienteInfo = (nombreCliente, empresas = []) => {
  if (!nombreCliente) return 'Otros - Sin teléfono'
  
  const empresaInfo = empresas.find(emp => emp.empresa === nombreCliente)
  if (empresaInfo && empresaInfo.descripcion) {
    return empresaInfo.descripcion
  }
  
  // Fallback si no se encuentra la empresa
  return `${nombreCliente} - Sin teléfono`
}

/**
 * Calcula el día de la semana a partir de una fecha
 * @param {string} dateString - Fecha en formato YYYY-MM-DD o DD/MM/YYYY
 * @returns {string} Nombre del día de la semana o string vacío si hay error
 */
export const calculateDayOfWeek = (dateString) => {
  if (!dateString) return ''
  
  try {
    let date
    
    // Crear fecha sin problemas de zona horaria
    // Si viene en formato YYYY-MM-DD, parsear manualmente
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else {
      date = new Date(dateString)
    }
    
    // Verificar que la fecha es válida
    if (isNaN(date.getTime())) {
      return ''
    }
    
    // Obtener día de la semana usando el array de días
    // getDay() devuelve 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    // Pero DIAS_SEMANA empieza con Lunes (índice 0), así que necesitamos ajustar
    const dayIndex = date.getDay()
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return diasSemana[dayIndex] || ''
  } catch (error) {
    return ''
  }
}

