/**
 * Utilidades para el modal de novedades
 */

const NOVEDADES_KEY = 'pedidos_novedades_v1'

/**
 * Verifica si debe mostrarse el modal de novedades
 * @returns {boolean} true si debe mostrarse, false en caso contrario
 */
export const shouldShowNovedades = () => {
  return !localStorage.getItem(NOVEDADES_KEY)
}

export { NOVEDADES_KEY }

