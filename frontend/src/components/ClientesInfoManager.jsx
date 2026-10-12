import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listClientesInfo,
  crearClienteInfo,
  actualizarClienteInfo,
} from '../services/clientesInfoService.js'
import { loadClientes } from '../services/clientesService.js'
import '../styles/ClientesInfoManager.css'

const OTRO = '__otro__'
const PROCEDIMIENTOS_TRUNCADO = 80

// Textos que reconoce el autocompletado del pedido (ClientInfoModal)
const TIPOS_PAGO_BASE = ['efectivo', 'QR', 'detalle /tranferencia']

const FORM_VACIO = {
  id: null,
  version: null,
  nombreCliente: '',
  cuenta: '',
  procedimientos: '',
  etiqueta: '',
  envios: '',
  tipoPago: '',
}

/** minúsculas y sin acentos, para el buscador */
const normalizarBusqueda = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** "por X, DD/MM/YYYY HH:mm" en hora de Bolivia */
const formatearUltimaEdicion = (iso, usuario) => {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value])
  )
  const texto = `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`
  return usuario ? `por ${usuario}, ${texto}` : texto
}

/** Mensaje para el operador según el tipo de error */
const mensajeDeError = (err) => {
  switch (err?.code) {
    case 'SESION_EXPIRADA':
      return 'Tu sesión expiró, volvé a iniciar sesión'
    case 'NO_CONFIGURADO':
      return 'La base de clientes todavía no está activada'
    default:
      return err?.message || 'Ocurrió un error inesperado'
  }
}

/** Select con valores existentes + opción "Otro…" de texto libre */
function SelectConOtro({ id, label, value, opciones, onChange, ayuda }) {
  const [modoOtro, setModoOtro] = useState(() => Boolean(value) && !opciones.includes(value))

  const valorSelect = modoOtro ? OTRO : value

  const handleSelect = (e) => {
    const nuevo = e.target.value
    if (nuevo === OTRO) {
      setModoOtro(true)
      onChange('')
    } else {
      setModoOtro(false)
      onChange(nuevo)
    }
  }

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={valorSelect} onChange={handleSelect}>
        <option value="">— Sin definir —</option>
        {opciones.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
        <option value={OTRO}>Otro…</option>
      </select>
      {modoOtro && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Escribí ${label.toLowerCase()}`}
          maxLength={200}
          autoFocus
        />
      )}
      {ayuda && <small className="clientes-info-ayuda">{ayuda}</small>}
    </div>
  )
}

/**
 * Sección "ℹ️ Info de Clientes" de Agregar Nuevo: ver, buscar, crear y editar
 * la información que muestra el modal ℹ️ de Agregar Pedido.
 */
export default function ClientesInfoManager({ onNotify }) {
  const notify = useCallback((mensaje, tipo = 'success') => {
    if (typeof onNotify === 'function') onNotify(mensaje, tipo)
  }, [onNotify])

  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState(() => new Set())
  const [form, setForm] = useState(null) // null = formulario cerrado
  const [guardando, setGuardando] = useState(false)
  const [nombresCatalogo, setNombresCatalogo] = useState([])

  const cargarLista = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      setClientes(await listClientesInfo())
    } catch (err) {
      const mensaje = mensajeDeError(err)
      setErrorCarga(mensaje)
      notify(`❌ ${mensaje}`, 'error')
    } finally {
      setCargando(false)
    }
  }, [notify])

  useEffect(() => {
    cargarLista()
  }, [cargarLista])

  // Catálogo de clientes de "Agregar Pedido" para sugerir nombres y evitar typos (no bloqueante)
  useEffect(() => {
    let activo = true
    loadClientes()
      .then(({ clientes: nombres }) => {
        if (activo) setNombresCatalogo(Array.isArray(nombres) ? nombres : [])
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda)
    if (!q) return clientes
    return clientes.filter((c) => normalizarBusqueda(c.nombreCliente).includes(q))
  }, [clientes, busqueda])

  // Valores existentes para los selects de etiqueta y tipo de pago
  const opcionesEtiqueta = useMemo(
    () => [...new Set(clientes.map((c) => c.etiqueta).filter(Boolean))],
    [clientes]
  )
  const opcionesTipoPago = useMemo(() => {
    const vistos = new Map()
    ;[...TIPOS_PAGO_BASE, ...clientes.map((c) => c.tipoPago).filter(Boolean)].forEach((v) => {
      if (!vistos.has(v.toLowerCase())) vistos.set(v.toLowerCase(), v)
    })
    return [...vistos.values()]
  }, [clientes])

  const alternarExpandido = (id) => {
    setExpandidos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  const abrirNuevo = () => setForm({ ...FORM_VACIO })

  const abrirEdicion = (c) =>
    setForm({
      id: c.id,
      version: c.version,
      nombreCliente: c.nombreCliente || '',
      cuenta: c.cuenta || '',
      procedimientos: c.procedimientos || '',
      etiqueta: c.etiqueta || '',
      envios: c.envios || '',
      tipoPago: c.tipoPago || '',
    })

  const cerrarForm = () => setForm(null)

  const setCampo = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }))

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (guardando || !form) return
    if (!form.nombreCliente.trim()) {
      notify('❌ El nombre del cliente es obligatorio', 'error')
      return
    }

    const campos = {
      nombreCliente: form.nombreCliente,
      cuenta: form.cuenta,
      procedimientos: form.procedimientos,
      etiqueta: form.etiqueta,
      envios: form.envios,
      tipoPago: form.tipoPago,
    }

    setGuardando(true)
    try {
      if (form.id) {
        await actualizarClienteInfo(form.id, campos, form.version)
        notify('✅ Cliente actualizado', 'success')
      } else {
        await crearClienteInfo(campos)
        notify('✅ Cliente creado', 'success')
      }
      setForm(null)
      await cargarLista()
    } catch (err) {
      notify(`❌ ${mensajeDeError(err)}`, 'error')
      if (err?.code === 'CONFLICTO') {
        // Recargar siempre; si otro operador editó, se cierra el form para reabrirlo con datos frescos
        await cargarLista()
        if (String(err.message).startsWith('Otro operador')) setForm(null)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="clientes-info-manager">
      <h3>ℹ️ Info de Clientes</h3>

      <div className="clientes-info-toolbar">
        <input
          type="search"
          className="clientes-info-buscador"
          placeholder="Buscar cliente por nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar cliente"
        />
        <span className="clientes-info-contador">
          {filtrados.length === clientes.length
            ? `${clientes.length} clientes`
            : `${filtrados.length} de ${clientes.length} clientes`}
        </span>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo} disabled={Boolean(form)}>
          ➕ Nuevo cliente
        </button>
      </div>

      {form && (
        <form key={form.id || 'nuevo'} onSubmit={handleGuardar} className="form-organized clientes-info-form">
          <h4>{form.id ? '✏️ Editar cliente' : '➕ Nuevo cliente'}</h4>

          <div className="form-group">
            <label htmlFor="ci-nombre">Cliente *:</label>
            <input
              id="ci-nombre"
              type="text"
              list="clientes-info-catalogo"
              value={form.nombreCliente}
              onChange={(e) => setCampo('nombreCliente', e.target.value)}
              placeholder="Nombre del cliente"
              maxLength={120}
              required
            />
            <datalist id="clientes-info-catalogo">
              {nombresCatalogo.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="ci-cuenta">Cuenta:</label>
            <input
              id="ci-cuenta"
              type="text"
              value={form.cuenta}
              onChange={(e) => setCampo('cuenta', e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ci-procedimientos">Procedimientos:</label>
            <textarea
              id="ci-procedimientos"
              value={form.procedimientos}
              onChange={(e) => setCampo('procedimientos', e.target.value)}
              rows="4"
              maxLength={2000}
            />
          </div>

          <SelectConOtro
            id="ci-etiqueta"
            label="Etiqueta"
            value={form.etiqueta}
            opciones={opcionesEtiqueta}
            onChange={(v) => setCampo('etiqueta', v)}
          />

          <div className="form-group">
            <label htmlFor="ci-envios">Envíos:</label>
            <input
              id="ci-envios"
              type="text"
              value={form.envios}
              onChange={(e) => setCampo('envios', e.target.value)}
              maxLength={200}
            />
          </div>

          <SelectConOtro
            id="ci-tipo-pago"
            label="Tipo de pago"
            value={form.tipoPago}
            opciones={opcionesTipoPago}
            onChange={(v) => setCampo('tipoPago', v)}
            ayuda="El autocompletado del pedido reconoce: efectivo, qr y detalle /tranferencia"
          />

          <div className="form-actions clientes-info-acciones">
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : '💾 Guardar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cerrarForm} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando && <p className="clientes-info-estado">Cargando clientes…</p>}
      {!cargando && errorCarga && (
        <div className="clientes-info-estado clientes-info-error">
          <p>{errorCarga}</p>
          <button type="button" className="btn btn-secondary" onClick={cargarLista}>
            🔄 Reintentar
          </button>
        </div>
      )}
      {!cargando && !errorCarga && filtrados.length === 0 && (
        <p className="clientes-info-estado">
          {clientes.length === 0 ? 'Todavía no hay clientes cargados.' : 'Ningún cliente coincide con la búsqueda.'}
        </p>
      )}

      {!cargando && !errorCarga && filtrados.length > 0 && (
        <div className="clientes-info-tabla-wrap">
          <table className="clientes-info-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cuenta</th>
                <th>Procedimientos</th>
                <th>Etiqueta</th>
                <th>Envíos</th>
                <th>Tipo de pago</th>
                <th>Última edición</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const proc = c.procedimientos || ''
                const largo = proc.length > PROCEDIMIENTOS_TRUNCADO
                const abierto = expandidos.has(c.id)
                return (
                  <tr key={c.id}>
                    <td className="clientes-info-nombre">{c.nombreCliente}</td>
                    <td>{c.cuenta || '—'}</td>
                    <td className="clientes-info-proc">
                      {proc ? (abierto || !largo ? proc : `${proc.slice(0, PROCEDIMIENTOS_TRUNCADO)}…`) : '—'}
                      {largo && (
                        <button type="button" className="clientes-info-link" onClick={() => alternarExpandido(c.id)}>
                          {abierto ? 'Ver menos' : 'Ver más'}
                        </button>
                      )}
                    </td>
                    <td>{c.etiqueta || '—'}</td>
                    <td>{c.envios || '—'}</td>
                    <td>{c.tipoPago || '—'}</td>
                    <td className="clientes-info-edicion">{formatearUltimaEdicion(c.actualizadoEn, c.actualizadoPor)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => abrirEdicion(c)}
                        disabled={guardando}
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
