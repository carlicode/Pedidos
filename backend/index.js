// Import backend utilities
import { getBoliviaTime, normalizeDateToDDMMYYYY } from './utils/dateUtils.js'

// Create wrapper for backend compatibility
function getBoliviaNow() {
  return getBoliviaTime()
}

function findCell(values, text) {
  const target = String(text).trim().toLowerCase()
  for (let r = 0; r < values.length; r++) {
    const row = values[r] || []
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim().toLowerCase() === target) {
        return { row: r, col: c }
      }
    }
  }
  return null
}

function parseTimeToMinutes(timeString) {
  if (!timeString) return null
  const [h, m] = timeString.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return (h * 60) + m
}

function normalizeSlot(slot) {
  if (!slot) return ''
  const clean = slot.replace(/\s+/g, '')
  if (clean.includes('-')) {
    const [start, end] = clean.split('-')
    return `${start.replace(':', ':')}-${end.replace(':', ':')}`
  }
  return slot
}

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import fs from 'fs'

// Cargar variables de entorno desde múltiples ubicaciones
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Intentar cargar desde múltiples ubicaciones
const envPaths = [
  path.join(__dirname, '..', '.env'),  // .env en la raíz
  path.join(__dirname, '.env'),        // .env en server/
  '.env'                               // .env en el directorio actual
]

console.log('🔍 Buscando archivo .env en:')
envPaths.forEach((envPath, index) => {
  console.log(`  ${index + 1}. ${envPath}`)
})

// Cargar el primer archivo .env que exista
let envLoaded = false
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
      console.log(`✅ Archivo .env cargado desde: ${envPath}`)
      envLoaded = true
      break
    }
  } catch (error) {
    console.warn(`⚠️ Error cargando ${envPath}:`, error.message)
  }
}

if (!envLoaded) {
  console.warn('⚠️ No se encontró ningún archivo .env')
}

const PORT = process.env.PORT || 5055
const SHEET_ID = process.env.SHEET_ID || '1a8M19WHhfM2SWKSiWbTIpVU76gdAFCJ9uv7y0fnPA4g'
const SHEET_NAME = process.env.SHEET_NAME || 'Registros'

// Throttling para logs de error de conexión (evitar spam)
let lastConnectionErrorLog = 0
const CONNECTION_ERROR_LOG_INTERVAL = 60000 // 1 minuto
const HORARIOS_SHEET_ID = process.env.HORARIOS_SHEET_ID || '' // ID del Sheet "Horarios Beezy" en Drive (Drivers)
const HORARIOS_SHEET_NAME = process.env.HORARIOS_SHEET_NAME || 'Horarios Beezy'
const HORARIOS_DRIVE_FOLDER_ID = '1EcBvakGg0MsQgq5XXKxUJDGdQU7yR4Pb' // Carpeta compartida en Drive
const HORARIOS_BIKERS_SHEET_ID = process.env.HORARIOS_BIKERS_SHEET_ID || '1OznBoHzpKBVLPG2zfHrtuFC7G6B8cBETnABIwof2VyM' // ID del Sheet "Horarios - Bikers"
const INVENTARIO_SHEET_ID = process.env.INVENTARIO_SHEET_ID || '1x06KG0Xqf_yoQkFyFiIZ6JFoCGcQMfFFz49lLt2ipFY' // ID del Sheet de Inventarios
// El historial está en el mismo spreadsheet que los inventarios
const HISTORIAL_SHEET_ID = process.env.HISTORIAL_SHEET_ID || INVENTARIO_SHEET_ID || '1x06KG0Xqf_yoQkFyFiIZ6JFoCGcQMfFFz49lLt2ipFY' // ID del Sheet de Historial (mismo que inventarios)
const HISTORIAL_SHEET_NAME = process.env.HISTORIAL_SHEET_NAME || 'Historial de productos' // Nombre de la pestaña de historial
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
const SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || ''

// API Key de Google Maps y credenciales - se cargarán desde AWS Secrets Manager
let GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || null
let SERVICE_ACCOUNT_CREDENTIALS = null

// Debug: Mostrar todas las variables de entorno cargadas
console.log('🔍 Variables de entorno cargadas:')
console.log(`  - SHEET_ID: "${process.env.SHEET_ID}"`)
console.log(`  - SHEET_NAME: "${process.env.SHEET_NAME}"`)
console.log(`  - SERVICE_ACCOUNT_FILE: "${process.env.GOOGLE_SERVICE_ACCOUNT_FILE}"`)
console.log(`  - GOOGLE_MAPS_API_KEY: "${process.env.GOOGLE_MAPS_API_KEY ? 'Configurada' : 'No configurada'}"`)

if (!SHEET_ID) {
  console.warn('WARN: SHEET_ID no definido en .env')
}

console.log('🔧 Configuración cargada:')
console.log(`  - Puerto: ${PORT}`)
console.log(`  - Google Maps API Key: ${GOOGLE_MAPS_API_KEY ? '✅ Configurada' : '❌ No configurada'}`)
console.log(`  - Sheet ID: ${SHEET_ID ? '✅ Configurado' : '❌ No configurado'}`)
console.log(`  - Sheet Name: ${SHEET_NAME}`)
console.log(`  - Service Account File: ${SERVICE_ACCOUNT_FILE ? '✅ Configurado' : '❌ No configurado'}`)

const app = express()

// Trust proxy: Solo en producción (detrás de Load Balancer/CloudFront)
// En desarrollo local (localhost) NO debe estar activo por seguridad
const isProduction = process.env.NODE_ENV === 'production' || process.env.AWS_EXECUTION_ENV
if (isProduction) {
  app.set('trust proxy', true)
  console.log('🔒 Trust proxy activado (ambiente de producción)')
} else {
  console.log('🏠 Trust proxy desactivado (ambiente de desarrollo)')
}

// CORS configuration con whitelist de orígenes
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://master.d3i6av0lx664fk.amplifyapp.com', // Amplify URL actual
      'https://master.d3bpt5tsbpx0os.amplifyapp.com', // Amplify URL anterior
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173'
    ].filter(Boolean) // Eliminar valores undefined
    
    // En desarrollo, permitir cualquier localhost o IP local
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1')
      const isLocalNetwork = /^http:\/\/192\.168\.\d+\.\d+/.test(origin) || /^http:\/\/10\.\d+\.\d+\.\d+/.test(origin)
      
      if (isLocalhost || isLocalNetwork) {
        return callback(null, true)
      }
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.warn(`⚠️ CORS: Origen bloqueado: ${origin}`)
      callback(new Error('No permitido por CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 horas
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' })) // Aumentar límite para pedidos grandes

// Security headers con Helmet
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}))

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(path.join(__dirname, '..')))

// Importar rutas DESPUÉS de cargar .env
import authRoutes from './routes/auth.js'
import notesRoutes from './routes/notes.js'
import clientInfoRoutes from './routes/clientInfo.js'

// Importar funciones para obtener secretos de AWS
import { getSecrets } from './utils/secrets.js'

// Importar sistema de logging
import logger, { logSystem } from './utils/logger.js'
import { requestLogger, errorLogger } from './middleware/logging.js'
import { logAuditEntry } from './utils/auditLogger.js'

// Importar rate limiting y security
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'

/**
 * Inicializa los secretos desde AWS Secrets Manager
 * Si falla, usa variables de entorno locales como fallback
 */
async function initializeSecrets() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  console.log(`🔐 Inicializando secretos (Entorno: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'})`)
  
  try {
    console.log('📥 Intentando cargar secretos desde AWS Secrets Manager...')
    const secrets = await getSecrets()
    
    // Actualizar las variables globales con los secretos de AWS
    if (secrets.GOOGLE_MAPS_API_KEY) {
      GOOGLE_MAPS_API_KEY = secrets.GOOGLE_MAPS_API_KEY
      console.log('  ✓ GOOGLE_MAPS_API_KEY cargada desde AWS')
    }
    
    if (secrets.GOOGLE_SERVICE_ACCOUNT_JSON) {
      SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(secrets.GOOGLE_SERVICE_ACCOUNT_JSON)
      console.log('  ✓ GOOGLE_SERVICE_ACCOUNT_JSON cargada desde AWS')
    }
    
    console.log('✅ Secretos cargados exitosamente desde AWS Secrets Manager')
    
    // Validar secretos críticos en producción
    if (isProduction) {
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('GOOGLE_MAPS_API_KEY no encontrado en Secrets Manager (requerido en producción)')
      }
      if (!SERVICE_ACCOUNT_CREDENTIALS) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no encontrado en Secrets Manager (requerido en producción)')
      }
      console.log('✅ Todos los secretos críticos están configurados para producción')
    }
    
    return true
  } catch (error) {
    console.error('❌ Error cargando secretos desde AWS:', error.message)
    
    // En producción, fallar si no se pueden cargar secretos
    if (isProduction) {
      console.error('🚨 En producción, los secretos de AWS son obligatorios. Deteniendo servidor.')
      throw error
    }
    
    // En desarrollo, intentar fallback a variables de entorno locales
    console.warn('⚠️ Usando fallback a variables de entorno locales (solo desarrollo)')
    
    // Intentar cargar desde archivo local si existe
    if (SERVICE_ACCOUNT_FILE && fs.existsSync(SERVICE_ACCOUNT_FILE)) {
      try {
        SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'))
        console.log('✅ Credenciales cargadas desde archivo local')
      } catch (fileError) {
        console.error('❌ Error leyendo archivo de credenciales:', fileError.message)
      }
    } else if (SERVICE_ACCOUNT_JSON) {
      try {
        SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(SERVICE_ACCOUNT_JSON)
        console.log('✅ Credenciales cargadas desde variable de entorno')
      } catch (jsonError) {
        console.error('❌ Error parseando SERVICE_ACCOUNT_JSON:', jsonError.message)
      }
    }
    
    // Verificar que tenemos al menos las credenciales básicas en desarrollo
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY no configurada - funcionalidad de mapas limitada')
    }
    if (!SERVICE_ACCOUNT_CREDENTIALS) {
      console.warn('⚠️ Google Service Account no configurado - funcionalidad de Sheets limitada')
    }
    
    return false
  }
}

// Middleware de logging global (antes de las rutas)
app.use(requestLogger)

// Rate limiting para autenticación
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto (más permisivo)
  message: { success: false, error: 'Demasiados intentos. Intente nuevamente en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No aplicar rate limit a server-info (usado para detectar reinicios)
    return req.path === '/server-info'
  }
})

// Rate limiting general para API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // 1000 requests por minuto por IP (más permisivo)
  message: { success: false, error: 'Demasiadas solicitudes. Intente nuevamente más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No aplicar rate limit a health checks
    return req.path.startsWith('/health')
  }
})

// Aplicar rate limiting general
app.use('/api/', apiLimiter)

// Rutas de autenticación con rate limiting más estricto
app.use('/api/auth', authLimiter, authRoutes)

// Rutas de notas del equipo
app.use('/api/notes', notesRoutes)

// Rutas de información de clientes
app.use('/api/client-info', clientInfoRoutes)

// Health check endpoints
import { healthCheck, readinessCheck, livenessCheck } from './utils/healthCheck.js'

app.get('/health', healthCheck)
app.get('/api/health', healthCheck)
app.get('/health/ready', readinessCheck)
app.get('/health/live', livenessCheck)

function getAuthClient() {
  let creds = null
  
  console.log('🔐 Intentando autenticación con Google Sheets...')
  
  // Prioridad 1: Credenciales cargadas desde AWS Secrets Manager
  if (SERVICE_ACCOUNT_CREDENTIALS) {
    console.log('  - Usando credenciales desde AWS Secrets Manager')
    creds = SERVICE_ACCOUNT_CREDENTIALS
  }
  // Prioridad 2: JSON directo desde variable de entorno
  else if (SERVICE_ACCOUNT_JSON) {
    console.log('  - Usando SERVICE_ACCOUNT_JSON')
    creds = JSON.parse(SERVICE_ACCOUNT_JSON)
  }
  // Prioridad 3: Archivo local (fallback para desarrollo)
  else if (SERVICE_ACCOUNT_FILE) {
    console.log(`  - Usando SERVICE_ACCOUNT_FILE: ${SERVICE_ACCOUNT_FILE}`)
    try {
      // Resolver la ruta del archivo de service account
      let serviceAccountPath = SERVICE_ACCOUNT_FILE
      if (SERVICE_ACCOUNT_FILE.startsWith('..')) {
        // Si la ruta es relativa, resolverla desde el directorio del servidor
        serviceAccountPath = path.join(__dirname, '..', SERVICE_ACCOUNT_FILE.replace(/^\.\.\//, ''))
      }
      
      console.log(`  - Ruta resuelta: ${serviceAccountPath}`)
      
      // Verificar si el archivo existe
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Archivo de service account no encontrado: ${serviceAccountPath}`)
      }
      const raw = fs.readFileSync(serviceAccountPath, 'utf8')
      creds = JSON.parse(raw)
      console.log('  - ✅ Archivo de service account leído correctamente')
    } catch (error) {
      console.error('  - ❌ Error leyendo archivo de service account:', error.message)
      throw error
    }
  }
  
  if (!creds) {
    console.error('  - ❌ No se encontraron credenciales de service account')
    throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE en .env')
  }
  
  console.log(`  - ✅ Autenticación configurada para: ${creds.client_email}`)
  
  const jwt = new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  )
  return jwt
}

const HEADER_ORDER = [
  'ID',
  'Fecha Registro',
  'Hora Registro',
  'Operador',
  'Cliente',
  'Recojo',
  'Entrega',
  'Direccion Recojo',
  'Direccion Entrega',
  'Detalles de la Carrera',      // Posición 10 ✅
  'Dist. [Km]',                  // Posición 11 ✅
  'Medio Transporte',            // Posición 12 ✅
  'Precio [Bs]',
  'Método pago pago',
  'Biker',
  'WhatsApp',
  'Fechas',
  'Hora Ini',
  'Hora Fin',
  'Duracion',
  'Tiempo de espera',
  'Estado',
  'Estado de pago',
  'Observaciones',
  'Pago biker',
  'Dia de la semana',
  'Cobro o pago',
  'Monto cobro o pago',
  'Descripcion de cobro o pago',
  'Info. Adicional Recojo',      // Posición 29 ✅
  'Info. Adicional Entrega'      // Posición 30 ✅
]

function quoteSheet(title) {
  return `'${String(title).replace(/'/g, "''")}'`
}

async function ensureSheetExists(sheetsApi, spreadsheetId, title) {
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId })
  const exists = (meta.data.sheets || []).some(s => s.properties?.title === title)
  if (!exists) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] }
    })
  }
}

const KEY_TO_COL = {
  id: 'ID',
  fecha_registro: 'Fecha Registro',
  hora_registro: 'Hora Registro',
  operador: 'Operador',
  cliente: 'Cliente',
  recojo: 'Recojo',
  entrega: 'Entrega',
  direccion_recojo: 'Direccion Recojo',
  direccion_entrega: 'Direccion Entrega',
  detalles_carrera: 'Detalles de la Carrera',
  distancia_km: 'Dist. [Km]',
  medio_transporte: 'Medio Transporte',
  precio_bs: 'Precio [Bs]',
  metodo_pago: 'Método pago pago',
  biker: 'Biker',
  whatsapp: 'WhatsApp',
  fecha: 'Fechas',
  hora_ini: 'Hora Ini',
  hora_fin: 'Hora Fin',
  duracion: 'Duracion',
  tiempo_espera: 'Tiempo de espera',
  estado: 'Estado',
  estado_pago: 'Estado de pago',
  observaciones: 'Observaciones',
  pago_biker: 'Pago biker',
  contacto_biker: 'Contacto biker',
  link_contacto_biker: 'Link de contacto biker',
  dia_semana: 'Dia de la semana',
  cobro_pago: 'Cobro o pago',
  monto_cobro_pago: 'Monto cobro o pago',
  descripcion_cobro_pago: 'Descripcion de cobro o pago',
  info_direccion_recojo: 'Info. Adicional Recojo',
  info_direccion_entrega: 'Info. Adicional Entrega'
}

function buildRow(order) {
  const row = HEADER_ORDER.map(() => '')
  console.log('🔍 Mapeando campos del pedido:')
  console.log('🔍 Estado recibido:', order.Estado, '| estado:', order.estado)
  
    // El frontend ya envía los datos con los nombres de las columnas del Google Sheet
    // Por lo tanto, podemos mapear directamente usando HEADER_ORDER
    // PERO también aceptar nombres en minúsculas para compatibilidad
    for (let i = 0; i < HEADER_ORDER.length; i++) {
      const columnName = HEADER_ORDER[i]
      let value = order[columnName] ?? ''
      
      // Mapear nombres de columnas a posibles variantes del frontend
      if (!value) {
        if (columnName === 'Recojo' && order.recojo) {
          value = order.recojo
        } else if (columnName === 'Entrega' && order.entrega) {
          value = order.entrega
        } else if (columnName === 'Cliente' && order.cliente) {
          value = order.cliente
        } else if (columnName === 'Operador' && order.operador) {
          value = order.operador
        }
      }
    
    // Mapear campos con nombres en minúsculas (desde frontend) a nombres de columnas (Sheet)
    if (columnName === 'Estado' && !value && order.estado) {
      value = order.estado
      console.log('✅ Usando order.estado para Estado:', value)
    }
    if (columnName === 'Estado de pago' && !value && order.estado_pago) {
      value = order.estado_pago
    }
    if (columnName === 'Hora Ini' && !value && order.hora_ini) {
      value = order.hora_ini
    }
    if (columnName === 'Hora Fin' && !value && order.hora_fin) {
      value = order.hora_fin
      console.log('✅ Usando order.hora_fin para Hora Fin:', value)
    }
    if (columnName === 'Duracion' && !value && order.duracion) {
      value = order.duracion
    }
    
    // Establecer valores por defecto para Estado y Estado de pago
    if (columnName === 'Estado' && !value) {
      value = 'Pendiente'
    }
    if (columnName === 'Estado de pago' && !value) {
      value = 'Debe Cliente'
    }
    
    // Columna Fechas (fecha programada = "Fecha del Pedido *" del form)
    // Si ya está en DD/MM/YYYY, conservar. Si no (YYYY-MM-DD, Excel serial, etc.), normalizar.
    // normalizeDateToDDMMYYYY usa new Date() y rompe DD/MM/YYYY.
    if (columnName === 'Fechas') {
      const safeStr = (v) => (v != null ? String(v).trim() : '')
      const isDDMMYYYY = (s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)
      if (!value) {
        const fechaFallback = order.fecha || order.Fecha || order['Fechas']
        const fallbackStr = safeStr(fechaFallback)
        if (fallbackStr) {
          value = isDDMMYYYY(fallbackStr) ? fallbackStr : (normalizeDateToDDMMYYYY(fallbackStr) || fallbackStr)
        }
      } else {
        const s = safeStr(value)
        value = isDDMMYYYY(s) ? s : (normalizeDateToDDMMYYYY(value) || s)
      }
    }
    
    // Normalizar Dist. [Km] - remover apóstrofe y convertir coma a punto
    if (columnName === 'Dist. [Km]' && value) {
      let distStr = String(value).trim()
      // Remover apóstrofe inicial si existe (Google Sheets usa ' para forzar texto)
      if (distStr.startsWith("'")) {
        distStr = distStr.substring(1)
      }
      // Convertir coma a punto (formato europeo a estándar)
      if (distStr.includes(',')) {
        distStr = distStr.replace(',', '.')
      }
      value = distStr
    }
    
    // Normalizar Precio [Bs] - remover apóstrofe y convertir coma a punto
    if (columnName === 'Precio [Bs]' && value) {
      let precioStr = String(value).trim()
      // Remover apóstrofe inicial si existe
      if (precioStr.startsWith("'")) {
        precioStr = precioStr.substring(1)
      }
      // Convertir coma a punto
      if (precioStr.includes(',')) {
        precioStr = precioStr.replace(',', '.')
      }
      value = precioStr
    }
    
    row[i] = value
    
    // Log especial para Hora Registro
    if (columnName === 'Hora Registro') {
      console.log(`🕐 DETALLE Hora Registro:`)
      console.log(`  - Valor recibido: "${value}"`)
      console.log(`  - Tipo: ${typeof value}`)
      console.log(`  - Incluye 'T': ${value.includes ? value.includes('T') : 'N/A'}`)
      console.log(`  - Incluye ':': ${value.includes ? value.includes(':') : 'N/A'}`)
    }
    
    // Log especial para Fecha Registro
    if (columnName === 'Fecha Registro') {
      console.log(`📅 DETALLE Fecha Registro:`)
      console.log(`  - Valor recibido: "${value}"`)
      console.log(`  - Tipo: ${typeof value}`)
      console.log(`  - Incluye '/': ${value.includes ? value.includes('/') : 'N/A'}`)
      console.log(`  - Longitud: ${value.length}`)
    }
  }
  
  return row
}

// Función de geocoding como respaldo
const geocodeLocation = async (location) => {
  try {
    console.log('🗺️ Intentando geocoding para:', location)
    
    const apiKey = GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.log('❌ API key no disponible para geocoding')
      return null
    }
    
    // Agregar ", Bolivia" si no es una URL y no contiene ya "Bolivia" o coordenadas
    let locationToGeocode = location
    const isUrl = location.includes('http://') || location.includes('https://') || location.includes('maps.') || location.includes('goo.gl')
    const hasBolivia = location.toLowerCase().includes('bolivia')
    const hasCoords = /-?\d+\.\d+,-?\d+\.\d+/.test(location)
    
    if (!isUrl && !hasBolivia && !hasCoords) {
      locationToGeocode = `${location}, Bolivia`
      console.log('🌍 Agregando ", Bolivia" al geocoding para mejorar precisión')
    }
    
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationToGeocode)}&key=${apiKey}`
    
    const response = await fetch(geocodingUrl)
    const data = await response.json()
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0]
      const coords = `${result.geometry.location.lat},${result.geometry.location.lng}`
      console.log('✅ Geocoding exitoso:', coords, `(de: ${locationToGeocode})`)
      return coords
    } else {
      console.log('❌ Geocoding falló:', data.status)
      return null
    }
  } catch (error) {
    console.error('❌ Error en geocoding:', error)
    return null
  }
}

// Calcula la ruta en auto más corta (en distancia) usando Directions API.
// Si Directions falla, cae a Distance Matrix.
const getShortestDrivingRoute = async ({ origin, destination, apiKey, context = 'distance' }) => {
  if (!origin || !destination) {
    throw new Error('Origen y destino son requeridos para calcular la distancia')
  }

  if (!apiKey) {
    throw new Error('Google Maps API key no configurada')
  }

  const encodedOrigin = encodeURIComponent(origin)
  const encodedDestination = encodeURIComponent(destination)

  // OPTIMIZACIÓN: Si las coordenadas ya están en formato lat,lng, usar Distance Matrix directamente (más rápido)
  const isCoordFormat = /^-?\d+\.\d+,-?\d+\.\d+$/.test(origin.trim()) && /^-?\d+\.\d+,-?\d+\.\d+$/.test(destination.trim())
  
  // Si NO son coordenadas directas, intentar Directions primero (solo si no son coordenadas)
  if (!isCoordFormat) {
    // 1) Intentar Directions API con alternativas para escoger la ruta más corta (en distancia).
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodedOrigin}&destination=${encodedDestination}&mode=driving&alternatives=true&departure_time=now&traffic_model=best_guess&key=${apiKey}`
    try {
      console.log(`🧭 [${context}] Consultando Directions API (alternatives=true)...`)
      const directionsResponse = await fetch(directionsUrl, { 
        signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
      })
      const directionsData = await directionsResponse.json()

      if (directionsData.status === 'OK' && Array.isArray(directionsData.routes) && directionsData.routes.length > 0) {
        let bestRoute = directionsData.routes[0]
        let shortestDistance = bestRoute?.legs?.[0]?.distance?.value ?? Infinity

        directionsData.routes.forEach(route => {
          const leg = route?.legs?.[0]
          if (leg?.distance?.value < shortestDistance) {
            bestRoute = route
            shortestDistance = leg.distance.value
          }
        })

        if (bestRoute?.legs?.[0]) {
          const leg = bestRoute.legs[0]
          console.log(`✅ [${context}] Ruta más corta encontrada (Directions): ${leg.distance.text} / ${leg.duration.text}`)
          return {
            source: 'directions',
            distanceMeters: leg.distance.value,
            distanceText: leg.distance.text,
            durationSeconds: leg.duration.value,
            durationText: leg.duration.text,
            originAddress: leg.start_address,
            destinationAddress: leg.end_address,
            rawResponse: directionsData
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        // Si es error de conexión, loguear pero continuar con Distance Matrix
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          console.log(`⚠️ [${context}] Sin conexión a internet. Intentando Distance Matrix...`)
        } else {
          console.log(`⚠️ [${context}] Error consultando Directions API:`, error.message)
        }
      }
    }
  }

  // 2) Usar Distance Matrix (más rápido y confiable para coordenadas directas).
  const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&mode=driving&units=metric&key=${apiKey}`
  console.log(`🧭 [${context}] Directions falló, usando Distance Matrix...`)
  console.log(`🔍 [${context}] Origin procesado: "${origin}" (encoded: "${encodedOrigin}")`)
  console.log(`🔍 [${context}] Destination procesado: "${destination}" (encoded: "${encodedDestination}")`)
  
  let dmResponse, dmData;
  try {
    dmResponse = await fetch(distanceMatrixUrl)
    dmData = await dmResponse.json()
  } catch (fetchError) {
    // Si es error de conexión, lanzar error controlado
    if (fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED' || fetchError.code === 'ETIMEDOUT') {
      const error = new Error('Sin conexión a internet. No se puede calcular la distancia.')
      error.code = 'NO_CONNECTION'
      throw error
    }
    throw fetchError
  }

  // Log detallado de la respuesta
  console.log(`📊 [${context}] Distance Matrix respuesta:`, {
    status: dmData.status,
    error_message: dmData.error_message,
    rows_count: dmData.rows?.length,
    element_status: dmData.rows?.[0]?.elements?.[0]?.status,
    origin_addresses: dmData.origin_addresses,
    destination_addresses: dmData.destination_addresses
  })

  if (dmData.status === 'OK' && dmData.rows?.[0]?.elements?.[0]?.status === 'OK') {
    const element = dmData.rows[0].elements[0]
    console.log(`✅ [${context}] Distance Matrix respondió: ${element.distance.text} / ${element.duration.text}`)
    return {
      source: 'distance-matrix',
      distanceMeters: element.distance.value,
      distanceText: element.distance.text,
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
      originAddress: dmData.origin_addresses?.[0] || '',
      destinationAddress: dmData.destination_addresses?.[0] || '',
      rawResponse: dmData
    }
  }

  // Si el status es OK pero el elemento no, mostrar más detalles
  if (dmData.status === 'OK' && dmData.rows?.[0]?.elements?.[0]) {
    const element = dmData.rows[0].elements[0]
    const elementStatus = element.status
    console.log(`⚠️ [${context}] Distance Matrix status=OK pero elemento tiene status="${elementStatus}"`)
    console.log(`⚠️ [${context}] Mensaje del elemento:`, element.error_message || 'Sin mensaje')
    
    // Si es ZERO_RESULTS, puede ser que las direcciones no sean válidas
    if (elementStatus === 'ZERO_RESULTS') {
      throw new Error(`No se encontró ruta entre "${origin}" y "${destination}". Verifica que las direcciones sean correctas.`)
    }
    
    // Si es NOT_FOUND, intentar re-expandir URLs cortas o hacer geocoding
    if (elementStatus === 'NOT_FOUND') {
      console.log(`🔄 [${context}] NOT_FOUND detectado. Intentando re-expandir URLs o geocoding...`)
      
      // Prevenir bucles infinitos - limitar re-expansiones
      const retryCount = (context.match(/-reexpanded/g) || []).length
      const maxRetries = 1 // Solo permitir 1 re-expansión
      
      if (retryCount >= maxRetries) {
        console.log(`⚠️ [${context}] Límite de re-expansiones alcanzado (${retryCount}), saltando a geocoding...`)
        // Saltar re-expansión y ir directo a geocoding
      } else {
        // Limpiar URLs de caracteres extra antes de procesar
        const cleanOrigin = origin.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
        const cleanDestination = destination.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
        
        // Si el origen o destino son URLs cortas, intentar expandirlas nuevamente
        let newOrigin = cleanOrigin
        let newDestination = cleanDestination
        let shouldRetry = false
        
        if (cleanOrigin.includes('goo.gl') || cleanOrigin.includes('maps.app.goo.gl')) {
          console.log(`🔄 [${context}] Re-expandiendo origen (goo.gl)...`)
          try {
            const reExpanded = await expandUrlAndExtractCoords(cleanOrigin)
            // Solo usar si se expandió a algo diferente y no es goo.gl
            if (reExpanded && reExpanded !== cleanOrigin && !reExpanded.includes('goo.gl') && !reExpanded.includes('maps.app.goo.gl')) {
              newOrigin = reExpanded
              shouldRetry = true
              console.log(`✅ [${context}] Origen re-expandido:`, newOrigin)
            }
          } catch (e) {
            console.log(`⚠️ [${context}] Re-expansión de origen falló:`, e.message)
          }
        }
        
        if (cleanDestination.includes('goo.gl') || cleanDestination.includes('maps.app.goo.gl')) {
          console.log(`🔄 [${context}] Re-expandiendo destino (goo.gl)...`)
          try {
            const reExpanded = await expandUrlAndExtractCoords(cleanDestination)
            // Solo usar si se expandió a algo diferente y no es goo.gl
            if (reExpanded && reExpanded !== cleanDestination && !reExpanded.includes('goo.gl') && !reExpanded.includes('maps.app.goo.gl')) {
              newDestination = reExpanded
              shouldRetry = true
              console.log(`✅ [${context}] Destino re-expandido:`, newDestination)
            }
          } catch (e) {
            console.log(`⚠️ [${context}] Re-expansión de destino falló:`, e.message)
          }
        }
        
        // Si se re-expandieron las URLs, intentar de nuevo
        if (shouldRetry) {
          console.log(`🔄 [${context}] Recalculando con URLs re-expandidas...`)
          return await getShortestDrivingRoute({
            origin: newOrigin,
            destination: newDestination,
            apiKey,
            context: `${context}-reexpanded`
          })
        }
      }
      
      // Si no se pudieron re-expandir, intentar geocoding como último recurso
      try {
        console.log(`🔄 [${context}] Intentando geocoding como último recurso...`)
        // Limpiar URLs antes de geocoding
        const cleanOrigin = origin.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
        const cleanDestination = destination.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
        
        const geocodedOrigin = await geocodeLocation(cleanOrigin)
        const geocodedDestination = await geocodeLocation(cleanDestination)
        
        if (geocodedOrigin && geocodedDestination && 
            !geocodedOrigin.includes('http') && !geocodedDestination.includes('http')) {
          console.log(`🔄 [${context}] Recalculando con coordenadas geocodificadas...`)
          return await getShortestDrivingRoute({
            origin: geocodedOrigin,
            destination: geocodedDestination,
            apiKey,
            context: `${context}-geocoded`
          })
        }
      } catch (geocodeError) {
        console.log(`⚠️ [${context}] Geocoding también falló:`, geocodeError.message)
      }
      
      // Si todo falla, lanzar el error
      throw new Error(`Una de las direcciones no fue encontrada. Origen: "${origin}", Destino: "${destination}"`)
    }
    
    throw new Error(`Distance Matrix no pudo calcular la ruta. Status del elemento: ${elementStatus}. ${element.error_message || ''}`)
  }

  console.log(`❌ [${context}] Distance Matrix tampoco pudo calcular la ruta. status=${dmData.status}, error_message=${dmData.error_message || 'N/A'}`)
  throw new Error(dmData.error_message || `No se pudo calcular la distancia. Status: ${dmData.status}`)
}

// Función para expandir URLs acortadas y extraer coordenadas
const expandUrlAndExtractCoords = async (shortUrl) => {
  // Limpiar la URL de espacios, paréntesis y otros caracteres extra al inicio/final
  shortUrl = shortUrl.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
  
  // Guardar la URL original limpia para posibles fallbacks
  const originalUrl = shortUrl
  
  try {
    console.log('🔍 Expandiendo URL:', shortUrl)
    
    // IMPORTANTE: Los IDs de goo.gl pueden contener números al inicio (ej: 191gzy9EswNTvgz29)
    // NO limpiar URLs que solo tienen números al inicio - pueden ser válidas
    // Solo limpiar si hay una concatenación REAL (dos URLs completas juntas)
    
    // Remover parámetros de query primero
    const urlSinParams = shortUrl.includes('?') ? shortUrl.split('?')[0] : shortUrl
    
    // Detectar concatenación REAL: dos URLs completas juntas
    // Ejemplo: https://maps.app.goo.gl/xxxhttps://maps.app.goo.gl/yyy
    const urlConcatenada = urlSinParams.match(/https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+(https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+)/)
    if (urlConcatenada) {
      shortUrl = urlConcatenada[1]
      console.log('🔗 URL limpiada (concatenación REAL detectada):', shortUrl)
    } else {
      shortUrl = urlSinParams
    }
    
    // Si ya contiene coordenadas directamente, extraerlas
    // PRIORIDAD: Coordenadas específicas del lugar primero, luego del viewport
    const coordPatterns = [
      // Patrón MÁS ESPECÍFICO: coordenadas del lugar (!8m2!3d!4d)
      /!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      // Patrón con !3d y !4d (formato interno de Google Maps)
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      // NUEVO: Patrón para URLs de búsqueda con coordenadas (/search/-17.392743,+-66.204253)
      /\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/,
      // NUEVO: Patrón para URLs de búsqueda con coordenadas en formato diferente
      /\/search\/(-?\d+\.\d+),(-?\d+\.\d+)/,
      // Patrón con q= (query)
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      // Patrón con ll= (lat/lng)
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      // Patrón con center=
      /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
      // Patrón más específico: coordenadas después de @ con zoom (puede terminar en z o número)
      /@(-?\d+\.\d+),(-?\d+\.\d+),[\d.]+[a-z]?/,
      // Patrón principal con @ (ÚLTIMO - es el viewport, no el lugar específico)
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      // Patrón para URLs con coordinates en el path
      /\/(-?\d+\.\d+),(-?\d+\.\d+)/
    ]
    
    for (let i = 0; i < coordPatterns.length; i++) {
      const pattern = coordPatterns[i]
      const match = shortUrl.match(pattern)
      if (match) {
        const coords = `${match[1]},${match[2]}`
        const patternNames = [
          'Coordenadas del lugar (!8m2!3d!4d) - MÁS PRECISO',
          'Coordenadas internas (!3d!4d)',
          'Coordenadas de búsqueda (/search/lat,lng) - NUEVO',
          'Coordenadas de búsqueda (/search/lat,lng) - NUEVO',
          'Query coordinates (q=)',
          'LatLng parameter (ll=)',
          'Center parameter (center=)',
          'Coordenadas con zoom (@lat,lng,zoom)',
          'Coordenadas del viewport (@lat,lng) - MENOS PRECISO',
          'Path coordinates (/lat,lng)'
        ]
        console.log(`✅ Coordenadas encontradas con patrón ${i + 1} (${patternNames[i]}):`, coords)
        return coords
      }
    }
    
    // Si todavía es una URL acortada, intentar expandirla (con timeout)
    if (shortUrl.includes('goo.gl') || shortUrl.includes('maps.app.goo.gl')) {
      console.log('🔄 Intentando expandir URL corta...')
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // Timeout de 3 segundos
        
        const getResponse = await fetch(shortUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        const newExpandedUrl = getResponse.url
        
        // PRIMERO intentar extraer coordenadas de la URL expandida (incluso si tiene formato problemático)
        if (newExpandedUrl !== shortUrl && !newExpandedUrl.includes('maps.app.goo.gl') && !newExpandedUrl.includes('goo.gl')) {
          console.log('✅ URL expandida exitosamente:', newExpandedUrl)
          
          // Intentar extraer coordenadas de la URL expandida inmediatamente
          for (let i = 0; i < coordPatterns.length; i++) {
            const pattern = coordPatterns[i]
            const match = newExpandedUrl.match(pattern)
            if (match) {
              const coords = `${match[1]},${match[2]}`
              const patternNames = [
                'Coordenadas del lugar (!8m2!3d!4d) - MÁS PRECISO',
                'Coordenadas internas (!3d!4d)',
                'Coordenadas de búsqueda (/search/lat,lng) - NUEVO',
                'Coordenadas de búsqueda (/search/lat,lng) - NUEVO',
                'Query coordinates (q=)',
                'LatLng parameter (ll=)',
                'Center parameter (center=)',
                'Coordenadas con zoom (@lat,lng,zoom)',
                'Coordenadas del viewport (@lat,lng) - MENOS PRECISO',
                'Path coordinates (/lat,lng)'
              ]
              console.log(`✅ Coordenadas extraídas de URL expandida con patrón ${i + 1} (${patternNames[i]}):`, coords)
              return coords
            }
          }
          
          // Si no se pudieron extraer coordenadas, verificar si tiene formato problemático
          if (newExpandedUrl.includes('/place//') || (newExpandedUrl.includes('data=') && newExpandedUrl.includes('/place/'))) {
            console.log('⚠️ URL expandida tiene formato problemático (/place//data=) y no tiene coordenadas')
            console.log('🔄 Intentando re-expandir la URL una vez más para obtener coordenadas...')
            
            // Intentar hacer un fetch a la URL expandida para seguir las redirecciones
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos
              
              const reExpandResponse = await fetch(newExpandedUrl, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal
              })
              clearTimeout(timeoutId)
              const finalUrl = reExpandResponse.url
              
              console.log('🔄 URL re-expandida finalmente:', finalUrl)
              
              // Intentar extraer coordenadas de la URL final
              for (let i = 0; i < coordPatterns.length; i++) {
                const pattern = coordPatterns[i]
                const match = finalUrl.match(pattern)
                if (match) {
                  const coords = `${match[1]},${match[2]}`
                  console.log(`✅ Coordenadas extraídas de URL re-expandida con patrón ${i + 1}:`, coords)
                  return coords
                }
              }
              
              console.log('⚠️ URL re-expandida tampoco tiene coordenadas explícitas')
            } catch (reExpandError) {
              console.log('⚠️ Error al re-expandir URL:', reExpandError.message)
            }
            
            // Si re-expansión no funcionó, intentar múltiples estrategias
            console.log('🔄 Intentando múltiples estrategias para URL problemática...')
            
            // ESTRATEGIA 1: Intentar usar la URL corta original si está disponible
            if (originalUrl && (originalUrl.includes('goo.gl') || originalUrl.includes('maps.app.goo.gl'))) {
              console.log('🔄 Intentando usar URL corta original:', originalUrl)
              // La URL corta puede funcionar mejor con Distance Matrix
              return originalUrl.trim()
            }
            
            // ESTRATEGIA 2: Intentar extraer nombre del lugar de la URL si está disponible
            // Algunas URLs tienen el nombre del lugar en el path: /place/NombreDelLugar/
            const placeNameMatch = newExpandedUrl.match(/\/place\/([^\/\?]+)/)
            if (placeNameMatch && placeNameMatch[1] && placeNameMatch[1] !== '') {
              const placeName = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '))
              console.log('📍 Nombre del lugar extraído:', placeName)
              try {
                const geocodedCoords = await geocodeLocation(placeName)
                if (geocodedCoords && !geocodedCoords.includes('http')) {
                  console.log('✅ Coordenadas obtenidas por geocoding del nombre del lugar:', geocodedCoords)
                  return geocodedCoords
                }
              } catch (placeNameError) {
                console.log('⚠️ Geocoding del nombre del lugar falló:', placeNameError.message)
              }
            }
            
            // ESTRATEGIA 3: Intentar construir URL válida limpiando el formato problemático
            try {
              // Remover el doble slash y construir URL válida
              let cleanUrl = newExpandedUrl.replace(/\/place\/\/+/g, '/place/')
              // Si tiene data= con Place ID, intentar construir URL más simple
              const placeIdMatch = newExpandedUrl.match(/data=!4m2!3m1!1s([^!]+)/)
              if (placeIdMatch && placeIdMatch[1]) {
                // El Place ID puede estar en formato 0x...:0x... o ChIJ...
                const placeId = placeIdMatch[1]
                console.log('📍 Place ID encontrado en data:', placeId)
                
                // Si es un Place ID estándar (ChIJ...), intentar geocoding directo
                if (placeId.startsWith('ChIJ') || placeId.startsWith('Ei')) {
                  try {
                    const apiKey = GOOGLE_MAPS_API_KEY
                    if (apiKey) {
                      const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}`
                      const geocodeResponse = await fetch(geocodingUrl)
                      const geocodeData = await geocodeResponse.json()
                      
                      if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
                        const location = geocodeData.results[0].geometry.location
                        const coords = `${location.lat},${location.lng}`
                        console.log('✅ Coordenadas obtenidas por geocoding con Place ID estándar:', coords)
                        return coords
                      }
                    }
                  } catch (placeIdError) {
                    console.log('⚠️ Geocoding con Place ID estándar falló:', placeIdError.message)
                  }
                }
              }
              
              // Limpiar URL y usar directamente
              cleanUrl = cleanUrl.split('?')[0].split('#')[0]
              cleanUrl = cleanUrl.replace(/\/\/+/g, '/')
              console.log('🔄 Usando URL limpia construida:', cleanUrl)
              return cleanUrl
            } catch (cleanError) {
              console.log('⚠️ Limpieza de URL falló:', cleanError.message)
            }
            
            // ESTRATEGIA 4: Si todo falla, priorizar URL corta original sobre URL expandida problemática
            if (originalUrl && (originalUrl.includes('goo.gl') || originalUrl.includes('maps.app.goo.gl'))) {
              console.log('🔄 Usando URL corta original (mejor que URL expandida problemática):', originalUrl)
              return originalUrl.trim()
            }
            
            // Último recurso: usar URL expandida (aunque sea problemática)
            console.log('🔄 Usando URL expandida original (Distance Matrix puede intentar procesarla):', newExpandedUrl)
            return newExpandedUrl
          }
          
          // Si no tiene formato problemático, continuar con el flujo normal
          shortUrl = newExpandedUrl
        } else {
          console.log('⚠️ URL no se pudo expandir completamente. Intentando extraer Place ID o usar geocoding...')
          // Si la URL expandida todavía es goo.gl, mantener la original para usar directamente
          if (newExpandedUrl.includes('maps.app.goo.gl') || newExpandedUrl.includes('goo.gl')) {
            // Mantener la URL original corta - Distance Matrix puede procesarla directamente
            console.log('🔄 URL expandida sigue siendo corta, usando URL original directamente')
            shortUrl = originalUrl
          } else {
            // Si se expandió pero no tiene coordenadas, intentar usar la expandida
            // Pero también considerar usar la original si la expandida tiene problemas
            if (newExpandedUrl.includes('/place//') || newExpandedUrl.includes('data=') || !newExpandedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)) {
              // La URL expandida tiene problemas, intentar con la original
              console.log('🔄 URL expandida tiene formato problemático, intentando con URL original corta')
              shortUrl = originalUrl
            } else {
              shortUrl = newExpandedUrl
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Error expandiendo URL:', error.message)
        // Si falla la expansión, usar la URL original directamente
        // Las APIs de Google Maps pueden procesar URLs cortas de goo.gl
        console.log('✅ Usando URL original corta directamente (Distance Matrix puede procesarla)')
        return originalUrl.trim()
      }
    }
    
    // Si es una URL completa de Google Maps o todavía es goo.gl, procesarla
    if (shortUrl.includes('google.com/maps') || shortUrl.includes('maps.google.com') || shortUrl.includes('goo.gl') || shortUrl.includes('maps.app.goo.gl')) {
      let expandedUrl = shortUrl
      
      // Extraer coordenadas de la URL expandida
      for (let i = 0; i < coordPatterns.length; i++) {
        const pattern = coordPatterns[i]
        const match = expandedUrl.match(pattern)
        if (match) {
          const coords = `${match[1]},${match[2]}`
          const patternNames = [
            'Coordenadas del lugar (!8m2!3d!4d) - MÁS PRECISO',
            'Coordenadas internas (!3d!4d)',
            'Coordenadas de búsqueda (/search/lat,lng) - NUEVO',
            'Coordenadas de búsqueda (/search/lat,lng) - NUEVO',
            'Query coordinates (q=)',
            'LatLng parameter (ll=)',
            'Center parameter (center=)',
            'Coordenadas con zoom (@lat,lng,zoom)',
            'Coordenadas del viewport (@lat,lng) - MENOS PRECISO',
            'Path coordinates (/lat,lng)'
          ]
          console.log(`✅ Coordenadas extraídas con patrón ${i + 1} (${patternNames[i]}):`, coords)
          return coords
        }
      }
      
      // Si la URL expandida tiene formato problemático (/place//data=), intentar geocoding primero
      // Si geocoding falla, usar la URL expandida directamente (Distance Matrix puede intentar procesarla)
      if (expandedUrl.includes('/place//') || (expandedUrl.includes('data=') && expandedUrl.includes('/place/'))) {
        console.log('⚠️ URL expandida tiene formato /place//data=, intentando geocoding...')
        try {
          const geocodedCoords = await geocodeLocation(expandedUrl)
          if (geocodedCoords && !geocodedCoords.includes('http')) {
            console.log('✅ Coordenadas obtenidas por geocoding:', geocodedCoords)
            return geocodedCoords
          }
        } catch (geocodeError) {
          console.log('⚠️ Geocoding falló, usando URL expandida directamente:', geocodeError.message)
        }
        // Si geocoding falla, usar la URL expandida directamente
        console.log('🔄 Usando URL expandida directamente (Distance Matrix puede intentar procesarla)')
        return expandedUrl
      }
      
      // Si la URL expandida es una URL completa de Google Maps (sin formato problemático), usarla directamente
      // La API de Distance Matrix acepta URLs de Google Maps como origen/destino
      if (expandedUrl.includes('google.com/maps') && expandedUrl !== shortUrl) {
        // Limpiar parámetros innecesarios de la URL para que sea más estable
        const cleanUrl = expandedUrl.split('?')[0].split('&')[0]
        console.log('✅ Usando URL expandida directamente:', cleanUrl)
        return cleanUrl
      }
      
      // Si la URL no se expandió pero es una URL de Google Maps, intentar usarla directamente
      if (shortUrl.includes('google.com/maps')) {
        console.log('✅ Usando URL de Google Maps directamente:', shortUrl)
        return shortUrl
      }
      
      // Intentar extraer Place ID de la URL (formato !1s o !4m2!3m1!1s)
      // Los Place IDs en URLs de Google Maps están en formato codificado: !1sChIJ... o !4m2!3m1!1s0x...
      const placeIdPatterns = [
        /!4m2!3m1!1s([A-Za-z0-9_\-:]+)/,  // Formato !4m2!3m1!1s0x... (incluir : para IDs complejos)
        /!1s([A-Za-z0-9_\-:]+)/,  // Formato !1sChIJ...
        /\/place\/!1s([A-Za-z0-9_\-:]+)/,  // En el path
        /data=!4m2!3m1!1s([A-Za-z0-9_\-:]+)/  // En data parameter
      ]
      
      let placeId = null
      let placeIdFull = null
      for (const pattern of placeIdPatterns) {
        const match = expandedUrl.match(pattern)
        if (match && match[1]) {
          placeId = match[1]
          placeIdFull = match[0] // Guardar el match completo para debugging
          console.log('🏢 Place ID detectado en URL:', placeId, '(pattern completo:', placeIdFull + ')')
          break
        }
      }
      
      // Si encontramos un Place ID, intentar obtener coordenadas usando Places API
      if (placeId) {
        try {
          const apiKey = GOOGLE_MAPS_API_KEY
          if (apiKey) {
            // Si el Place ID contiene "0x" al inicio, es un formato interno de Google Maps
            // Este formato no funciona con Places API, necesitamos extraer coordenadas de otra manera
            if (placeId.startsWith('0x')) {
              console.log('⚠️ Place ID es formato interno (0x...), intentando extraer coordenadas de la URL expandida...')
              
              // Intentar buscar coordenadas en parámetros adicionales de la URL
              const coordPatternsForPlaceId = [
                /@(-?\d+\.\d+),(-?\d+\.\d+)/,  // Coordenadas con @
                /center=(-?\d+\.\d+),(-?\d+\.\d+)/,  // Parámetro center
                /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,  // Parámetro ll
                /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,  // Formato interno !3d!4d
              ]
              
              for (const pattern of coordPatternsForPlaceId) {
                const match = expandedUrl.match(pattern)
                if (match) {
                  const coords = `${match[1]},${match[2]}`
                  console.log('✅ Coordenadas encontradas en URL expandida:', coords)
                  return coords
                }
              }
              
              // Para Place IDs con formato 0x...:0x..., intentar convertir a formato estándar
              // El formato 0x... es hexadecimal, pero Google también acepta CID (Customer ID)
              // Intentar usar el Place ID directamente con Distance Matrix usando formato place_id:
              console.log('🔄 Intentando usar Place ID interno directamente con Distance Matrix...')
              // Construir un identificador que Distance Matrix pueda procesar
              // El formato 0x...:0x... es un CID (Customer ID) de Google Maps
              // Podemos intentar usar el CID directamente
              const cidMatch = placeId.match(/0x[a-fA-F0-9]+:0x([a-fA-F0-9]+)/)
              if (cidMatch) {
                // Convertir el segundo valor hexadecimal a decimal para obtener el CID
                const cidHex = cidMatch[1]
                const cidDecimal = parseInt(cidHex, 16)
                console.log(`🔄 CID extraído: ${cidDecimal} (de hex: ${cidHex})`)
                // Usar el CID con Distance Matrix
                return `place_id:${cidDecimal}`
              }
              
              // Si no pudimos extraer el CID, usar la URL expandida directamente
              console.log('🔄 Usando URL expandida directamente (Distance Matrix puede intentar procesarla)...')
              return expandedUrl
            } else {
              // Es un Place ID estándar (comienza con ChIJ...), intentar usar Places API
              const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${apiKey}`
              console.log('🔄 Intentando obtener coordenadas usando Places API...')
              
              const placesResponse = await fetch(placesUrl)
              const placesData = await placesResponse.json()
              
              if (placesData.status === 'OK' && placesData.result?.geometry?.location) {
                const location = placesData.result.geometry.location
                const coords = `${location.lat},${location.lng}`
                console.log('✅ Coordenadas obtenidas usando Places API:', coords)
                return coords
              } else {
                console.log('⚠️ Places API no pudo obtener coordenadas:', placesData.status)
                // Intentar usar el Place ID directamente con Distance Matrix (acepta place_id:ChIJ...)
                // Pero solo si es un formato válido de Place ID (no los 0x...)
                if (!placeId.startsWith('0x')) {
                  console.log('🔄 Intentando usar Place ID directamente con Distance Matrix...')
                  return `place_id:${placeId}`
                }
              }
            }
          }
        } catch (error) {
          console.log('⚠️ Error usando Places API:', error.message)
          // Continuar con otros métodos
        }
      }
      
      // Si la URL tiene formato /place//data=, intentar usar la URL corta original directamente
      // La Distance Matrix API a veces puede procesar URLs cortas de goo.gl
      if (expandedUrl.includes('/place//') || expandedUrl.includes('data=')) {
        console.log('⚠️ URL tiene formato /place//data=, intentando estrategias alternativas...')
        
        // Intentar usar la URL corta original directamente
        // Necesitamos acceder a la URL original que se guardó antes de la expansión
        // Como no la tenemos aquí directamente, intentaremos hacer una última búsqueda de coordenadas
        // o usar geocoding con el nombre del lugar si está disponible
        
        // Buscar coordenadas en parámetros adicionales de la URL expandida
        const coordPatternsAdvanced = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,  // Coordenadas con @
          /center=(-?\d+\.\d+),(-?\d+\.\d+)/,  // Parámetro center
          /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,  // Parámetro ll
        ]
        
        for (const pattern of coordPatternsAdvanced) {
          const match = expandedUrl.match(pattern)
          if (match) {
            const coords = `${match[1]},${match[2]}`
            console.log('✅ Coordenadas encontradas en parámetros avanzados:', coords)
            return coords
          }
        }
      }
      
      // Si no hay Place ID válido, intentar extraer el nombre del lugar y hacer geocoding
      const placeMatch = expandedUrl.match(/\/place\/([^\/\?]+)/)
      if (placeMatch) {
        const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        console.log('🏢 Lugar detectado en URL expandida:', placeName)
        // Intentar geocoding con el nombre del lugar
        try {
          const geocodedCoords = await geocodeLocation(placeName)
          if (geocodedCoords && !geocodedCoords.includes('http')) {
            console.log('✅ Coordenadas obtenidas por geocoding del lugar:', geocodedCoords)
            return geocodedCoords
          }
        } catch (error) {
          console.log('⚠️ Geocoding falló para el lugar, intentando usar URL directamente:', error.message)
        }
      }
      
      // Si la URL expandida es una URL completa de Google Maps, limpiarla y usarla directamente
      // La API de Distance Matrix acepta URLs de Google Maps como origen/destino
      if (expandedUrl.includes('google.com/maps') || expandedUrl.includes('google.com.bo/maps')) {
        try {
          // Primero intentar extraer una URL más limpia del place
          if (expandedUrl.includes('/place/')) {
            // Buscar el nombre del lugar después de /place/
            // Puede ser que tenga doble slash o parámetros data=
            const placeMatch = expandedUrl.match(/(https?:\/\/[^\/]+\/maps\/place\/[^\/\?]+)/)
            if (placeMatch && !placeMatch[1].endsWith('//')) {
              // Si tiene un nombre de lugar válido
              console.log('✅ Usando URL de place directamente:', placeMatch[1])
              return placeMatch[1]
            }
            
            // Si tiene parámetros data= con Place ID, intentar construir URL más simple
            // Extraer el dominio y construir una URL básica de place
            const urlObj = new URL(expandedUrl)
            // Intentar encontrar un identificador válido en los parámetros
            const dataMatch = expandedUrl.match(/data=!4m2!3m1!1s([A-Za-z0-9_-]+)/)
            if (dataMatch && dataMatch[1]) {
              // Construir una URL más simple usando el identificador
              const simpleUrl = `${urlObj.protocol}//${urlObj.host}/maps/place/?cid=${dataMatch[1]}`
              console.log('✅ Usando URL simplificada con identificador:', simpleUrl)
              return simpleUrl
            }
          }
          
          // Si no encontramos un place válido, usar la URL limpia sin parámetros
          const urlObj = new URL(expandedUrl)
          let cleanPath = urlObj.pathname
          // Remover doble slash si existe
          cleanPath = cleanPath.replace(/\/\/+/g, '/')
          // Si el path termina con /, removerlo (excepto si es solo /)
          if (cleanPath !== '/' && cleanPath.endsWith('/')) {
            cleanPath = cleanPath.slice(0, -1)
          }
          const cleanUrl = `${urlObj.protocol}//${urlObj.host}${cleanPath || '/maps'}`
          console.log('✅ Usando URL de Google Maps limpia:', cleanUrl)
          return cleanUrl
        } catch (urlError) {
          // Si falla el parsing, intentar limpieza básica con regex
          // Remover parámetros de query y fragmentos
          let cleanUrl = expandedUrl.split('?')[0].split('#')[0]
          // Remover doble slash
          cleanUrl = cleanUrl.replace(/\/\/+/g, '/')
          console.log('✅ Usando URL de Google Maps (limpieza básica):', cleanUrl)
          return cleanUrl
        }
      }
    }
    
    // Si no encontramos coordenadas y tenemos una URL corta original guardada, intentar usarla directamente
    // La Distance Matrix API puede procesar URLs cortas de goo.gl directamente
    // PRIORIZAR URL CORTA sobre URL expandida problemática
    if (typeof originalUrl !== 'undefined' && originalUrl && 
        (originalUrl.includes('goo.gl') || originalUrl.includes('maps.app.goo.gl'))) {
      // Si la URL expandida tiene problemas O no tiene coordenadas, usar la corta original
      const hasProblematicFormat = shortUrl.includes('/place//') || 
                                   shortUrl.includes('data=') || 
                                   shortUrl.includes('/place//data=')
      const hasNoCoords = !shortUrl.match(/-?\d+\.\d+,-?\d+\.\d+/)
      
      if (hasProblematicFormat || hasNoCoords || !shortUrl.includes('goo.gl')) {
        console.log('🔄 URL expandida problemática o sin coordenadas, usando URL corta original directamente...')
        console.log('📍 URL corta original:', originalUrl)
        return originalUrl.trim()
      }
    }
    
    // Si no encontramos coordenadas, intentar geocoding como respaldo (solo si no es una URL)
    if (!shortUrl.includes('http://') && !shortUrl.includes('https://')) {
      console.log('🔄 No se encontraron coordenadas, intentando geocoding...')
      try {
        const geocodedCoords = await geocodeLocation(shortUrl)
        if (geocodedCoords) {
          return geocodedCoords
        }
      } catch (error) {
        console.log('⚠️ Geocoding falló:', error.message)
      }
    }
    
    // Si todo falla, priorizar URL corta original sobre URL expandida problemática
    if (originalUrl && (originalUrl.includes('goo.gl') || originalUrl.includes('maps.app.goo.gl'))) {
      console.log('📍 Usando URL corta original (fallback final):', originalUrl)
      return originalUrl.trim()
    }
    
    // Último recurso: usar la ubicación procesada
    console.log('📍 Usando ubicación procesada:', shortUrl)
    return shortUrl
  } catch (error) {
    console.error('❌ Error expandiendo URL:', error)
    return shortUrl
  }
}

// Cache para URLs expandidas (evitar expandir la misma URL múltiples veces)
const urlExpansionCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Función optimizada para expandir URLs con caché
const expandUrlAndExtractCoordsCached = async (shortUrl) => {
  // Verificar caché
  const cached = urlExpansionCache.get(shortUrl)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log('✅ Usando URL del caché:', shortUrl)
    return cached.result
  }
  
  // Expandir y cachear
  const result = await expandUrlAndExtractCoords(shortUrl)
  urlExpansionCache.set(shortUrl, { result, timestamp: Date.now() })
  
  // Limpiar caché antiguo (mantener solo últimos 100)
  if (urlExpansionCache.size > 100) {
    const entries = Array.from(urlExpansionCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    urlExpansionCache.clear()
    entries.slice(0, 100).forEach(([key, value]) => urlExpansionCache.set(key, value))
  }
  
  return result
}

// Endpoint para validar si un link de Google Maps se puede calcular
app.get('/api/validate-maps-link', async (req, res) => {
  try {
    const { url } = req.query
    
    if (!url) {
      return res.json({ valid: false, reason: 'URL no proporcionada' })
    }
    
    console.log('🔍 Validando link de Google Maps:', url)
    
    // Intentar expandir y extraer coordenadas
    try {
      const result = await expandUrlAndExtractCoords(url)
      
      // Verificar si el resultado son coordenadas válidas
      const isCoords = /^-?\d+\.\d+,-?\d+\.\d+$/.test(result)
      
      if (isCoords) {
        console.log('✅ Link válido, coordenadas extraídas:', result)
        return res.json({ 
          valid: true, 
          coords: result,
          message: 'Link válido, se pueden calcular distancias'
        })
      }
      
      // Si no son coordenadas, verificar si es una URL procesable
      if (result && !result.includes('/place//') && !result.includes('data=')) {
        console.log('✅ Link válido, URL procesable')
        return res.json({ 
          valid: true, 
          message: 'Link válido, se pueden calcular distancias'
        })
      }
      
      // Si llegamos aquí, el link es problemático
      console.log('⚠️ Link problemático, no tiene coordenadas extraíbles')
      return res.json({ 
        valid: false, 
        reason: 'El link no contiene coordenadas. Usa un link con ubicación específica.'
      })
      
    } catch (error) {
      console.log('❌ Error validando link:', error.message)
      return res.json({ 
        valid: false, 
        reason: 'No se pudo procesar el link'
      })
    }
    
  } catch (error) {
    console.error('❌ Error en validate-maps-link:', error)
    res.status(500).json({ valid: false, reason: 'Error del servidor' })
  }
})

// Endpoint rápido para validar links de Google Maps
// Retorna rápido si el link tiene formato válido
app.get('/api/validate-maps-link', async (req, res) => {
  try {
    const { url } = req.query
    
    if (!url) {
      return res.status(400).json({ valid: false, error: 'URL no proporcionada' })
    }

    const cleanUrl = url.trim()

    // Validación básica de formato
    const isValidFormat = 
      cleanUrl.includes('maps.app.goo.gl') ||
      cleanUrl.includes('goo.gl/maps') ||
      cleanUrl.includes('google.com/maps') ||
      cleanUrl.includes('maps.google.com')

    if (!isValidFormat) {
      return res.json({ valid: false, error: 'Formato de URL no válido' })
    }

    // Para links cortos de Google Maps, intentar expandir rápidamente
    if (cleanUrl.includes('maps.app.goo.gl') || cleanUrl.includes('goo.gl/maps')) {
      try {
        // Timeout muy corto (2 segundos) para no bloquear
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2000)

        const response = await fetch(cleanUrl, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal
        })
        
        clearTimeout(timeout)

        // Si llega aquí, el link es accesible
        return res.json({ valid: true })
      } catch (error) {
        // Si falla, pero tiene formato correcto, asumir válido
        // (mejor UX que bloquear)
        return res.json({ 
          valid: true, 
          warning: 'No se pudo verificar completamente, pero el formato es correcto' 
        })
      }
    }

    // Para URLs completas de Google Maps, son válidas por formato
    return res.json({ valid: true })

  } catch (error) {
    console.error('Error validando link:', error)
    res.status(500).json({ valid: false, error: 'Error del servidor' })
  }
})

// Endpoint proxy para Distance Matrix API (evitar CORS)
app.get('/api/distance-proxy', async (req, res) => {
  try {
    const { origins, destinations } = req.query
    
    console.log('🔍 Distance proxy llamado con:', { origins, destinations })
    
    const apiKey = GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      console.error('❌ Google Maps API key no configurada en el backend')
      return res.status(400).json({ error: 'Google Maps API key no configurada en el backend' })
    }
    
    if (!origins || !destinations) {
      console.error('❌ Parámetros origins o destinations faltantes')
      return res.status(400).json({ error: 'Parámetros origins y destinations son requeridos' })
    }
    
    // Limpiar URLs de caracteres extra (espacios, paréntesis, etc.) al inicio
    const cleanOrigins = origins.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
    const cleanDestinations = destinations.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
    
    console.log('🧹 URLs limpiadas:', { 
      original: { origins, destinations },
      cleaned: { origins: cleanOrigins, destinations: cleanDestinations }
    })
    
    // Expandir URLs y extraer coordenadas (con caché)
    const processedOrigins = await expandUrlAndExtractCoordsCached(cleanOrigins)
    const processedDestinations = await expandUrlAndExtractCoordsCached(cleanDestinations)
    
    console.log('📍 URLs procesadas:', { 
      original: { origins: cleanOrigins, destinations: cleanDestinations },
      processed: { origins: processedOrigins, destinations: processedDestinations }
    })
    
    // Log adicional para debug
    console.log('🔍 Tipos de datos procesados:', {
      originsType: typeof processedOrigins,
      destinationsType: typeof processedDestinations,
      originsLength: processedOrigins?.length,
      destinationsLength: processedDestinations?.length
    })
    
    let routeInfo;
    try {
      routeInfo = await getShortestDrivingRoute({
        origin: processedOrigins,
        destination: processedDestinations,
        apiKey,
        context: 'distance-proxy'
      })
    } catch (routeError) {
      // Si es error de conexión, retornar error controlado
      if (routeError.code === 'NO_CONNECTION' || routeError.code === 'ENOTFOUND' || routeError.code === 'ECONNREFUSED' || routeError.code === 'ETIMEDOUT') {
        const now = Date.now()
        if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
          console.warn('⚠️ Sin conexión a internet. No se puede calcular la distancia.')
          lastConnectionErrorLog = now
        }
        return res.status(503).json({ 
          error: 'Sin conexión a internet',
          message: 'No se puede conectar a Google Maps API. Verifica tu conexión a internet.',
          status: 'NO_CONNECTION'
        })
      }
      throw routeError
    }
    
    console.log(`🚗 Ruta seleccionada (${routeInfo.source}): ${routeInfo.distanceText} - ${routeInfo.durationText}`)
    
    // Si la fuente ya es Distance Matrix, retornamos la respuesta original.
    let responsePayload
    if (routeInfo.source === 'distance-matrix' && routeInfo.rawResponse) {
      responsePayload = routeInfo.rawResponse
    } else {
      responsePayload = {
        destination_addresses: [routeInfo.destinationAddress || processedDestinations],
        origin_addresses: [routeInfo.originAddress || processedOrigins],
        rows: [
          {
            elements: [
              {
                status: 'OK',
                distance: {
                  text: routeInfo.distanceText,
                  value: routeInfo.distanceMeters
                },
                duration: {
                  text: routeInfo.durationText,
                  value: routeInfo.durationSeconds
                }
              }
            ]
          }
        ],
        status: 'OK',
        source: routeInfo.source
      }
    }
    
    console.log('📊 Respuesta normalizada (ruta más corta):', JSON.stringify(responsePayload, null, 2))
    
    res.json(responsePayload)
  } catch (error) {
    // Si es un error de conectividad, retornar error controlado
    if (error.code === 'NO_CONNECTION' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const now = Date.now()
      if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
        console.warn('⚠️ Error de conectividad en distance proxy.')
        lastConnectionErrorLog = now
      }
      return res.status(503).json({ 
        error: 'Sin conexión a internet',
        message: 'No se puede conectar a Google Maps API. Verifica tu conexión a internet.',
        status: 'NO_CONNECTION'
      })
    }
    
    console.error('❌ Error en distance proxy:', error.message || error)
    res.status(500).json({ error: 'Error calculando distancia: ' + (error.message || error) })
  }
})

app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body || {}
    console.log('📥 Datos recibidos del frontend:', JSON.stringify(order, null, 2))
    console.log('🔧 Configuración:', { 
      SHEET_ID: SHEET_ID ? 'Configurado' : 'No configurado', 
      SHEET_NAME,
      'Número de campos recibidos': Object.keys(order).length
    })
    console.log('🔍 Campos recibidos:', Object.keys(order))
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    const quoted = quoteSheet(SHEET_NAME)
    await ensureSheetExists(sheets, SHEET_ID, SHEET_NAME)

    // Asegurar encabezado (opcional: comentar si ya existe)
    const rangeHeader = `${quoted}!A1:AD1`
    const get = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rangeHeader })
    const hasHeader = (get.data.values || []).length > 0
    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: rangeHeader,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADER_ORDER] }
      })
    }

    // Verificar si el pedido ya existe (buscar por ID)
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A:A`
    })

    const ids = existingData.data.values || []
    let existingRowIndex = -1
    let duplicateCount = 0
    
    // Normalizar: aceptar tanto 'id' como 'ID'
    const orderId = order.id || order.ID || order['ID']
    
    console.log('🔍 Buscando pedido existente con ID:', orderId, 'Tipo:', typeof orderId)
    console.log('🔍 order.id:', order.id, '| order.ID:', order.ID)
    
    // Verificar si el ID ya existe y contar duplicados
    for (let i = 1; i < ids.length; i++) { // Saltar header (i=0)
      const sheetId = ids[i] && ids[i][0]
      
      if (ids[i] && String(sheetId) === String(orderId)) {
        if (existingRowIndex === -1) {
          existingRowIndex = i + 1 // +1 porque las filas de Google Sheets empiezan en 1
          console.log(`⚠️ ID ${orderId} ya existe en fila ${existingRowIndex} - NO DEBERÍA PASAR EN POST`)
        }
        duplicateCount++
      }
    }
    
    // NOTA: Esta lógica ya no se usa porque ahora manejamos duplicados más abajo
    // Mantenemos el código comentado para referencia
    // if (duplicateCount > 0 && existingRowIndex === -1) {
    //   console.log(`⚠️ ID ${orderId} ya existe ${duplicateCount} veces, generando nuevo ID...`)
    // }
    
    if (existingRowIndex === -1) {
      console.log('❌ No se encontró pedido existente, se agregará como nuevo')
    }

    const row = buildRow(order)
    console.log('📊 Fila construida para el sheet:', row)
    console.log(`📏 Número de columnas: ${row.length} (HEADER_ORDER: ${HEADER_ORDER.length})`)
    console.log(`📋 Columnas en HEADER_ORDER: ${HEADER_ORDER.join(', ')}`)

    // CRÍTICO: POST /api/orders solo debe CREAR, nunca actualizar
    // Si el ID ya existe, generar uno nuevo en lugar de sobrescribir
    if (existingRowIndex > 0) {
      console.warn(`⚠️ ADVERTENCIA: ID ${orderId} ya existe en fila ${existingRowIndex}`)
      console.warn(`⚠️ Esto NO debería pasar. Generando nuevo ID...`)
      
      // Generar nuevo ID basado en el máximo existente
      const numericIds = ids.slice(1).map(row => {
        const id = parseInt(String(row[0]).trim())
        return isNaN(id) ? 0 : id
      }).filter(id => id > 0)
      
      const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1
      order.id = newId.toString()
      order.ID = newId.toString()
      
      console.log(`🆕 Nuevo ID asignado para evitar sobrescribir: ${newId}`)
      
      // Reconstruir fila con nuevo ID
      const newRow = buildRow(order)
      
      // Agregar como nueva fila
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${quoted}!A:AE`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      })
      console.log(`✅ Added order with NEW ID #${newId} (original was ${orderId})`)
      
      // Registrar en audit log
      logAuditEntry('CREAR', order, {
        operator: order.Operador || order.operador,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        warning: `ID duplicado detectado. Original: ${orderId}, Nuevo: ${newId}`,
        existingId: orderId
      });
    } else {
      // Agregar nueva fila (flujo normal)
      // HEADER_ORDER tiene 31 columnas (A hasta AE)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${quoted}!A:AE`,
        valueInputOption: 'RAW', // RAW para evitar que Google Sheets reinterprete las fechas
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      })
      console.log(`✅ Added new order #${orderId}`)
      
      // Registrar en audit log
      logAuditEntry('CREAR', order, {
        operator: order.Operador || order.operador,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
      });
    }

    res.json({ ok: true, updated: existingRowIndex > 0 })
  } catch (err) {
    console.error('❌ Error en /api/orders:', err)
    console.error('❌ Stack trace:', err.stack)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

/**
 * PUT /api/orders/:id
 * Endpoint unificado para actualizar pedidos
 * Usa el mismo formato y lógica que POST /api/orders para garantizar consistencia
 * IMPORTANTE: Este endpoint reemplaza a PUT /api/update-order-status
 */
app.put('/api/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id
    const order = req.body || {}
    
    console.log('═══════════════════════════════════════')
    console.log('📥 [PUT /api/orders/:id] INICIO DE ACTUALIZACIÓN')
    console.log('📥 Order ID:', orderId)
    console.log('📥 Datos completos recibidos:', JSON.stringify(order, null, 2))
    console.log('📥 Campos principales:', {
      ID: order.ID || order.id,
      Cliente: order.Cliente || order.cliente,
      Recojo: order.Recojo || order.recojo,
      Entrega: order.Entrega || order.entrega,
      Estado: order.Estado || order.estado,
      Biker: order.Biker || order.biker,
      'Precio [Bs]': order['Precio [Bs]'] || order.precio_bs,
      'Dist. [Km]': order['Dist. [Km]'] || order.distancia_km
    })
    console.log('═══════════════════════════════════════')
    
    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de pedido es requerido' 
      })
    }
    
    if (!SHEET_ID) {
      return res.status(400).json({ 
        success: false, 
        error: 'SHEET_ID no configurado' 
      })
    }
    
    let auth;
    try {
      auth = await getAuthClient()
      await auth.authorize()
    } catch (authError) {
      if (authError.code === 'ENOTFOUND' || authError.code === 'ECONNREFUSED' || authError.code === 'ETIMEDOUT') {
        const now = Date.now()
        if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
          console.warn('⚠️ Sin conexión a internet. No se puede actualizar el pedido.')
          lastConnectionErrorLog = now
        }
        return res.status(503).json({ 
          success: false,
          error: 'Sin conexión a internet',
          message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.'
        })
      }
      throw authError
    }
    
    const sheets = google.sheets({ version: 'v4', auth })
    const quoted = quoteSheet(SHEET_NAME)
    
    // Buscar el pedido por ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A:A`
    })
    
    const ids = response.data.values || []
    let rowIndex = -1
    
    // Buscar la fila que contiene el pedido
    for (let i = 1; i < ids.length; i++) { // Saltar header (i=0)
      const sheetId = ids[i] && ids[i][0]
      if (String(sheetId) === String(orderId)) {
        rowIndex = i + 1 // +1 porque las filas de Google Sheets empiezan en 1
        console.log(`✅ Encontrado pedido #${orderId} en fila ${rowIndex}`)
        break
      }
    }
    
    if (rowIndex === -1) {
      return res.status(404).json({ 
        success: false,
        error: `Pedido #${orderId} no encontrado` 
      })
    }
    
    // LEER LA FILA EXISTENTE primero para preservar datos que no se envían
    const existingRowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A${rowIndex}:AE${rowIndex}`
    })
    
    const existingRow = (existingRowResponse.data.values && existingRowResponse.data.values[0]) || []
    
    // Construir objeto "before" para audit log (mapear fila a objeto)
    const beforeData = {};
    HEADER_ORDER.forEach((header, index) => {
      beforeData[header] = existingRow[index] || '';
    });
    
    // Construir nueva fila con buildRow
    const newRow = buildRow(order)
    
    // Mezclar: mantener valores existentes si los nuevos están vacíos
    // Solo sobrescribir si el nuevo valor NO está vacío O si es un campo que queremos limpiar intencionalmente
    const mergedRow = newRow.map((newValue, index) => {
      const columnName = HEADER_ORDER[index]
      const existingValue = existingRow[index] || ''
      
      // Campos que SÍ queremos poder vaciar intencionalmente (no preservar)
      // NOTA: "Detalles de la Carrera" REMOVIDO - nunca queremos borrar descripciones accidentalmente
      const canBeEmptied = ['Observaciones', 'Hora Fin', 'Duracion', 'Tiempo de espera']
      
      // Si el nuevo valor está vacío Y no es un campo que se puede vaciar, mantener el existente
      if (!newValue && !canBeEmptied.includes(columnName) && existingValue) {
        return existingValue
      }
      
      // Si hay un nuevo valor O es un campo que se puede vaciar, usar el nuevo
      return newValue
    })
    
    // HEADER_ORDER tiene 31 columnas (A hasta AE)
    const lastColumn = 'AE'
    
    console.log('📊 Fila mezclada final a escribir (primeras 15 cols):', mergedRow.slice(0, 15))
    console.log('📊 Rango de actualización:', `${quoted}!A${rowIndex}:${lastColumn}${rowIndex}`)
    console.log('📊 Total de columnas:', mergedRow.length)
    
    // Actualizar la fila en el sheet con la fila mezclada
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A${rowIndex}:${lastColumn}${rowIndex}`,
      valueInputOption: 'RAW', // RAW para evitar que Google Sheets reinterprete las fechas
      requestBody: { values: [mergedRow] }
    })
    
    console.log('✅ Respuesta de Google Sheets API:', {
      status: updateResponse.status,
      statusText: updateResponse.statusText,
      updatedCells: updateResponse.data?.updatedCells || 0
    })
    console.log(`✅ Pedido #${orderId} actualizado exitosamente en fila ${rowIndex}`)
    console.log('═══════════════════════════════════════')
    
    // Registrar en audit log
    logAuditEntry('EDITAR', order, {
      operator: order.Operador || order.operador,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      rowIndex: rowIndex,
      updatedCells: updateResponse.data?.updatedCells || 0
    }, beforeData);
    
    res.json({ 
      success: true, 
      message: `Pedido #${orderId} actualizado exitosamente`,
      rowIndex,
      updatedCells: updateResponse.data?.updatedCells || 0
    })
    
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const now = Date.now()
      if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
        console.warn('⚠️ Error de conectividad actualizando pedido.')
        lastConnectionErrorLog = now
      }
      return res.status(503).json({ 
        success: false,
        error: 'Sin conexión a internet',
        message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.'
      })
    }
    
    console.error(`❌ Error actualizando pedido #${req.params.id}:`, error.message || error)
    res.status(500).json({ 
      success: false,
      error: 'Error actualizando pedido', 
      details: error.message
    })
  }
})

/**
 * Endpoint para actualizar el estado de un pedido cliente a "CREADO"
 * y guardar el ID del pedido oficial creado
 * Se llama cuando se crea un pedido oficial desde un pedido de cliente
 */
app.post('/api/cliente/actualizar-estado-pedido', async (req, res) => {
  try {
    const { idPedidoCliente, idPedidoOficial } = req.body
    
    if (!idPedidoCliente) {
      return res.status(400).json({
        success: false,
        error: 'ID de pedido cliente es requerido'
      })
    }
    
    if (!idPedidoOficial) {
      return res.status(400).json({
        success: false,
        error: 'ID de pedido oficial es requerido'
      })
    }
    
    console.log(`\n🔄 Actualizando pedido cliente #${idPedidoCliente}:`)
    console.log(`   - Estado → CREADO`)
    console.log(`   - ID_pedido → ${idPedidoOficial}`)
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const clientesSheetName = 'Clientes'
    const quotedClientes = quoteSheet(clientesSheetName)
    
    // Leer todos los datos de la pestaña Clientes
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quotedClientes}!A:AD`
    })
    
    const rows = sheetResponse.data.values || []
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay datos en la pestaña Clientes'
      })
    }
    
    const headers = rows[0]
    const dataRows = rows.slice(1)
    
    // Buscar las columnas necesarias
    const idColumnIndex = headers.findIndex(h => h === 'ID')
    const estadoPedidoColumnIndex = headers.findIndex(h => h === 'Estado Pedido')
    const idPedidoColumnIndex = headers.findIndex(h => h === 'ID_pedido')
    
    if (idColumnIndex === -1) {
      return res.status(500).json({
        success: false,
        error: 'No se encontró la columna "ID" en la pestaña Clientes'
      })
    }
    
    if (estadoPedidoColumnIndex === -1) {
      return res.status(500).json({
        success: false,
        error: 'No se encontró la columna "Estado Pedido" en la pestaña Clientes'
      })
    }
    
    if (idPedidoColumnIndex === -1) {
      return res.status(500).json({
        success: false,
        error: 'No se encontró la columna "ID_pedido" en la pestaña Clientes'
      })
    }
    
    // Buscar el pedido por ID
    let rowIndex = -1
    for (let i = 0; i < dataRows.length; i++) {
      if (String(dataRows[i][idColumnIndex]) === String(idPedidoCliente)) {
        rowIndex = i + 2 // +2 porque: +1 por el header, +1 porque las filas empiezan en 1
        break
      }
    }
    
    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `No se encontró el pedido con ID ${idPedidoCliente} en la pestaña Clientes`
      })
    }
    
    // Convertir índices de columna a letra
    const estadoPedidoColumnLetter = getColumnLetter(estadoPedidoColumnIndex)
    const idPedidoColumnLetter = getColumnLetter(idPedidoColumnIndex)
    
    // Actualizar ambas celdas: Estado Pedido e ID_pedido
    const updates = [
      {
        range: `${quotedClientes}!${estadoPedidoColumnLetter}${rowIndex}`,
        values: [['CREADO']]
      },
      {
        range: `${quotedClientes}!${idPedidoColumnLetter}${rowIndex}`,
        values: [[idPedidoOficial]]
      }
    ]
    
    // Realizar las actualizaciones
    for (const update of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: update.range,
        valueInputOption: 'RAW',
        requestBody: {
          values: update.values
        }
      })
      console.log(`✅ Actualizado: ${update.range} = ${update.values[0][0]}`)
    }
    
    res.json({
      success: true,
      message: `Pedido cliente #${idPedidoCliente} marcado como CREADO con ID de pedido oficial #${idPedidoOficial}`,
      rowIndex,
      estadoPedidoColumn: estadoPedidoColumnLetter,
      idPedidoColumn: idPedidoColumnLetter
    })
    
  } catch (error) {
    console.error('❌ Error actualizando estado de pedido cliente:', error)
    res.status(500).json({
      success: false,
      error: 'Error actualizando estado',
      details: error.message
    })
  }
})

/**
 * Función auxiliar para convertir índice de columna a letra
 * 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, etc.
 */
function getColumnLetter(columnIndex) {
  let columnLetter = ''
  let tempIndex = columnIndex
  
  while (tempIndex >= 0) {
    columnLetter = String.fromCharCode(65 + (tempIndex % 26)) + columnLetter
    tempIndex = Math.floor(tempIndex / 26) - 1
  }
  
  return columnLetter
}

// Endpoint para guardar logs en CSV
app.post('/api/save-logs', async (req, res) => {
  try {
    const { logs } = req.body
    
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Logs data is required and must be an array' })
    }
    
    // Crear header CSV
    const header = 'timestamp,action,status,data,error,userAgent,url\n'
    
    // Convertir logs a CSV
    const csvContent = header + logs.map(log => {
      return [
        log.timestamp || '',
        log.action || '',
        log.status || '',
        log.data || '',
        log.error || '',
        log.userAgent || '',
        log.url || ''
      ].map(field => {
        // Escapar comillas y comas en CSV
        const str = String(field || '')
        return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str
      }).join(',')
    }).join('\n') + '\n'
    
    // Ruta del archivo CSV en el proyecto
    const csvPath = path.join(__dirname, '..', 'form_logs.csv')
    
    // Escribir archivo CSV
    fs.writeFileSync(csvPath, '\ufeff' + csvContent, 'utf8')
    
    console.log(`📄 Logs guardados en: ${csvPath}`)
    console.log(`📊 Total de logs: ${logs.length}`)
    
    res.json({ 
      success: true, 
      message: `Logs guardados exitosamente en ${csvPath}`,
      count: logs.length
    })
    
  } catch (error) {
    console.error('❌ Error guardando logs:', error)
    res.status(500).json({ 
      error: 'Error guardando logs', 
      details: error.message 
    })
  }
})

// Endpoint para leer datos del Google Sheet

app.get('/api/read-orders', async (req, res) => {
  try {
    console.log('📖 Leyendo datos del Google Sheet...')
    console.log('🔧 Configuración:', { SHEET_ID: SHEET_ID ? 'Configurado' : 'No configurado', SHEET_NAME })
    
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' })
    }
    
    let auth;
    try {
      auth = await getAuthClient()
      await auth.authorize()
    } catch (authError) {
      // Si hay problemas de conectividad (DNS, red, etc.), retornar error controlado
      if (authError.code === 'ENOTFOUND' || authError.code === 'ECONNREFUSED' || authError.code === 'ETIMEDOUT') {
        // Solo loguear una vez por minuto para evitar spam
        const now = Date.now()
        if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
          console.warn('⚠️ Sin conexión a internet. No se pueden cargar pedidos desde Google Sheets.')
          lastConnectionErrorLog = now
        }
        return res.status(503).json({ 
          error: 'Sin conexión a internet',
          message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.',
          data: [],
          count: 0
        })
      }
      throw authError
    }
    
    const sheets = google.sheets({ version: 'v4', auth })
    const quoted = quoteSheet(SHEET_NAME)
    
    // Leer todos los datos del sheet (hasta AE para incluir "Info. Adicional Entrega")
    const range = `${quoted}!A:AE`  // Leer todas las columnas hasta AE
    console.log('📊 Leyendo rango:', range)
    
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: range
      })
    } catch (sheetError) {
      // Si hay problemas de conectividad al leer el sheet, retornar error controlado
      if (sheetError.code === 'ENOTFOUND' || sheetError.code === 'ECONNREFUSED' || sheetError.code === 'ETIMEDOUT') {
        // Solo loguear una vez por minuto para evitar spam
        const now = Date.now()
        if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
          console.warn('⚠️ Sin conexión a Google Sheets. Retornando error controlado.')
          lastConnectionErrorLog = now
        }
        return res.status(503).json({ 
          error: 'Sin conexión a internet',
          message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.',
          data: [],
          count: 0
        })
      }
      throw sheetError
    }
    
    const rows = response.data.values || []
    console.log('📋 Filas obtenidas:', rows.length)
    
    if (rows.length === 0) {
      return res.json({ data: [], headers: [], message: 'No hay datos en el sheet' })
    }
    
    // La primera fila contiene los headers
    const headers = rows[0]
    const dataRows = rows.slice(1)
    
    console.log('📊 Headers encontrados:', headers)
    console.log('📋 Filas de datos:', dataRows.length)
    
    // Convertir a objetos y normalizar fechas
    const data = dataRows.map((row, index) => {
      const obj = {}
      headers.forEach((header, headerIndex) => {
        let value = row[headerIndex] || ''
        
        // Columna Fechas: si ya está en DD/MM/YYYY, conservar. Si no (p. ej. Excel serial), normalizar.
        // normalizeDateToDDMMYYYY usa new Date() y rompe DD/MM/YYYY (p. ej. "22/01/2026" → Invalid Date → '').
        if (header === 'Fechas' && value) {
          const s = String(value).trim()
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
            value = s
          } else {
            value = normalizeDateToDDMMYYYY(value) || s
          }
        }
        
        obj[header] = value
      })
      return obj
    }).filter(obj => {
      // Filtrar filas vacías (que no tengan ID)
      const id = obj.ID || obj.id || obj['ID']
      return id && id.toString().trim() !== ''
    })
    
    console.log('✅ Datos procesados:', data.length, 'registros válidos')
    res.json({ 
      data, 
      headers, 
      count: data.length,
      message: `${data.length} registros cargados desde Google Sheets API` 
    })
    
  } catch (error) {
    // Si es un error de conectividad, retornar error controlado
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      // Solo loguear una vez por minuto para evitar spam
      const now = Date.now()
      if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
        console.warn('⚠️ Error de conectividad leyendo datos del Google Sheet.')
        lastConnectionErrorLog = now
      }
      return res.status(503).json({ 
        error: 'Sin conexión a internet',
        message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.',
        data: [],
        count: 0
      })
    }
    
    console.error('❌ Error leyendo datos del Google Sheet:', error.message || error)
    res.status(500).json({ 
      error: 'Error leyendo datos del Google Sheet', 
      details: error.message,
      data: [],
      count: 0
    })
  }
})

// Endpoint para actualizar el estado de un pedido
/**
 * DEPRECATED: Este endpoint se mantiene por compatibilidad pero ya no debería usarse
 * Usar PUT /api/orders/:id en su lugar
 * TODO: Eliminar después de verificar que no hay código que lo use
 */
app.put('/api/update-order-status', async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/update-order-status - Usar PUT /api/orders/:id en su lugar')
  
  try {
    const { orderId, newStatus, additionalData = {} } = req.body
    
    console.log(`🔄 Actualizando estado del pedido #${orderId} a ${newStatus}`)
    console.log('📊 Datos adicionales:', additionalData)
    
    if (!orderId || !newStatus) {
      return res.status(400).json({ 
        error: 'orderId y newStatus son requeridos' 
      })
    }
    
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' })
    }
    
    let auth;
    try {
      auth = await getAuthClient()
      await auth.authorize()
    } catch (authError) {
      // Si hay problemas de conectividad, retornar error controlado
      if (authError.code === 'ENOTFOUND' || authError.code === 'ECONNREFUSED' || authError.code === 'ETIMEDOUT') {
        const now = Date.now()
        if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
          console.warn('⚠️ Sin conexión a internet. No se puede actualizar el pedido.')
          lastConnectionErrorLog = now
        }
        return res.status(503).json({ 
          error: 'Sin conexión a internet',
          message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.',
          success: false
        })
      }
      throw authError
    }
    
    const sheets = google.sheets({ version: 'v4', auth })
    const quoted = quoteSheet(SHEET_NAME)
    
    // Leer el Google Sheet - leer más columnas para incluir "Tiempo de espera"
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${quoted}!A:AE`, // Todas las columnas hasta AE (31 columnas)
      })
    } catch (sheetError) {
      // Si hay problemas de conectividad al leer el sheet, retornar error controlado
      if (sheetError.code === 'ENOTFOUND' || sheetError.code === 'ECONNREFUSED' || sheetError.code === 'ETIMEDOUT') {
        const now = Date.now()
        if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
          console.warn('⚠️ Sin conexión a Google Sheets. No se puede actualizar el pedido.')
          lastConnectionErrorLog = now
        }
        return res.status(503).json({ 
          error: 'Sin conexión a internet',
          message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.',
          success: false
        })
      }
      throw sheetError
    }
    
    const rows = response.data.values || []
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron datos en el sheet' })
    }
    
    const headers = rows[0]
    const dataRows = rows.slice(1)
    
    // Buscar el pedido por ID (asumiendo que el ID está en la columna A)
    const orderIndex = dataRows.findIndex(row => row[0] === orderId.toString())
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: `Pedido #${orderId} no encontrado` })
    }
    
    // Encontrar la columna de Estado (buscar por nombre)
    const estadoColumnIndex = headers.findIndex(header => 
      header && header.toLowerCase().includes('estado')
    )
    
    if (estadoColumnIndex === -1) {
      return res.status(500).json({ error: 'Columna Estado no encontrada en el sheet' })
    }
    
    // Actualizar el estado
    const rowIndex = orderIndex + 2 // +2 porque empezamos desde la fila 2 (después del header)
    dataRows[orderIndex][estadoColumnIndex] = newStatus
    
    // Actualizar todos los datos adicionales si se proporcionan
    // Mapeo de campos del frontend a nombres de columnas del sheet
    const fieldMapping = {
      'operador': 'Operador',
      'cliente': 'Cliente', 
      'recojo': 'Recojo',
      'entrega': 'Entrega',
      'direccion_recojo': 'Direccion Recojo',
      'direccion_entrega': 'Direccion Entrega',
      'info_direccion_recojo': 'Info. Adicional Recojo',
      'info_direccion_entrega': 'Info. Adicional Entrega',
      'detalles_carrera': 'Detalles de la Carrera',
      'distancia': 'Dist. [Km]',
      'medio_transporte': 'Medio Transporte',
      'precio': 'Precio [Bs]',
      'metodo_pago': 'Método pago pago',
      'estado_pago': 'Estado de pago',
      'biker': 'Biker',
      'whatsapp': 'WhatsApp',
      'fecha': 'Fechas',
      'hora_ini': 'Hora Ini',
      'hora_fin': 'Hora Fin',
      'duracion': 'Duracion',
      'tiempo_espera': 'Tiempo de espera',
      'observaciones': 'Observaciones',
      'pago_biker': 'Pago biker',
      'dia_semana': 'Dia de la semana',
      'cobro_pago': 'Cobro o pago',
      'monto_cobro_pago': 'Monto cobro o pago',
      'descripcion_cobro_pago': 'Descripcion de cobro o pago'
    }
    
    // Actualizar cada campo que esté presente en additionalData
    console.log('🔍 Headers disponibles en el sheet:', headers.map((h, i) => `${i}: "${h || '(vacío)'}"`).join(', '))
    console.log('🔍 Datos en additionalData:', Object.keys(additionalData).map(k => `${k}: ${additionalData[k]}`).join(', '))
    
    for (const [fieldName, columnName] of Object.entries(fieldMapping)) {
      // Campos que siempre deben actualizarse, incluso si están vacíos (para permitir borrarlos o actualizarlos)
      const alwaysUpdateFields = ['info_direccion_recojo', 'info_direccion_entrega', 'tiempo_espera', 'observaciones', 'descripcion_cobro_pago']
      const shouldUpdate = alwaysUpdateFields.includes(fieldName) 
        ? (additionalData[fieldName] !== undefined && additionalData[fieldName] !== null)
        : (additionalData[fieldName] !== undefined && additionalData[fieldName] !== null && additionalData[fieldName] !== '')
      
      if (shouldUpdate) {
        // Buscar la columna de forma más flexible
        let columnIndex = headers.findIndex(header => 
          header && header.toLowerCase().trim() === columnName.toLowerCase().trim()
        )
        
        // Si no se encuentra, intentar búsqueda más flexible (sin acentos, espacios múltiples, etc.)
        if (columnIndex === -1) {
          const normalizedColumnName = columnName.toLowerCase().trim().replace(/\s+/g, ' ')
          columnIndex = headers.findIndex(header => {
            if (!header) return false
            const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, ' ')
            return normalizedHeader === normalizedColumnName
          })
        }
        
        if (columnIndex !== -1) {
          // Asegurar que el array tenga suficiente longitud
          while (dataRows[orderIndex].length <= columnIndex) {
            dataRows[orderIndex].push('')
          }
          
          // Normalizar fechas a formato DD/MM/YYYY y forzar como texto
          let valueToSet = additionalData[fieldName]
          if (fieldName === 'fecha' && valueToSet) {
            valueToSet = normalizeDateToDDMMYYYY(valueToSet)
            // Forzar como texto con comilla simple para evitar que Google Sheets lo convierta a número serial
            if (valueToSet) {
              valueToSet = `'${valueToSet}`
            }
            console.log(`  📅 Fecha normalizada en actualización: "${additionalData[fieldName]}" -> "${valueToSet}"`)
          }
          
          dataRows[orderIndex][columnIndex] = valueToSet
          console.log(`✅ Actualizado ${columnName} (columna ${columnIndex}, header: "${headers[columnIndex]}"): ${valueToSet}`)
        } else {
          console.log(`⚠️ Columna "${columnName}" no encontrada en el sheet`)
          // Buscar columnas similares
          const similarHeaders = headers.map((h, i) => ({ index: i, name: h })).filter(({ name }) => 
            name && name.toLowerCase().includes(columnName.split(' ')[0].toLowerCase())
          )
          if (similarHeaders.length > 0) {
            console.log(`   Columnas similares encontradas:`, similarHeaders)
          }
        }
      } else {
        // Log detallado solo para campos que no se actualizan
        if (['tiempo_espera', 'observaciones'].includes(fieldName)) {
          console.log(`   ℹ️ Campo ${fieldName} no se actualiza. Valor: "${additionalData[fieldName]}" (está en alwaysUpdateFields pero es ${additionalData[fieldName] === undefined ? 'undefined' : additionalData[fieldName] === null ? 'null' : 'vacío/presente'})`)
        }
      }
    }
    
    // Función para convertir número a notación de columna de Excel (A, B, ..., Z, AA, AB, etc.)
    const numberToColumn = (num) => {
      let result = ''
      while (num > 0) {
        num--
        result = String.fromCharCode(65 + (num % 26)) + result
        num = Math.floor(num / 26)
      }
      return result
    }
    
    // Actualizar el Google Sheet - usar todas las columnas disponibles
    const lastColumn = numberToColumn(headers.length) // Calcular última columna basada en headers
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A${rowIndex}:${lastColumn}${rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [dataRows[orderIndex]]
      }
    })
    
    console.log(`✅ Pedido #${orderId} actualizado exitosamente en Google Sheet`)
    
    res.json({ 
      success: true, 
      message: `Pedido #${orderId} actualizado a ${newStatus}`,
      updatedCells: updateResponse.data.updatedCells
    })
    
  } catch (error) {
    // Si es un error de conectividad, retornar error controlado
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const now = Date.now()
      if (now - lastConnectionErrorLog > CONNECTION_ERROR_LOG_INTERVAL) {
        console.warn('⚠️ Error de conectividad actualizando estado del pedido.')
        lastConnectionErrorLog = now
      }
      return res.status(503).json({ 
        error: 'Sin conexión a internet',
        message: 'No se puede conectar a Google Sheets. Verifica tu conexión a internet.',
        success: false
      })
    }
    
    console.error('❌ Error actualizando estado del pedido:', error.message || error)
    res.status(500).json({ 
      error: 'Error actualizando estado del pedido', 
      details: error.message,
      success: false
    })
  }
})

// Endpoint para agregar empresas
app.post('/api/empresas', async (req, res) => {
  try {
    const empresa = req.body || {}
    console.log('📥 Datos de empresa recibidos:', JSON.stringify(empresa, null, 2))
    
    // ID del Google Sheet de clientes (donde están las empresas)
    const EMPRESAS_SHEET_ID = '1AAGin-qSutQN42SlRaIbcooec7iKBn_l1QblROrI0Ok'
    
    if (!EMPRESAS_SHEET_ID) {
      return res.status(400).json({ error: 'EMPRESAS_SHEET_ID no configurado' })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Usar la hoja "Clientes" según el sheet compartido
    const empresasSheetName = 'Clientes'
    const quoted = quoteSheet(empresasSheetName)
    
    console.log('🔍 Usando Google Sheet de empresas:', EMPRESAS_SHEET_ID)
    console.log('🔍 Nombre de la hoja:', empresasSheetName)
    
    // Asegurar que la hoja existe
    await ensureSheetExists(sheets, EMPRESAS_SHEET_ID, empresasSheetName)
    
    // Preparar los datos para la fila en el orden: Fecha, Operador, Empresa, Mapa, Descripción
    const row = [
      empresa.Fecha || '',
      empresa.Operador || '',
      empresa.Empresa || '',
      empresa.Mapa || '',
      empresa.Descripción || ''
    ]
    
    console.log('📊 Fila de empresa para el sheet:', row)
    
    // Agregar nueva fila (columnas A a E: Fecha, Operador, Empresa, Mapa, Descripción)
    await sheets.spreadsheets.values.append({
      spreadsheetId: EMPRESAS_SHEET_ID,
      range: `${quoted}!A:E`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    })
    
    console.log(`✅ Empresa "${empresa.Empresa}" agregada exitosamente al Google Sheet de empresas`)
    res.json({ ok: true, message: `Empresa "${empresa.Empresa}" agregada exitosamente` })
    
  } catch (err) {
    console.error('❌ Error en /api/empresas:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

// Endpoint para agregar bikers
app.post('/api/bikers', async (req, res) => {
  try {
    const biker = req.body || {}
    console.log('📥 Datos de biker recibidos:', JSON.stringify(biker, null, 2))
    
    // ID del Google Sheet de bikers (extraído de la URL)
    const BIKERS_SHEET_ID = '1BM7sjDPYWYTKh93vRPkkUMZYn7g38R5IG3aJgXPc4pY'
    
    if (!BIKERS_SHEET_ID) {
      return res.status(400).json({ error: 'BIKERS_SHEET_ID no configurado' })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Usar la hoja de bikers (gid=0)
    const bikersSheetName = 'Bikers'
    const quoted = quoteSheet(bikersSheetName)
    
    console.log('🔍 Usando Google Sheet de bikers:', BIKERS_SHEET_ID)
    console.log('🔍 Nombre de la hoja:', bikersSheetName)
    
    // Asegurar que la hoja existe
    await ensureSheetExists(sheets, BIKERS_SHEET_ID, bikersSheetName)
    
    // Preparar los datos para la fila
    const row = [
      biker.Biker || '',
      biker.Whatsapp || ''
    ]
    
    console.log('📊 Fila de biker para el sheet:', row)
    
    // Agregar nueva fila
    await sheets.spreadsheets.values.append({
      spreadsheetId: BIKERS_SHEET_ID,
      range: `${quoted}!A:B`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    })
    
    console.log(`✅ Biker "${biker.Biker}" agregado exitosamente al Google Sheet de bikers`)
    res.json({ ok: true, message: `Biker "${biker.Biker}" agregado exitosamente` })
    
  } catch (err) {
    console.error('❌ Error en /api/bikers:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

// ==================== ENDPOINT PARA GENERAR SHEET DE EMPRESAS ====================

// Endpoint para generar el sheet de empresas en la pestaña "Plantilla Empresas"
app.post('/api/empresas/generar-sheet', async (req, res) => {
  try {
    const { empresasData } = req.body || {}
    console.log('📥 Datos de empresas recibidos para generar sheet:', empresasData?.length || 0, 'empresas')
    
    if (!SHEET_ID) {
      return res.status(400).json({ 
        success: false,
        error: 'SHEET_ID no configurado' 
      })
    }
    
    if (!empresasData || !Array.isArray(empresasData) || empresasData.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No hay datos de empresas para generar' 
      })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const plantillaSheetName = 'Plantilla Empresas'
    const quoted = quoteSheet(plantillaSheetName)
    
    // Asegurar que la hoja existe
    await ensureSheetExists(sheets, SHEET_ID, plantillaSheetName)
    
    // Preparar los datos: encabezado + filas de datos
    const header = ['ID', 'Fecha', 'Recojo', 'Entrega', 'Tiempo de Espera', 'Precio Carrera', 'Cobro o pago', 'Descripcion c/p', 'Monto c/p']
    const rows = [header]
    let totalPrecioCarreras = 0
    let totalCobros = 0
    let totalPagos = 0
    let descuentoPorcentaje = 0
    
    // Procesar cada empresa y sus pedidos
    empresasData.forEach(cliente => {
      // Obtener el descuento de la empresa (si viene en los datos)
      const descuentoEmpresa = cliente.descuento || 0
      if (descuentoEmpresa > 0 && descuentoPorcentaje === 0) {
        descuentoPorcentaje = descuentoEmpresa
      }
      
      cliente.pedidos.forEach(pedido => {
        let recojo = (pedido.recojo || pedido['Recojo'] || 'N/A').toString().trim()
        let entrega = (pedido.entrega || pedido['Entrega'] || 'N/A').toString().trim()
        const direccionRecojo = (pedido.direccion_recojo || pedido['Direccion Recojo'] || '').toString().trim()
        const direccionEntrega = (pedido.direccion_entrega || pedido['Direccion Entrega'] || '').toString().trim()
        
        // Si recojo es "Sin especificar", usar la dirección de Maps
        if (recojo.toLowerCase() === 'sin especificar' && direccionRecojo) {
          recojo = direccionRecojo
        }
        
        // Si entrega es "Sin especificar", usar la dirección de Maps
        if (entrega.toLowerCase() === 'sin especificar' && direccionEntrega) {
          entrega = direccionEntrega
        }
        
        const precioCarrera = parseFloat(pedido.precio_bs || pedido['Precio [Bs]'] || 0)
        const tiempoEspera = pedido['Tiempo de espera'] || pedido['Tiempo de Espera'] || pedido.tiempo_espera || ''
        const fecha = pedido.fecha || pedido['Fecha Registro'] || pedido['Fechas'] || 'N/A'
        const cobroPago = pedido.cobro_pago || pedido['Cobro o pago'] || ''
        const descripcionCobroPago = pedido.descripcion_cobro_pago || pedido['Descripcion de cobro o pago'] || ''
        const montoCobroPago = parseFloat(pedido.monto_cobro_pago || pedido['Monto cobro o pago'] || 0)
        
        totalPrecioCarreras += precioCarrera
        
        // Separar cobros y pagos para subtotales detallados
        if (montoCobroPago > 0) {
          if (cobroPago === 'Cobro') {
            totalCobros += montoCobroPago
          } else if (cobroPago === 'Pago') {
            totalPagos += montoCobroPago
          }
        }
        
        rows.push([
          pedido.id || '',
          fecha,
          recojo,
          entrega,
          tiempoEspera,
          precioCarrera,
          cobroPago,
          descripcionCobroPago,
          montoCobroPago || ''
        ])
      })
    })
    
    // SUBTOTALES DETALLADOS
    
    // 1. Total Carreras
    rows.push([
      '', // ID
      '', // Fecha
      '', // Recojo
      'TOTAL CARRERAS', // Entrega (columna D)
      '', // Tiempo de Espera
      totalPrecioCarreras, // Precio Carrera (columna F)
      '', // Cobro o pago
      '', // Descripcion c/p
      '' // Monto c/p
    ])
    
    // 2. Descuento si aplica
    let totalCarrerasConDescuento = totalPrecioCarreras
    if (descuentoPorcentaje > 0) {
      const montoDescuento = (totalPrecioCarreras * descuentoPorcentaje) / 100
      totalCarrerasConDescuento = totalPrecioCarreras - montoDescuento
      
      rows.push([
        '', // ID
        '', // Fecha
        '', // Recojo
        `− DESCUENTO ${descuentoPorcentaje}%`, // Entrega (columna D)
        '', // Tiempo de Espera
        montoDescuento, // Precio Carrera (columna F)
        '', // Cobro o pago
        '', // Descripcion c/p
        '' // Monto c/p
      ])
      
      // 3. Subtotal Carreras
      rows.push([
        '', // ID
        '', // Fecha
        '', // Recojo
        'SUBTOTAL CARRERAS', // Entrega (columna D)
        '', // Tiempo de Espera
        totalCarrerasConDescuento, // Precio Carrera (columna F)
        '', // Cobro o pago
        '', // Descripcion c/p
        '' // Monto c/p
      ])
    }
    
    // 4. Cobros adicionales (si hay)
    if (totalCobros > 0) {
      rows.push([
        '', // ID
        '', // Fecha
        '', // Recojo
        'TOTAL COBROS (+)', // Entrega (columna D)
        '', // Tiempo de Espera
        '', // Precio Carrera
        '', // Cobro o pago
        '', // Descripcion c/p
        totalCobros // Monto c/p (columna I)
      ])
    }
    
    // 5. Pagos (si hay)
    if (totalPagos > 0) {
      rows.push([
        '', // ID
        '', // Fecha
        '', // Recojo
        'TOTAL PAGOS (-)', // Entrega (columna D)
        '', // Tiempo de Espera
        '', // Precio Carrera
        '', // Cobro o pago
        '', // Descripcion c/p
        totalPagos // Monto c/p (columna I)
      ])
    }
    
    // 6. CUENTA TOTAL FINAL
    const cuentaTotal = totalCarrerasConDescuento + totalCobros - totalPagos
    rows.push([
      '', // ID
      '', // Fecha
      '', // Recojo
      'CUENTA TOTAL', // Entrega (columna D)
      '', // Tiempo de Espera
      '', // Precio Carrera
      '', // Cobro o pago
      '', // Descripcion c/p
      cuentaTotal // Monto c/p (columna I)
    ])
    
    // Calcular número de filas de resumen
    let filasResumen = 2 // TOTAL CARRERAS + CUENTA TOTAL (siempre presentes)
    if (descuentoPorcentaje > 0) filasResumen += 2 // + DESCUENTO + SUBTOTAL CARRERAS
    if (totalCobros > 0) filasResumen += 1 // + COBROS ADICIONALES
    if (totalPagos > 0) filasResumen += 1 // + PAGOS
    
    const filasDatos = rows.length - 1 - filasResumen // Excluyendo header y filas de resumen
    console.log(`📊 Preparando ${filasDatos} filas de datos + ${filasResumen} fila(s) de resumen para escribir en "${plantillaSheetName}"`)
    
    // Limpiar todo el contenido de la hoja primero
    console.log(`🧹 Limpiando contenido anterior de "${plantillaSheetName}"...`)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A:Z` // Limpiar desde A hasta Z para asegurar que se elimine todo
    })
    console.log(`✅ Hoja "${plantillaSheetName}" limpiada exitosamente`)
    
    // Escribir los nuevos datos (hasta columna I para incluir Monto c/p)
    const range = `${quoted}!A1:I${rows.length}`
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows
      }
    })
    // Construir mensaje detallado
    let mensajePartes = [`Sheet generado con ${filasDatos} filas`]
    mensajePartes.push(`Carreras: ${totalPrecioCarreras.toFixed(2)} Bs`)
    if (descuentoPorcentaje > 0) {
      const montoDescuento = (totalPrecioCarreras * descuentoPorcentaje) / 100
      mensajePartes.push(`Descuento ${descuentoPorcentaje}%: ${montoDescuento.toFixed(2)} Bs`)
      mensajePartes.push(`Subtotal: ${totalCarrerasConDescuento.toFixed(2)} Bs`)
    }
    if (totalCobros > 0) mensajePartes.push(`Cobros: +${totalCobros.toFixed(2)} Bs`)
    if (totalPagos > 0) mensajePartes.push(`Pagos: -${totalPagos.toFixed(2)} Bs`)
    mensajePartes.push(`Total: ${cuentaTotal.toFixed(2)} Bs`)
    
    const mensaje = mensajePartes.join(' | ')
    
    console.log(`✅ Sheet "${plantillaSheetName}" actualizado exitosamente con ${filasDatos} filas de datos + ${filasResumen} fila(s) de resumen`)
    res.json({ 
      success: true, 
      message: mensaje,
      rowsWritten: filasDatos,
      totalCarreras: totalPrecioCarreras,
      totalCobros: totalCobros,
      totalPagos: totalPagos,
      descuento: descuentoPorcentaje > 0 ? descuentoPorcentaje : null,
      totalCarrerasConDescuento: totalCarrerasConDescuento,
      cuentaTotal: cuentaTotal
    })
    
  } catch (err) {
    console.error('❌ Error en /api/empresas/generar-sheet:', err)
    res.status(500).json({ 
      success: false,
      error: String(err),
      details: err.message 
    })
  }
})

// Endpoint para leer datos del sheet "Plantilla Empresas"
app.get('/api/empresas/leer-sheet', async (req, res) => {
  try {
    console.log('📖 Leyendo datos del sheet "Plantilla Empresas"...')
    
    const { fechaInicio, fechaFin } = req.query
    console.log('📅 Filtros de fecha:', { fechaInicio, fechaFin })
    
    if (!SHEET_ID) {
      return res.status(400).json({ 
        success: false,
        error: 'SHEET_ID no configurado' 
      })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const plantillaSheetName = 'Plantilla Empresas'
    const quoted = quoteSheet(plantillaSheetName)
    
    // Leer todos los datos del sheet
    const range = `${quoted}!A:I` // Columnas A a I (incluye Monto c/p)
    console.log('📊 Leyendo rango:', range)
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range
    })
    
    const rows = response.data.values || []
    console.log('📋 Filas obtenidas:', rows.length)
    
    if (rows.length === 0) {
      return res.json({ 
        success: true,
        data: [], 
        headers: [], 
        message: 'No hay datos en el sheet "Plantilla Empresas"' 
      })
    }
    
    // La primera fila contiene los headers
    const headers = rows[0]
    const dataRows = rows.slice(1)
    
    console.log('📊 Headers encontrados:', headers)
    console.log('📋 Filas de datos:', dataRows.length)
    
    // Convertir a objetos, filtrando filas de totales (que no tienen ID numérico)
    let data = dataRows
      .map((row, index) => {
        const obj = {}
        headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex] || ''
        })
        return obj
      })
      .filter(obj => {
        // Filtrar filas de totales (nuevas y antiguas)
        // Los totales están en la columna "Entrega" (columna D)
        const entrega = (obj['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (obj['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        const esFilaTotal = [
          'TOTAL CARRERAS', 'SUBTOTAL CARRERAS', 'DESCUENTO', 
          'TOTAL COBROS', 'COBROS ADICIONALES', 'COBROS/PAGOS', 
          'TOTAL PAGOS', 'PAGOS', 'CUENTA TOTAL'
        ].some(palabra => texto.includes(palabra))
        
        // Solo incluir si tiene un ID válido (numérico) y no es una fila de total
        const id = obj['ID'] || obj['id'] || ''
        const tieneIdValido = id && !isNaN(parseInt(id)) && parseInt(id) > 0
        
        return tieneIdValido && !esFilaTotal
      })
    
    // Aplicar filtro de fechas si se proporcionan
    if (fechaInicio || fechaFin) {
      const fechaInicioDate = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : null
      const fechaFinDate = fechaFin ? new Date(fechaFin + 'T23:59:59') : null
      
      data = data.filter(obj => {
        const fechaPedido = obj['Fecha'] || ''
        if (!fechaPedido) return false
        
        // Convertir fecha del pedido a formato comparable
        let fechaPedidoDate = null
        try {
          // Intentar parsear diferentes formatos
          if (fechaPedido.includes('/')) {
            const [day, month, year] = fechaPedido.split('/')
            fechaPedidoDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          } else if (fechaPedido.includes('-')) {
            fechaPedidoDate = new Date(fechaPedido)
          } else {
            fechaPedidoDate = new Date(fechaPedido)
          }
        } catch (e) {
          return false
        }
        
        if (isNaN(fechaPedidoDate.getTime())) return false
        
        // Comparar con rango de fechas
        if (fechaInicioDate && fechaFinDate) {
          return fechaPedidoDate >= fechaInicioDate && fechaPedidoDate <= fechaFinDate
        } else if (fechaInicioDate) {
          return fechaPedidoDate >= fechaInicioDate
        } else if (fechaFinDate) {
          return fechaPedidoDate <= fechaFinDate
        }
        
        return true
      })
      
      console.log('📅 Filas después de filtrar por fecha:', data.length)
    }
    
    // Extraer filas de totales por separado
    // Los totales están en la columna "Entrega" (columna D, índice 3)
    const filasTotales = dataRows
      .map((row, index) => {
        const obj = {}
        headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex] || ''
        })
        return obj
      })
      .filter(obj => {
        // Buscar en la columna "Entrega" (donde están los textos de totales)
        const entrega = (obj['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (obj['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        
        // Verificar si contiene alguna de las palabras clave de totales
        return ['TOTAL', 'DESCUENTO', 'COBROS/PAGOS', 'CUENTA TOTAL'].some(
          palabra => texto.includes(palabra)
        )
      })
    
    console.log('✅ Datos procesados:', data.length, 'registros válidos')
    console.log('📊 Filas de totales encontradas:', filasTotales.length)
    
    res.json({ 
      success: true,
      data, 
      filasTotales,
      headers, 
      count: data.length,
      message: `${data.length} registros cargados desde "Plantilla Empresas"` 
    })
    
  } catch (error) {
    console.error('❌ Error leyendo sheet "Plantilla Empresas":', error)
    res.status(500).json({ 
      success: false,
      error: 'Error leyendo datos del sheet', 
      details: error.message 
    })
  }
})

// ==================== ENDPOINTS PARA HORARIOS ====================

// Ruta del archivo JSON de horarios (backup local)
const horariosJsonPath = path.join(__dirname, '..', 'data', 'horarios.json')

// Estructura inicial del archivo JSON
const initialHorariosData = {
  drivers: [],
  disponibilidades: {},
  autosAsignados: {},
  asignacionesFinales: {},
  mesActual: new Date().getMonth(),
  añoActual: new Date().getFullYear(),
  lastUpdated: new Date().toISOString()
}

const HORARIOS_DRIVER_TABS = [
  'Paola Aliaga',
  'Patricia',
  'Thiago',
  'Ivan',
  'Marcos',
  'Jose',
  'Abraham',
  'William',
  'Fabricio'
]

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_COLUMN_INDEX = {
  'Lunes': 1,
  'Martes': 2,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5,
  'Sábado': 6,
  'Domingo': 7
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

// Función para buscar o crear el Sheet "Horarios Beezy" en Drive
async function findOrCreateHorariosSheet() {
  try {
    const auth = await getAuthClient()
    await auth.authorize()
    const drive = google.drive({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Si ya tenemos el Sheet ID, verificar que existe
    if (HORARIOS_SHEET_ID) {
      try {
        await sheets.spreadsheets.get({ spreadsheetId: HORARIOS_SHEET_ID })
        console.log('✅ Sheet "Horarios Beezy" encontrado con ID:', HORARIOS_SHEET_ID)
        return HORARIOS_SHEET_ID
      } catch (error) {
        console.log('⚠️ Sheet ID proporcionado no es válido, buscando en Drive...')
      }
    }
    
    // Buscar el Sheet en la carpeta de Drive
    console.log('🔍 Buscando Sheet "Horarios Beezy" en Drive...')
    const response = await drive.files.list({
      q: `name='${HORARIOS_SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and '${HORARIOS_DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    })
    
    if (response.data.files && response.data.files.length > 0) {
      const sheetId = response.data.files[0].id
      console.log('✅ Sheet "Horarios Beezy" encontrado en Drive:', sheetId)
      return sheetId
    }
    
    // Si no existe, crear uno nuevo en la carpeta
    console.log('📝 Creando nuevo Sheet "Horarios Beezy" en Drive...')
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: HORARIOS_SHEET_NAME
        },
        sheets: [{
          properties: {
            title: 'Horarios'
          }
        }]
      }
    })
    
    const newSheetId = createResponse.data.spreadsheetId
    console.log('✅ Sheet "Horarios Beezy" creado:', newSheetId)
    
    // Obtener los padres actuales del Sheet
    const fileMetadata = await drive.files.get({
      fileId: newSheetId,
      fields: 'parents'
    })
    
    const previousParents = fileMetadata.data.parents ? fileMetadata.data.parents.join(',') : ''
    
    // Mover el Sheet a la carpeta de Drive
    await drive.files.update({
      fileId: newSheetId,
      addParents: HORARIOS_DRIVE_FOLDER_ID,
      removeParents: previousParents,
      fields: 'id, parents'
    })
    
    console.log('✅ Sheet movido a la carpeta de Drive')
    
    // Inicializar con datos vacíos en la primera hoja
    await sheets.spreadsheets.values.update({
      spreadsheetId: newSheetId,
      range: 'Horarios!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Datos de Horarios']]
      }
    })
    
    console.log('✅ Sheet inicializado')
    return newSheetId
    
  } catch (error) {
    console.error('❌ Error buscando/creando Sheet de horarios:', error)
    throw error
  }
}

function parseDriverSheet(values, dayLabel, nowMinutes) {
  const info = {
    slotsToday: [],
    workingDays: [],
    autoByDay: {},
    worksToday: false,
    availableNow: false,
    nextSlot: null,
    autoToday: null
  }

  if (!values || !values.length) return info

  const dayColIdx = DAY_COLUMN_INDEX[dayLabel]
  if (dayColIdx == null) return info

  let seenTime = false
  let blankRows = 0

  for (let r = 1; r < values.length; r++) {
    const row = values[r] || []
    const timeRange = (row[0] || '').toString().trim()
    if (!timeRange) {
      if (seenTime) {
        blankRows += 1
        if (blankRows > 5) break
      }
      continue
    }

    seenTime = true
    blankRows = 0
    const marker = (row[dayColIdx] || '').toString().trim().toLowerCase()
    if (marker === 'x' || marker === '✓' || marker === 'si' || marker === 'sí' || marker === '1') {
      info.slotsToday.push(normalizeSlot(timeRange))
    }
  }

  if (info.slotsToday.length) {
    info.worksToday = true
    for (const slot of info.slotsToday) {
      const [startRaw, endRaw] = slot.split('-')
      const start = parseTimeToMinutes(startRaw)
      const end = parseTimeToMinutes(endRaw)
      if (start == null || end == null) continue
      if (nowMinutes >= start && nowMinutes < end) {
        info.availableNow = true
        break
      }
      if (nowMinutes < start && !info.nextSlot) {
        info.nextSlot = slot
      }
    }
  }

  const monthCell = MONTHS_ES.map(name => findCell(values, name)).find(Boolean)
  if (monthCell) {
    const headerRow = values[monthCell.row + 2] || []
    const dataRows = []
    for (let r = monthCell.row + 3; r < values.length; r++) {
      const row = values[r] || []
      if (row[0] && String(row[0]).toLowerCase().includes('auto asignado')) break
      if (row.every(cell => !cell || !String(cell).trim())) break
      dataRows.push(row)
    }

    headerRow.forEach((header, idx) => {
      const dayName = (header || '').toString().trim()
      if (DAY_COLUMN_INDEX[dayName] != null) {
        const hasNumbers = dataRows.some(row => {
          const value = (row[idx] || '').toString().trim()
          return value !== ''
        })
        if (hasNumbers) {
          info.workingDays.push(dayName)
        }
      }
    })
    info.worksToday = info.workingDays.includes(dayLabel)
  }

  const autoCell = findCell(values, 'AUTO ASIGNADO')
  if (autoCell) {
    const headerRow = values[autoCell.row + 1] || []
    const autoRow = values[autoCell.row + 2] || []
    headerRow.forEach((header, idx) => {
      const dayName = (header || '').toString().trim()
      if (DAY_COLUMN_INDEX[dayName] != null) {
        const autoVal = (autoRow[idx] || '').toString().trim()
        if (autoVal) {
          info.autoByDay[dayName] = autoVal
        }
      }
    })
    info.autoToday = info.autoByDay[dayLabel] || null
  }

  return info
}

function parseBikerSheet(values, dayLabel, nowMinutes) {
  // Los bikers usan la misma estructura que los drivers
  return parseDriverSheet(values, dayLabel, nowMinutes)
}

// Función para guardar horarios en Google Sheets
async function saveHorariosToSheet(horariosData) {
  try {
    const sheetId = await findOrCreateHorariosSheet()
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Convertir el objeto JSON a una cadena y guardarlo en una celda
    const jsonString = JSON.stringify(horariosData, null, 2)
    
    // Guardar en la celda A1 (como texto JSON)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Horarios!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[jsonString]]
      }
    })
    
    console.log('✅ Datos de horarios guardados en Google Sheets')
    return sheetId
    
  } catch (error) {
    console.error('❌ Error guardando horarios en Google Sheets:', error)
    throw error
  }
}

// Función para cargar horarios desde Google Sheets
async function loadHorariosFromSheet() {
  try {
    const sheetId = await findOrCreateHorariosSheet()
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Leer desde la celda A1
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Horarios!A1'
    })
    
    const values = response.data.values
    if (!values || !values[0] || !values[0][0]) {
      console.log('⚠️ No hay datos en Google Sheets, usando datos iniciales')
      return initialHorariosData
    }
    
    const jsonString = values[0][0]
    const horariosData = JSON.parse(jsonString)
    
    console.log('✅ Datos de horarios cargados desde Google Sheets')
    return horariosData
    
  } catch (error) {
    console.error('❌ Error cargando horarios desde Google Sheets:', error)
    // Si hay error, intentar cargar desde backup local
    if (fs.existsSync(horariosJsonPath)) {
      console.log('📥 Intentando cargar desde backup local...')
      const data = fs.readFileSync(horariosJsonPath, 'utf8')
      return JSON.parse(data)
    }
    throw error
  }
}

// Directorio data no es necesario en producción (Elastic Beanstalk)
// const dataDir = path.join(__dirname, '..', 'data')
// if (!fs.existsSync(dataDir)) {
//   fs.mkdirSync(dataDir, { recursive: true })
//   console.log('📁 Directorio data creado')
// }

// GET: Leer datos de horarios desde Google Sheets
app.get('/api/horarios', async (req, res) => {
  try {
    console.log('📖 Leyendo datos de horarios desde Google Sheets...')
    
    // Cargar desde Google Sheets
    const horarios = await loadHorariosFromSheet()
    
    console.log('✅ Datos de horarios cargados:', {
      drivers: horarios.drivers?.length || 0,
      mesActual: horarios.mesActual,
      añoActual: horarios.añoActual,
      lastUpdated: horarios.lastUpdated
    })
    
    // También guardar backup local
    fs.writeFileSync(horariosJsonPath, JSON.stringify(horarios, null, 2), 'utf8')
    console.log('💾 Backup local guardado')
    
    res.json({
      success: true,
      data: horarios,
      message: 'Datos de horarios cargados exitosamente desde Google Sheets'
    })
    
  } catch (error) {
    console.error('❌ Error leyendo datos de horarios:', error)
    
    // Si falla Google Sheets, intentar cargar desde backup local
    if (fs.existsSync(horariosJsonPath)) {
      console.log('📥 Intentando cargar desde backup local...')
      try {
        const data = fs.readFileSync(horariosJsonPath, 'utf8')
        const horarios = JSON.parse(data)
        res.json({
          success: true,
          data: horarios,
          message: 'Datos de horarios cargados desde backup local'
        })
        return
      } catch (localError) {
        console.error('❌ Error leyendo backup local:', localError)
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Error leyendo datos de horarios',
      details: error.message
    })
  }
})

// POST: Guardar datos de horarios en Google Sheets
app.post('/api/horarios', async (req, res) => {
  try {
    const horarios = req.body
    
    console.log('💾 Guardando datos de horarios en Google Sheets...')
    console.log('📊 Resumen:', {
      drivers: horarios.drivers?.length || 0,
      mesActual: horarios.mesActual,
      añoActual: horarios.añoActual
    })
    
    // Validar que tengamos datos
    if (!horarios || typeof horarios !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Datos de horarios inválidos'
      })
    }
    
    // Agregar timestamp de última actualización
    horarios.lastUpdated = new Date().toISOString()
    
    // Crear backup local del archivo anterior si existe
    if (fs.existsSync(horariosJsonPath)) {
      const backupPath = path.join(__dirname, '..', 'data', `horarios.backup.${Date.now()}.json`)
      fs.copyFileSync(horariosJsonPath, backupPath)
      console.log(`📦 Backup local creado: ${backupPath}`)
      
      // Mantener solo los últimos 5 backups
      const backupFiles = fs.readdirSync(path.join(__dirname, '..', 'data'))
        .filter(f => f.startsWith('horarios.backup.'))
        .sort()
        .reverse()
      
      if (backupFiles.length > 5) {
        backupFiles.slice(5).forEach(f => {
          fs.unlinkSync(path.join(__dirname, '..', 'data', f))
          console.log(`🗑️ Backup antiguo eliminado: ${f}`)
        })
      }
    }
    
    // Guardar en Google Sheets (fuente principal)
    try {
      await saveHorariosToSheet(horarios)
      console.log('✅ Datos de horarios guardados en Google Sheets')
    } catch (sheetError) {
      console.error('❌ Error guardando en Google Sheets:', sheetError)
      // Continuar para guardar backup local como respaldo
    }
    
    // También guardar backup local
    fs.writeFileSync(horariosJsonPath, JSON.stringify(horarios, null, 2), 'utf8')
    console.log('💾 Backup local guardado')
    
    res.json({
      success: true,
      message: 'Datos de horarios guardados exitosamente en Google Sheets',
      timestamp: horarios.lastUpdated
    })
    
  } catch (error) {
    console.error('❌ Error guardando datos de horarios:', error)
    res.status(500).json({
      success: false,
      error: 'Error guardando datos de horarios',
      details: error.message
    })
  }
})

app.get('/api/horarios/disponibilidad-hoy', async (req, res) => {
  try {
    const tipo = req.query.tipo || 'drivers' // 'drivers' o 'bikers'
    
    const sheetId = tipo === 'bikers' ? HORARIOS_BIKERS_SHEET_ID : HORARIOS_SHEET_ID
    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: tipo === 'bikers' ? 'HORARIOS_BIKERS_SHEET_ID no configurado' : 'HORARIOS_SHEET_ID no configurado'
      })
    }

    const auth = await getAuthClient()
    await auth.authorize()
    const sheetsApi = google.sheets({ version: 'v4', auth })

    const now = getBoliviaNow()
    const dayLabel = DAY_LABELS[now.getDay()]
    const nowMinutes = (now.getHours() * 60) + now.getMinutes()

    // Obtener lista de tabs del sheet
    let tabs = []
    if (tipo === 'drivers') {
      tabs = HORARIOS_DRIVER_TABS
    } else {
      // Para bikers, obtener los tabs dinámicamente del sheet
      try {
        const spreadsheet = await sheetsApi.spreadsheets.get({
          spreadsheetId: sheetId
        })
        tabs = (spreadsheet.data.sheets || [])
          .map(sheet => sheet.properties?.title)
          .filter(title => title && !title.toLowerCase().includes('copia'))
      } catch (err) {
        console.error('❌ Error obteniendo tabs del sheet de bikers:', err.message)
        return res.status(500).json({
          success: false,
          error: 'Error obteniendo lista de bikers',
          details: err.message
        })
      }
    }

    const peopleData = []
    for (const tabName of tabs) {
      const range = `${quoteSheet(tabName)}!A1:Z80`
      try {
        const resp = await sheetsApi.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range
        })
        const values = resp.data.values || []
        const parsed = tipo === 'bikers' 
          ? parseBikerSheet(values, dayLabel, nowMinutes)
          : parseDriverSheet(values, dayLabel, nowMinutes)
        peopleData.push({
          driver: tabName,
          ...parsed
        })
      } catch (err) {
        console.error(`❌ Error leyendo hoja de ${tabName}:`, err.message)
      }
    }

    res.json({
      success: true,
      tipo,
      label: tipo === 'bikers' ? 'Bikers' : 'Drivers',
      day: dayLabel,
      date: now.toISOString(),
      drivers: peopleData
    })
  } catch (error) {
    console.error('❌ Error en /api/horarios/disponibilidad-hoy:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo disponibilidad de hoy',
      details: error.message
    })
  }
})

// GET: Descargar archivo JSON completo
app.get('/api/horarios/download', (req, res) => {
  try {
    console.log('📥 Descargando archivo horarios.json...')
    
    if (!fs.existsSync(horariosJsonPath)) {
      return res.status(404).json({
        success: false,
        error: 'Archivo horarios.json no encontrado'
      })
    }
    
    res.download(horariosJsonPath, 'horarios.json', (err) => {
      if (err) {
        console.error('❌ Error descargando archivo:', err)
        res.status(500).json({
          success: false,
          error: 'Error descargando archivo'
        })
      }
    })
    
  } catch (error) {
    console.error('❌ Error en descarga:', error)
    res.status(500).json({
      success: false,
      error: 'Error en descarga',
      details: error.message
    })
  }
})

// PUT: Restaurar desde un archivo JSON cargado
app.put('/api/horarios/restore', (req, res) => {
  try {
    const horarios = req.body
    
    console.log('🔄 Restaurando datos de horarios desde JSON cargado...')
    
    // Validar que tengamos datos
    if (!horarios || typeof horarios !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Datos de horarios inválidos'
      })
    }
    
    // Crear backup antes de restaurar
    if (fs.existsSync(horariosJsonPath)) {
      const backupPath = path.join(__dirname, '..', 'data', `horarios.before-restore.${Date.now()}.json`)
      fs.copyFileSync(horariosJsonPath, backupPath)
      console.log(`📦 Backup pre-restauración creado: ${backupPath}`)
    }
    
    // Agregar timestamp
    horarios.lastUpdated = new Date().toISOString()
    horarios.restoredAt = new Date().toISOString()
    
    // Guardar el archivo restaurado
    fs.writeFileSync(horariosJsonPath, JSON.stringify(horarios, null, 2), 'utf8')
    
    console.log('✅ Datos restaurados exitosamente')
    
    res.json({
      success: true,
      message: 'Datos restaurados exitosamente',
      timestamp: horarios.lastUpdated
    })
    
  } catch (error) {
    console.error('❌ Error restaurando datos:', error)
    res.status(500).json({
      success: false,
      error: 'Error restaurando datos',
      details: error.message
    })
  }
})

/**
 * ENDPOINTS DE AUDITORÍA
 * Consultar logs de auditoría
 */

// Obtener audit log de un pedido específico
app.get('/api/audit/order/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    if (!orderId) {
      return res.status(400).json({ error: 'ID de pedido requerido' });
    }
    
    const { getAuditLogsForOrder } = await import('./utils/auditLogger.js');
    const logs = getAuditLogsForOrder(orderId);
    
    res.json({
      success: true,
      orderId,
      count: logs.length,
      logs
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo audit logs',
      details: error.message
    });
  }
});

// Obtener estadísticas de auditoría
app.get('/api/audit/stats', async (req, res) => {
  try {
    const { getAuditStats } = await import('./utils/auditLogger.js');
    const stats = getAuditStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

// Listar archivos de audit log
app.get('/api/audit/files', async (req, res) => {
  try {
    const { listAuditLogFiles } = await import('./utils/auditLogger.js');
    const files = listAuditLogFiles();
    
    res.json({
      success: true,
      files
    });
    
  } catch (error) {
    console.error('❌ Error listando archivos:', error);
    res.status(500).json({
      success: false,
      error: 'Error listando archivos',
      details: error.message
    });
  }
});

/**
 * ENDPOINT DE VERIFICACIÓN DE ID
 * Verifica si un ID específico ya existe en el sheet
 */
app.get('/api/verify-id/:id', async (req, res) => {
  try {
    const idToVerify = req.params.id;
    
    if (!idToVerify) {
      return res.status(400).json({ 
        exists: false, 
        error: 'ID no proporcionado' 
      });
    }
    
    console.log('🔍 Verificando si ID existe:', idToVerify);
    
    if (!SHEET_ID) {
      return res.status(400).json({ 
        exists: false, 
        error: 'SHEET_ID no configurado' 
      });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const quoted = quoteSheet(SHEET_NAME);
    
    // Leer TODOS los IDs de la columna A
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A:A`
    });
    
    const rows = response.data.values || [];
    const MAX_VALID_ID = 100000;
    
    // Buscar el ID en todas las filas (saltando el header)
    let exists = false;
    let foundAt = -1;
    
    for (let i = 1; i < rows.length; i++) {
      const cellValue = rows[i] && rows[i][0];
      if (cellValue) {
        const sheetId = String(cellValue).trim();
        if (sheetId === String(idToVerify).trim()) {
          exists = true;
          foundAt = i + 1; // +1 porque sheets empiezan en 1
          break;
        }
      }
    }
    
    if (exists) {
      console.log(`⚠️ ID ${idToVerify} YA EXISTE en fila ${foundAt}`);
      res.json({
        exists: true,
        id: idToVerify,
        foundAt: foundAt,
        message: `El ID ${idToVerify} ya está en uso`
      });
    } else {
      console.log(`✅ ID ${idToVerify} está disponible`);
      res.json({
        exists: false,
        id: idToVerify,
        message: `El ID ${idToVerify} está disponible`
      });
    }
    
  } catch (error) {
    console.error('❌ Error verificando ID:', error);
    res.status(500).json({
      exists: false,
      error: 'Error verificando ID',
      details: error.message
    });
  }
});

// Endpoint para obtener el próximo ID de forma segura
app.get('/api/next-id', async (req, res) => {
  try {
    console.log('🔢 Obteniendo próximo ID...')
    
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    const quoted = quoteSheet(SHEET_NAME)
    
    // Leer solo la columna de IDs
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quoted}!A:A` // Solo columna A (IDs)
    })
    
    const rows = response.data.values || []
    console.log('📊 Filas obtenidas para IDs:', rows.length)
    
    // Extraer IDs numéricos válidos (saltar header)
    // IMPORTANTE: Filtrar IDs que sean timestamps (números muy grandes)
    // Los IDs válidos deben ser < 100000 para evitar problemas con Date.now() fallback
    const MAX_VALID_ID = 100000
    const ids = []
    const invalidIds = [] // Para logging de IDs inválidos
    
    for (let i = 1; i < rows.length; i++) { // Empezar desde fila 2 (saltar header)
      const cellValue = rows[i] && rows[i][0]
      if (cellValue) {
        const numId = parseInt(String(cellValue).trim())
        if (!isNaN(numId) && numId > 0) {
          if (numId < MAX_VALID_ID) {
            ids.push(numId)
          } else {
            invalidIds.push({ row: i + 1, id: numId })
          }
        }
      }
    }
    
    if (invalidIds.length > 0) {
      console.warn('⚠️ IDs inválidos encontrados (probablemente timestamps):', invalidIds.length)
      console.warn('   Primeros 5:', invalidIds.slice(0, 5))
    }
    
    console.log('🔢 IDs válidos encontrados:', ids.length)
    console.log('   IDs válidos (últimos 10):', ids.slice(-10))
    
    // Calcular el próximo ID
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1
    console.log(`➡️ Próximo ID generado: ${nextId}`)
    
    res.json({ 
      success: true, 
      nextId: nextId,
      totalOrders: ids.length,
      maxExistingId: ids.length > 0 ? Math.max(...ids) : 0
    })
    
  } catch (error) {
    console.error('❌ Error obteniendo próximo ID:', error)
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo próximo ID', 
      details: error.message 
    })
  }
})

/**
 * Endpoint para leer pedidos de clientes desde la pestaña 'Clientes'
 */
app.get('/api/read-client-orders', async (req, res) => {
  try {
    console.log('📖 Leyendo pedidos desde pestaña Clientes...')
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const clientesSheetName = 'Clientes'
    const quotedClientes = quoteSheet(clientesSheetName)
    const range = `${quotedClientes}!A:AD`
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range
    })
    
    const rows = response.data.values || []
    console.log('📋 Filas obtenidas de pestaña Clientes:', rows.length)
    
    if (rows.length === 0) {
      return res.json({ data: [], headers: [], message: 'No hay datos en la pestaña Clientes' })
    }
    
    const headers = rows[0]
    const dataRows = rows.slice(1)
    
    const data = dataRows.map(row => {
      const obj = {}
      headers.forEach((header, index) => {
        let value = row[index] || ''
        
        // Convertir números seriales de Excel/Google Sheets a fechas en formato DD/MM/YYYY
        if (header === 'Fechas' && value) {
          value = normalizeDateToDDMMYYYY(value)
        }
        
        obj[header] = value
      })
      return obj
    })
    
    console.log(`✅ ${data.length} pedidos leídos desde pestaña Clientes`)
    
    res.json({
      success: true,
      data: data,
      headers: headers,
      count: data.length
    })
    
  } catch (error) {
    console.error('❌ Error leyendo pedidos de clientes:', error)
    res.status(500).json({
      success: false,
      error: 'Error leyendo pedidos',
      details: error.message
    })
  }
})

/**
 * Endpoint para calcular distancia entre dos direcciones
 * Usa Google Maps Distance Matrix API
 */
app.post('/api/calculate-distance', async (req, res) => {
  try {
    const { origen, destino } = req.body
    
    console.log('🗺️  Calculando distancia:', { origen, destino })
    
    if (!origen || !destino) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren origen y destino'
      })
    }
    
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Google Maps API Key no configurada'
      })
    }
    
    // Agregar ", Bolivia" a las direcciones para mejorar precisión
    const origenCompleto = `${origen}, Bolivia`
    const destinoCompleto = `${destino}, Bolivia`
    
    const routeInfo = await getShortestDrivingRoute({
      origin: origenCompleto,
      destination: destinoCompleto,
      apiKey: GOOGLE_MAPS_API_KEY,
      context: 'cliente-calculate-distance'
    })
    
    const distanceKm = (routeInfo.distanceMeters / 1000).toFixed(2)
    
    console.log(`✅ Distancia calculada (ruta más corta): ${distanceKm} km (${routeInfo.distanceText})`)
    
    res.json({
      success: true,
      distance: distanceKm,
      distanceText: routeInfo.distanceText,
      duration: routeInfo.durationText,
      originAddress: routeInfo.originAddress,
      destinationAddress: routeInfo.destinationAddress,
      source: routeInfo.source
    })
    
  } catch (error) {
    console.error('❌ Error calculando distancia:', error)
    res.status(500).json({
      success: false,
      error: 'Error calculando distancia',
      details: error.message
    })
  }
})

/**
 * Endpoint para obtener la API key de Google Maps (solo para uso en frontend)
 */
app.get('/api/maps/api-key', async (req, res) => {
  try {
    // Devolver la API key para uso en el frontend
    // NOTA: En producción, esto debería estar restringido por dominio
    res.json({
      apiKey: GOOGLE_MAPS_API_KEY || ''
    })
  } catch (error) {
    console.error('❌ Error obteniendo API key:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo API key'
    })
  }
})

/**
 * Endpoint para convertir URLs de Google Maps a coordenadas
 * Recibe un array de URLs y devuelve un array de coordenadas {lat, lng}
 */
app.post('/api/maps/urls-to-coordinates', async (req, res) => {
  try {
    const { urls } = req.body
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de URLs'
      })
    }
    
    console.log(`\n🗺️ Convirtiendo ${urls.length} URLs a coordenadas`)
    
    const coordinates = []
    
    for (const url of urls) {
      if (!url || url.trim() === '' || url === 'Cliente avisa') {
        coordinates.push(null)
        continue
      }
      
      try {
        const coordsStr = await expandUrlAndExtractCoords(url.trim())
        
        // Si es un formato "lat,lng", parsearlo
        if (coordsStr && /^-?\d+\.\d+,-?\d+\.\d+$/.test(coordsStr)) {
          const [lat, lng] = coordsStr.split(',').map(Number)
          coordinates.push({ lat, lng })
        } else {
          // Si no son coordenadas directas, intentar geocoding
          const geocoded = await geocodeLocation(coordsStr || url)
          if (geocoded && /^-?\d+\.\d+,-?\d+\.\d+$/.test(geocoded)) {
            const [lat, lng] = geocoded.split(',').map(Number)
            coordinates.push({ lat, lng })
          } else {
            coordinates.push(null)
          }
        }
      } catch (error) {
        console.error(`❌ Error procesando URL ${url}:`, error.message)
        coordinates.push(null)
      }
    }
    
    const validCoords = coordinates.filter(c => c !== null)
    console.log(`✅ ${validCoords.length}/${urls.length} URLs convertidas exitosamente`)
    
    res.json({
      success: true,
      coordinates
    })
    
  } catch (error) {
    console.error('❌ Error convirtiendo URLs a coordenadas:', error)
    res.status(500).json({
      success: false,
      error: 'Error convirtiendo URLs a coordenadas',
      details: error.message
    })
  }
})

app.post('/api/cliente/cancelar-pedido', async (req, res) => {
  try {
    const { idPedido } = req.body
    
    if (!idPedido) {
      return res.status(400).json({
        success: false,
        error: 'ID de pedido es requerido'
      })
    }
    
    console.log(`\n❌ Cancelando pedido cliente #${idPedido}`)
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const clientesSheetName = 'Clientes'
    const quotedClientes = quoteSheet(clientesSheetName)
    
    // Leer todos los datos de la pestaña Clientes
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quotedClientes}!A:AD`
    })
    
    const rows = sheetResponse.data.values || []
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay datos en la pestaña Clientes'
      })
    }
    
    const headers = rows[0]
    const dataRows = rows.slice(1)
    
    // Buscar las columnas necesarias
    const idColumnIndex = headers.findIndex(h => h === 'ID')
    const estadoPedidoColumnIndex = headers.findIndex(h => h === 'Estado Pedido')
    
    if (idColumnIndex === -1) {
      return res.status(500).json({
        success: false,
        error: 'No se encontró la columna "ID" en la pestaña Clientes'
      })
    }
    
    if (estadoPedidoColumnIndex === -1) {
      return res.status(500).json({
        success: false,
        error: 'No se encontró la columna "Estado Pedido" en la pestaña Clientes'
      })
    }
    
    // Buscar la fila del pedido
    const rowIndex = dataRows.findIndex(row => row[idColumnIndex] === idPedido.toString())
    
    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `No se encontró el pedido con ID ${idPedido}`
      })
    }
    
    // Calcular la fila en el sheet (sumamos 2: 1 por el header + 1 porque los índices empiezan en 1)
    const sheetRowNumber = rowIndex + 2
    
    // Calcular la letra de la columna "Estado Pedido"
    const estadoPedidoColumnLetter = getColumnLetter(estadoPedidoColumnIndex)
    
    // Actualizar el estado a "CANCELADO"
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${quotedClientes}!${estadoPedidoColumnLetter}${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['CANCELADO']]
      }
    })
    
    console.log(`✅ Pedido #${idPedido} cancelado exitosamente`)
    console.log(`   - Fila: ${sheetRowNumber}`)
    console.log(`   - Columna: ${estadoPedidoColumnLetter}`)
    console.log(`   - Estado actualizado a: CANCELADO`)
    
    res.json({
      success: true,
      message: `Pedido #${idPedido} cancelado exitosamente`,
      idPedido
    })
    
  } catch (error) {
    console.error('❌ Error cancelando pedido de cliente:', error)
    res.status(500).json({
      success: false,
      error: 'Error cancelando pedido',
      details: error.message
    })
  }
})

/**
 * Endpoint proxy para servir imágenes de Google Drive
 * Usa las credenciales del service account para acceder a las imágenes
 */
app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' })
    }
    
    console.log(`🖼️ Proxy de imagen solicitada: ${url.substring(0, 100)}...`)
    
    // Si es una URL de Google Drive, extraer el ID
    let driveId = null
    if (url.includes('drive.google.com')) {
      // Extraer ID de diferentes formatos de URL de Drive
      const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (match1) driveId = match1[1]
      
      if (!driveId) {
        const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
        if (match2) driveId = match2[1]
      }
      
      if (!driveId) {
        const match3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
        if (match3) driveId = match3[1]
      }
      
      console.log(`  🔍 ID extraído de Drive: ${driveId}`)
    }
    
    // Si tenemos un ID de Drive, usar Google Drive API
    if (driveId) {
      try {
        const auth = await getAuthClient()
        await auth.authorize()
        const drive = google.drive({ version: 'v3', auth })
        
        console.log(`  🔐 Autenticado con service account, obteniendo archivo ${driveId}...`)
        
        // Primero obtener metadata del archivo para saber el tipo
        const fileMetadata = await drive.files.get({
          fileId: driveId,
          fields: 'mimeType, name'
        })
        
        console.log(`  📄 Archivo encontrado: ${fileMetadata.data.name}, tipo: ${fileMetadata.data.mimeType}`)
        
        // Obtener el contenido del archivo
        const fileResponse = await drive.files.get({
          fileId: driveId,
          alt: 'media'
        }, { responseType: 'stream' })
        
        // Determinar Content-Type basado en el nombre del archivo o mimeType
        let contentType = fileMetadata.data.mimeType || 'image/jpeg'
        
        // Si el mimeType es genérico, intentar detectar por extensión
        if (contentType === 'application/octet-stream' || !contentType.startsWith('image/')) {
          const fileName = fileMetadata.data.name || ''
          if (fileName.endsWith('.webp')) contentType = 'image/webp'
          else if (fileName.endsWith('.png')) contentType = 'image/png'
          else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg'
          else if (fileName.endsWith('.gif')) contentType = 'image/gif'
        }
        
        // Configurar headers para la imagen
        res.setHeader('Content-Type', contentType)
        res.setHeader('Cache-Control', 'public, max-age=3600') // Cache por 1 hora
        res.setHeader('Access-Control-Allow-Origin', '*') // Permitir CORS
        
        console.log(`  ✅ Enviando imagen con Content-Type: ${contentType}`)
        
        // Enviar la imagen
        fileResponse.data.pipe(res)
        
        console.log(`✅ Imagen servida exitosamente desde Drive: ${driveId}`)
        return
        
      } catch (driveError) {
        console.error('❌ Error accediendo a Drive API:', driveError.message)
        console.error('   Stack:', driveError.stack)
        
        // Si falla con Drive API, intentar URL pública como fallback
        const publicUrl = `https://drive.google.com/uc?export=view&id=${driveId}`
        console.log(`  🔄 Intentando URL pública como fallback: ${publicUrl}`)
        
        try {
          const response = await fetch(publicUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg'
            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'public, max-age=3600')
            res.setHeader('Access-Control-Allow-Origin', '*')
            
            const buffer = await response.arrayBuffer()
            res.send(Buffer.from(buffer))
            console.log(`✅ Imagen servida desde URL pública`)
            return
          }
        } catch (fallbackError) {
          console.error('❌ Error en fallback:', fallbackError.message)
        }
        
        return res.status(500).json({ 
          error: 'Error obteniendo imagen de Drive', 
          details: driveError.message 
        })
      }
    }
    
    // Si no es Drive, hacer fetch directo
    console.log(`  🔄 Intentando fetch directo de URL: ${url.substring(0, 80)}...`)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    
    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
    
    console.log(`✅ Imagen proxy servida desde URL directa`)
    
  } catch (error) {
    console.error('❌ Error en proxy de imagen:', error)
    res.status(500).json({ error: 'Error obteniendo imagen', details: error.message })
  }
})

// ========================================
// FUNCIÓN AUXILIAR: Registrar cambios en historial
// ========================================
async function registrarEnHistorial(datosProducto, sheets) {
  try {
    console.log('📝 Registrando cambio en historial:', datosProducto)
    
    if (!HISTORIAL_SHEET_ID) {
      console.warn('⚠️ HISTORIAL_SHEET_ID no configurado, omitiendo registro en historial')
      return
    }
    
    const quotedHistorial = quoteSheet(HISTORIAL_SHEET_NAME)
    
    // Leer headers del historial
    const headersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: HISTORIAL_SHEET_ID,
      range: `${quotedHistorial}!A1:AA1`
    })
    
    const headers = headersResponse.data.values?.[0] || []
    
    // Obtener fecha y hora actual en formato boliviano (GMT-4)
    const ahora = getBoliviaNow()
    const fecha = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()}`
    const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`
    
    // Si no hay headers, crear los headers por defecto según el formato del sheet
    // Columnas: Fecha, Hora, Empresa, Código, Producto, Categoría, Foto, Entradas, Salidas, Stock pasado, Stock actual, Stock mínimo, Estado, url_imagen
    if (headers.length === 0) {
      const defaultHeaders = [
        'Fecha', 'Hora', 'Empresa', 'Código', 'Producto', 'Categoría', 'Foto', 
        'Entradas', 'Salidas', 'Stock pasado', 'Stock actual', 'Stock mínimo', 
        'Estado', 'url_imagen'
      ]
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: HISTORIAL_SHEET_ID,
        range: `${quotedHistorial}!A1:${getColumnLetter(defaultHeaders.length - 1)}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [defaultHeaders]
        }
      })
      
      headers.push(...defaultHeaders)
    }
    
    // Mapear datos a las columnas correctas según el formato del sheet
    // Columnas: Fecha, Hora, Empresa, Código, Producto, Categoría, Foto, Entradas, Salidas, Stock pasado, Stock actual, Stock mínimo, Estado, url_imagen
    const fechaIndex = headers.findIndex(h => h && h.toLowerCase().includes('fecha'))
    const horaIndex = headers.findIndex(h => h && h.toLowerCase().includes('hora'))
    const empresaIndex = headers.findIndex(h => h && h.toLowerCase().includes('empresa'))
    const codigoIndex = headers.findIndex(h => h && h.toLowerCase().includes('código'))
    const productoIndex = headers.findIndex(h => h && h.toLowerCase().includes('producto'))
    const categoriaIndex = headers.findIndex(h => h && (h.toLowerCase().includes('categoría') || h.toLowerCase().includes('categoria')))
    const fotoIndex = headers.findIndex(h => h && h.toLowerCase().includes('foto'))
    const entradasIndex = headers.findIndex(h => h && h.toLowerCase().includes('entradas'))
    const salidasIndex = headers.findIndex(h => h && h.toLowerCase().includes('salidas'))
    const stockPasadoIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock pasado') || h.toLowerCase().includes('stockpasado') || h.toLowerCase().includes('stock anterior')))
    const stockActualIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock actual') || h.toLowerCase().includes('stockactual')))
    const stockMinimoIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock mínimo') || h.toLowerCase().includes('stockminimo') || h.toLowerCase().includes('stock minimo')))
    const estadoIndex = headers.findIndex(h => h && h.toLowerCase().includes('estado'))
    const urlImagenIndex = headers.findIndex(h => h && (h.toLowerCase().includes('url_imagen') || h.toLowerCase().includes('url imagen')))
    
    // Crear fila con todos los datos
    const maxIndex = Math.max(
      fechaIndex, horaIndex, empresaIndex, codigoIndex, productoIndex, categoriaIndex, fotoIndex,
      entradasIndex, salidasIndex, stockPasadoIndex, stockActualIndex, stockMinimoIndex,
      estadoIndex, urlImagenIndex
    )
    
    const nuevaFila = new Array(maxIndex + 1).fill('')
    
    // Agregar fecha y hora al principio
    if (fechaIndex >= 0) nuevaFila[fechaIndex] = fecha
    if (horaIndex >= 0) nuevaFila[horaIndex] = hora
    if (empresaIndex >= 0) nuevaFila[empresaIndex] = datosProducto.empresa || ''
    if (codigoIndex >= 0) nuevaFila[codigoIndex] = datosProducto.codigo || ''
    if (productoIndex >= 0) nuevaFila[productoIndex] = datosProducto.producto || ''
    if (categoriaIndex >= 0) nuevaFila[categoriaIndex] = datosProducto.categoria || ''
    if (fotoIndex >= 0) nuevaFila[fotoIndex] = datosProducto.foto || ''
    if (entradasIndex >= 0) nuevaFila[entradasIndex] = datosProducto.entradas || 0
    if (salidasIndex >= 0) nuevaFila[salidasIndex] = datosProducto.salidas || 0
    if (stockPasadoIndex >= 0) nuevaFila[stockPasadoIndex] = datosProducto.stockPasado || datosProducto.stockAnterior || 0
    if (stockActualIndex >= 0) nuevaFila[stockActualIndex] = datosProducto.stockActual || 0
    if (stockMinimoIndex >= 0) nuevaFila[stockMinimoIndex] = datosProducto.stockMinimo || 0
    if (estadoIndex >= 0) nuevaFila[estadoIndex] = datosProducto.estado || ''
    if (urlImagenIndex >= 0) nuevaFila[urlImagenIndex] = datosProducto.urlImagen || ''
    
    // Obtener la siguiente fila disponible
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: HISTORIAL_SHEET_ID,
      range: `${quotedHistorial}!A:A`
    })
    
    const nextRow = (dataResponse.data.values?.length || 1) + 1
    
    // Escribir la nueva fila
    await sheets.spreadsheets.values.append({
      spreadsheetId: HISTORIAL_SHEET_ID,
      range: `${quotedHistorial}!A${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [nuevaFila]
      }
    })
    
    console.log(`✅ Registro agregado al historial en fila ${nextRow}`)
    
  } catch (error) {
    console.error('❌ Error registrando en historial:', error)
    throw error
  }
}

// ========================================
// ENDPOINTS PARA ADMINISTRADORES - INVENTARIO
// ========================================

// Middleware para verificar acceso al inventario (solo miguel, carli, ale)
// Nota: El frontend ya verifica el acceso antes de hacer las llamadas.
// Este middleware es una capa adicional de seguridad.
function requireInventarioAccess(req, res, next) {
  // El frontend envía el username en el header 'x-username' cuando hace las peticiones
  const usernameHeader = req.headers['x-username']
  const username = usernameHeader?.toLowerCase()?.trim()
  const usuariosPermitidosInventario = ['miguel', 'carli', 'ale']
  
  console.log(`🔐 Verificando acceso al inventario:`)
  console.log(`  - Header x-username recibido: "${usernameHeader}"`)
  console.log(`  - Username normalizado: "${username}"`)
  console.log(`  - Usuarios permitidos: ${usuariosPermitidosInventario.join(', ')}`)
  
  if (!username) {
    console.warn(`⚠️ Intento de acceso al inventario denegado: header x-username no proporcionado`)
    return res.status(403).json({
      success: false,
      error: 'No tienes permisos para acceder al Inventario. Solo disponible para: miguel, carli, ale'
    })
  }
  
  if (!usuariosPermitidosInventario.includes(username)) {
    console.warn(`⚠️ Intento de acceso al inventario denegado para: ${username}`)
    return res.status(403).json({
      success: false,
      error: 'No tienes permisos para acceder al Inventario. Solo disponible para: miguel, carli, ale'
    })
  }
  
  console.log(`✅ Acceso al inventario permitido para: ${username}`)
  next()
}

// Endpoint para listar todas las empresas (pestañas disponibles)
app.get('/api/admin/inventario/empresas', requireInventarioAccess, async (req, res) => {
  try {
    console.log('📋 Listando empresas disponibles en el inventario...')
    console.log(`  - INVENTARIO_SHEET_ID: ${INVENTARIO_SHEET_ID || 'NO CONFIGURADO'}`)
    
    if (!INVENTARIO_SHEET_ID) {
      console.error('❌ INVENTARIO_SHEET_ID no está configurado')
      return res.status(500).json({
        success: false,
        error: 'INVENTARIO_SHEET_ID no configurado. Verifica la variable de entorno.'
      })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Obtener todas las pestañas del spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: INVENTARIO_SHEET_ID
    })
    
    const empresas = spreadsheet.data.sheets
      .map(sheet => sheet.properties.title)
      .filter(title => title.trim() !== '') // Filtrar pestañas vacías
    
    console.log(`✅ Empresas encontradas: ${empresas.join(', ')}`)
    
    res.json({
      success: true,
      empresas: empresas
    })
    
  } catch (error) {
    console.error('❌ Error listando empresas:', error)
    console.error('   Stack:', error.stack)
    res.status(500).json({
      success: false,
      error: 'Error listando empresas',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// Endpoint para leer inventario de una empresa específica (admin)
app.get('/api/admin/inventario/:empresa', requireInventarioAccess, async (req, res) => {
  try {
    const { empresa } = req.params
    
    console.log(`📦 Obteniendo inventario para empresa: ${empresa}`)
    
    if (!INVENTARIO_SHEET_ID) {
      return res.status(500).json({
        success: false,
        error: 'INVENTARIO_SHEET_ID no configurado'
      })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Leer datos de la pestaña de la empresa
    const quotedSheetTab = quoteSheet(empresa)
    const range = `${quotedSheetTab}!A1:L1000` // Leer hasta columna L para incluir url_imagen
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTARIO_SHEET_ID,
      range: range
    })
    
    const rows = response.data.values || []
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        empresa: empresa
      })
    }
    
    // La primera fila contiene los encabezados
    const headers = rows[0]
    
    // Encontrar índices de columnas relevantes
    const codigoIndex = headers.findIndex(h => h && h.toLowerCase().includes('código'))
    const productoIndex = headers.findIndex(h => h && h.toLowerCase().includes('producto'))
    const categoriaIndex = headers.findIndex(h => h && h.toLowerCase().includes('categoría') || h.toLowerCase().includes('categoria'))
    const stockActualIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock actual') || h.toLowerCase().includes('stockactual')))
    const stockMinimoIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock mínimo') || h.toLowerCase().includes('stockminimo') || h.toLowerCase().includes('stock minimo')))
    const estadoIndex = headers.findIndex(h => h && h.toLowerCase().includes('estado'))
    const urlImagenIndex = headers.findIndex(h => h && (h.toLowerCase().includes('url_imagen') || h.toLowerCase().includes('url imagen')))
    
    // Convertir filas en objetos
    const productos = rows.slice(1)
      .filter(row => row && row.length > 0 && row[productoIndex]) // Filtrar filas vacías
      .map((row, index) => {
        const producto = {
          codigo: codigoIndex >= 0 ? (row[codigoIndex] || '') : '',
          producto: productoIndex >= 0 ? (row[productoIndex] || '') : '',
          categoria: categoriaIndex >= 0 ? (row[categoriaIndex] || '') : '',
          stockActual: stockActualIndex >= 0 ? parseInt(row[stockActualIndex] || 0) : 0,
          stockMinimo: stockMinimoIndex >= 0 ? parseInt(row[stockMinimoIndex] || 0) : 0,
          estado: estadoIndex >= 0 ? (row[estadoIndex] || '') : '',
          urlImagen: urlImagenIndex >= 0 ? (row[urlImagenIndex] || '') : '',
          rowIndex: index + 2 // +2 porque empezamos desde fila 2 (después del header)
        }
        
        // Convertir URL de Google Drive a formato directo si es necesario
        if (producto.urlImagen && producto.urlImagen.includes('drive.google.com')) {
          const match = producto.urlImagen.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
          if (match) {
            const driveId = match[1]
            const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`
            producto.urlImagen = `${backendUrl}/api/proxy-image?url=${encodeURIComponent(producto.urlImagen)}`
          }
        }
        
        return producto
      })
    
    console.log(`✅ ${productos.length} productos encontrados para ${empresa}`)
    
    res.json({
      success: true,
      data: productos,
      empresa: empresa,
      headers: headers
    })
    
  } catch (error) {
    console.error('❌ Error obteniendo inventario:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo inventario',
      details: error.message
    })
  }
})

// Endpoint para actualizar stock de un producto
app.put('/api/admin/inventario/:empresa/actualizar', requireInventarioAccess, async (req, res) => {
  try {
    const { empresa } = req.params
    const { codigo, stockActual } = req.body
    
    console.log(`📝 Actualizando stock para empresa: ${empresa}, código: ${codigo}, stockActual: ${stockActual}`)
    
    if (!INVENTARIO_SHEET_ID) {
      return res.status(500).json({
        success: false,
        error: 'INVENTARIO_SHEET_ID no configurado'
      })
    }
    
    if (!codigo) {
      return res.status(400).json({
        success: false,
        error: 'Código del producto es requerido'
      })
    }
    
    if (stockActual === undefined || stockActual === null) {
      return res.status(400).json({
        success: false,
        error: 'stockActual es requerido'
      })
    }
    
    const auth = await getAuthClient()
    await auth.authorize()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Leer datos para encontrar la fila del producto
    const quotedSheetTab = quoteSheet(empresa)
    const range = `${quotedSheetTab}!A1:L1000`
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTARIO_SHEET_ID,
      range: range
    })
    
    const rows = response.data.values || []
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos en la pestaña'
      })
    }
    
    const headers = rows[0]
    const codigoIndex = headers.findIndex(h => h && h.toLowerCase().includes('código'))
    const stockActualIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock actual') || h.toLowerCase().includes('stockactual')))
    const stockMinimoIndex = headers.findIndex(h => h && (h.toLowerCase().includes('stock mínimo') || h.toLowerCase().includes('stockminimo') || h.toLowerCase().includes('stock minimo')))
    const estadoIndex = headers.findIndex(h => h && h.toLowerCase().includes('estado'))
    
    // Encontrar la fila del producto
    let productoRowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (codigoIndex >= 0 && rows[i][codigoIndex] == codigo) {
        productoRowIndex = i + 1 // +1 porque las filas en Sheets empiezan en 1
        break
      }
    }
    
    if (productoRowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      })
    }
    
    // Obtener datos completos del producto antes de actualizar
    const productoRow = rows[productoRowIndex - 1]
    const productoIndex = headers.findIndex(h => h && h.toLowerCase().includes('producto'))
    const categoriaIndex = headers.findIndex(h => h && (h.toLowerCase().includes('categoría') || h.toLowerCase().includes('categoria')))
    const fotoIndex = headers.findIndex(h => h && h.toLowerCase().includes('foto'))
    const urlImagenIndex = headers.findIndex(h => h && (h.toLowerCase().includes('url_imagen') || h.toLowerCase().includes('url imagen')))
    
    const stockAnterior = parseInt(productoRow[stockActualIndex] || 0)
    const diferencia = stockActual - stockAnterior
    
    // Preparar actualizaciones
    const updates = []
    
    // Actualizar stock actual
    if (stockActualIndex >= 0) {
      updates.push({
        range: `${quotedSheetTab}!${getColumnLetter(stockActualIndex)}${productoRowIndex}`,
        values: [[stockActual.toString()]]
      })
    }
    
    // Calcular nuevo estado basado en stock mínimo existente
    if (estadoIndex >= 0) {
      const stockMin = parseInt(productoRow[stockMinimoIndex] || 0)
      const nuevoEstado = stockActual >= stockMin ? '✅ Ok' : '❌ Bajo stock'
      
      updates.push({
        range: `${quotedSheetTab}!${getColumnLetter(estadoIndex)}${productoRowIndex}`,
        values: [[nuevoEstado]]
      })
    }
    
    // Actualizar en el sheet de inventario
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: INVENTARIO_SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      })
      
      console.log(`✅ Stock actualizado para producto ${codigo} en ${empresa}`)
    }
    
    // Registrar cambio en el historial
    try {
      await registrarEnHistorial({
        empresa: empresa,
        codigo: codigo,
        producto: productoIndex >= 0 ? (productoRow[productoIndex] || '') : '',
        categoria: categoriaIndex >= 0 ? (productoRow[categoriaIndex] || '') : '',
        foto: fotoIndex >= 0 ? (productoRow[fotoIndex] || '') : '',
        entradas: diferencia > 0 ? diferencia : 0,
        salidas: diferencia < 0 ? Math.abs(diferencia) : 0,
        stockPasado: stockAnterior, // Stock anterior antes del cambio
        stockActual: stockActual,
        stockMinimo: parseInt(productoRow[stockMinimoIndex] || 0),
        estado: stockActual >= parseInt(productoRow[stockMinimoIndex] || 0) ? '✅ Ok' : '❌ Bajo stock',
        urlImagen: urlImagenIndex >= 0 ? (productoRow[urlImagenIndex] || '') : ''
      }, sheets)
      
      console.log(`✅ Cambio registrado en historial para producto ${codigo}`)
    } catch (historialError) {
      console.error('⚠️ Error registrando en historial (continuando):', historialError)
      // No fallar la actualización si el historial falla
    }
    
    res.json({
      success: true,
      message: 'Stock actualizado correctamente'
    })
    
  } catch (error) {
    console.error('❌ Error actualizando stock:', error)
    res.status(500).json({
      success: false,
      error: 'Error actualizando stock',
      details: error.message
    })
  }
})

// Middleware de error logging (debe ir al final, después de todas las rutas)
app.use(errorLogger)

// Manejo de errores global
app.use((err, req, res, next) => {
  logSystem.error('Unhandled error', err)
  res.status(500).json({
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message
  })
})

// Endpoint para obtener clientes y empresas desde las URLs de CSV
app.get('/api/clientes-empresas', async (req, res) => {
  try {
    console.log('📋 Cargando clientes y empresas desde CSVs...')
    
    const empresasCsvUrl = process.env.VITE_EMPRESAS_CSV_URL
    const clientesCsvUrl = process.env.VITE_CLIENTES_CSV_URL
    
    if (!empresasCsvUrl && !clientesCsvUrl) {
      return res.status(400).json({
        success: false,
        error: 'URLs de CSV no configuradas en variables de entorno'
      })
    }
    
    // Usar la URL de empresas o clientes (lo que esté disponible)
    const csvUrl = empresasCsvUrl || clientesCsvUrl
    
    // Hacer fetch del CSV
    const response = await fetch(csvUrl)
    if (!response.ok) {
      throw new Error(`Error al obtener CSV: ${response.statusText}`)
    }
    
    const csvText = await response.text()
    
    // Parsear CSV simple (asumiendo formato: header en primera línea, datos en siguientes)
    const lines = csvText.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      return res.json({
        success: true,
        empresas: [],
        clientes: []
      })
    }
    
    // Parsear headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    // Encontrar índices de columnas
    const empresaIdx = headers.findIndex(h => h.toLowerCase() === 'empresa')
    const mapaIdx = headers.findIndex(h => h.toLowerCase() === 'mapa')
    const descripcionIdx = headers.findIndex(h => h.toLowerCase().includes('descripci'))
    
    // Parsear datos
    const empresasData = []
    const clientesSet = new Set()
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      
      if (empresaIdx >= 0 && values[empresaIdx]) {
        const empresa = values[empresaIdx]
        clientesSet.add(empresa)
        
        // Si tiene mapa, agregarlo a empresas
        if (mapaIdx >= 0 && values[mapaIdx]) {
          empresasData.push({
            empresa: empresa,
            mapa: values[mapaIdx],
            descripcion: descripcionIdx >= 0 ? (values[descripcionIdx] || '') : ''
          })
        }
      }
    }
    
    const clientes = Array.from(clientesSet).sort()
    
    console.log(`✅ Cargados ${clientes.length} clientes y ${empresasData.length} empresas`)
    
    res.json({
      success: true,
      empresas: empresasData,
      clientes: clientes
    })
    
  } catch (error) {
    console.error('❌ Error cargando clientes y empresas:', error)
    res.status(500).json({
      success: false,
      error: 'Error cargando datos',
      details: error.message
    })
  }
})

// Inicializar secretos y luego iniciar el servidor
;(async () => {
  await initializeSecrets()
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 API listening on:`)
    console.log(`   - Local:   http://localhost:${PORT}`)
    console.log(`   - Network: http://0.0.0.0:${PORT}`)
    console.log(`💡 Para acceder desde otros dispositivos en la red, usa tu IP local`)
    
    // Log del inicio del servidor
    logSystem.startup(PORT)
  })
})()


