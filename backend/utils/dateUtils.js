/**
 * Utilidades para manejo de fechas y horas en zona horaria de Bolivia (UTC-4)
 * Este módulo es compartido entre frontend y backend
 */

// Constante para zona horaria de Bolivia
const BOLIVIA_OFFSET_HOURS = -4;
const BOLIVIA_OFFSET_MS = BOLIVIA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Obtiene la fecha y hora actual de Bolivia (UTC-4)
 * @returns {Date} Objeto Date ajustado a zona horaria de Bolivia
 */
export function getBoliviaTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const boliviaTime = new Date(utc + BOLIVIA_OFFSET_MS);
  return boliviaTime;
}

/**
 * Obtiene la fecha y hora actual de Bolivia como objeto
 * @returns {Date} Fecha y hora actual de Bolivia
 */
export function getBoliviaDateTime() {
  return getBoliviaTime();
}

/**
 * Obtiene la fecha actual de Bolivia en formato ISO (YYYY-MM-DD)
 * @returns {string} Fecha en formato ISO
 */
export function getBoliviaDateISO() {
  const boliviaTime = getBoliviaTime();
  const year = boliviaTime.getFullYear();
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0');
  const day = String(boliviaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la fecha actual de Bolivia en formato DD/MM/YYYY
 * @returns {string} Fecha en formato DD/MM/YYYY
 */
export function getBoliviaDateDDMMYYYY() {
  const boliviaTime = getBoliviaTime();
  const day = String(boliviaTime.getDate()).padStart(2, '0');
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0');
  const year = boliviaTime.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Obtiene la hora actual de Bolivia en formato HH:MM:SS
 * @returns {string} Hora en formato HH:MM:SS
 */
export function getBoliviaTimeString() {
  const boliviaTime = getBoliviaTime();
  const hours = String(boliviaTime.getHours()).padStart(2, '0');
  const minutes = String(boliviaTime.getMinutes()).padStart(2, '0');
  const seconds = String(boliviaTime.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Obtiene la hora actual de Bolivia en formato HH:MM
 * @returns {string} Hora en formato HH:MM
 */
export function getBoliviaTimeHHMM() {
  const boliviaTime = getBoliviaTime();
  const hours = String(boliviaTime.getHours()).padStart(2, '0');
  const minutes = String(boliviaTime.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formatea un número como moneda boliviana
 * @param {number} amount - Cantidad a formatear
 * @returns {string} Cantidad formateada como Bs. X.XX
 */
export function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return 'Bs. 0.00';
  return `Bs. ${amount.toFixed(2)}`;
}

/**
 * Convierte un string de tiempo HH:MM a minutos desde medianoche
 * @param {string} timeString - Tiempo en formato HH:MM
 * @returns {number|null} Minutos desde medianoche o null si es inválido
 */
export function toMinutes(timeString) {
  if (!timeString || typeof timeString !== 'string') return null;
  const parts = timeString.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Convierte minutos desde medianoche a formato HH:MM
 * @param {number} minutes - Minutos desde medianoche
 * @returns {string} Tiempo en formato HH:MM
 */
export function minutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) return '00:00';
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Normaliza una fecha al formato DD/MM/YYYY
 * @param {Date|string|number} dateInput - Fecha a normalizar
 * @returns {string} Fecha en formato DD/MM/YYYY
 */
export function normalizeDateToDDMMYYYY(dateInput) {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' 
    ? new Date(dateInput) 
    : dateInput;
  
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Convierte una fecha al formato ISO (YYYY-MM-DD)
 * @param {Date|string|number} dateInput - Fecha a formatear
 * @returns {string} Fecha en formato ISO
 */
export function formatDate(dateInput) {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;
    
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  
  return date.toISOString().split('T')[0];
}

/**
 * Parsea un string de fecha a objeto Date
 * @param {string} dateString - String de fecha a parsear
 * @returns {Date} Objeto Date
 */
export function parseDate(dateString) {
  if (!dateString) return new Date();
  return new Date(dateString);
}

/**
 * Formatea una fecha como DD/MM/YYYY HH:MM:SS en zona horaria de Bolivia
 * @param {Date|string|number} dateInput - Fecha a formatear
 * @returns {string} Fecha y hora formateada
 */
export function formatBoliviaDateTime(dateInput) {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;
    
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  
  // Ajustar a Bolivia
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const boliviaTime = new Date(utc + BOLIVIA_OFFSET_MS);
  
  const day = String(boliviaTime.getDate()).padStart(2, '0');
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0');
  const year = boliviaTime.getFullYear();
  const hours = String(boliviaTime.getHours()).padStart(2, '0');
  const minutes = String(boliviaTime.getMinutes()).padStart(2, '0');
  const seconds = String(boliviaTime.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Obtiene la fecha y hora actuales de Bolivia en el formato esperado por Google Sheets
 * @returns {Object} Objeto con fecha (DD/MM/YYYY) y hora (HH:MM:SS)
 */
export function getBoliviaDateTimeForSheet() {
  const boliviaTime = getBoliviaTime();
  
  const day = String(boliviaTime.getDate()).padStart(2, '0');
  const month = String(boliviaTime.getMonth() + 1).padStart(2, '0');
  const year = boliviaTime.getFullYear();
  
  const hours = String(boliviaTime.getHours()).padStart(2, '0');
  const minutes = String(boliviaTime.getMinutes()).padStart(2, '0');
  const seconds = String(boliviaTime.getSeconds()).padStart(2, '0');
  
  return {
    fecha: `${day}/${month}/${year}`,
    hora: `${hours}:${minutes}:${seconds}`
  };
}
