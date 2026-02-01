# Detección de Carreras Eliminadas

## Problema

Las carreras aparecen **desordenadas por fecha de creación** (ej.: ID 3776 con Fecha Registro 08/01/2026 después de ID 3775 con 31/01/2026). Eso suele indicar:

1. **Filas eliminadas** en el Google Sheet (manual o por script), de modo que el orden de filas ya no es cronológico.
2. **Sobrescrituras pasadas** (antes de la corrección del 30/01/2026), donde un pedido reemplazaba a otro.

El **log en AWS** (Elastic Beanstalk / CloudWatch) registra cada creación de pedido y cada “próximo ID”. Comparando ese log con el estado actual del Sheet se puede ver si hubo carreras eliminadas.

---

## Cómo identificar si se eliminaron carreras

### 1. Usar el script de análisis de logs (recomendado)

En la raíz del proyecto (o desde `backend/`):

```bash
./backend/scripts/eb-logs-analyze-carreras.sh
```

Por defecto analiza las **últimas 2000 líneas** del log de EB. Para más historial:

```bash
./backend/scripts/eb-logs-analyze-carreras.sh 10000
```

El script:

- Descarga el log desde AWS (mismo flujo que `eb-logs.sh`).
- Extrae:
  - **IDs creados** (`Added new order #N`).
  - **Próximos IDs generados** (`Próximo ID generado: N`).
  - **Advertencias de ID duplicado** (intentos de crear con ID ya usado).
  - **Huecos** en la secuencia de IDs creados en ese tramo del log.

Interpretación:

- Si un ID aparece en el log como **creado** y **no está** en el Sheet actual → esa carrera fue eliminada (o movida de hoja).
- Muchas líneas de “ID ya existe” / “Nuevo ID asignado” indican conflictos de IDs (el backend evita sobrescribir generando otro ID).

### 2. Revisar el log manualmente

Obtener la URL del log (el script la imprime al final) o usar:

```bash
./backend/scripts/eb-logs.sh
```

Luego, con la URL que te muestre:

```bash
# Ver todo el log
curl -s "URL_DEL_LOG" | less

# Solo IDs de pedidos creados
curl -s "URL_DEL_LOG" | grep -oE 'Added new order #[0-9]+'

# Solo “próximo ID”
curl -s "URL_DEL_LOG" | grep 'Próximo ID generado'

# Posibles duplicados / conflictos
curl -s "URL_DEL_LOG" | grep -E 'ya existe|ADVERTENCIA|Nuevo ID asignado'
```

Comparando esos IDs con la columna **ID** del Sheet actual puedes ver qué IDs “creados” ya no están.

### 3. Audit log local (si tienes acceso al servidor)

El archivo `backend/logs/audit/audit-log.json` (en el servidor, **no** en AWS por defecto porque suele estar en `.ebignore`) registra cada **CREAR** y **EDITAR** con `orderId`.

Si tienes una copia de ese archivo:

```bash
# Contar operaciones por tipo
cat audit-log.json | jq -r '.[] | .action' | sort | uniq -c

# Listar todos los IDs que aparecen como CREAR
cat audit-log.json | jq -r '.[] | select(.action=="CREAR") | .orderId' | sort -n
```

Compara esa lista de IDs con los que hay hoy en el Sheet: los que estén en el audit como CREAR y no en el Sheet son candidatos a carreras eliminadas.

---

## Desorden por Fecha Registro (como en tu captura)

Si ves en el Sheet algo así:

| ID   | Fecha Registro | ... |
|------|------------------|-----|
| 3774 | 30/01/2026      |     |
| 3775 | 31/01/2026      |     |
| 3776 | **08/01/2026**  |     |

En un sistema que **solo agrega filas al final** (append), el último ID (3776) debería tener la Fecha Registro más reciente. Que 3776 tenga 08/01 y esté después de 3775 (31/01) indica:

- **Filas eliminadas**: antes había más filas entre 3775 y 3776 (o en otro lugar), se borraron y el orden dejó de ser cronológico; o  
- **Edición manual** de la fecha de 3776 en el Sheet.

Por tanto, el desorden por Fecha Registro es un **indicio fuerte** de que se están eliminando (o eliminaron) carreras. El log en AWS sirve para **confirmar** qué IDs se crearon y cuáles ya no están en el Sheet.

---

## Resumen de pasos

1. Ejecutar:  
   `./backend/scripts/eb-logs-analyze-carreras.sh [líneas]`
2. Anotar los IDs que aparecen como **creados** en el log.
3. Comparar con la columna **ID** del Sheet actual.
4. Los IDs que estén en el log y no en el Sheet → carreras eliminadas (o en otra hoja).
5. Revisar también **Historial de versiones** del Google Sheet (Archivo → Historial de versiones) para ver quién eliminó filas y cuándo.

---

**Script:** `backend/scripts/eb-logs-analyze-carreras.sh`  
**Log en AWS:** Elastic Beanstalk → ambiente `pedidos-backend-prod` → solicitar “tail” (o usar el script que descarga por URL).
