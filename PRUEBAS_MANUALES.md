# 🧪 Plan de Pruebas Manuales - Refactorización Orders.jsx

Este documento contiene todas las pruebas manuales necesarias para verificar que la refactorización de `Orders.jsx` funciona correctamente.

---

## 1️⃣ Pruebas Iniciales - Carga de Datos

### a) Cargar Pedidos
1. Abre la aplicación
2. Ve a la pestaña **"Ver Pedidos"**
3. Verifica que los pedidos se cargan correctamente desde Google Sheets
4. ✅ **Esperado**: Mensaje "✅ X pedidos cargados desde Google Sheets API"

### b) Cargar Clientes
1. Ve a la pestaña **"Agregar Pedido"**
2. Haz clic en el campo **"Cliente"**
3. ✅ **Esperado**: Se debe cargar la lista de clientes y mostrar "👥 X clientes cargados"

### c) Cargar Bikers
1. En **"Agregar Pedido"**
2. Haz clic en el campo **"Biker"**
3. ✅ **Esperado**: Se cargan los bikers con "🚴‍♂️ X bikers cargados para Agregar Pedido"

---

## 2️⃣ Crear Nuevo Pedido

1. Ve a **"Agregar Pedido"**
2. Llena todos los campos requeridos:
   - Cliente
   - Recojo (selecciona del dropdown o manual)
   - Entrega (selecciona del dropdown o manual)
   - Dirección recojo/entrega
   - Medio de transporte
   - Biker
3. Haz clic en **"Agregar Pedido"**
4. ✅ **Esperado**: 
   - Mensaje "✅ Pedido guardado en Google Sheet"
   - El pedido aparece en "Ver Pedidos"

---

## 3️⃣ Editar Pedido Existente

1. En **"Ver Pedidos"**, selecciona un pedido del Kanban
2. Haz clic en el botón de **editar** (lápiz)
3. Modifica algún campo (ej: cambiar el precio)
4. Guarda los cambios
5. ✅ **Esperado**: 
   - Mensaje "✅ Pedido actualizado en Google Sheet"
   - Los cambios se reflejan inmediatamente

---

## 4️⃣ Cambiar Estado de Pedido

1. En el Kanban, arrastra un pedido de **"Pendiente"** a **"En carrera"**
2. ✅ **Esperado**: Pedido cambia de columna
3. Arrastra de **"En carrera"** a **"Entregado"**
4. Completa el formulario de entrega (hora fin)
5. ✅ **Esperado**: Mensaje "✅ Pedido actualizado"

---

## 5️⃣ Cobros y Pagos

1. Ve a la pestaña **"Empresas"** (Cobros-Pagos)
2. Selecciona fechas de inicio y fin
3. Haz clic en **"Calcular"**
4. ✅ **Esperado**: 
   - Mensaje "💰 X clientes procesados con actividad financiera"
   - Se muestran los totales de cada cliente
   - Los descuentos se aplican correctamente

### Probar generación de PDF:
5. Selecciona un cliente específico
6. Haz clic en **"Generar PDF"**
7. ✅ **Esperado**: Se descarga el PDF con el resumen

---

## 6️⃣ Cuentas Biker

1. Ve a **"Cuentas Biker"**
2. Selecciona una fecha (filtro diario)
3. Haz clic en **"Calcular Cuentas"**
4. ✅ **Esperado**: 
   - Mensaje "✅ Cuentas calculadas"
   - Se muestran los bikers con sus entregas
   - El 70% se calcula correctamente
   - Pedidos "A cuenta" NO se incluyen en el pago del biker

### Probar filtro por rango:
5. Cambia a **"Por rango"**
6. Selecciona fecha inicio y fin
7. Calcula nuevamente
8. ✅ **Esperado**: Muestra datos del rango de fechas

---

## 7️⃣ Agregar Nuevo - Empresa

1. Ve a **"Agregar Nuevo"**
2. Selecciona **"Empresa"**
3. Completa los campos:
   - Empresa (nombre)
   - Mapa (URL de Google Maps)
   - Descripción (con teléfono)
4. Haz clic en **"Agregar Empresa"**
5. ✅ **Esperado**: 
   - Mensaje "✅ Empresa agregada exitosamente"
   - Se recarga la lista de empresas

---

## 8️⃣ Agregar Nuevo - Biker

1. En **"Agregar Nuevo"**
2. Selecciona **"Biker"**
3. Completa:
   - Nombre del biker
   - WhatsApp
4. Haz clic en **"Agregar Biker"**
5. ✅ **Esperado**: 
   - Mensaje "✅ Biker agregado exitosamente"
   - Se recarga la lista de bikers

---

## 9️⃣ Funciones de Fecha Boliviana

1. Crea un nuevo pedido
2. ✅ **Verifica** que:
   - La fecha de registro se guarda en formato DD/MM/YYYY
   - La hora de registro está en horario de Bolivia (UTC-4)
   - El campo "Día de la semana" se calcula correctamente

---

## 🔟 Filtros y Búsquedas

### En "Ver Pedidos":

1. **Filtro por día**:
   - Cambia la fecha del filtro
   - ✅ **Esperado**: Solo muestra pedidos de esa fecha

2. **Filtro por rango**:
   - Cambia a "Por rango"
   - Selecciona fecha inicio y fin
   - ✅ **Esperado**: Muestra pedidos del rango

3. **Barra de búsqueda**:
   - Busca por cliente, biker, o ID
   - ✅ **Esperado**: Filtra correctamente

---

## 1️⃣1️⃣ Duplicar Pedido

1. Selecciona un pedido existente
2. Haz clic en **"Duplicar"**
3. Selecciona múltiples fechas
4. Confirma la duplicación
5. ✅ **Esperado**: 
   - Mensaje "✅ X pedidos duplicados"
   - Los pedidos aparecen en las fechas seleccionadas
   - El "Día de la semana" se calcula para cada fecha

---

## 1️⃣2️⃣ Disponibilidad (Drivers/Bikers)

1. En **"Agregar Pedido"**
2. Haz clic en **"Disponibilidad Drivers"** o **"Disponibilidad Bikers"**
3. ✅ **Esperado**: Se abre un modal mostrando disponibilidad por día

---

## 1️⃣3️⃣ Pruebas de Segunda Etapa - Lógica de Negocio y Utilidades

### a) Constantes y Arrays (orderConstants.js)

1. En **"Agregar Pedido"**, verifica los dropdowns:
   - **Medio de Transporte**: Debe mostrar: Bicicleta, Cargo, Scooter, Beezero
   - **Método de Pago**: Debe mostrar: Efectivo, Cuenta, A cuenta, QR, Cortesía
   - **Estado de Pago**: Debe mostrar: Debe Cliente, Pagado, QR Verificado, Debe Biker, Error Admin, Error Biker, Espera, Sin Biker
   - **Estado**: Debe mostrar: Pendiente, En carrera, Entregado, Cancelado
2. ✅ **Esperado**: Todos los valores aparecen correctamente en los dropdowns

---

### b) Utilidades de Google Maps (mapsUtils.js)

#### Validación de Links de Google Maps:
1. En **"Agregar Pedido"**, cambia a modo **"Manual"** para Recojo
2. Pega un link válido de Google Maps (ej: `https://maps.app.goo.gl/xxxxx`)
3. ✅ **Esperado**: El link se acepta sin mostrar error
4. Pega un link inválido (ej: `https://example.com`)
5. ✅ **Esperado**: Muestra advertencia "⚠️ Por favor ingresa un enlace válido de Google Maps"

#### Generación Automática de Links:
1. En modo **"Manual"**, escribe una dirección (ej: "Plaza Murillo, La Paz")
2. ✅ **Esperado**: Se genera automáticamente un link de Google Maps en el campo de dirección

#### Limpieza de URLs:
1. Pega un link con espacios o paréntesis al inicio/final
2. ✅ **Esperado**: El link se limpia automáticamente al guardar

---

### c) Cálculo de Precios (priceCalculator.js)

#### Precio para Bicicleta:
1. Crea un pedido con:
   - Medio de transporte: **Bicicleta**
   - Distancia: **2.5 km**
2. Haz clic en **"Calcular Distancia"** (si hay direcciones)
3. ✅ **Esperado**: 
   - Distancia: 2.5 km
   - Precio: **12 Bs** (según tabla: ≤3km = 12 Bs)

#### Precio para Beezero:
1. Cambia medio de transporte a **Beezero**
2. Distancia: **2.5 km**
3. ✅ **Esperado**: Precio: **14 Bs** (Beezero inicia en 10 Bs, ≤3km = 14 Bs)

#### Precio para Cargo:
1. Cambia a **Cargo**
2. Distancia: **2.5 km**
3. ✅ **Esperado**: Precio: **18 Bs** (Bicicleta 12 Bs + 6 Bs = 18 Bs)

#### Precio para Scooter:
1. Cambia a **Scooter**
2. ✅ **Esperado**: No se calcula precio automáticamente (debe ser 0 o permitir entrada manual)

#### Precios para Distancias > 10km:
1. Distancia: **12 km**, Medio: **Bicicleta**
2. ✅ **Esperado**: Precio: **30 Bs** (26 Bs base + 2 Bs × 2 km adicionales = 30 Bs)

---

### d) Cálculo de Distancias (distanceCalculator.js)

1. En **"Agregar Pedido"**, ingresa:
   - Dirección de recojo: Link válido de Google Maps
   - Dirección de entrega: Link válido de Google Maps
2. Haz clic en **"📏 Calcular Distancia"**
3. ✅ **Esperado**: 
   - Muestra notificación "🔄 Calculando distancia..."
   - Luego muestra "📏 Distancia: X.XX km • 💰 Precio: X Bs"
   - La distancia incluye buffer de 0.025 km (0.25 cuadras)

#### Manejo de Errores:
1. Ingresa un link inválido o vacío
2. Intenta calcular distancia
3. ✅ **Esperado**: Muestra modal de error con detalles del problema

---

### e) Validación de Formularios (formValidator.js)

#### Campos Requeridos:
1. Intenta guardar un pedido sin completar campos obligatorios:
   - Sin cliente
   - Sin medio de transporte
   - Sin biker
   - Sin fecha
2. ✅ **Esperado**: Muestra mensaje de error listando todos los campos faltantes

#### Validación de Precio:
1. Ingresa un precio negativo (ej: -10)
2. ✅ **Esperado**: Muestra error "El precio debe ser un número mayor o igual a 0"

#### Validación de WhatsApp:
1. Ingresa un WhatsApp con menos de 8 dígitos (ej: "1234567")
2. ✅ **Esperado**: Muestra error "El número de WhatsApp debe tener al menos 8 dígitos"

#### Validación de Cobro/Pago:
1. Selecciona "Cobro" o "Pago" pero deja el monto vacío
2. ✅ **Esperado**: Muestra error "Si hay cobro o pago, el monto debe ser mayor a 0"

#### Modo "Cliente avisa":
1. Selecciona "Cliente avisa" para recojo y entrega
2. Intenta guardar sin completar esos campos
3. ✅ **Esperado**: Permite guardar (no requiere recojo/entrega en modo "Cliente avisa")

---

### f) Helpers de Datos (dataHelpers.js)

#### getEmpresaMapa:
1. En **"Agregar Pedido"**, selecciona una empresa del dropdown de Recojo
2. ✅ **Esperado**: Se auto-completa automáticamente la dirección (URL de Google Maps) de esa empresa

#### getClienteInfo:
1. Selecciona un cliente del dropdown
2. ✅ **Esperado**: Si el cliente tiene descripción, se muestra correctamente

#### calculateDayOfWeek:
1. Selecciona una fecha en el campo "Fecha del Pedido"
2. ✅ **Esperado**: El campo "Día de la semana" se calcula automáticamente (ej: Lunes, Martes, etc.)
3. Prueba con diferentes fechas:
   - Fecha: 2025-01-15 → Día: Miércoles
   - Fecha: 2025-01-20 → Día: Lunes

---

### g) Formateo de Datos (formatHelpers.js)

#### formatDateForDisplay:
1. En **"Ver Pedidos"**, verifica que las fechas se muestren en formato **DD/MM/YYYY**
2. ✅ **Esperado**: Todas las fechas aparecen como "15/01/2025" (no "2025-01-15")
3. Verifica en el formulario de edición que las fechas también se formatean correctamente

---

## 🚨 Errores Críticos a Verificar

Si alguna de estas pruebas falla, revisar inmediatamente:

| Error | Causa Probable | Servicio Afectado |
|-------|---------------|-------------------|
| ❌ No se cargan los pedidos | Error en carga desde Google Sheets | `ordersService.loadOrdersFromSheet` |
| ❌ No se guarda un nuevo pedido | Error al guardar en Google Sheets | `ordersService.saveOrderToSheet` |
| ❌ No se actualizan pedidos | Error en actualización | `ordersService.updateOrderInSheet` |
| ❌ Cobros/pagos no calculan | Error en cálculos financieros | `clientesService.calculateCobrosPagos` |
| ❌ Fechas incorrectas | Error en zona horaria Bolivia | `dateUtils.js` |
| ❌ Clientes no cargan | Error en CSV de clientes | `clientesService.loadClientes` |
| ❌ Bikers no cargan | Error en CSV de bikers | `bikersService.loadBikersForAgregar` |
| ❌ Precios no se calculan | Error en cálculo de precios | `priceCalculator.calculatePrice` |
| ❌ Distancias no se calculan | Error en API de Google Maps | `distanceCalculator.calculateDistance` |
| ❌ Validaciones no funcionan | Error en validación de formularios | `formValidator.validateForm` |
| ❌ Links de Maps no se validan | Error en utilidades de Maps | `mapsUtils.validateGoogleMapsLink` |
| ❌ Día de semana incorrecto | Error en cálculo de día | `dataHelpers.calculateDayOfWeek` |
| ❌ Fechas mal formateadas | Error en formateo | `formatHelpers.formatDateForDisplay` |

---

## 📋 Checklist de Pruebas

Marca cada elemento después de probarlo:

### Carga de Datos
- [ ] Pedidos se cargan correctamente desde Google Sheets
- [ ] Clientes se cargan desde CSV
- [ ] Bikers se cargan desde CSV
- [ ] Empresas se cargan desde CSV

### Operaciones CRUD
- [ ] Crear nuevo pedido
- [ ] Editar pedido existente
- [ ] Actualizar estado de pedido (drag & drop en Kanban)
- [ ] Marcar pedido como entregado (con formulario)
- [ ] Cancelar pedido

### Cálculos Financieros
- [ ] Calcular cobros y pagos por cliente
- [ ] Aplicar descuentos correctamente
- [ ] Generar PDF de resumen de cliente
- [ ] Generar sheet de empresas

### Cuentas Biker
- [ ] Calcular cuentas diarias
- [ ] Calcular cuentas por rango de fechas
- [ ] Verificar que 70% se calcula correctamente
- [ ] Verificar que "A cuenta" no se paga al biker
- [ ] Filtro por efectivo funciona

### Agregar Datos
- [ ] Agregar nueva empresa
- [ ] Agregar nuevo biker
- [ ] Empresas se recargan después de agregar
- [ ] Bikers se recargan después de agregar

### Funcionalidades Avanzadas
- [ ] Duplicar pedido en múltiples fechas
- [ ] Ver disponibilidad de drivers
- [ ] Ver disponibilidad de bikers
- [ ] Notificaciones se muestran correctamente

### Filtros y Búsquedas
- [ ] Filtro por día funciona
- [ ] Filtro por rango de fechas funciona
- [ ] Búsqueda por texto funciona
- [ ] Ordenamiento de pedidos es correcto

### Fechas y Zona Horaria
- [ ] Fechas se guardan en formato DD/MM/YYYY
- [ ] Horas están en zona horaria Bolivia (UTC-4)
- [ ] Día de la semana se calcula correctamente
- [ ] Fecha actual por defecto es de Bolivia

### Interfaz de Usuario
- [ ] Todos los tabs funcionan
- [ ] Modales se abren y cierran correctamente
- [ ] Botones responden adecuadamente
- [ ] Mensajes de notificación aparecen

### Segunda Etapa - Lógica de Negocio
- [ ] Constantes y arrays se muestran correctamente en dropdowns
- [ ] Validación de links de Google Maps funciona
- [ ] Generación automática de links de Maps funciona
- [ ] Cálculo de precios para Bicicleta es correcto
- [ ] Cálculo de precios para Beezero es correcto
- [ ] Cálculo de precios para Cargo es correcto (Bicicleta + 6 Bs)
- [ ] Scooter no calcula precio automáticamente
- [ ] Precios para distancias > 10km se calculan correctamente
- [ ] Cálculo de distancias funciona con links válidos
- [ ] Buffer de 0.025 km se aplica a las distancias
- [ ] Validación de formularios detecta campos faltantes
- [ ] Validación de precio negativo funciona
- [ ] Validación de WhatsApp funciona
- [ ] Validación de cobro/pago funciona
- [ ] Modo "Cliente avisa" permite guardar sin direcciones
- [ ] Auto-completado de direcciones de empresas funciona
- [ ] Cálculo automático de día de la semana funciona
- [ ] Formateo de fechas para mostrar es correcto (DD/MM/YYYY)

---

## 💡 Consejos para las Pruebas

### Antes de Empezar:
1. **Abre la consola del navegador** (F12) para ver errores en tiempo real
2. **Limpia el caché** del navegador si has hecho cambios recientes
3. **Verifica que el servidor backend esté corriendo** (si aplica)

### Durante las Pruebas:
1. **Prueba con datos reales** para mejor validación
2. **Verifica las notificaciones** - todas las operaciones deben mostrar mensajes
3. **Anota cualquier comportamiento extraño**, aunque no sea un error crítico
4. **Prueba en diferentes navegadores** si es posible (Chrome, Firefox, Safari)

### Si Encuentras un Error:
Anota la siguiente información:
- ✏️ **Qué estabas haciendo**: Pasos exactos que seguiste
- 🔴 **Mensaje de error**: Texto completo del error (si hay)
- 🎯 **Qué esperabas que pasara**: Comportamiento esperado
- 📸 **Captura de pantalla**: Si es posible
- 🖥️ **Navegador y versión**: Chrome 120, Firefox 121, etc.
- ⏰ **Fecha y hora**: Cuándo ocurrió el error

### Logs de la Consola:
Si ves errores en la consola, busca:
```
❌ Error: Cannot read property 'X' of undefined
❌ TypeError: X is not a function
❌ ReferenceError: X is not defined
❌ Failed to fetch
```

---

## 🏁 Resultado de Pruebas

### Estado General
- [ ] ✅ Todas las pruebas pasaron
- [ ] ⚠️ Algunas pruebas fallaron (especificar abajo)
- [ ] ❌ Múltiples pruebas críticas fallaron

### Notas Adicionales
```
(Espacio para notas sobre las pruebas realizadas)

Fecha de pruebas: _______________
Probado por: _______________
Navegador: _______________
Versión: _______________

Problemas encontrados:
1. 
2. 
3. 

Sugerencias de mejora:
1. 
2. 
3. 
```

---

## 📞 Soporte

Si encuentras problemas durante las pruebas:
1. Revisa este documento primero
2. Verifica la consola del navegador para errores
3. Revisa los archivos de servicio creados en la refactorización:
   - `/src/services/ordersService.js`
   - `/src/services/clientesService.js`
   - `/src/services/bikersService.js`
   - `/src/services/reportsService.js`
   - `/src/services/sheetsService.js`
   - `/src/utils/dateUtils.js`

4. Revisa los archivos de la segunda etapa de refactorización:
   - `/src/constants/orderConstants.js` - Constantes y arrays
   - `/src/utils/mapsUtils.js` - Utilidades de Google Maps
   - `/src/utils/priceCalculator.js` - Cálculo de precios
   - `/src/utils/distanceCalculator.js` - Cálculo de distancias
   - `/src/utils/formValidator.js` - Validación de formularios
   - `/src/utils/dataHelpers.js` - Helpers de datos
   - `/src/utils/formatHelpers.js` - Formateo de datos

---

**Última actualización**: Diciembre 2025  
**Versión de refactorización**: 2.0 - Extracción de Lógica de Negocio y Utilidades

