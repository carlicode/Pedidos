/**
 * Constantes y arrays de opciones para el módulo de pedidos
 * Valores fijos que se usan en múltiples partes de la aplicación
 */

// Métodos de pago disponibles
export const METODOS_PAGO = ['Efectivo', 'Cuenta', 'A cuenta', 'QR', 'Cortesía']

// Estados de pago disponibles
export const ESTADOS_PAGO = [
  'Debe Cliente',
  'Pagado',
  'QR Verificado',
  'Debe Biker',
  'Error Admin',
  'Error Biker',
  'Espera',
  'Sin Biker'
]

// Medios de transporte disponibles
export const MEDIOS_TRANSPORTE = ['Bicicleta', 'Cargo', 'Scooter', 'Beezero']

// Estados de pedido disponibles
export const ESTADOS = ['Pendiente', 'En carrera', 'Entregado', 'Cancelado']

// Tipos de cobro/pago
export const TIPOS_COBRO_PAGO = ['', 'Cobro', 'Pago']

// Servicios disponibles
export const SERVICIOS = ['Beezy', 'Bee Zero']

// Días de la semana
export const DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
]

// Buffer de distancia: 0.25 cuadras = 25 metros = 0.025 km
// Se agrega a las distancias calculadas como margen de error para percances
export const DISTANCE_BUFFER_KM = 0.025

