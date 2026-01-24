#!/usr/bin/env node
/**
 * Script para migrar todas las credenciales a AWS Secrets Manager
 * Ejecutar: node server/scripts/migrate-secrets-to-aws.mjs
 */

import { SecretsManagerClient, CreateSecretCommand, UpdateSecretCommand, DescribeSecretCommand } from '@aws-sdk/client-secrets-manager'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..', '..')

// Cargar .env desde server/
const serverEnvPath = join(PROJECT_ROOT, 'server', '.env')
if (existsSync(serverEnvPath)) {
  console.log('📖 Cargando variables de entorno desde:', serverEnvPath)
  dotenv.config({ path: serverEnvPath })
} else {
  console.error('❌ No se encontró server/.env')
  process.exit(1)
}

// Configuración
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const SECRET_NAME = 'pedidos/prod/all-secrets'

console.log('\n🔐 Migración de Secretos a AWS Secrets Manager')
console.log('━'.repeat(60))
console.log(`Región: ${AWS_REGION}`)
console.log(`Nombre del secreto: ${SECRET_NAME}`)
console.log('━'.repeat(60))

const client = new SecretsManagerClient({ region: AWS_REGION })

async function secretExists(secretName) {
  try {
    await client.send(new DescribeSecretCommand({ SecretId: secretName }))
    return true
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false
    }
    throw error
  }
}

async function migrateSecrets() {
  try {
    // 1. Recopilar todas las credenciales
    console.log('\n📋 Paso 1: Recopilando credenciales...\n')
    
    const secrets = {}
    
    // Google Maps API Key
    if (process.env.GOOGLE_MAPS_API_KEY) {
      secrets.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
      console.log('✅ GOOGLE_MAPS_API_KEY encontrada')
    } else {
      console.log('⚠️  GOOGLE_MAPS_API_KEY no encontrada en .env')
    }
    
    // Google Service Account JSON
    // Buscar en múltiples ubicaciones posibles
    const possiblePaths = [
      process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
      join(PROJECT_ROOT, 'beezero-62dea82962da.json'),
      join(PROJECT_ROOT, 'beezero-1d5503cf3b22.json'),
      '/Users/carli.code/Desktop/Pedidos/beezero-62dea82962da.json'
    ].filter(Boolean)
    
    let serviceAccountFile = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        serviceAccountFile = path
        break
      }
    }
    
    console.log('   Rutas intentadas:', possiblePaths)
    console.log('   Archivo encontrado:', serviceAccountFile || 'NINGUNO')
    
    if (serviceAccountFile && existsSync(serviceAccountFile)) {
      const serviceAccountContent = readFileSync(serviceAccountFile, 'utf-8')
      secrets.GOOGLE_SERVICE_ACCOUNT_JSON = serviceAccountContent
      console.log('✅ Google Service Account JSON encontrado y cargado')
    } else {
      console.log('⚠️  Google Service Account JSON NO encontrado')
    }
    
    // Sheet IDs
    const sheetVars = [
      'SHEET_ID',
      'SHEET_NAME',
      'HORARIOS_SHEET_ID',
      'HORARIOS_SHEET_NAME',
      'HORARIOS_BIKERS_SHEET_ID',
      'INVENTARIO_SHEET_ID',
      'HISTORIAL_SHEET_ID',
      'HISTORIAL_SHEET_NAME'
    ]
    
    for (const varName of sheetVars) {
      if (process.env[varName]) {
        secrets[varName] = process.env[varName]
        console.log(`✅ ${varName} encontrada`)
      } else {
        console.log(`⚠️  ${varName} no encontrada en .env`)
      }
    }
    
    // JWT Secret (si existe)
    if (process.env.JWT_SECRET) {
      secrets.JWT_SECRET = process.env.JWT_SECRET
      console.log('✅ JWT_SECRET encontrada')
    } else {
      console.log('ℹ️  JWT_SECRET no encontrada (puede estar ya en AWS)')
    }
    
    // Port y otras configuraciones
    secrets.PORT = process.env.PORT || '5055'
    secrets.AWS_REGION = AWS_REGION
    
    console.log(`\n📊 Total de secretos recopilados: ${Object.keys(secrets).length}`)
    
    // 2. Verificar si el secreto ya existe
    console.log('\n📋 Paso 2: Verificando si el secreto existe en AWS...\n')
    const exists = await secretExists(SECRET_NAME)
    
    if (exists) {
      console.log('ℹ️  El secreto ya existe. Se actualizará.')
    } else {
      console.log('ℹ️  El secreto no existe. Se creará uno nuevo.')
    }
    
    // 3. Crear o actualizar secreto
    console.log('\n📋 Paso 3: Subiendo secretos a AWS Secrets Manager...\n')
    
    const secretString = JSON.stringify(secrets, null, 2)
    
    if (exists) {
      // Actualizar secreto existente
      const updateCommand = new UpdateSecretCommand({
        SecretId: SECRET_NAME,
        SecretString: secretString,
        Description: 'Credenciales completas para aplicación Pedidos (Google Maps, Google Sheets, JWT)'
      })
      
      await client.send(updateCommand)
      console.log('✅ Secreto actualizado exitosamente')
    } else {
      // Crear nuevo secreto
      const createCommand = new CreateSecretCommand({
        Name: SECRET_NAME,
        SecretString: secretString,
        Description: 'Credenciales completas para aplicación Pedidos (Google Maps, Google Sheets, JWT)',
        Tags: [
          { Key: 'Application', Value: 'Pedidos' },
          { Key: 'Environment', Value: 'Production' }
        ]
      })
      
      await client.send(createCommand)
      console.log('✅ Secreto creado exitosamente')
    }
    
    // 4. Resumen
    console.log('\n━'.repeat(60))
    console.log('✅ MIGRACIÓN COMPLETADA')
    console.log('━'.repeat(60))
    console.log('\n📝 Resumen de secretos migrados:')
    Object.keys(secrets).forEach(key => {
      if (key === 'GOOGLE_SERVICE_ACCOUNT_JSON') {
        console.log(`   - ${key}: [JSON Object]`)
      } else if (key.includes('SECRET') || key.includes('KEY')) {
        console.log(`   - ${key}: [OCULTO]`)
      } else {
        console.log(`   - ${key}: ${secrets[key].substring(0, 30)}${secrets[key].length > 30 ? '...' : ''}`)
      }
    })
    
    console.log('\n🔄 Próximos pasos:')
    console.log('   1. Ejecutar: node server/scripts/update-code-for-secrets.mjs')
    console.log('   2. Probar localmente que todo funciona')
    console.log('   3. Configurar Amplify con estas variables de entorno:')
    console.log(`      AWS_REGION=${AWS_REGION}`)
    console.log(`      AWS_SECRET_NAME=${SECRET_NAME}`)
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:')
    console.error(error)
    process.exit(1)
  }
}

// Ejecutar
migrateSecrets()
