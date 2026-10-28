import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import { fetchWithAuth } from '../utils/authInterceptor.js'
import {
  fusionarFranjas,
  nombreVisible,
  grupoDe,
  ordenarGrupo,
  contadores,
  tiempoTranscurrido,
  ahoraBoliviaMin,
  horaBolivia,
  fechaLarga,
  filtrarPorNombre,
  datosTarjeta,
} from '../utils/monitorFormat.mjs'
import '../styles/Monitor.css'

const REFRESCO_DATOS_MS = 30_000
const REFRESCO_RELOJ_MS = 60_000

// Orden FIJO de los grupos dentro de cada columna.
const GRUPOS = [
  { id: 'trabajando', titulo: 'Trabajando' },
  { id: 'sin-iniciar', titulo: 'Sin iniciar' },
  { id: 'por-llegar', titulo: 'Por llegar' },
  { id: 'sin-vincular', titulo: 'Sin vincular' },
  { id: 'termino', titulo: 'Terminaron' },
]
const IDS_CONOCIDOS = new Set(GRUPOS.map((g) => g.id))

// Qué grupos se ven según el contador que está seleccionado. Se empieza en 'trabajando'
// (quien trabaja sin estar en el horario también cae ahí: ver grupoDe).
// 'sin-vincular' es un sin-iniciar que no se pudo ligar a una cuenta, por eso va con él.
const VISTAS = {
  trabajando: ['trabajando'],
  'sin-iniciar': ['sin-iniciar', 'sin-vincular'],
  'por-llegar': ['por-llegar'],
  termino: ['termino'],
}

function iniciales(nombre) {
  const letras = nombreVisible(nombre)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join('')
  return letras || '?'
}

/** Texto de la píldora y su color según el grupo. Solo existen verde, azul y gris. */
function pildoraDe(persona, grupo, ahoraMin) {
  const primerBloque = fusionarFranjas(persona.bloques)[0]
  switch (grupo) {
    case 'trabajando':
      return {
        tono: 'verde',
        texto: persona.turno?.horaInicio
          ? tiempoTranscurrido(persona.turno.horaInicio, ahoraMin)
          : 'Trabajando',
      }
    case 'sin-iniciar':
      return { tono: 'gris', texto: 'Sin iniciar' }
    case 'por-llegar':
      return { tono: 'gris', texto: primerBloque ? `Entra ${primerBloque.desde}` : 'Por llegar' }
    case 'sin-vincular':
      return { tono: 'gris', texto: 'Sin vincular' }
    case 'termino':
      return {
        tono: 'gris',
        texto: persona.turno?.horaFin ? `Terminó ${persona.turno.horaFin}` : 'Terminó',
      }
    default:
      return { tono: 'gris', texto: 'Sin dato' }
  }
}

/** Una fila de datos de la tarjeta: ícono + etiqueta pequeña arriba y el valor abajo. */
function Dato({ icono, etiqueta, ancho, children }) {
  return (
    <div className={`monitor-dato${ancho ? ' monitor-dato-ancho' : ''}`}>
      <span className="monitor-dato-etiqueta">
        <Icon name={icono} size={13} />
        {etiqueta}
      </span>
      {children}
    </div>
  )
}

function TarjetaPersona({ persona, grupo, ahoraMin }) {
  const nombre = nombreVisible(persona.nombre)
  const pildora = pildoraDe(persona, grupo, ahoraMin)
  const { franjas, inicio, placa } = datosTarjeta(persona, grupo)
  const hayDatos = franjas.length > 0 || inicio || placa
  const [abierta, setAbierta] = useState(false) // cerrada por defecto: solo nombre y estado
  const cabecera = (
    <>
      <span className={`monitor-avatar monitor-avatar-${pildora.tono}`} aria-hidden="true">
        {iniciales(persona.nombre)}
      </span>
      <span className="monitor-nombre">{nombre}</span>
      <span className={`monitor-pildora monitor-pildora-${pildora.tono}`}>{pildora.texto}</span>
      {hayDatos && <span className="monitor-flecha" aria-hidden="true" />}
    </>
  )
  return (
    <li className={`monitor-tarjeta monitor-tarjeta-${pildora.tono}${abierta ? ' monitor-tarjeta-abierta' : ''}`}>
      {hayDatos ? (
        <button
          type="button"
          className="monitor-tarjeta-cabecera monitor-tarjeta-boton"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
        >
          {cabecera}
        </button>
      ) : (
        <div className="monitor-tarjeta-cabecera">{cabecera}</div>
      )}

      {hayDatos && abierta && (
        <div className="monitor-tarjeta-datos">
          {franjas.length > 0 && (
            <Dato icono="clock" etiqueta={franjas.length > 1 ? 'Horarios' : 'Horario'} ancho>
              <span className="monitor-franjas">
                {franjas.map((f) => (
                  <span className="monitor-franja" key={f}>{f}</span>
                ))}
              </span>
            </Dato>
          )}
          {inicio && (
            <Dato icono="activity" etiqueta="Inició">
              <span className="monitor-dato-valor">{inicio}</span>
            </Dato>
          )}
          {placa && (
            <Dato icono="car" etiqueta="Placa">
              <span className="monitor-placa">{placa}</span>
            </Dato>
          )}
        </div>
      )}
    </li>
  )
}

/** Clave por persona que no cambia cuando el orden cambia (así una tarjeta abierta sigue abierta). */
function clavesEstables(lista) {
  const vistas = new Map()
  return lista.map((persona) => {
    const base = `${persona.usuario || ''}|${persona.nombre}`
    const n = (vistas.get(base) || 0) + 1
    vistas.set(base, n)
    return { clave: n === 1 ? base : `${base}#${n}`, persona }
  })
}

function Columna({ clase, titulo, icono, lista, programados, busqueda, gruposVisibles, ahoraMin }) {
  const buscando = busqueda.trim() !== ''

  const porGrupo = new Map()
  for (const persona of lista) {
    const g = grupoDe(persona)
    if (!porGrupo.has(g)) porGrupo.set(g, [])
    porGrupo.get(g).push(persona)
  }
  // Un estado que el monitor no conoce no se esconde: va al final, sin color propio.
  const desconocidos = [...porGrupo.keys()].filter((g) => !IDS_CONOCIDOS.has(g))
  // Buscando se mira en todos los estados; si no, solo los de la vista elegida.
  const grupos = [
    ...GRUPOS.filter((g) => buscando || gruposVisibles.includes(g.id)),
    ...desconocidos.map((id) => ({ id, titulo: 'Otros' })),
  ]
  const hayGenteVisible = grupos.some((g) => (porGrupo.get(g.id) || []).length > 0)

  return (
    <section className={`monitor-columna ${clase}`}>
      <header className="monitor-columna-cabecera">
        <h2 className="monitor-columna-titulo">
          <span className="monitor-columna-icono" aria-hidden="true">
            <Icon name={icono} size={18} />
          </span>
          {titulo}
        </h2>
        <span className="monitor-columna-programados">
          {buscando ? `${lista.length} ${lista.length === 1 ? 'coincidencia' : 'coincidencias'}` : `${programados} programados`}
        </span>
      </header>

      {buscando && lista.length === 0 && (
        <p className="monitor-columna-vacia">Sin coincidencias</p>
      )}
      {!buscando && !hayGenteVisible && (
        <p className="monitor-columna-vacia">Nadie en esta lista</p>
      )}

      {grupos.map(({ id, titulo: tituloGrupo }) => {
        const personas = porGrupo.get(id)
        if (!personas || personas.length === 0) return null
        return (
          <div className={`monitor-grupo monitor-grupo-${id}`} key={id}>
            <h3 className="monitor-grupo-titulo">{tituloGrupo}</h3>
            <ul className="monitor-lista">
              {clavesEstables(ordenarGrupo(personas)).map(({ clave, persona }) => (
                <TarjetaPersona
                  key={clave}
                  persona={persona}
                  grupo={id}
                  ahoraMin={ahoraMin}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function Contador({ valor, etiqueta, tono, activo, onClick }) {
  return (
    <button
      type="button"
      className={`monitor-contador monitor-contador-${tono}${activo ? ' monitor-contador-activo' : ''}`}
      aria-pressed={activo}
      onClick={onClick}
    >
      <span className="monitor-contador-valor">{valor}</span>
      <span className="monitor-contador-etiqueta">{etiqueta}</span>
    </button>
  )
}

/**
 * Monitor de turnos de HOY: drivers (BeeZero) y bikers (Ecodelivery).
 * Los datos vienen de Turbo a través de GET /api/monitor/hoy.
 */
export default function Monitor() {
  const [datos, setDatos] = useState(null) // último dato bueno; nunca se borra por un fallo
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(false)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [busqueda, setBusqueda] = useState('') // texto del buscador; sobrevive a los refrescos
  const [vista, setVista] = useState('trabajando') // qué contador está seleccionado
  const [, setTick] = useState(0) // solo fuerza re-render para que avance el tiempo transcurrido
  const montado = useRef(true)
  const enVuelo = useRef(false)

  const cargar = useCallback(async () => {
    if (document.hidden || enVuelo.current) return
    enVuelo.current = true
    try {
      const res = await fetchWithAuth('/api/monitor/hoy')
      if (res.status === 403) {
        if (montado.current) setSinPermiso(true)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload = await res.json()
      if (!payload?.success || !Array.isArray(payload.drivers) || !Array.isArray(payload.bikers)) {
        throw new Error('respuesta inválida')
      }
      if (montado.current) {
        setDatos(payload)
        setSinPermiso(false)
        setFallo(false)
      }
    } catch (error) {
      console.warn('Monitor: no se pudo actualizar', error?.message || error)
      if (montado.current) setFallo(true)
    } finally {
      enVuelo.current = false
      if (montado.current) setCargando(false)
    }
  }, [])

  useEffect(() => {
    montado.current = true
    cargar()
    const datosTimer = setInterval(cargar, REFRESCO_DATOS_MS)
    const relojTimer = setInterval(() => setTick((t) => t + 1), REFRESCO_RELOJ_MS)
    const alVolver = () => {
      if (!document.hidden) cargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      montado.current = false
      clearInterval(datosTimer)
      clearInterval(relojTimer)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargar])

  const ahoraMin = ahoraBoliviaMin()
  const drivers = datos?.drivers ?? []
  const bikers = datos?.bikers ?? []
  const totales = contadores(drivers, bikers)
  // Los contadores y "N programados" siempre cuentan a todos; el buscador solo filtra las listas.
  const programadosDe = (lista) => lista.filter((p) => p.vinculo !== 'sin-horario').length
  const driversVisibles = filtrarPorNombre(drivers, busqueda)
  const bikersVisibles = filtrarPorNombre(bikers, busqueda)
  const vacio = datos && drivers.length === 0 && bikers.length === 0

  const horaUltimoDato = datos
    ? horaBolivia(datos.stale && datos.staleDesde ? datos.staleDesde : datos.generadoEn)
    : ''
  const mostrarSinConexion = !cargando && !sinPermiso && (fallo || datos?.stale || !datos)
  const avisos = Array.isArray(datos?.avisos) ? datos.avisos.filter(Boolean) : []

  const subtitulo = datos
    ? `Hoy, ${fechaLarga(datos.fecha)} · actualizado ${horaBolivia(datos.generadoEn)}`
    : 'Hoy'

  return (
    <div className="monitor-pagina">
      <header className="monitor-cabecera">
        <div className="monitor-cabecera-texto">
          <h1 className="monitor-titulo">Monitor de turnos</h1>
          <p className="monitor-subtitulo">{subtitulo}</p>
        </div>
        <span className="monitor-envivo">
          <span className="monitor-envivo-punto" aria-hidden="true" />
          En vivo, cada 30 s
        </span>
      </header>

      {cargando && <p className="monitor-mensaje">Cargando monitor…</p>}

      {sinPermiso && (
        <p className="monitor-mensaje">No tienes permiso para ver el monitor de turnos.</p>
      )}

      {mostrarSinConexion && (
        <p className="monitor-aviso" role="status">
          Sin conexión con Turbo{horaUltimoDato ? ` · último dato ${horaUltimoDato}` : ''}
        </p>
      )}

      {avisos.length > 0 && (
        <p className="monitor-aviso" role="status">
          Datos parciales: {avisos.join(' · ')}
        </p>
      )}

      {!cargando && !datos && !sinPermiso && (
        <p className="monitor-mensaje">No hay datos para mostrar por ahora.</p>
      )}

      {vacio && <p className="monitor-mensaje">No hay nadie programado hoy</p>}

      {datos && !vacio && (
        <>
          <div className="monitor-contadores">
            <Contador valor={totales.trabajando} etiqueta="Trabajando" tono="verde" activo={vista === 'trabajando'} onClick={() => setVista('trabajando')} />
            <Contador valor={totales.sinIniciar} etiqueta="Sin iniciar" tono="gris" activo={vista === 'sin-iniciar'} onClick={() => setVista('sin-iniciar')} />
            <Contador valor={totales.porLlegar} etiqueta="Por llegar" tono="azul" activo={vista === 'por-llegar'} onClick={() => setVista('por-llegar')} />
            <Contador valor={totales.terminaron} etiqueta="Terminaron" tono="violeta" activo={vista === 'termino'} onClick={() => setVista('termino')} />
          </div>

          <div className="monitor-buscador">
            <span className="monitor-buscador-icono" aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <input
              className="monitor-buscador-input"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setBusqueda('')
              }}
              placeholder="Buscar por nombre"
              aria-label="Buscar por nombre"
              autoComplete="off"
              spellCheck={false}
            />
            {busqueda !== '' && (
              <button
                type="button"
                className="monitor-buscador-limpiar"
                onClick={() => setBusqueda('')}
                aria-label="Borrar búsqueda"
              >
                ×
              </button>
            )}
          </div>
          {busqueda.trim() !== '' && (
            <p className="monitor-ayuda">Buscando en todos los estados</p>
          )}

          <div className="monitor-columnas">
            <Columna
              clase="monitor-columna-drivers"
              titulo="Drivers · BeeZero"
              icono="car"
              lista={driversVisibles}
              programados={programadosDe(drivers)}
              busqueda={busqueda}
              gruposVisibles={VISTAS[vista]}
              ahoraMin={ahoraMin}
            />
            <Columna
              clase="monitor-columna-bikers"
              titulo="Bikers · Ecodelivery"
              icono="bike"
              lista={bikersVisibles}
              programados={programadosDe(bikers)}
              busqueda={busqueda}
              gruposVisibles={VISTAS[vista]}
              ahoraMin={ahoraMin}
            />
          </div>
        </>
      )}

      <p className="monitor-pie">Para ver otro día, usa Horarios.</p>
    </div>
  )
}
