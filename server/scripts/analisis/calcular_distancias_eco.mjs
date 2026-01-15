/**
 * Script para calcular distancias desde 'Direccion Recojo' hasta la central de Ecodelivery
 * Este script usa EXACTAMENTE las mismas funciones que el sistema Beezy para calcular distancias
 * 
 * Uso: node calcular_distancias_eco.mjs
 */

import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Ruta base del proyecto (subir 3 niveles desde scripts/analisis/)
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..')

// Cargar variables de entorno
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(PROJECT_ROOT, 'server', '.env'),
  path.join(PROJECT_ROOT, '.env')
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    console.log(`✅ Variables de entorno cargadas desde: ${envPath}`)
    break
  }
}

// Configuración
const SHEET_ID = process.env.SHEET_ID || '1a8M19WHhfM2SWKSiWbTIpVU76gdAFCJ9uv7y0fnPA4g'
const SHEET_NAME = 'Distancias'
// Intentar múltiples ubicaciones para el service account
let SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
if (SERVICE_ACCOUNT_FILE && SERVICE_ACCOUNT_FILE.startsWith('..')) {
  SERVICE_ACCOUNT_FILE = path.join(PROJECT_ROOT, SERVICE_ACCOUNT_FILE)
}
if (!SERVICE_ACCOUNT_FILE || !fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  const possibleFiles = [
    path.join(PROJECT_ROOT, 'beezero-62dea82962da.json'),
    '/Users/carli.code/Desktop/Pedidos/beezero-62dea82962da.json',
    path.join(PROJECT_ROOT, 'beezero-1d5503cf3b22.json')
  ]
  for (const file of possibleFiles) {
    if (fs.existsSync(file)) {
      SERVICE_ACCOUNT_FILE = file
      console.log(`✅ Usando archivo de service account: ${file}`)
      break
    }
  }
}
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
const CENTRAL_ECO = 'https://maps.app.goo.gl/8JwW48kjNaGV8Y9a9'

// Columnas (1-indexed): A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9
const COL_DIRECCION_RECOJO = 6      // Columna F - 'Direccion Recojo'
const COL_DISTANCIA_ECO = 7          // Columna G - 'Distancia al eco'
const COL_DIRECCION_ENTREGA = 8      // Columna H - 'Direccion Entrega'
const COL_DISTANCIA_ECO_ENTREGA = 9  // Columna I - 'Distancia al eco Entrega'

// Verificar configuración
if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ Error: GOOGLE_MAPS_API_KEY no está configurada en las variables de entorno')
  process.exit(1)
}

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  console.error(`❌ Error: Archivo de service account no encontrado: ${SERVICE_ACCOUNT_FILE}`)
  process.exit(1)
}

/**
 * Obtiene el cliente de autenticación de Google Sheets
 */
function getAuthClient() {
  try {
    const creds = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'))
    const jwt = new google.auth.JWT(
      creds.client_email,
      undefined,
      creds.private_key,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    )
    console.log(`✅ Autenticación configurada para: ${creds.client_email}`)
    return jwt
  } catch (error) {
    console.error('❌ Error configurando autenticación:', error.message)
    throw error
  }
}

// ============================================================================
// FUNCIONES DEL SISTEMA BEEZY (COPIADAS DEL SERVIDOR)
// ============================================================================

const geocodeLocation = async (location) => {
  try {
    console.log('   🗺️ Intentando geocoding para:', location.substring(0, 50))
    
    if (!GOOGLE_MAPS_API_KEY) {
      return null
    }
    
    let locationToGeocode = location
    const isUrl = location.includes('http://') || location.includes('https://') || location.includes('maps.') || location.includes('goo.gl')
    const hasBolivia = location.toLowerCase().includes('bolivia')
    const hasCoords = /-?\d+\.\d+,-?\d+\.\d+/.test(location)
    
    if (!isUrl && !hasBolivia && !hasCoords) {
      locationToGeocode = `${location}, Bolivia`
    }
    
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationToGeocode)}&key=${GOOGLE_MAPS_API_KEY}`
    
    const response = await fetch(geocodingUrl)
    const data = await response.json()
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0]
      const coords = `${result.geometry.location.lat},${result.geometry.location.lng}`
      console.log('   ✅ Geocoding exitoso:', coords)
      return coords
    } else {
      console.log('   ❌ Geocoding falló:', data.status)
      return null
    }
  } catch (error) {
    console.log('   ❌ Error en geocoding:', error.message)
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

  // OPTIMIZACIÓN: Si las coordenadas ya están en formato lat,lng, usar Distance Matrix directamente
  const isCoordFormat = /^-?\d+\.\d+,-?\d+\.\d+$/.test(origin.trim()) && /^-?\d+\.\d+,-?\d+\.\d+$/.test(destination.trim())
  
  // Si NO son coordenadas directas, intentar Directions primero
  if (!isCoordFormat) {
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodedOrigin}&destination=${encodedDestination}&mode=driving&alternatives=true&departure_time=now&traffic_model=best_guess&key=${apiKey}`
    try {
      const directionsResponse = await fetch(directionsUrl, { 
        signal: AbortSignal.timeout(5000)
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
        // Silenciar errores de timeout
      }
    }
  }

  // 2) Usar Distance Matrix
  const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&mode=driving&units=metric&key=${apiKey}`
  
  const dmResponse = await fetch(distanceMatrixUrl)
  const dmData = await dmResponse.json()

  if (dmData.status === 'OK' && dmData.rows?.[0]?.elements?.[0]?.status === 'OK') {
    const element = dmData.rows[0].elements[0]
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

  // Si el status es OK pero el elemento no, intentar re-expandir o geocoding
  if (dmData.status === 'OK' && dmData.rows?.[0]?.elements?.[0]) {
    const element = dmData.rows[0].elements[0]
    const elementStatus = element.status
    
    if (elementStatus === 'NOT_FOUND') {
      // Intentar geocoding como último recurso
      try {
        const cleanOrigin = origin.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
        const cleanDestination = destination.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
        
        const geocodedOrigin = await geocodeLocation(cleanOrigin)
        const geocodedDestination = await geocodeLocation(cleanDestination)
        
        if (geocodedOrigin && geocodedDestination && 
            !geocodedOrigin.includes('http') && !geocodedDestination.includes('http')) {
          return await getShortestDrivingRoute({
            origin: geocodedOrigin,
            destination: geocodedDestination,
            apiKey,
            context: `${context}-geocoded`
          })
        }
      } catch (geocodeError) {
        // Continuar con el error
      }
      
      throw new Error(`Una de las direcciones no fue encontrada. Origen: "${origin}", Destino: "${destination}"`)
    }
    
    throw new Error(`Distance Matrix no pudo calcular la ruta. Status: ${elementStatus}. ${element.error_message || ''}`)
  }

  throw new Error(dmData.error_message || `No se pudo calcular la distancia. Status: ${dmData.status}`)
}

// Función para expandir URLs acortadas y extraer coordenadas (VERSIÓN COMPLETA DEL SERVIDOR)
const expandUrlAndExtractCoords = async (shortUrl) => {
  shortUrl = shortUrl.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
  const originalUrl = shortUrl
  
  try {
    // Remover parámetros de query primero
    const urlSinParams = shortUrl.includes('?') ? shortUrl.split('?')[0] : shortUrl
    
    // Detectar concatenación REAL: dos URLs completas juntas
    const urlConcatenada = urlSinParams.match(/https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+(https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9_-]+)/)
    if (urlConcatenada) {
      shortUrl = urlConcatenada[1]
    } else {
      shortUrl = urlSinParams
    }
    
    // Patrones para extraer coordenadas
    const coordPatterns = [
      /!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/,
      /\/search\/(-?\d+\.\d+),(-?\d+\.\d+)/,
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+),[\d.]+[a-z]?/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /\/(-?\d+\.\d+),(-?\d+\.\d+)/
    ]
    
    // Intentar extraer coordenadas directamente
    for (const pattern of coordPatterns) {
      const match = shortUrl.match(pattern)
      if (match) {
        return `${match[1]},${match[2]}`
      }
    }
    
    // Si es URL corta, expandirla
    if (shortUrl.includes('goo.gl') || shortUrl.includes('maps.app.goo.gl')) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        const getResponse = await fetch(shortUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        const newExpandedUrl = getResponse.url
        
        if (newExpandedUrl !== shortUrl && !newExpandedUrl.includes('maps.app.goo.gl') && !newExpandedUrl.includes('goo.gl')) {
          // Intentar extraer coordenadas de la URL expandida
          for (const pattern of coordPatterns) {
            const match = newExpandedUrl.match(pattern)
            if (match) {
              return `${match[1]},${match[2]}`
            }
          }
          
          // Si no tiene coordenadas pero tiene formato problemático, intentar geocoding
          if (newExpandedUrl.includes('/place//') || (newExpandedUrl.includes('data=') && newExpandedUrl.includes('/place/'))) {
            try {
              const geocodedCoords = await geocodeLocation(newExpandedUrl)
              if (geocodedCoords && !geocodedCoords.includes('http')) {
                return geocodedCoords
              }
            } catch (geocodeError) {
              // Continuar
            }
            return newExpandedUrl
          }
          
          shortUrl = newExpandedUrl
        }
      } catch (error) {
        // Si falla la expansión, usar la URL original
        return originalUrl.trim()
      }
    }
    
    // Si es URL completa de Google Maps
    if (shortUrl.includes('google.com/maps') || shortUrl.includes('maps.google.com') || shortUrl.includes('goo.gl') || shortUrl.includes('maps.app.goo.gl')) {
      // Intentar extraer coordenadas
      for (const pattern of coordPatterns) {
        const match = shortUrl.match(pattern)
        if (match) {
          return `${match[1]},${match[2]}`
        }
      }
      
      // Intentar geocoding si tiene formato problemático
      if (shortUrl.includes('/place//') || (shortUrl.includes('data=') && shortUrl.includes('/place/'))) {
        try {
          const geocodedCoords = await geocodeLocation(shortUrl)
          if (geocodedCoords && !geocodedCoords.includes('http')) {
            return geocodedCoords
          }
        } catch (geocodeError) {
          // Continuar
        }
        return shortUrl
      }
      
      // Usar URL directamente
      if (shortUrl.includes('google.com/maps')) {
        return shortUrl.split('?')[0]
      }
      
      if (shortUrl.includes('google.com/maps')) {
        return shortUrl
      }
    }
    
    return originalUrl
  } catch (error) {
    return originalUrl
  }
}

// Cache para URLs expandidas
const urlExpansionCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

const expandUrlAndExtractCoordsCached = async (shortUrl) => {
  // Verificar caché
  const cached = urlExpansionCache.get(shortUrl)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
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

/**
 * Calcula la distancia entre dos direcciones usando EXACTAMENTE el mismo método que el sistema
 * Con reintentos para mejorar la tasa de éxito
 */
async function calculateDistanceKm(origin, destination, retries = 1) {
  try {
    // Limpiar URLs
    const cleanOrigin = origin.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
    const cleanDestination = destination.trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()

    if (!cleanOrigin || !cleanDestination) {
      console.log(`   ⚠️  Origen o destino vacío`)
      return null
    }

    // Expandir URLs y extraer coordenadas (con caché) - MISMAS FUNCIONES DEL SISTEMA
    let processedOrigin = null
    let processedDestination = null
    
    try {
      processedOrigin = await expandUrlAndExtractCoordsCached(cleanOrigin)
      processedDestination = await expandUrlAndExtractCoordsCached(cleanDestination)
    } catch (expandError) {
      console.log(`   ⚠️  Error expandiendo URLs: ${expandError.message}`)
      // Si falla la expansión, intentar usar las URLs originales limpiadas directamente
      processedOrigin = cleanOrigin
      processedDestination = cleanDestination
    }

    if (!processedOrigin || !processedDestination) {
      console.log(`   ⚠️  No se pudieron procesar las URLs`)
      return null
    }

    // Usar getShortestDrivingRoute - MISMAS FUNCIONES DEL SISTEMA
    try {
      const routeInfo = await getShortestDrivingRoute({
        origin: processedOrigin,
        destination: processedDestination,
        apiKey: GOOGLE_MAPS_API_KEY,
        context: 'calcular-distancias-eco'
      })

      // Convertir metros a kilómetros
      const distanciaKm = (routeInfo.distanceMeters / 1000).toFixed(2)
      return parseFloat(distanciaKm)
    } catch (routeError) {
      // Si falla y aún tenemos reintentos, intentar con geocoding
      if (retries > 0 && routeError.message.includes('NOT_FOUND')) {
        console.log(`   🔄 Reintento con geocoding...`)
        try {
          const geocodedOrigin = await geocodeLocation(cleanOrigin)
          const geocodedDestination = await geocodeLocation(cleanDestination)
          
          if (geocodedOrigin && geocodedDestination && 
              !geocodedOrigin.includes('http') && !geocodedDestination.includes('http')) {
            const routeInfo = await getShortestDrivingRoute({
              origin: geocodedOrigin,
              destination: geocodedDestination,
              apiKey: GOOGLE_MAPS_API_KEY,
              context: 'calcular-distancias-eco-geocoded'
            })
            const distanciaKm = (routeInfo.distanceMeters / 1000).toFixed(2)
            return parseFloat(distanciaKm)
          }
        } catch (geocodeError) {
          console.log(`   ⚠️  Error en reintento: ${geocodeError.message}`)
        }
      }
      throw routeError
    }

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`)
    return null
  }
}

/**
 * Función principal para calcular distancias desde ECO hasta Direccion Entrega
 */
async function calcularDistanciasEco() {
  console.log('🚀 Iniciando cálculo de distancias desde ECO hasta Direccion Entrega...\n')
  console.log('📌 Origen: Central Eco Delivery')
  console.log('📌 Destino: Direccion Entrega (columna H)\n')

  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  try {
    console.log(`📖 Leyendo datos de la pestaña "${SHEET_NAME}"...`)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:I` // Leer hasta columna I para incluir Direccion Entrega
    })

    const rows = response.data.values || []
    console.log(`✅ ${rows.length} filas encontradas\n`)

    if (rows.length === 0) {
      console.log('⚠️  No hay datos para procesar')
      return
    }

    let procesadas = 0
    let exitosas = 0
    let errores = 0
    let omitidas = 0
    const updates = []

    // Calcular distancias desde Direccion Entrega hasta la central (ECO)
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2
      const direccionEntrega = rows[i][COL_DIRECCION_ENTREGA - 1]
      const distanciaActualEntrega = rows[i][COL_DISTANCIA_ECO_ENTREGA - 1]

      // PROCESAR TODAS LAS FILAS - Solo saltar si realmente no hay dirección de entrega
      if (!direccionEntrega || direccionEntrega.toString().trim() === '' || 
          direccionEntrega.toString().trim() === 'Sin especificar' ||
          direccionEntrega.toString().trim() === 'Cliente avisa') {
        omitidas++
        continue
      }

      // Procesar SIEMPRE - recalcular todas, incluyendo las que tienen ERROR
      const tieneError = distanciaActualEntrega && distanciaActualEntrega.toString().startsWith('ERROR')
      const tieneDistanciaValida = distanciaActualEntrega && distanciaActualEntrega.toString().trim() !== '' && !tieneError
      
      // Opcional: omitir si ya tiene distancia válida (descomentar para no recalcular)
      // if (tieneDistanciaValida) {
      //   omitidas++
      //   continue
      // }

      try {
        procesadas++
        if (procesadas % 10 === 0) {
          console.log(`\n📊 Progreso: ${procesadas}/${rows.length} filas procesadas (${exitosas} exitosas, ${errores} errores)`)
        }
        
        console.log(`\n🔄 Fila ${rowIndex}: Calculando distancia desde ECO hasta "${direccionEntrega.toString().substring(0, 50)}..."`)

        // Intentar calcular la distancia con reintentos
        // NOTA: Origen = CENTRAL_ECO, Destino = direccionEntrega (al revés que antes)
        let distanciaKm = null
        let maxRetries = 2
        
        for (let retry = 0; retry <= maxRetries && distanciaKm === null; retry++) {
          if (retry > 0) {
            console.log(`   🔄 Reintento ${retry}/${maxRetries}...`)
            await new Promise(resolve => setTimeout(resolve, 1000)) // Pausa más larga antes de reintentar
          }
          
          // IMPORTANTE: Origen = CENTRAL_ECO, Destino = direccionEntrega
          distanciaKm = await calculateDistanceKm(CENTRAL_ECO, direccionEntrega, maxRetries - retry)
          
          if (distanciaKm === null && retry < maxRetries) {
            // Si falló, intentar expandir la URL de nuevo o usar geocoding
            try {
              const cleanUrl = direccionEntrega.toString().trim().replace(/^[\(\s]+|[\)\s]+$/g, '').trim()
              console.log(`   🔄 Intentando estrategia alternativa...`)
              
              // Intentar geocoding directo como último recurso
              const geocodedDestination = await geocodeLocation(cleanUrl)
              const geocodedOrigin = await expandUrlAndExtractCoordsCached(CENTRAL_ECO)
              
              if (geocodedDestination && !geocodedDestination.includes('http') && geocodedOrigin) {
                const routeInfo = await getShortestDrivingRoute({
                  origin: geocodedOrigin,
                  destination: geocodedDestination,
                  apiKey: GOOGLE_MAPS_API_KEY,
                  context: 'calcular-distancias-eco-entrega-retry'
                })
                distanciaKm = (routeInfo.distanceMeters / 1000).toFixed(2)
                distanciaKm = parseFloat(distanciaKm)
              }
            } catch (retryError) {
              // Continuar con el siguiente intento
            }
          }
        }

        if (distanciaKm !== null) {
          updates.push({
            range: `${SHEET_NAME}!I${rowIndex}`, // Columna I - Distancia al eco Entrega
            values: [[distanciaKm]]
          })

          console.log(`   ✅ Distancia calculada = ${distanciaKm} km`)
          exitosas++

          // Pausa ESPACIADA para evitar costos excesivos de la API (500ms entre cada cálculo)
          await new Promise(resolve => setTimeout(resolve, 500))

          // Escribir cada 10 filas
          if (updates.length >= 10) {
            await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: SHEET_ID,
              requestBody: {
                valueInputOption: 'RAW',
                data: updates
              }
            })
            console.log(`\n💾 ${updates.length} distancias escritas en el sheet`)
            updates.length = 0
            // Pausa adicional después de escribir en el sheet
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        } else {
          console.log(`   ❌ No se pudo calcular después de ${maxRetries + 1} intentos`)
          updates.push({
            range: `${SHEET_NAME}!I${rowIndex}`, // Columna I - Distancia al eco Entrega
            values: [['ERROR: No se pudo calcular']]
          })
          errores++
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`)
        updates.push({
          range: `${SHEET_NAME}!I${rowIndex}`, // Columna I - Distancia al eco Entrega
          values: [[`ERROR: ${error.message.substring(0, 50)}`]]
        })
        errores++
      }
    }

    // Escribir las actualizaciones restantes
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      })
      console.log(`\n💾 ${updates.length} distancias restantes escritas en el sheet`)
    }

    // Resumen final
    console.log(`\n\n✅ PROCESO COMPLETADO:`)
    console.log(`   - Filas procesadas: ${procesadas}`)
    console.log(`   - Exitosas: ${exitosas}`)
    console.log(`   - Errores: ${errores}`)
    console.log(`   - Omitidas: ${omitidas}`)
    console.log(`   - Total filas: ${rows.length}`)

  } catch (error) {
    console.error('❌ Error procesando el sheet:', error.message)
    if (error.response) {
      console.error('   Detalles:', error.response.data)
    }
    process.exit(1)
  }
}

// Ejecutar el script
calcularDistanciasEco().catch(error => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})
