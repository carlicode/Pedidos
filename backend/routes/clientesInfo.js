import express from 'express';
import {
  getClientesInfoTableName,
  listClientes,
  crearCliente,
  actualizarCliente,
  ClienteInfoError,
} from '../services/clientesInfo.js';

/**
 * CRUD de la info de clientes (DynamoDB). Montado en index.js con verifyToken:
 * app.use('/api/clientes-info', verifyToken, clientesInfoRoutes)
 *
 * creadoPor / actualizadoPor salen SIEMPRE de req.user.username (nunca del body ni de headers).
 * No hay DELETE (no se pidió).
 */
const router = express.Router();

// Kill-switch: sin tabla configurada, todo responde 503
router.use((req, res, next) => {
  if (!getClientesInfoTableName()) {
    return res.status(503).json({ ok: false, error: 'CLIENTES_INFO_DYNAMO_TABLE no configurada' });
  }
  next();
});

/** Traduce errores del servicio a respuestas HTTP; lo inesperado es 500 sin filtrar detalles */
function responderError(res, err, contexto) {
  if (err instanceof ClienteInfoError) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }
  console.error(`❌ Error en clientes-info (${contexto}):`, err);
  return res.status(500).json({ ok: false, error: 'Error interno al procesar la info de clientes' });
}

/** GET /api/clientes-info -> todos los clientes ordenados por nombre */
router.get('/', async (req, res) => {
  try {
    const clientes = await listClientes();
    const data = [...clientes].sort((a, b) =>
      String(a.nombreCliente || '').localeCompare(String(b.nombreCliente || ''), 'es')
    );
    res.json({ ok: true, data });
  } catch (err) {
    responderError(res, err, 'listar');
  }
});

/** POST /api/clientes-info -> alta (409 si el nombre ya existe) */
router.post('/', async (req, res) => {
  try {
    const item = await crearCliente(req.body, req.user.username);
    console.log(`✅ Cliente creado en info de clientes: "${item.nombreCliente}" por ${req.user.username}`);
    res.status(201).json({ ok: true, data: item });
  } catch (err) {
    responderError(res, err, 'crear');
  }
});

/** PUT /api/clientes-info/:id -> edición con control optimista (body: campos + version) */
router.put('/:id', async (req, res) => {
  try {
    const { version, ...campos } = req.body || {};
    const item = await actualizarCliente(req.params.id, campos, version, req.user.username);
    console.log(`✅ Cliente actualizado en info de clientes: "${item.nombreCliente}" (v${item.version}) por ${req.user.username}`);
    res.json({ ok: true, data: item });
  } catch (err) {
    responderError(res, err, 'actualizar');
  }
});

export default router;
