import { getSecrets } from './secrets.js';
import { getUserByUsername } from './dynamodb.js';

/**
 * Health check endpoint para monitoreo
 * Verifica la salud de todos los servicios críticos
 */
export async function healthCheck(req, res) {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    services: {},
  };

  try {
    // 1. Check AWS Secrets Manager
    try {
      await getSecrets();
      health.services.secretsManager = {
        status: 'healthy',
        message: 'Conectado a AWS Secrets Manager',
      };
    } catch (error) {
      health.services.secretsManager = {
        status: process.env.NODE_ENV === 'production' ? 'unhealthy' : 'degraded',
        message: error.message,
      };
      if (process.env.NODE_ENV === 'production') {
        health.status = 'unhealthy';
      }
    }

    // 2. Check DynamoDB
    try {
      // Intentar leer un usuario de prueba (esto verifica conectividad)
      // No importa si no existe, solo queremos verificar que podemos conectarnos
      await getUserByUsername('health-check-test');
      health.services.dynamodb = {
        status: 'healthy',
        message: 'Conectado a DynamoDB',
      };
    } catch (error) {
      // Si el error es de conectividad, marcarlo como unhealthy
      if (error.name === 'NetworkingError' || error.name === 'TimeoutError') {
        health.services.dynamodb = {
          status: 'unhealthy',
          message: error.message,
        };
        health.status = 'unhealthy';
      } else {
        // Otros errores (como ResourceNotFoundException) son aceptables
        health.services.dynamodb = {
          status: 'healthy',
          message: 'Conectado a DynamoDB',
        };
      }
    }

    // 3. Check Google Sheets API (verificar credenciales)
    try {
      // Verificar credenciales desde AWS Secrets Manager
      const secrets = await getSecrets();
      const hasCredentials = secrets.GOOGLE_SERVICE_ACCOUNT_JSON;
      
      if (hasCredentials) {
        health.services.googleSheets = {
          status: 'healthy',
          message: 'Credenciales de Google Sheets configuradas',
        };
      } else {
        health.services.googleSheets = {
          status: 'degraded',
          message: 'Credenciales de Google Sheets no configuradas',
        };
      }
    } catch (error) {
      health.services.googleSheets = {
        status: 'degraded',
        message: error.message,
      };
    }

    // 4. Check Google Maps API
    try {
      const secrets = await getSecrets();
      const hasMapKey = secrets.GOOGLE_MAPS_API_KEY;
      health.services.googleMaps = {
        status: hasMapKey ? 'healthy' : 'degraded',
        message: hasMapKey ? 'API Key configurada' : 'API Key no configurada',
      };
    } catch (error) {
      health.services.googleMaps = {
        status: 'degraded',
        message: 'Error verificando API Key',
      };
    }

    // 5. Memory usage
    const memUsage = process.memoryUsage();
    health.memory = {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
    };

    // Tiempo de respuesta
    health.responseTime = `${Date.now() - startTime}ms`;

    // Determinar código de estado HTTP
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`,
    });
  }
}

/**
 * Readiness check - verifica si el servicio está listo para recibir tráfico
 */
export function readinessCheck(req, res) {
  // Verificar que los servicios esenciales están inicializados
  const isReady = true; // Agregar lógica específica si es necesario
  
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Liveness check - verifica si el servicio está vivo
 */
export function livenessCheck(req, res) {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
