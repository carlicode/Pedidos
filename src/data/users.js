// Base de datos de usuarios del sistema
export const users = [
  // Operadores
  {
    id: 1,
    username: 'ana',
    password: 'ana8392',
    name: 'Ana',
    role: 'operador',
    email: 'ana@pedidos.com'
  },
  {
    id: 2,
    username: 'fabri',
    password: 'fabri5167',
    name: 'Fabri',
    role: 'operador',
    email: 'fabri@pedidos.com'
  },
  {
    id: 3,
    username: 'migue',
    password: 'migue9483',
    name: 'Miguel',
    role: 'operador',
    email: 'migue@pedidos.com'
  },
  {
    id: 4,
    username: 'paul',
    password: 'paul3572',
    name: 'Paul',
    role: 'operador',
    email: 'paul@pedidos.com'
  },
  // Administradores
  {
    id: 5,
    username: 'miguel',
    password: 'miguel3847',
    name: 'Miguel',
    role: 'admin',
    email: 'miguel@pedidos.com'
  },
  {
    id: 6,
    username: 'andi',
    password: 'andi5921',
    name: 'Andi',
    role: 'admin',
    email: 'andi@pedidos.com'
  },
  {
    id: 7,
    username: 'ale',
    password: 'ale7264',
    name: 'Ale',
    role: 'admin',
    email: 'ale@pedidos.com'
  },
  {
    id: 8,
    username: 'carli',
    password: 'carli1859',
    name: 'Carli',
    role: 'admin',
    email: 'carli@pedidos.com'
  },
  {
    id: 9,
    username: 'paulo',
    password: 'paulo4638',
    name: 'Paulo',
    role: 'admin',
    email: 'paulo@pedidos.com'
  },
  {
    id: 10,
    username: 'admin',
    password: 'admin2745',
    name: 'Admin',
    role: 'admin',
    email: 'admin@pedidos.com'
  },
  // Clientes
  {
    id: 11,
    username: 'hogarvitaminas',
    password: 'Hgr#Vtm2024$xK9',
    name: 'El Hogar de las vitaminas',
    role: 'cliente',
    email: 'contacto@hogarvitaminas.com',
    empresa: 'El Hogar de las vitaminas',
    sheetTab: 'Hogar de las vitaminas'
  },
  {
    id: 12,
    username: 'impotadorazurich',
    password: 'Zrch!2024@Mp7Lq',
    name: 'Impotadora Zurich',
    role: 'cliente',
    email: 'contacto@impotadorazurich.com',
    empresa: 'Impotadora Zurich',
    sheetTab: 'Impotadora Zurich'
  },
  {
    id: 13,
    username: 'qhathu',
    password: 'Qht#2024&Px5Wn',
    name: 'Qhathu',
    role: 'cliente',
    email: 'contacto@qhathu.com',
    empresa: 'Qhathu',
    sheetTab: 'Qhathu'
  },
  {
    id: 14,
    username: 'saludybelleza',
    password: 'Sld$Blz2024#Rt8',
    name: 'Salud y belleza',
    role: 'cliente',
    email: 'contacto@saludybelleza.com',
    empresa: 'Salud y belleza',
    sheetTab: 'Salud y belleza'
  },
  {
    id: 15,
    username: 'puntodepartida',
    password: 'Pnt@Dpt2024!Jm4',
    name: 'Punto de partida',
    role: 'cliente',
    email: 'contacto@puntodepartida.com',
    empresa: 'Punto de partida',
    sheetTab: 'Punto de partida'
  },
  {
    id: 16,
    username: 'sandrasantuza',
    password: 'Snd!Snz2024$Vk6',
    name: 'Sandra santuza',
    role: 'cliente',
    email: 'contacto@sandrasantuza.com',
    empresa: 'Sandra santuza',
    sheetTab: 'Sandra santuza'
  },
  {
    id: 17,
    username: 'rollingfruts',
    password: 'Rll#Frt2024@Bm3',
    name: 'Rolling Fruts',
    role: 'cliente',
    email: 'contacto@rollingfruts.com',
    empresa: 'Rolling Fruts',
    sheetTab: 'Rolling Fruts'
  }
]

/**
 * Autentica un usuario con username y password
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Object|null} - Usuario sin password o null si no es válido
 */
export const authenticateUser = (username, password) => {
  const user = users.find(u => 
    u.username.toLowerCase() === username.toLowerCase() && 
    u.password === password
  )
  
  if (user) {
    // No devolver la contraseña por seguridad
    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }
  
  return null
}

/**
 * Obtiene un usuario por username
 * @param {string} username - Nombre de usuario
 * @returns {Object|null} - Usuario sin password o null si no existe
 */
export const getUserByUsername = (username) => {
  const user = users.find(u => 
    u.username.toLowerCase() === username.toLowerCase()
  )
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }
  
  return null
}

/**
 * Verifica si un usuario es administrador
 * @param {Object} user - Objeto usuario
 * @returns {boolean} - true si es admin
 */
export const isAdmin = (user) => {
  return user && user.role === 'admin'
}

/**
 * Verifica si un usuario es operador
 * @param {Object} user - Objeto usuario
 * @returns {boolean} - true si es operador
 */
export const isOperador = (user) => {
  return user && user.role === 'operador'
}

/**
 * Verifica si un usuario es cliente
 * @param {Object} user - Objeto usuario
 * @returns {boolean} - true si es cliente
 */
export const isCliente = (user) => {
  return user && user.role === 'cliente'
}

/**
 * Obtiene todos los usuarios (sin passwords)
 * @returns {Array} - Array de usuarios sin passwords
 */
export const getAllUsers = () => {
  return users.map(({ password, ...user }) => user)
}

/**
 * Obtiene usuarios por rol
 * @param {string} role - Rol a filtrar
 * @returns {Array} - Array de usuarios del rol especificado
 */
export const getUsersByRole = (role) => {
  return users
    .filter(user => user.role === role)
    .map(({ password, ...user }) => user)
}


