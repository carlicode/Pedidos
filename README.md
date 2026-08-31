# Sistema de Pedidos - EcoDelivery

Sistema completo de gestión de pedidos con integración a Google Sheets y DynamoDB.

## 🚀 Stack Tecnológico

### Frontend
- **React** + Vite
- **React Router** para navegación
- **Google Sheets API** para datos

### Backend
- **Node.js** + Express
- **AWS DynamoDB** para usuarios
- **AWS Secrets Manager** para credenciales
- **Google Sheets API** para integración

### Infraestructura AWS
- **AWS Amplify** para hosting del frontend
- **Elastic Beanstalk** para el backend API
- **DynamoDB** para base de datos
- **Secrets Manager** para credenciales seguras
- **CloudWatch** para logs y monitoreo

## 💻 Desarrollo Local

### Requisitos

- Node.js >= 18
- npm >= 9
- AWS CLI configurado (para deployment)
- Google Service Account credentials

### Setup

1. **Instalar dependencias:**
   ```bash
   npm run install:all
   # O manualmente:
   # npm install && cd frontend && npm install && cd ../backend && npm install && cd ..
   ```

2. **Configurar variables de entorno:**
   
   **Backend:**
   ```bash
   cp backend/env.example backend/.env
   # Editar backend/.env con tus credenciales
   ```
   
   **Frontend:**
   ```bash
   # Crear frontend/.env para desarrollo local
   echo "VITE_API_URL=http://localhost:5055" > frontend/.env
   ```

3. **Iniciar desarrollo:**

   **Opción A - Ambos servicios:**
   ```bash
   npm run dev
   ```

   **Opción B - Separados:**
   
   **Terminal 1 - Backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:5055

## 📁 Estructura del Proyecto

```
Pedidos/
├── frontend/                # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/         # Páginas principales
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # Servicios API
│   │   └── utils/         # Utilidades
│   ├── public/            # Assets estáticos
│   └── package.json
│
├── backend/               # Backend Node.js
│   ├── index.js          # Servidor Express
│   ├── routes/           # Rutas API
│   ├── middleware/       # Middleware personalizado
│   ├── utils/            # Utilidades backend
│   ├── scripts/          # Scripts de deployment y migración
│   └── package.json
│
├── shared/               # Código compartido
│   └── utils/           # Utilidades compartidas
│
├── docs/                # Documentación
│   ├── DEPLOY_BACKEND.md
│   ├── DEPLOY_FRONTEND.md
│   ├── DEPLOY_CHECKLIST.md
│   └── SETUP.md
│
└── README.md            # Este archivo
```

## 🔐 Seguridad

### Credenciales en Desarrollo

Las credenciales se gestionan mediante variables de entorno en `backend/.env`:
- Google Service Account JSON
- Google Maps API Key
- JWT Secret
- Sheet IDs

### Credenciales en Producción (AWS)

En producción, todas las credenciales se almacenan en **AWS Secrets Manager**:
- ✅ Google Service Account JSON
- ✅ Google Maps API Key
- ✅ JWT Secret
- ✅ Todas las configuraciones sensibles

**Nunca** commitees archivos con credenciales:
- `beezero-*.json`
- `*.pem`, `*.key`
- `backend/.env`, `frontend/.env`
- Carpeta `secret/`

### Gestión de Sesiones

El sistema implementa un mecanismo robusto de **invalidación automática de tokens JWT**:

✅ **Características:**
- Tokens con ID único (`jti`) para trazabilidad
- Invalidación automática al reiniciar servidor
- Detección automática de reinicios en el frontend
- Logout con invalidación server-side
- Blacklist de tokens para seguridad adicional

✅ **¿Qué sucede cuando el servidor se reinicia?**
1. Frontend detecta automáticamente el reinicio (`checkServerRestart()`)
2. Cierra sesión automáticamente
3. Muestra mensaje claro: "El servidor se reinició. Por favor, inicie sesión nuevamente."
4. Redirige a login

✅ **Endpoints de Autenticación:**
```
POST /api/auth/login       - Login y generación de token
POST /api/auth/logout      - Logout e invalidación de token
GET  /api/auth/me          - Información del usuario autenticado
GET  /api/auth/server-info - Información pública del servidor (para sync)
```

📚 **Documentación Detallada:**
- [`docs/SESSION_MANAGEMENT.md`](docs/SESSION_MANAGEMENT.md) - Arquitectura técnica completa
- [`docs/SESSION_FIX_SUMMARY.md`](docs/SESSION_FIX_SUMMARY.md) - Resumen visual con ejemplos

🧪 **Testing del Sistema de Sesiones:**
```bash
cd backend
node scripts/test-session-management.mjs
```

## 📊 Funcionalidades

### Gestión de Pedidos
- ✅ Crear, editar, cancelar pedidos
- ✅ Asignar bikers
- ✅ Calcular distancias con Google Maps
- ✅ Cálculo automático de precios
- ✅ Estados: Pendiente → En Proceso → Entregado → Cancelado

### Clientes
- ✅ Vista de pedidos por cliente
- ✅ Formulario simplificado para clientes
- ✅ Tracking de pedidos
- ✅ Autenticación segura por backend

### Administración
- ✅ Dashboard con estadísticas
- ✅ Gestión de horarios
- ✅ Inventario (admin)
- ✅ Reportes y análisis
- ✅ Sistema de notas

### Integraciones
- ✅ Google Sheets (lectura/escritura)
- ✅ Google Maps (distancias y geolocalización)
- ✅ DynamoDB (persistencia de usuarios)
- ✅ WhatsApp (notificaciones)

## 📐 Cálculo de distancia y precio

Qué pasa, técnicamente, cuando el operador pega dos enlaces de Google Maps y aprieta calcular.

### 1. Limpieza y validación (frontend)

`utils/distanceCalculator.js` · `hooks/useDistanceCalculation.js`

`cleanGoogleMapsUrl()` quita espacios, paréntesis y basura pegada al inicio o final. `isValidMapsUrl()` rechaza lo que no sea un enlace de Maps antes de gastar una llamada a la API.

### 2. Enlace → coordenadas (backend)

`GET /api/distance-proxy?origins=<url>&destinations=<url>` → `expandUrlAndExtractCoordsCached()` en `backend/index.js`

Por cada enlace, en este orden:

1. **Buscar coordenadas en la URL** con 10 patrones regex, del más preciso al menos preciso:
   - `!8m2!3d<lat>!4d<lng>` — coordenadas del lugar, las más exactas
   - `!3d!4d`, `/search/lat,lng`, `q=`, `ll=`, `center=`
   - `@lat,lng,zoom` y `@lat,lng` — **el viewport de la cámara, no el lugar**; van al final justamente por eso
2. **Expandir el enlace corto** si es `maps.app.goo.gl`: un `GET` con `redirect: follow` (timeout 3 s) y se vuelven a aplicar los 10 patrones sobre la URL larga.
3. **Re-expandir** si la URL larga salió con el formato roto `/place//data=`.
4. **Geocodificar** el nombre del lugar sacado de `/place/<nombre>/` como último recurso.

Resultado: un string `"lat,lng"`. Se cachea 5 minutos (`urlExpansionCache`, máximo 100 entradas), así que pegar el mismo enlace dos veces no vuelve a expandirlo.

### 3. Coordenadas → distancia (backend)

`getShortestDrivingRoute()`

- Si **no** son coordenadas: **Directions API** con `alternatives=true` y se elige la ruta de **menor distancia** entre las alternativas (no la más rápida). Timeout 5 s.
- Si son coordenadas, o si Directions falla: **Distance Matrix API**.
- Ambas en `mode=driving`.

La respuesta se normaliza siempre al formato de Distance Matrix (`rows[0].elements[0].distance.value` en metros), sin importar de cuál de las dos APIs salió.

### 4. Distancia → km (frontend)

```js
distanceKm = (metros / 1000) + 0.025   // DISTANCE_BUFFER_KM, margen por percances
```

### 5. Km → precio (frontend)

`utils/priceCalculator.js` — **el único lugar donde vive la fórmula**. Los km se redondean **hacia arriba** (`Math.ceil`).

| Medio | Hasta 1 km | Km adicional | Fórmula |
|---|---|---|---|
| Bicicleta | 8 Bs | 2,50 Bs | `8 + (km−1) × 2,5` |
| Scooter | 8 Bs | 2,50 Bs | igual que Bicicleta |
| Cargo | 14 Bs | 2,50 Bs | `Bicicleta + 6` |
| Beezero (auto) | 10 Bs | 3,00 Bs | `10 + (km−1) × 3` |

Cualquier otro medio devuelve 0.

**Ejemplo:** 3.740 m → 3,74 km → +0,025 = 3,765 → `Math.ceil` = 4 km → `8 + 3 × 2,5` = **15,50 Bs**.

El **método de pago no altera el monto** (Efectivo, Cuenta, A cuenta, QR y Cortesía cobran igual). El precio es editable a mano: eso activa `precioEditadoManualmente`, que bloquea el recálculo — pero el flag se resetea al recalcular la distancia.

### 6. Guardado

El backend **no recalcula el precio**: guarda el `precio_bs` que recibe. La validación es solo del lado del cliente.

### Detalles a tener en cuenta

- La distancia de **bicicleta se mide en modo auto**: ignora ciclovías, contramanos y atajos.
- El buffer de 0,025 km se suma **antes** del `Math.ceil`, así que una distancia real de 3,99 km se cobra como 5 km.
- Los patrones `@lat,lng` devuelven el centro del mapa, no el lugar. Si el enlace no trae coordenadas de lugar, la distancia sale aproximada.
- Los **precios especiales por cliente** que figuran en el sheet de clientes (`tabla`, `Bs10,50`, `2bs más`, rangos) **no están implementados**: se aplican a mano.

## 🛠️ Scripts Disponibles

### Monorepo (Raíz)
```bash
npm run dev              # Inicia frontend y backend
npm run install:all      # Instala todas las dependencias
npm run build:frontend   # Build del frontend
npm run start:backend    # Inicia backend en producción
```

### Frontend
```bash
cd frontend
npm run dev              # Desarrollo (puerto 5173)
npm run build            # Build para producción
npm run preview          # Preview del build
```

### Backend
```bash
cd backend
npm run dev              # Desarrollo con nodemon
npm start                # Producción
```

## 🚀 Deployment a AWS

### Pre-requisitos
1. Cuenta de AWS configurada
2. AWS CLI instalado y configurado
3. Credenciales migradas a Secrets Manager

### Deployment del Backend (Elastic Beanstalk)

```bash
# Crear y desplegar por primera vez
./backend/scripts/eb-create.sh

# Actualizar código
./backend/scripts/eb-deploy.sh

# Ver estado
./backend/scripts/eb-status.sh

# Ver logs
./backend/scripts/eb-logs.sh

# Pausar (ahorrar costos)
./backend/scripts/eb-stop.sh

# Reanudar
./backend/scripts/eb-start.sh
```

Ver documentación completa en [`docs/DEPLOY_BACKEND.md`](docs/DEPLOY_BACKEND.md)

### Deployment del Frontend (AWS Amplify)

1. Conecta tu repositorio Git a AWS Amplify
2. Configura variables de entorno en Amplify:
   ```
   VITE_API_URL=<URL-del-backend-en-elastic-beanstalk>
   ```
3. Amplify detectará automáticamente el `amplify.yml`
4. Deploy automático en cada push a `master`

Ver documentación completa en [`docs/DEPLOY_FRONTEND.md`](docs/DEPLOY_FRONTEND.md)

### Migración de Usuarios a DynamoDB

Si necesitas migrar usuarios del archivo hardcodeado a DynamoDB:

```bash
cd backend
node scripts/migrate-users-to-dynamodb.mjs
```

## 🐛 Troubleshooting

### Frontend no conecta con Backend

1. **Desarrollo Local:**
   - Verifica que el backend esté corriendo en `http://localhost:5055`
   - Revisa las variables de entorno en `backend/.env`
   - Verifica que no haya errores en la consola del backend

2. **Producción:**
   - Verifica que `VITE_API_URL` esté configurada en Amplify
   - Verifica que el backend esté corriendo en Elastic Beanstalk
   - Revisa CORS en `backend/index.js`

### Errores de autenticación

1. **Desarrollo:**
   - Verifica que el archivo de Google Service Account esté en la ubicación correcta
   - Revisa que las credenciales en `.env` sean correctas
   - Verifica que el JWT secret esté configurado

2. **Producción:**
   - Verifica que los secretos existan en AWS Secrets Manager
   - Verifica permisos IAM del rol de Elastic Beanstalk
   - Revisa logs en CloudWatch

### Health Check Failing

```bash
# Local
curl http://localhost:5055/health

# Producción
curl https://tu-backend.elasticbeanstalk.com/health
```

El endpoint `/health` muestra el estado de todos los servicios:
- AWS Secrets Manager
- DynamoDB
- Google Sheets API
- Google Maps API

## 📚 Documentación Adicional

### Deployment y Setup
- [`docs/SETUP.md`](docs/SETUP.md) - Setup inicial completo
- [`docs/DEPLOY_BACKEND.md`](docs/DEPLOY_BACKEND.md) - Deploy del backend
- [`docs/DEPLOY_FRONTEND.md`](docs/DEPLOY_FRONTEND.md) - Deploy del frontend
- [`docs/DEPLOY_CHECKLIST.md`](docs/DEPLOY_CHECKLIST.md) - Checklist completo

### Seguridad y Autenticación
- [`docs/SESSION_MANAGEMENT.md`](docs/SESSION_MANAGEMENT.md) - Sistema de gestión de sesiones y tokens
- [`docs/SESSION_FIX_SUMMARY.md`](docs/SESSION_FIX_SUMMARY.md) - Resumen de solución a sesiones persistentes
- [`docs/MEJORAS_IMPLEMENTADAS.md`](docs/MEJORAS_IMPLEMENTADAS.md) - Mejoras de seguridad pre-deployment

### Optimización y Performance
- [`docs/MAPS_VALIDATION_SYSTEM.md`](docs/MAPS_VALIDATION_SYSTEM.md) - Sistema optimizado de validación de Maps
- [`docs/PLAN_OPTIMIZACION.md`](docs/PLAN_OPTIMIZACION.md) - Plan completo de refactorización
- [`docs/PLAN_OPTIMIZACION_RESUMEN.md`](docs/PLAN_OPTIMIZACION_RESUMEN.md) - Resumen ejecutivo del plan
- [`docs/REFACTORING_CHECKLIST.md`](docs/REFACTORING_CHECKLIST.md) - Checklist paso a paso

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es privado y confidencial.

## 👥 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.

---

**Última actualización**: Enero 2026 - Configurado para AWS
