/**
 * Middleware de logging para interceptar todas las peticiones HTTP
 */

import { logAPI } from '../utils/logger.js'

/**
 * Middleware para registrar todas las peticiones HTTP
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now()
  
  // Obtener información del usuario (si está disponible)
  const user = req.user?.username || req.body?.username || 'anónimo'
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  
  // Log de inicio de petición
  logAPI.request(req.method, req.path, user, ip)
  
  // Interceptar el response para loggear cuando termine
  const originalSend = res.send
  res.send = function (data) {
    const duration = Date.now() - startTime
    logAPI.response(req.method, req.path, res.statusCode, duration, user)
    originalSend.call(this, data)
  }
  
  next()
}

/**
 * Middleware para registrar errores
 */
export const errorLogger = (err, req, res, next) => {
  const user = req.user?.username || req.body?.username || 'anónimo'
  
  logAPI.error(req.method, req.path, err, user)
  
  // Continuar con el error para que lo maneje el error handler principal
  next(err)
}
