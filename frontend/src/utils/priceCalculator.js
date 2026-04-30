/**
 * Calculadora de precios para pedidos
 * Calcula el precio basado en la distancia y el medio de transporte
 */

/**
 * Unifica el valor del medio (SearchableSelect, espacios invisibles, {value}).
 * Exportado por si Orders u otros módulos necesitan comparar.
 */
export function normalizeMedioTransporte(medio) {
  if (medio == null) return ''
  if (typeof medio === 'object' && medio !== null) {
    const v = medio.value ?? medio.label ?? medio.id
    if (v != null && v !== '') {
      return String(v).replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
    }
    return ''
  }
  return String(medio).replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
}

/**
 * Calcula el precio base para Bicicleta según la distancia
 * @param {number} dist - Distancia en kilómetros
 * @returns {number} Precio base en Bs
 */
const calculateBicicletaPrice = (dist) => {
  // Redondear hacia arriba (si es 3.74 km, cobrar 4 km)
  const distRedondeada = Math.ceil(dist)

  if (distRedondeada <= 1) return 8

  // Después del primer km: precio base 8 Bs + 2.5 Bs por cada km adicional
  const kmAdicionales = distRedondeada - 1
  return 8 + (kmAdicionales * 2.5)
}

/**
 * Calcula el precio base para BeeZero (Auto) según la distancia
 * @param {number} dist - Distancia en kilómetros
 * @returns {number} Precio base en Bs
 */
const calculateBeezeroPrice = (dist) => {
  const distRedondeada = Math.ceil(dist)

  if (distRedondeada <= 1) return 10

  const kmAdicionales = distRedondeada - 1
  return 10 + (kmAdicionales * 3)
}

/**
 * Calcula el precio basado en distancia y medio de transporte
 * @param {number|string} distance - Distancia en kilómetros
 * @param {string|object} medioTransporte - Medio de transporte (Bicicleta, Cargo, Scooter, Beezero)
 * @returns {number} Precio calculado en Bs
 */
export const calculatePrice = (distance, medioTransporte) => {
  if (!distance || distance === '' || isNaN(parseFloat(distance))) {
    return 0
  }

  const dist = parseFloat(distance)
  const medio = normalizeMedioTransporte(medioTransporte)
  let basePrice = 0

  if (medio === 'Bicicleta') {
    basePrice = calculateBicicletaPrice(dist)
  } else if (medio === 'Beezero') {
    basePrice = calculateBeezeroPrice(dist)
  } else if (medio === 'Cargo') {
    basePrice = calculateBicicletaPrice(dist) + 6
  } else if (medio === 'Scooter') {
    basePrice = calculateBicicletaPrice(dist)
  } else {
    return 0
  }

  return basePrice
}
