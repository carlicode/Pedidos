/**
 * Servicio genérico para Google Sheets
 * Funciones reutilizables para cargar datos desde CSV
 */

import Papa from 'papaparse'

/**
 * Carga datos desde una URL de CSV de Google Sheets
 * @param {string} csvUrl - URL del CSV a cargar
 * @returns {Promise<Array>} Array con los datos parseados
 * @throws {Error} Si la carga falla
 */
export const loadFromCSV = async (csvUrl) => {
  if (!csvUrl) {
    throw new Error('URL de CSV no proporcionada')
  }

  const response = await fetch(csvUrl)
  if (!response.ok) {
    throw new Error(`Error al cargar CSV: ${response.statusText}`)
  }
  
  const csvText = await response.text()
  const parsedData = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  
  return parsedData.data
}

/**
 * Carga datos desde una variable de entorno de CSV
 * @param {string} envVarName - Nombre de la variable de entorno (ej: 'VITE_EMPRESAS_CSV_URL')
 * @returns {Promise<Array>} Array con los datos parseados
 * @throws {Error} Si la variable de entorno no existe o la carga falla
 */
export const loadFromEnvCSV = async (envVarName) => {
  const csvUrl = import.meta.env[envVarName]
  if (!csvUrl) {
    throw new Error(`Variable de entorno ${envVarName} no configurada`)
  }
  
  return await loadFromCSV(csvUrl)
}
