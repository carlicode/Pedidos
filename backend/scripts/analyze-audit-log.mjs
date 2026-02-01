#!/usr/bin/env node

/**
 * Script para analizar el audit log local y detectar:
 * - Todas las carreras creadas
 * - Carreras editadas múltiples veces
 * - Posibles sobrescrituras
 * - Estadísticas generales
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const AUDIT_LOG_PATH = path.join(__dirname, '..', 'logs', 'audit', 'audit-log.json');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function c(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function header(text) {
  console.log('');
  console.log(c('blue', '═'.repeat(80)));
  console.log(c('blue', `  ${text}`));
  console.log(c('blue', '═'.repeat(80)));
}

function subheader(text) {
  console.log('');
  console.log(c('cyan', `━━ ${text}`));
}

/**
 * Cargar audit log
 */
function loadAuditLog() {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) {
      console.error(c('red', `❌ No se encontró el archivo: ${AUDIT_LOG_PATH}`));
      process.exit(1);
    }

    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const logs = JSON.parse(content);
    
    console.log(c('green', `✅ Audit log cargado: ${logs.length} entradas`));
    console.log(c('cyan', `   Archivo: ${AUDIT_LOG_PATH}`));
    
    return logs;
  } catch (error) {
    console.error(c('red', `❌ Error leyendo audit log: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Analizar logs
 */
function analyzeLogs(logs) {
  const stats = {
    totalCreaciones: 0,
    totalEdiciones: 0,
    totalEliminaciones: 0,
    carrerasCreadas: new Set(),
    carrerasEditadas: new Map(), // orderId -> cantidad de ediciones
    operadores: new Map(), // operador -> cantidad de operaciones
    porFecha: new Map(), // fecha -> cantidad de operaciones
    sobrescrituras: [], // posibles sobrescrituras (múltiples CREAR con mismo ID)
    creacionesDuplicadas: new Map(), // orderId -> cantidad de veces creado
    edicionesPorCarrera: new Map(), // orderId -> array de ediciones
    primeraCarrera: null,
    ultimaCarrera: null
  };

  // Procesar cada entrada
  logs.forEach(entry => {
    const { action, orderId, operator, timestamp } = entry;
    const fecha = timestamp.split('T')[0];

    // Contar por acción
    if (action === 'CREAR') {
      stats.totalCreaciones++;
      stats.carrerasCreadas.add(orderId);
      
      // Detectar creaciones duplicadas
      const count = stats.creacionesDuplicadas.get(orderId) || 0;
      stats.creacionesDuplicadas.set(orderId, count + 1);
      
      if (count > 0) {
        stats.sobrescrituras.push({
          orderId,
          operator,
          timestamp,
          count: count + 1
        });
      }

      // Primera y última carrera
      if (!stats.primeraCarrera) {
        stats.primeraCarrera = { orderId, timestamp, operator };
      }
      stats.ultimaCarrera = { orderId, timestamp, operator };

    } else if (action === 'EDITAR') {
      stats.totalEdiciones++;
      
      const editCount = stats.carrerasEditadas.get(orderId) || 0;
      stats.carrerasEditadas.set(orderId, editCount + 1);
      
      // Guardar detalles de edición
      if (!stats.edicionesPorCarrera.has(orderId)) {
        stats.edicionesPorCarrera.set(orderId, []);
      }
      stats.edicionesPorCarrera.get(orderId).push({
        timestamp,
        operator,
        changes: entry.changes || {}
      });

    } else if (action === 'ELIMINAR') {
      stats.totalEliminaciones++;
    }

    // Contar por operador
    const opCount = stats.operadores.get(operator) || 0;
    stats.operadores.set(operator, opCount + 1);

    // Contar por fecha
    const fechaCount = stats.porFecha.get(fecha) || 0;
    stats.porFecha.set(fecha, fechaCount + 1);
  });

  return stats;
}

/**
 * Mostrar resultados
 */
function displayResults(stats, logs) {
  header('📊 ANÁLISIS DEL AUDIT LOG - RESUMEN GENERAL');

  console.log('');
  console.log(c('bright', '  Total de operaciones:'), logs.length);
  console.log(c('green', '  ✓ Carreras CREADAS:'), stats.totalCreaciones);
  console.log(c('yellow', '  ✏ Carreras EDITADAS:'), stats.totalEdiciones);
  console.log(c('red', '  ✗ Carreras ELIMINADAS:'), stats.totalEliminaciones);
  console.log('');
  console.log(c('cyan', '  Carreras únicas creadas:'), stats.carrerasCreadas.size);

  if (stats.primeraCarrera) {
    console.log('');
    console.log(c('bright', '  Primera carrera registrada:'), 
      `#${stats.primeraCarrera.orderId} - ${stats.primeraCarrera.timestamp} - ${stats.primeraCarrera.operator}`);
  }
  
  if (stats.ultimaCarrera) {
    console.log(c('bright', '  Última carrera registrada:'), 
      `#${stats.ultimaCarrera.orderId} - ${stats.ultimaCarrera.timestamp} - ${stats.ultimaCarrera.operator}`);
  }

  // IDs creados
  header('📋 LISTA DE TODAS LAS CARRERAS CREADAS');
  const idsArray = Array.from(stats.carrerasCreadas).map(id => parseInt(id)).sort((a, b) => a - b);
  console.log('');
  console.log(c('cyan', `  Total: ${idsArray.length} carreras`));
  console.log('');
  
  // Mostrar en bloques de 20
  for (let i = 0; i < idsArray.length; i += 20) {
    const chunk = idsArray.slice(i, i + 20);
    console.log('  ' + chunk.join(', '));
  }

  // Detectar huecos en la secuencia
  subheader('🔍 DETECCIÓN DE HUECOS EN SECUENCIA');
  if (idsArray.length > 0) {
    const min = idsArray[0];
    const max = idsArray[idsArray.length - 1];
    const huecos = [];
    
    for (let id = min; id <= max; id++) {
      if (!idsArray.includes(id)) {
        huecos.push(id);
      }
    }
    
    console.log('');
    console.log(c('cyan', `  Rango de IDs: ${min} - ${max}`));
    console.log(c('cyan', `  IDs esperados en el rango: ${max - min + 1}`));
    console.log(c('cyan', `  IDs encontrados: ${idsArray.length}`));
    console.log(c('cyan', `  Huecos detectados: ${huecos.length}`));
    
    if (huecos.length > 0) {
      console.log('');
      console.log(c('yellow', '  ⚠️  IDs faltantes (posibles carreras eliminadas):'));
      console.log('');
      
      // Mostrar en bloques de 20
      for (let i = 0; i < huecos.length; i += 20) {
        const chunk = huecos.slice(i, i + 20);
        console.log('  ' + chunk.join(', '));
      }
    } else {
      console.log('');
      console.log(c('green', '  ✅ No hay huecos en la secuencia. Todas las carreras están presentes.'));
    }
  }

  // Sobrescrituras
  if (stats.sobrescrituras.length > 0) {
    header('⚠️  POSIBLES SOBRESCRITURAS DETECTADAS');
    console.log('');
    console.log(c('red', `  Se encontraron ${stats.sobrescrituras.length} carreras que fueron CREADAS múltiples veces:`));
    console.log('');
    
    stats.sobrescrituras.forEach(item => {
      console.log(c('yellow', `  • Carrera #${item.orderId}`));
      console.log(`    Creada ${item.count} veces`);
      console.log(`    Última vez: ${item.timestamp} por ${item.operator}`);
    });
  } else {
    header('✅ SOBRESCRITURAS');
    console.log('');
    console.log(c('green', '  No se detectaron sobrescrituras. Cada ID fue creado solo una vez.'));
  }

  // Carreras más editadas
  header('✏️  CARRERAS MÁS EDITADAS');
  const masEditadas = Array.from(stats.carrerasEditadas.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (masEditadas.length > 0) {
    console.log('');
    console.log(c('cyan', '  Top 10 carreras con más ediciones:'));
    console.log('');
    
    masEditadas.forEach(([orderId, count]) => {
      console.log(c('yellow', `  • Carrera #${orderId}: ${count} ediciones`));
      
      // Mostrar detalles de las ediciones
      const ediciones = stats.edicionesPorCarrera.get(orderId);
      if (ediciones && ediciones.length > 0) {
        ediciones.forEach((edit, idx) => {
          const changesCount = Object.keys(edit.changes).length;
          console.log(`    ${idx + 1}. ${edit.timestamp} - ${edit.operator} (${changesCount} cambios)`);
        });
      }
    });
  } else {
    console.log('');
    console.log(c('cyan', '  No hay carreras editadas en el log.'));
  }

  // Operadores
  header('👥 ACTIVIDAD POR OPERADOR');
  const operadoresOrdenados = Array.from(stats.operadores.entries())
    .sort((a, b) => b[1] - a[1]);

  console.log('');
  operadoresOrdenados.forEach(([operador, count]) => {
    console.log(c('cyan', `  ${operador}:`), `${count} operaciones`);
  });

  // Por fecha
  header('📅 ACTIVIDAD POR FECHA');
  const fechasOrdenadas = Array.from(stats.porFecha.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  console.log('');
  fechasOrdenadas.forEach(([fecha, count]) => {
    console.log(c('cyan', `  ${fecha}:`), `${count} operaciones`);
  });

  // Resumen final
  header('📝 CONCLUSIONES');
  console.log('');
  
  if (stats.sobrescrituras.length > 0) {
    console.log(c('red', `  ⚠️  Se detectaron ${stats.sobrescrituras.length} posibles sobrescrituras`));
    console.log(c('yellow', '     Revisa las carreras marcadas arriba para más detalles.'));
  } else {
    console.log(c('green', '  ✅ No se detectaron sobrescrituras'));
  }
  
  const huecos = [];
  const idsArray2 = Array.from(stats.carrerasCreadas).map(id => parseInt(id)).sort((a, b) => a - b);
  if (idsArray2.length > 0) {
    const min = idsArray2[0];
    const max = idsArray2[idsArray2.length - 1];
    for (let id = min; id <= max; id++) {
      if (!idsArray2.includes(id)) {
        huecos.push(id);
      }
    }
  }
  
  if (huecos.length > 0) {
    console.log(c('yellow', `  ⚠️  Se detectaron ${huecos.length} huecos en la secuencia de IDs`));
    console.log(c('yellow', '     Estos podrían ser carreras eliminadas del Google Sheet.'));
    console.log(c('cyan', '     Compara estos IDs con el Google Sheet para confirmar.'));
  } else {
    console.log(c('green', '  ✅ No hay huecos en la secuencia de IDs'));
  }
  
  console.log('');
  console.log(c('cyan', '  Para más detalles, revisa el archivo:'));
  console.log(c('cyan', `  ${AUDIT_LOG_PATH}`));
  console.log('');
}

/**
 * Main
 */
function main() {
  console.log(c('bright', '\n🔍 ANÁLISIS DEL AUDIT LOG DE CARRERAS\n'));
  
  const logs = loadAuditLog();
  const stats = analyzeLogs(logs);
  displayResults(stats, logs);
}

main();
