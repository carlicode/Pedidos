#!/usr/bin/env node
/**
 * Script para actualizar secrets.js y soportar múltiples secretos desde AWS
 * Ejecutar DESPUÉS de migrate-secrets-to-aws.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..', '..')

console.log('\n🔧 Actualizando código para usar AWS Secrets Manager')
console.log('━'.repeat(60))

// Nuevo contenido para secrets.js
const newSecretsJs = `import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let cachedSecrets = null;

/**
 * Obtiene todos los secretos desde AWS Secrets Manager
 * Los secretos se cachean para evitar múltiples llamadas
 */
export async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const secretName = process.env.AWS_SECRET_NAME || 'pedidos/prod/all-secrets';

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);
    const secretObject = JSON.parse(response.SecretString);

    cachedSecrets = secretObject;
    return cachedSecrets;
  } catch (error) {
    console.error('❌ Error obteniendo secretos de AWS:', error.message);
    throw error;
  }
}

/**
 * Obtiene el JWT Secret (compatibilidad con código existente)
 */
export async function getJwtSecret() {
  const secrets = await getSecrets();
  return secrets.JWT_SECRET;
}

/**
 * Obtiene la API Key de Google Maps
 */
export async function getGoogleMapsApiKey() {
  const secrets = await getSecrets();
  return secrets.GOOGLE_MAPS_API_KEY;
}

/**
 * Obtiene las credenciales de Google Service Account como JSON string
 */
export async function getGoogleServiceAccountJson() {
  const secrets = await getSecrets();
  return secrets.GOOGLE_SERVICE_ACCOUNT_JSON;
}

/**
 * Obtiene las credenciales de Google Service Account como objeto
 */
export async function getGoogleServiceAccount() {
  const json = await getGoogleServiceAccountJson();
  return JSON.parse(json);
}

/**
 * Obtiene un secreto específico por nombre
 */
export async function getSecret(name) {
  const secrets = await getSecrets();
  return secrets[name];
}

/**
 * Limpia el caché (útil para testing)
 */
export function clearCache() {
  cachedSecrets = null;
}
`;

// Actualizar secrets.js
const secretsPath = join(PROJECT_ROOT, 'server', 'utils', 'secrets.js')
console.log('📝 Actualizando:', secretsPath)
writeFileSync(secretsPath, newSecretsJs, 'utf-8')
console.log('✅ secrets.js actualizado')

// Crear backup de index.js
const indexPath = join(PROJECT_ROOT, 'server', 'index.js')
const indexBackupPath = join(PROJECT_ROOT, 'server', 'index.js.backup')
console.log('\n📝 Creando backup de index.js...')
const indexContent = readFileSync(indexPath, 'utf-8')
writeFileSync(indexBackupPath, indexContent, 'utf-8')
console.log('✅ Backup creado:', indexBackupPath)

// Instrucciones para actualizar index.js
console.log('\n━'.repeat(60))
console.log('✅ ACTUALIZACIÓN COMPLETADA')
console.log('━'.repeat(60))
console.log('\n📋 Cambios necesarios en server/index.js:')
console.log('\n1️⃣  Importar funciones de secrets:')
console.log('   Cambiar:')
console.log('     import { getJwtSecret } from "./utils/secrets.js"')
console.log('   Por:')
console.log('     import { getSecrets, getGoogleMapsApiKey, getGoogleServiceAccount } from "./utils/secrets.js"')

console.log('\n2️⃣  Actualizar variables al inicio del archivo:')
console.log('   Cambiar:')
console.log('     const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY')
console.log('     const SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || ...')
console.log('   Por:')
console.log('     let GOOGLE_MAPS_API_KEY = null')
console.log('     let SERVICE_ACCOUNT_CREDENTIALS = null')

console.log('\n3️⃣  Agregar función de inicialización después de las importaciones:')
console.log(`
async function initializeSecrets() {
  try {
    const secrets = await getSecrets()
    GOOGLE_MAPS_API_KEY = secrets.GOOGLE_MAPS_API_KEY
    SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(secrets.GOOGLE_SERVICE_ACCOUNT_JSON)
    console.log('✅ Secretos cargados desde AWS Secrets Manager')
  } catch (error) {
    console.error('❌ Error cargando secretos:', error.message)
    console.log('⚠️  Intentando usar variables de entorno locales...')
    GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
    // Mantener lógica de archivo local como fallback
  }
}
`)

console.log('\n4️⃣  Llamar initializeSecrets() antes de iniciar el servidor:')
console.log(`
// Antes de app.listen():
await initializeSecrets()

app.listen(PORT, () => {
  console.log(\`🚀 Servidor corriendo en puerto \${PORT}\`)
})
`)

console.log('\n5️⃣  Actualizar auth.js para obtener JWT_SECRET:')
console.log('   Ya está usando getJwtSecret() - no requiere cambios')

console.log('\n━'.repeat(60))
console.log('🔄 Próximos pasos:')
console.log('   1. Aplicar los cambios mencionados a server/index.js')
console.log('   2. Probar localmente: npm run server')
console.log('   3. Si funciona, proceder con deploy a AWS Amplify')
console.log('━'.repeat(60))
