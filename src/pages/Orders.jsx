import React, { useMemo, useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { toast } from 'react-toastify'
import SearchableSelect from '../components/SearchableSelect.jsx'
import Icon from '../components/Icon.jsx'
import CotizacionModal from '../components/CotizacionModal.jsx'
import NotesFloatingButton from '../components/NotesFloatingButton.jsx'
import TimerModal from '../components/TimerModal.jsx'
import CerrarTurnoModal from '../components/CerrarTurnoModal.jsx'
import { useAuth } from '../hooks/useAuth.js'
import Horarios from './Horarios.jsx'
import PedidosClientes from '../components/PedidosClientes.jsx'
import Dashboard from './Dashboard.jsx'
import InventarioAdmin from './InventarioAdmin.jsx'
import { getBackendUrl, apiFetch, getApiUrl } from '../utils/api.js'
import notificationSound from '../music/new-notification.mp3'
import { useTimer } from '../hooks/useTimer.js'
import { useOrderLogging } from '../hooks/useOrderLogging.js'
import { useWhatsApp } from '../hooks/useWhatsApp.js'
import { useKanban } from '../hooks/useKanban.js'
import { 
  getBoliviaTime, 
  getBoliviaDateTime, 
  getBoliviaDateISO, 
  getBoliviaTimeString, 
  getCurrentBoliviaTime, 
  formatCurrency,
  toMinutes,
  mergeTimeSlots,
  getDayInitial 
} from '../utils/dateUtils.js'
import {
  saveOrderToSheet,
  updateOrderInSheet as updateOrderInSheetAPI,
  loadOrdersFromSheet as loadOrdersAPI,
  saveLogsToServer as saveLogsAPI,
  getNextId,
  mapRowToOrder,
  filterOrderForSheet
} from '../services/ordersService.js'
import {
  loadClientes as loadClientesAPI,
  loadEmpresas as loadEmpresasAPI,
  addEmpresa as addEmpresaAPI,
  calculateCobrosPagos,
  filtrarPedidosPorFecha
} from '../services/clientesService.js'
import {
  loadBikersForAgregar as loadBikersForAgregarAPI,
  loadBikersAgregar as loadBikersAgregarAPI,
  loadBikersForCuentas as loadBikersForCuentasAPI,
  addBiker as addBikerAPI,
  calcularCuentasBiker as calcularCuentasBikerAPI
} from '../services/bikersService.js'
import {
  filtrarPedidosParaPDF,
  calcularTotalesResumen,
  calcularTotalConDescuento
} from '../services/reportsService.js'
import {
  METODOS_PAGO,
  ESTADOS_PAGO,
  MEDIOS_TRANSPORTE,
  ESTADOS,
  TIPOS_COBRO_PAGO,
  SERVICIOS,
  DIAS_SEMANA,
  DISTANCE_BUFFER_KM
} from '../constants/orderConstants.js'
import {
  cleanGoogleMapsUrl,
  generateGoogleMapsLink,
  isGoogleMapsLink,
  hasValidMapsLink,
  validateGoogleMapsLink
} from '../utils/mapsUtils.js'
import { calculatePrice } from '../utils/priceCalculator.js'
import { calculateDistance } from '../utils/distanceCalculator.js'
import { validateForm } from '../utils/formValidator.js'
import {
  getEmpresaMapa,
  getClienteInfo,
  calculateDayOfWeek
} from '../utils/dataHelpers.js'
import { generateWhatsAppURL } from '../utils/whatsAppUtils.js'
import MultiDateCalendar from '../components/orders/MultiDateCalendar.jsx'
import MissingDataModal from '../components/orders/MissingDataModal.jsx'
import { generarPDFConPlantilla, generatePDFResumen, generarPDFConHTML } from '../services/pdfService.js'
import { formatToStandardDate, prepareDateForSheet, normalizeOrderDate, formatDateForDisplay, convertToISO } from '../services/dateService.js'

// ===== FUNCIONES DE UTILIDAD MOVIDAS A dateUtils.js =====
// Las funciones de fecha y hora boliviana ahora se importan desde ../utils/dateUtils.js

// Componente simple para el formulario de edición

// Componentes de formularios extraídos a archivos separados:
// - EditOrderForm: ../components/forms/EditOrderForm.jsx  
// - CancelOrderForm: ../components/forms/CancelOrderForm.jsx
// - DeliveryOrderForm: ../components/forms/DeliveryOrderForm.jsx

// calculateDayOfWeek ahora se importa desde dataHelpers.js

const initialOrder = {
  fecha: getBoliviaDateISO(), // Fecha de hoy por defecto en zona horaria Bolivia
  fecha_registro: '',
  hora_registro: '',
  operador: 'Usuario', // Valor por defecto, se actualizará con operadorDefault
  cliente: '',
  recojo: '',
  entrega: '',
  direccion_recojo: '',
  info_direccion_recojo: '', // Información adicional para el recojo
  direccion_entrega: '',
  info_direccion_entrega: '', // Información adicional para la entrega
  detalles_carrera: '',
  distancia_km: '',
  medio_transporte: '',
  precio_bs: '',
  metodo_pago: '',
  estado_pago: 'Debe Cliente',
  biker: '',
  whatsapp: '',
  hora_ini: '', // Vacío por defecto, se llena con el botón "Ahora"
  hora_fin: '',
  tiempo_espera: '',
  duracion: '',
  estado: 'Pendiente',

  observaciones: '',
  pago_biker: '',
  
  dia_semana: calculateDayOfWeek(new Date().toISOString().split('T')[0]), // Calcular día de hoy
  cobro_pago: '',
  monto_cobro_pago: '',
  descripcion_cobro_pago: '',
  servicio: 'Beezy' // Beezy por defecto
}

export default function Orders() {
  const { user, isAdmin } = useAuth()
  
  // Hook de logging
  const { logToCSV, saveLogsToServer, clearLogs, getLogs } = useOrderLogging()
  
  // Constantes ahora se importan desde orderConstants.js

  // No necesitamos cargar Google Maps JS, solo usamos la API HTTP

  const [form, setForm] = useState(initialOrder)
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('')
  
  // Hook de WhatsApp para gestionar mensajes
  const { whatsappMessage, whatsappMessageEdited, setWhatsappMessage, setWhatsappMessageEdited, resetWhatsappMessage } = useWhatsApp(form)
  
  // Referencia para el audio de notificación
  const notificationAudioRef = useRef(null)
  
  // Estados para Agregar Nuevo
  const [empresasAgregar, setEmpresasAgregar] = useState([])
  const [bikersAgregarNuevo, setBikersAgregarNuevo] = useState([])
  const [nuevoTipo, setNuevoTipo] = useState('empresa') // 'empresa' o 'biker'
  const [nuevaEmpresa, setNuevaEmpresa] = useState({
    operador: '',
    empresa: '',
    mapa: '',
    descripcion: ''
  })
  const [nuevoBiker, setNuevoBiker] = useState({
    biker: '',
    whatsapp: ''
  })
  // Función para obtener la fecha actual de Bolivia (usando función aislada)
  const getCurrentBoliviaDate = () => getBoliviaDateISO()

  // Función para cargar empresas desde Google Sheets
  const loadEmpresas = async () => {
    try {
      const data = await loadEmpresasAPI()
      setEmpresasAgregar(data)
      showNotification(`🏢 ${data.length} empresas cargadas`, 'success')
    } catch (error) {
      showNotification('❌ Error cargando empresas', 'error')
    }
  }

  // Función para cargar bikers desde Google Sheets para Agregar Nuevo
  const loadBikersAgregar = async () => {
    try {
      const data = await loadBikersAgregarAPI()
      setBikersAgregarNuevo(data)
      showNotification(`🚴‍♂️ ${data.length} bikers cargados`, 'success')
    } catch (error) {
      showNotification('❌ Error cargando bikers', 'error')
    }
  }

  // Función para agregar nueva empresa
  const handleAddEmpresa = async (e) => {
    e.preventDefault()
    
    try {
      await addEmpresaAPI(nuevaEmpresa, operadorDefault)
        showNotification('✅ Empresa agregada exitosamente', 'success')
        setNuevaEmpresa({
          operador: '',
          empresa: '',
          mapa: '',
          descripcion: ''
        })
        // Recargar empresas
        loadEmpresas()
    } catch (error) {
      showNotification(`❌ ${error.message}`, 'error')
    }
  }

  // Función para agregar nuevo biker
  const handleAddBiker = async (e) => {
    e.preventDefault()
    
    try {
      await addBikerAPI(nuevoBiker)
        showNotification('✅ Biker agregado exitosamente', 'success')
        setNuevoBiker({
          biker: '',
          whatsapp: ''
        })
        // Recargar bikers
        loadBikersAgregar()
    } catch (error) {
      showNotification(`❌ ${error.message}`, 'error')
    }
  }

  const [dateFilter, setDateFilter] = useState(getBoliviaDateISO()) // Usar fecha actual de Bolivia por defecto
  const [viewType, setViewType] = useState('day') // 'day' o 'range'
  const [dateRange, setDateRange] = useState({
    start: getBoliviaDateISO(),
    end: getBoliviaDateISO()
  })
  // Ordenamiento fijo por hora de inicio
  const [activeTab, setActiveTab] = useState('agregar')
  const [pedidosClientesCount, setPedidosClientesCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isAddingOrder, setIsAddingOrder] = useState(false)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityData, setAvailabilityData] = useState(null)
  const [availabilityError, setAvailabilityError] = useState(null)
  const [availabilityType, setAvailabilityType] = useState('drivers') // 'drivers' o 'bikers'
  const availabilityFetchedAtRef = useRef(null)
  
  // Estado para el modal de pedido agregado
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [lastAddedOrder, setLastAddedOrder] = useState(null)
  
  // Estado para el modal de advertencia de asignar biker
  const [showAssignBikerModal, setShowAssignBikerModal] = useState(false)
  // Estado para el modal de error de distancia
  const [showDistanceErrorModal, setShowDistanceErrorModal] = useState(false)
  const [lastDistanceError, setLastDistanceError] = useState(null)
  const [clientes, setClientes] = useState([])
  const [empresas, setEmpresas] = useState([])
  // Estados separados para cada sección
  const [bikersAgregar, setBikersAgregar] = useState([]) // Para "Agregar Pedido"
  const [loadingBikersAgregar, setLoadingBikersAgregar] = useState(false)
  const [notification, setNotification] = useState(null)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)
  const [precioEditadoManualmente, setPrecioEditadoManualmente] = useState(false)
  
  // Estados para validación de links
  const [validacionRecojo, setValidacionRecojo] = useState({ estado: null, mensaje: '' }) // null | 'validando' | 'valido' | 'invalido'
  const [validacionEntrega, setValidacionEntrega] = useState({ estado: null, mensaje: '' })
  
  // Estados para modal de cotización
  const [showCotizacionModal, setShowCotizacionModal] = useState(false)
  // Estados para modal de timer
  const [showTimerModal, setShowTimerModal] = useState(false)
  // Estados para modal de cerrar turno
  const [showCerrarTurnoModal, setShowCerrarTurnoModal] = useState(false)
  
  // Hook para el timer (funciona en segundo plano)
  const {
    tiempoRestante,
    timerActivo,
    mensajeTimer,
    mostrarAlerta,
    iniciarTimer,
    detenerTimer,
    cerrarAlerta,
    formatearTiempo
  } = useTimer()
  const [dataLoaded, setDataLoaded] = useState(false)
  const [deliveryModal, setDeliveryModal] = useState({ show: false, order: null })
  const [cancelModal, setCancelModal] = useState({ show: false, order: null })
  const [editModal, setEditModal] = useState({ show: false, order: null })
  const [summaryModal, setSummaryModal] = useState({ show: false, order: null })
  const [duplicateModal, setDuplicateModal] = useState({ show: false, order: null, selectedDates: [], isDuplicating: false })
  const [duplicateSuccessModal, setDuplicateSuccessModal] = useState({ show: false, count: 0, lastDate: null })
  const [missingDataModal, setMissingDataModal] = useState({ show: false, order: null })
  
  // Función de notificación (debe estar definida antes de usarse)
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
  }
  
  // Hook de Kanban para gestionar drag & drop y cambios de estado
  const kanbanHook = useKanban(
    orders,
    setOrders,
    logToCSV,
    showNotification,
    setMissingDataModal,
    setDeliveryModal
  )
  
  // Wrapper para handleDrop que pasa las dependencias adicionales
  const handleDragStart = kanbanHook.handleDragStart
  const handleDragOver = kanbanHook.handleDragOver
  const handleStatusChange = kanbanHook.handleStatusChange
  const handleDrop = (e, newEstado) => kanbanHook.handleDrop(e, newEstado, setCancelModal, getBoliviaTimeString)
  // Estado para modo edición (reutiliza el formulario de agregar)
  const [editingOrder, setEditingOrder] = useState(null)
  // Nuevos estados para manejar entrada manual de direcciones
  const [recojoManual, setRecojoManual] = useState(false)
  const [entregaManual, setEntregaManual] = useState(false)
  // Estados para "Cliente avisa"
  const [recojoClienteAvisa, setRecojoClienteAvisa] = useState(false)
  const [entregaClienteAvisa, setEntregaClienteAvisa] = useState(false)
  // Estados para gestión de cobros y pagos
  const [cobrosPagosData, setCobrosPagosData] = useState([])
  const [descuentosClientes, setDescuentosClientes] = useState({})
  const [serviciosClientes, setServiciosClientes] = useState({})
  const [busquedaEmpresas, setBusquedaEmpresas] = useState('')
  const [generandoSheet, setGenerandoSheet] = useState(false)
  const [fechaInicioEmpresas, setFechaInicioEmpresas] = useState('')
  const [fechaFinEmpresas, setFechaFinEmpresas] = useState('')
  
  // Estados para Cuentas Biker
  const [bikersCuentas, setBikersCuentas] = useState([])
      const [selectedBiker, setSelectedBiker] = useState('todos')
  const [tipoFiltroBiker, setTipoFiltroBiker] = useState('dia') // 'dia' o 'rango'
  const [fechaInicioBiker, setFechaInicioBiker] = useState('')
  const [fechaFinBiker, setFechaFinBiker] = useState('')
  const [fechaDiariaBiker, setFechaDiariaBiker] = useState(getBoliviaDateISO()) // Nueva fecha para filtro diario con fecha actual de Bolivia
  const [cuentasBikerData, setCuentasBikerData] = useState(null)
  const [loadingCuentasBiker, setLoadingCuentasBiker] = useState(false)
  const [filtroEfectivoActivo, setFiltroEfectivoActivo] = useState(false)
const [busquedaBiker, setBusquedaBiker] = useState('')
  const calcularPagoTotalEntregado = (biker) => {
    if (!biker || !Array.isArray(biker.entregas)) return 0
    return biker.entregas
      .filter(entrega => (entrega.estado || '').toLowerCase() === 'entregado')
      .reduce((sum, entrega) => sum + (entrega.pagoBiker || 0), 0)
  }
  
  const SHEET_URL = import.meta.env.VITE_SHEET_WRITE_URL || `${getBackendUrl()}/api/orders`
  const SHEET_TOKEN = import.meta.env.VITE_SHEET_API_KEY || ''

  const handleAvailabilityClick = async (tipo = 'drivers') => {
    setAvailabilityType(tipo)
    setShowAvailabilityModal(true)
    const lastFetched = availabilityFetchedAtRef.current
    const cacheKey = `${tipo}-${lastFetched}`
    if (availabilityData && availabilityData.tipo === tipo && lastFetched && (Date.now() - lastFetched) < (2 * 60 * 1000)) {
      return
    }

    try {
      setAvailabilityLoading(true)
      setAvailabilityError(null)
      const response = await fetch(getApiUrl(`/api/horarios/disponibilidad-hoy?tipo=${tipo}`))
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'No se pudo obtener la disponibilidad')
      }
      setAvailabilityData(payload)
      availabilityFetchedAtRef.current = Date.now()
    } catch (error) {

      setAvailabilityError(error.message || 'Error desconocido')
    } finally {
      setAvailabilityLoading(false)
    }
  }

  const closeAvailabilityModal = () => {
    setShowAvailabilityModal(false)
  }

  const operadorDefault = useMemo(() => {
    return user?.name || 'Usuario'
  }, [user])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('orders.list') || '[]')
      setOrders(stored)
    } catch {}
  }, [])

  // Cargar empresas y bikers cuando se active la pestaña "Agregar Nuevo"
  useEffect(() => {
    if (activeTab === 'agregar-nuevo') {
      loadEmpresas()
      loadBikersAgregar()
    }
  }, [activeTab])

  useEffect(() => {
    try {
      localStorage.setItem('orders.list', JSON.stringify(orders))
    } catch {}
  }, [orders])

  useEffect(() => {

    setForm((f) => ({ ...f, operador: operadorDefault }))
  }, [operadorDefault, user])

  // Auto-rellenar formulario cuando viene de pedido cliente
  useEffect(() => {
    const handleCrearPedidoDesdeCliente = (event) => {
      const datosPedido = event.detail

      // Cambiar al tab de agregar pedido
      setActiveTab('agregar')
      
      // Auto-rellenar formulario
      setForm(prev => ({
        ...prev,
        cliente: datosPedido.cliente || '',
        recojo: datosPedido.recojo || 'Manual', // Campo obligatorio
        entrega: datosPedido.entrega || 'Manual', // Campo obligatorio
        direccion_recojo: datosPedido.direccion_recojo || '',
        info_direccion_recojo: datosPedido.info_direccion_recojo || '',
        direccion_entrega: datosPedido.direccion_entrega || '',
        info_direccion_entrega: datosPedido.info_direccion_entrega || '',
        detalles_carrera: datosPedido.detalles_carrera || '',
        distancia_km: datosPedido.distancia_km || '',
        precio_bs: datosPedido.precio_bs || '',
        hora_ini: datosPedido.hora_ini || '',
        cobro_pago: datosPedido.cobro_pago || '',
        monto_cobro_pago: datosPedido.monto_cobro_pago || '',
        descripcion_cobro_pago: datosPedido.descripcion_cobro_pago || '',
        idPedidoCliente: datosPedido.idPedidoCliente,
        desdePedidoCliente: true
      }))
      
      // Activar modo manual para direcciones
      setRecojoManual(true)
      setEntregaManual(true)
      
      // Limpiar localStorage
      localStorage.removeItem('pedidoClienteParaCrear')
      
      toast.success('✅ Formulario auto-rellenado con datos del pedido cliente', {
        autoClose: 3000
      })
    }

    // Escuchar evento personalizado
    window.addEventListener('crearPedidoDesdeCliente', handleCrearPedidoDesdeCliente)
    
    // También verificar localStorage al montar (por si se recarga la página)
    const datosGuardados = localStorage.getItem('pedidoClienteParaCrear')
    if (datosGuardados) {
      try {
        const datosPedido = JSON.parse(datosGuardados)
        handleCrearPedidoDesdeCliente({ detail: datosPedido })
      } catch (error) {

      }
    }
    
    return () => {
      window.removeEventListener('crearPedidoDesdeCliente', handleCrearPedidoDesdeCliente)
    }
  }, [])

  // Función para llenar el formulario desde la cotización
  const handleCrearCarreraDesdeCotizacion = (datosCotizacion) => {
    // Cambiar al tab de agregar pedido
    setActiveTab('agregar')
    
    // Obtener nombres de recojo y entrega
    const recojoNombre = datosCotizacion.recojo || ''
    const entregaNombre = datosCotizacion.entrega || ''
    
    // Detectar si es una empresa válida (verificar si está en la lista de empresas)
    // Si el array empresas está vacío, asumir que es empresa si:
    // - Tiene un nombre y no es "Sin especificar"
    // - Y no es una URL de maps
    const esRecojoEmpresa = recojoNombre && 
      recojoNombre !== 'Sin especificar' && 
      !recojoNombre.toLowerCase().includes('maps') &&
      !recojoNombre.toLowerCase().includes('goo.gl') &&
      (empresas.length === 0 || empresas.some(emp => emp.empresa === recojoNombre))
    
    const esEntregaEmpresa = entregaNombre && 
      entregaNombre !== 'Sin especificar' && 
      !entregaNombre.toLowerCase().includes('maps') &&
      !entregaNombre.toLowerCase().includes('goo.gl') &&
      (empresas.length === 0 || empresas.some(emp => emp.empresa === entregaNombre))
    
    // Auto-rellenar formulario con los datos de la cotización
    setForm(prev => ({
      ...prev,
      recojo: recojoNombre || 'Sin especificar',
      direccion_recojo: datosCotizacion.direccion_recojo || (esRecojoEmpresa && empresas.length > 0 ? getEmpresaMapa(recojoNombre) : ''),
      entrega: entregaNombre || 'Sin especificar',
      direccion_entrega: datosCotizacion.direccion_entrega || (esEntregaEmpresa && empresas.length > 0 ? getEmpresaMapa(entregaNombre, empresas) : ''),
      medio_transporte: datosCotizacion.medio_transporte || '',
      distancia_km: datosCotizacion.distancia_km || '',
      precio_bs: datosCotizacion.precio_bs || ''
    }))
    
    // Activar modo según si es empresa o manual
    // Si es una empresa válida, usar modo Empresas (recojoManual = false)
    // Si no es empresa válida, usar modo Manual (recojoManual = true)
    setRecojoManual(!esRecojoEmpresa)
    setEntregaManual(!esEntregaEmpresa)
    setRecojoClienteAvisa(false)
    setEntregaClienteAvisa(false)
    
    showNotification('✅ Formulario auto-rellenado con datos de la cotización', 'success')
  }

  // La actualización automática del mensaje de WhatsApp ahora se maneja en el hook useWhatsApp

  // Función para detectar si un valor es un enlace válido de Google Maps
  // hasValidMapsLink ahora se importa desde mapsUtils.js

  // Función para detectar automáticamente el modo de entrada basado en el valor actual
  // Si hay mapas en la dirección, DEBE ser Manual (no puede ser Cliente avisa)
  const detectInputMode = (value, direccion = '') => {
    if (!value) return false
    
    // Si el valor es "Cliente avisa", no es manual (es Cliente avisa)
    if (value === 'Cliente avisa') {
      return false
    }
    
    // PRIMERO verificar si es una empresa válida - si es empresa, NO es manual
    const esEmpresa = empresas.some(emp => emp.empresa === value)
    if (esEmpresa) {
      return false // Es empresa, modo dropdown
    }
    
    // Si el valor no es una empresa y hay un mapa válido en la dirección, es Manual
    if (hasValidMapsLink(direccion)) {
      return true
    }
    
    // Si el valor no está en la lista de empresas, asumir que es entrada manual
    return true
  }

  // Detectar modo automáticamente cuando cambian los valores
  useEffect(() => {
    if (form.recojo || form.direccion_recojo) {
      const shouldBeManual = detectInputMode(form.recojo, form.direccion_recojo)
      if (shouldBeManual !== recojoManual) {
        setRecojoManual(shouldBeManual)
      }
      // Si hay mapas pero dice "Cliente avisa", corregirlo
      if (hasValidMapsLink(form.direccion_recojo) && form.recojo === 'Cliente avisa') {
        setForm(prev => ({ ...prev, recojo: 'Sin especificar' }))
        setRecojoClienteAvisa(false)
      }
    }
  }, [form.recojo, form.direccion_recojo, empresas])

  useEffect(() => {
    if (form.entrega || form.direccion_entrega) {
      const shouldBeManual = detectInputMode(form.entrega, form.direccion_entrega)
      if (shouldBeManual !== entregaManual) {
        setEntregaManual(shouldBeManual)
      }
      // Si hay mapas pero dice "Cliente avisa", corregirlo
      if (hasValidMapsLink(form.direccion_entrega) && form.entrega === 'Cliente avisa') {
        setForm(prev => ({ ...prev, entrega: 'Sin especificar' }))
        setEntregaClienteAvisa(false)
      }
    }
  }, [form.entrega, form.direccion_entrega, empresas])

  // Pre-cargar formulario cuando se activa modo edición
  useEffect(() => {
    if (editingOrder) {
      // Obtener la fecha desde múltiples posibles fuentes y limpiar comillas
      let fechaOriginal = editingOrder.fecha || editingOrder['Fechas'] || ''
      
      // Limpiar comilla simple al inicio (Google Sheets a veces las agrega)
      if (typeof fechaOriginal === 'string' && fechaOriginal.startsWith("'")) {
        fechaOriginal = fechaOriginal.substring(1)
      }
      
      // Convertir fecha del formato DD/MM/YYYY a yyyy-MM-dd para el input date usando dateService
      const fechaConvertida = convertToISO(fechaOriginal) || fechaOriginal
      
      // Asegurar que tiempo_espera se incluya con todas sus variantes posibles
      const tiempoEspera = editingOrder.tiempo_espera || editingOrder['Tiempo de espera'] || editingOrder['Tiempo de Espera'] || ''
      
      // Asegurar que info adicional se incluya con todas sus variantes posibles
      const infoRecojo = editingOrder.info_direccion_recojo || editingOrder['Info. Adicional Recojo'] || ''
      const infoEntrega = editingOrder.info_direccion_entrega || editingOrder['Info. Adicional Entrega'] || ''
      
      const formData = {
        ...editingOrder,
        fecha: fechaConvertida, // Usar la fecha convertida y limpia
        operador: operadorDefault, // Mantener el operador actual
        tiempo_espera: tiempoEspera, // Asegurar que tiempo_espera esté presente
        info_direccion_recojo: infoRecojo, // Asegurar que info adicional recojo esté presente
        info_direccion_entrega: infoEntrega // Asegurar que info adicional entrega esté presente
      }

      // Si hay mapas válidos en las direcciones, NO puede ser "Cliente avisa"
      // Corregir el nombre si es necesario
      let recojoFinal = formData.recojo
      let entregaFinal = formData.entrega
      const direccionRecojo = formData.direccion_recojo || ''
      const direccionEntrega = formData.direccion_entrega || ''
      
      if (hasValidMapsLink(direccionRecojo)) {
        // Si hay mapa válido pero dice "Cliente avisa", cambiarlo a "Sin especificar"
        if (recojoFinal === 'Cliente avisa' || !recojoFinal || recojoFinal.trim() === '') {
          recojoFinal = 'Sin especificar'
        }
      }
      
      if (hasValidMapsLink(direccionEntrega)) {
        // Si hay mapa válido pero dice "Cliente avisa", cambiarlo a "Sin especificar"
        if (entregaFinal === 'Cliente avisa' || !entregaFinal || entregaFinal.trim() === '') {
          entregaFinal = 'Sin especificar'
        }
      }
      
      // Actualizar formData con los valores corregidos
      formData.recojo = recojoFinal
      formData.entrega = entregaFinal
      
      setForm(formData)
      // Detectar y configurar los modos de entrada (pasando también las direcciones)
      const recojoManualMode = detectInputMode(recojoFinal, direccionRecojo)
      const entregaManualMode = detectInputMode(entregaFinal, direccionEntrega)
      
      setRecojoManual(recojoManualMode)
      setEntregaManual(entregaManualMode)
      
      // Si hay mapas válidos, NO puede ser "Cliente avisa"
      setRecojoClienteAvisa(recojoFinal === 'Cliente avisa' && !hasValidMapsLink(direccionRecojo))
      setEntregaClienteAvisa(entregaFinal === 'Cliente avisa' && !hasValidMapsLink(direccionEntrega))
    }
  }, [editingOrder, operadorDefault])

  // Auto-ocultar notificaciones después de 3 segundos
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Limpiar estados de modo manual cuando se cambie de pestaña
  useEffect(() => {
    if (activeTab !== 'agregar') {
      setRecojoManual(false)
      setEntregaManual(false)
    }
  }, [activeTab])

  const handleDeliveryComplete = async (deliveryData) => {
    try {
      const { order } = deliveryModal
      
      // Preservar todos los campos originales y actualizar solo los modificados
      const updatedOrder = { 
        ...order, // Mantener todos los campos originales
        estado: 'Entregado',
        // Actualizar solo los campos que se pueden editar en el modal
        cliente: deliveryData.cliente || order.cliente,
        recojo: deliveryData.recojo || order.recojo,
        entrega: deliveryData.entrega || order.entrega,
        biker: deliveryData.biker || order.biker,
        precio_bs: deliveryData.precio_bs || order.precio_bs,
        distancia_km: deliveryData.distancia_km || order.distancia_km,
        medio_transporte: deliveryData.medio_transporte || order.medio_transporte,
        hora_ini: deliveryData.hora_ini || order.hora_ini,
        hora_fin: deliveryData.hora_fin, // Este es nuevo, no tiene fallback
        observaciones: deliveryData.observaciones || order.observaciones
      }
      
      showNotification(`🔄 Completando entrega del pedido #${order.id}...`, 'success')

      // Actualizar localmente
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id ? updatedOrder : o
        )
      )
      
      // Actualizar en Google Sheet
      try {
        const response = await fetch(import.meta.env.VITE_SHEET_WRITE_URL || '', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOrder)
        })
        
        if (response.ok) {
          const result = await response.json()

          showNotification(`✅ Pedido #${order.id} entregado exitosamente`, 'success')
        } else {
          throw new Error('Response not ok')
        }
      } catch (err) {

        showNotification('⚠️ Entrega completada localmente (error en Google Sheet)', 'warning')
      }
      
      // Cerrar modal
      setDeliveryModal({ show: false, order: null })
      
    } catch (err) {

      showNotification('❌ Error al completar entrega', 'error')
    }
  }

  const handleDeliveryCancel = () => {
    setDeliveryModal({ show: false, order: null })
    showNotification('❌ Entrega cancelada', 'info')
  }

  const handleOrderCancel = async (cancelData) => {
    try {
      const { order } = cancelModal
      
      // Preservar todos los campos originales y actualizar solo los modificados
      const updatedOrder = { 
        ...order, // Mantener todos los campos originales
        estado: 'Cancelado',
        detalles_carrera: cancelData.motivo || order.detalles_carrera
      }
      
      showNotification(`🔄 Cancelando pedido #${order.id}...`, 'success')

      // Actualizar localmente
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id ? updatedOrder : o
        )
      )
      
      // Actualizar en Google Sheet
      try {

        const response = await fetch(import.meta.env.VITE_SHEET_WRITE_URL || '', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOrder)
        })
        
        if (response.ok) {
          const result = await response.json()

          showNotification(`✅ Pedido #${order.id} cancelado exitosamente`, 'success')
        } else {
          throw new Error('Response not ok')
        }
      } catch (err) {

        showNotification('⚠️ Cancelación completada localmente (error en Google Sheet)', 'warning')
      }
      
      // Cerrar modal
      setCancelModal({ show: false, order: null })
      
    } catch (err) {

      showNotification('❌ Error al cancelar pedido', 'error')
    }
  }

  const handleCancelModalClose = () => {
    setCancelModal({ show: false, order: null })
    showNotification('❌ Cancelación cancelada', 'info')
  }

  const handleOrderEdit = async (updatedOrder) => {
    try {
      // Validar que tengamos el pedido actualizado con ID
      if (!updatedOrder || !updatedOrder.id) {
        throw new Error('No se proporcionó un pedido válido para actualizar')
      }
      
      // Log: Inicio de edición de pedido
      await logToCSV('order_edit_start', { 
        orderId: updatedOrder.id,
        updatedData: updatedOrder
      }, 'info')
      
      showNotification(`🔄 Actualizando pedido #${updatedOrder.id}...`, 'info')

      // Actualizar localmente
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(o => 
          o.id === updatedOrder.id ? updatedOrder : o
        )
        
        // Limpiar duplicados por ID (mantener solo el último)
        const uniqueOrders = updatedOrders.reduce((acc, current) => {
          const existingIndex = acc.findIndex(item => item.id === current.id)
          if (existingIndex >= 0) {
            acc[existingIndex] = current // Reemplazar con la versión más reciente
          } else {
            acc.push(current)
          }
          return acc
        }, [])

        return uniqueOrders
      })
      
      // Actualizar en Google Sheet usando updateOrderInSheet
      try {

        await updateOrderInSheet(updatedOrder)

      } catch (err) {

        throw err // Re-lanzar el error para que lo maneje el caller
      }
      
      // Cerrar modal si existe (compatibilidad con modal antiguo)
      if (editModal.show) {
        setEditModal({ show: false, order: null })
      }
      
    } catch (err) {

      throw err // Re-lanzar para que handleAdd lo capture
    }
  }

  const handleEditModalClose = () => {
    setEditModal({ show: false, order: null })
    showNotification('❌ Edición cancelada', 'info')
  }

  // Función para activar modo edición (reutiliza el formulario de agregar)
  const handleEditMode = (order) => {
    setEditingOrder(order)
    setActiveTab('agregar')
    showNotification(`✏️ Editando pedido #${order.id}`, 'info')
  }

  // Función para cancelar modo edición
  const handleCancelEdit = () => {

    setEditingOrder(null)
    setForm(initialOrder)
    // Resetear el mensaje de WhatsApp
    resetWhatsappMessage()
    setPrecioEditadoManualmente(false)
    setRecojoManual(false)
    setEntregaManual(false)
    setRecojoClienteAvisa(false)
    setEntregaClienteAvisa(false)
    setActiveTab('ver') // Cambiar al Kanban
    showNotification('❌ Edición cancelada - Volviendo al Kanban', 'info')
  }

  // Función para validar enlaces de Google Maps
  // validateGoogleMapsLink ahora se importa desde mapsUtils.js

  // Función para manejar la selección de fechas en el calendario
  const handleCalendarDateSelect = (dateString) => {
    setDuplicateModal(prev => {
      const isSelected = prev.selectedDates.includes(dateString)
      if (isSelected) {
        // Remover fecha si ya está seleccionada
        return {
          ...prev,
          selectedDates: prev.selectedDates.filter(date => date !== dateString).sort()
        }
      } else {
        // Agregar fecha si no está seleccionada
        return {
          ...prev,
          selectedDates: [...prev.selectedDates, dateString].sort()
        }
      }
    })
  }

  // MultiDateCalendar ahora se importa desde components/orders/MultiDateCalendar.jsx

  // Las funciones de Kanban (handleDragStart, handleDragOver, handleDrop, handleStatusChange) 
  // ahora se manejan en el hook useKanban

  // NOTA: El useEffect para llenar el formulario en modo edición está en la línea 590-669
  // No duplicar aquí para evitar sobrescribir la conversión de fechas

  // Auto-sync cuando se cambie a la pestaña "Ver pedidos" o "Cobros/Pagos" (solo si no hay datos)
  useEffect(() => {
    if ((activeTab === 'ver' || activeTab === 'cobros-pagos' || activeTab === 'cuentas-biker') && !dataLoaded) {

      loadOrdersFromSheet()
    }
  }, [activeTab, dataLoaded])

  // useEffect específico para Cuentas Biker - Cargar bikers y calcular con fecha actual de Bolivia
  useEffect(() => {
    if (activeTab === 'cuentas-biker' && orders.length > 0) {
      // Cargar cobros/pagos primero

      loadCobrosPagos()
      
      // Cargar bikers y calcular automáticamente con fecha de Bolivia
      loadBikersForCuentas().then((bikersData) => {

        // Calcular automáticamente con la fecha actual de Bolivia
        setTimeout(() => {
          calcularCuentasBiker(bikersData)
        }, 300)
      }).catch(error => {

        showNotification('❌ Error cargando bikers', 'error')
        // Intentar calcular de todas formas
        calcularCuentasBiker()
      })
    }
  }, [activeTab, orders.length])

  useEffect(() => {
    if (activeTab === 'cuentas-biker' && tipoFiltroBiker === 'dia' && fechaDiariaBiker) {
      calcularCuentasBiker()
    }
  }, [fechaDiariaBiker, tipoFiltroBiker, activeTab])

  // Cargar datos de cobros y pagos cuando se cambie a esa pestaña
  useEffect(() => {
    if (activeTab === 'cobros-pagos') {
      loadCobrosPagos()
    }
  }, [activeTab, orders])

  // Recalcular saldos cuando cambien los descuentos
  useEffect(() => {
    if (cobrosPagosData.length > 0) {

      const clientesActualizados = cobrosPagosData.map(cliente => {
        // Subtotal General = Carreras + Pagos - Cobros
        // Cobros: dinero que cobramos del cliente (se debe devolver) → se resta
        // Pagos: dinero que pagamos en nombre del cliente (se debe cobrar) → se suma
        // Carreras: precio del servicio (se debe cobrar) → se suma
        const subtotalGeneral = cliente.totalCarreras + cliente.totalPagos - cliente.totalCobros
        const porcentajeDescuento = descuentosClientes[cliente.cliente] || 0
        // Descuento solo sobre las carreras, no sobre cobros y pagos
        const montoDescuento = (cliente.totalCarreras * porcentajeDescuento) / 100
          const nuevoSaldo = subtotalGeneral - montoDescuento
          return {
          ...cliente,
          saldoFinal: nuevoSaldo
        }
      })
      setCobrosPagosData(clientesActualizados)
    }
  }, [descuentosClientes])

  // Cargar bikers cuando se cambie a la pestaña agregar
  useEffect(() => {
    if (activeTab === 'agregar') {

      // Si no hay bikers cargados para Agregar, cargarlos
      if (bikersAgregar.length === 0) {

        loadBikersForAgregar()
      } else {

      }
    }
  }, [activeTab, bikersAgregar.length])

  // Cargar clientes al montar el componente
  useEffect(() => {
    loadClientes()
  }, [])
  
  // Cargar bikers al montar el componente
  useEffect(() => {

    loadBikersForAgregar()
  }, [])
  
  // Inicializar audio de notificación
  useEffect(() => {
    if (notificationAudioRef.current === null) {
      notificationAudioRef.current = new Audio(notificationSound)
      notificationAudioRef.current.volume = 0.7 // Volumen al 70%

    }
  }, [])

  // ===== VERIFICADOR DE NOTIFICACIONES PARA CARRERAS AGENDADAS =====
  useEffect(() => {
    const checkScheduledOrders = () => {
      // Solo verificar si estamos en la pestaña de ver pedidos y hay datos cargados
      if (activeTab === 'ver' && orders.length > 0) {
        const pendingOrders = orders.filter(order => order.estado === 'Pendiente' && order.hora_ini)
        
        pendingOrders.forEach(order => {
          if (needsNotification(order)) {

            showOrderNotification(order)
          }
        })
      }
    }

    // Verificar inmediatamente
    checkScheduledOrders()

    // Configurar intervalo para verificar cada minuto
    const interval = setInterval(checkScheduledOrders, 60000) // 60000ms = 1 minuto

    // Limpiar intervalo al desmontar
    return () => clearInterval(interval)
  }, [activeTab, orders])

  // Actualizar datos cuando se cambie al Kanban (con caché inteligente)
  useEffect(() => {
    if (activeTab === 'ver') {
      // Solo recargar si no hay datos o si han pasado más de 30 segundos desde la última carga
      const lastLoadTime = localStorage.getItem('orders.lastLoadTime')
      const timeSinceLastLoad = lastLoadTime ? Date.now() - parseInt(lastLoadTime) : Infinity
      const shouldReload = !dataLoaded || orders.length === 0 || timeSinceLastLoad > 30000 // 30 segundos

      if (shouldReload) {
      setDataLoaded(false) // Resetear estado
      setTimeout(() => {
          loadOrdersFromSheet(true) // Recarga forzada
          localStorage.setItem('orders.lastLoadTime', Date.now().toString())
      }, 100)
      }
    }
  }, [activeTab])

  const loadClientes = async () => {
    try {
      showNotification('🔄 Cargando clientes...', 'success')
      
      const { empresas: empresasData, clientes: clientesData } = await loadClientesAPI()
      
      setEmpresas(empresasData)
      setClientes(clientesData)
      showNotification(`👥 ${clientesData.length} clientes cargados`, 'success')
    } catch (error) {
      showNotification('⚠️ Error al cargar clientes. Usando datos locales.', 'error')
      // No fallar completamente, continuar con datos vacíos
    }
  }

  // Wrappers para las funciones de PDF (delegando al servicio)
  const generarPDFConPlantillaWrapper = async (datosFiltrados, fechaInicio, fechaFin) => {
    await generarPDFConPlantilla(datosFiltrados, fechaInicio, fechaFin, showNotification, generarPDFConHTMLWrapper)
  }

  const generarPDFConHTMLWrapper = async (datosFiltrados, fechaInicio, fechaFin) => {
    await generarPDFConHTML(datosFiltrados, fechaInicio, fechaFin, showNotification)
  }

  const generatePDFResumenWrapper = async (clienteData, fechaInicio = null, fechaFin = null) => {
    await generatePDFResumen(clienteData, fechaInicio, fechaFin, descuentosClientes, showNotification, generarPDFConPlantillaWrapper, generarPDFConHTMLWrapper)
  }

  // Funciones de PDF movidas a src/services/pdfService.js
  // Las funciones originales fueron: generarPDFConPlantilla, generatePDFResumen, generarPDFConHTML
  // Ahora se usan los wrappers de arriba que delegan al servicio
  // Las 3 funciones grandes de PDF (generarPDFConPlantilla, generatePDFResumen, generarPDFConHTML)
  // fueron movidas a src/services/pdfService.js (~1,150 líneas eliminadas)

  // Funciones para Cuentas Biker
  const loadBikersForCuentas = async () => {
    return new Promise((resolve, reject) => {
    try {
      setLoadingCuentasBiker(true)

      const bikersData = loadBikersForCuentasAPI(orders)
      
      setBikersCuentas(bikersData)
      resolve(bikersData)
    } catch (error) {
      showNotification('❌ Error al cargar bikers', 'error')
      reject(error)
    } finally {
      setLoadingCuentasBiker(false)
    }
    })
  }

  const calcularCuentasBiker = (bikersList = null) => {
    try {
      const esRango = tipoFiltroBiker === 'rango'

      if (orders.length === 0) {
        showNotification('❌ No hay pedidos cargados. Actualiza los datos primero.', 'error')
        return
      }
      
      // Validar fechas según el tipo de filtro
      if (esRango) {
        if (!fechaInicioBiker || !fechaFinBiker) {
          showNotification('📅 Por favor selecciona ambas fechas para calcular el rango', 'info')
          return
        }
        if (fechaInicioBiker > fechaFinBiker) {
          showNotification('❌ La fecha de inicio debe ser anterior a la fecha de fin', 'error')
          return
        }

      } else {
        if (!fechaDiariaBiker) {
          showNotification('📅 Por favor selecciona una fecha para calcular las cuentas del día', 'info')
          return
        }

      }
      
      // Usar la lista de bikers pasada como parámetro o la del estado
      let bikersAProcesar = bikersList || bikersCuentas
      
      // Si no hay bikers, extraerlos directamente de los pedidos
      if (bikersAProcesar.length === 0) {

        const bikersSet = new Set()
        
        orders.forEach(order => {
          const bikerName = order['Biker'] || order.biker
          const operadorName = order['Operador'] || order.operador
          const estado = order['Estado'] || order.estado
          
          // Filtrar "ASIGNAR BIKER" y pedidos cancelados
          if (estado === 'Cancelado') return
          
          if (bikerName && bikerName.trim() && bikerName !== 'N/A' && bikerName !== 'ASIGNAR BIKER') {
            bikersSet.add(bikerName.trim())
          }
          if (operadorName && operadorName.trim() && operadorName !== 'N/A' && operadorName !== 'ASIGNAR BIKER') {
            bikersSet.add(operadorName.trim())
          }
        })
        
        bikersAProcesar = Array.from(bikersSet)
          .map((nombre, index) => ({
            id: `biker-${index}`,
            nombre: nombre
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
        
        // Actualizar el estado de bikers también
        setBikersCuentas(bikersAProcesar)
      }
      
      if (bikersAProcesar.length === 0) {
        showNotification('❌ No hay bikers para procesar', 'error')
        return
      }

      // Calcular para cada biker
      const resultadosBikers = bikersAProcesar.map(biker => {
        // Filtrar pedidos del biker (excluyendo cancelados y ASIGNAR BIKER)
        let pedidosBiker = orders.filter(order => {
          const bikerEnPedido = order['Biker'] || order.biker || order['Operador'] || order.operador
          const estado = order['Estado'] || order.estado
          
          // Excluir pedidos cancelados y "ASIGNAR BIKER"
          if (estado === 'Cancelado' || bikerEnPedido === 'ASIGNAR BIKER') {
            return false
          }
          
          return bikerEnPedido === biker.nombre
        })
        
        // Filtrar pedidos por la fecha específica seleccionada (considerando zona horaria Bolivia)
          pedidosBiker = pedidosBiker.filter(pedido => {
            const fechaPedido = pedido['Fecha Registro'] || 
                              pedido['Fechas'] || 
                              pedido.fecha ||
                              pedido['Fecha pedido']
            
          if (!fechaPedido) return false
            
            try {
            // Convertir fecha del pedido a formato ISO usando dateService
            const fechaPedidoNormalizada = convertToISO(fechaPedido)
            if (!fechaPedidoNormalizada) return false
            
            // Comparar según tipo de filtro
            if (esRango) {
              // Filtro por rango de fechas

              return fechaPedidoNormalizada >= fechaInicioBiker && fechaPedidoNormalizada <= fechaFinBiker
            } else {
              // Filtro por día único

              return fechaPedidoNormalizada === fechaDiariaBiker
            }
            } catch (error) {

            return false
            }
          })
          
        const filtroTexto = esRango ? `${fechaInicioBiker} a ${fechaFinBiker}` : fechaDiariaBiker

        if (pedidosBiker.length === 0) {
          return null // No incluir bikers sin pedidos en el rango
        }
        
        // Calcular totales
        const totalEntregas = pedidosBiker.length
        const totalCarreras = pedidosBiker.reduce((sum, pedido) => {
          const precio = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
          return sum + precio
        }, 0)
        
        // Calcular total de carreras que SÍ se pagan al biker (excluyendo "A cuenta")
        const totalCarrerasPagables = pedidosBiker.reduce((sum, pedido) => {
          const metodoPago = pedido['Método pago pago'] || pedido.metodo_pago || 'Efectivo'
          // Excluir carreras con método "A cuenta" del pago al biker
          if (metodoPago === 'A cuenta') {
            return sum // No sumar al total pagable
          }
          const precio = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
          return sum + precio
        }, 0)
        
        // El pago del biker es el 70% del total de carreras PAGABLES (excluyendo "A cuenta")
        const pagoBiker = totalCarrerasPagables * 0.7
        
        // Crear detalle de entregas con todas las columnas necesarias
        const entregas = pedidosBiker.map(pedido => {
          const precioCarrera = parseFloat(pedido['Precio [Bs]'] || pedido.precio_bs || pedido.precio || 0)
          const metodoPago = pedido['Método pago pago'] || pedido.metodo_pago || 'Efectivo'
          
          // Para carreras "A cuenta", el pago al biker es 0
          const pagoBikerCalculado = metodoPago === 'A cuenta' ? 0 : precioCarrera * 0.7
          
          return {
            // Columnas principales del pedido
            id: pedido.ID || pedido.id || 'N/A',
            fechaRegistro: pedido['Fecha Registro'] || pedido.fecha_registro || pedido.fecha || 'N/A',
            horaRegistro: pedido['Hora Registro'] || pedido.hora_registro || pedido.hora || 'N/A',
            operador: pedido.Operador || pedido.operador || 'N/A',
          cliente: pedido.Cliente || pedido.cliente || 'N/A',
          recojo: pedido.Recojo || pedido.recojo || 'N/A',
          entrega: pedido.Entrega || pedido.entrega || 'N/A',
            direccionRecojo: pedido['Direccion Recojo'] || pedido.direccion_recojo || 'N/A',
            direccionEntrega: pedido['Direccion Entrega'] || pedido.direccion_entrega || 'N/A',
            detallesCarrera: pedido['Detalles de la Carrera'] || pedido.detalles_carrera || 'N/A',
            distanciaKm: pedido['Dist. [Km]'] || pedido.distancia_km || 'N/A',
          medioTransporte: pedido['Medio Transporte'] || pedido.medio_transporte || 'N/A',
            precioBs: precioCarrera,
            metodoPago: metodoPago,
            biker: pedido.Biker || pedido.biker || 'N/A',
            whatsapp: pedido.WhatsApp || pedido.whatsapp || 'N/A',
            fechas: pedido.Fechas || pedido.fechas || pedido.fecha || 'N/A', // Campo adicional de fechas
            horaIni: pedido['Hora Ini'] || pedido.hora_ini || 'N/A',
            horaFin: pedido['Hora Fin'] || pedido.hora_fin || 'N/A',
            duracion: pedido.Duracion || pedido.duracion || 'N/A',
          estado: pedido.Estado || pedido.estado || 'N/A',
          estadoPago: pedido['Estado de pago'] || pedido.estado_pago || 'N/A',
          observaciones: pedido.Observaciones || pedido.observaciones || '',
            pagoBiker: pagoBikerCalculado, // Siempre 70% del precio
            diaSemana: pedido['Dia de la semana'] || pedido.dia_semana || 'N/A',
            cobroPago: pedido['Cobro o pago'] || pedido.cobro_pago || 'N/A',
            montoCobroPago: parseFloat(pedido['Monto cobro o pago'] || pedido.monto_cobro_pago || 0),
            
            // Campos calculados adicionales
            fecha: pedido['Fecha Registro'] || pedido.fecha_registro || pedido.fecha || 'N/A', // Para compatibilidad
            hora: pedido['Hora Registro'] || pedido.hora_registro || pedido.hora || 'N/A', // Para compatibilidad
            precio: precioCarrera // Para compatibilidad
          }
        })
        
        // Agrupar entregas por día
        const entregasPorDia = entregas.reduce((acc, entrega) => {
          const fecha = entrega.fecha
          if (!acc[fecha]) {
            acc[fecha] = {
              fecha,
              entregas: [],
              totalEntregas: 0,
              totalCarreras: 0,
              totalPago: 0
            }
          }
          
          acc[fecha].entregas.push(entrega)
          acc[fecha].totalEntregas += 1
          acc[fecha].totalCarreras += entrega.precio
          acc[fecha].totalPago += entrega.pagoBiker
          
          return acc
        }, {})
        
        return {
          id: biker.id,
          nombre: biker.nombre,
          totalEntregas,
          totalCarreras,
          pagoBiker,
          entregas,
          entregasPorDia: Object.values(entregasPorDia).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        }
      }).filter(biker => biker !== null)
      
      // Calcular totales generales
      const totalesGenerales = {
        totalBikers: resultadosBikers.length,
        totalEntregas: resultadosBikers.reduce((sum, b) => sum + b.totalEntregas, 0),
        totalCarreras: resultadosBikers.reduce((sum, b) => sum + b.totalCarreras, 0),
        totalPagos: resultadosBikers.reduce((sum, b) => sum + b.pagoBiker, 0)
      }
      
      const resultadoFinal = {
        fechaInicio: esRango ? fechaInicioBiker : fechaDiariaBiker,
        fechaFin: esRango ? fechaFinBiker : fechaDiariaBiker,
        fechaDia: esRango ? null : fechaDiariaBiker, // Solo para día único
        esRango: esRango,
        bikerSeleccionado: 'todos', // Siempre todos
        bikers: resultadosBikers,
        totales: totalesGenerales
      }
      
      setCuentasBikerData(resultadoFinal)

      const mensajeRango = esRango ? ` del ${fechaInicioBiker} al ${fechaFinBiker}` : ` del ${fechaDiariaBiker}`
      showNotification(`✅ Cuentas calculadas para ${resultadosBikers.length} bikers${mensajeRango}`, 'success')
      
    } catch (error) {

      showNotification('❌ Error al calcular cuentas de bikers', 'error')
    }
  }

  // Función para calcular la cuenta de todos los bikers (ELIMINADA)
  const calcularCuentaBiker_ELIMINADA = () => {

    return null
  }

  const loadCobrosPagos = async () => {
    try {
      const clientesConActividad = calculateCobrosPagos(orders, descuentosClientes)
      setCobrosPagosData(clientesConActividad)
      showNotification(`💰 ${clientesConActividad.length} clientes procesados con actividad financiera`, 'success')
    } catch (error) {
      showNotification('❌ Error al cargar datos de cobros y pagos', 'error')
    }
  }

  // Función para filtrar pedidos por rango de fechas
  const filtrarPedidosPorFecha = (pedidos) => {
    if (!fechaInicioEmpresas && !fechaFinEmpresas) {
      return pedidos
    }
    
    return pedidos.filter(pedido => {
      const fechaPedido = pedido.fecha || pedido['Fecha Registro'] || pedido['Fechas'] || ''
      if (!fechaPedido || fechaPedido === 'N/A') return false
      
      // Convertir fecha del pedido a Date usando dateService
      const fechaPedidoISO = convertToISO(fechaPedido)
      if (!fechaPedidoISO) return false
      
      const fechaPedidoDate = new Date(fechaPedidoISO + 'T00:00:00')
      if (isNaN(fechaPedidoDate.getTime())) return false
      
      // Comparar con rango de fechas
      const inicio = fechaInicioEmpresas ? new Date(fechaInicioEmpresas + 'T00:00:00') : null
      const fin = fechaFinEmpresas ? new Date(fechaFinEmpresas + 'T23:59:59') : null
      
      if (inicio && fin) {
        return fechaPedidoDate >= inicio && fechaPedidoDate <= fin
      } else if (inicio) {
        return fechaPedidoDate >= inicio
      } else if (fin) {
        return fechaPedidoDate <= fin
      }
      
      return true
    })
  }

  // Función para generar el sheet de empresas (puede recibir una empresa específica o todas)
  const generarSheetEmpresas = async (empresasEspecificas = null) => {
    const empresasAGenerar = empresasEspecificas || cobrosPagosData
    
    if (!empresasAGenerar || empresasAGenerar.length === 0) {
      showNotification('⚠️ No hay datos de empresas para generar el sheet', 'warning')
      return
    }

    try {
      setGenerandoSheet(true)
      const nombreEmpresa = empresasAGenerar.length === 1 ? empresasAGenerar[0].cliente : 'todas las empresas'
      
      // Filtrar pedidos por rango de fechas y incluir el descuento de cada empresa
      const empresasConDescuentoYFiltradas = empresasAGenerar.map(empresa => {
        const pedidosFiltrados = filtrarPedidosPorFecha(empresa.pedidos || [])
        return {
          ...empresa,
          pedidos: pedidosFiltrados,
          descuento: descuentosClientes[empresa.cliente] || 0
        }
      }).filter(empresa => empresa.pedidos && empresa.pedidos.length > 0) // Solo empresas con pedidos después del filtro
      
      if (empresasConDescuentoYFiltradas.length === 0) {
        showNotification('⚠️ No hay pedidos en el rango de fechas seleccionado', 'warning')
        return
      }

      const response = await fetch(getApiUrl('/api/empresas/generar-sheet'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          empresasData: empresasConDescuentoYFiltradas
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar el sheet')
      }

      const mensaje = empresasAGenerar.length === 1 
        ? `✅ Sheet generado exitosamente para ${nombreEmpresa} con ${result.rowsWritten} filas`
        : `✅ Sheet generado exitosamente con ${result.rowsWritten} filas`
      
      showNotification(mensaje, 'success')

    } catch (error) {

      showNotification(`❌ Error al generar el sheet: ${error.message}`, 'error')
    } finally {
      setGenerandoSheet(false)
    }
  }

  // Función para descargar PDF de empresas leyendo datos del sheet
  const descargarPDFEmpresas = async (empresa = null) => {
    try {
      const nombreEmpresa = empresa ? empresa.cliente : 'todas las empresas'
      showNotification('📖 Leyendo datos del sheet para generar PDF...', 'info')
      
      // Leer datos del sheet "Plantilla Empresas" con filtro de fechas
      const url = new URL(getApiUrl('/api/empresas/leer-sheet'))
      if (fechaInicioEmpresas) url.searchParams.append('fechaInicio', fechaInicioEmpresas)
      if (fechaFinEmpresas) url.searchParams.append('fechaFin', fechaFinEmpresas)
      
      const response = await fetch(url.toString())
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al leer datos del sheet')
      }
      
      if (!result.data || result.data.length === 0) {
        showNotification('⚠️ No hay datos en el sheet "Plantilla Empresas". Primero genera el sheet.', 'warning')
        return
      }

      // NOTA: formatearFecha eliminada - se usa formatDateForDisplay de dateService.js
      
      // Extraer información de totales (las filas de totales tienen el texto en la columna "Entrega")

      const filaTotalCarreras = result.filasTotales.find(f => {
        const entrega = (f['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (f['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        return texto.includes('TOTAL CARRERAS')
      })
      
      const filaDescuento = result.filasTotales.find(f => {
        const entrega = (f['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (f['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        return texto.includes('DESCUENTO') && !texto.includes('SUBTOTAL')
      })
      
      const filaSubtotalCarreras = result.filasTotales.find(f => {
        const entrega = (f['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (f['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        return texto.includes('SUBTOTAL CARRERAS')
      })
      
      const filaCobrosAdicionales = result.filasTotales.find(f => {
        const entrega = (f['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (f['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        return texto.includes('TOTAL COBROS')
      })
      
      const filaPagos = result.filasTotales.find(f => {
        const entrega = (f['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (f['Recojo'] || '').toString().toUpperCase().trim()
        const texto = entrega || recojo
        return texto.includes('TOTAL PAGOS')
      })
      
      const filaCuentaTotal = result.filasTotales.find(f => {
        const entrega = (f['Entrega'] || '').toString().toUpperCase().trim()
        const recojo = (f['Recojo'] || '').toString().toUpperCase().trim()
        return entrega.includes('CUENTA TOTAL') || recojo.includes('CUENTA TOTAL')
      })
      
      // Debug: mostrar qué filas se encontraron

      // Generar PDF usando jsPDF
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      // Configuración de página
      const pageWidth = 210
      const pageHeight = 297
      const margin = 15
      let currentY = margin + 10
      
      // Función helper para formatear moneda en el PDF
      const formatCurrencyPDF = (value) => {
        if (!value || value === '0' || value === 0) return '0'
        const num = parseFloat(value)
        if (isNaN(num)) return value
        return num.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      }
      
      // Cargar logo para marca de agua
      let watermarkData = null
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            try {
              // Crear canvas para aplicar opacidad
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              
              // Dibujar imagen con opacidad reducida (15% para marca de agua)
              ctx.globalAlpha = 0.15
              ctx.drawImage(img, 0, 0, img.width, img.height)
              
              // Convertir canvas a imagen
              watermarkData = canvas.toDataURL('image/png')
              resolve()
            } catch (error) {

              resolve() // Continuar aunque falle
            }
          }
          
          img.onerror = () => {

            resolve() // Continuar aunque falle la carga
          }
          
          // Cargar imagen del logo
          img.src = '/data/ECO DELIVERY-03.png'
        })
      } catch (error) {

      }
      
      // Función para agregar marca de agua en la página actual
      const agregarMarcaDeAgua = () => {
        if (!watermarkData) return
        
        try {
          // Calcular posición centrada (3 veces más grande)
          const logoWidth = 180 // Ancho del logo en mm (60 * 3)
          const logoHeight = 120 // Alto aproximado (40 * 3)
          const x = (pageWidth - logoWidth) / 2
          const y = (pageHeight - logoHeight) / 2
          
          // Agregar logo como marca de agua
          pdf.addImage(watermarkData, 'PNG', x, y, logoWidth, logoHeight)
        } catch (error) {

        }
      }
      
      // Encabezado profesional con fondo
      const headerHeight = 35
      const headerY = currentY - 5
      
      // Fondo del encabezado con color #96c226
      pdf.setFillColor(150, 194, 38) // #96c226
      pdf.rect(0, headerY, pageWidth, headerHeight, 'F')
      
      // Título principal (blanco sobre fondo verde)
      pdf.setFontSize(18)
      pdf.setTextColor(255, 255, 255) // Blanco
      pdf.setFont('helvetica', 'bold')
      pdf.text('RESUMEN DE EMPRESA', pageWidth / 2, headerY + 12, { align: 'center' })
      
      // Información de la empresa (blanco, más pequeño)
      pdf.setFontSize(12)
      pdf.setTextColor(255, 255, 255) // Blanco
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Empresa: ${nombreEmpresa}`, pageWidth / 2, headerY + 22, { align: 'center' })
      
      // Fecha y hora de generación (blanco, más pequeño)
      pdf.setFontSize(9)
      pdf.setTextColor(255, 255, 255) // Blanco
      const ahora = new Date()
      const fechaGeneracion = ahora.toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      const horaGeneracion = ahora.toLocaleTimeString('es-BO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      pdf.text(`Generado el ${fechaGeneracion} a las ${horaGeneracion}`, pageWidth / 2, headerY + 30, { align: 'center' })
      
      currentY = headerY + headerHeight + 10
      
      // Tabla de datos - Ajustar anchos para que quepan todas las columnas
      const colWidths = [10, 18, 28, 28, 17, 16, 16, 30, 16] // Anchos ajustados de columnas optimizados
      const headersRaw = result.headers || ['ID', 'Fecha', 'Recojo', 'Entrega', 'Tiempo de Espera', 'Precio Carrera', 'Cobro o pago', 'Descripcion c/p', 'Monto c/p']
      
      // Función para dividir headers largos en múltiples líneas
      const splitHeaderIntoLines = (header, maxWidth) => {
        const words = header.split(/\s+/)
        const lines = []
        let currentLine = ''
        
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          // Estimar ancho del texto (aproximadamente 0.5mm por carácter)
          const estimatedWidth = testLine.length * 0.5
          
          if (estimatedWidth <= maxWidth || !currentLine) {
            currentLine = testLine
          } else {
            lines.push(currentLine)
            currentLine = word
          }
        })
        
        if (currentLine) {
          lines.push(currentLine)
        }
        
        return lines.length > 0 ? lines : [header]
      }
      
      // Preparar headers divididos en líneas
      const headersWithLines = headersRaw.map((header, index) => {
        const maxWidth = colWidths[index] - 2 // Dejar margen
        return splitHeaderIntoLines(header, maxWidth)
      })
      
      // Calcular altura del header basado en el máximo de líneas
      const maxLines = Math.max(...headersWithLines.map(h => h.length))
      const tableHeaderHeight = 6 + (maxLines - 1) * 4 // 6mm base + 4mm por línea adicional
      
      // Encabezado de tabla
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      let currentX = margin
      headersWithLines.forEach((headerLines, index) => {
        // Dibujar rectángulo con color #96c226 (RGB: 150, 194, 38)
        pdf.setFillColor(150, 194, 38) // Fondo verde #96c226
        pdf.rect(currentX, currentY, colWidths[index], tableHeaderHeight, 'F')
        
        // Borde de celda
        pdf.setDrawColor(100, 130, 20)
        pdf.setLineWidth(0.1)
        pdf.rect(currentX, currentY, colWidths[index], tableHeaderHeight, 'S')
        
        // Texto blanco para mejor contraste - dibujar cada línea
        pdf.setTextColor(255, 255, 255) // Texto blanco
        const lineHeight = 4
        const startY = currentY + 3 + (tableHeaderHeight - (headerLines.length * lineHeight)) / 2
        
        headerLines.forEach((line, lineIndex) => {
          pdf.text(line, currentX + colWidths[index] / 2, startY + (lineIndex * lineHeight), { align: 'center' })
        })
        
        currentX += colWidths[index]
      })
      currentY += tableHeaderHeight + 2
      
      // Filas de datos
      pdf.setFontSize(6.5)
      result.data.forEach((row, index) => {
        if (currentY > pageHeight - 40) {
          pdf.addPage()
          agregarMarcaDeAgua() // Agregar marca de agua en la nueva página
          currentY = margin + 10
          // Redibujar encabezado en nueva página
          currentX = margin
          pdf.setFontSize(7)
          pdf.setFont('helvetica', 'bold')
          headersWithLines.forEach((headerLines, hIndex) => {
            // Dibujar rectángulo con color #96c226 (RGB: 150, 194, 38)
            pdf.setFillColor(150, 194, 38) // Fondo verde #96c226
            pdf.rect(currentX, currentY, colWidths[hIndex], tableHeaderHeight, 'F')
            
            // Borde de celda
            pdf.setDrawColor(100, 130, 20)
            pdf.setLineWidth(0.1)
            pdf.rect(currentX, currentY, colWidths[hIndex], tableHeaderHeight, 'S')
            
            // Texto blanco para mejor contraste - dibujar cada línea
            pdf.setTextColor(255, 255, 255) // Texto blanco
            const lineHeight = 4
            const startY = currentY + 3 + (tableHeaderHeight - (headerLines.length * lineHeight)) / 2
            
            headerLines.forEach((line, lineIndex) => {
              pdf.text(line, currentX + colWidths[hIndex] / 2, startY + (lineIndex * lineHeight), { align: 'center' })
            })
            
            currentX += colWidths[hIndex]
          })
          currentY += tableHeaderHeight + 2
        }
        
        currentX = margin
        // Formatear fecha antes de agregar a rowData usando dateService
        const fechaOriginal = row['Fecha'] || ''
        const fechaFormateada = formatDateForDisplay(fechaOriginal)
        
        // Debug: mostrar conversión de fechas
        if (fechaOriginal && fechaOriginal !== fechaFormateada) {

        }
        
        // Formatear valores monetarios
        const precioCarrera = row['Precio Carrera'] || row['Precio Carr'] || ''
        const precioFormateado = precioCarrera ? formatCurrencyPDF(precioCarrera) : ''
        const montoCP = row['Monto c/p'] || ''
        const montoCPFormateado = montoCP ? formatCurrencyPDF(montoCP) : ''
        
        const rowData = [
          row['ID'] || '',
          fechaFormateada,
          (row['Recojo'] || '').substring(0, 15),
          (row['Entrega'] || '').substring(0, 15),
          row['Tiempo de Espera'] || row['Tiempo de espera'] || row.tiempo_espera || '',
          precioFormateado,
          row['Cobro o pago'] || '',
          (row['Descripcion c/p'] || '').substring(0, 18),
          montoCPFormateado
        ]
        
        // Fondo gris claro alternado para filas (par = gris, impar = blanco)
        const fondoGris = index % 2 === 0 ? [245, 245, 245] : [255, 255, 255]
        
        rowData.forEach((cell, cellIndex) => {
          pdf.setFillColor(...fondoGris)
          pdf.rect(currentX, currentY, colWidths[cellIndex], 6, 'F')
          
          // Borde de celda
          pdf.setDrawColor(220, 220, 220)
          pdf.rect(currentX, currentY, colWidths[cellIndex], 6, 'S')
          
          pdf.setTextColor(0, 0, 0)
          pdf.setFontSize(6.5)
          pdf.setFont('helvetica', 'normal')
          // Truncar texto largo según ancho de columna
          const maxLen = cellIndex === 7 ? 22 : 15 // Más espacio para descripción
          const cellText = String(cell).length > maxLen ? String(cell).substring(0, maxLen) + '...' : String(cell)
          pdf.text(cellText, currentX + 1.5, currentY + 4)
          currentX += colWidths[cellIndex]
        })
        
        currentY += 7
      })
      
      // Casilla especial de totales al final
      currentY += 20
      
      // Verificar si hay espacio suficiente, si no, nueva página
      if (currentY > pageHeight - 120) {
        pdf.addPage()
        agregarMarcaDeAgua() // Agregar marca de agua en la nueva página
        currentY = margin + 10
      }
      
      // Título de la sección de totales con fondo verde
      const tituloTotalHeight = 12
      pdf.setFillColor(150, 194, 38) // Verde #96c226
      pdf.rect(margin, currentY - 3, pageWidth - 2 * margin, tituloTotalHeight, 'F')
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255) // Blanco
      pdf.text('RESUMEN FINANCIERO', pageWidth / 2, currentY + 5, { align: 'center' })
      currentY += tituloTotalHeight + 5
      
      // Casilla especial con borde destacado
      const totalBoxWidth = pageWidth - 2 * margin
      const totalBoxHeight = 95 // Altura aumentada para acomodar todos los elementos
      const totalBoxY = currentY
      
      // Fondo de la casilla con degradado visual
      pdf.setFillColor(248, 250, 252) // Azul gris muy claro
      pdf.setDrawColor(150, 194, 38) // Borde verde
      pdf.setLineWidth(0.8)
      pdf.rect(margin, totalBoxY, totalBoxWidth, totalBoxHeight, 'FD')
      
      currentY = totalBoxY + 10
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      
      const totalCol1Width = totalBoxWidth * 0.68 // 68% para etiqueta
      const totalCol2Width = totalBoxWidth * 0.32 // 32% para valor
      
      // Línea decorativa superior
      pdf.setDrawColor(150, 194, 38)
      pdf.setLineWidth(0.5)
      pdf.line(margin + 8, currentY, margin + totalBoxWidth - 8, currentY)
      currentY += 5
      
      // 1. TOTAL CARRERAS
      if (filaTotalCarreras) {
        pdf.setFillColor(255, 255, 255)
        pdf.rect(margin + 5, currentY - 3, totalBoxWidth - 10, 8, 'F')
        pdf.setTextColor(30, 41, 59)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Total de Carreras Realizadas:', margin + 10, currentY + 2)
        const totalValue = filaTotalCarreras['Precio Carrera'] || filaTotalCarreras['Precio Carr'] || '0'
        pdf.setTextColor(0, 0, 0)
        pdf.text(`${formatCurrencyPDF(totalValue)} Bs`, margin + totalCol1Width + 8, currentY + 2, { align: 'right' })
        currentY += 10
      }
      
      // 2. DESCUENTO
      if (filaDescuento) {
        pdf.setTextColor(100, 116, 139)
        pdf.setFont('helvetica', 'normal')
        const descuentoTexto = filaDescuento['Entrega'] || filaDescuento['Recojo'] || 'DESCUENTO'
        pdf.text(`    ${descuentoTexto}:`, margin + 10, currentY)
        const descuentoValue = filaDescuento['Precio Carrera'] || filaDescuento['Precio Carr'] || '0'
        pdf.setTextColor(220, 38, 38)
        pdf.text(`-${formatCurrencyPDF(descuentoValue)} Bs`, margin + totalCol1Width + 8, currentY, { align: 'right' })
        currentY += 8
      }
      
      // 3. SUBTOTAL CARRERAS
      if (filaSubtotalCarreras) {
        pdf.setTextColor(30, 41, 59)
        pdf.setFont('helvetica', 'bold')
        pdf.text('    Subtotal Carreras:', margin + 10, currentY)
        const subtotalValue = filaSubtotalCarreras['Precio Carrera'] || filaSubtotalCarreras['Precio Carr'] || '0'
        pdf.setTextColor(0, 0, 0)
        pdf.text(`${formatCurrencyPDF(subtotalValue)} Bs`, margin + totalCol1Width + 8, currentY, { align: 'right' })
        currentY += 10
      }
      
      // 4. TOTAL COBROS
      if (filaCobrosAdicionales) {
        pdf.setFillColor(240, 253, 244)
        pdf.rect(margin + 5, currentY - 3, totalBoxWidth - 10, 8, 'F')
        pdf.setTextColor(22, 163, 74)
        pdf.setFont('helvetica', 'bold')
        pdf.text('(+) Cobros Adicionales a Favor:', margin + 10, currentY + 2)
        const cobrosValue = filaCobrosAdicionales['Monto c/p'] || '0'
        pdf.text(`+${formatCurrencyPDF(cobrosValue)} Bs`, margin + totalCol1Width + 8, currentY + 2, { align: 'right' })
        currentY += 10
      }
      
      // 5. TOTAL PAGOS
      if (filaPagos) {
        pdf.setFillColor(254, 242, 242)
        pdf.rect(margin + 5, currentY - 3, totalBoxWidth - 10, 8, 'F')
        pdf.setTextColor(220, 38, 38)
        pdf.setFont('helvetica', 'bold')
        pdf.text('(-) Pagos Realizados:', margin + 10, currentY + 2)
        const pagosValue = filaPagos['Monto c/p'] || '0'
        pdf.text(`-${formatCurrencyPDF(pagosValue)} Bs`, margin + totalCol1Width + 8, currentY + 2, { align: 'right' })
        currentY += 10
      }
      
      // Línea separadora doble antes de CUENTA TOTAL
      if (filaCuentaTotal) {
        currentY += 2
        pdf.setDrawColor(150, 194, 38)
        pdf.setLineWidth(0.8)
        pdf.line(margin + 8, currentY, margin + totalBoxWidth - 8, currentY)
        currentY += 1
        pdf.line(margin + 8, currentY, margin + totalBoxWidth - 8, currentY)
        currentY += 5
      }
      
      // 6. CUENTA TOTAL (destacado con explicación)
      if (filaCuentaTotal) {
        // Fondo destacado
        pdf.setFillColor(150, 194, 38) // Verde
        pdf.rect(margin + 5, currentY - 3, totalBoxWidth - 10, 14, 'F')
        
        // Borde doble para mayor énfasis
        pdf.setDrawColor(59, 130, 246)
        pdf.setLineWidth(0.5)
        pdf.rect(margin + 5, currentY - 3, totalBoxWidth - 10, 14, 'S')
        
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('TOTAL A PAGAR POR LA EMPRESA:', margin + 10, currentY + 4)
        
        // CUENTA TOTAL está en la columna "Monto c/p" (columna I)
        const cuentaTotal = filaCuentaTotal['Monto c/p'] || filaCuentaTotal['Precio Carrera'] || '0'
        pdf.setFontSize(14)
        pdf.text(`${formatCurrencyPDF(cuentaTotal)} Bs`, margin + totalCol1Width + 8, currentY + 4, { align: 'right' })
        currentY += 16
      }
      
      // Nota explicativa al final
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.setFont('helvetica', 'italic')
      const notaExplicativa = 'Este monto incluye el costo de todas las carreras realizadas, más los cobros adicionales, menos los pagos ya efectuados.'
      pdf.text(notaExplicativa, pageWidth / 2, currentY + 2, { align: 'center', maxWidth: totalBoxWidth - 20 })
      currentY += 8
      
      // Agregar marca de agua y pie de página en todas las páginas
      const totalPages = pdf.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        // Guardar el estado actual del gráfico
        pdf.saveGraphicsState()
        // Agregar marca de agua (se dibujará detrás del contenido existente)
        agregarMarcaDeAgua()
        // Restaurar el estado
        pdf.restoreGraphicsState()
        
        // Agregar pie de página
        const footerY = pageHeight - 10
        pdf.setFontSize(7)
        pdf.setTextColor(120, 120, 120)
        pdf.setFont('helvetica', 'italic')
        
        // Línea decorativa
        pdf.setDrawColor(150, 194, 38)
        pdf.setLineWidth(0.3)
        pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3)
        
        // Número de página
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, footerY, { align: 'center' })
        
        // Información de contacto (opcional)
        pdf.setFontSize(6)
        pdf.text('Eco Delivery Bolivia', margin, footerY)
        pdf.text(`Generado: ${new Date().toLocaleDateString('es-BO')}`, pageWidth - margin, footerY, { align: 'right' })
      }
      
      // Guardar PDF
      const nombreArchivo = `Resumen_${nombreEmpresa.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(nombreArchivo)
      
      showNotification('✅ PDF generado exitosamente desde el sheet', 'success')

    } catch (error) {

      showNotification(`❌ Error al generar PDF: ${error.message}`, 'error')
    }
  }

  // Función específica para cargar bikers para "Agregar Pedido" (desde pestaña dedicada)
  const loadBikersForAgregar = async () => {
    try {
      setLoadingBikersAgregar(true)
      
      const bikersConAsignar = await loadBikersForAgregarAPI()
      
      setBikersAgregar(bikersConAsignar)
      showNotification(`🚴‍♂️ ${bikersConAsignar.length - 1} bikers cargados para Agregar Pedido`, 'success')
      
    } catch (error) {
      showNotification('⚠️ Error al cargar bikers. Usando datos locales.', 'error')
      // No fallar completamente, continuar con datos vacíos
    } finally {
      setLoadingBikersAgregar(false)
    }
  }

  // Función legacy que decide cuál usar (mantener compatibilidad)
  const loadBikers = async () => {
    if (activeTab === 'agregar') {
      await loadBikersForAgregar()
    } else {
      // Por defecto usar la función de agregar
      await loadBikersForAgregar()
    }
  }

  // getEmpresaMapa y getClienteInfo ahora se importan desde dataHelpers.js

  // generateGoogleMapsLink ahora se importa desde mapsUtils.js

  // Función para manejar cambio entre modo dropdown y manual
  const handleRecojoModeChange = (isManual) => {
    setRecojoManual(isManual)
    if (isManual) {
      // Cambiar a modo manual: mantener dirección si existe, auto-completar nombre
      setForm(prev => {
        // Si hay dirección pero no hay nombre o es de empresa, poner "Sin especificar"
        let newRecojo = prev.recojo || ''
        
        // Si no hay nombre O si el nombre actual es de una empresa (del dropdown), auto-completar
        if (!prev.recojo || prev.recojo.trim() === '' || empresas.some(emp => emp.empresa === prev.recojo)) {
          newRecojo = prev.direccion_recojo ? 'Sin especificar' : ''
        }
        
        return {
          ...prev,
          recojo: newRecojo
        }
      })
    } else {
      // Cambiar a modo dropdown: limpiar entrada manual
      setForm(prev => ({ 
        ...prev, 
        recojo: '',
        direccion_recojo: ''
      }))
    }
  }

  const handleEntregaModeChange = (isManual) => {
    setEntregaManual(isManual)
    if (isManual) {
      // Cambiar a modo manual: mantener dirección si existe, auto-completar nombre
      setForm(prev => {
        // Si hay dirección pero no hay nombre o es de empresa, poner "Sin especificar"
        let newEntrega = prev.entrega || ''
        
        // Si no hay nombre O si el nombre actual es de una empresa (del dropdown), auto-completar
        if (!prev.entrega || prev.entrega.trim() === '' || empresas.some(emp => emp.empresa === prev.entrega)) {
          newEntrega = prev.direccion_entrega ? 'Sin especificar' : ''
        }
        
        return {
          ...prev,
          entrega: newEntrega
        }
      })
    } else {
      // Cambiar a modo dropdown: limpiar entrada manual
      setForm(prev => ({ 
        ...prev, 
        entrega: '',
        direccion_entrega: ''
      }))
    }
  }

  // Funciones para manejar "Cliente avisa"
  const handleRecojoClienteAvisaChange = (isClienteAvisa) => {
    setRecojoClienteAvisa(isClienteAvisa)
    if (isClienteAvisa) {
      // Cambiar a modo "Cliente avisa": limpiar campos y establecer "Cliente avisa"
      setForm(prev => ({ 
        ...prev, 
        recojo: 'Cliente avisa',
        direccion_recojo: 'Cliente avisa'
      }))
      // Desactivar otros modos
      setRecojoManual(false)
    } else {
      // Desactivar "Cliente avisa": limpiar campos
      setForm(prev => ({ 
        ...prev, 
        recojo: '',
        direccion_recojo: ''
      }))
    }
  }

  const handleEntregaClienteAvisaChange = (isClienteAvisa) => {
    setEntregaClienteAvisa(isClienteAvisa)
    if (isClienteAvisa) {
      // Cambiar a modo "Cliente avisa": limpiar campos y establecer "Cliente avisa"
      setForm(prev => ({ 
        ...prev, 
        entrega: 'Cliente avisa',
        direccion_entrega: 'Cliente avisa'
      }))
      // Desactivar otros modos
      setEntregaManual(false)
    } else {
      // Desactivar "Cliente avisa": limpiar campos
      setForm(prev => ({ 
        ...prev, 
        entrega: '',
        direccion_entrega: ''
      }))
    }
  }

  // Función para manejar cambio de dirección manual
  const handleManualAddressChange = (type, value) => {
    if (type === 'recojo') {
      setForm(prev => ({ 
        ...prev, 
        recojo: value,
        direccion_recojo: generateGoogleMapsLink(value)
      }))
    } else if (type === 'entrega') {
      setForm(prev => ({ 
        ...prev, 
        entrega: value,
        direccion_entrega: generateGoogleMapsLink(value)
      }))
    }
  }

  // Función para detectar si el valor actual es un enlace de Google Maps
  // isGoogleMapsLink ahora se importa desde mapsUtils.js

  // Función para generar enlace automáticamente cuando se escribe una dirección
  const handleAddressChange = (type, value) => {
    if (type === 'recojo') {
      setForm(prev => ({ 
        ...prev, 
        recojo: value
      }))
      // Generar enlace automáticamente si no es un enlace y no hay uno ya
      if (!isGoogleMapsLink(value) && value.trim() !== '') {
        const mapsLink = generateGoogleMapsLink(value)
        setForm(prev => ({ 
          ...prev, 
          direccion_recojo: mapsLink
        }))
      }
    } else if (type === 'entrega') {
      setForm(prev => ({ 
        ...prev, 
        entrega: value
      }))
      // Generar enlace automáticamente si no es un enlace y no hay uno ya
      if (!isGoogleMapsLink(value) && value.trim() !== '') {
        const mapsLink = generateGoogleMapsLink(value)
        setForm(prev => ({ 
          ...prev, 
          direccion_entrega: mapsLink
        }))
      }
    }
  }

  // calculatePrice ahora se importa desde priceCalculator.js

  // Función para limpiar URLs de Google Maps (espacios, paréntesis, etc.)
  // cleanGoogleMapsUrl ahora se importa desde mapsUtils.js
  
  // Función para validar un link de Google Maps
  const validarLinkGoogleMaps = async (url, tipo) => {
    if (!url || !url.trim()) {
      if (tipo === 'recojo') {
        setValidacionRecojo({ estado: null, mensaje: '' })
      } else {
        setValidacionEntrega({ estado: null, mensaje: '' })
      }
      return
    }
    
    // Establecer estado de validando
    if (tipo === 'recojo') {
      setValidacionRecojo({ estado: 'validando', mensaje: 'Validando link...' })
    } else {
      setValidacionEntrega({ estado: 'validando', mensaje: 'Validando link...' })
    }
    
    try {
      const baseUrl = getBackendUrl()
      const response = await fetch(`${baseUrl}/api/validate-maps-link?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      
      if (data.valid) {
        if (tipo === 'recojo') {
          setValidacionRecojo({ estado: 'valido', mensaje: data.message || 'Link válido' })
        } else {
          setValidacionEntrega({ estado: 'valido', mensaje: data.message || 'Link válido' })
        }
      } else {
        if (tipo === 'recojo') {
          setValidacionRecojo({ estado: 'invalido', mensaje: data.reason || 'Link no válido' })
        } else {
          setValidacionEntrega({ estado: 'invalido', mensaje: data.reason || 'Link no válido' })
        }
      }
    } catch (error) {
      console.error('Error validando link:', error)
      if (tipo === 'recojo') {
        setValidacionRecojo({ estado: 'invalido', mensaje: 'Error al validar' })
      } else {
        setValidacionEntrega({ estado: 'invalido', mensaje: 'Error al validar' })
      }
    }
  }

  // calculateDistance ahora se importa desde distanceCalculator.js
  // Wrapper que maneja efectos secundarios (setLastDistanceError, logToCSV)
  const calculateDistanceWrapper = async (origin, destination) => {
    return await calculateDistance(origin, destination, {
      onError: (errorObj) => {
        setLastDistanceError(errorObj)
      },
      onLog: logToCSV
    })
  }

  // Función para intercambiar recojo y entrega
  const swapRecojoEntrega = () => {
    setForm(prev => ({
      ...prev,
      // Intercambiar direcciones
      direccion_recojo: prev.direccion_entrega,
      direccion_entrega: prev.direccion_recojo,
      // Intercambiar info adicional
      info_direccion_recojo: prev.info_direccion_entrega,
      info_direccion_entrega: prev.info_direccion_recojo,
      // Intercambiar nombres (si están en modo empresas)
      recojo: prev.entrega,
      entrega: prev.recojo
    }))
    showNotification('🔄 Recojo y Entrega intercambiados', 'success')
  }

  // Función separada para calcular distancia y precio
  const calculateDistanceAndPrice = async (direccionRecojo, direccionEntrega, medioTransporte) => {
    if (!direccionRecojo || !direccionEntrega) {
      return
    }

    // Evitar cálculos múltiples simultáneos
    if (isCalculatingDistance) {
      return
    }

    setIsCalculatingDistance(true)

    showNotification('🔄 Calculando distancia...', 'success')
    try {
      // Limpiar URLs antes de calcular
      const cleanRecojo = cleanGoogleMapsUrl(direccionRecojo)
      const cleanEntrega = cleanGoogleMapsUrl(direccionEntrega)
      const distance = await calculateDistanceWrapper(cleanRecojo, cleanEntrega)

      if (distance) {
        // Calcular precio solo si tenemos medio de transporte y no es Cuenta
        if (medioTransporte && medioTransporte.trim() !== '') {
          // Verificar si el método de pago actual es Cuenta
          const metodoPagoActual = form.metodo_pago || 'Efectivo'
          
          // Siempre calcular el precio para guardarlo en el sheet
          const precio = calculatePrice(distance, medioTransporte)
          
          if (metodoPagoActual === 'Cuenta' || metodoPagoActual === 'A cuenta') {
            // Para "Cuenta" o "A cuenta", guardar el precio calculado pero mostrar el método del cliente
            setForm((prev) => ({ 
              ...prev, 
              distancia_km: distance,
              precio_bs: precio // Guardar el precio real en el sheet
            }))
            showNotification(`📏 Distancia: ${distance} km • 💳 Precio calculado: ${precio} Bs (${metodoPagoActual} del cliente)`, 'success')
          } else {
            setForm((prev) => ({ 
              ...prev, 
              distancia_km: distance,
              precio_bs: precio 
            }))
            showNotification(`📏 Distancia: ${distance} km • 💰 Precio: ${precio} Bs`, 'success')
          }
        } else {
          // Solo actualizar distancia

          setForm((prev) => ({ 
            ...prev, 
            distancia_km: distance
          }))
          showNotification(`📏 Distancia calculada: ${distance} km`, 'success')
        }
      } else {
        // Mostrar modal de error (el error ya está guardado en lastDistanceError)
        setShowDistanceErrorModal(true)
        showNotification('⚠️ No se pudo calcular la distancia. Revisa los links.', 'warning')
      }
    } catch (error) {
      // Guardar el error si no se guardó antes
      if (!lastDistanceError) {
        setLastDistanceError({
          message: error.message,
          origin: form.direccion_recojo,
          destination: form.direccion_entrega,
          fullError: error.stack || error.toString()
        })
      }
      // Mostrar modal de error
      setShowDistanceErrorModal(true)
      showNotification(`❌ Error al calcular distancia: ${error.message}`, 'error')
    } finally {
      setIsCalculatingDistance(false)
    }
  }

  const handleChange = async (e) => {
    const { name, value } = e.target
    let updatedForm = { [name]: value }
    
    // Manejar modo personalizado para cliente
    if (name === 'cliente' && value === '__CUSTOM__') {
      updatedForm = { cliente: '', clienteCustom: true }
    }
    
    // Manejar modo personalizado para biker
    if (name === 'biker' && value === '__CUSTOM__') {
      updatedForm = { biker: '', bikerCustom: true }
    }
    
    // Debug específico para descripción de cobro o pago
    if (name === 'descripcion_cobro_pago') {

    }

    // Auto-llenar direcciones con URLs de Maps (solo para modo dropdown)
    if (name === 'recojo' && !recojoManual) {
      const empresaMapa = getEmpresaMapa(value, empresas) || ''
      updatedForm.direccion_recojo = empresaMapa

    } else if (name === 'entrega' && !entregaManual) {
      const empresaMapa = getEmpresaMapa(value, empresas) || ''
      updatedForm.direccion_entrega = empresaMapa

    }
    
    // Para modo manual, limpiar URLs de Google Maps cuando se ingresan
    if ((name === 'direccion_recojo' || name === 'direccion_entrega') && value) {
      updatedForm[name] = cleanGoogleMapsUrl(value)
      
      // Validar el link automáticamente después de un pequeño delay
      setTimeout(() => {
        if (name === 'direccion_recojo') {
          validarLinkGoogleMaps(cleanGoogleMapsUrl(value), 'recojo')
        } else {
          validarLinkGoogleMaps(cleanGoogleMapsUrl(value), 'entrega')
        }
      }, 500) // Esperar 500ms después de que el usuario deje de escribir
    }
    
    // Para modo manual, el enlace pegado es lo que cuenta
    // Auto-completar el nombre cuando se pega una dirección en modo manual
    if (name === 'direccion_recojo' && recojoManual && value) {
      // Validar enlace de Google Maps
      if (!validateGoogleMapsLink(value)) {
        showNotification('⚠️ Por favor ingresa un enlace válido de Google Maps', 'error')
        return // No actualizar el formulario si el enlace no es válido
      }
      
      // Si el campo recojo está vacío, auto-completarlo con "Dirección manual"
      if (!form.recojo || form.recojo.trim() === '') {
        updatedForm.recojo = 'Sin especificar'
      }
    } else if (name === 'direccion_entrega' && entregaManual && value) {
      // Validar enlace de Google Maps
      if (!validateGoogleMapsLink(value)) {
        showNotification('⚠️ Por favor ingresa un enlace válido de Google Maps', 'error')
        return // No actualizar el formulario si el enlace no es válido
      }
      
      // Si el campo entrega está vacío, auto-completarlo con "Dirección manual"
      if (!form.entrega || form.entrega.trim() === '') {
        updatedForm.entrega = 'Sin especificar'
      }
    }
    
    // Auto-calcular día de la semana cuando cambie la fecha
    if (name === 'fecha' && value) {
      const diaSemana = calculateDayOfWeek(value)
      updatedForm.dia_semana = diaSemana

    }
    
    // Auto-completar WhatsApp cuando se seleccione un biker
    if (name === 'biker') {
      if (value && value !== '__CUSTOM__') {
        // Si se selecciona "ASIGNAR BIKER", limpiar el WhatsApp
        if (value === 'ASIGNAR BIKER') {
          updatedForm.whatsapp = ''

        } else {
          // Para otros bikers, auto-completar WhatsApp
        const selectedBiker = bikersAgregar.find(biker => (biker.nombre || biker) === value)
        if (selectedBiker) {
          // Buscar WhatsApp en diferentes posibles propiedades
          const whatsappValue = selectedBiker.whatsapp || selectedBiker.WhatsApp || selectedBiker['WhatsApp'] || selectedBiker.telefono || 'N/A'
          if (whatsappValue && whatsappValue !== 'N/A') {
            updatedForm.whatsapp = whatsappValue

            }
          }
        }
      } else if (!value) {
        // Limpiar WhatsApp si se deselecciona el biker
        updatedForm.whatsapp = ''

      }
    }
    
    // Detectar cuando el usuario edita manualmente el precio
    if (name === 'precio_bs') {
      setPrecioEditadoManualmente(true)

      // Si es modo "Cuenta", mostrar notificación especial
      if (form.metodo_pago === 'Cuenta') {
        showNotification('✏️ Precio editado manualmente (Cuenta del cliente)', 'info')
      }
    }
    
    // Limpiar monto si se deselecciona cobro/pago
    if (name === 'cobro_pago' && (!value || value.trim() === '')) {
      updatedForm.monto_cobro_pago = ''
    }
    
    // Debug para campos de cobro/pago
    if (name === 'cobro_pago' || name === 'monto_cobro_pago') {

    }
    
    // Actualizar el formulario
    setForm((prev) => ({ ...prev, ...updatedForm }))
    
    // Remover clase de error si el campo ahora tiene valor
    if (value && value.trim() !== '' && e.target && e.target.classList) {
      e.target.classList.remove('field-required')
    }
    
    const newForm = { ...form, ...updatedForm }
    
    // Si se edita manualmente la distancia, recalcular precio automáticamente
    if (name === 'distancia_km') {
      const distanciaValue = parseFloat(value) || 0
      const tieneMedioTransporte = newForm.medio_transporte && newForm.medio_transporte.trim() !== ''
      
      if (distanciaValue > 0 && tieneMedioTransporte && !recojoClienteAvisa && !entregaClienteAvisa) {
        if (newForm.metodo_pago === 'Cuenta' || newForm.metodo_pago === 'A cuenta') {
          const precio = calculatePrice(distanciaValue.toString(), newForm.medio_transporte)
          setForm((prev) => ({ 
            ...prev, 
            distancia_km: distanciaValue.toString(),
            precio_bs: precio 
          }))
          setPrecioEditadoManualmente(false)
          showNotification(`💳 Precio recalculado: ${precio} Bs (${newForm.metodo_pago} del cliente)`, 'success')
        } else if (!precioEditadoManualmente) {
          const precio = calculatePrice(distanciaValue.toString(), newForm.medio_transporte)
          setForm((prev) => ({ 
            ...prev, 
            distancia_km: distanciaValue.toString(),
            precio_bs: precio 
          }))
          showNotification(`💰 Precio recalculado: ${precio} Bs`, 'success')
        } else {
          showNotification('✏️ Distancia editada manualmente. El precio no se recalcula automáticamente.', 'info')
        }
      } else if (distanciaValue === 0 || !tieneMedioTransporte) {
        // Si la distancia es 0 o no hay medio de transporte, limpiar precio
        setForm((prev) => ({ 
          ...prev, 
          distancia_km: distanciaValue > 0 ? distanciaValue.toString() : '',
          precio_bs: '' 
        }))
      }
      
      // Actualizar el formulario y retornar (no continuar con otros cálculos)
      setForm((prev) => ({ ...prev, ...updatedForm }))
      return
    }
    
    // Solo recalcular distancia y precio si cambió algo relevante
    const shouldRecalculate = name === 'recojo' || name === 'entrega' || name === 'medio_transporte' || name === 'metodo_pago'
    
    if (shouldRecalculate) {
      // Verificar condiciones para cálculos
      const tieneRecojo = newForm.direccion_recojo && newForm.direccion_recojo.trim() !== ''
      const tieneEntrega = newForm.direccion_entrega && newForm.direccion_entrega.trim() !== ''
      const tieneMedioTransporte = newForm.medio_transporte && newForm.medio_transporte.trim() !== ''

      // CALCULAR DISTANCIA: Solo necesita recojo y entrega (y no estar en modo "Cliente avisa")
      if (tieneRecojo && tieneEntrega && !recojoClienteAvisa && !entregaClienteAvisa && (name === 'recojo' || name === 'entrega' || name === 'direccion_recojo' || name === 'direccion_entrega')) {

        await calculateDistanceAndPrice(newForm.direccion_recojo, newForm.direccion_entrega, newForm.medio_transporte)
      }
      
      // MANEJAR CAMBIO DE MÉTODO DE PAGO
      else if (name === 'metodo_pago') {
        if (value === 'Cuenta' || value === 'A cuenta') {

          if (form.distancia_km && form.medio_transporte) {
            const precio = calculatePrice(form.distancia_km, form.medio_transporte)
            setForm((prev) => ({ ...prev, precio_bs: precio }))
            setPrecioEditadoManualmente(false) // Resetear flag
            showNotification(`💳 Precio calculado: ${precio} Bs (${value} del cliente)`, 'success')
          } else {
            setForm((prev) => ({ ...prev, precio_bs: 0 }))
            setPrecioEditadoManualmente(false) // Resetear flag
            showNotification(`💳 Método: ${value} del cliente (precio: 0 Bs)`, 'success')
          }
        } else if (form.distancia_km && form.medio_transporte && !precioEditadoManualmente) {

          const precio = calculatePrice(form.distancia_km, form.medio_transporte)
          setForm((prev) => ({ ...prev, precio_bs: precio }))
          showNotification(`💰 Precio actualizado: ${precio} Bs`, 'success')
        } else if (precioEditadoManualmente) {

          showNotification('✏️ Precio editado manualmente: No se recalcula automáticamente', 'info')
        }
      }
      
      // CALCULAR PRECIO: Necesita distancia + medio de transporte (excepto si es Cuenta)
      else if (name === 'medio_transporte' && form.distancia_km && tieneMedioTransporte && !recojoClienteAvisa && !entregaClienteAvisa) {
        if (newForm.metodo_pago === 'Cuenta') {

          const precio = calculatePrice(form.distancia_km, value)
          setForm((prev) => ({ ...prev, precio_bs: precio }))
          setPrecioEditadoManualmente(false) // Resetear flag
          showNotification(`💳 Precio calculado: ${precio} Bs (Cuenta del cliente)`, 'success')
        } else if (!precioEditadoManualmente) {

          const precio = calculatePrice(form.distancia_km, value)
          setForm((prev) => ({ ...prev, precio_bs: precio }))
          showNotification(`💰 Precio actualizado: ${precio} Bs`, 'success')
        } else {

          showNotification('✏️ Precio editado manualmente: No se recalcula automáticamente', 'info')
        }
      }
      
      // LIMPIAR si se quitan datos necesarios
      else if (name === 'recojo' || name === 'entrega') {
        if (!tieneRecojo || !tieneEntrega) {

          setForm((prev) => ({ 
            ...prev, 
            distancia_km: '',
            precio_bs: '' 
          }))
          setPrecioEditadoManualmente(false) // Resetear flag
        }
      }
      else if (name === 'medio_transporte' && !tieneMedioTransporte) {

        setForm((prev) => ({ 
          ...prev, 
          precio_bs: '' 
        }))
        setPrecioEditadoManualmente(false) // Resetear flag
      }
    }
  }

  // Función filterOrderForSheet ahora se importa desde ordersService.js

  const saveToSheet = async (order, silent = false) => {
    try {
    if (!SHEET_URL) {
      if (!silent) {
      showNotification('❌ URL del servidor no configurada', 'error')
      }
      return
    }
    
      const result = await saveOrderToSheet(order, silent, SHEET_URL, SHEET_TOKEN)
      
      if (!silent) {
      showNotification('✅ Pedido guardado en Google Sheet', 'success')
      }
    } catch (error) {
      if (!silent) {
        showNotification('❌ Error al guardar', 'error')
      }
      throw error
    }
  }

  const updateOrderInSheet = async (order) => {
    try {
      const result = await updateOrderInSheetAPI(order)
      showNotification('✅ Pedido actualizado en Google Sheet', 'success')
    } catch (error) {
      showNotification('❌ Error al actualizar en Google Sheet', 'error')
      throw error
    }
  }

  // getNextId ahora se importa desde ordersService.js

  // Duplicar pedido con múltiples fechas
  const duplicateOrder = async (originalOrder, selectedDates) => {
    try {
      setDuplicateModal(prev => ({ ...prev, isDuplicating: true }))

      const duplicatedOrders = []
      let baseId = await getNextId()
      let lastSavedDate = null
      
      for (let i = 0; i < selectedDates.length; i++) {
        const fechaOriginal = selectedDates[i]
        const newId = String(baseId + i)
        
        // Normalizar la fecha al formato estándar DD/MM/YYYY
        const fecha = formatToStandardDate(fechaOriginal)
        console.log(`📅 [Duplicar Pedido] Fecha normalizada: "${fechaOriginal}" -> "${fecha}"`)
        
        // Calcular día de la semana para la nueva fecha (usar fecha original ISO para cálculo)
        const diaSemana = calculateDayOfWeek(fechaOriginal)
        
        // Obtener fecha y hora de registro actual
        const { fechaRegistro, horaRegistro } = getBoliviaDateTime()
        
        // Crear el pedido duplicado
        const duplicatedOrder = {
          ...originalOrder,
          id: newId,
          fecha: fecha, // IMPORTANTE: Usar fecha normalizada (DD/MM/YYYY)
          dia_semana: diaSemana,
          fecha_registro: fechaRegistro,
          hora_registro: horaRegistro,
          estado: 'Pendiente', // Los duplicados empiezan como pendientes
          operador: operadorDefault, // Cambiar el operador al usuario que está duplicando
          // Mantener todos los demás campos del original
        }

        // Guardar en Google Sheets con notificación específica (modo silencioso para evitar duplicados)
        try {
          await saveToSheet(duplicatedOrder, true) // Modo silencioso para manejar notificaciones manualmente
        duplicatedOrders.push(duplicatedOrder)
          lastSavedDate = fecha // Guardar la última fecha guardada exitosamente
          
          // Notificación específica cuando se sube al drive
          showNotification(`✅ Pedido #${newId} guardado en Google Sheets para ${fecha}`, 'success')
        } catch (saveError) {
          console.error(`Error guardando pedido #${newId}:`, saveError)
          showNotification(`⚠️ Error guardando pedido #${newId} para ${fecha}: ${saveError.message}`, 'error')
          // Continuar con el siguiente pedido aunque este haya fallado
        }
      }
      
      if (duplicatedOrders.length > 0) {
      // Actualizar lista de pedidos local
      setOrders(prevOrders => [...prevOrders, ...duplicatedOrders])
      
        // Cambiar el filtro de fecha a la última fecha duplicada para ver los pedidos en el kanban
        if (lastSavedDate) {
          // Convertir fecha a formato ISO usando dateService
          const fechaISO = convertToISO(lastSavedDate) || lastSavedDate
          
          setDateFilter(fechaISO)
          setViewType('day') // Asegurar que esté en vista de día
        }
      
      // Recargar pedidos para asegurar sincronización
        await loadOrdersFromSheet(true)
        
        // Mostrar modal de éxito
        setDuplicateSuccessModal({ 
          show: true, 
          count: duplicatedOrders.length, 
          lastDate: lastSavedDate 
        })
      } else {
        showNotification('⚠️ No se pudo guardar ningún pedido en Google Sheets', 'warning')
      }
      
      // Cerrar modal de duplicación
      setDuplicateModal({ show: false, order: null, selectedDates: [], isDuplicating: false })

    } catch (error) {
      console.error('Error duplicando pedidos:', error)
      showNotification(`❌ Error al duplicar pedidos: ${error.message}`, 'error')
      setDuplicateModal(prev => ({ ...prev, isDuplicating: false }))
    }
  }

  // validateForm ahora se importa desde formValidator.js
  // Wrapper para pasar opciones del componente
  const validateFormWrapper = () => {
    return validateForm(form, {
      recojoClienteAvisa,
      entregaClienteAvisa
    })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    
    // MODO EDICIÓN: Si estamos editando, usar la función de edición
    if (editingOrder) {

      // Validar formulario
      const validationErrors = validateFormWrapper()
      if (validationErrors.length > 0) {
        const errorMessage = `Por favor, corrija los siguientes errores:\n\n${validationErrors.map(error => `• ${error}`).join('\n')}`
        showNotification(errorMessage, 'error')
        const firstErrorField = document.querySelector('.field-required')
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
          firstErrorField.focus()
        }
        return
      }
      
      // Activar estado de carga
      setIsAddingOrder(true)
      showNotification('🔄 Guardando cambios...', 'info')
      
      try {
        // Normalizar la fecha al formato estándar DD/MM/YYYY antes de editar
        const fechaNormalizada = formatToStandardDate(form.fecha)
        console.log(`📅 [Editar Pedido] Fecha normalizada: "${form.fecha}" -> "${fechaNormalizada}"`)
        
        // Mantener TODOS los campos del pedido original y sobrescribir solo los editados
        // Primero copiar editingOrder, pero eliminar campos con nombres de columnas del sheet para evitar conflictos
        const { 'Info. Adicional Recojo': _, 'Info. Adicional Entrega': __, 'Tiempo de espera': ___, ...editingOrderClean } = editingOrder
        const updatedOrder = {
          ...editingOrderClean, // Copiar campos originales sin nombres de columnas del sheet
          ...form,         // Sobrescribir con los campos editados del formulario
          operador: operadorDefault, // IMPORTANTE: Siempre actualizar al operador actual
          fecha: fechaNormalizada, // IMPORTANTE: Usar fecha normalizada (DD/MM/YYYY)
          id: editingOrder.id, // Asegurar que el ID no cambie
          fecha_registro: editingOrder.fecha_registro, // Mantener fecha de registro original
          hora_registro: editingOrder.hora_registro,    // Mantener hora de registro original
          tiempo_espera: form.tiempo_espera || editingOrder.tiempo_espera || editingOrder['Tiempo de espera'] || editingOrder['Tiempo de Espera'] || '', // Asegurar que tiempo_espera esté presente
          // Siempre usar el valor del formulario para info adicional (incluso si está vacío, para permitir borrarlo)
          // Si el formulario tiene el campo (incluso si es string vacío), usarlo; sino usar el de editingOrder
          info_direccion_recojo: form.info_direccion_recojo !== undefined && form.info_direccion_recojo !== null
            ? String(form.info_direccion_recojo).trim()
            : (editingOrder.info_direccion_recojo !== undefined && editingOrder.info_direccion_recojo !== null
              ? String(editingOrder.info_direccion_recojo).trim()
              : (editingOrder['Info. Adicional Recojo'] !== undefined && editingOrder['Info. Adicional Recojo'] !== null
                ? String(editingOrder['Info. Adicional Recojo']).trim()
                : '')),
          info_direccion_entrega: form.info_direccion_entrega !== undefined && form.info_direccion_entrega !== null
            ? String(form.info_direccion_entrega).trim()
            : (editingOrder.info_direccion_entrega !== undefined && editingOrder.info_direccion_entrega !== null
              ? String(editingOrder.info_direccion_entrega).trim()
              : (editingOrder['Info. Adicional Entrega'] !== undefined && editingOrder['Info. Adicional Entrega'] !== null
                ? String(editingOrder['Info. Adicional Entrega']).trim()
                : ''))
        }

        // Actualizar en el sheet
        await handleOrderEdit(updatedOrder)
        
        // Limpiar modo edición
        setEditingOrder(null)
        setForm({ ...initialOrder, operador: operadorDefault })
        setPrecioEditadoManualmente(false)
        setRecojoManual(false)
        setEntregaManual(false)
        setRecojoClienteAvisa(false)
        setEntregaClienteAvisa(false)
        
        showNotification(`✅ Pedido #${updatedOrder.id} actualizado exitosamente`, 'success')
        
        // Recargar pedidos desde el sheet para sincronizar
        await loadOrdersFromSheet(true)
        
        // Cambiar a ver pedidos
        setActiveTab('ver')
        
      } catch (err) {

        showNotification('❌ Error al actualizar el pedido', 'error')
      } finally {
        setIsAddingOrder(false)
      }
      
      return
    }
    
    // MODO AGREGAR: Código original para crear nuevo pedido
    
    // Log: Intento de envío del formulario
    await logToCSV('form_submit_attempt', { formData: form }, 'info')
    
    // Validar formulario
      const validationErrors = validateFormWrapper()
    if (validationErrors.length > 0) {
      // Log: Error de validación
      await logToCSV('form_validation_error', { 
        formData: form, 
        errors: validationErrors 
      }, 'error', `Validation failed: ${validationErrors.join(', ')}`)
      
      // Mostrar errores de validación
      const errorMessage = `Por favor, corrija los siguientes errores:\n\n${validationErrors.map(error => `• ${error}`).join('\n')}`
      showNotification(errorMessage, 'error')
      
      // Hacer scroll al primer campo con error
      const firstErrorField = document.querySelector('.field-required')
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
        firstErrorField.focus()
      }
      return
    }
    
    // Activar estado de carga
    setIsAddingOrder(true)
    
    // Mostrar notificación inmediatamente
    showNotification('🔄 Agregando pedido...', 'info')
    
    // Usar función aislada para fechas y horas bolivianas
    const { fechaRegistro, horaRegistro } = getBoliviaDateTime()
    
    // Generar ID consecutivo de forma segura
    let nextId
    try {
      nextId = await getNextId()

    } catch (error) {

      // Si falla, usar timestamp como ID único
      nextId = Date.now()

    }
    
    // Normalizar la fecha al formato estándar DD/MM/YYYY antes de crear el pedido
    const fechaNormalizada = formatToStandardDate(form.fecha)
    console.log(`📅 [Crear Pedido] Fecha normalizada: "${form.fecha}" -> "${fechaNormalizada}"`)
    
    const newOrder = { 
      id: nextId.toString(), 
      ...form,
      fecha: fechaNormalizada, // IMPORTANTE: Usar fecha normalizada (DD/MM/YYYY)
      operador: operadorDefault, // Asegurar que el operador se asigne correctamente
      fecha_registro: fechaRegistro,
      hora_registro: horaRegistro,
      // Valores por defecto para estado y estado de pago
      estado: form.estado || 'Pendiente',
      estado_pago: form.estado_pago || 'Debe Cliente'
    }
    
    // Log de debug para verificar que ambos campos se envíen correctamente

    // NO agregar localmente aquí - esperar a que se guarde en el sheet
    setForm({ ...initialOrder, operador: operadorDefault })
    setPrecioEditadoManualmente(false)
    // Resetear modos manuales
    setRecojoManual(false)
    setEntregaManual(false)
    
    try {
      await saveToSheet(newOrder)
      
      // Si el pedido viene de un pedido cliente, actualizar su estado a "CREADO" y guardar el ID del pedido oficial
      if (newOrder.desdePedidoCliente && newOrder.idPedidoCliente) {
        try {

          const response = await fetch(`${getBackendUrl()}/api/cliente/actualizar-estado-pedido`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              idPedidoCliente: newOrder.idPedidoCliente,
              idPedidoOficial: newOrder.id
            })
          })
          
          if (response.ok) {
            const result = await response.json()

            toast.success(`✅ Pedido cliente #${newOrder.idPedidoCliente} marcado como CREADO → Pedido oficial #${newOrder.id}`, {
              autoClose: 4000
            })
          } else {
            const error = await response.json()

            toast.warning('⚠️ Pedido creado pero no se pudo actualizar el estado del pedido cliente', {
              autoClose: 4000
            })
          }
        } catch (updateError) {

          toast.warning('⚠️ Pedido creado pero no se pudo actualizar el estado del pedido cliente', {
            autoClose: 4000
          })
        }
      }
      
      // Log: Pedido agregado exitosamente
      await logToCSV('order_added_success', { 
        orderData: newOrder,
        orderId: newOrder.id 
      }, 'success')
      
      // Mostrar modal de éxito con la información del pedido
      setLastAddedOrder(newOrder)
      setShowSuccessModal(true)
      
      // Recargar pedidos desde el sheet para sincronizar
      await loadOrdersFromSheet(true)
      
      // NO cambiar de pestaña automáticamente - dejar que el usuario decida
      
    } catch (err) {

      // Log: Error al guardar en Google Sheet
      await logToCSV('order_save_error', { 
        orderData: newOrder,
        orderId: newOrder.id,
        error: err.message 
      }, 'error', err)
      
      showNotification('⚠️ Pedido guardado localmente (error en Google Sheet)', 'warning')
    } finally {
      // Desactivar estado de carga
      setIsAddingOrder(false)
    }
  }

  // Función para construir el mensaje de WhatsApp
  // buildWhatsAppMessage y generateWhatsAppURL ahora se importan desde whatsAppUtils.js

  // normalize, headerMap, convertExcelDate, y mapRowToOrder ahora se importan desde ordersService.js
  // formatDateForDisplay ahora se importa desde dateService.js (centralizado)

  // ===== FUNCIONES PARA NOTIFICACIONES DE CARRERAS AGENDADAS =====
  /**
   * Convierte una hora en formato HH:MM a minutos desde medianoche
   * @param {string} timeString - Hora en formato "HH:MM"
   * @returns {number} Minutos desde medianoche
   */
  const timeToMinutes = (timeString) => {
    if (!timeString) return null
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Obtiene la hora actual en Bolivia en minutos desde medianoche
   * @returns {number} Minutos desde medianoche
   */
  const getCurrentBoliviaMinutes = () => {
    const boliviaTime = getBoliviaTime()
    return boliviaTime.getHours() * 60 + boliviaTime.getMinutes()
  }

  /**
   * Verifica si una carrera necesita notificación (5 minutos antes)
   * @param {Object} order - Pedido con hora_ini
   * @returns {boolean} True si necesita notificación
   */
  const needsNotification = (order) => {
    if (!order.hora_ini || order.estado !== 'Pendiente') return false
    
    // Verificar que el pedido sea del día actual
    if (!order.fecha) return false
    
    const todayISO = getBoliviaDateISO() // Formato YYYY-MM-DD
    
    try {
      // Convertir fecha del pedido a formato ISO usando dateService
      const orderDateISO = convertToISO(order.fecha)
      if (!orderDateISO) return false
      
      // Solo notificar si el pedido es del día actual
      if (orderDateISO !== todayISO) {
        return false
      }
    } catch (error) {
      console.error('Error verificando fecha del pedido:', error)
      return false
    }
    
    const scheduledMinutes = timeToMinutes(order.hora_ini)
    const currentMinutes = getCurrentBoliviaMinutes()
    
    if (scheduledMinutes === null) return false
    
    // Verificar si faltan exactamente 5 minutos
    const timeDiff = scheduledMinutes - currentMinutes
    return timeDiff === 5
  }

  /**
   * Muestra notificación para una carrera próxima
   * @param {Object} order - Pedido que necesita notificación
   */
  const showOrderNotification = (order) => {
    const notificationId = `order-${order.id}-${order.hora_ini}`
    
    // Reproducir audio de notificación
    if (notificationAudioRef.current) {
      notificationAudioRef.current.currentTime = 0 // Reiniciar el audio
      notificationAudioRef.current.play().catch(error => {

      })

    }
    
    toast.info(
      `🚀 Faltan 5 minutos para el pedido #${order.id}`,
      {
        toastId: notificationId,
        position: "top-right",
        autoClose: false, // No se cierra automáticamente
        hideProgressBar: true,
        closeOnClick: false, // No se cierra al hacer clic
        pauseOnHover: true,
        draggable: true,
        className: "toast-info",
      }
    )
  }

  /**
   * Función de prueba para notificaciones (disponible en consola del navegador)
   */
  const testNotification = () => {
    const testOrder = {
      id: '999',
      fecha: '22/10/2025',
      hora_ini: '08:34',
      estado: 'Pendiente'
    }
    showOrderNotification(testOrder)
  }

  // Hacer la función disponible globalmente para pruebas
  if (typeof window !== 'undefined') {
    window.testNotification = testNotification
  }

  // mapRowToOrder ahora se importa desde ordersService.js

  const csvEscape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  const loadOrdersFromSheet = async (forceReload = false) => {
    if (loading) {
      return // Evitar múltiples llamadas simultáneas
    }
    
    // Si ya hay datos cargados y no es una recarga forzada, no hacer nada
    if (!forceReload && dataLoaded && orders.length > 0) {
      return
    }
    
    try {
      setLoading(true)
      
      const data = await loadOrdersAPI()

      if (data && data.length > 0) {
        // Mapear los datos usando la función del servicio
        const imported = data.map((row, index) => mapRowToOrder(row, index, initialOrder, operadorDefault))

      // Limpiar duplicados por ID (mantener solo el último)
      const uniqueOrders = imported.reduce((acc, current) => {
        const existingIndex = acc.findIndex(item => item.id === current.id)
        if (existingIndex >= 0) {
          acc[existingIndex] = current // Reemplazar con la versión más reciente
        } else {
          acc.push(current)
        }
        return acc
      }, [])
      
      // Reemplazar completamente los pedidos
      setOrders(uniqueOrders)
      setDataLoaded(true)
        showNotification(`✅ ${uniqueOrders.length} pedidos cargados desde Google Sheets API`, 'success')
      } else {
        showNotification('📋 No hay pedidos en el sheet', 'info')
        setOrders([])
        setDataLoaded(true)
      }
    } catch (err) {
      showNotification('❌ Error al cargar pedidos desde Google Sheet', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {

    let filtered = orders
    
    // Filtrar por fecha según el tipo de vista
    if (viewType === 'day' && dateFilter) {
      // Vista por día específico
      filtered = filtered.filter((o) => {
        if (o.fecha) {
          try {
            // Convertir fecha a ISO para comparar usando dateService
            const orderDate = convertToISO(o.fecha)
            if (!orderDate) return false
            
          return orderDate === dateFilter
          } catch (error) {

            return false
          }
        }
        return false
      })
    } else if (viewType === 'range' && dateRange.start && dateRange.end) {
      // Vista por rango de fechas
      filtered = filtered.filter((o) => {
        if (o.fecha) {
          try {
            // Convertir fecha a ISO para comparar usando dateService
            const orderDate = convertToISO(o.fecha)
            if (!orderDate) return false
            
            return orderDate >= dateRange.start && orderDate <= dateRange.end
          } catch (error) {

            return false
          }
        }
        return false
      })
    }
    
    // Luego filtrar por texto de búsqueda
    if (filter) {
      const q = filter.toLowerCase()
      filtered = filtered.filter((o) =>
        Object.values(o).some((v) => String(v || '').toLowerCase().includes(q))
      )
    }
    
    // Ordenar: primero por hora de inicio, luego por ID
    filtered.sort((a, b) => {
          // Si ambos tienen hora de inicio, ordenar por hora
          if (a.hora_ini && b.hora_ini) {
            const timeA = a.hora_ini.split(':').map(Number)
            const timeB = b.hora_ini.split(':').map(Number)
            const minutesA = timeA[0] * 60 + timeA[1]
            const minutesB = timeB[0] * 60 + timeB[1]
            return minutesA - minutesB // Más temprano primero
          }
          // Si solo A tiene hora, va primero
          if (a.hora_ini && !b.hora_ini) return -1
          // Si solo B tiene hora, va primero
          if (!a.hora_ini && b.hora_ini) return 1
          // Si ninguno tiene hora, ordenar por ID (menor a mayor)
          const idA = parseInt(a.id || a.ID || 0)
          const idB = parseInt(b.id || b.ID || 0)
          return idA - idB
    })
    
    return filtered
  }, [orders, filter, dateFilter, viewType, dateRange])

  // Función para manejar "Ver pedidos" desde el modal
  const handleViewOrders = () => {

    // Configurar filtro de fecha para el pedido agregado
    if (lastAddedOrder && lastAddedOrder.fecha) {
      const orderDate = new Date(lastAddedOrder.fecha).toISOString().split('T')[0]

      setDateFilter(orderDate)
    }
    
    // Cerrar modal y cambiar al Kanban
    setShowSuccessModal(false)
    setActiveTab('ver')
  }

  // Función para quedarse en "Agregar pedido"
  const handleStayInForm = () => {

    setShowSuccessModal(false)
    // Limpiar el formulario para un nuevo pedido
    setForm(initialOrder)
    // Resetear el mensaje de WhatsApp
    resetWhatsappMessage()
    // Resetear estados
    setPrecioEditadoManualmente(false)
    setRecojoManual(false)
    setEntregaManual(false)
    setRecojoClienteAvisa(false)
    setEntregaClienteAvisa(false)
  }

  // Componente del modal de advertencia para ASIGNAR BIKER
  const AssignBikerWarningModal = () => {
    if (!showAssignBikerModal) return null

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div className="assign-biker-modal" style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            ⚠️
          </div>
          
          <h2 style={{ 
            color: '#dc3545', 
            margin: '0 0 20px 0',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            Asignar Biker para Enviar Mensaje
          </h2>
          
          <p style={{
            fontSize: '16px',
            color: '#6c757d',
            lineHeight: '1.6',
            marginBottom: '30px'
          }}>
            Para enviar un mensaje por WhatsApp, debes seleccionar un biker específico con número de teléfono asociado.
            <br/><br/>
            <strong>"ASIGNAR BIKER"</strong> es solo un marcador temporal y no tiene WhatsApp disponible.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            <button 
              onClick={() => setShowAssignBikerModal(false)}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Componente del modal de éxito
  const SuccessModal = () => {
    if (!showSuccessModal || !lastAddedOrder) return null

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div className="success-modal" style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#28a745', margin: '0 0 20px 0' }}>
            ✅ ¡Pedido Agregado Exitosamente!
          </h2>
          
          <div className="success-modal-info" style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '25px',
            textAlign: 'left'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>
              📋 Información del Pedido:
            </h3>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>🆔 ID:</strong> {lastAddedOrder.id || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>👤 Operador:</strong> {lastAddedOrder.operador || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>👥 Cliente:</strong> {lastAddedOrder.cliente || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>📍 Recojo:</strong> {lastAddedOrder.recojo || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>📍 Entrega:</strong> {lastAddedOrder.entrega || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>💰 Precio:</strong> {lastAddedOrder.precio_bs || 0} Bs
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>🚴‍♂️ Biker:</strong> {lastAddedOrder.biker || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>📅 Fecha:</strong> {lastAddedOrder.fecha || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>⏰ Hora Inicio:</strong> {lastAddedOrder.hora_ini || 'N/A'}
            </p>
            <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
              <strong>🚲 Medio:</strong> {lastAddedOrder.medio_transporte || 'N/A'}
            </p>
            {(lastAddedOrder.cobro_pago && lastAddedOrder.cobro_pago.trim() !== '') && (
              <>
                <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
                  <strong>💰 {lastAddedOrder.cobro_pago}:</strong> {lastAddedOrder.monto_cobro_pago || '0.00'} Bs
                </p>
                {lastAddedOrder.descripcion_cobro_pago && (
                  <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.6' }}>
                    <strong>📝 Descripción:</strong> {lastAddedOrder.descripcion_cobro_pago}
                  </p>
                )}
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button
              onClick={handleStayInForm}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ✅ OK - Agregar Otro
            </button>
            <button
              onClick={handleViewOrders}
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              📋 Ver Pedidos
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pedidos-clientes':
        return (
          <section className="card">
            <PedidosClientes />
          </section>
        )
      case 'agregar':
        return (
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{editingOrder ? `✏️ Editar Pedido #${editingOrder.id}` : 'Nuevo Pedido'}</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { key: 'drivers', label: 'Drivers', icon: 'calendar' },
                  { key: 'bikers', label: 'Bikers', icon: 'bike' }
                ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAvailabilityClick(key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 24px',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#f49f10',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: '15px',
                      cursor: 'pointer',
                      boxShadow: '0 10px 28px rgba(244, 159, 16, 0.35)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 14px 32px rgba(244, 159, 16, 0.45)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 10px 28px rgba(244, 159, 16, 0.35)'
                    }}
                  >
                    <Icon name={icon} size={18} />
                    Disponibilidad {label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Banner de Modo Edición */}
            {editingOrder && (
              <div style={{
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#1a1a1a' }}>
                      MODO EDICIÓN ACTIVO
                    </div>
                    <div style={{ fontSize: '14px', color: '#78350f', marginTop: '4px' }}>
                      Editando pedido #{editingOrder.id} • Los cambios se guardarán al enviar el formulario
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: '#1a1a1a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#374151'}
                  onMouseOut={(e) => e.target.style.background = '#1a1a1a'}
                >
                  ❌ Cancelar Edición
                </button>
              </div>
            )}
            
            <form className="form-organized" onSubmit={handleAdd}>
              
              {/* SECCIÓN 0: INFORMACIÓN DE REGISTRO (Solo en modo edición) */}
              {editingOrder && (
                <div className="form-section" style={{
                  backgroundColor: '#f8f9fa',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <h3 className="section-title" style={{ marginBottom: '16px' }}>
                    <Icon name="info" size={18} />
                    Información de Registro
                  </h3>
                  <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
                    <div className="form-group">
                      <label style={{marginBottom: '4px', display: 'block', fontWeight: '600', color: '#6c757d'}}>ID</label>
                      <input
                        type="text"
                        value={editingOrder.id || ''}
                        readOnly
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          cursor: 'not-allowed'
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{marginBottom: '4px', display: 'block', fontWeight: '600', color: '#6c757d'}}>Fecha Registro</label>
                      <input
                        type="text"
                        value={editingOrder.fecha_registro || editingOrder['Fecha Registro'] || ''}
                        readOnly
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          cursor: 'not-allowed'
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{marginBottom: '4px', display: 'block', fontWeight: '600', color: '#6c757d'}}>Hora Registro</label>
                      <input
                        type="text"
                        value={editingOrder.hora_registro || editingOrder['Hora Registro'] || ''}
                        readOnly
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          cursor: 'not-allowed'
                        }}
                      />
                  </div>
                  <div className="form-group">
                    <label style={{marginBottom: '4px', display: 'block', fontWeight: '600'}}>Operador</label>
                    <input
                      type="text"
                      name="operador"
                      value={editingOrder ? operadorDefault : (form.operador || '')}
                      onChange={editingOrder ? null : handleChange}
                      placeholder="Operador"
                      readOnly={!!editingOrder}
                      disabled={!!editingOrder}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        backgroundColor: editingOrder ? '#e9ecef' : 'white',
                        color: editingOrder ? '#495057' : 'inherit',
                        cursor: editingOrder ? 'not-allowed' : 'text'
                      }}
                      title={editingOrder ? `Se actualizará automáticamente a: ${operadorDefault}` : ''}
                    />
                    {editingOrder && (
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        ℹ️ El operador se actualizará automáticamente al usuario actual ({operadorDefault})
                      </small>
                    )}
                  </div>
                </div>
                </div>
              )}
              
              {/* SECCIÓN 1: INFORMACIÓN DEL PEDIDO */}
              <div className="form-section">
                <h3 className="section-title">
                  <Icon name="package" size={18} />
                  Información del Pedido
                  {(recojoManual || entregaManual) && (
                    <span style={{fontSize: '14px', color: '#28a745', marginLeft: '8px'}}>
                      <Icon name="edit" size={14} style={{ marginRight: '4px' }} />
                      Modo manual activo
                    </span>
                  )}
                </h3>
                <div className="form-row" style={{display: 'flex', gap: '12px', marginBottom: '12px'}}>
                  <div className="form-group" style={{flex: 1}}>
                    <label style={{marginBottom: '4px', display: 'block'}}>Cliente <span className="required">*</span></label>
                    <div style={{display: 'flex', gap: '8px'}}>
                      {form.clienteCustom ? (
                        <input
                          type="text"
                          name="cliente" 
                          value={form.cliente} 
                          onChange={handleChange} 
                          placeholder="Escribir nombre del cliente"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          className={!form.cliente ? 'field-required' : ''}
                          required
                        />
                      ) : (
                      <SearchableSelect
                        name="cliente"
                        options={clientes}
                        value={form.cliente}
                        onChange={handleChange}
                        placeholder="Seleccionar cliente"
                        searchPlaceholder="Buscar cliente..."
                        customOption="✏️ Escribir nombre personalizado"
                        onCustomOptionClick={() => handleChange({ target: { name: 'cliente', value: '__CUSTOM__' } })}
                        style={{flex: 1}}
                        required
                      />
                      )}
                      <button 
                        type="button" 
                        className="btn-icon" 
                        onClick={() => {
                          if (form.clienteCustom) {
                            setForm(prev => ({ ...prev, clienteCustom: false, cliente: '' }))
                          } else {
                            loadClientes()
                          }
                        }}
                        title={form.clienteCustom ? "Volver a lista" : "Recargar clientes"}
                      >
                        {form.clienteCustom ? '📋' : '🔄'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{flex: 1, marginTop: '0px'}}>
                    <label style={{marginBottom: '4px', display: 'block'}}>Detalles de la Carrera</label>
                    <input 
                      name="detalles_carrera" 
                      value={form.detalles_carrera} 
                      onChange={handleChange} 
                      placeholder="Descripción adicional del pedido"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                </div>
              </div>
                
                {/* Sección Punto de Recojo */}
                <div className="form-row" style={{display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px'}}>
                  <div className={`form-group ${recojoManual ? 'manual-mode' : ''}`} style={{flex: 1}}>
                    <label style={{display: 'block', marginBottom: '4px'}}>Punto de Recojo {!recojoClienteAvisa && <span className="required">*</span>}</label>
                    <div style={{display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px'}}>
                      <button 
                        type="button" 
                        className={`btn-mode ${!recojoManual && !recojoClienteAvisa ? 'active' : ''}`}
                        onClick={() => {
                          handleRecojoModeChange(false)
                          setRecojoClienteAvisa(false)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: !recojoManual && !recojoClienteAvisa ? 'var(--sky)' : 'var(--input-bg)',
                          color: !recojoManual && !recojoClienteAvisa ? 'white' : 'var(--muted)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        📋 Empresas
                      </button>
                      <button 
                        type="button" 
                        className={`btn-mode ${recojoManual ? 'active' : ''}`}
                        onClick={() => {
                          handleRecojoModeChange(true)
                          setRecojoClienteAvisa(false)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: recojoManual ? '#28a745' : '#f8f9fa',
                          color: recojoManual ? 'white' : '#6c757d',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Manual
                      </button>
                      <button 
                        type="button" 
                        className={`btn-mode ${recojoClienteAvisa ? 'active' : ''}`}
                        onClick={() => {
                          handleRecojoClienteAvisaChange(true)
                          setRecojoManual(false)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: recojoClienteAvisa ? '#ffc107' : '#f8f9fa',
                          color: recojoClienteAvisa ? 'white' : '#6c757d',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        📞 Cliente avisa
                      </button>
                      <button
                        type="button"
                        onClick={swapRecojoEntrega}
                        title="Intercambiar Recojo y Entrega"
                        disabled={!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: (!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)) ? '#cccccc' : '#6c757d',
                          color: 'white',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: (!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)) ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          opacity: (!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)) ? 0.5 : 1
                        }}
                      >
                        ⇅
                      </button>
                    </div>
                    
                    {recojoClienteAvisa ? (
                      // Modo "Cliente avisa" - mostrar mensaje
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        borderRadius: '4px',
                        color: '#856404',
                        textAlign: 'center',
                        fontWeight: 'bold'
                      }}>
                        📞 Cliente avisa - No se calculará distancia ni precio
                      </div>
                    ) : !recojoManual ? (
                      // Modo dropdown - selección de empresas
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <SearchableSelect
                          name="recojo"
                          options={empresas.map(empresa => empresa.empresa)}
                          value={form.recojo}
                          onChange={handleChange}
                          placeholder="Seleccionar empresa"
                          searchPlaceholder="Buscar empresa..."
                          style={{flex: 1}}
                          className={!form.recojo && !recojoClienteAvisa ? 'field-required' : ''}
                          required={!recojoClienteAvisa}
                        />
                        {form.recojo && getEmpresaMapa(form.recojo, empresas) && (
                          <a href={getEmpresaMapa(form.recojo, empresas)} target="_blank" rel="noopener noreferrer" className="btn-maps" title={`Ver en Maps: ${form.recojo}`}>
                            📍 Maps
                          </a>
                        )}
                        {form.recojo && form.direccion_recojo && (
                          <span style={{fontSize: '12px', color: '#28a745', marginLeft: '4px'}} title="Dirección completa configurada">
                            ✅
                          </span>
                        )}
                      </div>
                    ) : (
                      // Modo manual - solo enlace de Google Maps
                      <>
                      <div style={{position: 'relative', marginBottom: 0}}>
                            <input 
                              type="url" 
                          name="direccion_recojo"
                              value={form.direccion_recojo} 
                          onChange={handleChange}
                              placeholder="Pega aquí el enlace de Google Maps..."
                              className={
                                (!form.direccion_recojo && !recojoClienteAvisa ? 'field-required' : '') +
                                (form.direccion_recojo && !validateGoogleMapsLink(form.direccion_recojo) ? ' invalid-maps-link' : '')
                              }
                              required={!recojoClienteAvisa}
                          style={{
                            width: '100%', 
                            paddingRight: validacionRecojo.estado ? '100px' : '80px',
                            border: validacionRecojo.estado === 'invalido' ? '2px solid #dc3545' : 
                                    validacionRecojo.estado === 'valido' ? '2px solid #28a745' : 
                                    form.direccion_recojo && !validateGoogleMapsLink(form.direccion_recojo) ? '2px solid #dc3545' : undefined
                          }}
                            />
                        {form.direccion_recojo ? (
                          <>
                            <a href={form.direccion_recojo} target="_blank" rel="noopener noreferrer" className="btn-maps" title="Ver en Maps" style={{position: 'absolute', right: validacionRecojo.estado ? '50px' : '8px', top: '50%', transform: 'translateY(-50%)'}}>
                              📍 Maps
                            </a>
                            {validacionRecojo.estado && (
                              <span 
                                style={{
                                  position: 'absolute', 
                                  right: '12px', 
                                  top: '50%', 
                                  transform: 'translateY(-50%)',
                                  fontSize: '22px',
                                  lineHeight: '1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  zIndex: 10
                                }}
                                title={validacionRecojo.mensaje}
                              >
                                {validacionRecojo.estado === 'validando' && '⏳'}
                                {validacionRecojo.estado === 'valido' && '✅'}
                                {validacionRecojo.estado === 'invalido' && '❌'}
                              </span>
                            )}
                          </>
                        ) : (
                              <button 
                                type="button" 
                                className="btn-maps" 
                            onClick={() => window.open('https://www.google.com/maps', '_blank')}
                            title="Abrir Google Maps"
                            style={{position: 'absolute', right: '8px', top: '8px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}
                          >
                            📍
                              </button>
                            )}
                      </div>
                      {validacionRecojo.estado === 'invalido' && (
                        <div style={{color: '#dc3545', fontSize: '12px', marginTop: '4px'}}>
                          ⚠️ {validacionRecojo.mensaje}
                        </div>
                      )}
                      </>
                    )}
                  </div>
                  
                  {/* Campo de información adicional para recojo */}
                  {!recojoClienteAvisa && (
                    <div className="form-group" style={{flex: 1, marginTop: '40px'}}>
                      <label style={{
                        display: 'block', 
                        marginBottom: '4px',
                        marginTop: '0px'
                      }}>ℹ️ Info. Adicional Recojo</label>
                      <input
                        type="text"
                        name="info_direccion_recojo"
                        value={form.info_direccion_recojo}
                        onChange={handleChange}
                        placeholder="Ej: Local 6, Piso 2, preguntar por María..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: '#f8f9fa'
                        }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Sección Punto de Entrega */}
                <div className="form-row" style={{display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px'}}>
                  <div className={`form-group ${entregaManual ? 'manual-mode' : ''}`} style={{flex: 1}}>
                    <label style={{display: 'block', marginBottom: '4px'}}>Punto de Entrega {!entregaClienteAvisa && <span className="required">*</span>}</label>
                    <div style={{display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px'}}>
                      <button 
                        type="button" 
                        className={`btn-mode ${!entregaManual && !entregaClienteAvisa ? 'active' : ''}`}
                        onClick={() => {
                          handleEntregaModeChange(false)
                          setEntregaClienteAvisa(false)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: !entregaManual && !entregaClienteAvisa ? 'var(--sky)' : 'var(--input-bg)',
                          color: !entregaManual && !entregaClienteAvisa ? 'white' : 'var(--muted)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        📋 Empresas
                      </button>
                      <button 
                        type="button" 
                        className={`btn-mode ${entregaManual ? 'active' : ''}`}
                        onClick={() => {
                          handleEntregaModeChange(true)
                          setEntregaClienteAvisa(false)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: entregaManual ? '#28a745' : '#f8f9fa',
                          color: entregaManual ? 'white' : '#6c757d',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Manual
                      </button>
                      <button 
                        type="button" 
                        className={`btn-mode ${entregaClienteAvisa ? 'active' : ''}`}
                        onClick={() => {
                          handleEntregaClienteAvisaChange(true)
                          setEntregaManual(false)
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: entregaClienteAvisa ? '#ffc107' : '#f8f9fa',
                          color: entregaClienteAvisa ? 'white' : '#6c757d',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        📞 Cliente avisa
                      </button>
                      <button
                        type="button"
                        onClick={swapRecojoEntrega}
                        title="Intercambiar Recojo y Entrega"
                        disabled={!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: (!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)) ? '#cccccc' : '#6c757d',
                          color: 'white',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: (!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)) ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          opacity: (!(form.direccion_recojo || form.recojo || form.info_direccion_recojo) || !(form.direccion_entrega || form.entrega || form.info_direccion_entrega)) ? 0.5 : 1
                        }}
                      >
                        ⇅
                      </button>
                    </div>
                    
                    {entregaClienteAvisa ? (
                      // Modo "Cliente avisa" - mostrar mensaje
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        borderRadius: '4px',
                        color: '#856404',
                        textAlign: 'center',
                        fontWeight: 'bold'
                      }}>
                        📞 Cliente avisa - No se calculará distancia ni precio
                      </div>
                    ) : !entregaManual ? (
                      // Modo dropdown - selección de empresas
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <SearchableSelect
                          name="entrega"
                          options={empresas.map(empresa => empresa.empresa)}
                          value={form.entrega}
                          onChange={handleChange}
                          placeholder="Seleccionar empresa"
                          searchPlaceholder="Buscar empresa..."
                          style={{flex: 1}}
                          className={!form.entrega && !entregaClienteAvisa ? 'field-required' : ''}
                          required={!entregaClienteAvisa}
                        />
                        {form.entrega && getEmpresaMapa(form.entrega) && (
                          <a href={getEmpresaMapa(form.entrega)} target="_blank" rel="noopener noreferrer" className="btn-maps" title={`Ver en Maps: ${form.entrega}`}>
                            📍 Maps
                          </a>
                        )}
                        {form.entrega && form.direccion_entrega && (
                          <span style={{fontSize: '12px', color: '#28a745', marginLeft: '4px'}} title="Dirección completa configurada">
                            ✅
                          </span>
                        )}
                      </div>
                    ) : (
                      // Modo manual - solo enlace de Google Maps
                      <>
                      <div style={{position: 'relative', marginBottom: 0}}>
                            <input 
                              type="url" 
                          name="direccion_entrega"
                              value={form.direccion_entrega} 
                          onChange={handleChange}
                              placeholder="Pega aquí el enlace de Google Maps..."
                              className={
                                (!form.direccion_entrega && !entregaClienteAvisa ? 'field-required' : '') +
                                (form.direccion_entrega && !validateGoogleMapsLink(form.direccion_entrega) ? ' invalid-maps-link' : '')
                              }
                              required={!entregaClienteAvisa}
                          style={{
                            width: '100%', 
                            paddingRight: validacionEntrega.estado ? '100px' : '80px',
                            border: validacionEntrega.estado === 'invalido' ? '2px solid #dc3545' : 
                                    validacionEntrega.estado === 'valido' ? '2px solid #28a745' : 
                                    form.direccion_entrega && !validateGoogleMapsLink(form.direccion_entrega) ? '2px solid #dc3545' : undefined
                          }}
                            />
                        {form.direccion_entrega ? (
                          <>
                            <a href={form.direccion_entrega} target="_blank" rel="noopener noreferrer" className="btn-maps" title="Ver en Maps" style={{position: 'absolute', right: validacionEntrega.estado ? '50px' : '8px', top: '50%', transform: 'translateY(-50%)'}}>
                              📍 Maps
                            </a>
                            {validacionEntrega.estado && (
                              <span 
                                style={{
                                  position: 'absolute', 
                                  right: '12px', 
                                  top: '50%', 
                                  transform: 'translateY(-50%)',
                                  fontSize: '22px',
                                  lineHeight: '1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  zIndex: 10
                                }}
                                title={validacionEntrega.mensaje}
                              >
                                {validacionEntrega.estado === 'validando' && '⏳'}
                                {validacionEntrega.estado === 'valido' && '✅'}
                                {validacionEntrega.estado === 'invalido' && '❌'}
                              </span>
                            )}
                          </>
                        ) : (
                              <button 
                                type="button" 
                                className="btn-maps" 
                            onClick={() => window.open('https://www.google.com/maps', '_blank')}
                            title="Abrir Google Maps"
                            style={{position: 'absolute', right: '8px', top: '8px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}
                          >
                            📍
                              </button>
                            )}
                      </div>
                      {validacionEntrega.estado === 'invalido' && (
                        <div style={{color: '#dc3545', fontSize: '12px', marginTop: '4px'}}>
                          ⚠️ {validacionEntrega.mensaje}
                        </div>
                      )}
                      </>
                    )}
                  </div>
                  
                  {/* Campo de información adicional para entrega */}
                  {!entregaClienteAvisa && (
                    <div className="form-group" style={{flex: 1, marginTop: '40px'}}>
                      <label style={{
                        display: 'block', 
                        marginBottom: '4px',
                        marginTop: '0px'
                      }}>ℹ️ Info. Adicional Entrega</label>
                      <input
                        type="text"
                        name="info_direccion_entrega"
                        value={form.info_direccion_entrega}
                        onChange={handleChange}
                        placeholder="Ej: Local 6, Piso 2, preguntar por María..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: '#f8f9fa'
                        }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Transporte y Método de Pago */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label style={{marginBottom: '4px', display: 'block'}}>Medio de Transporte <span className="required">*</span></label>
                    <SearchableSelect
                      name="medio_transporte" 
                      options={MEDIOS_TRANSPORTE}
                      value={form.medio_transporte} 
                      onChange={handleChange}
                      placeholder="Seleccionar Medio de Transporte"
                      searchPlaceholder="Buscar medio de transporte..."
                      className={!form.medio_transporte ? 'field-required' : ''}
                      required
                    />
                  </div>
                  <div className="form-group" style={{marginTop: '0px'}}>
                    <label style={{marginBottom: '4px', display: 'block'}}>Método de Pago <span className="required">*</span></label>
                    <SearchableSelect
                      name="metodo_pago" 
                      options={METODOS_PAGO}
                      value={form.metodo_pago} 
                      onChange={handleChange}
                      placeholder="Seleccionar Método de Pago"
                      searchPlaceholder="Buscar método de pago..."
                      className={!form.metodo_pago ? 'field-required' : ''}
                      required
                    />
                  </div>
                </div>
                
                {/* Distancia y Precio */}
                <div className="form-row" style={{display: 'flex', gap: '12px', marginBottom: '0'}}>
                  <div className="form-group" style={{flex: 1}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                      <label style={{display: 'block', margin: 0}}>Distancia (Km)</label>
                      {form.distancia_km && form.distancia_km.trim() !== '' && (
                        <span style={{fontSize: '12px', color: '#6c757d', fontStyle: 'italic'}}>
                          Valor actual: {form.distancia_km} km
                        </span>
                      )}
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <input 
                        name="distancia_km" 
                        type="number"
                        step="0.01"
                        min="0"
                        value={isCalculatingDistance ? '' : (form.distancia_km || '')} 
                        onChange={handleChange}
                        placeholder={form.direccion_recojo && form.direccion_entrega ? 
                          'Ingresa distancia o haz clic en 🔄' : 
                          'Selecciona puntos de recojo y entrega'}
                        style={{
                          flex: 1,
                          padding: '12px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          minHeight: '44px',
                          backgroundColor: isCalculatingDistance ? '#f0f0f0' : '#fff'
                        }}
                        disabled={isCalculatingDistance}
                      />
                      {form.direccion_recojo && form.direccion_entrega && (
                        <button 
                          type="button" 
                          className="btn-icon" 
                          onClick={() => calculateDistanceAndPrice(form.direccion_recojo, form.direccion_entrega, form.medio_transporte)}
                          title="Calcular distancia automáticamente"
                          disabled={isCalculatingDistance}
                          style={{
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isCalculatingDistance ? 'not-allowed' : 'pointer',
                            opacity: isCalculatingDistance ? 0.6 : 1
                          }}
                        >
                          {isCalculatingDistance ? '⏳' : '🔄'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{flex: 1, marginTop: '-2px'}}>
                    <label style={{marginBottom: '4px', display: 'block'}}>Precio Total (Bs)</label>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <input 
                        name="precio_bs" 
                        value={form.precio_bs || ''} 
                        onChange={handleChange}
                        type="number"
                        step="0.01"
                        className={`precio-destacado ${form.metodo_pago === 'Cuenta' ? 'cuenta-mode' : ''}`}
                        style={{
                          flex: 1,
                          padding: '12px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          minHeight: '44px'
                        }}
                        placeholder="0.00"
                      />
                      {precioEditadoManualmente && form.metodo_pago !== 'Cuenta' && (
                        <button 
                          type="button" 
                          className="btn-icon" 
                          onClick={() => {
                            setPrecioEditadoManualmente(false)
                            if (form.distancia_km && form.medio_transporte) {
                              const precio = calculatePrice(form.distancia_km, form.medio_transporte)
                              setForm((prev) => ({ ...prev, precio_bs: precio }))
                              showNotification(`💰 Precio recalculado: ${precio} Bs`, 'success')
                            }
                          }}
                          title="Recalcular precio automáticamente"
                        >
                          🔄
                        </button>
                      )}
                    </div>
                    {form.metodo_pago === 'Cuenta' && (
                      <small style={{color: '#28a745', fontSize: '0.8em'}}>
                        💳 Precio calculado para el sheet (no se muestra en WhatsApp) - Puedes editarlo manualmente
                      </small>
                    )}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 5: COBROS Y PAGOS */}
              <div className="form-section">
                <h3 className="section-title">
                  <Icon name="creditCard" size={18} />
                  Cobros y Pagos
                </h3>
                <div className="form-row" style={{display: 'flex', gap: '16px'}}>
                  <div className="form-group" style={{flex: 1}}>
                    <label>Tipo de Operación</label>
                    <select 
                      name="cobro_pago" 
                      value={form.cobro_pago} 
                      onChange={handleChange}
                    >
                      {TIPOS_COBRO_PAGO.map(tipo => (
                        <option key={tipo} value={tipo}>
                          {tipo || 'Sin operación'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{flex: 1}}>
                    <label>Monto (Bs) <span className="required">*</span></label>
                    <input 
                      name="monto_cobro_pago" 
                      value={form.monto_cobro_pago} 
                      onChange={handleChange} 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00"
                      className={form.cobro_pago && !form.monto_cobro_pago ? 'field-required' : ''}
                      disabled={!form.cobro_pago}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Descripción de cobro o pago</label>
                    <input 
                      name="descripcion_cobro_pago" 
                      value={form.descripcion_cobro_pago || ''} 
                      onChange={handleChange} 
                      type="text" 
                      placeholder="Descripción del cobro o pago..."
                      disabled={!form.cobro_pago}
                      style={{width: '100%'}}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 6: BIKER Y HORARIOS */}
              <div className="form-section">
                <h3 className="section-title">
                  <Icon name="bike" size={18} />
                  Biker y Horarios
                </h3>
                <div className="form-row" style={{display: 'flex', gap: '16px'}}>
                  <div className="form-group" style={{flex: 1}}>
                    <label>Biker Asignado <span className="required">*</span></label>
                    <div style={{display: 'flex', gap: '8px'}}>
                      {form.bikerCustom ? (
                        <input
                          type="text"
                        name="biker" 
                        value={form.biker} 
                        onChange={handleChange} 
                          placeholder="Escribir nombre del biker"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          className={!form.biker ? 'field-required' : ''}
                          required
                        />
                      ) : (
                      <SearchableSelect
                        name="biker"
                        options={bikersAgregar.map(biker => biker.nombre || biker)}
                        value={form.biker}
                        onChange={handleChange}
                        placeholder={loadingBikersAgregar ? "⏳ Cargando bikers..." : "Seleccionar biker"}
                        searchPlaceholder="Buscar biker..."
                        customOption="✏️ Escribir nombre personalizado"
                        onCustomOptionClick={() => handleChange({ target: { name: 'biker', value: '__CUSTOM__' } })}
                        style={{flex: 1}}
                        className={!form.biker ? 'field-required' : ''}
                        required
                      />
                      )}
                      <button 
                        type="button" 
                        className="btn-icon" 
                        onClick={() => {
                          if (form.bikerCustom) {
                            setForm(prev => ({ ...prev, bikerCustom: false, biker: '' }))
                          } else {
                            loadBikers()
                          }
                        }}
                        disabled={loadingBikersAgregar}
                        title={form.bikerCustom ? "Volver a lista" : "Recargar lista de bikers"}
                      >
                        {loadingBikersAgregar ? <Icon name="clock" size={16} /> : form.bikerCustom ? <Icon name="fileText" size={16} /> : <Icon name="refresh" size={16} />}
                      </button>
                    </div>
                    </div>
                  <div className="form-group" style={{flex: 1}}>
                    <label>WhatsApp</label>
                    <input 
                      name="whatsapp" 
                      value={form.whatsapp} 
                      onChange={handleChange} 
                      placeholder={form.biker === 'ASIGNAR BIKER' ? 'No disponible para ASIGNAR BIKER' : '70123456'}
                      disabled={form.biker === 'ASIGNAR BIKER'}
                      style={{
                        backgroundColor: form.biker === 'ASIGNAR BIKER' ? '#f5f5f5' : 'transparent',
                        cursor: form.biker === 'ASIGNAR BIKER' ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Fecha del Pedido <span className="required">*</span></label>
                    <input 
                      name="fecha" 
                      value={form.fecha} 
                      onChange={handleChange} 
                      type="date" 
                      className={!form.fecha ? 'field-required' : ''}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora Programada</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        name="hora_ini" 
                        value={form.hora_ini} 
                        onChange={handleChange} 
                        type="time" 
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const currentTime = getCurrentBoliviaTime()
                          setForm(prev => ({ ...prev, hora_ini: currentTime }))
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          minHeight: '48px',
                          minWidth: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dee2e6'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#e9ecef'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        title="Establecer hora actual"
                      >
                        🕐
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, hora_ini: '' }))
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          minHeight: '48px',
                          minWidth: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dee2e6'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#e9ecef'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        title="Limpiar hora"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Hora Estimada Fin</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        name="hora_fin" 
                        value={form.hora_fin} 
                        onChange={handleChange} 
                        type="time" 
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const currentTime = getCurrentBoliviaTime()
                          setForm(prev => ({ ...prev, hora_fin: currentTime }))
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          minHeight: '48px',
                          minWidth: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dee2e6'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#e9ecef'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        title="Establecer hora actual"
                      >
                        🕐
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, hora_fin: '' }))
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          minHeight: '48px',
                          minWidth: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dee2e6'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#e9ecef'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        title="Limpiar hora estimada fin"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Tiempo de Espera</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        name="tiempo_espera" 
                        value={form.tiempo_espera || ''} 
                        onChange={handleChange}
                        type="text"
                        placeholder="00:40"
                        style={{ flex: 1 }}
                        title="Duración de espera en formato HH:MM (ej: 00:40 = 40 minutos, 01:30 = 1 hora 30 minutos)"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, tiempo_espera: '' }))
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          minHeight: '48px',
                          minWidth: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dee2e6'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#e9ecef'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        title="Limpiar tiempo de espera"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* SECCIÓN 7: ESTADO Y SEGUIMIENTO */}
              <div className="form-section">
                <h3 className="section-title">
                  <Icon name="barChart3" size={18} />
                  Estado y Seguimiento
                </h3>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Estado del Pedido <span className="required">*</span></label>
                    <SearchableSelect
                      name="estado" 
                      options={ESTADOS}
                      value={form.estado} 
                      onChange={handleChange}
                      placeholder="Seleccionar Estado del Pedido"
                      searchPlaceholder="Buscar estado..."
                      className={!form.estado ? 'field-required' : ''}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Estado de Pago <span className="required">*</span></label>
                    <SearchableSelect
                      name="estado_pago" 
                      options={ESTADOS_PAGO}
                      value={form.estado_pago} 
                      onChange={handleChange}
                      placeholder="Seleccionar Estado del Pago"
                      searchPlaceholder="Buscar estado de pago..."
                      className={!form.estado_pago ? 'field-required' : ''}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-full">
                    <label>Observación Interna <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>🔒 No se comparte con el biker</span></label>
                    <textarea name="observaciones" value={form.observaciones} onChange={handleChange} placeholder="Notas internas, no visibles para el biker..." rows="3" />
                  </div>
                </div>
              </div>

              {/* CAMPOS OCULTOS */}
              <input type="hidden" name="direccion_recojo" value={form.direccion_recojo} />
              <input type="hidden" name="direccion_entrega" value={form.direccion_entrega} />

              {/* PREVIEW DE WHATSAPP */}
              {(form.cliente || form.recojo || form.entrega) && (
                <div className="form-section">
                  <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📱 Vista Previa de WhatsApp</span>
                    {whatsappMessageEdited && (
                      <button
                        type="button"
                        onClick={() => {
                          // Al cambiar whatsappMessageEdited a false, el useEffect regenerará el mensaje automáticamente
                          setWhatsappMessageEdited(false)
                        }}
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          background: '#0ea5e9',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Restaurar mensaje original
                      </button>
                    )}
                  </h3>
                  <div className="whatsapp-preview">
                    <textarea
                      value={whatsappMessage}
                      onChange={(e) => {
                        setWhatsappMessage(e.target.value)
                        setWhatsappMessageEdited(true)
                      }}
                      placeholder="El mensaje se generará automáticamente..."
                      style={{
                        width: '100%',
                        minHeight: '320px',
                        padding: '16px',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        border: '2px solid #25D366',
                        borderRadius: '12px',
                        background: '#E7FFE7',
                        color: '#075E54',
                        resize: 'vertical',
                        marginBottom: '12px',
                        whiteSpace: 'pre-wrap'
                      }}
                    />
                    <button 
                      type="button"
                      className="btn-whatsapp-large"
                      onClick={() => {
                        // Verificar si se seleccionó "ASIGNAR BIKER"
                        if (form.biker === 'ASIGNAR BIKER') {
                          // Mostrar modal de advertencia
                          setShowAssignBikerModal(true)
                          return
                        }
                        
                        // Si no hay biker seleccionado
                        if (!form.biker || form.biker.trim() === '') {
                          toast.error('❌ NO EXISTE BIKER ASIGNADO', {
                            position: "top-center",
                            autoClose: 3000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            className: "toast-error",
                          })
                          return
                        }
                        
                        const tempOrder = { ...form }
                        // Usar el mensaje editado si existe
                        const whatsappURL = generateWhatsAppURL(tempOrder, bikersAgregar, whatsappMessage)
                        window.open(whatsappURL, '_blank')
                        
                        // Mostrar notificación con información del destinatario
                          const selectedBiker = bikersAgregar.find(biker => (biker.nombre || biker) === form.biker)
                          if (selectedBiker && selectedBiker.whatsapp && selectedBiker.whatsapp !== 'N/A') {
                            showNotification(`📱 Enviando WhatsApp a ${form.biker} (${selectedBiker.whatsapp})`, 'success')
                          } else {
                            showNotification(`📱 Enviando WhatsApp a ${form.biker} (usando WhatsApp del formulario)`, 'warning')
                        }
                      }}
                      disabled={!form.biker || form.biker.trim() === ''}
                      title={
                        !form.biker 
                          ? 'No hay biker asignado' 
                          : form.biker === 'ASIGNAR BIKER'
                          ? 'ASIGNAR BIKER no tiene WhatsApp asociado'
                          : `Enviar WhatsApp al biker ${form.biker}`
                      }
                      style={{
                        opacity: (!form.biker || form.biker.trim() === '') ? 0.5 : 1,
                        cursor: (!form.biker || form.biker.trim() === '') ? 'not-allowed' : 'pointer'
                      }}
                    >
                      📱 Enviar por WhatsApp {form.biker && form.biker !== 'ASIGNAR BIKER' && `a ${form.biker}`}
                    </button>
                  </div>
                </div>
              )}

              {/* BOTÓN DE ENVÍO */}
              <div className="form-actions">
                <button 
                  className="btn primary large" 
                  type="submit"
                  disabled={isAddingOrder}
                  style={{
                    opacity: isAddingOrder ? 0.7 : 1,
                    cursor: isAddingOrder ? 'not-allowed' : 'pointer',
                    position: 'relative'
                  }}
                >
                  {isAddingOrder ? (
                    <>
                      <span style={{ 
                        display: 'inline-block', 
                        animation: 'spin 1s linear infinite',
                        marginRight: '8px'
                      }}>
                        ⏳
                      </span>
                      {editingOrder ? 'Guardando cambios...' : 'Agregando pedido...'}
                    </>
                  ) : (
                    <>{editingOrder ? '💾 Guardar Cambios' : '➕ Agregar Pedido'}</>
                  )}
                </button>
              </div>
            </form>
          </section>
        )
      case 'ver':
        return (
          <section className="card">
            <div className="toolbar" style={{ gap: 8 }}>
              <h2>
                Kanban Board {loading && '🔄'}
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Selector de tipo de vista */}
                <select
                  value={viewType}
                  onChange={(e) => {
                    setViewType(e.target.value)
                    // Si cambia a rango, establecer fechas por defecto
                    if (e.target.value === 'range') {
                      setDateRange({
                        start: dateFilter,
                        end: dateFilter
                      })
                    }
                  }}
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    height: '38px',
                    minWidth: '140px'
                  }}
                  title="Tipo de vista"
                >
                  <option value="day">📅 Por día</option>
                  <option value="range">📊 Por rango</option>
                </select>

                {/* Vista por día */}
                {viewType === 'day' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input 
                  type="date" 
                  value={dateFilter} 
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                        fontSize: '14px',
                        height: '38px',
                        minWidth: '140px'
                  }}
                    title="Filtrar por fecha específica"
                  />
                    <button
                      type="button"
                      onClick={() => {
                        const today = getBoliviaDateISO()
                        setDateFilter(today)
                        showNotification(`📅 Fecha cambiada a hoy: ${formatDateForDisplay(today)}`, 'info')
                      }}
                      title="Ir a fecha de hoy"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#495057',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        transition: 'all 0.2s ease',
                        height: '38px',
                        minWidth: '38px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#e9ecef'
                        e.target.style.borderColor = '#adb5bd'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#f8f9fa'
                        e.target.style.borderColor = '#ddd'
                      }}
                    >
                      📅
                    </button>
                  </div>
                )}

                {/* Vista por rango */}
                {viewType === 'range' && (
                  <>
                    <input 
                      type="date" 
                      value={dateRange.start} 
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px',
                        fontSize: '14px',
                        height: '38px',
                        minWidth: '140px'
                      }}
                      title="Fecha de inicio del rango"
                    />
                    <span style={{ color: '#666', fontSize: '14px' }}>hasta</span>
                    <input 
                      type="date" 
                      value={dateRange.end} 
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px',
                        fontSize: '14px',
                        height: '38px',
                        minWidth: '140px'
                      }}
                      title="Fecha de fin del rango"
                    />
                  </>
                )}
                <input 
                  className="search" 
                  placeholder="Buscar..." 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)} 
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    height: '38px',
                    minWidth: '200px'
                  }}
                />
              </div>
            </div>
            
            {/* Kanban Principal con scroll horizontal */}
            <div className="kanban-container">
            <div className="kanban-board">
                {ESTADOS.filter(estado => estado !== 'Cancelado').map(estado => (
                  <div key={estado} className={`kanban-column kanban-${estado.toLowerCase().replace(' ', '-')}`}>
                  <div className="kanban-header">
                      <h3>
                        <Icon 
                          name={
                            estado === 'Pendiente' ? 'clock' :
                            estado === 'En carrera' ? 'truck' :
                            'checkCircle'
                          } 
                          size={16} 
                          style={{ marginRight: '6px' }}
                          title={
                            estado === 'Pendiente' ? 'Pedidos pendientes de asignar' :
                            estado === 'En carrera' ? 'Pedidos en proceso de entrega' :
                            'Pedidos completados exitosamente'
                          }
                        />
                        {estado}
                      </h3>
                    <span className="count">{filteredOrders.filter(o => o.estado === estado).length}</span>
                  </div>
                  <div 
                    className="kanban-content"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, estado)}
                  >
                    {filteredOrders
                      .filter(order => order.estado === estado)
                      .sort((a, b) => {
                        // Para "Entregado", invertir el orden (más reciente primero)
                        if (estado === 'Entregado') {
                          const idA = parseInt(a.id) || 0
                          const idB = parseInt(b.id) || 0
                          return idB - idA // Orden descendente (mayor ID primero)
                        }
                        // Para otros estados, mantener orden normal
                        return 0
                      })
                      .map(order => (
                        <div
                          key={order.id}
                          className={`kanban-card ${(!order.biker || order.biker === 'ASIGNAR BIKER') ? 'no-biker-assigned' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order)}
                        >
                          {/* SECCIÓN 1: RESUMEN DEL PEDIDO */}
                          <div className="card-section card-summary">
                          <div className="card-header">
                            <span className="pedido-id">#{order.id}</span>
                            <span className="operador">{order.operador}</span>
                            <span className="fecha">{formatDateForDisplay(order.fecha)}</span>
                          </div>
                          <div className="card-content">
                            <div className="cliente">{order.cliente || 'Sin cliente'}</div>
                            <div className="route">
                              <span className="from">{order.recojo || 'Sin recojo'}</span>
                              <span className="arrow">→</span>
                              <span className="to">{order.entrega || 'Sin entrega'}</span>
                            </div>
                            {order.precio_bs && (
                              <div className="precio">{order.precio_bs} Bs</div>
                            )}
                            {order.biker && (
                                <div className="biker">
                                  <Icon 
                                    name="bike" 
                                    size={14} 
                                    style={{ marginRight: '4px' }}
                                    title={`Biker asignado: ${order.biker}`}
                                  />
                                  {order.biker}
                                </div>
                            )}
                          </div>
                          </div>

                          {/* LÍNEA DIVISORIA */}
                          <div style={{ 
                            height: '1px', 
                            background: '#e0e0e0', 
                            margin: '8px 0', 
                            opacity: 0.3 
                          }}></div>

                          {/* SECCIÓN 2: HORARIOS */}
                          <div className="card-section card-times">
                            <div className="time-info">
                              {order.hora_ini && (
                                <div className="time-delivery">
                                    <span className="time-label">
                                      <Icon 
                                        name="clock" 
                                        size={12}
                                        title={`Hora de inicio de la entrega: ${order.hora_ini}`}
                                      />
                                      Inicio:
                                    </span>
                                  <span className="time-value">{order.hora_ini}</span>
                                </div>
                              )}
                              {order.hora_fin && (
                                <div className="time-delivery">
                                    <span className="time-label">
                                      <Icon 
                                        name="checkCircle" 
                                        size={12}
                                        title={`Hora de finalización: ${order.hora_fin}`}
                                      />
                                      Fin:
                                    </span>
                                  <span className="time-value">{order.hora_fin}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* LÍNEA DIVISORIA */}
                          <div style={{ 
                            height: '1px', 
                            background: '#e0e0e0', 
                            margin: '8px 0', 
                            opacity: 0.3 
                          }}></div>

                          {/* SECCIÓN 3: DESCRIPCIÓN DEL PEDIDO */}
                          {order.detalles_carrera && (
                            <div className="card-section card-description">
                              <div className="description-content">
                                <span className="description-label">
                                  <Icon 
                                    name="fileText" 
                                    size={12}
                                    style={{ marginRight: '4px' }}
                                    title="Descripción del pedido"
                                  />
                                  Descripción:
                                </span>
                                <span className="description-text">{order.detalles_carrera}</span>
                              </div>
                            </div>
                          )}

                          {/* LÍNEA DIVISORIA */}
                          <div style={{ 
                            height: '1px', 
                            background: '#e0e0e0', 
                            margin: '8px 0', 
                            opacity: 0.3 
                          }}></div>

                          {/* SECCIÓN 4: BOTONES DE ACCIÓN */}
                          <div className="card-section card-actions">
                            <div className="card-actions">
                              <button 
                                className="btn-view"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  showNotification(`👁️ Abriendo resumen para pedido #${order.id}`, 'info')
                                  setSummaryModal({ show: true, order: order })
                                }}
                                title={`Ver resumen del pedido #${order.id}`}
                                style={{
                                  background: '#e9ecef', /* Plomo bajito (gris claro) */
                                  color: '#495057',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginRight: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                👁️
                              </button>
                              <button 
                                className="btn-edit"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditMode(order)
                                }}
                                  title={`Editar pedido #${order.id}`}
                                style={{
                                  background: '#e9ecef', /* Plomo bajito (gris claro) */
                                  color: '#495057',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginRight: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                ✏️
                              </button>
                              <button 
                                className="btn-duplicate"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDuplicateModal({ show: true, order: order, selectedDates: [], isDuplicating: false })
                                }}
                                title={`Duplicar pedido #${order.id}`}
                                style={{
                                  background: '#e9ecef', /* Plomo bajito (gris claro) */
                                  color: '#495057',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginRight: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                2️⃣
                              </button>
                              <button 
                                className="btn-whatsapp"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  
                                  // Validar si hay biker asignado
                                  if (!order.biker || order.biker.trim() === '' || order.biker === 'ASIGNAR BIKER') {
                                    toast.error('❌ NO EXISTE BIKER ASIGNADO', {
                                      position: "top-center",
                                      autoClose: 3000,
                                      hideProgressBar: false,
                                      closeOnClick: true,
                                      pauseOnHover: true,
                                      draggable: true,
                                      className: "toast-error",
                                    })
                                    return
                                  }
                                  
                                  const whatsappURL = generateWhatsAppURL(order, bikersAgregar)
                                  window.open(whatsappURL, '_blank')
                                  
                                  // Mostrar notificación con información del destinatario
                                  if (order.biker) {
                                    const selectedBiker = bikersAgregar.find(biker => (biker.nombre || biker) === order.biker)
                                    if (selectedBiker && selectedBiker.whatsapp) {
                                      showNotification(`📱 Enviando WhatsApp a ${order.biker} (${selectedBiker.whatsapp})`, 'success')
                                    } else {
                                      showNotification(`📱 Enviando WhatsApp a ${order.biker} (número por defecto)`, 'warning')
                                    }
                                  }
                                }}
                                disabled={!order.biker || order.biker.trim() === '' || order.biker === 'ASIGNAR BIKER'}
                                title={
                                  !order.biker || order.biker.trim() === ''
                                    ? 'No hay biker asignado'
                                    : order.biker === 'ASIGNAR BIKER'
                                    ? 'ASIGNAR BIKER no tiene WhatsApp'
                                    : `Enviar WhatsApp al biker ${order.biker}`
                                }
                                style={{
                                  opacity: (!order.biker || order.biker.trim() === '' || order.biker === 'ASIGNAR BIKER') ? 0.5 : 1,
                                  cursor: (!order.biker || order.biker.trim() === '' || order.biker === 'ASIGNAR BIKER') ? 'not-allowed' : 'pointer',
                                  background: '#e9ecef', /* Plomo bajito (gris claro) */
                                  color: '#495057',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                  📱
                              </button>
                                {order.estado !== 'Entregado' && (
                                                                  <button 
                                  className="btn-cancel"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    showNotification(`❌ Abriendo modal de cancelación para pedido #${order.id}`, 'warning')
                                    setCancelModal({ show: true, order: order })
                                  }}
                                  title={`Cancelar pedido #${order.id}`}
                                    style={{
                                      background: '#e9ecef', /* Plomo bajito (gris claro) */
                                      color: '#495057',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '28px',
                                      height: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      marginRight: '4px',
                                      fontSize: '14px'
                                    }}
                                  >
                                    ❌
                                </button>
                                )}
                            </div>
                          </div>
                        </div>
                      ))
                    }
                    {filteredOrders.filter(o => o.estado === estado).length === 0 && (
                      <div className="empty-column">
                          <Icon 
                            name={
                              estado === 'Pendiente' ? 'clock' :
                              estado === 'En carrera' ? 'truck' :
                              'checkCircle'
                            } 
                            size={24} 
                            style={{ marginBottom: '8px', opacity: 0.3 }}
                            title={
                              estado === 'Pendiente' ? 'No hay pedidos pendientes' :
                              estado === 'En carrera' ? 'No hay pedidos en carrera' :
                              'No hay pedidos entregados'
                            }
                          />
                          <span>Arrastra pedidos aquí</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              </div>
              
              {/* Sección de Cancelados separada */}
              <div className="kanban-cancelled-section">
                <div className="kanban-column kanban-cancelado">
                  <div className="kanban-header">
                    <h3>
                      <Icon 
                        name="xCircle" 
                        size={16} 
                        style={{ marginRight: '6px' }}
                        title="Pedidos cancelados o rechazados"
                      />
                      Cancelado
                    </h3>
                    <span className="count">{filteredOrders.filter(o => o.estado === 'Cancelado').length}</span>
                  </div>
                  <div 
                    className="kanban-content kanban-content-cancelled"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'Cancelado')}
                  >
                    {filteredOrders
                      .filter(order => order.estado === 'Cancelado')
                      .map(order => (
                        <div
                          key={order.id}
                          className={`kanban-card kanban-card-cancelled ${(!order.biker || order.biker === 'ASIGNAR BIKER') ? 'no-biker-assigned' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order)}
                        >
                          {/* SECCIÓN 1: RESUMEN DEL PEDIDO CANCELADO */}
                          <div className="card-section card-summary">
                          <div className="card-header">
                            <span className="pedido-id">#{order.id}</span>
                            <span className="operador">{order.operador}</span>
                            <span className="fecha">{formatDateForDisplay(order.fecha)}</span>
                          </div>
                          <div className="card-content">
                            <div className="cliente">{order.cliente || 'Sin cliente'}</div>
                            <div className="route">
                              <span className="from">{order.recojo || 'Sin recojo'}</span>
                              <span className="arrow">→</span>
                              <span className="to">{order.entrega || 'Sin entrega'}</span>
                            </div>
                            {order.motivo_cancelacion && (
                              <div className="cancellation-reason">
                                <Icon 
                                  name="alertCircle" 
                                  size={12} 
                                  style={{ marginRight: '4px' }}
                                  title={`Motivo de cancelación: ${order.motivo_cancelacion}`}
                                />
                                {order.motivo_cancelacion}
                              </div>
                            )}
                          </div>
                          </div>

                          {/* LÍNEA DIVISORIA */}
                          <div style={{ 
                            height: '1px', 
                            background: '#e0e0e0', 
                            margin: '8px 0', 
                            opacity: 0.3 
                          }}></div>

                          {/* SECCIÓN 2: HORARIOS (si existen) */}
                          <div className="card-section card-times">
                            {(order.hora_ini || order.hora_fin) && (
                              <div className="time-info">
                                {order.hora_ini && (
                                  <div className="time-delivery">
                                      <span className="time-label">
                                        <Icon 
                                          name="clock" 
                                          size={12}
                                          title={`Hora de inicio: ${order.hora_ini}`}
                                        />
                                        Inicio:
                                      </span>
                                    <span className="time-value">{order.hora_ini}</span>
                                  </div>
                                )}
                                {order.hora_fin && (
                                  <div className="time-delivery">
                                      <span className="time-label">
                                        <Icon 
                                          name="checkCircle" 
                                          size={12}
                                          title={`Hora de finalización: ${order.hora_fin}`}
                                        />
                                        Fin:
                                      </span>
                                    <span className="time-value">{order.hora_fin}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* LÍNEA DIVISORIA */}
                          <div style={{ 
                            height: '1px', 
                            background: '#e0e0e0', 
                            margin: '8px 0', 
                            opacity: 0.3 
                          }}></div>

                          {/* SECCIÓN 3: DESCRIPCIÓN DEL PEDIDO */}
                          {order.detalles_carrera && (
                            <div className="card-section card-description">
                              <div className="description-content">
                                <span className="description-label">
                                  <Icon 
                                    name="fileText" 
                                    size={12}
                                    style={{ marginRight: '4px' }}
                                    title="Descripción del pedido"
                                  />
                                  Descripción:
                                </span>
                                <span className="description-text">{order.detalles_carrera}</span>
                              </div>
                            </div>
                          )}

                          {/* LÍNEA DIVISORIA */}
                          <div style={{ 
                            height: '1px', 
                            background: '#e0e0e0', 
                            margin: '8px 0', 
                            opacity: 0.3 
                          }}></div>

                          {/* SECCIÓN 4: BOTONES DE ACCIÓN */}
                          <div className="card-section card-actions">
                            <div className="card-actions">
                              <button 
                                className="btn-view"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  showNotification(`👁️ Abriendo resumen para pedido cancelado #${order.id}`, 'info')
                                  setSummaryModal({ show: true, order: order })
                                }}
                                title={`Ver resumen del pedido cancelado #${order.id}`}
                                style={{
                                  background: '#e9ecef', /* Plomo bajito (gris claro) */
                                  color: '#495057',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginRight: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                👁️
                              </button>
                              <button 
                                className="btn-edit"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditMode(order)
                                }}
                                title={`Editar pedido cancelado #${order.id}`}
                                style={{
                                  background: '#e9ecef', /* Plomo bajito (gris claro) */
                                  color: '#495057',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginRight: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                ✏️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    }
                    {filteredOrders.filter(o => o.estado === 'Cancelado').length === 0 && (
                      <div className="empty-column">
                        <Icon 
                          name="xCircle" 
                          size={24} 
                          style={{ marginBottom: '8px', opacity: 0.3 }}
                          title="No hay pedidos cancelados"
                        />
                        <span>Pedidos cancelados aparecerán aquí</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )
      case 'agregar-nuevo':
        return (
          <section className="card">
            <h2>🆕 Agregar Nuevo</h2>
            
            {/* Selector de tipo */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                  type="button"
                  className={`btn ${nuevoTipo === 'empresa' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setNuevoTipo('empresa')}
                >
                  🏢 Agregar Empresa
                </button>
                <button
                  type="button"
                  className={`btn ${nuevoTipo === 'biker' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setNuevoTipo('biker')}
                >
                  🚴‍♂️ Agregar Biker
                </button>
            </div>
            </div>

            {/* Formulario para Empresa */}
            {nuevoTipo === 'empresa' && (
              <form onSubmit={handleAddEmpresa} className="form-organized">
                <h3>🏢 Nueva Empresa</h3>
                
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#e7f3ff', 
                  borderRadius: '6px', 
                  marginBottom: '20px',
                  border: '1px solid #b3d9ff'
                }}>
                  <strong>📅 Fecha:</strong> {(() => {
                    const { fechaRegistro } = getBoliviaDateTime()
                    return fechaRegistro
                  })()} (fecha actual de Bolivia)
                </div>

                <div className="form-group">
                  <label>Operador:</label>
                  <input
                    type="text"
                    value={nuevaEmpresa.operador}
                    onChange={(e) => setNuevaEmpresa(prev => ({ ...prev, operador: e.target.value }))}
                    placeholder={`Operador (opcional, se usará "${operadorDefault}" si está vacío)`}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    Dejar vacío para usar el operador actual
                  </small>
                </div>
                
                <div className="form-group">
                  <label>Empresa *:</label>
                  <input
                    type="text"
                    value={nuevaEmpresa.empresa}
                    onChange={(e) => setNuevaEmpresa(prev => ({ ...prev, empresa: e.target.value }))}
                    placeholder="Nombre de la empresa"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Mapa (URL):</label>
                  <input
                    type="url"
                    value={nuevaEmpresa.mapa}
                    onChange={(e) => setNuevaEmpresa(prev => ({ ...prev, mapa: e.target.value }))}
                    placeholder="https://goo.gl/maps/..."
                  />
                </div>

                <div className="form-group">
                  <label>Descripción *:</label>
                  <textarea
                    value={nuevaEmpresa.descripcion}
                    onChange={(e) => setNuevaEmpresa(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Descripción detallada de la ubicación"
                    rows="3"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    ✅ Agregar Empresa
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setNuevaEmpresa({
                      operador: '',
                      empresa: '',
                      mapa: '',
                      descripcion: ''
                    })}
                  >
                    🔄 Limpiar
                  </button>
                </div>
              </form>
            )}

            {/* Formulario para Biker */}
            {nuevoTipo === 'biker' && (
              <form onSubmit={handleAddBiker} className="form-organized">
                <h3>🚴‍♂️ Nuevo Biker</h3>
                
                <div className="form-group">
                  <label>Biker *:</label>
                  <input
                    type="text"
                    value={nuevoBiker.biker}
                    onChange={(e) => setNuevoBiker(prev => ({ ...prev, biker: e.target.value }))}
                    placeholder="Nombre del biker"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>WhatsApp *:</label>
                  <input
                    type="tel"
                    value={nuevoBiker.whatsapp}
                    onChange={(e) => setNuevoBiker(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="591 7XXXXXXXX"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    ✅ Agregar Biker
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setNuevoBiker({
                      biker: '',
                      whatsapp: ''
                    })}
                  >
                    🔄 Limpiar
                  </button>
                </div>
              </form>
            )}

            {/* Tabla de empresas existentes */}
            {empresasAgregar.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h3>🏢 Empresas Existentes ({empresasAgregar.length})</h3>
                <div style={{ 
                  maxHeight: '500px', 
                  overflowY: 'auto', 
                  overflowX: 'auto',
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  marginTop: '12px'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '14px'
                  }}>
                    <thead style={{ 
                      position: 'sticky', 
                      top: 0, 
                      backgroundColor: '#f8f9fa',
                      zIndex: 10,
                      borderBottom: '2px solid #dee2e6'
                    }}>
                      <tr>
                        <th style={{ 
                          padding: '12px', 
                          textAlign: 'left', 
                          fontWeight: '600',
                          color: '#495057',
                          borderBottom: '2px solid #dee2e6',
                          backgroundColor: '#e9ecef'
                        }}>Fecha</th>
                        <th style={{ 
                          padding: '12px', 
                          textAlign: 'left', 
                          fontWeight: '600',
                          color: '#495057',
                          borderBottom: '2px solid #dee2e6',
                          backgroundColor: '#e9ecef'
                        }}>Operador</th>
                        <th style={{ 
                          padding: '12px', 
                          textAlign: 'left', 
                          fontWeight: '600',
                          color: '#495057',
                          borderBottom: '2px solid #dee2e6',
                          backgroundColor: '#e9ecef'
                        }}>Empresa</th>
                        <th style={{ 
                          padding: '12px', 
                          textAlign: 'left', 
                          fontWeight: '600',
                          color: '#495057',
                          borderBottom: '2px solid #dee2e6',
                          backgroundColor: '#e9ecef'
                        }}>Mapa</th>
                        <th style={{ 
                          padding: '12px', 
                          textAlign: 'left', 
                          fontWeight: '600',
                          color: '#495057',
                          borderBottom: '2px solid #dee2e6',
                          backgroundColor: '#e9ecef'
                        }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                  {empresasAgregar.map((empresa, index) => (
                        <tr key={index} style={{ 
                          borderBottom: '1px solid #e9ecef',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                        }}>
                          <td style={{ padding: '10px 12px', color: '#6c757d' }}>
                            {empresa.Fecha || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#6c757d' }}>
                            {empresa.Operador || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#212529' }}>
                            {empresa.Empresa || empresa.empresa || '-'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {empresa.Mapa || empresa.mapa ? (
                              <a 
                                href={empresa.Mapa || empresa.mapa} 
                          target="_blank" 
                          rel="noopener noreferrer"
                                style={{ 
                                  color: '#007bff', 
                                  textDecoration: 'none',
                                  fontSize: '12px',
                                  wordBreak: 'break-all'
                                }}
                                title={empresa.Mapa || empresa.mapa}
                        >
                          🗺️ Ver Mapa
                        </a>
                            ) : (
                              <span style={{ color: '#adb5bd' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#495057', maxWidth: '300px' }}>
                            <span style={{ 
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }} title={empresa.Descripción || empresa.descripción || empresa.Descripcion || empresa.descripcion || ''}>
                              {empresa.Descripción || empresa.descripción || empresa.Descripcion || empresa.descripcion || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lista de bikers existentes */}
            {bikersAgregarNuevo.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h3>🚴‍♂️ Bikers Existentes ({bikersAgregarNuevo.length})</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px' }}>
                  {bikersAgregarNuevo.map((biker, index) => (
                    <div key={index} style={{ 
                      padding: '10px', 
                      borderBottom: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <strong>{biker.Biker}</strong>
                        <br />
                        <small style={{ color: '#666' }}>{biker.Whatsapp}</small>
                      </div>
                      <a 
                        href={`https://wa.me/${biker.Whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#25D366', textDecoration: 'none' }}
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )
        case 'cobros-pagos': {
          const empresasTheme = {
            primary: '#facc15',
            primaryDark: '#ca8a04',
            dark: '#0f172a',
            muted: '#6b7280',
            card: '#fffbeb',
            accent: '#fef3c7',
            border: '#fbbf24',
            success: '#16a34a',
            danger: '#dc2626'
          }

          return (
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: empresasTheme.dark, margin: 0 }}>🏢 Empresas</h2>
            </div>

            {/* Filtro de rango de fechas */}
            <div style={{ marginBottom: '20px', marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: empresasTheme.dark, whiteSpace: 'nowrap' }}>
                📅 Filtro de fechas:
              </label>
              <input
                type="date"
                value={fechaInicioEmpresas}
                onChange={(e) => setFechaInicioEmpresas(e.target.value)}
                      style={{ 
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${empresasTheme.border}`,
                  fontSize: '13px',
                  width: '150px'
                }}
                placeholder="Fecha inicio"
              />
              <span style={{ color: empresasTheme.muted, fontSize: '14px' }}>hasta</span>
              <input
                type="date"
                value={fechaFinEmpresas}
                onChange={(e) => setFechaFinEmpresas(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${empresasTheme.border}`,
                  fontSize: '13px',
                  width: '150px'
                }}
                placeholder="Fecha fin"
              />
              {(fechaInicioEmpresas || fechaFinEmpresas) && (
                <button
                  type="button"
                  onClick={() => {
                    setFechaInicioEmpresas('')
                    setFechaFinEmpresas('')
                  }}
                  style={{
                    padding: '8px 12px',
                    background: empresasTheme.accent,
                    border: `1px solid ${empresasTheme.border}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Limpiar fechas
                </button>
              )}
                      </div>

            {/* Buscador de empresas */}
            <div style={{ marginBottom: '20px', marginTop: '20px' }}>
                        <div style={{ 
                position: 'relative',
                          display: 'flex', 
                          alignItems: 'center',
                gap: '12px'
              }}>
                <Icon name="search" size={20} color={empresasTheme.muted} />
                <input
                  type="text"
                  placeholder="Buscar empresa por nombre..."
                  value={busquedaEmpresas}
                  onChange={(e) => setBusquedaEmpresas(e.target.value)}
                  style={{ 
                    flex: 1,
                    padding: '12px 16px',
                    paddingLeft: '44px',
                    borderRadius: '999px',
                    border: `2px solid ${empresasTheme.border}`,
                    background: '#fff',
                    color: empresasTheme.dark,
                    fontSize: '14px',
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(250, 204, 21, 0.15)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = empresasTheme.primaryDark
                    e.target.style.boxShadow = '0 6px 20px rgba(250, 204, 21, 0.3)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = empresasTheme.border
                    e.target.style.boxShadow = '0 4px 12px rgba(250, 204, 21, 0.15)'
                  }}
                />
                {busquedaEmpresas && (
                  <button
                    type="button"
                    onClick={() => setBusquedaEmpresas('')}
                    style={{
                      padding: '8px',
                      background: empresasTheme.accent,
                      border: `1px solid ${empresasTheme.border}`,
                      borderRadius: '50%',
                      cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = empresasTheme.primary
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = empresasTheme.accent
                    }}
                    title="Limpiar búsqueda"
                  >
                    <Icon name="xCircle" size={18} color={empresasTheme.dark} />
                  </button>
                )}
              </div>
            </div>

            {/* Detalle de transacciones */}
            <div className="transactions-section">
              <h3 style={{ color: empresasTheme.dark }}>📋 Detalle de transacciones</h3>
              {cobrosPagosData.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: empresasTheme.muted }}>
                  <p>📭 No hay transacciones registradas</p>
                  <p>Verás la actividad cuando se registren cobros o pagos.</p>
                </div>
              ) : (
                <div className="transactions-list">
                  {cobrosPagosData
                    .filter(cliente => {
                      if (!busquedaEmpresas.trim()) return true
                      const busqueda = busquedaEmpresas.toLowerCase().trim()
                      return cliente.cliente.toLowerCase().includes(busqueda)
                    })
                    .map(cliente => {
                      // Filtrar pedidos por rango de fechas primero
                      let pedidosFiltrados = cliente.pedidos
                      
                      if (fechaInicioEmpresas || fechaFinEmpresas) {
                        pedidosFiltrados = cliente.pedidos.filter(pedido => {
                          const fechaPedido = pedido.fecha || pedido['Fecha Registro'] || pedido['Fechas'] || ''
                          if (!fechaPedido || fechaPedido === 'N/A') return false
                          
                          let fechaPedidoDate = null
                          try {
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
                          
                          const inicio = fechaInicioEmpresas ? new Date(fechaInicioEmpresas + 'T00:00:00') : null
                          const fin = fechaFinEmpresas ? new Date(fechaFinEmpresas + 'T23:59:59') : null
                          
                          if (inicio && fin) {
                            return fechaPedidoDate >= inicio && fechaPedidoDate <= fin
                          } else if (inicio) {
                            return fechaPedidoDate >= inicio
                          } else if (fin) {
                            return fechaPedidoDate <= fin
                          }
                          
                          return true
                        })
                      }
                      
                      // Calcular totales separados por tipo
                      let totalPrecioCarreras = 0
                      let totalCobros = 0
                      let totalPagos = 0
                      
                      pedidosFiltrados.forEach(pedido => {
                        const precioCarrera = parseFloat(pedido.precio_bs || pedido['Precio [Bs]'] || 0)
                        const cobroPago = pedido.cobro_pago || pedido['Cobro o pago'] || ''
                        const montoCobroPago = parseFloat(pedido.monto_cobro_pago || pedido['Monto cobro o pago'] || 0)
                        
                        totalPrecioCarreras += precioCarrera
                        
                        if (montoCobroPago > 0) {
                          if (cobroPago === 'Cobro') {
                            totalCobros += montoCobroPago
                          } else if (cobroPago === 'Pago') {
                            totalPagos += montoCobroPago
                          }
                        }
                      })
                      
                      // Calcular descuento sobre carreras
                      const porcentajeDescuento = descuentosClientes[cliente.cliente] || 0
                      const montoDescuento = (totalPrecioCarreras * porcentajeDescuento) / 100
                      const totalCarrerasConDescuento = totalPrecioCarreras - montoDescuento
                      
                      // Calcular cuenta total
                      const cuentaTotal = totalCarrerasConDescuento + totalCobros - totalPagos
                      
                      return (
                      <div key={cliente.cliente} className="cliente-section" style={{ marginBottom: '30px' }}>
                        <h4 style={{ 
                          backgroundColor: empresasTheme.card, 
                          color: empresasTheme.dark, 
                          padding: '12px 18px', 
                          margin: '0 0 15px 0', 
                          borderRadius: '12px',
                          border: `1px solid ${empresasTheme.border}`,
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px'
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              🏢 {cliente.cliente}
                              <span style={{ fontSize: '13px', color: empresasTheme.muted }}>{cliente.pedidos.length} registros</span>
                            </div>
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <label style={{ 
                                fontSize: '13px', 
                                fontWeight: '600', 
                                color: empresasTheme.muted,
                                whiteSpace: 'nowrap'
                              }}>
                                💰 Descuento:
                              </label>
                              <select 
                                value={descuentosClientes[cliente.cliente] || 0} 
                                onChange={(e) => {
                                  const nuevoDescuento = parseFloat(e.target.value) || 0
                                  setDescuentosClientes(prev => ({
                                    ...prev,
                                    [cliente.cliente]: nuevoDescuento
                                  }))
                                }}
                                style={{
                                  padding: '6px 12px',
                                  border: `1px solid ${empresasTheme.border}`,
                                  borderRadius: '999px',
                                  fontSize: '13px',
                                  backgroundColor: empresasTheme.accent,
                                  color: empresasTheme.primaryDark,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  minWidth: '140px'
                                }}
                              >
                                <option value={0}>Sin descuento</option>
                                <option value={5}>5%</option>
                                <option value={10}>10%</option>
                                <option value={15}>15%</option>
                                <option value={20}>20%</option>
                                <option value={25}>25%</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button 
                              className="btn" 
                              onClick={() => generarSheetEmpresas([cliente])}
                              disabled={generandoSheet || !cliente.pedidos || cliente.pedidos.length === 0}
                              style={{
                                background: `linear-gradient(135deg, ${empresasTheme.primary} 0%, ${empresasTheme.primaryDark} 100%)`,
                                color: empresasTheme.dark,
                                border: 'none',
                                borderRadius: '999px',
                                padding: '8px 16px',
                                fontSize: '13px',
                                cursor: (generandoSheet || !cliente.pedidos || cliente.pedidos.length === 0) ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 12px rgba(250, 204, 21, 0.3)',
                                transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                                gap: '6px',
                                opacity: (generandoSheet || !cliente.pedidos || cliente.pedidos.length === 0) ? 0.6 : 1,
                                fontWeight: 600
                              }}
                            >
                              {generandoSheet ? '⏳' : '📊'} Generar Sheet
                            </button>
                          <button
                              className="btn" 
                              onClick={() => descargarPDFEmpresas(cliente)}
                              disabled={!cliente.pedidos || cliente.pedidos.length === 0}
                            style={{
                                background: `linear-gradient(135deg, ${empresasTheme.primary} 0%, ${empresasTheme.primaryDark} 100%)`,
                                color: empresasTheme.dark,
                              border: 'none',
                                borderRadius: '999px',
                                padding: '8px 16px',
                                fontSize: '13px',
                                cursor: (!cliente.pedidos || cliente.pedidos.length === 0) ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 12px rgba(250, 204, 21, 0.3)',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                                gap: '6px',
                                opacity: (!cliente.pedidos || cliente.pedidos.length === 0) ? 0.6 : 1,
                                fontWeight: 600
                              }}
                            >
                              📄 Descargar PDF
                            </button>
                          </div>
                        </h4>
                        <div className="transactions-table" style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                            <colgroup>
                              <col style={{ width: '5%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '12%' }} />
                              <col style={{ width: '12%' }} />
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '11%' }} />
                              <col style={{ width: '10%' }} />
                              <col style={{ width: '22%' }} />
                              <col style={{ width: '11%' }} />
                            </colgroup>
                            <thead>
                              <tr style={{ backgroundColor: empresasTheme.accent }}>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>ID</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>Fecha</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>Recojo</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>Entrega</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>Tiempo Espera</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>Precio Carrera</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>Cobro o pago</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>Descripcion c/p</th>
                                <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>Monto c/p</th>
                              </tr>
                            </thead>
                            <tbody>
                                    {pedidosFiltrados.map(pedido => {
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
                                      const fechaOriginal = pedido.fecha || pedido['Fecha Registro'] || pedido['Fechas'] || 'N/A'
                                      // Formatear fecha a DD/MM/YYYY
                                      const fecha = formatDateForDisplay(fechaOriginal)
                                      const tiempoEspera = pedido.tiempo_espera || pedido['Tiempo de espera'] || pedido['Tiempo de Espera'] || ''
                                      const cobroPago = pedido.cobro_pago || pedido['Cobro o pago'] || ''
                                      const descripcionCobroPago = pedido.descripcion_cobro_pago || pedido['Descripcion de cobro o pago'] || ''
                                      const montoCobroPago = pedido.monto_cobro_pago || pedido['Monto cobro o pago'] || ''
                                      
                                      // Debug: mostrar conversión de fechas
                                      if (fechaOriginal !== 'N/A' && fechaOriginal !== fecha) {

                                      }
                                      
                                      // Función para normalizar links
                                      const normalizeLink = (url = '') => {
                                        if (!url) return ''
                                        return url.startsWith('http') ? url : `https://${url}`
                                      }
                                      
                                      // Función para renderizar ubicación (recojo o entrega) con link si es URL
                                      const renderUbicacion = (valor, label) => {
                                        const esUrl = valor && (valor.startsWith('http') || valor.includes('maps'))
                                        
                                        if (esUrl) {
                                          return (
                                            <a
                                              href={normalizeLink(valor)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{ 
                                                color: '#0369a1', 
                                                textDecoration: 'none', 
                                                fontWeight: 600,
                                                fontSize: '12px'
                            }}
                                              title={valor}
                                            >
                                              🗺️ {label}
                                            </a>
                                          )
                                        }
                                        
                                        return (
                                          <div style={{ 
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            lineHeight: '1.4'
                                          }} title={valor}>
                                            {valor}
                                          </div>
                                        )
                                      }
                                      
                                      return (
                                        <tr
                                          key={pedido.id}
                                          style={{
                                            backgroundColor: '#fff',
                                            borderLeft: `4px solid ${pedido.cobro_pago === 'Cobro' ? empresasTheme.success : (pedido.cobro_pago === 'Pago' ? empresasTheme.danger : '#e2e8f0')}`
                                          }}
                                        >
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '12px' }}>
                                            <span 
                                              style={{ 
                                                color: '#0369a1', 
                                                cursor: 'pointer', 
                                                textDecoration: 'underline',
                                                fontWeight: 600
                                              }}
                                              onClick={() => setSummaryModal({ show: true, order: pedido })}
                                              title="Click para ver detalles completos"
                                            >
                                              #{pedido.id}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '12px' }}>{fecha}</td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', wordBreak: 'break-word', fontSize: '12px' }}>
                                            {renderUbicacion(recojo, 'Recojo')}
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', wordBreak: 'break-word', fontSize: '12px' }}>
                                            {renderUbicacion(entrega, 'Entrega')}
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'left', fontSize: '12px' }}>
                                            {tiempoEspera || 'N/A'}
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 600, color: '#0369a1', fontSize: '12px' }}>
                                            {precioCarrera.toFixed(2)} Bs
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '11px' }}>
                                            {cobroPago ? (
                                              <span style={{ 
                                                padding: '3px 8px', 
                                                borderRadius: '999px', 
                                                color: cobroPago === 'Cobro' ? '#065f46' : '#7f1d1d',
                                                backgroundColor: cobroPago === 'Cobro' ? '#bbf7d0' : '#fecdd3',
                                                fontWeight: 600,
                                                fontSize: '11px'
                                              }}>
                                                {cobroPago === 'Cobro' ? '💰 Cobro' : '💸 Pago'}
                                              </span>
                                            ) : ''}
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', wordBreak: 'break-word', fontSize: '12px' }}>
                                            <div style={{ 
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              lineHeight: '1.4'
                                            }} title={descripcionCobroPago}>
                                              {descripcionCobroPago}
                          </div>
                                          </td>
                                          <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: montoCobroPago ? 600 : 'normal', fontSize: '12px' }}>
                                            {montoCobroPago ? (
                                              <span style={{ 
                                                color: cobroPago === 'Cobro' ? '#065f46' : (cobroPago === 'Pago' ? '#7f1d1d' : '#212529')
                                              }}>
                                                {cobroPago === 'Cobro' ? '+' : (cobroPago === 'Pago' ? '−' : '')}
                                                {formatCurrency(montoCobroPago)} Bs
                                              </span>
                                            ) : ''}
                                          </td>
                                        </tr>
                                      )
                                    })}
                              
                              {/* SUBTOTALES DETALLADOS */}
                              
                              {/* 1. Total Carreras */}
                              <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 600, borderTop: '2px solid #dee2e6' }}>
                                <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="5">
                                  TOTAL CARRERAS
                                      </td>
                                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#0369a1', fontWeight: 700 }}>
                                  {totalPrecioCarreras.toFixed(2)} Bs
                                      </td>
                                <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="2"></td>
                                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#065f46', fontWeight: 700 }}>
                                  +{formatCurrency(totalCarrerasConDescuento)} Bs
                                      </td>
                                    </tr>
                                    
                              {/* 2. Descuento si aplica */}
                                    {porcentajeDescuento > 0 && (
                                        <tr style={{ backgroundColor: '#fff3cd', fontWeight: 600 }}>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="5">
                                    − DESCUENTO {porcentajeDescuento}%
                                          </td>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#856404', fontWeight: 700 }}>
                                            {montoDescuento.toFixed(2)} Bs
                                          </td>
                                          <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="3"></td>
                                        </tr>
                              )}
                              
                              {/* 3. Subtotal Carreras (con descuento si aplica) */}
                              {porcentajeDescuento > 0 && (
                                <tr style={{ backgroundColor: '#e8f4f8', fontWeight: 600 }}>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="5">
                                    SUBTOTAL CARRERAS
                                          </td>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#0369a1', fontWeight: 700 }}>
                                    {totalCarrerasConDescuento.toFixed(2)} Bs
                                          </td>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="2"></td>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#065f46', fontWeight: 700 }}>
                                    +{formatCurrency(totalCarrerasConDescuento)} Bs
                                  </td>
                                        </tr>
                              )}
                              
                              {/* 4. Cobros adicionales */}
                              {totalCobros > 0 && (
                                <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 600 }}>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="8">
                                    TOTAL COBROS (+)
                                      </td>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#065f46', fontWeight: 700 }}>
                                    {formatCurrency(totalCobros)} Bs
                                      </td>
                                    </tr>
                              )}
                              
                              {/* 5. Pagos/Descuentos */}
                              {totalPagos > 0 && (
                                <tr style={{ backgroundColor: '#fef2f2', fontWeight: 600 }}>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6' }} colSpan="8">
                                    TOTAL PAGOS (-)
                                  </td>
                                  <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right', color: '#7f1d1d', fontWeight: 700 }}>
                                    {formatCurrency(totalPagos)} Bs
                                  </td>
                                </tr>
                              )}
                              
                              {/* 6. CUENTA TOTAL FINAL */}
                              <tr style={{ backgroundColor: '#dbeafe', fontWeight: 700, borderTop: '3px solid #0369a1', borderBottom: '3px solid #0369a1' }}>
                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontSize: '15px' }} colSpan="8">
                                            CUENTA TOTAL
                                          </td>
                                <td style={{ 
                                  padding: '12px', 
                                  border: '1px solid #dee2e6', 
                                  textAlign: 'right', 
                                  color: cuentaTotal >= 0 ? '#0369a1' : '#7f1d1d', 
                                  fontSize: '16px', 
                                  fontWeight: 700 
                                }}>
                                  {formatCurrency(cuentaTotal)} Bs
                                          </td>
                                        </tr>
                            </tbody>
                          </table>
                        </div>
                            </div>
                      )
                    })}
                </div>
              )}
            </div>
          </section>
        )
        }
        case 'cuentas-biker': {
          const cuentasTheme = {
            primary: '#16a34a',
            secondary: '#facc15',
            dark: '#0f172a',
            muted: '#6b7280',
            card: '#f8fafc'
          }

          const resumenFecha = loadingCuentasBiker
            ? 'Calculando...'
            : (cuentasBikerData
              ? (cuentasBikerData.esRango
                ? (() => {
                    const fechaInicio = new Date(cuentasBikerData.fechaInicio + 'T00:00:00')
                    const fechaFin = new Date(cuentasBikerData.fechaFin + 'T00:00:00')
                    const options = { day: 'numeric', month: 'long' }
                    return `Del ${fechaInicio.toLocaleDateString('es-BO', options)} al ${fechaFin.toLocaleDateString('es-BO', options)}`
                  })()
                : (() => {
                    if (!fechaDiariaBiker) return 'Selecciona una fecha'
                    const [y, m, d] = fechaDiariaBiker.split('-')
                    const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                    return fecha.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
                  })())
              : (tipoFiltroBiker === 'rango' ? 'Selecciona un rango de fechas' : 'Selecciona una fecha'))

          const normalizeLink = (url = '') => {
            if (!url) return ''
            return url.startsWith('http') ? url : `https://${url}`
          }

          const truncateText = (text = '', max = 20) => {
            if (!text) return 'N/A'
            return text.length > max ? `${text.substring(0, max - 1)}…` : text
          }

          const renderLocationLink = (label, name, url) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: cuentasTheme.muted }}>
              <span style={{ fontWeight: 600 }}>{label}:</span>
              {url ? (
                <a
                  href={normalizeLink(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: cuentasTheme.primary, textDecoration: 'none', fontWeight: 600 }}
                >
                  {name && name.trim() && name !== 'Sin especificar' ? name : 'Ver mapa'}
                </a>
              ) : (
                <span>{name || 'Sin datos'}</span>
              )}
            </div>
          )

          const filterButtonStyle = (active) => ({
            padding: '10px 18px',
            borderRadius: '999px',
            border: `1px solid ${active ? cuentasTheme.primary : '#e5e7eb'}`,
            background: active ? cuentasTheme.primary : '#fff',
            color: active ? '#fff' : cuentasTheme.dark,
                fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          })

          const renderFiltros = () => (
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
              gap: '18px',
              background: cuentasTheme.card,
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '20px',
              width: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: cuentasTheme.dark, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="barChart3" size={18} /> Calcular por:
                  </span>
                <button style={filterButtonStyle(tipoFiltroBiker === 'dia')} onClick={() => setTipoFiltroBiker('dia')}>
                  <Icon name="calendar" size={16} style={{ marginRight: '6px' }} /> Un solo día
                  </button>
                <button style={filterButtonStyle(tipoFiltroBiker === 'rango')} onClick={() => setTipoFiltroBiker('rango')}>
                  <Icon name="calendar" size={16} style={{ marginRight: '6px' }} /> Rango de fechas
                  </button>
                </div>

                {tipoFiltroBiker === 'dia' && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: cuentasTheme.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="calendar" size={16} /> Desde:
                      </label>
                    <input
                      type="date"
                        value={fechaDiariaBiker}
                      onChange={(e) => setFechaDiariaBiker(e.target.value)}
                        className="form-input"
                        style={{
                          padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid #d1d5db',
                          fontSize: '14px',
                        width: '200px',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                )}

                {tipoFiltroBiker === 'rango' && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: cuentasTheme.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="calendar" size={16} /> Desde:
                      </label>
                    <input
                      type="date"
                        value={fechaInicioBiker}
                        onChange={(e) => setFechaInicioBiker(e.target.value)}
                        className="form-input"
                        style={{
                          padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid #d1d5db',
                          fontSize: '14px',
                      width: '180px',
                      maxWidth: '100%'
                        }}
                      />
                  <label style={{ fontSize: '14px', fontWeight: 600, color: cuentasTheme.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="calendar" size={16} /> Hasta:
                      </label>
                    <input
                      type="date"
                        value={fechaFinBiker}
                        onChange={(e) => setFechaFinBiker(e.target.value)}
                        className="form-input"
                        style={{
                          padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid #d1d5db',
                          fontSize: '14px',
                      width: '180px',
                      maxWidth: '100%'
                        }}
                      />
                      <button
                        onClick={() => {
                          if (fechaInicioBiker && fechaFinBiker && bikersCuentas.length > 0) {
                            calcularCuentasBiker()
                          }
                        }}
                        style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: cuentasTheme.primary,
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer'
                        }}
                      >
                    Calcular
                      </button>
                  </div>
                )}
            </div>
          )

          return (
            <section className="card cuentas-biker-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                      width: '48px',
                      height: '48px',
              borderRadius: '12px',
                      background: '#ecfccb',
                    display: 'flex',
                    alignItems: 'center',
                      justifyContent: 'center',
                      color: cuentasTheme.primary
              }}>
                      <Icon name="bike" size={24} />
                    </div>
                <div>
                      <h2 style={{ margin: 0, fontSize: '24px', color: cuentasTheme.dark, fontWeight: '700' }}>Cuentas Biker</h2>
                      <p style={{ margin: 0, color: cuentasTheme.muted, fontSize: '14px' }}>
                        Pagos y entregas sincronizados con Google Sheets
                  </p>
              </div>
                    </div>
                </header>
                
                {renderFiltros()}
            {fechaDiariaBiker && cuentasBikerData && cuentasBikerData.bikers.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '16px', color: cuentasTheme.dark, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="fileText" size={18} /> Detalle de transacciones
                </h3>
                {(() => {
                  const bikersOrdenados = [...cuentasBikerData.bikers].sort((a, b) => 
                    calcularPagoTotalEntregado(b) - calcularPagoTotalEntregado(a)
                  )
                  const filtroNombre = busquedaBiker.trim().toLowerCase()
                  const bikersFiltrados = filtroNombre
                    ? bikersOrdenados.filter(b => b.nombre?.toLowerCase().includes(filtroNombre))
                    : bikersOrdenados
                  const topBikers = bikersOrdenados
                    .filter(biker => calcularPagoTotalEntregado(biker) > 0)
                    .slice(0, 3)
                  
                  return (
                    <>
                      {topBikers.length > 0 && (
                <div style={{
              display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                          marginBottom: '18px'
            }}>
                          {topBikers.map((biker, index) => (
                            <div key={biker.id || index} style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '14px',
                              padding: '14px'
                            }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                                Top #{index + 1}
                </div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: cuentasTheme.dark, margin: '4px 0 8px 0' }}>
                                {biker.nombre}
                </div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: cuentasTheme.primary }}>
                                Bs{calcularPagoTotalEntregado(biker).toFixed(2)}
                      </div>
                              <div style={{ fontSize: '12px', color: cuentasTheme.muted }}>
                                {biker.entregas.filter(entrega => (entrega.estado || '').toLowerCase() === 'entregado').length} entregas
                      </div>
                      </div>
                          ))}
                </div>
                      )}
                
                      <div style={{
                  display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        marginBottom: '12px'
                        }}>
                        <div style={{ flex: '1 1 260px', position: 'relative' }}>
                          <Icon name="search" size={16} color={cuentasTheme.muted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                          <input
                            type="text"
                            placeholder="Buscar biker por nombre..."
                            value={busquedaBiker}
                            onChange={(e) => setBusquedaBiker(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px 10px 36px',
                              borderRadius: '999px',
                              border: '1px solid #e2e8f0',
                              fontSize: '14px',
                              outline: 'none'
                            }}
                          />
                          </div>
                          <button
                          onClick={() => setFiltroEfectivoActivo(prev => !prev)}
                            style={{
                              border: 'none',
                            borderRadius: '999px',
                              padding: '10px 20px',
                            fontWeight: 600,
                              cursor: 'pointer',
                            background: filtroEfectivoActivo ? cuentasTheme.primary : '#e2e8f0',
                            color: filtroEfectivoActivo ? '#fff' : cuentasTheme.dark,
                            boxShadow: filtroEfectivoActivo ? '0 8px 20px rgba(16, 185, 129, 0.25)' : 'none',
                            transition: 'all 0.2s ease'
                            }}
                          >
                          {filtroEfectivoActivo ? 'Efectivo activado' : 'Efectivo'}
                          </button>
                        </div>
                      
                      {bikersFiltrados.length === 0 && (
                <div style={{ 
                          padding: '18px',
                borderRadius: '12px',
                          border: '1px dashed #e2e8f0',
                textAlign: 'center',
                          color: cuentasTheme.muted,
                          marginBottom: '18px'
                        }}>
                          No encontramos bikers con ese nombre.
                        </div>
            )}
                      
                      {bikersFiltrados.map((biker) => {
                      const entregasEntregadas = biker.entregas.filter(entrega => (entrega.estado || '').toLowerCase() === 'entregado')
                      if (entregasEntregadas.length === 0) return null
                      const totalCarrerasEntregadas = entregasEntregadas.reduce((sum, entrega) => {
                        const montoBase = typeof entrega.precio === 'number'
                          ? entrega.precio
                          : parseFloat(entrega.precioBs || entrega.precio || 0)
                        return sum + (isNaN(montoBase) ? 0 : montoBase)
                      }, 0)
                      const totalPagoEntregadas = entregasEntregadas.reduce((sum, entrega) => sum + (entrega.pagoBiker || 0), 0)
                      const totalCarrerasEfectivo = entregasEntregadas.reduce((sum, entrega) => {
                        const metodo = (entrega.metodoPago || '').toLowerCase()
                        if (metodo !== 'efectivo') return sum
                        const monto = typeof entrega.precio === 'number'
                          ? entrega.precio
                          : parseFloat(entrega.precioBs || entrega.precio || 0)
                        return sum + (isNaN(monto) ? 0 : monto)
                      }, 0)
                      const etiquetaTotal = filtroEfectivoActivo ? 'Total efectivo' : 'Total carreras'
                      const montoTotalMostrar = filtroEfectivoActivo ? totalCarrerasEfectivo : totalCarrerasEntregadas
                      
        return (
                      <div key={biker.id} style={{ marginBottom: '28px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff' }}>
            <div style={{ 
                          background: '#d1fae5',
                          color: '#065f46',
                          padding: '18px',
              display: 'flex', 
                          justifyContent: 'space-between',
              alignItems: 'center',
                          borderBottom: '1px solid #bef2cf'
            }}>
                          <div style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '36px',
                              height: '36px',
                     borderRadius: '10px',
                              background: '#10b981',
                     color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Icon name="bike" size={18} />
                            </span>
                            {biker.nombre}
                            </div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{entregasEntregadas.length} entregas</div>
                  </div>

                        <div style={{ overflowX: 'auto', background: '#fff' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                            <colgroup>
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '13%' }} />
                              <col style={{ width: '18%' }} />
                              <col style={{ width: '26%' }} />
                              <col style={{ width: '18%' }} />
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '9%' }} />
                            </colgroup>
                          <thead>
                              <tr style={{ background: cuentasTheme.card, color: cuentasTheme.muted }}>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>ID</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>Método</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>Cliente</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>Ruta</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>Detalles</th>
                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>Distancia</th>
                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>Precio</th>
                            </tr>
                          </thead>
                          <tbody>
                              {entregasEntregadas.map((entrega, idx) => {
                                const metodoNormalizado = (entrega.metodoPago || '').toLowerCase()
                                const esCuenta = metodoNormalizado === 'cuenta' || metodoNormalizado === 'a cuenta' || metodoNormalizado === 'qr'
                                const rowStyle = {
                                  background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                                  transition: 'filter 0.2s ease, opacity 0.2s ease',
                                  ...(filtroEfectivoActivo && esCuenta
                                    ? { opacity: 0.25, filter: 'blur(0.5px)' }
                                    : {})
                                }
                        return (
                                <tr key={entrega.id} style={rowStyle}>
                                  <td style={{ padding: '10px 8px', fontWeight: 600 }}>{entrega.id}</td>
                                  <td style={{ padding: '10px 8px', color: cuentasTheme.dark, fontWeight: 600 }}>
                                    {entrega.metodoPago || 'N/A'}
                                </td>
                                  <td style={{ padding: '10px 8px', fontWeight: 600 }} title={entrega.cliente}>
                                    {truncateText(entrega.cliente, 28)}
                                </td>
                                  <td style={{ padding: '10px 8px', fontSize: '12px', color: cuentasTheme.muted }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {renderLocationLink('Recojo', entrega.recojo, entrega.direccionRecojo)}
                                      {renderLocationLink('Entrega', entrega.entrega, entrega.direccionEntrega)}
                          </div>
                                </td>
                                  <td style={{ padding: '10px 8px' }}>
                                    <div
                                      title={entrega.detallesCarrera || ''}
                                      style={{
                                        fontSize: '12px',
                                        color: cuentasTheme.muted,
                                        display: '-webkit-box',
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: 2,
                                        overflow: 'hidden',
                                        whiteSpace: 'normal',
                                        lineHeight: 1.35,
                                        maxHeight: '2.7em'
                                      }}
                                    >
                                      {entrega.detallesCarrera || ''}
                          </div>
                                </td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>
                                  {entrega.distanciaKm !== 'N/A' ? `${entrega.distanciaKm} km` : 'N/A'}
                                </td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                                    {(() => {
                                      const precioValue = parseFloat(entrega.precio ?? entrega.precioBs ?? 0) || 0
                                      return `Bs${precioValue.toFixed(2)}`
                                    })()}
                                </td>
                              </tr>
                              )})}
                          </tbody>
                            <tfoot>
                              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                <td colSpan={6} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: cuentasTheme.dark }}>
                                  {etiquetaTotal}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: cuentasTheme.primary }}>
                                  Bs{montoTotalMostrar.toFixed(2)}
                                </td>
                              </tr>
                            </tfoot>
                        </table>
                  </div>
                    
                    <div style={{ 
                                  display: 'flex',
                          justifyContent: 'flex-start',
                          padding: '12px',
                          background: cuentasTheme.card,
                          borderTop: '1px solid #e5e7eb',
                          color: cuentasTheme.muted,
                          fontSize: '12px'
                          }}>
                          Resumen generado automáticamente
                                </div>
                              </div>
                    )})}
                    </>
                        )
                })()}
                        </div>
            )}

            {!fechaDiariaBiker && (
                  <div style={{
                      textAlign: 'center', 
                    padding: '60px 30px',
                    borderRadius: '16px',
                    border: '2px dashed #e5e7eb',
                    background: cuentasTheme.card
              }}>
                    <Icon name="calendar" size={36} color={cuentasTheme.primary} />
                    <h3 style={{ marginTop: '16px', marginBottom: '8px', color: cuentasTheme.dark }}>Selecciona una fecha</h3>
                    <p style={{ color: cuentasTheme.muted }}>Elige un día o rango para ver los pagos pendientes.</p>
                            </div>
            )}
                
            {fechaDiariaBiker && cuentasBikerData && cuentasBikerData.bikers.length === 0 && (
                        <div style={{
                              textAlign: 'center',
                padding: '40px',
                    borderRadius: '16px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    color: '#9a3412'
                            }}>
                    <Icon name="bike" size={36} color="#ea580c" />
                    <h3 style={{ margin: '12px 0 6px 0' }}>No se encontraron datos</h3>
                    <p>No hay entregas para los filtros seleccionados. Intenta ajustar las fechas.</p>
                            </div>
            )}
                          </div>
          </section>
        )
        }
      case 'dashboard':
                      return (
          <Dashboard 
            orders={orders}
            loadOrdersFromSheet={loadOrdersFromSheet}
            showNotification={showNotification}
          />
        )
      case 'horarios':
        return <Horarios />
      case 'inventario-admin':
        return <InventarioAdmin />
      default:
        return null
    }
  }

  const adminAccess = isAdmin()
  
  // Usuarios permitidos para acceder al Inventario
  const usuariosPermitidosInventario = ['miguel', 'carli', 'ale']
  const tieneAccesoInventario = adminAccess && user && usuariosPermitidosInventario.includes(user.username?.toLowerCase())

  const baseMenuTabs = [
    { key: 'agregar', label: 'Agregar Pedido', icon: 'plusCircle', twoLines: true },
    { key: 'ver', label: 'Ver Pedidos', icon: 'listChecks', twoLines: true },
    { key: 'pedidos-clientes', label: 'Pedidos Clientes', icon: 'smartphone', twoLines: true },
    { key: 'agregar-nuevo', label: 'Agregar Nuevo', icon: 'folderPlus', twoLines: true },
    { key: 'cobros-pagos', label: 'Empresas', icon: 'wallet' },
    { key: 'cuentas-biker', label: 'Cuentas Biker', icon: 'bike', twoLines: true },
    { key: 'inventario-admin', label: 'Inventario', icon: 'layers', requiresAdmin: true, requiresInventarioAccess: true },
    { key: 'dashboard', label: 'Dashboard', icon: 'barChart3', requiresAdmin: true },
    { key: 'horarios', label: 'Horarios', icon: 'clock', requiresAdmin: true }
  ]

  const menuTabs = baseMenuTabs.filter(tab => {
    if (tab.requiresAdmin && !adminAccess) return false
    if (tab.requiresInventarioAccess && !tieneAccesoInventario) return false
    return true
  })

  const handleTabChange = (key) => {
    if (key === 'ver') {
      setActiveTab('ver')
      return
    }
    setActiveTab(key)
  }

  return (
    <div className="orders">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}
      <nav className="tabs enhanced-tabs">
        {menuTabs.map(tab => {
          const isActive = activeTab === tab.key
          const badgeCount = tab.key === 'pedidos-clientes' ? pedidosClientesCount : 0
          return (
        <button 
              key={tab.key}
              className={`tab ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {badgeCount > 0 && (
                <span className="tab-badge">
                  {badgeCount}
                </span>
              )}
              <span className="tab-icon">
                <Icon name={tab.icon} size={18} />
              </span>
              <span className={`tab-label ${tab.twoLines ? 'two-lines' : ''}`}>
                {tab.twoLines && tab.label.includes(' ') ? (() => {
                  const words = tab.label.split(' ')
                  if (words.length === 2) {
                    // Dos palabras: una por línea
                    return (
                      <>
                        <span style={{ display: 'block' }}>{words[0]}</span>
                        <span style={{ display: 'block' }}>{words[1]}</span>
                      </>
                    )
                  } else if (words.length > 2) {
                    // Más de dos palabras: dividir en dos líneas balanceadas
                    const mid = Math.ceil(words.length / 2)
                    const firstLine = words.slice(0, mid).join(' ')
                    const secondLine = words.slice(mid).join(' ')
                    return (
                      <>
                        <span style={{ display: 'block' }}>{firstLine}</span>
                        <span style={{ display: 'block' }}>{secondLine}</span>
                      </>
                    )
                  }
                  return tab.label
                })() : (
                  tab.label
                )}
              </span>
            </button>
          )
        })}
      </nav>
      
      {renderTabContent()}
      
      {/* Modal de Advertencia - Datos Faltantes */}
      <MissingDataModal
        show={missingDataModal.show}
        order={missingDataModal.order}
        onClose={() => setMissingDataModal({ show: false, order: null })}
        onEdit={() => {
                    setEditingOrder(missingDataModal.order)
                    setMissingDataModal({ show: false, order: null })
                    setActiveTab('agregar')
                  }}
      />
      
      {/* Modal de Entrega */}
      {deliveryModal.show && (
        <div className="modal-overlay" onClick={() => setDeliveryModal({ show: false, order: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Marcar como Entregado</h3>
              <button 
                className="modal-close" 
                onClick={() => setDeliveryModal({ show: false, order: null })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>¿Confirmas que el pedido <strong>#{deliveryModal.order?.id}</strong> ha sido entregado?</p>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Hora de llegada del biker:
                </label>
                <input
                  type="time"
                  id="horaLlegada"
                  defaultValue={new Date().toTimeString().slice(0, 5)}
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setDeliveryModal({ show: false, order: null })}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={() => {
                    const horaFin = document.getElementById('horaLlegada').value
                    handleStatusChange(deliveryModal.order.id, 'Entregado', { hora_fin: horaFin })
                    setDeliveryModal({ show: false, order: null })
                  }}
                >
                  ✅ Confirmar Entrega
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelación */}
      {cancelModal.show && (
        <div className="modal-overlay" onClick={() => setCancelModal({ show: false, order: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>❌ Cancelar Pedido</h3>
              <button 
                className="modal-close" 
                onClick={() => setCancelModal({ show: false, order: null })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>¿Confirmas que quieres cancelar el pedido <strong>#{cancelModal.order?.id}</strong>?</p>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Motivo de cancelación:
                </label>
                <textarea
                  id="observacionesCancelacion"
                  placeholder="Describe el motivo de la cancelación..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setCancelModal({ show: false, order: null })}
                >
                  No Cancelar
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => {
                    const observaciones = document.getElementById('observacionesCancelacion').value
                    handleStatusChange(cancelModal.order.id, 'Cancelado', { observaciones: observaciones })
                    setCancelModal({ show: false, order: null })
                  }}
                >
                  ❌ Confirmar Cancelación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {editModal.show && (
        <div className="modal-overlay" onClick={() => setEditModal({ show: false, order: null })}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Editar Pedido #{editModal.order?.id}</h3>
              <button 
                className="modal-close" 
                onClick={() => setEditModal({ show: false, order: null })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <EditOrderForm
                order={editModal.order}
                onComplete={(updatedOrder) => {
                  handleOrderEdit(updatedOrder)
                  setEditModal({ show: false, order: null })
                }}
                onCancel={() => setEditModal({ show: false, order: null })}
                calculateDistanceWrapper={calculateDistanceWrapper}
                showNotification={showNotification}
                empresas={empresas}
                currentOperador={operadorDefault}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resumen de Carrera */}
      {summaryModal.show && (
        <div className="modal-overlay" onClick={() => setSummaryModal({ show: false, order: null })}>
          <div className="modal-content summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Resumen de Carrera #{summaryModal.order?.id}</h3>
              <button 
                className="modal-close" 
                onClick={() => setSummaryModal({ show: false, order: null })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {summaryModal.order && (
                <div className="order-summary">
                  {/* Información General */}
                  <div className="summary-section">
                    <h4>📋 Información General</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <label>ID del Pedido:</label>
                        <span>#{summaryModal.order.id}</span>
                      </div>
                      <div className="summary-item">
                        <label>Estado:</label>
                        <span className={`status-${summaryModal.order.estado?.toLowerCase()}`}>
                          {summaryModal.order.estado || summaryModal.order['Estado'] || 'N/A'}
                        </span>
                      </div>
                      <div className="summary-item">
                        <label>Fecha:</label>
                        <span>{summaryModal.order.fecha || summaryModal.order['Fecha Registro'] || summaryModal.order['Fechas'] || 'N/A'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Hora Registro:</label>
                        <span>{summaryModal.order.hora_registro || summaryModal.order['Hora Registro'] || 'N/A'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Operador:</label>
                        <span>{summaryModal.order.operador || summaryModal.order['Operador'] || 'N/A'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Servicio:</label>
                        <span>{summaryModal.order.servicio || summaryModal.order['Servicio'] || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Información del Cliente */}
                  <div className="summary-section">
                    <h4>👤 Información del Cliente</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <label>Cliente:</label>
                        <span>{summaryModal.order.cliente || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Método de Pago:</label>
                        <span>{summaryModal.order.metodo_pago || 'No especificado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Información de la Ruta */}
                  <div className="summary-section">
                    <h4>🛣️ Información de la Ruta</h4>
                    <div className="summary-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="summary-item">
                        <label>Punto de Recojo:</label>
                        <span>{summaryModal.order.recojo || summaryModal.order['Recojo'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Dirección Recojo:</label>
                        <span style={{ wordBreak: 'break-all' }}>{summaryModal.order.direccion_recojo || summaryModal.order['Direccion Recojo'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Info. Adicional Recojo:</label>
                        <span>{summaryModal.order.info_direccion_recojo || summaryModal.order['Info. Adicional Recojo'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Punto de Entrega:</label>
                        <span>{summaryModal.order.entrega || summaryModal.order['Entrega'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Dirección Entrega:</label>
                        <span style={{ wordBreak: 'break-all' }}>{summaryModal.order.direccion_entrega || summaryModal.order['Direccion Entrega'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Info. Adicional Entrega:</label>
                        <span>{summaryModal.order.info_direccion_entrega || summaryModal.order['Info. Adicional Entrega'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Medio de Transporte:</label>
                        <span>{summaryModal.order.medio_transporte || summaryModal.order['Medio Transporte'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Biker Asignado:</label>
                        <span>{summaryModal.order.biker || summaryModal.order['Biker'] || 'No asignado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Información Financiera */}
                  <div className="summary-section">
                    <h4>💰 Información Financiera</h4>
                    <div className="summary-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className="summary-item">
                        <label>Distancia:</label>
                        <span>{summaryModal.order.distancia_km || summaryModal.order['Dist. [Km]'] || '0'} km</span>
                      </div>
                      <div className="summary-item">
                        <label>Precio Carrera:</label>
                        <span>Bs {summaryModal.order.precio_bs || summaryModal.order['Precio [Bs]'] || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Método de Pago:</label>
                        <span>{summaryModal.order.metodo_pago || summaryModal.order['Método pago'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Estado de Pago:</label>
                        <span>{summaryModal.order.estado_pago || summaryModal.order['Estado de pago'] || 'No especificado'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Cobro o Pago:</label>
                        <span>{summaryModal.order.cobro_pago || summaryModal.order['Cobro o pago'] || 'N/A'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Monto Cobro/Pago:</label>
                        <span>{summaryModal.order.monto_cobro_pago || summaryModal.order['Monto cobro o pago'] ? `Bs ${summaryModal.order.monto_cobro_pago || summaryModal.order['Monto cobro o pago']}` : 'N/A'}</span>
                      </div>
                      <div className="summary-item full-width">
                        <label>Descripción de Cobro/Pago:</label>
                        <span>{summaryModal.order.descripcion_cobro_pago || summaryModal.order['Descripcion de cobro o pago'] || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Información de Tiempos */}
                  <div className="summary-section">
                    <h4>⏰ Información de Tiempos</h4>
                    <div className="summary-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="summary-item">
                        <label>Hora de Inicio:</label>
                        <span>{summaryModal.order.hora_ini || summaryModal.order['Hora Ini'] || 'No registrada'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Hora de Fin:</label>
                        <span>{summaryModal.order.hora_fin || summaryModal.order['Hora Fin'] || 'No registrada'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Duración:</label>
                        <span>{summaryModal.order.duracion || summaryModal.order['Duracion'] || 'N/A'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Tiempo de Espera:</label>
                        <span>{summaryModal.order.tiempo_espera || summaryModal.order['Tiempo de espera'] || 'N/A'}</span>
                      </div>
                      <div className="summary-item">
                        <label>Día de la Semana:</label>
                        <span>{summaryModal.order.dia_semana || summaryModal.order['Dia de la semana'] || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Detalles Adicionales */}
                  {summaryModal.order.detalles_carrera && (
                    <div className="summary-section">
                      <h4>📝 Detalles de la Carrera</h4>
                      <div className="summary-item full-width">
                        <p>{summaryModal.order.detalles_carrera}</p>
                      </div>
                    </div>
                  )}

                  {/* Observaciones */}
                  {summaryModal.order.observaciones && (
                    <div className="summary-section">
                      <h4>📋 Observaciones</h4>
                      <div className="summary-item full-width">
                        <p>{summaryModal.order.observaciones}</p>
                      </div>
                    </div>
                  )}

                  {/* Motivo de Cancelación */}
                  {summaryModal.order.estado === 'Cancelado' && summaryModal.order.motivo_cancelacion && (
                    <div className="summary-section">
                      <h4>❌ Motivo de Cancelación</h4>
                      <div className="summary-item full-width">
                        <p>{summaryModal.order.motivo_cancelacion}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setSummaryModal({ show: false, order: null })}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Duplicación */}
      {duplicateModal.show && (
        <div className="modal-overlay" onClick={() => !duplicateModal.isDuplicating && setDuplicateModal({ show: false, order: null, selectedDates: [], isDuplicating: false })}>
          <div className="modal-content duplicate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Duplicar Pedido #{duplicateModal.order?.id}</h3>
              <button 
                className="modal-close" 
                onClick={() => setDuplicateModal({ show: false, order: null, selectedDates: [], isDuplicating: false })}
                disabled={duplicateModal.isDuplicating}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: '#6c757d' }}>
                Este pedido será duplicado para las fechas que selecciones. Cada copia tendrá un ID único y automático.
              </p>
              
              {duplicateModal.order && (
                <div className="duplicate-info" style={{ 
                  background: '#f8f9fa', 
                  padding: '12px', 
                  borderRadius: '4px', 
                  marginBottom: '16px',
                  border: '1px solid #dee2e6'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '8px', fontSize: '14px', color: '#495057' }}>
                    📦 Datos del pedido original:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                    <div><strong>Cliente:</strong> {duplicateModal.order.cliente}</div>
                    <div><strong>Biker:</strong> {duplicateModal.order.biker}</div>
                    <div><strong>Recojo:</strong> {duplicateModal.order.recojo}</div>
                    <div><strong>Entrega:</strong> {duplicateModal.order.entrega}</div>
                    <div><strong>Precio:</strong> Bs {duplicateModal.order.precio_bs}</div>
                    <div><strong>Transporte:</strong> {duplicateModal.order.medio_transporte}</div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontWeight: 'bold', marginBottom: '12px', display: 'block' }}>
                  📅 Selecciona las fechas para duplicar:
                </label>
                
                {/* Calendario con selección múltiple */}
                <div style={{
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  padding: '12px',
                  backgroundColor: 'white',
                  marginBottom: '12px'
                }}>
                  <MultiDateCalendar
                    selectedDates={duplicateModal.selectedDates}
                    onDateSelect={handleCalendarDateSelect}
                    minDate={getBoliviaDateISO()}
                  />
                </div>
                
                {duplicateModal.selectedDates.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                      Fechas seleccionadas ({duplicateModal.selectedDates.length}):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {duplicateModal.selectedDates.map(date => (
                        <div 
                          key={date}
                          style={{
                            background: '#28a745',
                            color: '#495057',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px'
                          }}
                        >
                          <span>{new Date(date + 'T00:00:00').toLocaleDateString('es-BO', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}</span>
                          <button
                            onClick={() => {
                              setDuplicateModal(prev => ({
                                ...prev,
                                selectedDates: prev.selectedDates.filter(d => d !== date)
                              }))
                            }}
                            disabled={duplicateModal.isDuplicating}
                            style={{
                              background: 'rgba(255,255,255,0.3)',
                              border: 'none',
                              color: '#495057',
                              cursor: 'pointer',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {duplicateModal.selectedDates.length > 0 && (
                <div style={{ 
                  background: '#d1ecf1', 
                  border: '1px solid #bee5eb',
                  borderRadius: '4px',
                  padding: '12px',
                  marginTop: '16px',
                  color: '#0c5460'
                }}>
                  <strong>ℹ️ Resumen:</strong> Se crearán {duplicateModal.selectedDates.length} pedido(s) nuevo(s) con IDs únicos automáticos.
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setDuplicateModal({ show: false, order: null, selectedDates: [], isDuplicating: false })}
                disabled={duplicateModal.isDuplicating}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-success" 
                onClick={() => duplicateOrder(duplicateModal.order, duplicateModal.selectedDates)}
                disabled={duplicateModal.selectedDates.length === 0 || duplicateModal.isDuplicating}
                style={{
                  opacity: duplicateModal.selectedDates.length === 0 ? 0.5 : 1,
                  cursor: duplicateModal.selectedDates.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {duplicateModal.isDuplicating ? '⏳ Duplicando...' : `✅ Duplicar (${duplicateModal.selectedDates.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Éxito de Duplicación */}
      {duplicateSuccessModal.show && (
        <div className="modal-overlay" onClick={() => setDuplicateSuccessModal({ show: false, count: 0, lastDate: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ background: '#28a745', color: 'white', borderRadius: '8px 8px 0 0' }}>
              <h3 style={{ margin: 0, color: 'white' }}>✅ Duplicación Completada</h3>
              <button 
                className="modal-close" 
                onClick={() => setDuplicateSuccessModal({ show: false, count: 0, lastDate: null })}
                style={{ color: 'white', fontSize: '24px' }}
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h4 style={{ margin: '0 0 12px 0', color: '#28a745', fontSize: '20px' }}>
                  {duplicateSuccessModal.count} pedido(s) duplicado(s) exitosamente
                </h4>
                <p style={{ margin: '0 0 16px 0', color: '#6c757d', fontSize: '16px', lineHeight: '1.5' }}>
                  Los pedidos han sido guardados en Google Sheets y la vista ha sido cambiada a la fecha <strong>{duplicateSuccessModal.lastDate ? formatDateForDisplay(duplicateSuccessModal.lastDate) : ''}</strong>.
                </p>
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffc107', 
                  borderRadius: '6px', 
                  padding: '16px',
                  marginTop: '20px'
                }}>
                  <p style={{ margin: 0, color: '#856404', fontSize: '15px', fontWeight: '500' }}>
                    ⚠️ <strong>Por favor revise</strong> los pedidos duplicados en el kanban para verificar que todo esté correcto.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setDuplicateSuccessModal({ show: false, count: 0, lastDate: null })}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#218838'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#28a745'}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showAvailabilityModal && (
        <div
          className="modal-overlay"
          style={{ backdropFilter: 'blur(3px)' }}
          onClick={closeAvailabilityModal}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '960px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '20px',
              padding: '32px',
              background: '#f8fafc'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#0f172a' }}>
                  <Icon name="calendar" size={24} />
                  <h3 style={{ margin: 0, fontSize: '22px' }}>Disponibilidad de hoy · {availabilityData?.label || (availabilityType === 'drivers' ? 'Drivers' : 'Bikers')}</h3>
                </div>
                <p style={{ marginTop: '6px', marginBottom: 0, color: '#475569', fontSize: '14px' }}>
                  {availabilityData?.day
                    ? new Date(availabilityData.date).toLocaleDateString('es-BO', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })
                    : 'Revisando horarios en Google Sheets...'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('horarios')
                    closeAvailabilityModal()
                  }}
                  style={{
                    border: '1px solid #cbd5f5',
                    background: '#fff',
                    color: '#0f172a',
                    borderRadius: '999px',
                    padding: '10px 18px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Ver todo el módulo
                </button>
                <button
                  type="button"
                  onClick={closeAvailabilityModal}
                  style={{
                    border: 'none',
                    background: '#0f172a',
                    color: '#fff',
                    borderRadius: '999px',
                    padding: '10px 18px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {availabilityLoading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔄</div>
                Consultando Google Sheets...
              </div>
            )}

            {!availabilityLoading && availabilityError && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', padding: '24px', color: '#991b1b' }}>
                <strong>Ups!</strong> {availabilityError}
              </div>
            )}

            {!availabilityLoading && !availabilityError && (
              (() => {
                const drivers = (availabilityData?.drivers || []).filter(driver => driver.worksToday && (driver.slotsToday?.length || driver.autoToday))
                if (!drivers.length) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5f5' }}>
                      <Icon name="alert-triangle" size={32} color="#f97316" />
                      <p style={{ marginTop: '12px', color: '#475569' }}>
                        No encontramos horarios con "X" para hoy. Pide a los {availabilityData?.label?.toLowerCase() || (availabilityType === 'drivers' ? 'drivers' : 'bikers')} que actualicen el sheet.
                      </p>
                    </div>
                  )
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                    {drivers.map((driver) => (
                      <div
                        key={driver.driver}
                        style={{
                          background: '#fff',
                          borderRadius: '18px',
                          padding: '20px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 12px 20px rgba(15, 23, 42, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{driver.driver}</p>
                            <small style={{ color: '#64748b' }}>{driver.autoToday ? `Auto: ${driver.autoToday}` : 'Sin auto asignado'}</small>
                          </div>
                          <span
                            style={{
                              padding: '6px 12px',
                              borderRadius: '999px',
                              background: driver.availableNow ? '#dcfce7' : '#fef3c7',
                              color: driver.availableNow ? '#166534' : '#a16207',
                              fontWeight: 600,
                              fontSize: '12px',
                              alignSelf: 'flex-start',
                              display: 'inline-flex',
                              flexDirection: driver.availableNow ? 'row' : 'column',
                              gap: driver.availableNow ? '0' : '2px',
                              textAlign: 'center',
                              lineHeight: driver.availableNow ? '1' : '1.1',
                              minWidth: driver.availableNow ? undefined : '72px',
                              justifyContent: 'center'
                            }}
                          >
                            {driver.availableNow ? (
                              'Disponible ahora'
                            ) : driver.nextSlot ? (
                              <>
                                <span style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Desde</span>
                                <span style={{ fontSize: '13px', fontWeight: 700 }}>{driver.nextSlot}</span>
                              </>
                            ) : (
                              'Sin turnos pendientes'
                            )}
                          </span>
                        </div>

                        {driver.workingDays?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {driver.workingDays.map(day => (
                              <span
                                key={`${driver.driver}-${day}`}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: day === availabilityData?.day ? '#e0f2fe' : '#f1f5f9',
                                  color: '#0f172a'
                                }}
                              >
                                {getDayInitial(day)}
                              </span>
                            ))}
                          </div>
                        )}

                        {driver.slotsToday?.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {mergeTimeSlots(driver.slotsToday).map(slot => (
                              <span
                                key={`${driver.driver}-${slot}`}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '10px',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#0f172a'
                                }}
                              >
                                {slot}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>El calendario indica que hoy descansa.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
          </div>
        </div>
      )}
      
      {/* Modal de éxito */}
      <SuccessModal />
      
      {/* Modal de advertencia para ASIGNAR BIKER */}
      <AssignBikerWarningModal />

      {/* Estilos CSS para el modal de resumen */}
      <style>{`
        .summary-modal {
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .order-summary {
          padding: 20px;
        }
        
        .summary-section {
          margin-bottom: 25px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #28a745;
        }
        
        .summary-section h4 {
          margin: 0 0 15px 0;
          color: #28a745;
          font-size: 16px;
          font-weight: bold;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        
        .summary-item.full-width {
          grid-column: 1 / -1;
        }
        
        .summary-item label {
          font-weight: bold;
          color: #495057;
          font-size: 12px;
          text-transform: uppercase;
        }
        
        .summary-item span {
          color: #212529;
          font-size: 14px;
        }
        
        .summary-item p {
          margin: 0;
          color: #212529;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .status-pendiente {
          color: #ffc107;
          font-weight: bold;
        }
        
        .status-en-carrera {
          color: #17a2b8;
          font-weight: bold;
        }
        
        .status-entregado {
          color: #28a745;
          font-weight: bold;
        }
        
        .status-cancelado {
          color: #dc3545;
          font-weight: bold;
        }
      `}</style>
      
      {/* Modal de Error de Distancia */}
      {showDistanceErrorModal && (
        <div className="modal-overlay" onClick={() => setShowDistanceErrorModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div className="modal-header">
              <h3>⚠️ Error al Calcular Distancia</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowDistanceErrorModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{
                backgroundColor: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#856404' }}>
                  🔗 ¿Revisa los links?
                </p>
              </div>
              
              <p style={{ marginBottom: '15px', fontSize: '15px', lineHeight: '1.6', color: '#495057' }}>
                No se pudo calcular la distancia entre los puntos de recojo y entrega. Por favor verifica que:
              </p>
              
              <ul style={{ 
                marginBottom: '20px', 
                paddingLeft: '20px', 
                fontSize: '14px',
                lineHeight: '1.8',
                color: '#495057'
              }}>
                <li>Los links de Google Maps sean válidos y estén completos</li>
                <li>Los links no estén concatenados o malformados</li>
                <li>Las direcciones existan y sean accesibles</li>
              </ul>
              
              {/* Mostrar error de la terminal */}
              {lastDistanceError && (
                <div style={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  padding: '15px',
                  marginBottom: '20px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <label style={{ 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      color: '#495057',
                      margin: 0
                    }}>
                      Error de la terminal:
                    </label>
                    <button
                      onClick={() => {
                        const errorText = lastDistanceError.fullError || JSON.stringify(lastDistanceError, null, 2)
                        navigator.clipboard.writeText(errorText).then(() => {
                          showNotification('✅ Error copiado al portapapeles', 'success')
                        }).catch(() => {
                          showNotification('❌ Error al copiar', 'error')
                        })
                      }}
                      style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <pre style={{
                    backgroundColor: '#212529',
                    color: '#f8f9fa',
                    padding: '12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    overflowX: 'auto',
                    margin: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {lastDistanceError.fullError || JSON.stringify(lastDistanceError, null, 2)}
                  </pre>
                </div>
              )}
              
              <div style={{
                backgroundColor: '#e7f3ff',
                border: '1px solid #b3d9ff',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#004085' }}>
                  💡 <strong>Tip:</strong> Puedes ingresar la distancia manualmente en el campo de distancia si los links no funcionan.
                </p>
              </div>
              
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowDistanceErrorModal(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botones flotantes */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
      }}>
        {/* Botón flotante de Timer */}
        <button
          onClick={() => setShowTimerModal(true)}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)'
          }}
          title="Timer / Recordatorio"
        >
          ⏰
        </button>

        {/* Botón flotante de Cotización */}
        <button
          onClick={() => setShowCotizacionModal(true)}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--brand)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)'
          }}
          title="Cotización rápida"
        >
          💰
        </button>

        {/* Botón flotante de Cerrar Turno */}
        <button
          onClick={() => setShowCerrarTurnoModal(true)}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)'
          }}
          title="Cerrar turno"
        >
          📊
        </button>

        {/* Botón flotante de Notas del Equipo */}
        <NotesFloatingButton />
      </div>
      
      {/* Modal de Cotización */}
      <CotizacionModal
        isOpen={showCotizacionModal}
        onClose={() => setShowCotizacionModal(false)}
        onCrearCarrera={handleCrearCarreraDesdeCotizacion}
      />

      {/* Modal de Timer */}
      <TimerModal
        isOpen={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        onIniciarTimer={iniciarTimer}
        timerActivo={timerActivo}
        tiempoRestante={tiempoRestante}
        formatearTiempo={formatearTiempo}
        onDetenerTimer={detenerTimer}
        mensajeTimer={mensajeTimer}
      />

      {/* Modal de Cerrar Turno */}
      {showCerrarTurnoModal && (
        <CerrarTurnoModal
          orders={orders}
          operador={operadorDefault}
          onClose={() => setShowCerrarTurnoModal(false)}
        />
      )}

      {/* Alerta del Timer cuando llega el tiempo */}
      {mostrarAlerta && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
            animation: 'fadeIn 0.3s ease',
          }}
          onClick={cerrarAlerta}
        >
          <div
            style={{
              backgroundColor: 'var(--panel)',
              borderRadius: '16px',
              padding: '40px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              border: '3px solid var(--brand)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>
              🔔
            </div>
            <h2
              style={{
                margin: '0 0 16px 0',
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'var(--text)',
              }}
            >
              Recordatorio
            </h2>
            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '16px',
                color: 'var(--text)',
                lineHeight: '1.6',
              }}
            >
              {mensajeTimer || '⏰ ¡Tiempo completado!'}
            </p>
            <button
              onClick={cerrarAlerta}
              style={{
                padding: '12px 32px',
                backgroundColor: 'var(--brand)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
