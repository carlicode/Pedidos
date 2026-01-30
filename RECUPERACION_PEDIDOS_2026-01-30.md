# Recuperación de Pedidos Perdidos - 30 de Enero 2026

## Problema Identificado

### ¿Qué pasó?
Se descubrió un bug crítico en el sistema que causaba que pedidos se **sobrescribieran** en lugar de borrarse. Esto explica por qué:
- Faltan IDs en la secuencia (ej: ID 4720 no aparece)
- Las horas de registro están desordenadas
- Operadores reportan que carreras "desaparecieron"

### IDs Reportados como Perdidos
Según el operador:
- **4720** - Carrera de "aldeas sos de nelson"
- **4726** - Carrera de "upaya" (este SÍ aparece en el sheet pero puede haberse sobrescrito)
- Carreras de **jorge daza** y **nelson**

### Causa Técnica
El endpoint `POST /api/orders` tenía lógica que:
1. Detectaba si un ID ya existía
2. En lugar de generar un ID nuevo, **SOBRESCRIBÍA** el pedido existente
3. El pedido original se perdía

Esto ocurría cuando:
- Dos operadores obtenían el mismo ID por problemas de caché/timing
- Un operador intentaba crear un pedido con un ID que ya existía

## Solución Implementada (Commit b3fed91)

### Cambios Realizados
✅ `POST /api/orders` ahora **SIEMPRE** genera un nuevo ID si detecta duplicado  
✅ **NUNCA** sobrescribe filas existentes  
✅ Logs mejorados para detectar cuándo ocurre esto  

### Código Corregido
```javascript
// ANTES (PELIGROSO):
if (existingRowIndex > 0) {
  // Actualizaba (sobrescribía) fila existente ❌
  await sheets.spreadsheets.values.update(...)
}

// DESPUÉS (SEGURO):
if (existingRowIndex > 0) {
  // Genera NUEVO ID y agrega como NUEVA fila ✅
  const newId = Math.max(...existingIds) + 1
  await sheets.spreadsheets.values.append(...)
}
```

## Cómo Recuperar Pedidos Perdidos

### Opción 1: Historial de Versiones de Google Sheets (RECOMENDADO)

Google Sheets guarda un historial completo de cambios:

1. **Abrir el Google Sheet**
   - Ve a la hoja "Registros"

2. **Acceder al Historial**
   - Menú: `Archivo` → `Historial de versiones` → `Ver historial de versiones`
   - O usa el atajo: `Ctrl + Alt + Shift + H` (Windows) / `Cmd + Option + Shift + H` (Mac)

3. **Buscar la Fecha/Hora del Problema**
   - El operador reportó los problemas alrededor de las **6:51 PM - 6:58 PM del 28/01/2026**
   - Busca versiones anteriores a esa hora

4. **Restaurar Versión o Copiar Datos**
   - Opción A: Restaurar toda la hoja a esa versión
   - Opción B: Copiar las filas de los pedidos perdidos y pegarlas en la hoja actual

5. **IDs a Buscar:**
   ```
   - ID 4720 (aldeas sos de nelson)
   - Cualquier carrera de "jorge daza" en ese rango
   - Buscar por cliente: "nelson", "jorge daza", "upaya"
   ```

### Opción 2: Revisar Logs del Servidor

Si el backend estaba corriendo en ese momento, los logs pueden contener información de los pedidos sobrescritos:

```bash
# Buscar en logs por esos IDs
grep -r "4720" /ruta/a/logs/
grep -r "jorge daza" /ruta/a/logs/
grep -r "aldeas sos" /ruta/a/logs/
```

### Opción 3: Preguntar a los Operadores

Los operadores que crearon esos pedidos pueden tener:
- Capturas de pantalla
- Mensajes de WhatsApp con los clientes
- Información de los pedidos en sus notas

## Pedidos que Necesitan Revisión

Basándose en la imagen del sheet, estos pedidos tienen horas de registro sospechosas y deben verificarse:

| ID | Fecha Registro | Hora Registro | Operador | Cliente | Notas |
|----|---------------|---------------|----------|---------|-------|
| 4721 | 28/01/2026 | 17:45:42 | Miguel | Totto Aranjuez | ✅ Hora normal |
| 4722 | 29/01/2026 | 17:46:21 | Ana | UNICEF ESTADIL | ⚠️ Hora del día anterior? |
| 4723 | 28/01/2026 | 17:46:56 | Miguel | Il Gato | ✅ Hora normal |
| 4724 | 28/01/2026 | 18:37:02 | Carli | Abasto St | ✅ Hora normal |
| 4725 | 28/01/2026 | 18:38:31 | Miguel | Abuelita R | ✅ Hora normal |
| 4726 | 29/01/2026 | 18:46:20 | Miguel | **Upaya** | ⚠️ Reportado como perdido |
| 4727 | 29/01/2026 | 08:43:03 | Ana | Mangat | ⚠️ Hora muy temprana |
| 4728 | 29/01/2026 | 09:01:40 | Ana | Optica R | ⚠️ Hora temprana |

### Análisis de Horas Desordenadas

Las horas muestran un patrón sospechoso:
- **28/01 tarde:** 17:45 → 17:46 → 18:37 → 18:38
- **29/01 tarde:** 18:46 (salto raro)
- **29/01 mañana:** 08:43 → 09:01 → 09:38 → 09:50...

Esto sugiere que pedidos del 29/01 en la mañana **sobrescribieron** pedidos del 28/01 en la tarde.

## Prevención Futura

✅ **Corrección implementada:** POST nunca sobrescribe  
✅ **Logs mejorados:** Detecta cuando hay IDs duplicados  
🔄 **Próximos pasos:**
- Monitorear logs para ver si el problema se repite
- Revisar historial de Google Sheets periódicamente
- Implementar alertas cuando se detecten IDs duplicados

## Contacto

Si encuentras más pedidos perdidos o necesitas ayuda con la recuperación:
- Revisar este documento
- Consultar el historial de versiones de Google Sheets
- Contactar al equipo de desarrollo

---

**Fecha del incidente:** 28-29 de Enero 2026  
**Fecha de corrección:** 30 de Enero 2026  
**Commit de corrección:** b3fed91
