import express from 'express';
import { google } from 'googleapis';
import { getGoogleServiceAccountJson } from '../utils/secrets.js';

const router = express.Router();

const DEFAULT_SHEET_ID = '1AAGin-qSutQN42SlRaIbcooec7iKBn_l1QblROrI0Ok';

function quoteSheet(title) {
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'`;
}

function matchesClientName(empresa, searchTerm) {
  const name = (empresa || '').toLowerCase().trim();
  if (!name || !searchTerm) return false;
  return (
    name.includes(searchTerm) ||
    searchTerm.includes(name.substring(0, Math.min(searchTerm.length, name.length)))
  );
}

async function getAuthClient() {
  const serviceAccountJSON = await getGoogleServiceAccountJson();
  if (!serviceAccountJSON) {
    throw new Error('Google Service Account JSON no disponible en AWS Secrets Manager');
  }

  const creds = JSON.parse(serviceAccountJSON);
  return new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
}

async function readSheetRows(sheets, spreadsheetId, sheetName, range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(sheetName)}!${range}`,
  });
  return response.data.values || [];
}

/**
 * GET /api/client-info/:clientName
 * Busca Descripción en pestañas Empresas y Clientes del sheet de empresas.
 */
router.get('/:clientName', async (req, res) => {
  try {
    const { clientName } = req.params;
    if (!clientName) {
      return res.status(400).json({ error: 'Nombre del cliente es requerido' });
    }

    const sheetId =
      process.env.CLIENT_INFO_SHEET_ID ||
      process.env.EMPRESAS_SHEET_ID ||
      DEFAULT_SHEET_ID;

    const searchTerm = clientName.toLowerCase().trim();
    console.log(`📊 Buscando información del cliente: "${clientName}" en sheet ${sheetId}`);

    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    const matchingRows = [];

    // Pestaña Empresas: Fecha, Operador, Empresa, Mapa, Descripción
    try {
      const empresasRows = await readSheetRows(sheets, sheetId, 'Empresas', 'A:E');
      for (let i = 1; i < empresasRows.length; i++) {
        const row = empresasRows[i];
        const empresa = (row[2] || '').trim();
        if (!empresa || !matchesClientName(empresa, searchTerm)) continue;
        matchingRows.push({
          nombreCliente: empresa,
          descripcion: (row[4] || '').trim(),
          mapa: (row[3] || '').trim(),
          fuente: 'Empresas',
          // Compatibilidad con modal frontend anterior a jul 2026
          cuenta: (row[4] || '').trim(),
          procedimientos: (row[3] || '').trim() ? `Mapa: ${(row[3] || '').trim()}` : '',
          etiqueta: 'Empresas',
          envios: '',
          tipoPago: '',
        });
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer pestaña Empresas:', err.message);
    }

    // Pestaña Clientes: Empresa, Mayus, Descripción
    if (matchingRows.length === 0) {
      try {
        const clientesRows = await readSheetRows(sheets, sheetId, 'Clientes', 'A:C');
        for (let i = 1; i < clientesRows.length; i++) {
          const row = clientesRows[i];
          const empresa = (row[0] || '').trim();
          if (!empresa || !matchesClientName(empresa, searchTerm)) continue;
          matchingRows.push({
            nombreCliente: empresa,
            descripcion: (row[2] || '').trim(),
            mapa: '',
            fuente: 'Clientes',
            cuenta: (row[2] || '').trim(),
            procedimientos: '',
            etiqueta: 'Clientes',
            envios: '',
            tipoPago: '',
          });
        }
      } catch (err) {
        console.warn('⚠️ No se pudo leer pestaña Clientes:', err.message);
      }
    }

    console.log(`✅ Encontrados ${matchingRows.length} registros para "${clientName}"`);
    res.json({ data: matchingRows });
  } catch (error) {
    console.error('❌ Error obteniendo información del cliente:', error);
    res.status(500).json({
      error: 'Error obteniendo información del cliente',
      details: error.message,
    });
  }
});

export default router;
