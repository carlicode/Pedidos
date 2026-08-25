import express from 'express';
import { google } from 'googleapis';
import { getGoogleServiceAccountJson, getSecret } from '../utils/secrets.js';

const router = express.Router();

// Sheet "clientes eco/ documento de introduccion"
// Columnas: NOMBRES DE CLIENTES | CUENTA | PROCEDIMIENTOS | ETIQUETA | envios | TIPO DE PAGO
const DEFAULT_SHEET_ID = '1YhEpo6EBdCEm15y6xnEeUDiViJEItQAU23yHTzBkRIM';
const DEFAULT_SHEET_NAME = 'Hoja 1';

// Encabezado normalizado -> campo de la respuesta
const COLUMNAS = {
  'nombres de clientes': 'nombreCliente',
  'cuenta': 'cuenta',
  'procedimientos': 'procedimientos',
  'etiqueta': 'etiqueta',
  'envios': 'envios',
  'tipo de pago': 'tipoPago',
};

function quoteSheet(title) {
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'`;
}

/** minúsculas, sin acentos, sin puntuación y con espacios colapsados */
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Distancia de Levenshtein, con corte temprano para nombres de largo muy distinto */
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** true si `corto` aparece dentro de `largo` como palabra completa */
function contienePalabra(largo, corto) {
  const escaped = corto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(largo);
}

/**
 * Nivel de coincidencia entre el nombre del sheet y el buscado.
 * 3 = exacto | 2 = uno contiene al otro como palabra completa | 1 = typo de una letra | 0 = no coincide
 *
 * El limite de palabra evita falsos positivos como "Saiko no manga" -> "aiko"
 * o "Tora" -> "Consultora Sevilla"; el nivel 1 rescata "Qhathu" -> "Qhatu".
 */
function matchLevel(nombreSheet, buscado) {
  const a = normalize(nombreSheet);
  const b = normalize(buscado);
  if (!a || !b) return 0;
  if (a === b) return 3;

  const [largo, corto] = a.length >= b.length ? [a, b] : [b, a];
  if (corto.length >= 4 && contienePalabra(largo, corto)) return 2;

  const sinEspacios = [a.replace(/ /g, ''), b.replace(/ /g, '')];
  if (Math.max(sinEspacios[0].length, sinEspacios[1].length) >= 6 &&
      levenshtein(sinEspacios[0], sinEspacios[1]) <= 1) {
    return 1;
  }

  return 0;
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

/** env -> Secrets Manager -> default (los secretos no se inyectan en process.env) */
async function getSheetConfig() {
  let sheetId = process.env.CLIENT_INFO_SHEET_ID;
  let sheetName = process.env.CLIENT_INFO_SHEET_NAME;

  if (!sheetId || !sheetName) {
    try {
      sheetId = sheetId || (await getSecret('CLIENT_INFO_SHEET_ID'));
      sheetName = sheetName || (await getSecret('CLIENT_INFO_SHEET_NAME'));
    } catch (err) {
      console.warn('⚠️ No se pudo leer CLIENT_INFO_* de Secrets Manager:', err.message);
    }
  }

  return {
    sheetId: sheetId || DEFAULT_SHEET_ID,
    sheetName: sheetName || DEFAULT_SHEET_NAME,
  };
}

/** Mapea la fila de encabezados a índices de columna, así el orden puede cambiar sin romper nada */
function mapearColumnas(headerRow) {
  const indices = {};
  headerRow.forEach((header, i) => {
    const campo = COLUMNAS[normalize(header)];
    if (campo && indices[campo] === undefined) indices[campo] = i;
  });
  return indices;
}

/**
 * GET /api/client-info/:clientName
 * Busca al cliente por "NOMBRES DE CLIENTES" y devuelve
 * CUENTA, PROCEDIMIENTOS, ETIQUETA, envios y TIPO DE PAGO.
 */
router.get('/:clientName', async (req, res) => {
  try {
    const { clientName } = req.params;
    if (!clientName || !clientName.trim()) {
      return res.status(400).json({ error: 'Nombre del cliente es requerido' });
    }

    const { sheetId, sheetName } = await getSheetConfig();
    console.log(`📊 Buscando información del cliente: "${clientName}" en ${sheetId} / ${sheetName}`);

    const auth = await getAuthClient();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${quoteSheet(sheetName)}!A:F`,
    });
    const rows = response.data.values || [];

    if (rows.length < 2) {
      return res.json({ data: [] });
    }

    const cols = mapearColumnas(rows[0]);
    if (cols.nombreCliente === undefined) {
      throw new Error(`No se encontró la columna "NOMBRES DE CLIENTES" en ${sheetName}`);
    }

    const cell = (row, campo) =>
      cols[campo] === undefined ? '' : String(row[cols[campo]] || '').trim();

    // Agrupa por nivel de coincidencia y devuelve solo el mejor nivel encontrado
    const porNivel = { 3: [], 2: [], 1: [] };
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nombre = cell(row, 'nombreCliente');
      const nivel = matchLevel(nombre, clientName);
      if (!nivel) continue;

      porNivel[nivel].push({
        nombreCliente: nombre,
        cuenta: cell(row, 'cuenta'),
        procedimientos: cell(row, 'procedimientos'),
        etiqueta: cell(row, 'etiqueta'),
        envios: cell(row, 'envios'),
        tipoPago: cell(row, 'tipoPago'),
        fuente: sheetName,
        aproximado: nivel < 3,
      });
    }

    const matchingRows = porNivel[3].length ? porNivel[3] : porNivel[2].length ? porNivel[2] : porNivel[1];

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
