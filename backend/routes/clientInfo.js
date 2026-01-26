import express from 'express';
import { google } from 'googleapis';
import { getGoogleServiceAccountJson } from '../utils/secrets.js';

const router = express.Router();

/**
 * Helper para autenticar con Google Sheets
 */
async function getAuthClient() {
  try {
    // Obtener credenciales desde AWS Secrets Manager
    const serviceAccountJSON = await getGoogleServiceAccountJson();
    
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
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ]
    );

    return jwt;
  } catch (error) {
    console.error('❌ Error obteniendo auth client:', error.message);
    throw error;
  }
}

/**
 * GET /api/client-info/:clienteName
 * Obtiene información del cliente desde Google Sheet
 * Búsqueda por subcadena (case insensitive)
 */
router.get('/:clientName', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientName) {
      return res.status(400).json({ error: 'Nombre del cliente es requerido' });
    }

    const sheetId = process.env.CLIENT_INFO_SHEET_ID;
    const sheetName = process.env.CLIENT_INFO_SHEET_NAME || 'Hoja 1';

    if (!sheetId) {
      return res.status(500).json({ error: 'CLIENT_INFO_SHEET_ID no configurado' });
    }

    console.log(`📊 Buscando información del cliente: "${clientName}"`);

    // Autenticar
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Leer datos del sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:F`, // Columnas A a F (NOMBRES, CUENTA, PROCEDIMIENTOS, ETIQUETA, envios, TIPO DE PAGO)
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.json({ data: [] });
    }

    // Primera fila son los headers
    const headers = rows[0];
    console.log('📋 Headers:', headers);

    // Buscar por subcadena (case insensitive)
    const searchTerm = clientName.toLowerCase().trim();
    const matchingRows = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nombreCliente = (row[0] || '').toLowerCase().trim();

      // Buscar si el nombre del cliente contiene el término de búsqueda
      // o si el término de búsqueda está contenido en el nombre del cliente
      if (nombreCliente.includes(searchTerm) || searchTerm.includes(nombreCliente.substring(0, Math.min(searchTerm.length, nombreCliente.length)))) {
        matchingRows.push({
          nombreCliente: row[0] || '',
          cuenta: row[1] || '',
          procedimientos: row[2] || '',
          etiqueta: row[3] || '',
          envios: row[4] || '',
          tipoPago: row[5] || ''
        });
      }
    }

    console.log(`✅ Encontrados ${matchingRows.length} registros para "${clientName}"`);

    res.json({ data: matchingRows });

  } catch (error) {
    console.error('❌ Error obteniendo información del cliente:', error);
    res.status(500).json({ 
      error: 'Error obteniendo información del cliente',
      details: error.message 
    });
  }
});

export default router;
