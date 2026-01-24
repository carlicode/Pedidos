/**
 * Constantes centralizadas para el mapeo de columnas de Google Sheets
 * Este archivo es la fuente única de verdad para los nombres de columnas
 * Usado tanto en frontend como en backend para garantizar consistencia
 */

/**
 * Nombres de columnas en Google Sheets
 * IMPORTANTE: Estos nombres deben coincidir EXACTAMENTE con los headers del sheet
 */
export const SHEET_COLUMNS = {
  ID: 'ID',
  FECHA_REGISTRO: 'Fecha Registro',
  HORA_REGISTRO: 'Hora Registro',
  OPERADOR: 'Operador',
  CLIENTE: 'Cliente',
  RECOJO: 'Recojo',
  ENTREGA: 'Entrega',
  DIRECCION_RECOJO: 'Direccion Recojo',
  DIRECCION_ENTREGA: 'Direccion Entrega',
  DETALLES_CARRERA: 'Detalles de la Carrera',
  DISTANCIA_KM: 'Dist. [Km]',
  MEDIO_TRANSPORTE: 'Medio Transporte',
  PRECIO_BS: 'Precio [Bs]',
  METODO_PAGO: 'Método pago pago',
  BIKER: 'Biker',
  WHATSAPP: 'WhatsApp',
  FECHAS: 'Fechas',
  HORA_INI: 'Hora Ini',
  HORA_FIN: 'Hora Fin',
  DURACION: 'Duracion',
  TIEMPO_ESPERA: 'Tiempo de espera',
  ESTADO: 'Estado',
  ESTADO_PAGO: 'Estado de pago',
  OBSERVACIONES: 'Observaciones',
  PAGO_BIKER: 'Pago biker',
  DIA_SEMANA: 'Dia de la semana',
  COBRO_PAGO: 'Cobro o pago',
  MONTO_COBRO_PAGO: 'Monto cobro o pago',
  DESCRIPCION_COBRO_PAGO: 'Descripcion de cobro o pago',
  INFO_ADICIONAL_RECOJO: 'Info. Adicional Recojo',
  INFO_ADICIONAL_ENTREGA: 'Info. Adicional Entrega'
}

/**
 * Mapeo de campos del objeto de pedido a columnas del sheet
 * Usado para transformar los datos del frontend al formato del sheet
 */
export const FIELD_TO_COLUMN = {
  id: SHEET_COLUMNS.ID,
  fecha_registro: SHEET_COLUMNS.FECHA_REGISTRO,
  hora_registro: SHEET_COLUMNS.HORA_REGISTRO,
  operador: SHEET_COLUMNS.OPERADOR,
  cliente: SHEET_COLUMNS.CLIENTE,
  recojo: SHEET_COLUMNS.RECOJO,
  entrega: SHEET_COLUMNS.ENTREGA,
  direccion_recojo: SHEET_COLUMNS.DIRECCION_RECOJO,
  direccion_entrega: SHEET_COLUMNS.DIRECCION_ENTREGA,
  detalles_carrera: SHEET_COLUMNS.DETALLES_CARRERA,
  distancia_km: SHEET_COLUMNS.DISTANCIA_KM,
  medio_transporte: SHEET_COLUMNS.MEDIO_TRANSPORTE,
  precio_bs: SHEET_COLUMNS.PRECIO_BS,
  metodo_pago: SHEET_COLUMNS.METODO_PAGO,
  biker: SHEET_COLUMNS.BIKER,
  whatsapp: SHEET_COLUMNS.WHATSAPP,
  fecha: SHEET_COLUMNS.FECHAS,
  hora_ini: SHEET_COLUMNS.HORA_INI,
  hora_fin: SHEET_COLUMNS.HORA_FIN,
  duracion: SHEET_COLUMNS.DURACION,
  tiempo_espera: SHEET_COLUMNS.TIEMPO_ESPERA,
  estado: SHEET_COLUMNS.ESTADO,
  estado_pago: SHEET_COLUMNS.ESTADO_PAGO,
  observaciones: SHEET_COLUMNS.OBSERVACIONES,
  pago_biker: SHEET_COLUMNS.PAGO_BIKER,
  dia_semana: SHEET_COLUMNS.DIA_SEMANA,
  cobro_pago: SHEET_COLUMNS.COBRO_PAGO,
  monto_cobro_pago: SHEET_COLUMNS.MONTO_COBRO_PAGO,
  descripcion_cobro_pago: SHEET_COLUMNS.DESCRIPCION_COBRO_PAGO,
  info_direccion_recojo: SHEET_COLUMNS.INFO_ADICIONAL_RECOJO,
  info_direccion_entrega: SHEET_COLUMNS.INFO_ADICIONAL_ENTREGA
}

/**
 * Mapeo inverso: de nombre de columna del sheet a nombre de campo del objeto
 * Usado para leer datos del sheet y convertirlos a objetos de pedido
 */
export const COLUMN_TO_FIELD = Object.entries(FIELD_TO_COLUMN).reduce((acc, [field, column]) => {
  acc[column] = field
  return acc
}, {})

/**
 * Lista ordenada de columnas para crear/actualizar filas en el sheet
 * Mantiene el orden correcto de las columnas
 */
export const ORDERED_COLUMNS = [
  SHEET_COLUMNS.ID,
  SHEET_COLUMNS.FECHA_REGISTRO,
  SHEET_COLUMNS.HORA_REGISTRO,
  SHEET_COLUMNS.OPERADOR,
  SHEET_COLUMNS.CLIENTE,
  SHEET_COLUMNS.RECOJO,
  SHEET_COLUMNS.ENTREGA,
  SHEET_COLUMNS.DIRECCION_RECOJO,
  SHEET_COLUMNS.DIRECCION_ENTREGA,
  SHEET_COLUMNS.DETALLES_CARRERA,
  SHEET_COLUMNS.DISTANCIA_KM,
  SHEET_COLUMNS.MEDIO_TRANSPORTE,
  SHEET_COLUMNS.PRECIO_BS,
  SHEET_COLUMNS.METODO_PAGO,
  SHEET_COLUMNS.BIKER,
  SHEET_COLUMNS.WHATSAPP,
  SHEET_COLUMNS.FECHAS,
  SHEET_COLUMNS.HORA_INI,
  SHEET_COLUMNS.HORA_FIN,
  SHEET_COLUMNS.DURACION,
  SHEET_COLUMNS.TIEMPO_ESPERA,
  SHEET_COLUMNS.ESTADO,
  SHEET_COLUMNS.ESTADO_PAGO,
  SHEET_COLUMNS.OBSERVACIONES,
  SHEET_COLUMNS.PAGO_BIKER,
  SHEET_COLUMNS.DIA_SEMANA,
  SHEET_COLUMNS.COBRO_PAGO,
  SHEET_COLUMNS.MONTO_COBRO_PAGO,
  SHEET_COLUMNS.DESCRIPCION_COBRO_PAGO,
  SHEET_COLUMNS.INFO_ADICIONAL_RECOJO,
  SHEET_COLUMNS.INFO_ADICIONAL_ENTREGA
]
