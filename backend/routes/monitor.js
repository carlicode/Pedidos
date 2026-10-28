import express from 'express'
import { obtenerMonitorHoy } from '../services/turboMonitor.js'

/**
 * Monitor de turnos: proxy a Turbo. Montado en index.js con verifyToken:
 * app.use('/api/monitor', verifyToken, monitorRoutes)
 *
 * No toca Sheets ni DynamoDB. Los detalles del fallo (códigos internos) no se
 * devuelven al cliente.
 */
const router = express.Router()

router.get('/hoy', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const resultado = await obtenerMonitorHoy()
    if (!resultado.ok) {
      return res.status(502).json({ success: false, error: 'No se pudo obtener el monitor de Turbo' })
    }
    const cuerpo = { success: true, ...resultado.data }
    if (resultado.stale) {
      cuerpo.stale = true
      cuerpo.staleDesde = resultado.staleDesde
    }
    return res.json(cuerpo)
  } catch (err) {
    console.error('🖥️ monitor: error inesperado en GET /hoy:', err?.message || 'desconocido')
    return res.status(500).json({ success: false, error: 'Error interno' })
  }
})

export default router
