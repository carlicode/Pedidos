# Plan de refactorización en sprints — Beezy / Pedidos

**Alcance:** la app deployada en `https://master.d3i6av0lx664fk.amplifyapp.com` (frontend
Amplify + backend `pedidos-backend-prod` en EB vía CloudFront `d1tufgzki2ukr8`), código en
este repo (`carlicode/Pedidos`, worktree local `beezy/pedidos-wt`). Donde aplica, incluye
la deduplicación con el repo `beezy` (portal cliente), que comparte backend y tiene una
copia divergente de `PedidosClientes.jsx`.

**Base:** `AUDITORIA_FRONTEND_BACKEND.md` (2026-03-18). Verificado el 2026-07-06 que los
hallazgos siguen vigentes: 0 usos de `verifyToken` en endpoints de negocio del backend,
`setupGlobalInterceptor` nunca se llama, `/api/maps/api-key` expone la key sin auth,
`requireInventarioAccess` bypasseable con header `x-username`, `validate-maps-link`
registrado dos veces (líneas 1582/1640), fetch legacy en `Orders.jsx` (915/972).

**Números actuales:**

| Archivo | Líneas |
|---|---|
| `frontend/src/pages/Orders.jsx` | 8,689 |
| `backend/index.js` | 5,339 |
| `frontend/src/pages/Horarios.jsx` | 3,006 |
| `frontend/src/components/PedidosClientes.jsx` | 2,058 (+ copia divergente de 2,129 en repo beezy) |

Cada sprint ≈ 1 semana. Regla de oro: **al final de cada sprint la app en producción
funciona igual o mejor** — se puede parar después de cualquier sprint y el sistema queda
estable.

---

## Sprint 1 — Seguridad y fixes críticos

Hoy cualquiera puede crear/editar pedidos sin autenticarse y la API key de Google Maps es
pública. Esto va primero, antes de mover código.

**Configuración (sin deploy de código):**
- Verificar/agregar `CLIENT_INFO_SHEET_ID` y `CLIENT_INFO_SHEET_NAME` en EB (bug C1: 500
  al seleccionar cliente).
- Verificar `VITE_BACKEND_URL` en Amplify (bug C3).

**Frontend:**
- Llamar `setupGlobalInterceptor()` en `main.jsx` → todas las peticiones salen con JWT (A1).
- Reemplazar los dos `fetch(VITE_SHEET_WRITE_URL || '', …)` de `Orders.jsx:915` y `:972`
  por `updateOrderInSheetAPI` de `ordersService.js` (C2).

**Backend (despliegue en dos pasos para no romper a nadie):**
1. Aplicar `verifyToken` en modo *log-only* a los endpoints de negocio (loguea si el
   request llega sin token válido, pero no bloquea) y monitorear 2–3 días.
2. Cuando el log esté limpio, pasar a *enforce* (A2).
- Proteger `/api/maps/api-key` con JWT, o mejor: dejar de exponerla y restringir la key
  por dominio en Google Cloud Console (M2).
- `requireInventarioAccess`: exigir JWT y sacar el rol/usuario del token, no del header
  `x-username` (M1 / Bug 4).
- `POST /api/auth/logout`: `jwt.verify()` en vez de `jwt.decode()` (Bug 6).
- Arreglar `GET /api/auth/me` (aplicar `verifyToken`) (A3).
- Eliminar la segunda definición de `GET /api/validate-maps-link` (A4).

**Hecho cuando:** ningún endpoint de negocio responde sin JWT válido, la API key no es
accesible públicamente, y crear/editar/entregar pedidos funciona igual que antes en prod.

## Sprint 2 — Backend: partir `index.js` (5,339 líneas)

- Extraer rutas por dominio a `backend/routes/`: `orders.js`, `clientOrders.js`,
  `empresas.js`, `bikers.js`, `horarios.js`, `inventario.js`, `maps.js`, `sse.js`.
  `index.js` queda solo con bootstrap + middleware + `app.use(...)`.
- Unificar las 3 implementaciones de `getAuthClient()` (index, notes, clientInfo) en un
  único `services/googleAuth.js` (M4).
- Crear `services/sheets.js`: toda lectura/escritura de Google Sheets pasa por ahí
  (hoy cada endpoint arma su propia llamada).
- `config.js` central: todas las env vars validadas al arranque; eliminar
  `EMPRESAS_SHEET_ID` y la URL de sheet hardcodeada en `bikersService.js` (M3, B6).
- Eliminar endpoints muertos: `PUT /api/update-order-status` deprecated si ya nada lo
  consume (B7) — verificar con logs de acceso antes de borrar.
- Tests de humo con `supertest`: un test por ruta extraída (status + shape de respuesta),
  para que la extracción sea verificable.

**Hecho cuando:** `index.js` < 300 líneas, cada dominio en su archivo, tests de humo en
verde, y el deploy a EB responde idéntico (comparar contra staging o con curl antes/después).

## Sprint 3 — Frontend: descomponer `Orders.jsx` (8,689 líneas)

La infraestructura ya existe (hooks `useOrderForm`, `useKanban`, `useTimer`…; services
`ordersService`, `bikersService`…) pero `Orders.jsx` no la aprovecha del todo.

- Partir en páginas reales: `AgregarPedido.jsx` (formulario) y `VerPedidos.jsx` (kanban),
  cada una con su ruta; `Orders.jsx` desaparece o queda como redirect.
- Mover la lógica restante a los hooks/services existentes; los componentes solo renderizan.
- Extraer los modales que aún viven inline hacia `components/modales/`.
- Toda llamada HTTP pasa por services con el fetch autenticado; eliminar usos directos de
  `import.meta.env.VITE_BACKEND_URL` en `App.jsx`, `PedidosClientes.jsx`, `HeatMapModal.jsx`
  → `getBackendUrl()` (C3 definitivo).
- Unificar los dos sistemas de notificaciones (`showNotification` vs `toast`) en uno (B2).
- Consolidar duplicados: `loadBikersForAgregar`/`loadBikersAgregar` (B3), normalización de
  fechas en un solo `dateUtils` (B5), lógica repetida de `CotizacionModal` vs
  `clientesService` (B4).

**Hecho cuando:** ningún archivo de `pages/` supera ~800 líneas, no queda ningún
`import.meta.env.VITE_BACKEND_URL` fuera de `utils/`, y el flujo completo (crear pedido →
kanban → entregar → Sheet actualizado) funciona probado a mano en staging.

## Sprint 4 — Horarios, PedidosClientes y deduplicación entre repos

- Descomponer `Horarios.jsx` (3,006 líneas) con el mismo patrón del Sprint 3.
- **`PedidosClientes.jsx` existe dos veces** (2,058 líneas aquí, 2,129 en repo `beezy`) y
  ya divergieron. Decidir la fuente única — recomendación: vive en el portal unificado
  (beezy, según el commit "portal unificado para clientes y operadores/admin") y este repo
  la elimina — y borrar la otra copia.
- Descomponerla al deduplicar: bandeja, tarjeta de pedido, hook `usePedidosClientes`
  (SSE + polling + agrupación en bandejas).
- Alinear `utils/` compartidos entre ambos repos (`backendUrl`, `clientePricing`): extraer
  a un paquete compartido o, mínimo, documentar cuál es el canónico.

**Hecho cuando:** existe una sola implementación de PedidosClientes en un solo repo, y
operadores reciben pedidos web (SSE + sonido) igual que antes.

## Sprint 5 — Sesiones, robustez y CI

- **SessionManager en memoria → persistente** (B8/Bug 7): mover `activeTokens`/
  `blacklistedTokens` a DynamoDB (ya se usa para usuarios) con TTL, o simplificar a JWT
  stateless con expiración corta + refresh. Hoy cada reinicio de EB desloguea a todos.
- Códigos de error correctos (503/400 en vez de 500 por env vars faltantes — Bug 3) y un
  middleware de manejo de errores único.
- CORS restringido a los dominios de Amplify/CloudFront; rate limiting básico en `/api/auth`.
- GitHub Actions: lint + build frontend + tests de humo backend en cada PR de ambos repos.
- Actualizar `README.md` y archivar `AUDITORIA_FRONTEND_BACKEND.md` con una nota de qué
  quedó resuelto y en qué sprint.

**Hecho cuando:** un reinicio de EB no desloguea a los usuarios, el CI corre en cada PR, y
no queda ningún ítem crítico/alto de la auditoría sin resolver o sin decisión documentada.

---

## Fuera de alcance (decidir después, no bloquean)

- **Unificar los dos backends** (`pedidos-backend-prod` y `beezy-api-prod`): hoy dos EB +
  dos CloudFront sirven al mismo Google Sheet. Consolidar en uno ahorraría costo y
  mantenimiento, pero es un proyecto propio; los sprints 1–5 lo dejan más fácil.
- **Migrar de Google Sheets a base de datos:** las hojas son parte del flujo operativo del
  equipo; cualquier migración necesita decisión de producto, no técnica.

## Principios transversales

- **Seguridad antes que estética:** el Sprint 1 no se negocia ni se pospone.
- **Extraer sin reescribir:** mover código tal cual a su módulo, probar, y recién después
  mejorarlo. Nunca las dos cosas en el mismo commit.
- **Verificación por comparación:** antes de refactorizar un endpoint/pantalla, capturar
  su comportamiento actual (curl guardado, screenshot, test de humo) y comparar después.
- **Deploy incremental:** cambios de auth siempre en modo log-only primero, enforce después.
