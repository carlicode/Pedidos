import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse' // Para carga de Google Sheets
import * as XLSX from 'xlsx' // Para crear archivos Excel
import Icon from '../components/Icon.jsx'
import { getBackendUrl, apiFetch, getApiUrl } from '../utils/api.js'

// ===== FUNCIONES PARA FECHAS Y HORAS BOLIVIANAS =====
const getBoliviaTime = () => {
  const now = new Date()
  const boliviaOffset = -4 * 60 // -4 horas en minutos
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  return new Date(utc + (boliviaOffset * 60000))
}

// ===== CONFIGURACIÓN =====
const AUTOS_DISPONIBLES = [
  '6265 LUH', '6265 LXL', '6265 LYR', 
  '6419 DLK', '6419 DKG', 
  '6430 CKX', '6430 CIS', 
  '6445 SLA', '6788 GXD', '6788 NRT'
]

const AUTOS_GRANDES = ['6430 CKX', '6419 DKG', '6788 GXD']

const HORARIOS_TRABAJO = [
  '5:00', '5:30', '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '0:00', '0:30', '1:00'
]

// Función para convertir horario a rango (ej: "5:00" -> "5:00-5:30")
const getHorarioRango = (horario) => {
  const index = HORARIOS_TRABAJO.indexOf(horario)
  if (index === -1 || index === HORARIOS_TRABAJO.length - 1) {
    return horario // Si no hay siguiente, mostrar solo el horario
  }
  const siguiente = HORARIOS_TRABAJO[index + 1]
  return `${horario}-${siguiente}`
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Drivers por defecto basados en los datos reales
const DRIVERS_DEFAULT = ['Alexander', 'Abraham', 'Fabricio', 'Ivan', 'Jose', 'Marcos', 'Melania', 'Patricia', 'Paola Aliaga', 'Thiago', 'William', 'Paulo', 'Ricardo', 'Alejandra', 'Miguel', 'Paulo']

// Colores para drivers (para identificación visual) - 15 colores únicos
const DRIVER_COLORS = {
  'Jose': '#FF6B6B',        // Rojo coral
  'Gersson': '#4ECDC4',     // Turquesa
  'Thiago': '#45B7D1',      // Azul cielo
  'Patricia': '#96CEB4',    // Verde menta
  'Paola': '#FFEAA7',       // Amarillo claro
  'Abraham': '#DDA0DD',     // Violeta claro
  'Marcos': '#98D8C8',      // Verde agua
  'Will': '#F7DC6F',        // Amarillo dorado
  'Fabri': '#BB8FCE',       // Púrpura claro
  'Ivan': '#85C1E9',        // Azul claro
  'Carlos': '#F8C471',      // Naranja claro
  'Maria': '#82E0AA',       // Verde lima
  'Ana': '#F1948A',         // Rosa salmón
  'Luis': '#85C1E9',        // Azul marino claro
  'Sofia': '#D7BDE2'        // Lavanda
}

// Paleta de colores extendida (15 colores únicos)
const COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#5DADE2', '#D7BDE2'
]

// Función para obtener color de driver
const getDriverColor = (driverName) => {
  // Si el driver ya tiene color asignado, usarlo
  if (DRIVER_COLORS[driverName]) {
    return DRIVER_COLORS[driverName]
  }
  
  // Para drivers nuevos, asignar color de la paleta basado en el nombre
  const hash = driverName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  const colorIndex = Math.abs(hash) % COLOR_PALETTE.length
  return COLOR_PALETTE[colorIndex]
}

// Función para obtener color único por auto
const getAutoColor = (autoName) => {
  const autoColors = [
    '#E8F4FD', '#FFF2CC', '#D5E8D4', '#F8CECC', '#E1D5E7',
    '#FFE6CC', '#F0F0F0', '#D4EDDA', '#F8D7DA', '#D1ECF1'
  ]
  
  const hash = autoName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  const colorIndex = Math.abs(hash) % autoColors.length
  return autoColors[colorIndex]
}

// ===== COMPONENTE PRINCIPAL =====
export default function Horarios() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('horarios-propuestos')
  
  // Estados para drivers
  const [drivers, setDrivers] = useState(() => {
    const saved = localStorage.getItem('horarios-drivers')
    if (saved) {
      const parsedDrivers = JSON.parse(saved)
      return parsedDrivers
    }
    // Empezar con lista vacía hasta cargar el ranking
    return []
  })

  // Función para cargar ranking desde la pestaña "Ranking" del Google Sheet
  const cargarRankingDesdeSheets = async () => {
    try {
      // Primero intentar cargar desde Google Sheets
      console.log('📊 Intentando cargar ranking desde Google Sheets...')
      
      // Intentar diferentes URLs para acceder a la pestaña "Ranking"
      const possibleUrls = [
        // URL con gid=0 (primera pestaña)
        'https://docs.google.com/spreadsheets/d/1szlVPL_4leSsCmjw0s1RM3knno2WcBTRim29UZ40Lak/export?format=csv&gid=0',
        // URL con gid=1 (segunda pestaña)
        'https://docs.google.com/spreadsheets/d/1szlVPL_4leSsCmjw0s1RM3knno2WcBTRim29UZ40Lak/export?format=csv&gid=1',
        // URL con gid=2 (tercera pestaña)
        'https://docs.google.com/spreadsheets/d/1szlVPL_4leSsCmjw0s1RM3knno2WcBTRim29UZ40Lak/export?format=csv&gid=2',
        // URL alternativa con output=csv
        'https://docs.google.com/spreadsheets/d/1szlVPL_4leSsCmjw0s1RM3knno2WcBTRim29UZ40Lak/edit?gid=0&usp=sharing&output=csv',
        'https://docs.google.com/spreadsheets/d/1szlVPL_4leSsCmjw0s1RM3knno2WcBTRim29UZ40Lak/edit?gid=1&usp=sharing&output=csv',
        'https://docs.google.com/spreadsheets/d/1szlVPL_4leSsCmjw0s1RM3knno2WcBTRim29UZ40Lak/edit?gid=2&usp=sharing&output=csv'
      ]
      
      let csvUrl = ''
      let csvText = ''
      let success = false
      
      // Intentar cada URL hasta encontrar una que funcione
      for (const url of possibleUrls) {
        try {
          console.log(`🔄 Intentando URL: ${url}`)
          const response = await fetch(url)
          
          if (response.ok) {
            const text = await response.text()
            // Verificar si el contenido parece ser CSV válido
            if (text.includes('Nombre') && text.includes('Puesto') && !text.includes('class extends')) {
              csvUrl = url
              csvText = text
              success = true
              console.log(`✅ URL exitosa encontrada: ${url}`)
              break
            }
          }
        } catch (error) {
          console.log(`❌ URL falló: ${url} - ${error.message}`)
          continue
        }
      }
      
      if (!success) {
        throw new Error('No se pudo acceder a ninguna pestaña del Google Sheet')
      }
      console.log('📄 CSV recibido (primeros 500 chars):', csvText.substring(0, 500))
      
      // Validar que el contenido sea realmente CSV
      if (csvText.includes('class extends') || csvText.includes('constructor') || csvText.includes('_.O')) {
        throw new Error('El contenido recibido no es un CSV válido. Verifica que el Google Sheet esté configurado correctamente.')
      }
      
      // Parsear CSV manualmente con mejor manejo de comillas y separadores
      const lines = csvText.trim().split('\n').filter(line => line.trim())
      const rankingData = []
      
      console.log('📋 Líneas encontradas:', lines.length)
      
      // Buscar la línea de header
      let headerIndex = -1
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        if (line.includes('nombre') && line.includes('puesto')) {
          headerIndex = i
          break
        }
      }
      
      if (headerIndex === -1) {
        throw new Error('No se encontró el header con "Nombre" y "Puesto" en el CSV')
      }
      
      console.log('📋 Header encontrado en línea:', headerIndex)
      
      // Procesar datos desde después del header
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line && !line.startsWith('#')) { // Ignorar líneas vacías y comentarios
          // Mejor parsing de CSV que maneja comillas
          const parts = []
          let current = ''
          let inQuotes = false
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              parts.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          parts.push(current.trim()) // Agregar la última parte
          
          if (parts.length >= 2) {
            const nombre = parts[0].replace(/"/g, '').trim()
            const puestoStr = parts[1].replace(/"/g, '').trim()
            const puesto = parseFloat(puestoStr.replace(',', '.')) // Manejar decimales con coma
            
            if (nombre && nombre.length > 0 && !isNaN(puesto)) {
              rankingData.push({
                nombre,
                puntuacion: puesto,
                posicion: rankingData.length + 1
              })
              console.log(`📊 Driver: ${nombre} - ${puesto} pts`)
            }
          }
        }
      }
      
      console.log('📋 Ranking procesado:', rankingData)
      
      if (rankingData.length === 0) {
        throw new Error('No se encontraron datos válidos en el ranking. Verifica el formato del Google Sheet.')
      }
      
      // Crear drivers con el ranking cargado
      const driversConRanking = rankingData.map((item, index) => ({
        id: Date.now() + Math.random() + index,
        name: item.nombre,
        genero: '', // Se configurará manualmente
        esMadreSoltera: false, // Se configurará manualmente
        esJoven: false, // Se configurará manualmente
        telefono: '',
        direccion: '',
        puntuacion: item.puntuacion,
        posicion: item.posicion
      }))
      
      // Actualizar drivers
      setDrivers(driversConRanking)
      
      console.log('✅ Ranking cargado exitosamente:', driversConRanking.length, 'drivers')
      alert(`✅ Ranking cargado exitosamente!\n\n📊 Se cargaron ${driversConRanking.length} drivers desde el Google Sheet.\n\nAhora puedes configurar el género, madre soltera o joven para cada uno.`)
      
    } catch (error) {
      console.error('❌ Error cargando ranking desde Google Sheets:', error)
      
      // Si falla, usar datos de prueba del ranking que mencionaste
      console.log('📊 Cargando datos de prueba del ranking...')
      
      const rankingPrueba = [
        { nombre: 'William', puntuacion: 66.60, posicion: 1 },
        { nombre: 'Patricia', puntuacion: 59.64, posicion: 2 },
        { nombre: 'Paola Aliaga', puntuacion: 55.18, posicion: 3 },
        { nombre: 'Alexander', puntuacion: 54.67, posicion: 4 },
        { nombre: 'Thiago', puntuacion: 52.05, posicion: 5 },
        { nombre: 'Jose', puntuacion: 45.98, posicion: 6 },
        { nombre: 'Abraham', puntuacion: 45.94, posicion: 7 },
        { nombre: 'Ivan', puntuacion: 44.82, posicion: 8 },
        { nombre: 'Paulo', puntuacion: 44.51, posicion: 9 },
        { nombre: 'Marcos', puntuacion: 34.68, posicion: 10 },
        { nombre: 'Ricardo', puntuacion: 34.52, posicion: 11 },
        { nombre: 'Fabricio', puntuacion: 28.32, posicion: 12 },
        { nombre: 'Alejandra', puntuacion: 27.08, posicion: 13 },
        { nombre: 'Melania', puntuacion: 21.87, posicion: 14 }
      ]
      
      // Crear drivers con el ranking de prueba
      const driversConRanking = rankingPrueba.map((item, index) => ({
        id: Date.now() + Math.random() + index,
        name: item.nombre,
        genero: '', // Se configurará manualmente
        esMadreSoltera: false, // Se configurará manualmente
        esJoven: false, // Se configurará manualmente
        telefono: '',
        direccion: '',
        puntuacion: item.puntuacion,
        posicion: item.posicion
      }))
      
      // Actualizar drivers
      setDrivers(driversConRanking)
      
      console.log('✅ Ranking de prueba cargado:', driversConRanking.length, 'drivers')
      alert(`⚠️ No se pudo cargar desde Google Sheets\n\n✅ Se cargaron ${driversConRanking.length} drivers con datos de prueba del ranking.\n\nAhora puedes configurar el género, madre soltera o joven para cada uno.\n\nPara usar datos reales, verifica la configuración del Google Sheet.`)
    }
  }
  
  // Estados para disponibilidad (formato: {driverId: {dia: {horario: true/false}}} )
  const [disponibilidad, setDisponibilidad] = useState(() => {
    const saved = localStorage.getItem('horarios-disponibilidad')
    return saved ? JSON.parse(saved) : {}
  })

  // Estados para autos disponibles
  const [autos, setAutos] = useState(() => {
    const autosDefault = [
      { id: 1, nombre: '6265 LUH' },
      { id: 2, nombre: '6265 LXL' },
      { id: 3, nombre: '6265 LYR' },
      { id: 4, nombre: '6419 DLK' },
      { id: 5, nombre: '6419 DKG' },
      { id: 6, nombre: '6430 CKX' },
      { id: 7, nombre: '6430 CIS' },
      { id: 8, nombre: '6445 SLA' },
      { id: 9, nombre: '6788 GXD' },
      { id: 10, nombre: '6788 NRT' }
    ]
    
    const saved = localStorage.getItem('horarios-autos')
    if (saved) {
      const autosSaved = JSON.parse(saved)
      // Verificar si faltan autos nuevos y agregarlos
      const nombresGuardados = autosSaved.map(a => a.nombre)
      const autosFaltantes = autosDefault.filter(a => !nombresGuardados.includes(a.nombre))
      
      if (autosFaltantes.length > 0) {
        console.log('🔄 Sincronizando autos nuevos:', autosFaltantes.map(a => a.nombre))
        const autosActualizados = [...autosSaved, ...autosFaltantes]
        localStorage.setItem('horarios-autos', JSON.stringify(autosActualizados))
        return autosActualizados
      }
      return autosSaved
    }
    
    return autosDefault
  })

  // Estados para autos asignados por driver y día
  const [autosAsignados, setAutosAsignados] = useState(() => {
    const saved = localStorage.getItem('horarios-autos-asignados')
    return saved ? JSON.parse(saved) : {} // Formato: {driverId-dia: autoNombre}
  })
  
  // Estados para asignaciones finales
  // NO cargar desde caché para evitar problemas con autos nuevos
  const [asignacionesFinales, setAsignacionesFinales] = useState({})
  
  // Estados para UI
  const [expandedDrivers, setExpandedDrivers] = useState(new Set()) // Drivers con horarios expandidos
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = getBoliviaTime()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  // Estados para edición de horarios
  const [editingCell, setEditingCell] = useState(null) // {auto, dia, horario}
  const [showDriverDropdown, setShowDriverDropdown] = useState(false)
  
  // Estados para agregar drivers y autos
  const [showAddDriverModal, setShowAddDriverModal] = useState(false)
  const [showAddAutoModal, setShowAddAutoModal] = useState(false)
  const [newDriverName, setNewDriverName] = useState('')
  const [newDriverGenero, setNewDriverGenero] = useState('')
  const [newDriverEsMadreSoltera, setNewDriverEsMadreSoltera] = useState(false)
  const [newDriverEsJoven, setNewDriverEsJoven] = useState(false)
  const [newAutoName, setNewAutoName] = useState('')
  const [newAutoType, setNewAutoType] = useState('normal') // 'normal' o 'grande'
  
  // Estados para funcionalidad de arrastre (drag to paint)
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState(null) // true = disponible, false = no disponible
  const [saving, setSaving] = useState(false)
 
  // Guardar datos en el servidor JSON (sobrescribe el archivo anterior)
  const saveData = useCallback(async () => {
    try {
      setSaving(true)
      console.log('💾 Guardando datos en el servidor...')
      
      const datosParaGuardar = {
        drivers,
        disponibilidades: disponibilidad,
        autosAsignados,
        asignacionesFinales,
        mesActual: parseInt(selectedMonth.split('-')[1]) - 1,
        añoActual: parseInt(selectedMonth.split('-')[0])
      }
      
      const response = await apiFetch('/api/horarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosParaGuardar)
      })
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Datos guardados en JSON del servidor')
        
        // También guardar en localStorage como respaldo
        localStorage.setItem('horarios-drivers', JSON.stringify(drivers))
        localStorage.setItem('horarios-disponibilidad', JSON.stringify(disponibilidad))
        localStorage.setItem('horarios-autos-asignados', JSON.stringify(autosAsignados))
        
        alert('✅ Cambios guardados exitosamente en el servidor')
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('❌ Error guardando en el servidor:', error)
      alert(`❌ Error al guardar: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }, [drivers, disponibilidad, autos, autosAsignados, asignacionesFinales, selectedMonth])

  // Cargar datos desde el servidor al iniciar
  useEffect(() => {
    const cargarDatosDesdeServidor = async () => {
      try {
        console.log('📥 Cargando datos desde el servidor...')
        
        const response = await apiFetch('/api/horarios')
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.data) {
          const data = result.data
          
          // Cargar drivers
          if (data.drivers && Array.isArray(data.drivers)) {
            setDrivers(data.drivers)
            console.log('✅ Drivers cargados desde servidor:', data.drivers.length)
          }
          
          // Cargar disponibilidades
          if (data.disponibilidades) {
            setDisponibilidad(data.disponibilidades)
            console.log('✅ Disponibilidades cargadas desde servidor')
          }
          
          // Cargar autos asignados
          if (data.autosAsignados) {
            setAutosAsignados(data.autosAsignados)
            console.log('✅ Autos asignados cargados desde servidor')
          }
          
          // Cargar asignaciones finales
          if (data.asignacionesFinales) {
            setAsignacionesFinales(data.asignacionesFinales)
            console.log('✅ Asignaciones finales cargadas desde servidor')
          }
          
          console.log('🎉 Todos los datos cargados desde el servidor JSON')
        } else {
          console.log('⚠️ No hay datos en el servidor, usando valores por defecto')
        }
      } catch (error) {
        console.error('❌ Error cargando datos del servidor:', error)
        console.log('📦 Usando datos de localStorage como respaldo')
      }
    }
    
    cargarDatosDesdeServidor()
  }, [])

  // Manejar evento mouseup global para terminar el arrastre
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp()
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging]) // Sin dependencias para que solo se ejecute una vez

  // Funciones para gestionar drivers
  const agregarDriver = () => {
    const nuevoDriver = {
      id: Date.now(),
      name: `Driver ${drivers.length + 1}`,
      auto: ''
    }
    setDrivers([...drivers, nuevoDriver])
  }

  const editarDriver = (id, newName) => {
    setDrivers(drivers.map(driver => 
      driver.id === id ? { ...driver, name: newName } : driver
    ))
  }

  // Función para actualizar cualquier campo del driver sin perder datos
  const actualizarDriver = (id, campo, valor) => {
    setDrivers(drivers.map(driver => 
      driver.id === id ? { ...driver, [campo]: valor } : driver
    ))
  }

  // Función para actualizar estado de joven
  const actualizarJoven = (id, esJoven) => {
    actualizarDriver(id, 'esJoven', esJoven)
  }

  // Nota: La asignación de autos ahora se hace directamente en el selector de cada driver

  // Función para generar horarios programáticamente
  const generarHorario = useCallback(() => {
    console.log('🎯 Generando horario programáticamente...')
    console.log('📊 Drivers disponibles:', drivers.length)
    console.log('📅 Disponibilidad configurada:', Object.keys(disponibilidad).length)
    
    // Validar que hay drivers cargados
    if (drivers.length === 0) {
      alert('❌ No hay drivers cargados. Primero carga el ranking desde Google Sheets usando el botón "Cargar desde Google Sheets".')
      return
    }
    
    // Validar que hay disponibilidad configurada
    const driversConDisponibilidad = drivers.filter(driver => disponibilidad[driver.id])
    if (driversConDisponibilidad.length === 0) {
      alert('❌ No hay disponibilidad configurada.\n\nPrimero configura los horarios de disponibilidad para cada driver usando la cuadrícula verde/roja.')
      return
    }
    
    // Validar que hay autos asignados configurados
    const driversConAuto = drivers.filter(driver => {
      return DIAS_SEMANA.some(dia => autosAsignados[`${driver.id}-${dia}`])
    })
    
    if (driversConAuto.length === 0) {
      alert('❌ No hay autos asignados.\n\nPrimero asigna un auto a cada driver en la tabla de "Autos Asignados por Día".')
      return
    }
    
    console.log('✅ Drivers con disponibilidad:', driversConDisponibilidad.length)
    console.log('✅ Drivers con auto asignado:', driversConAuto.length)
    
    console.log('🎯 Generando horario automático con prioridades...')
    console.log('📊 Drivers cargados:', drivers.length)
    console.log('📅 Con disponibilidad:', driversConDisponibilidad.length)
    console.log('🚗 Con auto asignado:', driversConAuto.length)
    
    // Llamar a la función optimizada que ya tiene toda la lógica
    generarAsignacionesFinales()
    
    console.log('✅ Horario generado exitosamente - Ver pestaña "Vista por Auto" o "Vista por Driver"')
  }, [drivers, disponibilidad, autos, autosAsignados])

  const eliminarDriver = (id) => {
    setDrivers(drivers.filter(driver => driver.id !== id))
    // Limpiar disponibilidad del driver eliminado
    const newDisponibilidad = { ...disponibilidad }
    delete newDisponibilidad[id]
    setDisponibilidad(newDisponibilidad)
  }


  // Funciones para manejar pestañas desplegables
  const toggleDriverExpansion = (driverId) => {
    const newExpanded = new Set(expandedDrivers)
    if (newExpanded.has(driverId)) {
      newExpanded.delete(driverId)
    } else {
      newExpanded.add(driverId)
    }
    setExpandedDrivers(newExpanded)
  }

  const isDriverExpanded = (driverId) => {
    return expandedDrivers.has(driverId)
  }

  // Función para cargar drivers con ranking desde Google Sheets
  const cargarHorariosDesdeSheets = async () => {
    try {
      // URL del Google Sheet de evaluación de drivers - pestaña "Ranking" (publicada)
      const rankingSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRBu4g4uqEv8CNUXNecSpSIy4xqvcsPT3N-J-jl-HtMAk2O8nh-Bq38l319USoyixX4Xu7tKcWzOmyP/pub?gid=589605927&single=true&output=csv'
      
      console.log('📊 Cargando datos de ranking desde Google Sheets...')
      console.log('📊 URL:', rankingSheetUrl)
      
      const response = await fetch(rankingSheetUrl)
      
      // Verificar si la respuesta fue exitosa
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}. Asegúrate de que el documento esté compartido públicamente.`)
      }
      
      const csvText = await response.text()
      
      // Verificar que realmente obtuvimos datos CSV
      if (!csvText || csvText.trim().length === 0) {
        throw new Error('El documento está vacío o no se pudo leer.')
      }
      
      // Parsear CSV
      const results = Papa.parse(csvText, { header: true, skipEmptyLines: true })
      const data = results.data
      
      console.log('📊 Datos cargados desde Google Sheets:', data)
      
      // Procesar datos de ranking - formato simple: Nombre, Puesto
      const driversConRanking = []
      
      data.forEach((fila, index) => {
        // La pestaña "Ranking" tiene columnas: Nombre, Puesto
        const nombre = fila['Nombre'] || fila['nombre']
        let puesto = fila['Puesto'] || fila['puesto']
        
        if (nombre && puesto) {
          // Convertir comas a puntos para números decimales (formato europeo -> formato JS)
          puesto = puesto.toString().replace(',', '.')
          const puntuacion = parseFloat(puesto)
          
          if (!isNaN(puntuacion) && nombre.trim().length > 0) {
            driversConRanking.push({
              nombre: nombre.trim(),
              puntuacion: puntuacion,
              posicion: index + 1 // La posición se determina por el orden en el sheet
            })
          }
        }
      })
      
      console.log('🏆 Drivers con ranking:', driversConRanking)
      
      // Crear drivers completamente nuevos desde el Google Sheet
      // Preservamos solo la información de género y atributos especiales de drivers existentes
      const driversMap = new Map(drivers.map(d => [d.name, d]))
      
      const nuevosDrivers = driversConRanking.map((driverData, index) => {
        const driverExistente = driversMap.get(driverData.nombre)
        
        return {
          id: driverExistente?.id || Date.now() + Math.random() + index,
          name: driverData.nombre,
          puntuacion: driverData.puntuacion,
          posicion: driverData.posicion,
          // Preservar atributos especiales si el driver ya existía
          genero: driverExistente?.genero || '',
          esMadreSoltera: driverExistente?.esMadreSoltera || false,
          esJoven: driverExistente?.esJoven || false
        }
      })
      
      // Reemplazar completamente los drivers con los nuevos datos
      setDrivers(nuevosDrivers)
      
      // Limpiar disponibilidad para empezar un horario nuevo
      const disponibilidadLimpia = {}
      setDisponibilidad(disponibilidadLimpia)
      
      // Guardar inmediatamente en localStorage
      localStorage.setItem('horarios-drivers', JSON.stringify(nuevosDrivers))
      localStorage.setItem('horarios-disponibilidad', JSON.stringify(disponibilidadLimpia))
      
      // Mostrar resumen
      const mensaje = `✅ Se cargaron ${driversConRanking.length} drivers con ranking:\n\n` +
        driversConRanking.slice(0, 5).map(d => 
          `${d.posicion}. ${d.nombre} - ${d.puntuacion.toFixed(2)} pts`
        ).join('\n') +
        (driversConRanking.length > 5 ? `\n... y ${driversConRanking.length - 5} más` : '') +
        '\n\n🔄 Los horarios se limpiaron para iniciar desde cero.'
      
      alert(mensaje)
      
    } catch (error) {
      console.error('❌ Error cargando ranking desde Google Sheets:', error)
      const mensajeError = `❌ Error al cargar ranking desde Google Sheets.

Por favor verifica que:
1. El documento esté compartido como "Cualquiera con el enlace puede ver"
2. La pestaña "Ranking" tenga las columnas: Nombre, Puesto
3. Los datos estén en formato correcto

Error técnico: ${error.message}`
      
      alert(mensajeError)
    }
  }

  // Funciones para manejar disponibilidad (estilo When2Meet)
  const toggleDisponibilidad = (driverId, dia, horario) => {
    const newDisponibilidad = { ...disponibilidad }
    
    if (!newDisponibilidad[driverId]) {
      newDisponibilidad[driverId] = {}
    }
    if (!newDisponibilidad[driverId][dia]) {
      newDisponibilidad[driverId][dia] = {}
    }
    
    const isCurrentlySelected = newDisponibilidad[driverId][dia][horario]
    newDisponibilidad[driverId][dia][horario] = !isCurrentlySelected
    
    console.log(`🔄 Toggle: ${driverId} ${dia} ${horario} - ${isCurrentlySelected ? 'verde→rojo' : 'rojo→verde'}`)
    
    setDisponibilidad(newDisponibilidad)
  }

  // Funciones para manejar arrastre (drag to paint)
  const handleMouseDown = (driverId, dia, horario) => {
    setIsDragging(true)
    const currentValue = isDisponible(driverId, dia, horario)
    // El valor que vamos a pintar es el opuesto del valor actual
    setDragValue(!currentValue)
    // Cambiar el valor de la celda donde se inició el drag
    setDisponibilidadDirecta(driverId, dia, horario, !currentValue)
    console.log('🖱️ Inicio arrastre:', driverId, dia, horario, '→', !currentValue ? 'disponible' : 'no disponible')
  }

  const handleMouseEnter = (driverId, dia, horario) => {
    if (isDragging && dragValue !== null) {
      // Pintar con el valor que se estableció al iniciar el drag
      setDisponibilidadDirecta(driverId, dia, horario, dragValue)
      console.log('🎨 Pintando:', driverId, dia, horario, '→', dragValue ? 'disponible' : 'no disponible')
    }
  }

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      setDragValue(null)
      console.log('🖱️ Fin arrastre')
    }
  }

  // Función auxiliar para establecer disponibilidad sin toggle
  const setDisponibilidadDirecta = (driverId, dia, horario, valor) => {
    const newDisponibilidad = { ...disponibilidad }
    
    if (!newDisponibilidad[driverId]) {
      newDisponibilidad[driverId] = {}
    }
    if (!newDisponibilidad[driverId][dia]) {
      newDisponibilidad[driverId][dia] = {}
    }
    
    newDisponibilidad[driverId][dia][horario] = valor
    setDisponibilidad(newDisponibilidad)
  }

  const isDisponible = (driverId, dia, horario) => {
    return disponibilidad[driverId]?.[dia]?.[horario] || false
  }

  // Función para eliminar un driver de una postulación específica
  const eliminarPostulacion = (autoNombre, dia, horario, driverId) => {
    console.log(`🗑️ Eliminando postulación: ${driverId} de ${autoNombre} ${dia} ${horario}`)
    
    const nuevasAsignaciones = { ...asignacionesFinales }
    
    if (nuevasAsignaciones[autoNombre]?.[dia]?.[horario]?.drivers) {
      // Filtrar el driver que queremos eliminar
      const driversRestantes = nuevasAsignaciones[autoNombre][dia][horario].drivers.filter(id => id !== driverId)
      
      if (driversRestantes.length > 0) {
        // Si quedan drivers, actualizar la lista
        nuevasAsignaciones[autoNombre][dia][horario].drivers = driversRestantes
      } else {
        // Si no quedan drivers, eliminar toda la entrada
        delete nuevasAsignaciones[autoNombre][dia][horario]
      }
      
      setAsignacionesFinales(nuevasAsignaciones)
      console.log(`✅ Postulación eliminada. Drivers restantes:`, driversRestantes.length)
    }
  }

  // Función para guardar el horario final (después de eliminar postulaciones no deseadas)
  const guardarHorarioFinal = () => {
    console.log('🔍 Verificando conflictos antes de guardar...')
    
    // Verificar que no haya más de un driver en ningún horario
    const conflictos = []
    
    Object.entries(asignacionesFinales).forEach(([dia, horarios]) => {
      Object.entries(horarios).forEach(([horario, asignacion]) => {
        if (asignacion.drivers && asignacion.drivers.length > 1) {
          // Obtener nombres de drivers
          const nombresDrivers = asignacion.drivers.map(driverId => {
            const driver = drivers.find(d => d.id === driverId)
            return driver ? driver.name : 'Desconocido'
          })
          
          // Obtener nombre del auto
          const auto = autos.find(a => a.id === asignacion.auto)
          const nombreAuto = auto ? auto.nombre : 'Desconocido'
          
          conflictos.push({
            dia,
            horario,
            auto: nombreAuto,
            drivers: nombresDrivers
          })
        }
      })
    })
    
    if (conflictos.length > 0) {
      // Hay conflictos sin resolver
      const mensajeConflictos = conflictos.map(c => 
        `\n• ${c.auto} - ${c.dia} ${c.horario}: ${c.drivers.join(' vs ')}`
      ).join('')
      
      alert(`❌ No se puede guardar el horario.\n\nAún hay ${conflictos.length} conflicto(s) sin resolver:\n${mensajeConflictos}\n\nPor favor, elimina los drivers que no quieres usando el botón × rojo antes de guardar.`)
      console.error('❌ Conflictos encontrados:', conflictos)
      return
    }
    
    // No hay conflictos, guardar
    localStorage.setItem('horarios-asignaciones-finales-guardado', JSON.stringify(asignacionesFinales))
    localStorage.setItem('horarios-asignaciones-guardado-timestamp', new Date().toISOString())
    console.log('💾 Horario final guardado en caché')
    
    alert('✅ Horario guardado exitosamente')
    
    // Cambiar automáticamente a "Vista por Driver"
    setActiveTab('drivers-schedule')
  }

  // Algoritmo de optimización de horarios con priorización inteligente
  const generarAsignacionesFinales = () => {
    console.log('='.repeat(80))
    console.log('🔄 GENERANDO VISTA DE POSTULACIONES POR PRIORIDAD')
    console.log('='.repeat(80))
    console.log('📊 Total de drivers:', drivers.length)
    console.log('📊 Total de autos disponibles:', AUTOS_DISPONIBLES.length)
    console.log('📊 Drivers con disponibilidad:', Object.keys(disponibilidad).length)
    console.log('📊 Estado completo de disponibilidad:', JSON.stringify(disponibilidad, null, 2))
    console.log('📊 Autos asignados:', autosAsignados)
    
    // Paso 1: Ordenar drivers por prioridad
    const driversPriorizados = [...drivers].sort((a, b) => {
      // Prioridad 1: Madres solteras (más importante)
      if (a.esMadreSoltera && !b.esMadreSoltera) return -1
      if (!a.esMadreSoltera && b.esMadreSoltera) return 1
      
      // Prioridad 2: Mujeres
      if (a.genero === 'F' && b.genero !== 'F') return -1
      if (a.genero !== 'F' && b.genero === 'F') return 1
      
      // Prioridad 3: Jóvenes
      if (a.esJoven && !b.esJoven) return -1
      if (!a.esJoven && b.esJoven) return 1
      
      // Prioridad 4: Ranking (mayor puntuación primero)
      const puntuacionA = a.puntuacion || 0
      const puntuacionB = b.puntuacion || 0
      return puntuacionB - puntuacionA
    })
    
    console.log('🏆 Drivers ordenados por prioridad:', driversPriorizados.map(d => ({
      nombre: d.name,
      esMadreSoltera: d.esMadreSoltera,
      genero: d.genero,
      esJoven: d.esJoven,
      puntuacion: d.puntuacion
    })))
    
    // Paso 2: Inicializar estructura de asignaciones
    // Estructura: asignaciones[auto][dia][horario] = [driverName1, driverName2, ...] (ordenados por prioridad)
    const asignaciones = {}
    const estadisticas = {
      totalPostulaciones: 0,
      driversConPostulaciones: 0,
      autosConPostulaciones: new Set()
    }
    
    AUTOS_DISPONIBLES.forEach(auto => {
      asignaciones[auto] = {}
      DIAS_SEMANA.forEach(dia => {
        asignaciones[auto][dia] = {}
      })
    })

    // Paso 3: Recopilar postulaciones de todos los drivers
    driversPriorizados.forEach(driver => {
      if (!disponibilidad[driver.id]) {
        console.log(`⚠️ ${driver.name} (ID: ${driver.id}) - No tiene disponibilidad registrada`)
        return
      }
      
      const prioridad = driver.esMadreSoltera ? '👩‍👧‍👦 Madre Soltera' : 
                         driver.genero === 'F' ? '👩 Mujer' : 
                         driver.esJoven ? '👦 Joven' : 
                         '👤 Regular'
      console.log(`🎯 Procesando driver: ${driver.name} (ID: ${driver.id}) (Prioridad: ${prioridad}, Ranking: #${driver.posicion || 'N/A'} - ${driver.puntuacion?.toFixed(1) || '0'} pts)`)
      
      // Para cada día que el driver tiene disponibilidad
      DIAS_SEMANA.forEach(dia => {
        // Obtener el auto asignado para este día específico
        const autoAsignado = autosAsignados[`${driver.id}-${dia}`]
        
        if (!autoAsignado) {
          console.log(`  ⚠️ ${driver.name} - No tiene auto asignado para ${dia}`)
          return // Si no tiene auto asignado para este día, saltar
        }
        
        console.log(`  ✅ ${driver.name} - Auto asignado para ${dia}: ${autoAsignado}`)
        
        // Verificar todos los horarios disponibles del driver en este día
        const horariosDisponibles = disponibilidad[driver.id]?.[dia] || {}
        const horariosCount = Object.entries(horariosDisponibles).filter(([h, disp]) => disp).length
        
        if (horariosCount > 0) {
          console.log(`    📅 ${dia}: ${horariosCount} horarios disponibles`)
        }
        
        Object.entries(horariosDisponibles).forEach(([horario, isDisponible]) => {
          if (isDisponible) {
            // Verificar que el auto existe en asignaciones
            if (!asignaciones[autoAsignado]) {
              console.error(`❌ ERROR: Auto "${autoAsignado}" no existe en estructura de asignaciones`)
              console.error(`📋 Autos en asignaciones:`, Object.keys(asignaciones))
              return
            }
            
            // Agregar este driver a la lista de postulantes para este auto/día/horario
            if (!asignaciones[autoAsignado][dia][horario]) {
              asignaciones[autoAsignado][dia][horario] = []
            }
            
            asignaciones[autoAsignado][dia][horario].push(driver.name)
            estadisticas.totalPostulaciones++
            estadisticas.autosConPostulaciones.add(autoAsignado)
            
            console.log(`      ✅ ${driver.name} → ${autoAsignado} | ${dia} ${horario}`)
          }
        })
      })
    })
    
    // Paso 4: Convertir estructura de asignaciones a formato que espera la vista
    // De: asignaciones[auto][dia][horario] = [driverName1, driverName2, ...] (ordenados por prioridad)
    // A: asignacionesFinales[auto][dia][horario] = { drivers: [driverId1, driverId2, ...], auto: autoId }
    // CAMBIO: Ahora la estructura es por auto primero, para evitar sobreescribir
    const asignacionesParaVista = {}
    
    console.log('🔄 Iniciando conversión de postulaciones...')
    console.log('📋 Postulaciones internas:', JSON.stringify(asignaciones, null, 2))
    console.log('🚗 Array de autos disponible:', autos.map(a => `${a.nombre} (ID: ${a.id})`))
    
    Object.entries(asignaciones).forEach(([autoNombre, diasAuto]) => {
      console.log(`🔍 Buscando auto: "${autoNombre}"`)
      const auto = autos.find(a => a.nombre === autoNombre)
      if (!auto) {
        console.error(`❌ Auto no encontrado en array de autos: "${autoNombre}"`)
        console.error(`📋 Autos disponibles:`, autos.map(a => `"${a.nombre}" (ID: ${a.id})`))
        return
      }
      
      console.log(`✅ Auto encontrado: "${autoNombre}" → ID: ${auto.id}`)
      
      // Contar cuántos horarios tiene este auto
      let totalHorarios = 0
      Object.values(diasAuto).forEach(horariosdia => {
        totalHorarios += Object.keys(horariosdia).length
      })
      console.log(`  📊 Total de horarios con asignaciones: ${totalHorarios}`)
      
      // Crear estructura para este auto si no existe
      if (!asignacionesParaVista[autoNombre]) {
        asignacionesParaVista[autoNombre] = {}
      }
      
      Object.entries(diasAuto).forEach(([dia, horariosdia]) => {
        if (!asignacionesParaVista[autoNombre][dia]) {
          asignacionesParaVista[autoNombre][dia] = {}
        }
        
        Object.entries(horariosdia).forEach(([horario, driverNames]) => {
          if (driverNames && driverNames.length > 0) {
            // Convertir nombres de drivers a IDs
            const driverIds = driverNames.map(name => {
              const driver = drivers.find(d => d.name === name)
              return driver ? driver.id : null
            }).filter(id => id !== null)
            
            if (driverIds.length > 0) {
              // Guardar en estructura por auto
              asignacionesParaVista[autoNombre][dia][horario] = {
                drivers: driverIds, // Array de IDs, el primero tiene mayor prioridad
                auto: auto.id
              }
              
              if (driverIds.length > 1) {
                const allNames = driverIds.map(id => {
                  const d = drivers.find(dr => dr.id === id)
                  return d ? d.name : 'Unknown'
                })
                console.log(`⚔️ Conflicto en ${autoNombre} ${dia} ${horario}: ${allNames.join(' vs ')} (${driverIds.length} postulantes)`)
              } else {
                console.log(`✅ ${autoNombre} ${dia} ${horario}: ${driverNames[0]} (sin conflicto)`)
              }
            }
          }
        })
      })
    })
    
    console.log('📝 Postulaciones convertidas para vista:', asignacionesParaVista)
    console.log('🔍 Total de autos con asignaciones:', Object.keys(asignaciones).length)
    console.log('🔍 Autos con asignaciones:', Object.keys(asignaciones))
    console.log('🔍 Total de autos disponibles:', AUTOS_DISPONIBLES.length)
    console.log('🔍 Autos disponibles:', AUTOS_DISPONIBLES)
    
    setAsignacionesFinales(asignacionesParaVista)
    
    // NO guardar en caché para evitar problemas con datos desactualizados
    // Los horarios se regeneran cada vez que se presiona "Generar Horario"
    console.log('✅ Horarios generados exitosamente (sin caché)')
    
    // Paso 5: Mostrar resultados en consola
    console.log('🎉 Generación completada:', estadisticas)
    console.log(`📊 Total postulaciones: ${estadisticas.totalPostulaciones}`)
    console.log(`🚗 Autos con postulaciones: ${estadisticas.autosConPostulaciones.size}/${AUTOS_DISPONIBLES.length}`)
    
    // Cambiar automáticamente a la pestaña "Vista por Auto"
    setActiveTab('horarios-finales')
  }

  // Función para restaurar desde backup
  const restaurarDesdeBackup = () => {
    const backupDrivers = localStorage.getItem('horarios-drivers-backup')
    const backupDisponibilidad = localStorage.getItem('horarios-disponibilidad-backup')
    
    if (backupDrivers && backupDisponibilidad) {
      setDrivers(JSON.parse(backupDrivers))
      setDisponibilidad(JSON.parse(backupDisponibilidad))
      console.log('🔄 Datos restaurados desde backup')
      alert('✅ Datos restaurados desde backup')
    } else {
      alert('❌ No hay backup disponible')
    }
  }

  // Función para manejar clic en celda de horario
  const handleCellClick = (auto, dia, horario) => {
    setEditingCell({ auto, dia, horario })
    setShowDriverDropdown(true)
  }

  // Función para asignar/desasignar driver
  const handleDriverAssignment = (driverName) => {
    if (!editingCell) return

    const { auto, dia, horario } = editingCell
    
    // Crear una copia de las asignaciones
    const nuevasAsignaciones = { ...asignacionesFinales }
    
    // Inicializar estructura si no existe
    if (!nuevasAsignaciones[auto]) {
      nuevasAsignaciones[auto] = {}
    }
    if (!nuevasAsignaciones[auto][dia]) {
      nuevasAsignaciones[auto][dia] = {}
    }
    
    // Asignar o desasignar driver
    if (driverName === '') {
      // Desasignar (limpiar)
      delete nuevasAsignaciones[auto][dia][horario]
    } else {
      // Asignar driver
      nuevasAsignaciones[auto][dia][horario] = driverName
    }
    
    // Actualizar estado
    setAsignacionesFinales(nuevasAsignaciones)
    
    // Cerrar dropdown
    setShowDriverDropdown(false)
    setEditingCell(null)
    
    console.log(`✅ ${driverName ? 'Asignado' : 'Desasignado'} ${driverName || 'driver'} en ${auto} ${dia} ${horario}`)
  }

  // Función para cerrar dropdown
  const closeDriverDropdown = () => {
    setShowDriverDropdown(false)
    setEditingCell(null)
  }

  // Función para agregar nuevo driver
  const handleAddDriver = () => {
    if (!newDriverName.trim()) {
      alert('❌ Por favor ingresa un nombre para el driver')
      return
    }

    if (!newDriverGenero) {
      alert('❌ Por favor selecciona el género del driver')
      return
    }

    // Verificar si el driver ya existe
    const driverExists = drivers.some(d => d.name.toLowerCase() === newDriverName.toLowerCase())
    if (driverExists) {
      alert('❌ Ya existe un driver con ese nombre')
      return
    }

    // Crear nuevo driver
    const newDriver = {
      id: Date.now() + Math.random(), // ID único
      name: newDriverName.trim(),
      genero: newDriverGenero,
      esMadreSoltera: newDriverEsMadreSoltera,
      esJoven: newDriverEsJoven,
      telefono: '',
      direccion: '',
      puntuacion: 0, // Puntuación por defecto
      posicion: drivers.length + 1 // Posición por defecto
    }

    // Agregar driver a la lista
    setDrivers(prev => [...prev, newDriver])
    
    // Inicializar disponibilidad vacía
    setDisponibilidad(prev => ({
      ...prev,
      [newDriver.id]: {}
    }))

    // Limpiar formulario y cerrar modal
    setNewDriverName('')
    setNewDriverGenero('')
    setNewDriverEsMadreSoltera(false)
    setNewDriverEsJoven(false)
    setShowAddDriverModal(false)
    
    console.log('✅ Nuevo driver agregado:', newDriver.name)
    alert(`✅ Driver "${newDriver.name}" agregado exitosamente`)
  }

  // Función para agregar nuevo auto
  const handleAddAuto = () => {
    if (!newAutoName.trim()) {
      alert('❌ Por favor ingresa un nombre para el auto')
      return
    }

    // Verificar si el auto ya existe
    const autoExists = AUTOS_DISPONIBLES.includes(newAutoName.trim())
    if (autoExists) {
      alert('❌ Ya existe un auto con ese nombre')
      return
    }

    // Agregar auto a la lista (esto requerirá actualizar las constantes)
    // Por ahora, mostraremos un mensaje de que se necesita reiniciar
    alert(`✅ Auto "${newAutoName.trim()}" agregado. Nota: Para que aparezca en las pestañas, reinicia la aplicación.`)
    
    // Limpiar formulario y cerrar modal
    setNewAutoName('')
    setNewAutoType('normal')
    setShowAddAutoModal(false)
    
    console.log('✅ Nuevo auto agregado:', newAutoName.trim(), 'Tipo:', newAutoType)
  }

  // Función para eliminar driver
  const handleDeleteDriver = (driverId) => {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return

    if (confirm(`¿Estás seguro de que quieres eliminar al driver "${driver.name}"?`)) {
      // Remover driver de la lista
      setDrivers(prev => prev.filter(d => d.id !== driverId))
      
      // Remover disponibilidad
      setDisponibilidad(prev => {
        const newDisponibilidad = { ...prev }
        delete newDisponibilidad[driverId]
        return newDisponibilidad
      })


      console.log('🗑️ Driver eliminado:', driver.name)
      alert(`✅ Driver "${driver.name}" eliminado exitosamente`)
    }
  }


  // Renderizar gestión de drivers
  const renderDriversTab = () => {
    return (
      <div className="drivers-tab">
        <div className="drivers-header">
          <h3>👥 Gestión de Drivers</h3>
          <div className="drivers-header-actions">
            <button className="btn btn-info" onClick={cargarRankingDesdeSheets}>
              <Icon name="download" size={16} />
              Cargar Ranking
            </button>
          <button className="btn btn-success" onClick={() => setShowAddDriverModal(true)}>
            <Icon name="plus" size={16} />
            Agregar Driver
          </button>
             <button 
              className="btn btn-primary" 
              onClick={saveData}
              disabled={saving}
            >
              <Icon name="save" size={16} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        <div className="drivers-list">
          {drivers
            .sort((a, b) => {
              // Prioridad 1: Madres solteras
              if (a.esMadreSoltera && !b.esMadreSoltera) return -1
              if (!a.esMadreSoltera && b.esMadreSoltera) return 1
              
              // Prioridad 2: Mujeres
              if (a.genero === 'F' && b.genero !== 'F') return -1
              if (a.genero !== 'F' && b.genero === 'F') return 1
              
              // Prioridad 3: Jóvenes
              if (a.esJoven && !b.esJoven) return -1
              if (!a.esJoven && b.esJoven) return 1
              
              // Prioridad 4: Ranking (mayor puntuación primero)
              return b.puntuacion - a.puntuacion
            })
            .map(driver => (
            <div key={driver.id} className="driver-item">
              <div className="driver-info">
                <input
                  type="text"
                  value={driver.name}
                  onChange={(e) => editarDriver(driver.id, e.target.value)}
                  className="driver-name-input"
                />
                
                {/* Badge de ranking */}
                {driver.posicion > 0 && driver.posicion <= 14 && (
                  <span className="ranking-badge">
                    #{driver.posicion} - {driver.puntuacion?.toFixed(1)} pts
                  </span>
                )}
                
                {/* Información de género y madre soltera */}
                <div className="driver-details">
                <select
                    value={driver.genero || ''}
                    onChange={(e) => actualizarDriver(driver.id, 'genero', e.target.value)}
                    className="gender-selector"
                  >
                    <option value="">Género</option>
                    <option value="M">Hombre</option>
                    <option value="F">Mujer</option>
                </select>
                  
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={driver.esMadreSoltera || false}
                      onChange={(e) => actualizarDriver(driver.id, 'esMadreSoltera', e.target.checked)}
                    />
                    <span>👩‍👧‍👦 Madre Soltera</span>
                  </label>
                  
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={driver.esJoven || false}
                      onChange={(e) => actualizarJoven(driver.id, e.target.checked)}
                    />
                    <span>👦 Joven</span>
                  </label>
                </div>
                
              </div>
              <div className="driver-actions">
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteDriver(driver.id)}
                  title="Eliminar Driver"
                >
                  <Icon name="trash2" size={16} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    )
  }


  // Renderizar horarios propuestos (nueva vista principal con pestañas)
  const renderHorariosPropuestos = () => {
    return (
      <div className="horarios-propuestos-tab">
        <div className="horarios-header-simple">
          <h3>📅 Horarios Propuestos - {selectedMonth}</h3>
          <p className="horarios-subtitle">Gestiona los horarios de cada driver y asigna autos</p>
          <div className="horarios-load-actions">
            <button 
              className="btn btn-info"
              onClick={() => setShowAddAutoModal(true)}
            >
              <Icon name="car" size={16} />
              Agregar Auto
            </button>
            <button 
              className="btn btn-outline btn-load"
              onClick={cargarHorariosDesdeSheets}
            >
              <Icon name="upload" size={16} />
              Cargar desde Google Sheets
            </button>
            <button 
              className="btn btn-primary"
              onClick={saveData}
              disabled={saving}
            >
              <Icon name="save" size={16} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        <div className="drivers-list-compact">
          {drivers
            .sort((a, b) => {
              // Prioridad 1: Madres solteras
              if (a.esMadreSoltera && !b.esMadreSoltera) return -1
              if (!a.esMadreSoltera && b.esMadreSoltera) return 1
              
              // Prioridad 2: Mujeres
              if (a.genero === 'F' && b.genero !== 'F') return -1
              if (a.genero !== 'F' && b.genero === 'F') return 1
              
              // Prioridad 3: Jóvenes
              if (a.esJoven && !b.esJoven) return -1
              if (!a.esJoven && b.esJoven) return 1
              
              // Prioridad 4: Ranking (mayor puntuación primero)
              return b.puntuacion - a.puntuacion
            })
            .map(driver => (
            <div key={driver.id} className="driver-compact-card">
              <div 
                className="driver-compact-header"
                onClick={() => toggleDriverExpansion(driver.id)}
              >
                <div className="driver-info-compact">
                  <h4>{driver.name}</h4>
                  <div className="driver-meta">
                    {driver.posicion > 0 && driver.posicion <= 14 && (
                      <span className="ranking-badge-compact">
                        #{driver.posicion} - {driver.puntuacion?.toFixed(1)} pts
                    </span>
                  )}
                    {driver.esMadreSoltera && (
                      <span className="priority-badge madre-soltera">👩‍👧‍👦 Madre Soltera</span>
                    )}
                    {driver.genero === 'F' && !driver.esMadreSoltera && (
                      <span className="priority-badge mujer">👩 Mujer</span>
                    )}
                    {driver.esJoven && (
                      <span className="priority-badge joven">👦 Joven</span>
                    )}
                  </div>
                </div>
                <div className="driver-actions-compact" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-success btn-small"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Guardar solo este driver
                      localStorage.setItem('horarios-drivers', JSON.stringify(drivers))
                      localStorage.setItem('horarios-disponibilidad', JSON.stringify(disponibilidad))
                      localStorage.setItem('horarios-autos-asignados', JSON.stringify(autosAsignados))
                      
                      // Log detallado de lo que se guardó
                      console.log(`✅ Horario guardado para ${driver.name}`)
                      console.log(`📊 Disponibilidad guardada:`, disponibilidad[driver.id])
                      console.log(`🚗 Autos asignados:`, Object.entries(autosAsignados)
                        .filter(([key]) => key.startsWith(driver.id))
                        .reduce((obj, [key, val]) => {
                          const dia = key.split('-')[1]
                          obj[dia] = val
                          return obj
                        }, {})
                      )
                      
                      // Mostrar notificación temporal
                      const notification = document.createElement('div')
                      notification.textContent = `✅ Guardado: ${driver.name}`
                      notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #10b981;
                        color: white;
                        padding: 15px 25px;
                        border-radius: 8px;
                        font-weight: bold;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        z-index: 10000;
                        animation: slideIn 0.3s ease-out;
                      `
                      document.body.appendChild(notification)
                      setTimeout(() => {
                        notification.style.animation = 'slideOut 0.3s ease-in'
                        setTimeout(() => notification.remove(), 300)
                      }, 2000)
                    }}
                    title="Guardar Horario"
                  >
                    💾
                  </button>
                  <button 
                    className="btn btn-danger btn-small btn-eliminar"
                    onClick={(e) => {
                      e.stopPropagation()
                      eliminarDriver(driver.id)
                    }}
                    title="Eliminar Driver"
                  >
                    🗑️
                  </button>
                </div>
                <div className="expand-icon">
                  <Icon 
                    name={isDriverExpanded(driver.id) ? "chevronUp" : "chevronDown"} 
                    size={16} 
                  />
                </div>
              </div>
              
              {isDriverExpanded(driver.id) && (
                <div className="driver-horarios-expanded">
                  <div className="horarios-instructions-compact">
                    <div className="legend-compact">
                      <div className="legend-item">
                        <div className="legend-color unavailable"></div>
                        <span>No Disponible</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-color available"></div>
                        <span>Disponible</span>
                      </div>
                    </div>
                    <p>Haz clic y arrastra para pintar los horarios disponibles</p>
                  </div>
                  
                  <div className="horarios-grid-container-compact">
                    <table className="horarios-grid-compact" onMouseLeave={() => setIsDragging(false)}>
                      <thead>
                        <tr>
                          <th className="time-header-compact">Horario</th>
                          {DIAS_SEMANA.map(dia => (
                            <th key={dia} className="day-header-compact">{dia.substring(0, 3)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {HORARIOS_TRABAJO.map(horario => (
                          <tr key={horario}>
                            <td className="time-cell-compact">{getHorarioRango(horario)}</td>
                            {DIAS_SEMANA.map(dia => (
                              <td
                                key={`${dia}-${horario}`}
                                className={`horario-cell-compact ${isDisponible(driver.id, dia, horario) ? 'disponible' : 'no-disponible'}`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleMouseDown(driver.id, dia, horario)
                                }}
                                onMouseEnter={() => handleMouseEnter(driver.id, dia, horario)}
                                style={{ userSelect: 'none' }}
                              >
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Selector de autos por día */}
                  <div className="auto-asignado-section">
                    <h5>🚗 Autos Asignados por Día</h5>
                    <p style={{fontSize: '13px', color: '#666', marginBottom: '10px'}}>
                      Asigna el auto que usará este driver para cada día de la semana
                    </p>
                    <div className="auto-por-dia-grid" style={{
                      display: 'flex',
                      gap: '12px',
                      marginTop: '15px',
                      flexWrap: 'nowrap',
                      overflowX: 'auto'
                    }}>
                      {DIAS_SEMANA.map(dia => {
                        const autoKey = `${driver.id}-${dia}`
                        const autoAsignado = autosAsignados[autoKey]
                        
                        return (
                          <div key={dia} style={{
                            padding: '8px',
                            backgroundColor: autoAsignado ? '#d1fae5' : '#f3f4f6',
                            borderRadius: '6px',
                            border: `2px solid ${autoAsignado ? '#10b981' : '#d1d5db'}`,
                            minWidth: '110px',
                            flex: '1 0 auto'
                          }}>
                            <label style={{
                              display: 'block',
                              fontWeight: 'bold',
                              marginBottom: '6px',
                              color: '#374151',
                              fontSize: '12px',
                              textAlign: 'center'
                            }}>
                              {dia.substring(0, 3)}
                            </label>
                            <select
                              value={autoAsignado || ''}
                              onChange={(e) => {
                                const nuevoAuto = e.target.value
                                setAutosAsignados(prev => ({
                                  ...prev,
                                  [autoKey]: nuevoAuto
                                }))
                                localStorage.setItem('horarios-autos-asignados', JSON.stringify({
                                  ...autosAsignados,
                                  [autoKey]: nuevoAuto
                                }))
                                console.log(`✅ Auto asignado a ${driver.name} para ${dia}: ${nuevoAuto}`)
                              }}
                              style={{
                                width: '100%',
                                padding: '6px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                fontSize: '11px',
                                backgroundColor: 'white'
                              }}
                            >
                              <option value="">-</option>
                              {AUTOS_DISPONIBLES.map(autoNombre => (
                                <option key={autoNombre} value={autoNombre}>
                                  {autoNombre}
                                </option>
                              ))}
                            </select>
                            {autoAsignado && (
                              <div style={{
                                marginTop: '4px',
                                padding: '2px 4px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                borderRadius: '3px',
                                fontSize: '9px',
                                textAlign: 'center',
                                fontWeight: 'bold'
                              }}>
                                {AUTOS_GRANDES.includes(autoAsignado) ? '🚐 G' : '🚗 N'}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botones de acción al final */}
        <div className="horarios-actions-footer">
          <div className="actions-info">
            <p>💡 <strong>Consejo:</strong> Asigna autos y configura horarios antes de generar el horario final</p>
          </div>
          <div className="actions-buttons">
            <button 
              className="btn btn-warning btn-large" 
              onClick={() => {
                if (confirm('⚠️ ¿Limpiar caché y regenerar horarios?\n\nEsto eliminará los horarios guardados y los regenerará desde cero.')) {
                  localStorage.removeItem('horarios-asignaciones-finales')
                  localStorage.removeItem('horarios-asignaciones-timestamp')
                  setAsignacionesFinales({})
                  console.log('🧹 Caché de horarios limpiado')
                  alert('✅ Caché limpiado. Ahora presiona "Generar Horario" nuevamente.')
                }
              }}
              style={{ backgroundColor: '#f59e0b', color: 'white' }}
            >
              🧹 Limpiar Caché
            </button>
            <button className="btn btn-secondary btn-large" onClick={descargarExcel}>
              <Icon name="download" size={18} />
              Descargar Excel
            </button>
            <button className="btn btn-primary btn-large" onClick={generarHorario}>
              <Icon name="calendar" size={18} />
              Generar Horario
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizar horarios finales por auto
  const renderHorariosFinales = () => {
    console.log('📊 Renderizando horarios finales, asignacionesFinales:', asignacionesFinales)
    console.log('🔍 Estado de asignacionesFinales:', JSON.stringify(asignacionesFinales, null, 2))
    return (
      <div className="horarios-finales-tab">
        <div className="horarios-header">
          <h3>🚗 Horarios por Auto - {selectedMonth}</h3>
          <div className="horarios-actions">
            <button className="btn btn-info" onClick={descargarPDF}>
              <Icon name="download" size={16} />
              Descargar PDF
            </button>
            <button className="btn btn-success" onClick={descargarExcel}>
              <Icon name="download" size={16} />
              Descargar Excel
          </button>
          </div>
        </div>


        <div className="autos-container">
          {AUTOS_DISPONIBLES.map(auto => {
            console.log(`🔍 Renderizando auto: ${auto}`)
            return (
            <div key={auto} className="auto-section">
              <div className={`auto-header ${AUTOS_GRANDES.includes(auto) ? 'auto-grande' : 'auto-normal'}`}>
                <h4>{auto}</h4>
                <span className="auto-type">
                  {AUTOS_GRANDES.includes(auto) ? 'Auto Grande' : 'Auto Normal'}
                </span>
              </div>
              
              <div className="auto-schedule">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th className="time-col">Horario</th>
                      {DIAS_SEMANA.map(dia => (
                        <th key={dia} className="day-col">{dia.substring(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORARIOS_TRABAJO.map(horario => (
                      <tr key={horario}>
                        <td className="time-cell">{getHorarioRango(horario)}</td>
                        {DIAS_SEMANA.map(dia => {
                          // Buscar asignación en la nueva estructura [autoNombre][dia][horario]
                          const asignacion = asignacionesFinales[auto]?.[dia]?.[horario]
                          let driversList = []
                          
                          if (asignacion && asignacion.drivers) {
                            // Obtener todos los drivers postulantes (ya ordenados por prioridad)
                            driversList = asignacion.drivers.map(driverId => {
                              const driver = drivers.find(d => d.id === driverId)
                              return driver ? driver.name : null
                            }).filter(name => name !== null)
                          }
                          
                          const esConflicto = driversList.length > 1
                          const primerDriver = driversList[0] || ''
                          const color = driversList.length > 0 ? getDriverColor(primerDriver) : 'transparent'
                          
                          return (
                            <td 
                              key={`${dia}-${horario}`} 
                              className={`schedule-cell ${esConflicto ? 'conflict-cell' : ''}`}
                              style={{
                                backgroundColor: color,
                                color: driversList.length > 0 ? '#000' : '#666',
                                fontWeight: driversList.length > 0 ? 'bold' : 'normal',
                                border: esConflicto ? '2px solid #FF6B35' : '1px solid #ddd',
                                fontSize: esConflicto ? '11px' : '12px',
                                padding: '4px',
                                lineHeight: '1.3'
                              }}
                              title={driversList.length > 0 ? `Postulantes (por prioridad):\n${driversList.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}` : '-'}
                            >
                              {driversList.length === 0 ? '-' : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {driversList.map((name, idx) => {
                                    const driverId = asignacion.drivers[idx]
                                    return (
                                      <div key={idx} style={{
                                        fontSize: idx === 0 ? '12px' : '10px',
                                        fontWeight: idx === 0 ? 'bold' : 'normal',
                                        opacity: idx === 0 ? 1 : 0.7,
                                        borderBottom: idx < driversList.length - 1 ? '1px dashed rgba(0,0,0,0.2)' : 'none',
                                        paddingBottom: idx < driversList.length - 1 ? '2px' : '0',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        <span>{name}</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            eliminarPostulacion(auto, dia, horario, driverId)
                                          }}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ff4444',
                                            cursor: 'pointer',
                                            padding: '0',
                                            fontSize: '14px',
                                            lineHeight: '1',
                                            fontWeight: 'bold'
                                          }}
                                          title={`Eliminar ${name} de esta postulación`}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                          </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )
          })}
        </div>

        {/* Botón para guardar horario final */}
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <button 
            className="btn btn-success btn-large" 
            onClick={guardarHorarioFinal}
            style={{ fontSize: '16px', padding: '12px 24px' }}
          >
            💾 Guardar Horario Final
          </button>
        </div>
      </div>
    )
  }

  // Renderizar horario de un auto específico
  const renderAutoIndividual = (auto) => {
    console.log(`🔍 Renderizando auto ${auto}`)
    console.log(`🔍 Asignaciones finales completas:`, asignacionesFinales)
    
    return (
      <div className="auto-individual-tab">
        <div className="auto-header-individual">
          <h3>🚗 {auto} - {AUTOS_GRANDES.includes(auto) ? 'Auto Grande' : 'Auto Normal'}</h3>
          <div className="auto-actions">
            <button className="btn btn-info" onClick={descargarPDF}>
              <Icon name="download" size={16} />
              Descargar PDF
            </button>
            <button className="btn btn-success" onClick={descargarExcel}>
              <Icon name="download" size={16} />
              Descargar Excel
            </button>
          </div>
        </div>

        {/* Leyenda de colores para este auto */}
        <div className="color-legend" style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
          <h4>🎨 Leyenda de Drivers:</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {drivers.map(driver => {
              const color = getDriverColor(driver.name)
              return (
                <div key={driver.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    backgroundColor: color, 
                    border: '1px solid #ccc',
                    borderRadius: '3px'
                  }}></div>
                  <span>{driver.name}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '10px', color: '#FF0000', fontWeight: 'bold' }}>
            ⚠️ Los conflictos se muestran con borde rojo
          </div>
        </div>

        <div className="auto-schedule-full">
          <table className="schedule-table-full">
            <thead>
              <tr>
                <th className="time-col">Horario</th>
                {DIAS_SEMANA.map(dia => (
                  <th key={dia} className="day-col">{dia}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORARIOS_TRABAJO.map(horario => (
                <tr key={horario}>
                  <td className="time-cell">{getHorarioRango(horario)}</td>
                  {DIAS_SEMANA.map(dia => {
                    // Buscar asignación en la nueva estructura
                    const asignacion = asignacionesFinales[dia]?.[horario]
                    let valor = '-'
                    let driverName = ''
                    
                    if (asignacion && asignacion.driver && asignacion.auto) {
                      // Verificar si este auto coincide con el que estamos mostrando
                      const autoAsignado = asignacion.auto
                      const nombreAuto = autos.find(a => a.id === autoAsignado)?.nombre || autoAsignado
                      
                      if (nombreAuto === auto) {
                        // Encontrar el nombre del driver
                        const driver = drivers.find(d => d.id === asignacion.driver)
                        if (driver) {
                          driverName = driver.name
                          valor = driverName
                          console.log(`🎯 ${auto} ${dia} ${horario}: ${driverName}`)
                        }
                      }
                    }
                    
                    const esConflicto = valor !== '-' && valor.includes(' vs ')
                    const color = valor !== '-' ? getDriverColor(driverName) : 'transparent'
                    
                    return (
                      <td 
                        key={`${dia}-${horario}`} 
                        className={`schedule-cell ${esConflicto ? 'conflict-cell' : ''} ${editingCell?.auto === auto && editingCell?.dia === dia && editingCell?.horario === horario ? 'editing-cell' : ''}`}
                        style={{
                          backgroundColor: color,
                          color: valor !== '-' ? '#000' : '#666',
                          fontWeight: valor !== '-' ? 'bold' : 'normal',
                          border: esConflicto ? '2px solid #FF0000' : '1px solid #ddd',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        title={esConflicto ? `CONFLICTO: ${valor}` : `Clic para editar: ${valor}`}
                        onClick={() => handleCellClick(auto, dia, horario)}
                      >
                        {valor}
                        
                        {/* Dropdown de drivers */}
                        {editingCell?.auto === auto && editingCell?.dia === dia && editingCell?.horario === horario && showDriverDropdown && (
                          <div className="driver-dropdown">
                            <div className="dropdown-header">
                              <span>Asignar Driver</span>
                              <button 
                                className="close-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  closeDriverDropdown()
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="dropdown-options">
                              <button 
                                className="dropdown-option clear-option"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDriverAssignment('')
                                }}
                              >
                                🗑️ Limpiar
                              </button>
                              {drivers.map(driver => (
                                <button 
                                  key={driver.id}
                                  className="dropdown-option"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDriverAssignment(driver.name)
                                  }}
                                  style={{ backgroundColor: getDriverColor(driver.name) }}
                                >
                                  {driver.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Renderizar vista por driver (qué auto manejará cada driver)
  const renderDriversSchedule = () => {
    console.log('📊 Renderizando vista por drivers')
    
    return (
      <div className="horarios-finales-tab">
        <div className="horarios-header">
          <h3>👥 Horarios por Driver - {selectedMonth}</h3>
          <div className="horarios-actions">
            <button className="btn btn-info" onClick={descargarPDF}>
              <Icon name="download" size={16} />
              Descargar PDF
            </button>
            <button className="btn btn-success" onClick={descargarExcel}>
              <Icon name="download" size={16} />
              Descargar Excel
            </button>
          </div>
        </div>

        <div className="autos-container">
          {drivers.map(driver => (
            <div key={driver.id} className="auto-section">
              <div className="auto-header auto-normal">
                <h4>{driver.name}</h4>
                <div className="driver-info">
                  {driver.posicion > 0 && driver.posicion <= 14 && (
                    <span className="ranking-badge-compact">
                      #{driver.posicion} - {driver.puntuacion?.toFixed(1)} pts
                    </span>
                  )}
                  {driver.esMadreSoltera && (
                    <span className="priority-badge madre-soltera">👩‍👧‍👦 Madre Soltera</span>
                  )}
                  {driver.genero === 'F' && !driver.esMadreSoltera && (
                    <span className="priority-badge mujer">👩 Mujer</span>
                  )}
                  {driver.esJoven && (
                    <span className="priority-badge joven">👦 Joven</span>
                  )}
                </div>
              </div>
              
              <div className="auto-schedule">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th className="time-col">Horario</th>
                      {DIAS_SEMANA.map(dia => (
                        <th key={dia} className="day-col">{dia.substring(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORARIOS_TRABAJO.map(horario => (
                      <tr key={horario}>
                        <td className="time-cell">{getHorarioRango(horario)}</td>
                        {DIAS_SEMANA.map(dia => {
                          // Buscar asignación para este driver en la nueva estructura
                          let autosList = []
                          
                          // Buscar en todas las asignaciones de autos
                          Object.entries(asignacionesFinales).forEach(([autoName, diasAuto]) => {
                            const asignacion = diasAuto[dia]?.[horario]
                            if (asignacion && asignacion.drivers && asignacion.drivers.includes(driver.id)) {
                              const driverIndex = asignacion.drivers.indexOf(driver.id)
                              const esPrioritario = driverIndex === 0
                              autosList.push({
                                nombre: autoName,
                                prioridad: esPrioritario,
                                conflicto: asignacion.drivers.length > 1,
                                drivers: asignacion.drivers
                              })
                            }
                          })
                          
                          const esConflicto = autosList.length > 0 && autosList[0].conflicto
                          const primerAuto = autosList[0]?.nombre || ''
                          const color = autosList.length > 0 ? getAutoColor(primerAuto) : 'transparent'
                          
                          return (
                            <td 
                              key={`${dia}-${horario}`} 
                              className={`schedule-cell ${esConflicto ? 'conflict-cell' : ''}`}
                              style={{
                                backgroundColor: color,
                                color: autosList.length > 0 ? '#000' : '#666',
                                fontWeight: autosList.length > 0 ? 'bold' : 'normal',
                                border: autosList.length > 0 && autosList[0].prioridad ? '2px solid #28a745' : '1px solid #ddd',
                                fontSize: esConflicto ? '11px' : '12px',
                                padding: '4px',
                                lineHeight: '1.3'
                              }}
                              title={autosList.length > 0 ? `Auto: ${primerAuto}${autosList[0].prioridad ? ' - Tiene prioridad' : ' - Postulado'}${esConflicto ? ' - Conflicto' : ''}` : '-'}
                            >
                              {autosList.length === 0 ? '-' : (
                                esConflicto ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {autosList[0].drivers.map((driverId, idx) => {
                                      const d = drivers.find(dr => dr.id === driverId)
                                      return d ? (
                                        <div key={idx} style={{
                                          fontSize: idx === 0 ? '12px' : '10px',
                                          fontWeight: idx === 0 ? 'bold' : 'normal',
                                          opacity: idx === 0 ? 1 : 0.7,
                                          borderBottom: idx < autosList[0].drivers.length - 1 ? '1px dashed rgba(0,0,0,0.2)' : 'none',
                                          paddingBottom: idx < autosList[0].drivers.length - 1 ? '2px' : '0'
                                        }}>
                                          {d.name}
                                        </div>
                                      ) : null
                                    })}
                                  </div>
                                ) : primerAuto
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Renderizar estadísticas
  const renderEstadisticas = () => {
    const stats = calcularEstadisticas()

    return (
      <div className="estadisticas-tab">
        <h3>📊 Estadísticas de Asignación</h3>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{drivers.length}</div>
            <div className="stat-label">Drivers Registrados</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.driversConHorarios}</div>
            <div className="stat-label">Drivers con Horarios</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalHorasDisponibles}</div>
            <div className="stat-label">Horas Disponibles Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{AUTOS_DISPONIBLES.length}</div>
            <div className="stat-label">Autos Disponibles</div>
          </div>
        </div>

        <div className="drivers-summary">
          <h4>👥 Resumen por Driver</h4>
          <div className="drivers-summary-grid">
            {drivers.map(driver => {
              const horasDisponibles = contarHorasDisponibles(driver.id)
              return (
                <div key={driver.id} className="driver-summary-card">
                  <div className="driver-summary-header">
                    <span className="driver-name">{driver.name}</span>
                    {driver.esMadreSoltera && (
                      <span className="priority-badge madre-soltera">👩‍👧‍👦 Madre Soltera</span>
                    )}
                    {driver.genero === 'F' && !driver.esMadreSoltera && (
                      <span className="priority-badge mujer">👩 Mujer</span>
                    )}
                  </div>
                  <div className="driver-summary-stats">
                    <div className="stat-item">
                      <span className="stat-number">{horasDisponibles}</span>
                      <span className="stat-text">horas disponibles</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const calcularEstadisticas = () => {
    let totalHorasDisponibles = 0

    drivers.forEach(driver => {
      totalHorasDisponibles += contarHorasDisponibles(driver.id)
    })

    return {
      totalHorasDisponibles,
      driversConHorarios: drivers.filter(driver => contarHorasDisponibles(driver.id) > 0).length
    }
  }

  const contarHorasDisponibles = (driverId) => {
    let count = 0
    const driverDisp = disponibilidad[driverId] || {}
    
    Object.values(driverDisp).forEach(dia => {
      Object.values(dia).forEach(isDisponible => {
        if (isDisponible) count++
      })
    })
    
    return count
  }

  // Generar datos para Excel
  const generarDatosExcel = () => {
    const datos = []
    
    // Fila vacía para espaciado
    datos.push([''])
    
    // Título principal
    const mesNombre = new Date(selectedMonth + '-01').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' })
    datos.push(['🐝 HORARIOS PROPUESTOS - ' + mesNombre.toUpperCase()])
    datos.push([''])
    
    // Headers con formato
    const encabezados = ['Driver', 'Auto Asignado', ...DIAS_SEMANA]
    datos.push(encabezados)
    
    // Línea separadora
    datos.push(['', '', '', '', '', '', '', '', ''])
    
    // Datos por driver
    drivers.forEach(driver => {
      const fila = [
        driver.name,
        driver.auto || 'No asignado',
        ...DIAS_SEMANA.map(dia => {
          const horariosDisponibles = disponibilidad[driver.id]?.[dia] || {}
          const horarios = Object.entries(horariosDisponibles)
            .filter(([_, disponible]) => disponible)
            .map(([horario, _]) => horario)
            .sort() // Ordenar horarios
            .join(', ')
          return horarios || 'No disponible'
        })
      ]
      datos.push(fila)
    })
    
    // Fila vacía para espaciado
    datos.push([''])
    
    // Información adicional
    const fechaGeneracion = new Date().toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    datos.push(['📅 Generado el:', fechaGeneracion])
    datos.push(['👥 Total Drivers:', drivers.length])
    datos.push(['🚗 Drivers con Auto:', drivers.filter(d => d.auto).length])
    datos.push(['📊 Horas disponibles total:', calcularTotalHorasDisponibles()])
    
    return datos
  }

  // Calcular total de horas disponibles
  const calcularTotalHorasDisponibles = () => {
    let total = 0
    drivers.forEach(driver => {
      Object.values(disponibilidad[driver.id] || {}).forEach(dia => {
        Object.values(dia).forEach(disponible => {
          if (disponible) total++
        })
      })
    })
    return total
  }

  // Descargar Excel con pestañas por driver y celdas pintadas
  const descargarExcel = () => {
    try {
      // BACKUP: Guardar estado actual antes de cualquier operación
      const backupDrivers = JSON.stringify(drivers)
      const backupDisponibilidad = JSON.stringify(disponibilidad)
      localStorage.setItem('horarios-drivers-backup', backupDrivers)
      localStorage.setItem('horarios-disponibilidad-backup', backupDisponibilidad)
      
      console.log('💾 Backup creado antes de descargar Excel')
      
      // Crear un nuevo workbook
      const workbook = XLSX.utils.book_new()
      
      // Crear una hoja para cada driver
      drivers.forEach(driver => {
        const sheetData = []
        
        // Filas de horarios (sin headers duplicados)
        HORARIOS_TRABAJO.forEach(horario => {
          const fila = [horario]
          
          DIAS_SEMANA.forEach(dia => {
            const isDisponible = disponibilidad[driver.id]?.[dia]?.[horario]
            fila.push(isDisponible ? 'DISPONIBLE' : '') // Texto "DISPONIBLE" si está disponible
          })
          
          sheetData.push(fila)
        })
        
        // Agregar información del auto y headers primero
        const worksheet = XLSX.utils.aoa_to_sheet([
          [`Auto Asignado: ${driver.auto || 'No asignado'}`],
          [''],
          ['Horario', ...DIAS_SEMANA],
          ...sheetData
        ])
        
        // Configurar el ancho de las columnas
        worksheet['!cols'] = [
          { width: 8 },  // Columna de horarios
          ...DIAS_SEMANA.map(() => ({ width: 12 })) // Columnas de días
        ]
        
        // Aplicar colores a las celdas
        const range = XLSX.utils.decode_range(worksheet['!ref'])
        
        // Colorear headers de días (fila 2 después de eliminar fila del driver)
        for (let col = 1; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 2, c: col })
          if (!worksheet[cellAddress]) continue
          
          worksheet[cellAddress].s = {
            fill: { fgColor: { rgb: "4A90E2" } }, // Azul como en Google Sheets
            font: { bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          }
        }
        
        // Colorear columna de horarios (desde fila 4)
        for (let row = 4; row <= range.e.r; row++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 })
          if (!worksheet[cellAddress]) continue
          
          worksheet[cellAddress].s = {
            fill: { fgColor: { rgb: "D4AF37" } }, // Dorado
            font: { bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          }
        }
        
        // Colorear celdas según disponibilidad (desde fila 4)
        for (let row = 4; row <= range.e.r; row++) {
          for (let col = 1; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
            if (!worksheet[cellAddress]) continue
            
            const horario = HORARIOS_TRABAJO[row - 4] // Ajustar índice (datos empiezan en fila 4)
            const dia = DIAS_SEMANA[col - 1]
            const isDisponible = disponibilidad[driver.id]?.[dia]?.[horario]
            
            // Configurar estilo de celda
            if (isDisponible) {
              worksheet[cellAddress].s = {
                fill: { fgColor: { rgb: "90EE90" } }, // Verde claro
                font: { bold: true, color: { rgb: "000000" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              }
            } else {
              worksheet[cellAddress].s = {
                fill: { fgColor: { rgb: "FFFFFF" } }, // Blanco
                font: { bold: false, color: { rgb: "000000" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              }
            }
          }
        }
        
        // El rango ya está configurado automáticamente por aoa_to_sheet
        
        // Agregar la hoja al workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, driver.name)
      })
      
      // Crear hoja resumen
      const resumenData = [
        ['🐝 HORARIOS PROPUESTOS - ' + selectedMonth.toUpperCase()],
        [''],
        ['Driver', 'Auto Asignado', 'Horas Disponibles'],
        ...drivers.map(driver => [
          driver.name,
          driver.auto || 'No asignado',
          contarHorasDisponibles(driver.id)
        ]),
        [''],
        ['📅 Generado el:', new Date().toLocaleDateString('es-BO')],
        ['👥 Total Drivers:', drivers.length],
        ['🚗 Drivers con Auto:', drivers.filter(d => d.auto).length],
        ['📊 Horas disponibles total:', calcularTotalHorasDisponibles()]
      ]
      
      const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData)
      XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen', 0)
      
      // Generar y descargar el archivo Excel
      const mesNombre = new Date(selectedMonth + '-01').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' })
      XLSX.writeFile(workbook, `🐝-horarios-${mesNombre.replace(' ', '-')}.xlsx`)
      
    } catch (error) {
      console.error('❌ Error generando Excel:', error)
      alert('❌ Error al generar el archivo Excel')
      
      // RESTAURAR: Si hay error, restaurar desde backup
      const backupDrivers = localStorage.getItem('horarios-drivers-backup')
      const backupDisponibilidad = localStorage.getItem('horarios-disponibilidad-backup')
      
      if (backupDrivers && backupDisponibilidad) {
        setDrivers(JSON.parse(backupDrivers))
        setDisponibilidad(JSON.parse(backupDisponibilidad))
        console.log('🔄 Datos restaurados desde backup')
      }
    }
  }


  // Función para descargar PDF
  const descargarPDF = () => {
    try {
      // Crear una ventana nueva para generar PDF
      const printWindow = window.open('', '_blank')
      
      // Obtener el contenido HTML de los horarios
      const horariosContent = document.querySelector('.horarios-finales-tab')
      if (!horariosContent) {
        alert('❌ No se encontraron horarios para descargar')
        return
      }

      // Crear el HTML para PDF - Solo tablas, más compactas
      const pdfHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Horarios por Auto - ${selectedMonth}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 10px; 
              color: #333;
              background: white;
              font-size: 10px;
            }
            .auto-section {
              margin-bottom: 20px;
              page-break-after: always;
            }
            .auto-section:last-child {
              page-break-after: auto;
            }
            .auto-header {
              background-color: #3498db;
              color: white;
              padding: 8px;
              border-radius: 4px;
              margin-bottom: 8px;
              text-align: center;
            }
            .auto-header h4 {
              margin: 0;
              font-size: 14px;
            }
            .auto-type {
              font-size: 10px;
              opacity: 0.9;
            }
            .schedule-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8px;
            }
            .schedule-table th,
            .schedule-table td {
              border: 1px solid #ddd;
              padding: 3px;
              text-align: center;
              font-size: 8px;
            }
            .schedule-table th {
              background-color: #f8f9fa;
              font-weight: bold;
              font-size: 9px;
            }
            .time-cell {
              background-color: #e9ecef;
              font-weight: bold;
              width: 40px;
              font-size: 8px;
            }
            .schedule-cell {
              min-width: 50px;
              height: 20px;
              font-size: 7px;
            }
            .conflict-cell {
              border: 2px solid #e74c3c !important;
              background-color: #f8d7da !important;
              color: #721c24 !important;
              font-weight: bold;
            }
            @media print {
              body { margin: 5px; }
              .auto-section { 
                page-break-after: always;
                margin-bottom: 10px;
              }
              .auto-section:last-child { 
                page-break-after: auto; 
              }
            }
          </style>
        </head>
        <body>
          ${AUTOS_DISPONIBLES.map(auto => {
            const asignaciones = asignacionesFinales[auto] || {}
            return `
              <div class="auto-section">
                <div class="auto-header">
                  <h4>${auto} - ${AUTOS_GRANDES.includes(auto) ? 'Auto Grande' : 'Auto Normal'}</h4>
                </div>
                
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th class="time-col">H</th>
                      ${DIAS_SEMANA.map(dia => `<th class="day-col">${dia.substring(0, 3)}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${HORARIOS_TRABAJO.map(horario => `
                      <tr>
                        <td class="time-cell">${horario}</td>
                        ${DIAS_SEMANA.map(dia => {
                          const valor = asignaciones[dia]?.[horario] || '-'
                          const esConflicto = valor !== '-' && valor.includes(' vs ')
                          const driverName = esConflicto ? valor.split(' vs ')[0] : valor
                          const color = valor !== '-' ? getDriverColor(driverName) : 'transparent'
                          
                          return `
                            <td 
                              class="schedule-cell ${esConflicto ? 'conflict-cell' : ''}"
                              style="background-color: ${color}; color: ${valor !== '-' ? '#000' : '#666'}; font-weight: ${valor !== '-' ? 'bold' : 'normal'};"
                            >
                              ${valor}
                            </td>
                          `
                        }).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `
          }).join('')}
        </body>
        </html>
      `

      printWindow.document.write(pdfHTML)
      printWindow.document.close()
      
      // Esperar a que se cargue el contenido y luego descargar como PDF
      printWindow.onload = () => {
        // Usar la funcionalidad de impresión del navegador para generar PDF
        printWindow.print()
        
        // Cerrar la ventana después de un momento
        setTimeout(() => {
          printWindow.close()
        }, 1000)
      }
      
    } catch (error) {
      console.error('❌ Error descargando PDF:', error)
      alert('❌ Error al descargar el PDF')
    }
  }

  return (
    <div className="horarios-wrapper">
      <div className="horarios-container">
        <div className="horarios-tabs">
        <button 
          className={`tab-btn ${activeTab === 'horarios-propuestos' ? 'active' : ''}`}
          onClick={() => setActiveTab('horarios-propuestos')}
        >
          <Icon name="calendar" size={16} />
          Horarios Propuestos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          <Icon name="users" size={16} />
          Gestión de Drivers
        </button>
          <button 
          className={`tab-btn ${activeTab === 'horarios-finales' ? 'active' : ''}`}
          onClick={() => setActiveTab('horarios-finales')}
        >
          <Icon name="car" size={16} />
          Vista por Auto
        </button>
        <button 
          className={`tab-btn ${activeTab === 'drivers-schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers-schedule')}
        >
          <Icon name="users" size={16} />
          Vista por Driver
        </button>
        <button 
          className={`tab-btn ${activeTab === 'estadisticas' ? 'active' : ''}`}
          onClick={() => setActiveTab('estadisticas')}
        >
          <Icon name="barChart" size={16} />
          Estadísticas
        </button>
      </div>

      <div className="horarios-content">
          {activeTab === 'horarios-propuestos' && renderHorariosPropuestos()}
          {activeTab === 'drivers' && renderDriversTab()}
          {activeTab === 'horarios-finales' && renderHorariosFinales()}
          {activeTab === 'drivers-schedule' && renderDriversSchedule()}
          {activeTab === 'estadisticas' && renderEstadisticas()}
        </div>

        {/* Modal para agregar driver */}
        {showAddDriverModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>➕ Agregar Nuevo Driver</h3>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowAddDriverModal(false)
                    setNewDriverName('')
                    setNewDriverGenero('')
                    setNewDriverEsMadreSoltera(false)
                    setNewDriverEsJoven(false)
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="newDriverName">Nombre del Driver:</label>
                  <input
                    id="newDriverName"
                    type="text"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="form-input"
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="newDriverGenero">Género:</label>
                  <select
                    id="newDriverGenero"
                    value={newDriverGenero}
                    onChange={(e) => setNewDriverGenero(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Selecciona género</option>
                    <option value="M">Hombre</option>
                    <option value="F">Mujer</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newDriverEsMadreSoltera}
                      onChange={(e) => setNewDriverEsMadreSoltera(e.target.checked)}
                      disabled={newDriverGenero !== 'F'}
                    />
                    <span>👩‍👧‍👦 Es Madre Soltera (Prioridad Máxima)</span>
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newDriverEsJoven}
                      onChange={(e) => setNewDriverEsJoven(e.target.checked)}
                    />
                    <span>👦 Es Joven 18-25 años (Prioridad Media)</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddDriverModal(false)
                    setNewDriverName('')
                    setNewDriverGenero('')
                    setNewDriverEsMadreSoltera(false)
                    setNewDriverEsJoven(false)
                  }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-success"
                  onClick={handleAddDriver}
                >
                  <Icon name="plus" size={16} />
                  Agregar Driver
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para agregar auto */}
        {showAddAutoModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>🚗 Agregar Nuevo Auto</h3>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowAddAutoModal(false)
                    setNewAutoName('')
                    setNewAutoType('normal')
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="newAutoName">Nombre del Auto:</label>
                  <input
                    id="newAutoName"
                    type="text"
                    value={newAutoName}
                    onChange={(e) => setNewAutoName(e.target.value)}
                    placeholder="Ej: 1234 ABC"
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="newAutoType">Tipo de Auto:</label>
                  <select
                    id="newAutoType"
                    value={newAutoType}
                    onChange={(e) => setNewAutoType(e.target.value)}
                    className="form-select"
                  >
                    <option value="normal">Auto Normal</option>
                    <option value="grande">Auto Grande</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddAutoModal(false)
                    setNewAutoName('')
                    setNewAutoType('normal')
                  }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-success"
                  onClick={handleAddAuto}
                >
                  <Icon name="car" size={16} />
                  Agregar Auto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Estilos CSS adicionales para los nuevos elementos
const additionalStyles = `
  .driver-ranking {
    margin: 5px 0;
  }
  
  .ranking-badge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    display: inline-block;
  }
  
  .ranking-badge-compact {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: bold;
    display: inline-block;
    margin-right: 5px;
  }
  
  .driver-details {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 5px 0;
  }
  
  .gender-selector {
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
    font-weight: normal;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
  }
  
  .driver-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    margin-top: 5px;
  }
  
  .priority-badge {
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: bold;
    display: inline-block;
  }
  
  .priority-badge.madre-soltera {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
    color: white;
  }
  
  .priority-badge.mujer {
    background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
    color: #333;
  }

  .priority-badge.joven {
    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
    color: #4a5568;
  }
  
  .auto-badge {
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: bold;
    display: inline-block;
  }
  
  .auto-badge.assigned {
    background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
    color: white;
  }
  
  .auto-badge.unassigned {
    background: #f5f5f5;
    color: #666;
  }
  
  .drivers-header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .btn-small {
    padding: 4px 8px;
    font-size: 12px;
  }
  
  .btn-eliminar {
    min-width: auto;
  }
  
  /* Badges de ranking */
  .ranking-badge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 8px;
    display: inline-block;
  }

  .ranking-badge-compact {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    margin-right: 6px;
    display: inline-block;
  }

  /* Estilos para auto preferencias */
  .auto-preferencias-section {
    margin-top: 15px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .auto-preferencias-section h5 {
    margin: 0 0 10px 0;
    color: #495057;
    font-size: 14px;
    font-weight: 600;
  }

  .auto-preferencias-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }

  .auto-preferencia-item {
    display: flex;
    align-items: center;
  }

  .auto-preferencia-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #495057;
    margin: 0;
  }

  .auto-selector {
    padding: 4px 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 11px;
    background: white;
    min-width: 100px;
  }

  .auto-selector:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
  
  .form-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    background-color: white;
  }
  
  .form-group {
    margin-bottom: 15px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
    color: #333;
  }
`

// Inyectar estilos si no están ya presentes
if (typeof document !== 'undefined' && !document.getElementById('horarios-additional-styles')) {
  const styleElement = document.createElement('style')
  styleElement.id = 'horarios-additional-styles'
  styleElement.textContent = additionalStyles
  document.head.appendChild(styleElement)
}
