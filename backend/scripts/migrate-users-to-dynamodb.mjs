#!/usr/bin/env node

/**
 * Script para migrar usuarios del archivo users.js a DynamoDB
 * 
 * Este script:
 * 1. Lee usuarios del archivo frontend/src/data/users.js
 * 2. Hashea las contraseñas con bcrypt
 * 3. Los guarda en DynamoDB con estado activo
 * 
 * Uso:
 *   node backend/scripts/migrate-users-to-dynamodb.mjs
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar DynamoDB
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'pedidos-users';

// Usuarios hardcodeados (copiados de frontend/src/data/users.js)
const users = [
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
];

async function checkExistingUsers() {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        Select: 'COUNT',
      })
    );
    return result.Count || 0;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.error('❌ Tabla DynamoDB no encontrada:', TABLE_NAME);
      console.error('   Crea la tabla primero o verifica el nombre en la variable DYNAMODB_TABLE_NAME');
      return -1;
    }
    throw error;
  }
}

async function migrateUsers() {
  console.log('🔄 Iniciando migración de usuarios a DynamoDB...\n');

  // Verificar si hay usuarios existentes
  const existingCount = await checkExistingUsers();
  
  if (existingCount === -1) {
    process.exit(1);
  }

  if (existingCount > 0) {
    console.log(`⚠️  La tabla ya contiene ${existingCount} usuarios.`);
    console.log('   ¿Deseas continuar? Esto puede crear duplicados.');
    console.log('   Presiona Ctrl+C para cancelar, o continúa en 5 segundos...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log(`📊 Usuarios a migrar: ${users.length}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      console.log(`  Procesando: ${user.username} (${user.role})...`);

      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Preparar item para DynamoDB
      const item = {
        id: user.id,
        username: user.username.toLowerCase(), // Normalizar a minúsculas
        password: hashedPassword,
        name: user.name,
        role: user.role,
        email: user.email,
        active: true, // Por defecto todos activos
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Agregar campos opcionales solo para clientes
      if (user.empresa) {
        item.empresa = user.empresa;
      }
      if (user.sheetTab) {
        item.sheetTab = user.sheetTab;
      }

      // Guardar en DynamoDB
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );

      console.log(`  ✅ ${user.username} migrado exitosamente`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Error migrando ${user.username}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n✨ Migración completada:');
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📊 Total: ${users.length}`);

  if (errorCount === 0) {
    console.log('\n🎉 Todos los usuarios fueron migrados correctamente!');
    console.log('   Ahora puedes eliminar el archivo frontend/src/data/users.js');
  }
}

// Ejecutar migración
migrateUsers().catch((error) => {
  console.error('❌ Error fatal en la migración:', error);
  process.exit(1);
});
