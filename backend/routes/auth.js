import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUserByUsername } from '../utils/dynamodb.js';
import { getJwtSecret } from '../utils/secrets.js';
import { generateTokenId, registerToken, getServerStartTime } from '../utils/sessionManager.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Autentica usuario y retorna JWT token
 * 
 * Body:
 * {
 *   "username": "string",
 *   "password": "string"
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "token": "jwt_token",
 *   "user": {
 *     "id": number,
 *     "username": "string",
 *     "name": "string",
 *     "role": "string",
 *     "email": "string",
 *     "empresa": "string" | null,
 *     "sheetTab": "string" | null
 *   }
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "error": "string"
 * }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar inputs
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username y password son requeridos',
      });
    }

    console.log(`🔐 Intento de login para: ${username}`);

    // Buscar usuario en DynamoDB
    const user = await getUserByUsername(username);

    if (!user) {
      // Log para auditoría (no revelar si usuario existe)
      console.warn(`⚠️ Intento de login fallido: ${username} (usuario no encontrado)`);
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas',
      });
    }

    // Verificar que el usuario está activo
    if (user.active === false) {
      console.warn(`⚠️ Intento de login con usuario desactivado: ${username}`);
      return res.status(403).json({
        success: false,
        error: 'Usuario desactivado. Contacte al administrador.',
      });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.warn(`⚠️ Contraseña incorrecta para: ${username}`);
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas',
      });
    }

    // Obtener JWT_SECRET de Secrets Manager
    const secret = await getJwtSecret();

    // Generar ID único para el token
    const tokenId = generateTokenId();

    // Generar JWT token con jti (JWT ID) y iat (issued at)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        empresa: user.empresa || null,
        jti: tokenId, // JWT ID para poder invalidar tokens específicos
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Registrar token como activo
    registerToken(tokenId);

    // Log de éxito
    console.log(`✅ Login exitoso: ${username} (${user.role}) - Token ID: ${tokenId}`);

    // Retornar token y datos del usuario (sin password)
    res.json({
      success: true,
      token,
      serverStartTime: getServerStartTime(), // Enviar timestamp del servidor para sincronización
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email || '',
        empresa: user.empresa || null,
        sheetTab: user.sheetTab || null,
      },
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/auth/me
 * Obtiene información del usuario autenticado
 * Requiere token JWT válido
 */
router.get('/me', async (req, res) => {
  try {
    // Este endpoint requiere el middleware verifyToken
    // Se aplicará cuando se integre en index.js
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado',
      });
    }

    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalida el token actual (cierra sesión)
 * Requiere token JWT válido
 */
router.post('/logout', async (req, res) => {
  try {
    // Extraer token del header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        // Decodificar para obtener el jti sin verificar (ya se verificó en middleware)
        const decoded = jwt.decode(token);
        
        if (decoded && decoded.jti) {
          // Invalidar el token
          const { invalidateToken } = await import('../utils/sessionManager.js');
          invalidateToken(decoded.jti);
          console.log(`🔓 Logout exitoso: ${decoded.username} (Token ID: ${decoded.jti})`);
        }
      }
    }

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en logout:', error);
    // Aún así retornar success, el token se invalidará naturalmente
    res.json({
      success: true,
      message: 'Sesión cerrada',
    });
  }
});

/**
 * GET /api/auth/server-info
 * Obtiene información del servidor (timestamp de inicio)
 * Público (no requiere autenticación)
 */
router.get('/server-info', (req, res) => {
  res.json({
    success: true,
    serverStartTime: getServerStartTime(),
    serverUptime: Date.now() - getServerStartTime(),
  });
});

export default router;

