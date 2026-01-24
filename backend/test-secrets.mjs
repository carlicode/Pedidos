#!/usr/bin/env node
/**
 * Script para verificar que todos los secretos de AWS estén configurados correctamente
 */

import { getSecrets } from './utils/secrets.js';

async function testSecrets() {
  console.log('🔐 Verificando secretos de AWS Secrets Manager...\n');
  
  try {
    const secrets = await getSecrets();
    
    console.log('✅ Conexión exitosa a AWS Secrets Manager\n');
    console.log('📋 Secretos disponibles:');
    
    const secretKeys = Object.keys(secrets).sort();
    secretKeys.forEach(key => {
      const value = secrets[key];
      const hasValue = value && value !== '';
      const status = hasValue ? '✅' : '⚠️';
      
      // Ocultar valores sensibles, solo mostrar primeros caracteres
      let displayValue = '';
      if (key.includes('SECRET') || key.includes('KEY') || key.includes('JSON')) {
        displayValue = hasValue ? `${value.substring(0, 10)}...` : 'vacío';
      } else {
        displayValue = hasValue ? value : 'vacío';
      }
      
      console.log(`  ${status} ${key}: ${displayValue}`);
    });
    
    console.log('\n📊 Resumen:');
    console.log(`  Total de secretos: ${secretKeys.length}`);
    console.log(`  Secretos configurados: ${secretKeys.filter(k => secrets[k] && secrets[k] !== '').length}`);
    
    // Verificar secretos críticos
    console.log('\n🔍 Verificando secretos críticos:');
    const criticalSecrets = [
      'JWT_SECRET',
      'GOOGLE_MAPS_API_KEY',
      'GOOGLE_SERVICE_ACCOUNT_JSON',
      'DYNAMODB_TABLE_NAME'
    ];
    
    let allCriticalConfigured = true;
    criticalSecrets.forEach(key => {
      const hasValue = secrets[key] && secrets[key] !== '';
      const status = hasValue ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${hasValue ? 'Configurado' : 'FALTA'}`);
      if (!hasValue) allCriticalConfigured = false;
    });
    
    if (allCriticalConfigured) {
      console.log('\n✅ Todos los secretos críticos están configurados correctamente!');
      process.exit(0);
    } else {
      console.log('\n❌ Faltan secretos críticos. El backend no funcionará correctamente.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo secretos de AWS:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

testSecrets();
