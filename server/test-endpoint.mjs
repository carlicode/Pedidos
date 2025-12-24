import dotenv from 'dotenv';
dotenv.config();

// Simular una request de login
const testLogin = async () => {
  try {
    console.log('🔍 Probando flujo completo de login...\n');
    
    const username = 'hogarvitaminas';
    const password = 'Hgr#Vtm2024$xK9';
    
    // 1. Obtener usuario
    const { getUserByUsername } = await import('./utils/dynamodb.js');
    console.log('1️⃣ Obteniendo usuario de DynamoDB...');
    const user = await getUserByUsername(username);
    
    if (!user) {
      console.error('❌ Usuario no encontrado');
      return;
    }
    console.log('✅ Usuario encontrado:', user.username);
    
    // 2. Verificar contraseña
    const bcrypt = await import('bcryptjs');
    console.log('2️⃣ Verificando contraseña...');
    const isValid = await bcrypt.default.compare(password, user.password);
    
    if (!isValid) {
      console.error('❌ Contraseña incorrecta');
      return;
    }
    console.log('✅ Contraseña válida');
    
    // 3. Obtener JWT secret
    const { getJwtSecret } = await import('./utils/secrets.js');
    console.log('3️⃣ Obteniendo JWT secret...');
    const secret = await getJwtSecret();
    console.log('✅ Secret obtenido');
    
    // 4. Generar token
    const jwt = await import('jsonwebtoken');
    console.log('4️⃣ Generando JWT token...');
    const token = jwt.default.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        empresa: user.empresa || null,
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    console.log('✅ Token generado');
    console.log('\n📋 Resultado:');
    console.log({
      success: true,
      token: token.substring(0, 50) + '...',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        empresa: user.empresa,
      }
    });
    
    console.log('\n✅ Login simulado exitoso!');
    
  } catch (error) {
    console.error('\n❌ Error en el flujo:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
};

testLogin();

