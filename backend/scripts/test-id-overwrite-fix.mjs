#!/usr/bin/env node

/**
 * Script de prueba para verificar el fix del bug de sobrescritura de IDs
 * 
 * Este script:
 * 1. Crea dos pedidos de prueba
 * 2. Intenta editar uno enviando un ID diferente (el bug)
 * 3. Verifica que el backend lo previno correctamente
 * 4. Limpia los pedidos de prueba
 * 
 * Uso:
 *   node test-id-overwrite-fix.mjs
 *   node test-id-overwrite-fix.mjs --backend-url http://localhost:3000
 */

import fetch from 'node-fetch'

const BACKEND_URL = process.argv.find(a => a.startsWith('--backend-url='))
  ? process.argv.find(a => a.startsWith('--backend-url=')).slice(15)
  : 'http://localhost:3000'

console.log('🧪 Test: Verificación del fix de sobrescritura de IDs')
console.log('📡 Backend URL:', BACKEND_URL)
console.log('')

let testId1, testId2

async function createTestOrder(cliente) {
  const order = {
    Cliente: cliente,
    Operador: 'Test Script',
    Recojo: 'Dirección Test',
    Entrega: 'Dirección Test 2',
    Estado: 'Pendiente',
    'Precio [Bs]': '20',
    'Dist. [Km]': '5'
  }
  
  const res = await fetch(`${BACKEND_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  })
  
  if (!res.ok) {
    throw new Error(`Error al crear pedido: ${res.status}`)
  }
  
  const data = await res.json()
  return data
}

async function attemptIdOverwrite(urlId, bodyId) {
  console.log(`\n🎯 Intento de sobrescritura:`)
  console.log(`   URL: PUT /api/orders/${urlId}`)
  console.log(`   Body ID: ${bodyId}`)
  
  const res = await fetch(`${BACKEND_URL}/api/orders/${urlId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ID: bodyId,
      Cliente: 'INTENTO DE SOBRESCRITURA',
      Estado: 'En carrera'
    })
  })
  
  const data = await res.json()
  return { status: res.status, data }
}

async function getOrder(id) {
  const res = await fetch(`${BACKEND_URL}/api/read-orders`)
  if (!res.ok) return null
  
  const data = await res.json()
  return data.data.find(o => String(o.id) === String(id))
}

async function deleteOrder(id) {
  // No hay endpoint DELETE, marcar como cancelado
  await fetch(`${BACKEND_URL}/api/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ID: id,
      Estado: 'Cancelado',
      Cliente: '[TEST ELIMINADO]'
    })
  })
}

async function runTest() {
  try {
    // Paso 1: Crear dos pedidos de prueba
    console.log('📝 Paso 1: Creando pedidos de prueba...')
    
    const order1 = await createTestOrder('Test Pedido A')
    testId1 = order1.id || order1.ID || 'unknown'
    console.log(`✅ Pedido A creado con ID: ${testId1}`)
    
    const order2 = await createTestOrder('Test Pedido B')
    testId2 = order2.id || order2.ID || 'unknown'
    console.log(`✅ Pedido B creado con ID: ${testId2}`)
    
    // Esperar un poco para que se guarden
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Paso 2: Verificar que se crearon correctamente
    console.log('\n📝 Paso 2: Verificando creación...')
    const verifyA = await getOrder(testId1)
    const verifyB = await getOrder(testId2)
    
    if (!verifyA) throw new Error(`No se encontró pedido ${testId1}`)
    if (!verifyB) throw new Error(`No se encontró pedido ${testId2}`)
    
    console.log(`✅ Pedido ${testId1}: ${verifyA.Cliente}`)
    console.log(`✅ Pedido ${testId2}: ${verifyB.Cliente}`)
    
    // Paso 3: Intentar el bug (editar testId2 pero enviar testId1 en el body)
    console.log('\n📝 Paso 3: Intentando reproducir el bug...')
    console.log(`🚨 Editando pedido ${testId2} pero enviando ID ${testId1} en el body`)
    
    const result = await attemptIdOverwrite(testId2, testId1)
    
    console.log(`\n📊 Resultado del servidor:`)
    console.log(`   Status: ${result.status}`)
    console.log(`   Response:`, JSON.stringify(result.data, null, 2))
    
    // Esperar un poco para que se actualice
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Paso 4: Verificar que el fix funcionó
    console.log('\n📝 Paso 4: Verificando que el fix funcionó...')
    
    const checkA = await getOrder(testId1)
    const checkB = await getOrder(testId2)
    
    console.log(`\n🔍 Estado después del intento de sobrescritura:`)
    console.log(`   Pedido ${testId1}: ${checkA ? checkA.Cliente : 'NO ENCONTRADO ❌'}`)
    console.log(`   Pedido ${testId2}: ${checkB ? checkB.Cliente : 'NO ENCONTRADO ❌'}`)
    
    // Verificar resultados
    let testPassed = true
    let errors = []
    
    // El pedido A NO debe haber sido modificado
    if (!checkA || checkA.Cliente !== 'Test Pedido A') {
      testPassed = false
      errors.push(`❌ Pedido ${testId1} fue modificado (NO DEBERÍA)`)
    } else {
      console.log(`✅ Pedido ${testId1} NO fue modificado (correcto)`)
    }
    
    // El pedido B debe existir y tener el cliente modificado pero con ID correcto
    if (!checkB) {
      testPassed = false
      errors.push(`❌ Pedido ${testId2} desapareció`)
    } else if (String(checkB.id) !== String(testId2)) {
      testPassed = false
      errors.push(`❌ Pedido ${testId2} cambió su ID a ${checkB.id} (BUG NO RESUELTO)`)
    } else if (checkB.Cliente !== 'INTENTO DE SOBRESCRITURA') {
      testPassed = false
      errors.push(`❌ Pedido ${testId2} no se actualizó correctamente`)
    } else {
      console.log(`✅ Pedido ${testId2} se actualizó pero mantuvo su ID (correcto)`)
    }
    
    // Verificar que no haya IDs duplicados
    const allOrders = await fetch(`${BACKEND_URL}/api/read-orders`).then(r => r.json())
    const ids = allOrders.data.map(o => o.id)
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
    
    if (duplicates.length > 0) {
      testPassed = false
      errors.push(`❌ Se detectaron IDs duplicados: ${duplicates.join(', ')}`)
    } else {
      console.log(`✅ No hay IDs duplicados`)
    }
    
    // Resultado final
    console.log('\n═══════════════════════════════════════')
    if (testPassed) {
      console.log('🎉 ✅ TEST PASÓ - El fix está funcionando correctamente')
      console.log('   - El ID no se sobrescribió')
      console.log('   - No hay IDs duplicados')
      console.log('   - Los datos se actualizaron correctamente')
    } else {
      console.log('❌ TEST FALLÓ - El bug persiste o hay otros problemas')
      errors.forEach(err => console.log(`   ${err}`))
    }
    console.log('═══════════════════════════════════════')
    
    return testPassed
    
  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message)
    console.error(error.stack)
    return false
  } finally {
    // Limpiar pedidos de prueba
    console.log('\n🧹 Limpiando pedidos de prueba...')
    if (testId1) {
      await deleteOrder(testId1)
      console.log(`✅ Pedido ${testId1} marcado para limpieza`)
    }
    if (testId2) {
      await deleteOrder(testId2)
      console.log(`✅ Pedido ${testId2} marcado para limpieza`)
    }
  }
}

// Ejecutar test
runTest().then(passed => {
  process.exit(passed ? 0 : 1)
}).catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
