# Detección de filas inconsistentes (Registros)

Script para identificar filas que pueden corresponder a carreras sobrescritas o datos inconsistentes.

## Reglas aplicadas

| Regla | Descripción |
|-------|-------------|
| **FECHA_INCONSISTENTE** | La Fecha Registro difiere más de 3 días de la mediana de las 5 filas anteriores y 5 posteriores. Si la fecha es distinta al “bloque” de fechas vecinas, la fila se marca como observada. |
| **FECHA_INVERTIDA** | Al ir por orden de filas (IDs crecientes), la fecha de una fila es muy posterior a la de la fila siguiente. Sugiere fila reemplazada o insertada. |
| **FECHA_INVALIDA** | La celda de Fecha Registro está vacía o no tiene formato DD/MM/YYYY. |
| **FECHA_VACIA** | Sin Fecha Registro. |
| **ID_DUPLICADO** | El mismo ID aparece en más de una fila. |

## Uso

Desde la carpeta del proyecto:

```bash
node inconsistencia/detectar-filas-inconsistentes.mjs
```

Con otro CSV:

```bash
node inconsistencia/detectar-filas-inconsistentes.mjs --csv="ruta/a/otro-registros.csv"
```

## Salida

- **Consola**: listado de filas inconsistentes con número de fila (en el Sheet), ID, Fecha Registro, Operador, Cliente y motivos.
- **Archivo**: `inconsistencia/filas-inconsistentes-reporte.json` con el mismo detalle en JSON (para filtrar por regla, ID, etc.).

## Parámetros (en el script)

- `WINDOW_SIZE = 5`: número de filas antes/después para calcular la “ventana” de fechas.
- `MAX_DAYS_DIFFERENCE = 3`: diferencia máxima en días respecto a la mediana de la ventana para considerar la fecha consistente.

Puedes editarlos en `detectar-filas-inconsistentes.mjs` si quieres afinar la detección.
