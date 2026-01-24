/**
 * Session Manager - Gestiona tokens y sesiones del servidor
 * Invalida tokens antiguos cuando el servidor se reinicia
 */

// Timestamp de cuando el servidor inició
const SERVER_START_TIME = Date.now();

// Set para almacenar tokens activos (en memoria)
// En producción con múltiples instancias, usar Redis
const activeTokens = new Set();

// Set para almacenar tokens invalidados manualmente
const blacklistedTokens = new Set();

/**
 * Obtiene el timestamp de inicio del servidor
 * @returns {number} - Timestamp en milisegundos
 */
export function getServerStartTime() {
  return SERVER_START_TIME;
}

/**
 * Verifica si un token es válido (no blacklisted y creado después del inicio del servidor)
 * @param {string} tokenId - ID único del token (jti)
 * @param {number} tokenIssuedAt - Timestamp cuando se emitió el token (iat)
 * @returns {boolean} - true si el token es válido
 */
export function isTokenValid(tokenId, tokenIssuedAt) {
  // Si el token está en blacklist, es inválido
  if (blacklistedTokens.has(tokenId)) {
    return false;
  }

  // Si el token fue creado antes del reinicio del servidor, es inválido
  // Convertir tokenIssuedAt de segundos a milisegundos (JWT usa segundos)
  const tokenIssuedAtMs = tokenIssuedAt * 1000;
  
  if (tokenIssuedAtMs < SERVER_START_TIME) {
    return false;
  }

  return true;
}

/**
 * Registra un token como activo
 * @param {string} tokenId - ID único del token
 */
export function registerToken(tokenId) {
  activeTokens.add(tokenId);
}

/**
 * Invalida un token manualmente (para logout)
 * @param {string} tokenId - ID único del token
 */
export function invalidateToken(tokenId) {
  activeTokens.delete(tokenId);
  blacklistedTokens.add(tokenId);
}

/**
 * Limpia tokens expirados de la blacklist (ejecutar periódicamente)
 * @param {number} maxAgeMs - Edad máxima en milisegundos (default: 7 días)
 */
export function cleanupExpiredTokens(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  const cutoffTime = now - maxAgeMs;

  // En un sistema real, almacenarías el timestamp con cada token
  // Por simplicidad, limpiamos toda la blacklist después del tiempo máximo
  if (now - SERVER_START_TIME > maxAgeMs) {
    blacklistedTokens.clear();
  }
}

/**
 * Obtiene estadísticas de sesiones
 * @returns {Object} - Estadísticas
 */
export function getSessionStats() {
  return {
    serverStartTime: SERVER_START_TIME,
    serverUptime: Date.now() - SERVER_START_TIME,
    activeTokens: activeTokens.size,
    blacklistedTokens: blacklistedTokens.size,
  };
}

/**
 * Genera un ID único para un token (jti)
 * @returns {string} - ID único
 */
export function generateTokenId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Limpiar tokens expirados cada hora
setInterval(() => {
  cleanupExpiredTokens();
}, 60 * 60 * 1000);

console.log(`🔐 Session Manager inicializado. Server start time: ${new Date(SERVER_START_TIME).toISOString()}`);
