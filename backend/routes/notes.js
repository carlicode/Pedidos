import express from 'express';
import { google } from 'googleapis';
import { getSecrets, getGoogleServiceAccountJSON } from '../utils/secrets.js';

const router = express.Router();

/**
 * Variables de entorno - leerlas cuando se necesiten
 */
function getSheetId() {
  return process.env.SHEET_ID || '1a8M19WHhfM2SWKSiWbTIpVU76gdAFCJ9uv7y0fnPA4g';
}

function getSheetName() {
  return process.env.SHEET_NAME || 'Registros';
}

/**
 * Helper para escapar nombres de pestañas con caracteres especiales
 */
function quoteSheet(sheetName) {
  if (sheetName.includes("'")) {
    return `'${sheetName.replace(/'/g, "''")}'`;
  }
  return sheetName;
}

/**
 * Helper para autenticar con Google Sheets usando AWS Secrets Manager
 */
async function getAuthClient() {
  try {
    // Obtener credenciales desde AWS Secrets Manager
    const serviceAccountJSON = await getGoogleServiceAccountJSON();
    
    if (!serviceAccountJSON) {
      throw new Error('Google Service Account JSON no disponible en AWS Secrets Manager');
    }
    
    const creds = JSON.parse(serviceAccountJSON);
    
    // Usar JWT para autenticación
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
  } catch (error) {
    console.error('❌ Error obteniendo auth client:', error.message);
    throw error;
  }
}

/**
 * Obtener fecha actual en zona horaria de Bolivia (DD/MM/YYYY)
 */
function getBoliviaDate() {
  const now = new Date();
  const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  const day = boliviaTime.getDate().toString().padStart(2, '0');
  const month = (boliviaTime.getMonth() + 1).toString().padStart(2, '0');
  const year = boliviaTime.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * GET /api/notes
 * Obtener todas las notas del equipo
 */
router.get('/', async (req, res) => {
  try {
    console.log('📖 Leyendo notas del Google Sheet...');
    
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    const range = `${quotedNotes}!A:H`; // Leer hasta columna H (incluye "Descripción resolución")
    
    console.log('📊 Intentando leer rango:', range);
    
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: range
      });
    } catch (sheetError) {
      // Si la pestaña no existe, devolver un array vacío en lugar de error
      if (sheetError.message && (sheetError.message.includes('Unable to parse range') || sheetError.message.includes('not found'))) {
        console.warn(`⚠️ La pestaña "${notesSheetName}" no existe aún. Retornando array vacío.`);
        return res.json({ notes: [], message: `La pestaña "${notesSheetName}" aún no existe en el Google Sheet. Crea la pestaña con los headers: ID, Estado, Fecha Creación, Operador, Descripción, Resuelto por, Fecha Resolución, Descripción resolución` });
      }
      throw sheetError;
    }
    
    const rows = response.data.values || [];
    console.log('📋 Filas de notas obtenidas:', rows.length);
    
    if (rows.length === 0) {
      return res.json({ notes: [], message: 'No hay notas' });
    }
    
    // La primera fila contiene los headers
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    // Convertir a objetos
    const notes = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        // Normalizar nombre de header
        const normalizedKey = header.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '');
        obj[normalizedKey] = row[index] || '';
        // También mantener el nombre original del header
        obj[header] = row[index] || '';
      });
      return obj;
    }).filter(note => {
      // Filtrar notas vacías (que no tengan ID)
      const id = note.id || note.ID;
      return id && id.toString().trim() !== '';
    });
    
    console.log('✅ Notas procesadas:', notes.length);
    res.json({ 
      notes, 
      count: notes.length,
      message: `${notes.length} notas cargadas` 
    });
    
  } catch (error) {
    console.error('❌ Error leyendo notas:', error);
    res.status(500).json({ 
      error: 'Error leyendo notas del Google Sheet', 
      details: error.message 
    });
  }
});

/**
 * GET /api/notes/pending-count
 * Obtener contador de notas pendientes
 */
router.get('/pending-count', async (req, res) => {
  try {
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    let auth;
    try {
      auth = await getAuthClient();
    await auth.authorize();
    } catch (authError) {
      // Si hay problemas de conectividad (DNS, red, etc.), retornar 0 silenciosamente
      if (authError.code === 'ENOTFOUND' || authError.code === 'ECONNREFUSED' || authError.code === 'ETIMEDOUT') {
        console.warn('⚠️ Sin conexión a internet. Retornando contador 0 para notas pendientes.');
        return res.json({ count: 0 });
      }
      throw authError;
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    const range = `${quotedNotes}!A:E`; // Solo necesitamos hasta Estado
    
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: range
      });
    } catch (sheetError) {
      // Si la pestaña no existe, retornar 0 pendientes
      if (sheetError.message && (sheetError.message.includes('Unable to parse range') || sheetError.message.includes('not found'))) {
        console.warn(`⚠️ La pestaña "${notesSheetName}" no existe aún. Retornando 0 pendientes.`);
        return res.json({ count: 0 });
      }
      // Si hay problemas de conectividad al leer el sheet, retornar 0
      if (sheetError.code === 'ENOTFOUND' || sheetError.code === 'ECONNREFUSED' || sheetError.code === 'ETIMEDOUT') {
        console.warn('⚠️ Sin conexión a Google Sheets. Retornando contador 0.');
        return res.json({ count: 0 });
      }
      throw sheetError;
    }
    
    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.json({ count: 0 });
    }
    
    // Contar notas donde Estado != "Resuelto" y != "Eliminado"
    // Nueva estructura: ID (A), Estado (B), Fecha Creación (C), Operador (D), Descripción (E), Resuelto por (F), Fecha Resolución (G)
    const pendingCount = rows.slice(1).filter(row => {
      const estado = row[1] || ''; // Columna B (índice 1) - Estado
      const id = row[0] || ''; // Columna A (índice 0) - ID
      const estadoLower = estado.toLowerCase();
      return estadoLower !== 'resuelto' && estadoLower !== 'eliminado' && id.toString().trim() !== '';
    }).length;
    
    res.json({ count: pendingCount });
    
  } catch (error) {
    // Si es un error de conectividad, retornar 0 en lugar de error 500
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.warn('⚠️ Error de conectividad obteniendo contador de notas. Retornando 0.');
      return res.json({ count: 0 });
    }
    
    // Para otros errores, loguear pero también retornar 0 para no romper la UI
    console.error('❌ Error obteniendo contador:', error.message || error);
    return res.json({ count: 0 });
  }
});

/**
 * POST /api/notes
 * Crear nueva nota
 */
router.post('/', async (req, res) => {
  try {
    const { descripcion, estado, operador } = req.body;
    
    if (!descripcion) {
      return res.status(400).json({ error: 'Descripción es requerida' });
    }
    
    if (!operador) {
      return res.status(400).json({ error: 'Operador es requerido' });
    }
    
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    
    // Obtener el último ID para auto-incrementar
    const rangeIds = `${quotedNotes}!A:A`;
    const idsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: rangeIds
    });
    
    const ids = idsResponse.data.values || [];
    let nextId = 1;
    if (ids.length > 1) {
      const lastId = parseInt(ids[ids.length - 1][0]) || 0;
      nextId = lastId + 1;
    }
    
    // Obtener fecha actual en zona horaria de Bolivia
    const fechaCreacion = getBoliviaDate();
    
    // Crear fila para insertar
    // Orden: ID, Estado, Fecha Creación, Operador, Descripción, Resuelto por, Fecha Resolución, Descripción resolución
    const row = [
      nextId,                    // A: ID
      estado || 'Pendiente',     // B: Estado (se ve primero para saber si está pendiente)
      fechaCreacion,             // C: Fecha Creación
      operador,                  // D: Operador (quien creó)
      descripcion,               // E: Descripción (contenido)
      '',                        // F: Resuelto por (vacío)
      '',                        // G: Fecha Resolución (vacío)
      ''                         // H: Descripción resolución (vacío)
    ];
    
    // Agregar nueva fila
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${quotedNotes}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    
    console.log(`✅ Nota #${nextId} creada por ${operador}`);
    res.json({ 
      success: true, 
      id: nextId,
      message: `Nota #${nextId} creada exitosamente` 
    });
    
  } catch (error) {
    console.error('❌ Error creando nota:', error);
    res.status(500).json({ 
      error: 'Error creando nota', 
      details: error.message 
    });
  }
});

/**
 * PUT /api/notes/:id/resolve
 * Marcar nota como resuelta
 */
router.put('/:id/resolve', async (req, res) => {
  try {
    const noteId = req.params.id;
    const { estado, resuelto_por, descripcion_resolucion } = req.body;
    
    if (!noteId) {
      return res.status(400).json({ error: 'ID de nota es requerido' });
    }
    
    if (!resuelto_por) {
      return res.status(400).json({ error: 'resuelto_por es requerido' });
    }
    
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    
    // Leer todas las notas para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quotedNotes}!A:H`
    });
    
    const rows = response.data.values || [];
    const dataRows = rows.slice(1);
    
    // Buscar la fila con el ID especificado
    const rowIndex = dataRows.findIndex(row => row[0] === noteId.toString());
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: `Nota #${noteId} no encontrada` });
    }
    
    // Calcular el número de fila en el sheet (header + 1 + rowIndex)
    const sheetRow = rowIndex + 2;
    
    // Obtener fecha actual
    const fechaResolucion = getBoliviaDate();
    
    // Actualizar columnas B (Estado), F (Resuelto por), G (Fecha Resolución), H (Descripción resolución)
    // Nueva estructura: ID (A), Estado (B), Fecha Creación (C), Operador (D), Descripción (E), Resuelto por (F), Fecha Resolución (G), Descripción resolución (H)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `${quotedNotes}!B${sheetRow}`,
            values: [[estado || 'Resuelto']]
          },
          {
            range: `${quotedNotes}!F${sheetRow}`,
            values: [[resuelto_por]]
          },
          {
            range: `${quotedNotes}!G${sheetRow}`,
            values: [[fechaResolucion]]
          },
          {
            range: `${quotedNotes}!H${sheetRow}`,
            values: [[descripcion_resolucion || '']]
          }
        ]
      }
    });
    
    console.log(`✅ Nota #${noteId} marcada como resuelta por ${resuelto_por}`);
    res.json({ 
      success: true, 
      message: `Nota #${noteId} marcada como resuelta` 
    });
    
  } catch (error) {
    console.error('❌ Error resolviendo nota:', error);
    res.status(500).json({ 
      error: 'Error resolviendo nota', 
      details: error.message 
    });
  }
});

/**
 * PUT /api/notes/:id
 * Actualizar nota (solo descripción para notas pendientes)
 */
router.put('/:id', async (req, res) => {
  try {
    const noteId = req.params.id;
    const { descripcion } = req.body;
    
    if (!noteId) {
      return res.status(400).json({ error: 'ID de nota es requerido' });
    }
    
    if (!descripcion) {
      return res.status(400).json({ error: 'Descripción es requerida' });
    }
    
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    
    // Leer todas las notas para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quotedNotes}!A:H`
    });
    
    const rows = response.data.values || [];
    const dataRows = rows.slice(1);
    
    // Buscar la fila con el ID especificado
    const rowIndex = dataRows.findIndex(row => row[0] === noteId.toString());
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: `Nota #${noteId} no encontrada` });
    }
    
    // Calcular el número de fila en el sheet
    const sheetRow = rowIndex + 2;
    
    // Verificar que la nota esté pendiente (solo se pueden editar pendientes)
    const estado = dataRows[rowIndex][1] || ''; // Columna B (Estado)
    if (estado.toLowerCase() !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se pueden editar notas pendientes' });
    }
    
    // Actualizar solo la descripción (columna E)
    // Nueva estructura: ID (A), Estado (B), Fecha Creación (C), Operador (D), Descripción (E), Resuelto por (F), Fecha Resolución (G), Descripción resolución (H)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${quotedNotes}!E${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[descripcion]]
      }
    });
    
    console.log(`✅ Nota #${noteId} actualizada`);
    res.json({ 
      success: true, 
      message: `Nota #${noteId} actualizada exitosamente` 
    });
    
  } catch (error) {
    console.error('❌ Error actualizando nota:', error);
    res.status(500).json({ 
      error: 'Error actualizando nota', 
      details: error.message 
    });
  }
});

/**
 * PUT /api/notes/:id/unresolve
 * Marcar nota como pendiente (deshacer resolución)
 */
router.put('/:id/unresolve', async (req, res) => {
  try {
    const noteId = req.params.id;
    
    if (!noteId) {
      return res.status(400).json({ error: 'ID de nota es requerido' });
    }
    
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    
    // Leer todas las notas para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quotedNotes}!A:H`
    });
    
    const rows = response.data.values || [];
    const dataRows = rows.slice(1);
    
    // Buscar la fila con el ID especificado
    const rowIndex = dataRows.findIndex(row => row[0] === noteId.toString());
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: `Nota #${noteId} no encontrada` });
    }
    
    // Calcular el número de fila en el sheet
    const sheetRow = rowIndex + 2;
    
    // Limpiar columnas B (Estado a Pendiente), F (Resuelto por), G (Fecha Resolución), H (Descripción resolución)
    // Nueva estructura: ID (A), Estado (B), Fecha Creación (C), Operador (D), Descripción (E), Resuelto por (F), Fecha Resolución (G), Descripción resolución (H)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `${quotedNotes}!B${sheetRow}`,
            values: [['Pendiente']]
          },
          {
            range: `${quotedNotes}!F${sheetRow}`,
            values: [['']] // Limpiar "Resuelto por"
          },
          {
            range: `${quotedNotes}!G${sheetRow}`,
            values: [['']] // Limpiar "Fecha Resolución"
          },
          {
            range: `${quotedNotes}!H${sheetRow}`,
            values: [['']] // Limpiar "Descripción resolución"
          }
        ]
      }
    });
    
    console.log(`✅ Nota #${noteId} marcada como pendiente`);
    res.json({ 
      success: true, 
      message: `Nota #${noteId} marcada como pendiente` 
    });
    
  } catch (error) {
    console.error('❌ Error cambiando estado de nota:', error);
    res.status(500).json({ 
      error: 'Error cambiando estado de nota', 
      details: error.message 
    });
  }
});

/**
 * DELETE /api/notes/:id
 * Eliminar nota (marcar como "Eliminado")
 */
router.delete('/:id', async (req, res) => {
  try {
    const noteId = req.params.id;
    
    if (!noteId) {
      return res.status(400).json({ error: 'ID de nota es requerido' });
    }
    
    const SHEET_ID = getSheetId();
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'SHEET_ID no configurado' });
    }
    
    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const notesSheetName = 'Notas';
    const quotedNotes = quoteSheet(notesSheetName);
    
    // Leer todas las notas para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${quotedNotes}!A:H`
    });
    
    const rows = response.data.values || [];
    const dataRows = rows.slice(1);
    
    // Buscar la fila con el ID especificado
    const rowIndex = dataRows.findIndex(row => row[0] === noteId.toString());
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: `Nota #${noteId} no encontrada` });
    }
    
    // Calcular el número de fila en el sheet
    const sheetRow = rowIndex + 2;
    
    // Obtener fecha actual
    const fechaEliminacion = getBoliviaDate();
    
    // Marcar como "Eliminado" en lugar de borrar físicamente
    // Nueva estructura: ID (A), Estado (B), Fecha Creación (C), Operador (D), Descripción (E), Resuelto por (F), Fecha Resolución (G)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `${quotedNotes}!B${sheetRow}`,
            values: [['Eliminado']]
          },
          {
            range: `${quotedNotes}!F${sheetRow}`,
            values: [['']] // Limpiar "Resuelto por"
          },
          {
            range: `${quotedNotes}!G${sheetRow}`,
            values: [[fechaEliminacion]] // Usar Fecha Resolución para guardar fecha de eliminación
          }
        ]
      }
    });
    
    console.log(`✅ Nota #${noteId} marcada como eliminada`);
    res.json({ 
      success: true, 
      message: `Nota #${noteId} eliminada exitosamente` 
    });
    
  } catch (error) {
    console.error('❌ Error eliminando nota:', error);
    res.status(500).json({ 
      error: 'Error eliminando nota', 
      details: error.message 
    });
  }
});

export default router;
