import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/secrets.js';

/**
 * Middleware para verificar JWT token
 * Extrae el token del header Authorization y verifica su validez
 * Si es válido, agrega los datos del usuario a req.user
 */
export async function verifyToken(req, res, next) {
  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No se proporcionó token de autenticación',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no válido',
      });
    }

    // Obtener JWT_SECRET de Secrets Manager
    const secret = await getJwtSecret();

    // Verificar token
    const decoded = jwt.verify(token, secret);

    // Agregar datos del usuario al request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      empresa: decoded.empresa || null,
    };

    next();
  } catch (error) {
    console.error('❌ Error verificando token:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Error de autenticación',
    });
  }
}

/**
 * Middleware factory para verificar roles específicos
 * @param {...string} allowedRoles - Roles permitidos
 * @returns {Function} Middleware function
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para acceder a este recurso',
      });
    }

    next();
  };
}

/**
 * Middleware para verificar que el usuario es cliente
 */
export const requireCliente = requireRole('cliente');

/**
 * Middleware para verificar que el usuario es administrador
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware para verificar que el usuario es operador
 */
export const requireOperador = requireRole('operador');

/**
 * Middleware para verificar que el usuario es admin o operador
 */
export const requireAdminOrOperador = requireRole('admin', 'operador');

