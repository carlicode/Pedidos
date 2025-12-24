import dotenv from 'dotenv';
dotenv.config();

// Probar las importaciones
console.log('🔍 Probando importaciones...');

try {
  const { getUserByUsername } = await import('./utils/dynamodb.js');
  console.log('✅ dynamodb.js importado');
  
  const { getJwtSecret } = await import('./utils/secrets.js');
  console.log('✅ secrets.js importado');
  
  // Probar obtener usuario
  console.log('\n🔍 Probando obtener usuario...');
  const user = await getUserByUsername('hogarvitaminas');
  console.log('Usuario encontrado:', user ? 'Sí' : 'No');
  
  if (user) {
    console.log('Username:', user.username);
    console.log('Role:', user.role);
    console.log('Active:', user.active);
  }
  
  // Probar obtener secreto
  console.log('\n🔍 Probando obtener JWT secret...');
  const secret = await getJwtSecret();
  console.log('Secret obtenido:', secret ? 'Sí' : 'No');
  console.log('Secret length:', secret ? secret.length : 0);
  
  console.log('\n✅ Todas las pruebas pasaron');
  
} catch (error) {
  console.error('\n❌ Error en las pruebas:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

