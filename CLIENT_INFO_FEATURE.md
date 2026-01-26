# 📋 Feature: Información del Cliente desde Google Sheets

**Fecha**: 2026-01-26  
**Estado**: ✅ Implementado (falta configurar SHEET_ID)

---

## 🎯 Descripción

Nuevo botón "ℹ️" al lado del botón de recargar clientes que muestra información detallada del cliente desde un Google Sheet.

### Características:
- ✅ Búsqueda por subcadena (case insensitive)
- ✅ Muestra múltiples registros si coinciden
- ✅ Diseño responsive y profesional
- ✅ Botón deshabilitado si no hay cliente seleccionado

### Ejemplo:
Si seleccionas "Aldeas SOS", mostrará:
- `aldeas sos - CAPTACION`
- `aldeas sos-Logistica`  
- Cualquier otro registro que contenga "aldeas sos"

---

## 📂 Archivos Creados

### Backend:
1. `/backend/routes/clientInfo.js` - Endpoint para obtener info del cliente
2. Modificado: `/backend/index.js` - Registro de la ruta

### Frontend:
1. `/frontend/src/components/ClientInfoModal.jsx` - Modal para mostrar la información
2. `/frontend/src/styles/ClientInfoModal.css` - Estilos del modal
3. Modificado: `/frontend/src/pages/Orders.jsx` - Botón e integración

### Configuración:
1. Modificado: `.env` - Variables del Google Sheet
2. Copiado: `backend/.env` - Variables del backend

---

## ⚙️ Configuración Pendiente

### 🔴 IMPORTANTE: Configurar SHEET_ID

Necesitas actualizar el `.env` con el SHEET_ID del documento "clientes eco/ documento de introduccion".

**Archivo**: `.env` y `backend/.env`

**Línea a modificar**:
```bash
CLIENT_INFO_SHEET_ID=PENDIENTE_ID_DEL_SHEET
```

**Cómo obtener el SHEET_ID**:
1. Abre el Google Sheet en tu navegador
2. Mira la URL: `https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit`
3. Copia el ID que está entre `/d/` y `/edit`
4. Reemplaza `PENDIENTE_ID_DEL_SHEET` con ese ID

**Ejemplo**:
```bash
# Antes
CLIENT_INFO_SHEET_ID=PENDIENTE_ID_DEL_SHEET

# Después (ejemplo con ID ficticio)
CLIENT_INFO_SHEET_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890
```

---

## 🧪 Cómo Probar en Local

### Paso 1: Configurar el SHEET_ID
```bash
# Editar .env
nano .env

# Buscar la línea CLIENT_INFO_SHEET_ID
# Reemplazar PENDIENTE_ID_DEL_SHEET con tu SHEET_ID real

# Copiar al backend
cp .env backend/.env
```

### Paso 2: Levantar el Backend
```bash
cd /Users/carli.code/Desktop/Pedidos/backend
npm run dev
```

**Verificar**:
- ✅ Debe mostrar: `🚀 Server running on port 5055`
- ✅ Sin errores de "CLIENT_INFO_SHEET_ID no configurado"

### Paso 3: Levantar el Frontend
```bash
cd /Users/carli.code/Desktop/Pedidos/frontend
npm run dev
```

**Verificar**:
- ✅ Debe mostrar: `Local: http://localhost:5173`

### Paso 4: Probar la Funcionalidad

1. **Abrir navegador**: `http://localhost:5173`
2. **Login**: Usuario admin
3. **Ir a**: Pestaña "Agregar Pedido"
4. **Seleccionar cliente**: Por ejemplo, "Aldeas SOS"
5. **Click en botón ℹ️**: Debe abrir el modal
6. **Verificar**: Debe mostrar información del cliente

---

## 📊 Estructura del Google Sheet

**Hoja**: "Hoja 1"

**Columnas esperadas** (en orden A-F):
1. **NOMBRES DE CLIENTES** - Nombre del cliente
2. **CUENTA** - Información de la cuenta
3. **PROCEDIMIENTOS** - Procedimientos aplicables
4. **ETIQUETA** - Etiqueta o categoría
5. **envios** - Información de envíos
6. **TIPO DE PAGO** - Forma de pago

**Ejemplo de datos**:
```
| NOMBRES DE CLIENTES        | CUENTA | PROCEDIMIENTOS | ETIQUETA | envios | TIPO DE PAGO |
|----------------------------|--------|----------------|----------|--------|--------------|
| aldeas sos - CAPTACION     | 12345  | Delivery       | VIP      | 50     | Efectivo     |
| aldeas sos-Logistica       | 12346  | Pickup         | Normal   | 30     | Transferencia|
```

---

## 🔍 Lógica de Búsqueda

La búsqueda es **flexible y case-insensitive**:

- Si seleccionas: `"Aldeas SOS"`
- Buscará en el Google Sheet cualquier registro donde el nombre contenga: `"aldeas sos"` (ignorando mayúsculas/minúsculas)
- Mostrará **TODOS** los registros que coincidan

**Ejemplos de coincidencias**:
- ✅ `"aldeas sos - CAPTACION"` → Coincide
- ✅ `"ALDEAS SOS-Logistica"` → Coincide
- ✅ `"Aldeas SOS Centro"` → Coincide
- ❌ `"SOS International"` → NO coincide (no contiene "aldeas")

---

## 🎨 UI/UX

### Botón de Información
- **Posición**: Al lado izquierdo del botón de recargar (🔄)
- **Icono**: ℹ️
- **Comportamiento**:
  - ✅ Habilitado: Si hay un cliente seleccionado
  - 🚫 Deshabilitado: Si no hay cliente o es personalizado
  - 💡 Tooltip: "Ver información del cliente"

### Modal
- **Diseño**: Moderno, responsive
- **Tamaño**: Máximo 800px de ancho
- **Scroll**: Automático si hay muchos registros
- **Estados**:
  - 🔄 Loading: Spinner mientras carga
  - ✅ Éxito: Muestra tarjetas con la información
  - ⚠️ Error: Mensaje de error si falla
  - 📭 Vacío: "No se encontró información para este cliente"

---

## 🐛 Troubleshooting

### Error: "CLIENT_INFO_SHEET_ID no configurado"
**Solución**: Configurar el SHEET_ID en el `.env`

### Error: "Google Service Account JSON no disponible"
**Solución**: 
1. Verificar que AWS Secrets Manager esté configurado
2. O verificar que el archivo de credenciales local exista

### Error: 403 o "Permission denied"
**Solución**: 
1. Verificar que el Google Sheet esté compartido con la cuenta de servicio
2. Email de la cuenta de servicio: `ecodelivery.b@...`
3. Dar permisos de "Viewer" o "Editor"

### No encuentra registros
**Solución**:
1. Verificar que el nombre de la hoja sea "Hoja 1"
2. Verificar que las columnas estén en el orden correcto (A-F)
3. Verificar que hay datos en el sheet
4. Probar con un nombre más corto (ej: "aldeas" en lugar de "aldeas sos")

---

## 📝 Notas Técnicas

### Endpoint Backend
```
GET /api/client-info/:clientName
```

**Ejemplo de request**:
```javascript
fetch('http://localhost:5055/api/client-info/Aldeas%20SOS')
```

**Ejemplo de response**:
```json
{
  "data": [
    {
      "nombreCliente": "aldeas sos - CAPTACION",
      "cuenta": "12345",
      "procedimientos": "Delivery",
      "etiqueta": "VIP",
      "envios": "50",
      "tipoPago": "Efectivo"
    },
    {
      "nombreCliente": "aldeas sos-Logistica",
      "cuenta": "12346",
      "procedimientos": "Pickup",
      "etiqueta": "Normal",
      "envios": "30",
      "tipoPago": "Transferencia"
    }
  ]
}
```

### Autenticación
- Usa AWS Secrets Manager en producción
- Fallback a variables de entorno en desarrollo local
- Permisos: `spreadsheets.readonly`

---

## ✅ Checklist de Testing

- [ ] Backend levanta sin errores
- [ ] Frontend levanta sin errores
- [ ] Botón ℹ️ aparece al lado del botón recargar
- [ ] Botón está deshabilitado sin cliente seleccionado
- [ ] Botón se habilita al seleccionar un cliente
- [ ] Modal se abre al hacer click en el botón
- [ ] Modal muestra "Cargando..." mientras busca
- [ ] Modal muestra los registros correctos
- [ ] Búsqueda por subcadena funciona correctamente
- [ ] Múltiples registros se muestran correctamente
- [ ] Modal se cierra al hacer click en "Cerrar"
- [ ] Modal se cierra al hacer click fuera

---

_Generado: 2026-01-26_
