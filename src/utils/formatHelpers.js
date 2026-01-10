/**
 * Funciones de formateo para datos
 * Utilidades para formatear fechas y otros datos para mostrar
 * 
 * NOTA: La lógica de fechas ahora está centralizada en dateService.js
 * Este archivo solo re-exporta para mantener compatibilidad
 */

import { formatDateForDisplay as formatDateFromService } from '../services/dateService.js'

/**
 * Formatea una fecha para mostrar en formato DD/MM/YYYY
 * @param {string} dateString - Fecha en cualquier formato
 * @returns {string} Fecha formateada o 'N/A' si no es válida
 * 
 * @deprecated Usa directamente formatDateForDisplay de dateService.js
 */
export const formatDateForDisplay = formatDateFromService

