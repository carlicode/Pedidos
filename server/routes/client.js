import express from 'express';
import { google } from 'googleapis';
import { verifyToken, requireCliente } from '../middleware/auth.js';
import { getUserByUsername } from '../utils/dynamodb.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Variables de entorno (leerlas cuando se necesiten, no al cargar el módulo)
function getSheetId() {
  return process.env.SHEET_ID || '1a8M19WHhfM2SWKSiWbTIpVU76gdAFCJ9uv7y0fnPA4g';
}

function getInventarioSheetId() {
  return process.env.INVENTARIO_SHEET_ID || '';
}

function getServiceAccountFile() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '../beezero-62dea82962da.json';
}

function getPort() {
  return process.env.PORT || 5055;
}

// Helper para autenticar con Google Sheets
function getAuthClient() {
  let creds = null;
  
  const SERVICE_ACCOUNT_FILE = getServiceAccountFile();
  
  // Resolver ruta del service account (desde server/routes/ hacia la raíz)
  let serviceAccountPath;
  if (SERVICE_ACCOUNT_FILE.startsWith('..')) {
    // Si es relativa, resolver desde server/routes/ -> server/ -> raíz
    // __dirname = /Users/.../Pedidos/server/routes
    // Necesitamos: /Users/.../Pedidos/beezero-62dea82962da.json
    serviceAccountPath = path.join(__dirname, '..', '..', SERVICE_ACCOUNT_FILE.replace(/^\.\.\//, ''));
  } else {
    serviceAccountPath = SERVICE_ACCOUNT_FILE;
  }
  
  console.log(`🔍 Buscando service account en: ${serviceAccountPath}`);
  
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Archivo de service account no encontrado: ${serviceAccountPath}`);
  }
  
  const raw = fs.readFileSync(serviceAccountPath, 'utf8');
  creds = JSON.parse(raw);
  
  const jwt = new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  );
  
  return jwt;
}

// Helper para escapar nombres de pestañas
function quoteSheet(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

// Aplicar autenticación a todas las rutas
router.use(verifyToken);
router.use(requireCliente);

/**
 * GET /api/client/orders
 * Obtiene pedidos del cliente autenticado
 * Filtra por empresa del usuario autenticado
 */
router.get('/orders', async (req, res) => {
  try {
    const { empresa, username } = req.user;
    
    console.log(`📦 Cliente ${username} (${empresa}) solicitando pedidos`);

    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(500).json({
        success: false,
        error: 'SHEET_ID no configurado',
      });
    }

    // Autenticar con Google Sheets
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    const clientesSheetName = 'Clientes';
    const quotedClientes = quoteSheet(clientesSheetName);
    const range = `${quotedClientes}!A:AD`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range,
    });

    const rows = response.data.values || [];
    console.log(`📋 Filas obtenidas de pestaña Clientes: ${rows.length}`);

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        headers: [],
        count: 0,
        message: 'No hay datos en la pestaña Clientes',
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Convertir a objetos y filtrar por cliente
    const allData = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    // Filtrar solo pedidos del cliente autenticado
    const pedidosCliente = allData.filter((pedido) => {
      const clientePedido = pedido.Cliente || pedido.cliente || '';
      // Comparar con empresa o username
      return (
        clientePedido === empresa ||
        clientePedido === username ||
        clientePedido.toLowerCase() === empresa?.toLowerCase() ||
        clientePedido.toLowerCase() === username?.toLowerCase()
      );
    });

    console.log(`✅ ${pedidosCliente.length} pedidos encontrados para ${empresa} (de ${allData.length} totales)`);

    res.json({
      success: true,
      data: pedidosCliente,
      headers: headers,
      count: pedidosCliente.length,
      empresa: empresa,
    });
  } catch (error) {
    console.error('❌ Error obteniendo pedidos del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos',
      details: error.message,
    });
  }
});

/**
 * GET /api/client/inventario
 * Obtiene inventario del cliente autenticado
 * Usa la pestaña (sheetTab) del usuario autenticado
 */
router.get('/inventario', async (req, res) => {
  try {
    const { username } = req.user;

    console.log(`📦 Cliente ${username} solicitando inventario`);

    // Obtener datos completos del usuario desde DynamoDB para tener sheetTab
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    if (!user.sheetTab) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no tiene pestaña de inventario asignada',
      });
    }

    const INVENTARIO_SHEET_ID = getInventarioSheetId();
    if (!INVENTARIO_SHEET_ID) {
      return res.status(500).json({
        success: false,
        error: 'INVENTARIO_SHEET_ID no configurado en el servidor',
      });
    }

    // Autenticar con Google Sheets
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Verificar que la pestaña existe
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: INVENTARIO_SHEET_ID,
      });
      const sheetNames = spreadsheet.data.sheets.map((s) => s.properties.title);
      console.log(`📋 Pestañas disponibles en el sheet: ${sheetNames.join(', ')}`);
      console.log(`🔍 Buscando pestaña: "${user.sheetTab}"`);

      if (!sheetNames.includes(user.sheetTab)) {
        return res.status(404).json({
          success: false,
          error: 'Pestaña de inventario no encontrada',
          details: `La pestaña "${user.sheetTab}" no existe. Pestañas disponibles: ${sheetNames.join(', ')}`,
          availableSheets: sheetNames,
        });
      }
    } catch (checkError) {
      console.warn('⚠️ No se pudo verificar pestañas, continuando...', checkError.message);
    }

    // Leer datos de la pestaña del cliente (escapar nombre de pestaña)
    const quotedSheetTab = quoteSheet(user.sheetTab);
    const range = `${quotedSheetTab}!A1:L100`;
    console.log(`📋 Leyendo rango: ${range} del sheet ${INVENTARIO_SHEET_ID}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTARIO_SHEET_ID,
      range: range,
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        sheetTab: user.sheetTab,
        empresa: user.empresa,
      });
    }

    // La primera fila contiene los encabezados
    const headers = rows[0];
    console.log(`📊 Encabezados encontrados: ${headers.join(', ')}`);

    // Encontrar índices de columnas relevantes
    const fotoColumnIndex = headers.findIndex((h) =>
      h && (h.toLowerCase().includes('foto') || h.toLowerCase().includes('photo'))
    );
    const urlImagenColumnIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes('url_imagen') ||
          h.toLowerCase().includes('url imagen') ||
          h.toLowerCase().includes('imagen_url'))
    );

    // Convertir filas en objetos
    const productos = rows.slice(1).map((row, index) => {
      const producto = {};
      headers.forEach((header, i) => {
        producto[header] = row[i] || '';
      });

      // Prioridad: usar url_imagen si existe, sino usar Foto
      let imagenUrl = null;

      // 1. Intentar usar url_imagen
      if (urlImagenColumnIndex >= 0 && row[urlImagenColumnIndex]) {
        const urlValue = row[urlImagenColumnIndex].trim();
        if (urlValue) {
          // Convertir URL de Google Drive a formato directo si es necesario
          if (urlValue.includes('drive.google.com')) {
            let driveId = null;
            const match1 = urlValue.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match1) driveId = match1[1];
            if (!driveId) {
              const match2 = urlValue.match(/[?&]id=([a-zA-Z0-9_-]+)/);
              if (match2) driveId = match2[1];
            }
            if (!driveId) {
              const match3 = urlValue.match(/\/d\/([a-zA-Z0-9_-]+)/);
              if (match3) driveId = match3[1];
            }
            if (driveId) {
              const PORT = getPort();
              const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
              imagenUrl = `${backendUrl}/api/proxy-image?url=${encodeURIComponent(urlValue)}`;
            } else {
              imagenUrl = urlValue;
            }
          } else if (
            urlValue.startsWith('http://') ||
            urlValue.startsWith('https://')
          ) {
            imagenUrl = urlValue;
          }
        }
      }

      // 2. Si no hay url_imagen, intentar usar Foto
      if (!imagenUrl && fotoColumnIndex >= 0 && row[fotoColumnIndex]) {
        const fotoValue = row[fotoColumnIndex].trim();
        if (
          fotoValue &&
          (fotoValue.startsWith('http://') || fotoValue.startsWith('https://'))
        ) {
          imagenUrl = fotoValue;
        }
      }

      // Asignar la URL encontrada a la columna Foto
      if (imagenUrl && fotoColumnIndex >= 0) {
        producto[headers[fotoColumnIndex]] = imagenUrl;
      }

      producto._rowNumber = index + 2;
      return producto;
    }).filter((p) => p.Producto); // Filtrar filas vacías

    console.log(`✅ ${productos.length} productos encontrados para ${user.empresa}`);

    res.json({
      success: true,
      data: productos,
      sheetTab: user.sheetTab,
      empresa: user.empresa,
    });
  } catch (error) {
    console.error('❌ Error obteniendo inventario:', error);
    console.error('Error message:', error.message);
    console.error('SheetTab usado:', user.sheetTab);
    console.error('Range usado:', `${quotedSheetTab}!A1:L100`);

    // Verificar si es error de pestaña no encontrada
    if (
      error.message.includes('Unable to parse range') ||
      error.message.includes('Unable to parse') ||
      error.response?.data?.error?.message?.includes('Unable to parse')
    ) {
      return res.status(404).json({
        success: false,
        error: 'Pestaña de inventario no encontrada',
        details: `La pestaña "${user.sheetTab}" no existe en el sheet. Verifica que el nombre coincida exactamente.`,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al obtener inventario',
      details: error.message,
    });
  }
});

export default router;

