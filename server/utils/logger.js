/**
 * Sistema de logging centralizado
 * Guarda logs en archivos .txt y en consola
 */

import winston from 'winston'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '..', 'logs')

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`
    
    // Agregar metadata si existe
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`
    }
    
    // Agregar stack trace para errores
    if (stack) {
      log += `\n${stack}`
    }
    
    return log
  })
)

// Crear el logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
  format: logFormat,
  transports: [
    // Log de errores (solo errores)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Log combinado (todo)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    
    // Log de acceso API
    new winston.transports.File({
      filename: path.join(logsDir, 'api-access.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
})

// En desarrollo, también mostrar en consola con colores
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  )
}

// Funciones helper para logging estructurado
export const logAPI = {
  request: (method, path, user = 'anónimo', ip = 'unknown') => {
    logger.http(`${method} ${path}`, { user, ip })
  },
  
  response: (method, path, status, duration, user = 'anónimo') => {
    logger.http(`${method} ${path} - ${status} (${duration}ms)`, { user })
  },
  
  error: (method, path, error, user = 'anónimo') => {
    logger.error(`${method} ${path} - ${error.message}`, { 
      user, 
      stack: error.stack 
    })
  },
}

export const logAuth = {
  login: (username, ip, success) => {
    const level = success ? 'info' : 'warn'
    logger.log(level, `Login ${success ? 'exitoso' : 'fallido'}: ${username}`, { ip })
  },
  
  logout: (username) => {
    logger.info(`Logout: ${username}`)
  },
}

export const logDB = {
  read: (sheet, range, rowCount) => {
    logger.info(`Sheet Read: ${sheet} [${range}] - ${rowCount} filas`)
  },
  
  write: (sheet, range, operation) => {
    logger.info(`Sheet Write: ${sheet} [${range}] - ${operation}`)
  },
  
  error: (sheet, operation, error) => {
    logger.error(`Sheet Error: ${sheet} - ${operation}: ${error.message}`, {
      stack: error.stack,
    })
  },
}

export const logSystem = {
  startup: (port) => {
    logger.info(`🚀 Servidor iniciado en puerto ${port}`)
  },
  
  shutdown: () => {
    logger.info(`🛑 Servidor detenido`)
  },
  
  error: (context, error) => {
    logger.error(`Sistema Error [${context}]: ${error.message}`, {
      stack: error.stack,
    })
  },
}

export default logger
