/**
 * Script de Análisis de Datos - Diciembre 2025
 * Analiza pedidos de diciembre y genera reporte HTML/PDF profesional
 * 
 * Uso: node analisis_diciembre.mjs
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
  path.join(__dirname, '..', '.env')
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
}

// Configuración
const SHEET_ID = process.env.SHEET_ID || '1a8M19WHhfM2SWKSiWbTIpVU76gdAFCJ9uv7y0fnPA4g'
const SHEET_NAME = 'Distancias'
let SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
if (SERVICE_ACCOUNT_FILE && SERVICE_ACCOUNT_FILE.startsWith('..')) {
  SERVICE_ACCOUNT_FILE = path.join(__dirname, SERVICE_ACCOUNT_FILE)
}
if (!SERVICE_ACCOUNT_FILE || !fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  const possibleFiles = [
    path.join(__dirname, '..', 'beezero-62dea82962da.json'),
    '/Users/carli.code/Desktop/Pedidos/beezero-62dea82962da.json'
  ]
  for (const file of possibleFiles) {
    if (fs.existsSync(file)) {
      SERVICE_ACCOUNT_FILE = file
      break
    }
  }
}

// Índices de columnas (0-indexed para arrays)
const COL_FECHA_AGENDADA = 5  // Columna F
const COL_DISTANCIA_ECO_RECOJO = 7  // Columna H
const COL_DISTANCIA_ECO_ENTREGA = 9  // Columna J
const COL_DIST_TOTAL = 10  // Columna K - Dist. [Km]
const COL_MEDIO_TRANSPORTE = 11  // Columna L
const COL_PRECIO = 12  // Columna M - Precio [Bs]
const COL_DIA_SEMANA = 13  // Columna N - Dia de la semana
const COL_FECHA_REGISTRO = 1  // Columna B - Fecha Registro

/**
 * Obtiene el cliente de autenticación de Google Sheets
 */
function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'))
  const jwt = new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  )
  return jwt
}

/**
 * Parsea fecha en formato DD/MM/YYYY
 */
function parseFecha(fechaStr) {
  if (!fechaStr) return null
  const partes = fechaStr.toString().trim().split('/')
  if (partes.length === 3) {
    const [dia, mes, año] = partes
    return new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia))
  }
  return null
}

/**
 * Verifica si una fecha es de diciembre 2025
 */
function esDiciembre2025(fecha) {
  if (!fecha) return false
  return fecha.getMonth() === 11 && fecha.getFullYear() === 2025 // Diciembre = mes 11
}

/**
 * Convierte string a número (maneja comas como decimales)
 */
function parseNumero(valor) {
  if (!valor || valor === '' || valor === 'ERROR') return null
  const str = valor.toString().replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

/**
 * Calcula estadísticas de un array de números
 */
function calcularEstadisticas(valores) {
  const nums = valores.filter(v => v !== null && v !== undefined && !isNaN(v))
  if (nums.length === 0) return null
  
  nums.sort((a, b) => a - b)
  const suma = nums.reduce((a, b) => a + b, 0)
  const media = suma / nums.length
  
  // Desviación estándar
  const varianza = nums.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / nums.length
  const desviacion = Math.sqrt(varianza)
  
  // Percentiles
  const mediana = nums.length % 2 === 0
    ? (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
    : nums[Math.floor(nums.length / 2)]
  
  const q1 = nums[Math.floor(nums.length * 0.25)]
  const q3 = nums[Math.floor(nums.length * 0.75)]
  
  return {
    count: nums.length,
    min: nums[0],
    max: nums[nums.length - 1],
    media,
    mediana,
    desviacion,
    q1,
    q3,
    valores: nums
  }
}

/**
 * Genera datos para gráfica de campana (distribución normal)
 * Limita el rango a valores razonables (media ± 3 desviaciones estándar o hasta Q3 + 1.5*IQR)
 */
function generarDatosCampana(media, desviacion, min, max, q1, q3, numPuntos = 100) {
  const datos = []
  
  // Calcular IQR (Interquartile Range)
  const iqr = q3 - q1
  
  // Limitar el rango máximo a valores razonables
  // Usar el menor entre: media + 3*desviación, o Q3 + 1.5*IQR, o max (si max es razonable)
  const rangoMaxTeorico = Math.min(media + 3 * desviacion, q3 + 1.5 * iqr)
  const rangoMax = Math.min(rangoMaxTeorico, max)
  
  // Para el mínimo, usar el mayor entre: media - 3*desviación, o Q1 - 1.5*IQR, o 0
  const rangoMinTeorico = Math.max(media - 3 * desviacion, q1 - 1.5 * iqr, 0)
  const rangoMin = Math.max(rangoMinTeorico, min)
  
  const paso = (rangoMax - rangoMin) / numPuntos
  
  for (let i = 0; i <= numPuntos; i++) {
    const x = rangoMin + (i * paso)
    // Función de densidad de probabilidad normal
    const y = Math.exp(-0.5 * Math.pow((x - media) / desviacion, 2)) / (desviacion * Math.sqrt(2 * Math.PI))
    datos.push({ x, y })
  }
  
  return datos
}

/**
 * Crea histograma (bins)
 */
function crearHistograma(valores, numBins = 20) {
  const nums = valores.filter(v => v !== null && !isNaN(v))
  if (nums.length === 0) return []
  
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const binSize = (max - min) / numBins
  
  const bins = Array(numBins).fill(0).map((_, i) => ({
    inicio: min + (i * binSize),
    fin: min + ((i + 1) * binSize),
    count: 0
  }))
  
  nums.forEach(val => {
    const binIndex = Math.min(Math.floor((val - min) / binSize), numBins - 1)
    bins[binIndex].count++
  })
  
  return bins.map(bin => ({
    x: (bin.inicio + bin.fin) / 2,
    y: bin.count
  }))
}

/**
 * Función principal
 */
async function generarAnalisis() {
  console.log('🚀 Iniciando análisis de datos de diciembre...\n')
  
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  
  try {
    // Leer datos
    console.log('📖 Leyendo datos del sheet...')
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:N`
    })
    
    const rows = response.data.values || []
    console.log(`✅ ${rows.length} filas encontradas\n`)
    
    // Filtrar por diciembre 2025
    const datosDiciembre = []
    for (let i = 0; i < rows.length; i++) {
      const fechaStr = rows[i][COL_FECHA_AGENDADA]
      const fecha = parseFecha(fechaStr)
      
      if (esDiciembre2025(fecha)) {
        const id = rows[i][0] || `Fila ${i + 2}`
        const cliente = rows[i][2] || 'N/A'
        const direccionRecojo = rows[i][6] || 'N/A'
        const direccionEntrega = rows[i][8] || 'N/A'
        const distanciaRecojo = parseNumero(rows[i][COL_DISTANCIA_ECO_RECOJO])
        const distanciaEntrega = parseNumero(rows[i][COL_DISTANCIA_ECO_ENTREGA])
        const distanciaTotal = parseNumero(rows[i][COL_DIST_TOTAL])
        const medioTransporte = rows[i][COL_MEDIO_TRANSPORTE] || 'N/A'
        const precio = parseNumero(rows[i][COL_PRECIO]) || 0
        const diaSemana = rows[i][COL_DIA_SEMANA] || 'N/A'
        const fechaRegistroStr = rows[i][COL_FECHA_REGISTRO] || ''
        const fechaRegistro = parseFecha(fechaRegistroStr)
        
        datosDiciembre.push({
          id,
          cliente,
          direccionRecojo,
          direccionEntrega,
          fecha,
          fechaRegistro,
          distanciaRecojo,
          distanciaEntrega,
          distanciaTotal,
          medioTransporte,
          precio,
          diaSemana,
          carreraTotal: distanciaTotal || 0  // Usar directamente la columna 'Dist. [Km]'
        })
      }
    }
    
    console.log(`📊 ${datosDiciembre.length} pedidos de diciembre encontrados\n`)
    
    if (datosDiciembre.length === 0) {
      console.log('⚠️  No hay datos de diciembre para analizar')
      return
    }
    
    // Calcular estadísticas
    console.log('📈 Calculando estadísticas...')
    
    const distanciasRecojo = datosDiciembre.map(d => d.distanciaRecojo).filter(d => d !== null)
    const distanciasEntrega = datosDiciembre.map(d => d.distanciaEntrega).filter(d => d !== null)
    const distanciasTotal = datosDiciembre.map(d => d.distanciaTotal).filter(d => d !== null)
    const carrerasTotal = datosDiciembre.map(d => d.distanciaTotal).filter(d => d !== null && d > 0)
    
    const statsRecojo = calcularEstadisticas(distanciasRecojo)
    const statsEntrega = calcularEstadisticas(distanciasEntrega)
    const statsTotal = calcularEstadisticas(distanciasTotal)
    const statsCarrera = calcularEstadisticas(carrerasTotal)
    
    // Envío más distancioso
    const maxRecojo = datosDiciembre.reduce((max, d) => 
      (d.distanciaRecojo || 0) > (max.distanciaRecojo || 0) ? d : max
    , datosDiciembre[0])
    
    const maxEntrega = datosDiciembre.reduce((max, d) => 
      (d.distanciaEntrega || 0) > (max.distanciaEntrega || 0) ? d : max
    , datosDiciembre[0])
    
    // Carrera más larga (usando la columna 'Dist. [Km]')
    const carreraMasLarga = datosDiciembre
      .filter(d => d.distanciaTotal !== null && d.distanciaTotal > 0)
      .reduce((max, d) => 
        d.distanciaTotal > max.distanciaTotal ? d : max
      , datosDiciembre.find(d => d.distanciaTotal !== null && d.distanciaTotal > 0) || datosDiciembre[0])
    
    // Medio de transporte más usado
    const transporteCount = {}
    datosDiciembre.forEach(d => {
      const trans = d.medioTransporte || 'N/A'
      transporteCount[trans] = (transporteCount[trans] || 0) + 1
    })
    const transporteMasUsado = Object.entries(transporteCount)
      .sort((a, b) => b[1] - a[1])[0]
    
    console.log('✅ Estadísticas calculadas\n')
    
    // Detectar valores atípicos (outliers)
    console.log('🔍 Detectando valores atípicos...')
    
    // Función para detectar outliers usando IQR
    function detectarOutliers(datos, stats, tipo = 'dato') {
      if (!stats) return { leves: [], extremos: [], limites: { leve: { inferior: 0, superior: 0 }, extremo: { inferior: 0, superior: 0 } } }
      
      const IQR = stats.q3 - stats.q1
      const limiteInferiorLeve = stats.q1 - 1.5 * IQR
      const limiteSuperiorLeve = stats.q3 + 1.5 * IQR
      const limiteInferiorExtremo = stats.q1 - 3 * IQR
      const limiteSuperiorExtremo = stats.q3 + 3 * IQR
      
      const leves = []
      const extremos = []
      
      datos.forEach(d => {
        const valor = tipo === 'recojo' ? d.distanciaRecojo : tipo === 'entrega' ? d.distanciaEntrega : d.distanciaTotal
        if (valor === null || valor === undefined) return
        
        if (valor < limiteInferiorExtremo || valor > limiteSuperiorExtremo) {
          extremos.push({ ...d, valor, tipo })
        } else if (valor < limiteInferiorLeve || valor > limiteSuperiorLeve) {
          leves.push({ ...d, valor, tipo })
        }
      })
      
      return { leves, extremos, limites: { leve: { inferior: limiteInferiorLeve, superior: limiteSuperiorLeve }, extremo: { inferior: limiteInferiorExtremo, superior: limiteSuperiorExtremo } } }
    }
    
    const outliersRecojo = detectarOutliers(datosDiciembre, statsRecojo, 'recojo')
    const outliersEntrega = detectarOutliers(datosDiciembre, statsEntrega, 'entrega')
    const outliersCarrera = detectarOutliers(datosDiciembre, statsCarrera, 'carrera')
    
    console.log(`   📊 Recojo: ${outliersRecojo.leves.length} leves, ${outliersRecojo.extremos.length} extremos`)
    console.log(`   📊 Entrega: ${outliersEntrega.leves.length} leves, ${outliersEntrega.extremos.length} extremos`)
    console.log(`   📊 Carrera Total: ${outliersCarrera.leves.length} leves, ${outliersCarrera.extremos.length} extremos\n`)
    
    // Calcular recojos desde ECO (distancia = 0 o < 0.5 km)
    const recojosDesdeEco = datosDiciembre.filter(d => 
      d.distanciaRecojo !== null && d.distanciaRecojo < 0.5
    )
    const porcentajeRecojosEco = (recojosDesdeEco.length / datosDiciembre.length) * 100
    
    console.log(`   📍 Recojos desde ECO: ${recojosDesdeEco.length} (${porcentajeRecojosEco.toFixed(1)}%)\n`)
    
    // Calcular tendencia temporal (día a día)
    const tendenciaTemporal = {}
    datosDiciembre.forEach(d => {
      if (d.fecha) {
        const dia = d.fecha.getDate()
        const key = `${d.fecha.getFullYear()}-${String(d.fecha.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        if (!tendenciaTemporal[key]) {
          tendenciaTemporal[key] = {
            fecha: key,
            dia: dia,
            recojo: [],
            entrega: [],
            total: 0
          }
        }
        if (d.distanciaRecojo !== null) tendenciaTemporal[key].recojo.push(d.distanciaRecojo)
        if (d.distanciaEntrega !== null) tendenciaTemporal[key].entrega.push(d.distanciaEntrega)
        tendenciaTemporal[key].total++
      }
    })
    
    // Convertir a array y calcular promedios
    const tendenciaArray = Object.values(tendenciaTemporal)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(t => ({
        fecha: t.fecha,
        dia: t.dia,
        promedioRecojo: t.recojo.length > 0 ? t.recojo.reduce((a, b) => a + b, 0) / t.recojo.length : 0,
        promedioEntrega: t.entrega.length > 0 ? t.entrega.reduce((a, b) => a + b, 0) / t.entrega.length : 0,
        totalPedidos: t.total
      }))
    
    // Histograma de carreras totales
    const histogramaCarreras = statsCarrera ? crearHistograma(statsCarrera.valores, 20) : []
    
    // Distribución por día de la semana
    const distribucionPorDiaSemana = {}
    datosDiciembre.forEach(d => {
      const dia = d.diaSemana || 'N/A'
      distribucionPorDiaSemana[dia] = (distribucionPorDiaSemana[dia] || 0) + 1
    })
    
    // Orden de días de la semana
    const ordenDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const distribucionDiasOrdenada = ordenDias
      .filter(dia => distribucionPorDiaSemana[dia])
      .map(dia => ({
        dia,
        cantidad: distribucionPorDiaSemana[dia]
      }))
    
    // Top 10 fechas de registro con más pedidos
    const pedidosPorFechaRegistro = {}
    datosDiciembre.forEach(d => {
      if (d.fechaRegistro) {
        const fechaKey = d.fechaRegistro.toISOString().split('T')[0] // YYYY-MM-DD
        pedidosPorFechaRegistro[fechaKey] = (pedidosPorFechaRegistro[fechaKey] || 0) + 1
      }
    })
    
    const top10FechasRegistro = Object.entries(pedidosPorFechaRegistro)
      .map(([fechaKey, cantidad]) => ({
        fecha: new Date(fechaKey),
        cantidad
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
    
    // Top 10 fechas agendadas con más pedidos
    const pedidosPorFechaAgendada = {}
    datosDiciembre.forEach(d => {
      if (d.fecha) {
        const fechaKey = d.fecha.toISOString().split('T')[0] // YYYY-MM-DD
        pedidosPorFechaAgendada[fechaKey] = (pedidosPorFechaAgendada[fechaKey] || 0) + 1
      }
    })
    
    const top10FechasAgendadas = Object.entries(pedidosPorFechaAgendada)
      .map(([fechaKey, cantidad]) => ({
        fecha: new Date(fechaKey),
        cantidad
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
    
    console.log(`   📅 Día más activo: ${distribucionDiasOrdenada[0]?.dia || 'N/A'} (${distribucionDiasOrdenada[0]?.cantidad || 0} pedidos)`)
    if (top10FechasRegistro.length > 0) {
      const fechaStr = top10FechasRegistro[0].fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      console.log(`   📅 Fecha registro con más pedidos: ${fechaStr} (${top10FechasRegistro[0].cantidad} pedidos)`)
    }
    if (top10FechasAgendadas.length > 0) {
      const fechaStr = top10FechasAgendadas[0].fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      console.log(`   📅 Fecha agendada con más pedidos: ${fechaStr} (${top10FechasAgendadas[0].cantidad} pedidos)\n`)
    }
    
    // Calcular clientes más y menos valiosos
    const clientesValor = {}
    datosDiciembre.forEach(d => {
      const cliente = d.cliente || 'N/A'
      if (!clientesValor[cliente]) {
        clientesValor[cliente] = {
          nombre: cliente,
          totalIngresos: 0,
          totalPedidos: 0,
          promedioPorPedido: 0
        }
      }
      clientesValor[cliente].totalIngresos += d.precio || 0
      clientesValor[cliente].totalPedidos += 1
    })
    
    // Calcular promedio por pedido
    Object.values(clientesValor).forEach(c => {
      c.promedioPorPedido = c.totalPedidos > 0 ? c.totalIngresos / c.totalPedidos : 0
    })
    
    // Top 10 más valiosos (por recurrencia/pedidos) y menos valiosos
    const clientesArray = Object.values(clientesValor)
    const top10MasValiosos = clientesArray
      .sort((a, b) => b.totalPedidos - a.totalPedidos)  // Ordenar por cantidad de pedidos (recurrencia)
      .slice(0, 10)
    
    const top10MenosValiosos = clientesArray
      .filter(c => c.totalPedidos > 0) // Solo clientes con pedidos
      .sort((a, b) => a.totalPedidos - b.totalPedidos)  // Ordenar por cantidad de pedidos
      .slice(0, 10)
    
    console.log(`   💰 Top cliente más recurrente: ${top10MasValiosos[0]?.nombre || 'N/A'} (${top10MasValiosos[0]?.totalPedidos || 0} pedidos)\n`)
    
    // Top 10 carreras más costosas
    const top10CarrerasMasCostosas = datosDiciembre
      .filter(d => d.precio > 0 && d.distanciaTotal !== null)
      .map(d => ({
        id: d.id,
        cliente: d.cliente || 'N/A',
        precio: d.precio,
        distancia: d.distanciaTotal || 0,
        medioTransporte: d.medioTransporte || 'N/A'
      }))
      .sort((a, b) => b.precio - a.precio)
      .slice(0, 10)
    
    if (top10CarrerasMasCostosas.length > 0) {
      console.log(`   💰 Carrera más costosa: ${top10CarrerasMasCostosas[0].precio.toFixed(2)} Bs (Cliente: ${top10CarrerasMasCostosas[0].cliente}, Distancia: ${top10CarrerasMasCostosas[0].distancia.toFixed(2)} km)\n`)
    }
    
    // Generar HTML
    console.log('📄 Generando HTML...')
    const html = generarHTML(statsRecojo, statsEntrega, statsTotal, statsCarrera, 
                             maxRecojo, maxEntrega, carreraMasLarga, transporteMasUsado,
                             datosDiciembre.length, transporteCount,
                             outliersRecojo, outliersEntrega, outliersCarrera,
                             recojosDesdeEco.length, porcentajeRecojosEco,
                             tendenciaArray, histogramaCarreras,
                             distribucionDiasOrdenada, top10FechasRegistro, top10FechasAgendadas,
                             top10MasValiosos, top10MenosValiosos, top10CarrerasMasCostosas)
    
    // Guardar HTML en la raíz del proyecto
    const htmlPath = path.join(PROJECT_ROOT, 'analisis_diciembre.html')
    fs.writeFileSync(htmlPath, html, 'utf8')
    console.log(`✅ HTML generado: ${htmlPath}\n`)
    
    console.log('📊 RESUMEN DEL ANÁLISIS:')
    console.log(`   - Total pedidos diciembre: ${datosDiciembre.length}`)
    console.log(`   - Media distancia recojo: ${statsRecojo?.media.toFixed(2)} km`)
    console.log(`   - Media distancia entrega: ${statsEntrega?.media.toFixed(2)} km`)
    console.log(`   - Envío más distancioso (recojo): ${maxRecojo.distanciaRecojo?.toFixed(2)} km`)
    console.log(`   - Envío más distancioso (entrega): ${maxEntrega.distanciaEntrega?.toFixed(2)} km`)
    console.log(`   - Carrera más larga: ${carreraMasLarga.distanciaTotal?.toFixed(2) || 'N/A'} km`)
    console.log(`   - Medio transporte más usado: ${transporteMasUsado[0]} (${transporteMasUsado[1]} veces)`)
    console.log(`\n✅ Análisis completado. Abre ${htmlPath} en tu navegador.`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

/**
 * Genera HTML profesional con gráficos
 */
function generarHTML(statsRecojo, statsEntrega, statsTotal, statsCarrera,
                     maxRecojo, maxEntrega, carreraMasLarga, transporteMasUsado,
                     totalPedidos, transporteCount,
                     outliersRecojo = { leves: [], extremos: [] },
                     outliersEntrega = { leves: [], extremos: [] },
                     outliersCarrera = { leves: [], extremos: [] },
                     recojosDesdeEco = 0,
                     porcentajeRecojosEco = 0,
                     tendenciaTemporal = [],
                     histogramaCarreras = [],
                     distribucionDiasSemana = [],
                     top10FechasRegistro = [],
                     top10FechasAgendadas = [],
                     top10MasValiosos = [],
                     top10MenosValiosos = [],
                     top10CarrerasMasCostosas = []) {
  
  // Datos para gráficos
  const datosCampanaRecojo = statsRecojo 
    ? generarDatosCampana(statsRecojo.media, statsRecojo.desviacion, 
                          statsRecojo.min, statsRecojo.max,
                          statsRecojo.q1, statsRecojo.q3)
    : []
  const histogramaRecojo = statsRecojo 
    ? crearHistograma(statsRecojo.valores)
    : []
  
  const datosCampanaEntrega = statsEntrega
    ? generarDatosCampana(statsEntrega.media, statsEntrega.desviacion,
                          statsEntrega.min, statsEntrega.max,
                          statsEntrega.q1, statsEntrega.q3)
    : []
  const histogramaEntrega = statsEntrega
    ? crearHistograma(statsEntrega.valores)
    : []
  
  // Datos de transporte (excluir Scooter)
  const transporteLabels = Object.keys(transporteCount).filter(t => t !== 'Scooter' && t !== 'scooter')
  const transporteValues = transporteLabels.map(t => transporteCount[t])
  const transporteColors = [
    '#28a745', '#007bff', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#e83e8c'
  ]
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Análisis de Datos - Diciembre 2025</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 30px 20px;
            color: #2c3e50;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: #28a745;
            color: white;
            padding: 40px;
            text-align: center;
            border-bottom: 4px solid #218838;
        }
        
        .header h1 {
            font-size: 2.2em;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: white;
            color: #2c3e50;
            padding: 25px;
            border-radius: 6px;
            border: 2px solid #e9ecef;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            text-align: center;
            transition: all 0.3s;
        }
        
        .stat-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.12);
            transform: translateY(-2px);
        }
        
        .stat-card.recojo {
            border-color: #28a745;
            border-left: 4px solid #28a745;
        }
        
        .stat-card.entrega {
            border-color: #17a2b8;
            border-left: 4px solid #17a2b8;
        }
        
        .stat-card.transporte {
            border-color: #ffc107;
            border-left: 4px solid #ffc107;
        }
        
        .stat-card.max {
            border-color: #dc3545;
            border-left: 4px solid #dc3545;
        }
        
        .stat-label {
            font-size: 0.85em;
            color: #6c757d;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }
        
        .stat-value {
            font-size: 2.2em;
            font-weight: 700;
            margin-bottom: 5px;
            color: #2c3e50;
        }
        
        .stat-card.recojo .stat-value {
            color: #28a745;
        }
        
        .stat-card.entrega .stat-value {
            color: #17a2b8;
        }
        
        .stat-card.transporte .stat-value {
            color: #ffc107;
        }
        
        .stat-card.max .stat-value {
            color: #dc3545;
        }
        
        .stat-unit {
            font-size: 0.75em;
            color: #6c757d;
            font-weight: 500;
        }
        
        .section {
            margin-bottom: 50px;
        }
        
        .section-title {
            font-size: 1.6em;
            color: #2c3e50;
            margin-bottom: 25px;
            padding-bottom: 12px;
            border-bottom: 2px solid #28a745;
            font-weight: 600;
        }
        
        .chart-container {
            background: white;
            padding: 30px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            margin-bottom: 30px;
        }
        
        .chart-wrapper {
            position: relative;
            height: 400px;
            margin-top: 20px;
        }
        
        .insights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        
        .insight-card {
            background: #f8f9fa;
            border-left: 4px solid #28a745;
            padding: 25px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        
        .insight-card h3 {
            color: #28a745;
            margin-bottom: 20px;
            font-size: 1.2em;
            font-weight: 600;
        }
        
        .insight-item {
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .insight-item:last-child {
            border-bottom: none;
        }
        
        .insight-label {
            font-weight: bold;
            color: #495057;
            margin-bottom: 5px;
        }
        
        .insight-value {
            font-size: 1.4em;
            color: #28a745;
            font-weight: 700;
        }
        
        .range-info {
            display: flex;
            justify-content: space-around;
            margin-top: 15px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .range-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            min-width: 120px;
        }
        
        .range-label {
            font-size: 0.8em;
            color: #6c757d;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .range-value {
            font-size: 1.2em;
            font-weight: 700;
            color: #2c3e50;
        }
        
        .btn-print {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #28a745;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1.1em;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: all 0.3s;
        }
        
        .btn-print:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 7px 20px rgba(0,0,0,0.4);
        }
        
        .btn-pdf {
            position: fixed;
            bottom: 100px;
            right: 30px;
            background: #dc3545;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1.1em;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: all 0.3s;
        }
        
        .btn-pdf:hover {
            background: #c82333;
            transform: translateY(-2px);
            box-shadow: 0 7px 20px rgba(0,0,0,0.4);
        }
        
        @media print {
            .btn-print, .btn-pdf {
                display: none;
            }
            body {
                background: white;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Análisis de Datos - Diciembre 2025</h1>
            <p>Reporte Analítico de Distancias desde Oficina ECO</p>
            <p style="font-size: 0.9em; margin-top: 10px; opacity: 0.9;">
                📍 Insights sobre distancias desde la oficina ECO hasta puntos de recojo y entrega
            </p>
        </div>
        
        <div class="content">
            <!-- Estadísticas Principales -->
            <div class="stats-grid">
                <div class="stat-card recojo">
                    <div class="stat-label">Total Pedidos</div>
                    <div class="stat-value">${totalPedidos}</div>
                    <div class="stat-unit">pedidos</div>
                </div>
                
                ${statsRecojo ? `
                <div class="stat-card recojo">
                    <div class="stat-label">Media Distancia ECO → Recojo</div>
                    <div class="stat-value">${statsRecojo.media.toFixed(2)}</div>
                    <div class="stat-unit">km desde oficina</div>
                </div>
                ` : ''}
                
                ${statsEntrega ? `
                <div class="stat-card entrega">
                    <div class="stat-label">Media Distancia ECO → Entrega</div>
                    <div class="stat-value">${statsEntrega.media.toFixed(2)}</div>
                    <div class="stat-unit">km desde oficina</div>
                </div>
                ` : ''}
                
                <div class="stat-card max">
                    <div class="stat-label">Recojo Más Distante del ECO</div>
                    <div class="stat-value">${maxRecojo.distanciaRecojo?.toFixed(2) || 'N/A'}</div>
                    <div class="stat-unit">km desde oficina</div>
                </div>
                
                <div class="stat-card max">
                    <div class="stat-label">Entrega Más Distante del ECO</div>
                    <div class="stat-value">${maxEntrega.distanciaEntrega?.toFixed(2) || 'N/A'}</div>
                    <div class="stat-unit">km desde oficina</div>
                </div>
                
                <div class="stat-card max">
                    <div class="stat-label">Carrera Más Larga</div>
                    <div class="stat-value">${carreraMasLarga.distanciaTotal?.toFixed(2) || 'N/A'}</div>
                    <div class="stat-unit">km (Columna 'Dist. [Km]')</div>
                </div>
                
                <div class="stat-card transporte">
                    <div class="stat-label">Medio Transporte Más Usado</div>
                    <div class="stat-value">${transporteMasUsado[0]}</div>
                    <div class="stat-unit">${transporteMasUsado[1]} veces</div>
                </div>
                
                <div class="stat-card recojo" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
                    <div class="stat-label">Recojos desde ECO</div>
                    <div class="stat-value">${recojosDesdeEco}</div>
                    <div class="stat-unit">${porcentajeRecojosEco.toFixed(1)}% del total</div>
                </div>
            </div>
            
            <!-- Histograma - Distancia Recojo -->
            ${histogramaRecojo.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📊 Distribución Real de Distancias desde ECO hasta Recojo</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Histograma mostrando la frecuencia real de distancias desde la oficina ECO hasta los puntos de recojo
                    </p>
                    <div class="chart-wrapper">
                        <canvas id="histogramaRecojo"></canvas>
                    </div>
                    ${statsRecojo ? `
                    <div class="range-info">
                        <div class="range-item">
                            <div class="range-label">Mínimo</div>
                            <div class="range-value">${statsRecojo.min.toFixed(2)} km</div>
                        </div>
                        <div class="range-item">
                            <div class="range-label">Q1 (25%)</div>
                            <div class="range-value">${statsRecojo.q1.toFixed(2)} km</div>
                        </div>
                        <div class="range-item">
                            <div class="range-label">Mediana</div>
                            <div class="range-value">${statsRecojo.mediana.toFixed(2)} km</div>
                        </div>
                        <div class="range-item">
                            <div class="range-label">Q3 (75%)</div>
                            <div class="range-value">${statsRecojo.q3.toFixed(2)} km</div>
                        </div>
                        <div class="range-item">
                            <div class="range-label">Máximo</div>
                            <div class="range-value">${statsRecojo.max.toFixed(2)} km</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Histograma - Distancia Entrega -->
            ${histogramaEntrega.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📊 Distribución Real de Distancias desde ECO hasta Entrega</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 15px; font-size: 0.95em;">
                        📍 Frecuencia de distancias desde la oficina ECO hasta los puntos de entrega
                    </p>
                    <div class="chart-wrapper">
                        <canvas id="histogramaEntrega"></canvas>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Gráfico de Tendencia Temporal -->
            ${tendenciaTemporal.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📅 Tendencia Temporal - Diciembre 2025</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 15px; font-size: 0.95em;">
                        📍 Evolución diaria de las distancias promedio desde la oficina ECO
                    </p>
                    <div style="background: #e7f3ff; border-left: 4px solid #17a2b8; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="font-weight: bold; color: #0c5460; margin-bottom: 8px;">💡 Cómo interpretar este gráfico:</p>
                        <ul style="margin: 0; padding-left: 20px; color: #0c5460; font-size: 0.9em;">
                            <li>Las líneas muestran la distancia promedio de cada día del mes</li>
                            <li>La línea verde representa las distancias ECO → Recojo</li>
                            <li>La línea azul representa las distancias ECO → Entrega</li>
                            <li>Observa tendencias: días con picos altos pueden indicar entregas más distantes</li>
                            <li>Compara ambos tipos de distancias para identificar patrones estacionales</li>
                        </ul>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="tendenciaTemporal"></canvas>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Distribución de Carreras Totales -->
            ${histogramaCarreras.length > 0 ? `
            <div class="section">
                <h2 class="section-title">🚚 Distribución de Carreras Totales</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Histograma de la distancia total de cada carrera (ECO→Recojo + ECO→Entrega)
                    </p>
                    <div class="chart-wrapper">
                        <canvas id="histogramaCarreras"></canvas>
                    </div>
                    ${statsCarrera ? `
                    <div class="range-info">
                        <div class="range-item">
                            <div class="range-label">Media</div>
                            <div class="range-value">${statsCarrera.media.toFixed(2)} km</div>
                        </div>
                        <div class="range-item">
                            <div class="range-label">Mediana</div>
                            <div class="range-value">${statsCarrera.mediana.toFixed(2)} km</div>
                        </div>
                        <div class="range-item">
                            <div class="range-label">Máximo</div>
                            <div class="range-value">${statsCarrera.max.toFixed(2)} km</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Distribución por Día de la Semana -->
            ${distribucionDiasSemana.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📅 Distribución por Día de la Semana</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Cantidad de pedidos registrados según el día de la semana
                    </p>
                    <div class="chart-wrapper">
                        <canvas id="distribucionDiasSemana"></canvas>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Top 10 Fechas de Registro con Más Pedidos -->
            ${top10FechasRegistro.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📆 Top 10 Fechas de Registro con Más Pedidos</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Las 10 fechas en las que se registraron más pedidos durante diciembre 2025
                    </p>
                    <div style="max-height: 500px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px;">
                        <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; border-bottom: 2px solid #0056b3;">
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">#</th>
                                    <th style="padding: 12px; text-align: left; font-weight: bold;">Fecha</th>
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">Día de la Semana</th>
                                    <th style="padding: 12px; text-align: right; font-weight: bold;">Pedidos Registrados</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${top10FechasRegistro.map((f, idx) => `
                                <tr style="border-bottom: 1px solid #dee2e6; ${idx < 3 ? 'background: #f8f9fa;' : ''}">
                                    <td style="padding: 10px; text-align: center; font-weight: ${idx < 3 ? 'bold' : 'normal'}; color: ${idx === 0 ? '#007bff' : idx === 1 ? '#6c757d' : idx === 2 ? '#ffc107' : '#6c757d'};">
                                        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1)}
                                    </td>
                                    <td style="padding: 10px; font-weight: ${idx < 3 ? 'bold' : 'normal'};">
                                        ${f.fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </td>
                                    <td style="padding: 10px; text-align: center; color: #6c757d;">
                                        ${f.fecha.toLocaleDateString('es-ES', { weekday: 'long' })}
                                    </td>
                                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #007bff; font-size: 1.1em;">
                                        ${f.cantidad}
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Top 10 Fechas Agendadas con Más Pedidos -->
            ${top10FechasAgendadas.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📅 Top 10 Fechas Agendadas con Más Pedidos</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Las 10 fechas en las que se agendaron más pedidos durante diciembre 2025
                    </p>
                    <div style="max-height: 500px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px;">
                        <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-bottom: 2px solid #218838;">
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">#</th>
                                    <th style="padding: 12px; text-align: left; font-weight: bold;">Fecha</th>
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">Día de la Semana</th>
                                    <th style="padding: 12px; text-align: right; font-weight: bold;">Pedidos Agendados</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${top10FechasAgendadas.map((f, idx) => `
                                <tr style="border-bottom: 1px solid #dee2e6; ${idx < 3 ? 'background: #f8f9fa;' : ''}">
                                    <td style="padding: 10px; text-align: center; font-weight: ${idx < 3 ? 'bold' : 'normal'}; color: ${idx === 0 ? '#28a745' : idx === 1 ? '#17a2b8' : idx === 2 ? '#ffc107' : '#6c757d'};">
                                        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1)}
                                    </td>
                                    <td style="padding: 10px; font-weight: ${idx < 3 ? 'bold' : 'normal'};">
                                        ${f.fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </td>
                                    <td style="padding: 10px; text-align: center; color: #6c757d;">
                                        ${f.fecha.toLocaleDateString('es-ES', { weekday: 'long' })}
                                    </td>
                                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #28a745; font-size: 1.1em;">
                                        ${f.cantidad}
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Gráfico de Medios de Transporte -->
            <div class="section">
                <h2 class="section-title">🚚 Medios de Transporte Utilizados</h2>
                <div class="chart-container">
                    <div class="chart-wrapper">
                        <canvas id="transporteChart"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Top 10 Clientes Más Valiosos -->
            ${top10MasValiosos.length > 0 ? `
            <div class="section">
                <h2 class="section-title">💎 Top 10 Clientes Más Valiosos</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Clientes con mayor recurrencia (más pedidos) durante diciembre 2025
                    </p>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px;">
                        <table style="width: 100%; font-size: 0.95em; border-collapse: collapse;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-bottom: 2px solid #218838;">
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">#</th>
                                    <th style="padding: 12px; text-align: left; font-weight: bold;">Cliente</th>
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">Pedidos</th>
                                    <th style="padding: 12px; text-align: right; font-weight: bold;">Total Ingresos</th>
                                    <th style="padding: 12px; text-align: right; font-weight: bold;">Promedio/Pedido</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${top10MasValiosos.map((c, idx) => `
                                <tr style="border-bottom: 1px solid #dee2e6; ${idx < 3 ? 'background: #f8f9fa;' : ''}">
                                    <td style="padding: 10px; text-align: center; font-weight: ${idx < 3 ? 'bold' : 'normal'}; color: ${idx === 0 ? '#28a745' : idx === 1 ? '#17a2b8' : idx === 2 ? '#ffc107' : '#6c757d'};">
                                        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1)}
                                    </td>
                                    <td style="padding: 10px; font-weight: ${idx < 3 ? 'bold' : 'normal'};">${c.nombre}</td>
                                    <td style="padding: 10px; text-align: center; font-weight: bold; color: #28a745; font-size: 1.1em;">${c.totalPedidos}</td>
                                    <td style="padding: 10px; text-align: right; color: #6c757d;">${c.totalIngresos.toFixed(2)} Bs</td>
                                    <td style="padding: 10px; text-align: right; color: #6c757d;">${c.promedioPorPedido.toFixed(2)} Bs</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Top 10 Clientes Menos Valiosos -->
            ${top10MenosValiosos.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📉 Top 10 Clientes Menos Valiosos</h2>
                <div class="chart-container">
                    <p style="color: #6c757d; margin-bottom: 20px; font-size: 0.95em;">
                        📍 Clientes con menor recurrencia (menos pedidos) durante diciembre 2025
                    </p>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px;">
                        <table style="width: 100%; font-size: 0.95em; border-collapse: collapse;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; border-bottom: 2px solid #495057;">
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">#</th>
                                    <th style="padding: 12px; text-align: left; font-weight: bold;">Cliente</th>
                                    <th style="padding: 12px; text-align: center; font-weight: bold;">Pedidos</th>
                                    <th style="padding: 12px; text-align: right; font-weight: bold;">Total Ingresos</th>
                                    <th style="padding: 12px; text-align: right; font-weight: bold;">Promedio/Pedido</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${top10MenosValiosos.map((c, idx) => `
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 10px; text-align: center; color: #6c757d;">${idx + 1}</td>
                                    <td style="padding: 10px;">${c.nombre}</td>
                                    <td style="padding: 10px; text-align: center; font-weight: bold; color: #dc3545;">${c.totalPedidos}</td>
                                    <td style="padding: 10px; text-align: right; color: #6c757d;">${c.totalIngresos.toFixed(2)} Bs</td>
                                    <td style="padding: 10px; text-align: right; color: #6c757d;">${c.promedioPorPedido.toFixed(2)} Bs</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Insights Detallados -->
            <div class="section">
                <h2 class="section-title">💡 Insights y Análisis Detallado</h2>
                <div class="insights-grid">
                    ${statsRecojo ? `
                    <div class="insight-card">
                        <h3>📏 Distancias ECO → Recojo</h3>
                        <div class="insight-item">
                            <div class="insight-label">Media desde oficina</div>
                            <div class="insight-value">${statsRecojo.media.toFixed(2)} km</div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-label">Desviación Estándar</div>
                            <div class="insight-value">${statsRecojo.desviacion.toFixed(2)} km</div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-label">Rango Más Común (Q1-Q3)</div>
                            <div class="insight-value">${statsRecojo.q1.toFixed(2)} - ${statsRecojo.q3.toFixed(2)} km</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${statsEntrega ? `
                    <div class="insight-card">
                        <h3>📦 Distancias ECO → Entrega</h3>
                        <div class="insight-item">
                            <div class="insight-label">Media desde oficina</div>
                            <div class="insight-value">${statsEntrega.media.toFixed(2)} km</div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-label">Desviación Estándar</div>
                            <div class="insight-value">${statsEntrega.desviacion.toFixed(2)} km</div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-label">Rango Más Común (Q1-Q3)</div>
                            <div class="insight-value">${statsEntrega.q1.toFixed(2)} - ${statsEntrega.q3.toFixed(2)} km</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="insight-card">
                        <h3>🏆 Records desde ECO</h3>
                        <div class="insight-item">
                            <div class="insight-label">Recojo Más Distante del ECO</div>
                            <div class="insight-value">${maxRecojo.distanciaRecojo?.toFixed(2) || 'N/A'} km</div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-label">Entrega Más Distante del ECO</div>
                            <div class="insight-value">${maxEntrega.distanciaEntrega?.toFixed(2) || 'N/A'} km</div>
                        </div>
                        <div class="insight-item">
                            <div class="insight-label">Carrera Más Larga</div>
                            <div class="insight-value">${carreraMasLarga.distanciaTotal?.toFixed(2) || 'N/A'} km</div>
                            <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">
                                (Columna 'Dist. [Km]' del sheet)
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
    <button class="btn-pdf" onclick="generarPDF()">📄 Descargar PDF</button>
    
    <script>
        // Función para generar PDF usando html2canvas + jsPDF
        async function generarPDF() {
            const btn = document.querySelector('.btn-pdf');
            btn.disabled = true;
            btn.textContent = '⏳ Generando PDF...';
            
            try {
                // Esperar a que los gráficos se rendericen
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const { jsPDF } = window.jspdf;
                const container = document.querySelector('.container');
                
                // Usar html2canvas para capturar el contenido
                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 210; // A4 width in mm
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pageHeight = 297; // A4 height in mm
                let heightLeft = imgHeight;
                let position = 0;
                
                // Agregar primera página
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
                
                // Agregar páginas adicionales si es necesario
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
                
                // Guardar PDF
                pdf.save('Analisis_Diciembre_2025.pdf');
                
                btn.disabled = false;
                btn.textContent = '📄 Descargar PDF';
                alert('✅ PDF generado exitosamente!');
            } catch (error) {
                console.error('Error generando PDF:', error);
                btn.disabled = false;
                btn.textContent = '📄 Descargar PDF';
                alert('❌ Error al generar PDF. Usa el botón de Imprimir como alternativa.');
            }
        }
        
        // Script para gráficos
        // Histograma - Recojo
        ${histogramaRecojo.length > 0 ? `
        new Chart(document.getElementById('histogramaRecojo'), {
            type: 'bar',
            data: {
                labels: [${histogramaRecojo.map(d => d.x.toFixed(2)).join(',')}],
                datasets: [{
                    label: 'Frecuencia',
                    data: [${histogramaRecojo.map(d => d.y).join(',')}],
                    backgroundColor: '#28a745',
                    borderColor: '#218838',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribución Real de Distancias desde ECO hasta Recojo',
                        font: { size: 18 }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Distancia (km)', font: { size: 14, weight: 'bold' } },
                        min: 0,
                        max: 10,
                        ticks: {
                            stepSize: 0.5,
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: { 
                        title: { display: true, text: 'Cantidad de Pedidos', font: { size: 14, weight: 'bold' } }, 
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    annotation: {
                        annotations: {
                            q1: {
                                type: 'line',
                                xMin: ${statsRecojo.q1},
                                xMax: ${statsRecojo.q1},
                                borderColor: '#ffc107',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Q1: ${statsRecojo.q1.toFixed(2)} km',
                                    position: 'end',
                                    backgroundColor: '#ffc107',
                                    color: 'white',
                                    padding: 5,
                                    font: { size: 11, weight: 'bold' }
                                }
                            },
                            mediana: {
                                type: 'line',
                                xMin: ${statsRecojo.mediana},
                                xMax: ${statsRecojo.mediana},
                                borderColor: '#17a2b8',
                                borderWidth: 2,
                                borderDash: [3, 3],
                                label: {
                                    display: true,
                                    content: 'Mediana: ${statsRecojo.mediana.toFixed(2)} km',
                                    position: 'end',
                                    backgroundColor: '#17a2b8',
                                    color: 'white',
                                    padding: 5,
                                    font: { size: 11, weight: 'bold' }
                                }
                            },
                            q3: {
                                type: 'line',
                                xMin: ${statsRecojo.q3},
                                xMax: ${statsRecojo.q3},
                                borderColor: '#dc3545',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Q3: ${statsRecojo.q3.toFixed(2)} km',
                                    position: 'end',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    padding: 5,
                                    font: { size: 11, weight: 'bold' }
                                }
                            }
                        }
                    }
                }
            }
        });
        ` : ''}
        
        // Histograma - Entrega
        ${histogramaEntrega.length > 0 ? `
        new Chart(document.getElementById('histogramaEntrega'), {
            type: 'bar',
            data: {
                labels: [${histogramaEntrega.map(d => d.x.toFixed(2)).join(',')}],
                datasets: [{
                    label: 'Frecuencia',
                    data: [${histogramaEntrega.map(d => d.y).join(',')}],
                    backgroundColor: '#17a2b8',
                    borderColor: '#138496',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribución Real de Distancias desde ECO hasta Entrega',
                        font: { size: 18 }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Distancia (km)', font: { size: 14, weight: 'bold' } },
                        min: 0,
                        max: 10,
                        ticks: {
                            stepSize: 2,
                            callback: function(value) {
                                return value.toFixed(0);
                            }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: { 
                        title: { display: true, text: 'Cantidad de Pedidos', font: { size: 14, weight: 'bold' } }, 
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    annotation: {
                        annotations: {
                            q1: {
                                type: 'line',
                                xMin: ${statsEntrega.q1},
                                xMax: ${statsEntrega.q1},
                                borderColor: '#ffc107',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Q1: ${statsEntrega.q1.toFixed(2)} km',
                                    position: 'end',
                                    backgroundColor: '#ffc107',
                                    color: 'white',
                                    padding: 5,
                                    font: { size: 11, weight: 'bold' }
                                }
                            },
                            mediana: {
                                type: 'line',
                                xMin: ${statsEntrega.mediana},
                                xMax: ${statsEntrega.mediana},
                                borderColor: '#28a745',
                                borderWidth: 2,
                                borderDash: [3, 3],
                                label: {
                                    display: true,
                                    content: 'Mediana: ${statsEntrega.mediana.toFixed(2)} km',
                                    position: 'end',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    padding: 5,
                                    font: { size: 11, weight: 'bold' }
                                }
                            },
                            q3: {
                                type: 'line',
                                xMin: ${statsEntrega.q3},
                                xMax: ${statsEntrega.q3},
                                borderColor: '#dc3545',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Q3: ${statsEntrega.q3.toFixed(2)} km',
                                    position: 'end',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    padding: 5,
                                    font: { size: 11, weight: 'bold' }
                                }
                            }
                        }
                    }
                }
            }
        });
        ` : ''}
        
        // Gráfico de Tendencia Temporal
        ${tendenciaTemporal.length > 0 ? `
        new Chart(document.getElementById('tendenciaTemporal'), {
            type: 'line',
            data: {
                labels: [${tendenciaTemporal.map(t => `'${t.dia}'`).join(',')}],
                datasets: [{
                    label: 'Promedio ECO → Recojo',
                    data: [${tendenciaTemporal.map(t => t.promedioRecojo.toFixed(2)).join(',')}],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false
                }, {
                    label: 'Promedio ECO → Entrega',
                    data: [${tendenciaTemporal.map(t => t.promedioEntrega.toFixed(2)).join(',')}],
                    borderColor: '#17a2b8',
                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Evolución Diaria de Distancias Promedio',
                        font: { size: 18 }
                    },
                    legend: { display: true }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Día de Diciembre', font: { size: 14, weight: 'bold' } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: { 
                        title: { display: true, text: 'Distancia Promedio (km)', font: { size: 14, weight: 'bold' } },
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
        ` : ''}
        
        // Histograma de Carreras Totales
        ${histogramaCarreras.length > 0 ? `
        new Chart(document.getElementById('histogramaCarreras'), {
            type: 'bar',
            data: {
                labels: [${histogramaCarreras.map(d => d.x.toFixed(2)).join(',')}],
                datasets: [{
                    label: 'Frecuencia',
                    data: [${histogramaCarreras.map(d => d.y).join(',')}],
                    backgroundColor: '#6f42c1',
                    borderColor: '#5a32a3',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribución de Distancias Totales de Carreras',
                        font: { size: 18 }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Distancia Total (km)', font: { size: 14, weight: 'bold' } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: { 
                        title: { display: true, text: 'Cantidad de Carreras', font: { size: 14, weight: 'bold' } },
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
        ` : ''}
        
        // Distribución por Día de la Semana
        ${distribucionDiasSemana.length > 0 ? `
        new Chart(document.getElementById('distribucionDiasSemana'), {
            type: 'bar',
            data: {
                labels: [${distribucionDiasSemana.map(d => `'${d.dia}'`).join(',')}],
                datasets: [{
                    label: 'Cantidad de Pedidos',
                    data: [${distribucionDiasSemana.map(d => d.cantidad).join(',')}],
                    backgroundColor: '#007bff',
                    borderColor: '#0056b3',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribución de Pedidos por Día de la Semana',
                        font: { size: 18 }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Día de la Semana', font: { size: 14, weight: 'bold' } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: { 
                        title: { display: true, text: 'Cantidad de Pedidos', font: { size: 14, weight: 'bold' } },
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
        ` : ''}
        
        // Gráfico de Transporte
        new Chart(document.getElementById('transporteChart'), {
            type: 'doughnut',
            data: {
                labels: [${transporteLabels.map(l => `'${l}'`).join(',')}],
                datasets: [{
                    data: [${transporteValues.join(',')}],
                    backgroundColor: [${transporteLabels.map((_, i) => `'${transporteColors[i % transporteColors.length]}'`).join(',')}],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribución de Medios de Transporte',
                        font: { size: 18 }
                    },
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    </script>
</body>
</html>`
}

// Ejecutar
generarAnalisis().catch(error => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})
