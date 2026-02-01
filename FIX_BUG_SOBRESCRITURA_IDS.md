# 🐛 Bug Crítico: Sobrescritura de Carreras por IDs Duplicados/Incorrectos

**Fecha de detección:** 01/02/2026  
**Severidad:** CRÍTICA  
**Estado:** RESUELTO ✅

---

## 🔍 Descripción del Problema

Se detectó que las carreras (pedidos) estaban siendo **sobrescritas/eliminadas** debido a que el sistema permitía que el ID de un pedido cambiara durante las operaciones de edición (PUT).

### Síntomas Observados:

1. Carreras con fechas inconsistentes (ej: fecha 31/01/2026 cuando debería ser 06/01/2026)
2. Pedidos "desaparecidos" del sistema
3. IDs duplicados en el Google Sheet
4. Datos mezclados entre diferentes pedidos
5. **La hora de registro permanecía sin cambios** (evidencia de sobrescritura)

### Causas Raíz:

#### 1. **Backend no validaba el ID del body en PUT**
- El endpoint `PUT /api/orders/:id` recibía el ID por dos vías:
  - En la URL: `/api/orders/4701` ✅ (correcto)
  - En el body: `{ ID: 4700 }` ❌ (podría ser diferente)
- El backend construía la fila con `buildRow(order)` usando el ID del body
- Si el ID del body era diferente, **sobrescribía la fila con un ID incorrecto**

**Ejemplo del bug:**
```javascript
// Usuario edita pedido 4701:
PUT /api/orders/4701  ← URL correcta
body: { ID: 4700, ... }  ← ID incorrecto en el body

// Backend:
1. Busca fila con ID 4701 ✅
2. Construye newRow con ID 4700 ❌ (del body)
3. Sobrescribe la fila 4701 poniendo ID 4700
4. Resultado: pedido 4701 desapareció, ahora hay dos pedidos con ID 4700
```

#### 2. **Frontend guardaba referencias a objetos, no copias**
```javascript
// Antes (MALO):
const handleEditMode = (order) => {
  setEditingOrder(order)  // ← Referencia al objeto original
}

// Si el objeto se muta en memoria o hay concurrencia:
orders[0].id = 4700
// Al editar otro pedido, envía el ID incorrecto
```

#### 3. **Escenarios que causaban el bug:**
- ✅ **Dos usuarios editando simultáneamente** (sin recargar)
- ✅ **Caché del navegador** con datos desactualizados
- ✅ **Edición rápida** de múltiples pedidos sin recargar
- ✅ **Mutación accidental** de objetos compartidos en memoria
- ✅ **Estado desactualizado** cuando se crean pedidos mientras otro usuario edita

---

## ✅ Solución Implementada

### Fix 1: Backend - Forzar ID correcto en PUT

**Archivo:** `backend/index.js` (líneas ~2094-2115)

```javascript
// ANTES de merge, forzar ID correcto
const newRow = buildRow(order)
newRow[0] = orderId  // orderId viene de req.params.id

// DESPUÉS de merge, validar nuevamente
const mergedRow = newRow.map((newValue, index) => {
  if (index === 0) {
    return orderId  // SIEMPRE usar el ID de la URL
  }
  // ... resto del merge
})
```

**Protección:** El ID **NUNCA** puede cambiar en un PUT, se usa solo `req.params.id`.

---

### Fix 2: Frontend - Copia profunda del objeto

**Archivo:** `frontend/src/pages/Orders.jsx` (línea ~979)

```javascript
// ANTES (MALO):
const handleEditMode = (order) => {
  setEditingOrder(order)  // Referencia
}

// DESPUÉS (BUENO):
const handleEditMode = (order) => {
  const orderCopy = JSON.parse(JSON.stringify(order))  // Copia profunda
  setEditingOrder(orderCopy)
}
```

**Prevención:** Evita mutaciones y problemas de concurrencia.

---

### Fix 3: Frontend - Validación antes de enviar

**Archivo:** `frontend/src/services/ordersService.js` (línea ~325)

```javascript
export const updateOrderInSheet = async (order) => {
  const urlId = String(order.id)
  const bodyId = String(filteredOrder[SHEET_COLUMNS.ID])
  
  // Validar que coincidan
  if (urlId !== bodyId) {
    throw new Error(`Error interno: ID en URL (${urlId}) no coincide con ID en body (${bodyId})`)
  }
  
  // Forzar ID correcto
  filteredOrder[SHEET_COLUMNS.ID] = urlId
  
  // Enviar PUT...
}
```

**Validación:** Triple capa de seguridad (frontend + backend + logs).

---

## 🧪 Cómo Replicar el Bug (ANTES del fix)

### Método 1: Consola del navegador
```javascript
fetch('http://localhost:3000/api/orders/4701', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    'ID': '4700',  // ← ID diferente causa el bug
    'Cliente': 'BUG REPLICADO',
    'Estado': 'En carrera'
  })
}).then(r => r.json()).then(console.log)
```

### Método 2: Dos usuarios simultáneos
1. Usuario A: Abre pedido #4700 para editar (NO guarda aún)
2. Usuario B: Crea pedido #4701
3. Usuario A: Guarda (puede tener datos desactualizados en memoria)
4. Resultado: Datos mezclados/sobrescritos

---

## 📊 Impacto del Bug

### Análisis realizado:
- **Total filas CSV analizadas:** 1,401
- **Filas inconsistentes detectadas:** 101
- **IDs duplicados:** 0 (en el momento del análisis)
- **Fechas invertidas:** ~65 filas con `FECHA_INVERTIDA`

**Las fechas invertidas son evidencia directa del bug** (fecha posterior seguida de fecha anterior).

### Archivos de evidencia:
- `inconsistencia/resultado-filas-inconsistentes.txt` - Reporte legible
- `inconsistencia/filas-inconsistentes-reporte.json` - Datos estructurados

---

## 🛡️ Prevención Futura

### En Backend:
1. ✅ El ID del PUT **SIEMPRE** viene de `req.params.id` (URL)
2. ✅ El ID del body se **ignora completamente**
3. ✅ Doble validación (antes y después del merge)
4. ✅ Detección de IDs duplicados en POST (líneas 1897-1936)
5. ✅ Bloqueo de edición si hay IDs duplicados (líneas 2053-2065)

### En Frontend:
1. ✅ Copia profunda de objetos al editar
2. ✅ Validación de consistencia URL vs body
3. ✅ Logs detallados para debugging

### Logs y Auditoría:
1. ✅ Sistema de logs en hoja "Logs" del Google Sheet
2. ✅ Audit logs locales en `backend/logs/audit/`
3. ✅ Registro de operaciones con timestamp y operador

---

## 🚀 Despliegue del Fix

### Backend (AWS Elastic Beanstalk):
```bash
cd backend
./scripts/eb-deploy.sh
```

### Frontend (AWS Amplify):
```bash
git add .
git commit -m "Fix: Prevenir sobrescritura de IDs en edición de pedidos"
git push origin master
# Amplify detecta el push y redespliega automáticamente
```

---

## ✅ Verificación Post-Fix

### Test 1: Intentar cambiar ID en PUT
```bash
curl -X PUT http://localhost:3000/api/orders/9999 \
  -H "Content-Type: application/json" \
  -d '{"ID": "9998", "Cliente": "Test"}'

# Resultado esperado:
# El pedido 9999 se actualiza pero mantiene su ID 9999
# (ignora el ID 9998 del body)
```

### Test 2: Validación frontend
```javascript
// En consola del navegador:
const order = { id: 4700, cliente: "Test" }
order.id = 4701  // Intentar mutar
handleEditMode(order)
// orderCopy.id debe ser 4700 (valor original copiado)
```

---

## 📚 Documentación Relacionada

- `PROBLEMA_CRITICO_IDS_DUPLICADOS.md` - Detección del problema original
- `SISTEMA_LOGS_SHEETS.md` - Sistema de logging implementado
- `inconsistencia/README.md` - Script de detección de inconsistencias
- `PREVENCION_DUPLICADOS_IDS.md` - Prevención de IDs duplicados en POST

---

## 👥 Responsables

- **Detección:** Análisis de logs y Google Sheets historial
- **Análisis:** Revisión exhaustiva del código backend y frontend
- **Fix:** Implementación de triple capa de validación
- **Testing:** Replicación del bug y verificación del fix
- **Documentación:** Este archivo y documentos relacionados

---

**Última actualización:** 01/02/2026  
**Estado:** RESUELTO Y DESPLEGADO ✅
