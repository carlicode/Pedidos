# Sistema de Auditoría de Pedidos

## 📋 Descripción

Sistema completo de auditoría que registra **TODAS** las operaciones sobre pedidos en un archivo JSON. Cada creación, edición o eliminación queda registrada con:
- ✅ Timestamp exacto (hora de Bolivia)
- ✅ Acción realizada (CREAR, EDITAR, ELIMINAR)
- ✅ Operador que realizó la acción
- ✅ IP y User-Agent del cliente
- ✅ **TODOS los datos del pedido completos**
- ✅ En ediciones: datos antes/después + lista de cambios

## 📁 Ubicación del Archivo

### Archivo Principal
```
backend/logs/audit/audit-log.json
```

Este archivo contiene **TODO el historial** de operaciones desde que se activó el sistema.

### Archivos de Backup (Rotación Automática)
```
backend/logs/audit/audit-log-backup-YYYY-MM-DDTHH-MM-SS.json
```

Cuando el archivo principal alcanza 100MB, se crea un backup automáticamente y se inicia uno nuevo.

## 🔍 Estructura del JSON

### Ejemplo de CREAR pedido:
```json
{
  "timestamp": "2026-01-30T05:50:00.000Z",
  "action": "CREAR",
  "orderId": "4735",
  "operator": "Carli",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "data": {
    "ID": "4735",
    "Fecha Registro": "30/01/2026",
    "Hora Registro": "05:50:00",
    "Operador": "Carli",
    "Cliente": "Ejemplo Cliente",
    "Recojo": "Terminal",
    "Entrega": "Universidad",
    "Direccion Recojo": "https://maps.app.goo.gl/xxx",
    "Direccion Entrega": "https://maps.app.goo.gl/yyy",
    "Detalles de la Carrera": "Entrega de documentos",
    "Dist. [Km]": 5.2,
    "Medio Transporte": "Bicicleta",
    "Precio [Bs]": 20,
    "Biker": "",
    "Estado": "Pendiente",
    ... (todos los demás campos)
  },
  "metadata": {
    "logFile": "audit-log.json"
  }
}
```

### Ejemplo de EDITAR pedido:
```json
{
  "timestamp": "2026-01-30T06:15:00.000Z",
  "action": "EDITAR",
  "orderId": "4735",
  "operator": "Miguel",
  "ip": "192.168.1.101",
  "userAgent": "Mozilla/5.0...",
  "data": {
    ... (todos los campos con los nuevos valores)
  },
  "before": {
    "ID": "4735",
    "Biker": "",
    "Estado": "Pendiente",
    "Hora Ini": "",
    ... (solo campos que existían antes)
  },
  "changes": {
    "Biker": {
      "before": "",
      "after": "Eddy callizaya"
    },
    "Estado": {
      "before": "Pendiente",
      "after": "En Ruta"
    },
    "Hora Ini": {
      "before": "",
      "after": "06:10:00"
    }
  },
  "metadata": {
    "logFile": "audit-log.json",
    "rowIndex": 802,
    "updatedCells": 31
  }
}
```

## 🔎 Cómo Buscar Información

### 1. Ver historial completo de un pedido

Busca todas las entradas con el `orderId` específico:

```bash
# En terminal
grep -A 50 '"orderId": "4735"' backend/logs/audit/audit-log.json

# O usando jq (más elegante)
cat backend/logs/audit/audit-log.json | jq '.[] | select(.orderId == "4735")'
```

### 2. Detectar sobrescrituras

Busca si hay múltiples "CREAR" con el mismo ID:

```bash
cat backend/logs/audit/audit-log.json | jq '.[] | select(.action == "CREAR") | .orderId' | sort | uniq -d
```

Si hay IDs duplicados en la salida, significa que ese pedido se creó múltiples veces (posible sobrescritura).

### 3. Ver operaciones de un operador

```bash
cat backend/logs/audit/audit-log.json | jq '.[] | select(.operator == "Miguel")'
```

### 4. Ver operaciones de hoy

```bash
TODAY=$(date +%Y-%m-%d)
cat backend/logs/audit/audit-log.json | jq ".[] | select(.timestamp | startswith(\"$TODAY\"))"
```

### 5. Contar operaciones por tipo

```bash
cat backend/logs/audit/audit-log.json | jq -r '.[] | .action' | sort | uniq -c
```

Salida ejemplo:
```
  150 CREAR
   45 EDITAR
    2 ELIMINAR
```

## 🌐 API Endpoints

### 1. Obtener historial de un pedido

```bash
GET http://localhost:5055/api/audit/order/:id
```

**Ejemplo:**
```bash
curl http://localhost:5055/api/audit/order/4735
```

**Respuesta:**
```json
{
  "success": true,
  "orderId": "4735",
  "count": 3,
  "logs": [
    { ... entrada más reciente ... },
    { ... entrada anterior ... },
    { ... entrada más antigua ... }
  ]
}
```

### 2. Obtener estadísticas generales

```bash
GET http://localhost:5055/api/audit/stats
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "totalOperations": 197,
    "byAction": {
      "CREAR": 150,
      "EDITAR": 45,
      "ELIMINAR": 2
    },
    "byOperator": {
      "Carli": 80,
      "Miguel": 70,
      "Ana": 47
    },
    "byDate": {
      "2026-01-28": 45,
      "2026-01-29": 82,
      "2026-01-30": 70
    },
    "recentOverwrites": [
      {
        "orderId": "4720",
        "timestamp": "2026-01-28T22:50:00.000Z",
        "operator": "Miguel"
      }
    ],
    "suspiciousActivities": []
  }
}
```

### 3. Listar archivos de audit log

```bash
GET http://localhost:5055/api/audit/files
```

**Respuesta:**
```json
{
  "success": true,
  "files": {
    "main": {
      "filename": "audit-log.json",
      "path": "/ruta/completa/audit-log.json",
      "size": 5242880,
      "sizeHuman": "5 MB",
      "entries": 197,
      "created": "2026-01-30T05:00:00.000Z",
      "modified": "2026-01-30T06:50:00.000Z",
      "oldestEntry": "2026-01-28T18:00:00.000Z",
      "newestEntry": "2026-01-30T06:50:00.000Z"
    },
    "backups": []
  }
}
```

## 🚨 Casos de Uso

### Detectar pedido sobrescrito

**Problema:** El operador reporta que el pedido #4720 desapareció.

**Solución:**
```bash
# Ver historial completo del pedido
curl http://localhost:5055/api/audit/order/4720 | jq '.'

# O localmente:
cat backend/logs/audit/audit-log.json | jq '.[] | select(.orderId == "4720")'
```

**Análisis:**
- Si ves **1 entrada "CREAR"**: El pedido se creó normalmente
- Si ves **2+ entradas "CREAR"**: ¡Se sobrescribió! (esto no debería pasar con la nueva corrección)
- Si ves **"EDITAR"**: Mira el campo `changes` para ver qué cambió

### Rastrear cambios en un pedido

**Problema:** ¿Quién cambió el biker del pedido #4735?

```bash
cat backend/logs/audit/audit-log.json | jq '.[] | select(.orderId == "4735" and .action == "EDITAR") | {timestamp, operator, changes: .changes.Biker}'
```

### Ver actividad sospechosa

**Problema:** ¿Hubo IDs duplicados hoy?

```bash
curl http://localhost:5055/api/audit/stats | jq '.stats.recentOverwrites'
```

## 🔧 Mantenimiento

### Tamaño del archivo

El archivo rota automáticamente al alcanzar **100MB**. Para verificar el tamaño actual:

```bash
du -h backend/logs/audit/audit-log.json
```

### Backup manual

```bash
# Crear backup del audit log
cp backend/logs/audit/audit-log.json backend/logs/audit/audit-log-backup-$(date +%Y%m%d).json
```

### Limpiar logs antiguos

**⚠️ CUIDADO:** Solo hacer si estás seguro de no necesitar el historial antiguo.

```bash
# Mantener solo últimos 30 días
# (Esto requiere implementación adicional con filtrado por fecha)
```

## 📊 Análisis con Python (Opcional)

```python
import json
import pandas as pd

# Cargar audit log
with open('backend/logs/audit/audit-log.json', 'r') as f:
    logs = json.load(f)

# Convertir a DataFrame
df = pd.DataFrame(logs)

# Análisis
print(df['action'].value_counts())
print(df['operator'].value_counts())

# Ver pedidos editados múltiples veces
edited = df[df['action'] == 'EDITAR'].groupby('orderId').size()
print(edited[edited > 1])
```

## ✅ Verificación

Para verificar que el sistema está funcionando:

1. **Crear un pedido** en la web
2. **Verificar que se registró:**
   ```bash
   tail -100 backend/logs/audit/audit-log.json | jq '.[-1]'
   ```
3. **Editar ese pedido**
4. **Verificar el registro de edición:**
   ```bash
   tail -100 backend/logs/audit/audit-log.json | jq '.[-1]'
   ```

Deberías ver ambas entradas con toda la información.

## 🔒 Seguridad

- ✅ El archivo está en `.gitignore` (no se sube a GitHub)
- ✅ El archivo está en `.ebignore` (no se sube a AWS)
- ✅ Solo el backend tiene acceso al archivo
- ✅ Los endpoints de audit requieren estar autenticado

## 📝 Notas

- El sistema se activa automáticamente al crear o editar pedidos
- No afecta el rendimiento (escritura asíncrona)
- Si hay error al escribir el log, no interrumpe la operación principal
- El timestamp usa hora de Bolivia (UTC-4)

---

**Sistema implementado:** 30 de Enero 2026  
**Ubicación:** `backend/utils/auditLogger.js`
