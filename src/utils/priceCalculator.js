/**
 * Calculadora de precios para pedidos
 * Calcula el precio basado en la distancia y el medio de transporte
 */

/**
 * Calcula el precio base para Bicicleta según la distancia
 * @param {number} dist - Distancia en kilómetros
 * @returns {number} Precio base en Bs
 */
const calculateBicicletaPrice = (dist) => {
  if (dist <= 1) return 8
  if (dist <= 2) return 10
  if (dist <= 3) return 12
  if (dist <= 4) return 14
  if (dist <= 5) return 16
  if (dist <= 6) return 18
  if (dist <= 7) return 20
  if (dist <= 8) return 22
  if (dist <= 9) return 24
  if (dist <= 10) return 26
  
  // Para distancias mayores a 10km: 26 Bs + 2 Bs por km adicional
  const kmAdicionales = Math.ceil(dist - 10)
  return 26 + (kmAdicionales * 2)
}

/**
 * Calcula el precio base para BeeZero según la distancia
 * @param {number} dist - Distancia en kilómetros
 * @returns {number} Precio base en Bs
 */
const calculateBeezeroPrice = (dist) => {
  if (dist <= 1) return 10
  if (dist <= 2) return 12
  if (dist <= 3) return 14
  if (dist <= 4) return 16
  if (dist <= 5) return 18
  if (dist <= 6) return 20
  if (dist <= 7) return 22
  if (dist <= 8) return 24
  if (dist <= 9) return 26
  if (dist <= 10) return 28
  
  // Para distancias mayores a 10km: 28 Bs + 2 Bs por km adicional
  const kmAdicionales = Math.ceil(dist - 10)
  return 28 + (kmAdicionales * 2)
}

/**
 * Calcula el precio basado en distancia y medio de transporte
 * @param {number|string} distance - Distancia en kilómetros
 * @param {string} medioTransporte - Medio de transporte (Bicicleta, Cargo, Scooter, Beezero)
 * @returns {number} Precio calculado en Bs (0 si no hay cálculo automático para Scooter)
 */
export const calculatePrice = (distance, medioTransporte) => {
  if (!distance || distance === '' || isNaN(parseFloat(distance))) {
    return 0
  }
  
  const dist = parseFloat(distance)
  let basePrice = 0
  
  // Esquema de precios para Bicicleta (COSTOS TRANSPARENTES)
  if (medioTransporte === 'Bicicleta') {
    basePrice = calculateBicicletaPrice(dist)
  } 
  // Esquema de precios para BeeZero (inicia en 10 Bs)
  else if (medioTransporte === 'Beezero') {
    basePrice = calculateBeezeroPrice(dist)
  }
  // Esquema de precios para Cargo: Bicicleta + 6 Bs
  else if (medioTransporte === 'Cargo') {
    const precioBicicleta = calculateBicicletaPrice(dist)
    basePrice = precioBicicleta + 6
  }
  // Para Scooter no se calcula precio automáticamente
  else if (medioTransporte === 'Scooter') {
    return 0 // Retorna 0 para indicar que no hay cálculo automático
  }
  // Si no coincide con ningún medio conocido, retornar 0
  else {
    return 0
  }
  
  return basePrice
}

