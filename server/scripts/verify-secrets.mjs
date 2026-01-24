#!/usr/bin/env node
/**
 * Script de verificación: Prueba que los secretos de AWS funcionan correctamente
 */

import { getSecrets } from '../utils/secrets.js'

console.log('🧪 Verificando carga de secretos desde AWS...\n')

try {
  const secrets = await getSecrets()
  
  console.log('✅ Secretos cargados exitosamente')
  console.log('\n📋 Secretos disponibles:')
  
  const keys = Object.keys(secrets)
  keys.forEach(key => {
    if (key.includes('SECRET') || key.includes('KEY') || key.includes('PRIVATE')) {
      console.log(`   ✓ ${key}: [OCULTO]`)
    } else if (key === 'GOOGLE_SERVICE_ACCOUNT_JSON') {
      console.log(`   ✓ ${key}: [JSON - ${secrets[key].length} caracteres]`)
    } else {
      const value = String(secrets[key])
      if (value.length > 50) {
        console.log(`   ✓ ${key}: ${value.substring(0, 50)}...`)
      } else {
        console.log(`   ✓ ${key}: ${value}`)
      }
    }
  })
  
  console.log(`\n📊 Total: ${keys.length} secretos`)
  
  // Verificar secretos críticos
  console.log('\n🔍 Verificando secretos críticos:')
  const critical = ['GOOGLE_MAPS_API_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON']
  let allPresent = true
  
  critical.forEach(key => {
    if (secrets[key]) {
      console.log(`   ✅ ${key}: Presente`)
    } else {
      console.log(`   ❌ ${key}: FALTA`)
      allPresent = false
    }
  })
  
  if (allPresent) {
    console.log('\n✅ Todos los secretos críticos están presentes')
    console.log('🚀 El sistema está listo para producción')
  } else {
    console.log('\n⚠️  Faltan algunos secretos críticos')
    process.exit(1)
  }
  
} catch (error) {
  console.error('\n❌ Error verificando secretos:')
  console.error(error.message)
  console.error('\n💡 Asegúrate de que:')
  console.error('   1. AWS CLI está configurado')
  console.error('   2. Tienes permisos para acceder a Secrets Manager')
  console.error('   3. El secreto "pedidos/prod/all-secrets" existe')
  process.exit(1)
}
