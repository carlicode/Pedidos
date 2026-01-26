# 🔄 Reiniciar Backend para Aplicar Cambios

## SHEET_ID Configurado ✅

El Google Sheet ID ha sido actualizado en el `.env`:

```bash
CLIENT_INFO_SHEET_ID=1YhEpo6EBdCEm15y6xnEeUDiViJEItQAU23yHTzBkRIM
CLIENT_INFO_SHEET_NAME=Hoja 1
```

---

## 🚀 Cómo Reiniciar el Backend

### Opción 1: Reinicio Rápido (nodemon)
En el terminal donde está corriendo el backend, escribe:
```
rs
```
Y presiona Enter. Nodemon reiniciará automáticamente.

### Opción 2: Reinicio Manual
1. En el terminal del backend, presiona `Ctrl + C`
2. Ejecuta:
   ```bash
   npm run dev
   ```

---

## ✅ Verificar que Funciona

Después de reiniciar:

1. **Verificar logs del backend**:
   - Debe mostrar: `✅ Secretos cargados exitosamente desde AWS Secrets Manager`
   - NO debe mostrar errores de `PENDIENTE_ID_DEL_SHEET`

2. **Probar en el frontend**:
   - Selecciona un cliente (ej: "Aldeas SOS")
   - Click en el botón **ℹ️**
   - Debe mostrar la información del cliente sin error

---

## 📊 Ejemplo de Búsqueda

Si seleccionas **"Aldeas SOS"**, debería mostrar:

1. **aldeas sos - CAPTACION**
   - Cuenta: CUENTA
   - Procedimientos: FACTURA A NOMBRE DE ALDEAS
   - Etiqueta: 🔴

2. **aldeas sos-Logistica**
   - Cuenta: CUENTA
   - Procedimientos: ESCRIBIR Y CORDINAR...
   - Etiqueta: 🔴

---

## 🐛 Si Hay Errores

### Error: "Requested entity was not found"
**Causa**: El sheet no está compartido con la cuenta de servicio

**Solución**:
1. Abrir el Google Sheet
2. Click en "Compartir"
3. Agregar: `ecodelivery.b@beezero-9fcc9255ca80.iam.gserviceaccount.com`
4. Dar permisos de "Viewer" o "Editor"

### Error: "Permission denied"
**Causa**: La cuenta de servicio no tiene permisos

**Solución**: Igual que el anterior, verificar permisos de compartir

---

_Configuración completada: 2026-01-26_
