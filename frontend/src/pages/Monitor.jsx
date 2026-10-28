import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import { fetchWithAuth } from '../utils/authInterceptor.js'
import {
  fusionarFranjas,
  textoHorario,
  nombreVisible,
  grupoDe,
  ordenarGrupo,
  contadores,
  tiempoTranscurrido,
  ahoraBoliviaMin,
  horaBolivia,
  fechaLarga,
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
  { id: 'fuera-de-horario', titulo: 'Fuera de horario' },
  { id: 'termino', titulo: 'Terminaron' },
]
const IDS_CONOCIDOS = new Set(GRUPOS.map((g) => g.id))

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
    case 'fuera-de-horario':
      return { tono: 'azul', texto: 'Fuera de horario' }
    case 'termino':
      return {
        tono: 'gris',
        texto: persona.turno?.horaFin ? `Terminó ${persona.turno.horaFin}` : 'Terminó',
      }
    default:
      return { tono: 'gris', texto: 'Sin dato' }
  }
}

/** Línea gris bajo el nombre: horario, desde cuándo y dónde empezó, y placa. */
function detalleDe(persona, grupo) {
  const partes = []
  const horario = textoHorario(persona.bloques)
  if (horario) partes.push(horario)

  // Las personas sin vincular muestran solo el horario.
  if (persona.turno && grupo !== 'sin-vincular') {
    if (persona.turno.horaInicio) partes.push(`desde ${persona.turno.horaInicio}`)
    if (persona.turno.lugarInicio) partes.push(persona.turno.lugarInicio)
  }

  const placa = persona.turno && grupo !== 'sin-vincular' && persona.turno.placa
    ? persona.turno.placa
    : [...new Set(fusionarFranjas(persona.bloques).flatMap((f) => f.placas))].join(', ')
  if (placa) partes.push(placa)

  return partes.join(' · ')
}

function FilaPersona({ persona, grupo, ahoraMin }) {
  const nombre = nombreVisible(persona.nombre)
  const pildora = pildoraDe(persona, grupo, ahoraMin)
  const detalle = detalleDe(persona, grupo)
  return (
    <li className="monitor-fila">
      <span className="monitor-avatar" aria-hidden="true">{iniciales(persona.nombre)}</span>
      <div className="monitor-fila-texto">
        <span className="monitor-nombre">{nombre}</span>
        {detalle && <span className="monitor-detalle">{detalle}</span>}
      </div>
      <span className={`monitor-pildora monitor-pildora-${pildora.tono}`}>{pildora.texto}</span>
    </li>
  )
}

function Columna({ titulo, icono, lista, ahoraMin }) {
  const programados = lista.filter((p) => p.vinculo !== 'sin-horario').length

  const porGrupo = new Map()
  for (const persona of lista) {
    const g = grupoDe(persona)
    if (!porGrupo.has(g)) porGrupo.set(g, [])
    porGrupo.get(g).push(persona)
  }
  // Un estado que el monitor no conoce no se esconde: va al final, sin color propio.
  const desconocidos = [...porGrupo.keys()].filter((g) => !IDS_CONOCIDOS.has(g))
  const grupos = [
    ...GRUPOS,
    ...desconocidos.map((id) => ({ id, titulo: 'Otros' })),
  ]

  return (
    <section className="monitor-columna">
      <header className="monitor-columna-cabecera">
        <h2 className="monitor-columna-titulo">
          <Icon name={icono} size={20} />
          {titulo}
        </h2>
        <span className="monitor-columna-programados">{programados} programados</span>
      </header>

      {grupos.map(({ id, titulo: tituloGrupo }) => {
        const personas = porGrupo.get(id)
        if (!personas || personas.length === 0) return null
        return (
          <div className="monitor-grupo" key={id}>
            <h3 className="monitor-grupo-titulo">{tituloGrupo}</h3>
            <ul className="monitor-lista">
              {ordenarGrupo(personas).map((persona, i) => (
                <FilaPersona
                  key={`${persona.usuario || persona.nombre}-${i}`}
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

function Contador({ valor, etiqueta, tono }) {
  return (
    <div className={`monitor-contador monitor-contador-${tono}`}>
      <span className="monitor-contador-valor">{valor}</span>
      <span className="monitor-contador-etiqueta">{etiqueta}</span>
    </div>
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
            <Contador valor={totales.trabajando} etiqueta="Trabajando" tono="verde" />
            <Contador valor={totales.sinIniciar} etiqueta="Sin iniciar" tono="gris" />
            <Contador valor={totales.porLlegar} etiqueta="Por llegar" tono="gris" />
            <Contador valor={totales.terminaron} etiqueta="Terminaron" tono="gris" />
          </div>

          <div className="monitor-columnas">
            <Columna titulo="Drivers · BeeZero" icono="car" lista={drivers} ahoraMin={ahoraMin} />
            <Columna titulo="Bikers · Ecodelivery" icono="bike" lista={bikers} ahoraMin={ahoraMin} />
          </div>
        </>
      )}

      <p className="monitor-pie">Para ver otro día, usa Horarios.</p>
    </div>
  )
}
