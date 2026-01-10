# 🐝 Beezy App

Sistema de gestión de pedidos y entregas para Beezy - Plataforma de delivery y logística.

## 📋 Descripción

Beezy App es una aplicación web completa para gestionar pedidos, entregas, inventarios, cuentas de bikers y notas del equipo. El sistema permite crear, editar y rastrear pedidos, calcular distancias automáticamente usando Google Maps API, gestionar inventarios de empresas, y facilitar la comunicación entre operadores mediante notas.

## ✨ Características Principales

### 🚚 Gestión de Pedidos
- Creación, edición y duplicación de pedidos
- Cálculo automático de distancias usando Google Maps
- Validación automática de links de Google Maps
- Cálculo automático de precios según distancia y medio de transporte
- Gestión de estados de pedidos (Pendiente, En carrera, Entregado, Cancelado)
- Vista Kanban para visualización de pedidos
- Filtros por fecha (día, semana, mes, rango personalizado)
- Exportación a PDF con plantillas personalizables

### 💰 Cotización Rápida
- Modal de cotización rápida con botón flotante
- Cálculo instantáneo de distancia y precio
- Validación automática de links de Google Maps
- Llenado automático del formulario de pedido

### 📝 Sistema de Notas del Equipo
- Creación de notas para comunicación entre operadores
- Marcar notas como resueltas con descripción de resolución
- Filtros por estado (Todas, Pendientes, Resueltas)
- Eliminación de notas (marcado como "Eliminado")
- Burbuja flotante con contador de notas pendientes
- Acceso rápido desde cualquier página del sistema

### 📱 WhatsApp Integration
- Generación automática de mensajes de WhatsApp
- Formato estándar con información completa del pedido
- Links directos de Google Maps incluidos
- Información adicional de recogida y entrega

### 📍 Validación de Links
- Validación automática de links de Google Maps
- Indicadores visuales (✅ válido, ❌ inválido)
- Mensajes informativos sobre el estado del link

### 🏢 Gestión de Empresas
- Base de datos de empresas con direcciones predefinidas
- Gestión de inventarios por empresa
- Cuentas y pagos por empresa
- Reportes de cobros y pagos

### 🚴 Gestión de Bikers
- Asignación de bikers a pedidos
- Cuentas y pagos de bikers
- Disponibilidad y horarios
- Cálculo automático de cuentas pendientes

### 📊 Dashboard
- Estadísticas y métricas
- Visualización de datos en tiempo real
- Reportes personalizados

### 👥 Sistema de Usuarios
- Autenticación de usuarios
- Roles: Admin, Operador, Cliente
- Acceso diferenciado según rol
- Clientes pueden ver solo sus pedidos e inventario

## 🛠️ Tecnologías

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Base de Datos**: Google Sheets API
- **APIs Externas**: 
  - Google Maps API (Distance Matrix, Directions, Geocoding, Places)
  - Google Sheets API
- **Estilos**: CSS personalizado con soporte para dark mode
- **PDF**: jsPDF, html2canvas para generación de reportes
- **Notificaciones**: react-toastify

## 📦 Instalación

### Requisitos Previos
- Node.js (v16 o superior)
- npm o yarn
- Cuenta de Google Cloud con APIs habilitadas:
  - Google Maps Distance Matrix API
  - Google Maps Directions API
  - Google Maps Geocoding API
  - Google Maps Places API
  - Google Sheets API
- Archivo de credenciales de Google Service Account (JSON)

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/Beezy-app.git
cd Beezy-app
```

2. **Instalar dependencias del frontend**
```bash
npm install
```

3. **Instalar dependencias del backend**
```bash
cd server
npm install
cd ..
```

4. **Configurar variables de entorno**

Crear archivo `.env` en la raíz del proyecto:
```env
# Google Sheets
SHEET_ID=tu_sheet_id
SHEET_NAME=Registros
SERVICE_ACCOUNT_FILE=ruta/a/tu/service-account.json

# Google Maps API
GOOGLE_MAPS_API_KEY=tu_api_key

# Backend
PORT=5055
VITE_BACKEND_URL=http://localhost:5055
```

Crear archivo `server/.env`:
```env
PORT=5055
SHEET_ID=tu_sheet_id
SHEET_NAME=Registros
SERVICE_ACCOUNT_FILE=ruta/a/tu/service-account.json
GOOGLE_MAPS_API_KEY=tu_api_key
```

5. **Configurar Google Sheets**

Crear las siguientes pestañas en tu Google Sheet:
- **Registros**: Para los pedidos (ver estructura en `server/index.js`)
- **Notas**: Para las notas del equipo con columnas:
  - ID, Estado, Fecha Creación, Operador, Descripción, Resuelto por, Fecha Resolución, Descripción resolución

6. **Iniciar el servidor de desarrollo**
```bash
npm run dev:all
```

Esto iniciará tanto el frontend (puerto 5173) como el backend (puerto 5055).

## 🚀 Uso

### Desarrollo
```bash
# Iniciar frontend y backend simultáneamente
npm run dev:all

# Solo frontend
npm run client

# Solo backend
npm run server
```

### Producción
```bash
# Build del frontend
npm run build

# Iniciar servidor de producción
cd server
npm start
```

## 📁 Estructura del Proyecto

```
Beezy-app/
├── src/
│   ├── components/          # Componentes React
│   │   ├── forms/           # Formularios de pedidos
│   │   ├── orders/          # Componentes de pedidos
│   │   └── ...
│   ├── pages/               # Páginas principales
│   │   ├── Orders.jsx       # Gestión de pedidos
│   │   ├── Notes.jsx        # Notas del equipo
│   │   ├── Dashboard.jsx
│   │   └── ...
│   ├── hooks/               # Custom hooks
│   │   ├── useAuth.js
│   │   ├── useKanban.js
│   │   ├── useWhatsApp.js
│   │   └── ...
│   ├── services/            # Servicios de API
│   │   ├── ordersService.js
│   │   ├── notesService.js
│   │   ├── dateService.js
│   │   ├── pdfService.js
│   │   └── ...
│   ├── utils/               # Utilidades
│   │   ├── api.js
│   │   ├── whatsAppUtils.js
│   │   └── ...
│   └── styles/              # Estilos CSS
├── server/
│   ├── routes/              # Rutas de la API
│   │   ├── auth.js
│   │   ├── client.js
│   │   └── notes.js
│   ├── middleware/          # Middlewares
│   │   └── auth.js
│   ├── utils/               # Utilidades del servidor
│   │   ├── dynamodb.js
│   │   └── secrets.js
│   └── index.js             # Servidor principal
├── public/                  # Archivos estáticos
└── package.json
```

## 🔐 Seguridad

- Las credenciales y API keys se almacenan en archivos `.env` (no incluidos en el repositorio)
- Autenticación basada en roles
- Validación de datos en frontend y backend
- Rutas protegidas con middleware de autenticación

## 📝 Notas Importantes

- El sistema usa Google Sheets como base de datos
- Se requiere conexión a internet para usar las APIs de Google Maps
- Los archivos de credenciales (`*.json`) no deben subirse al repositorio
- Asegúrate de configurar correctamente los permisos del Service Account en Google Cloud

## 🎯 Funcionalidades Recientes

- ✅ Sistema de notas del equipo con resolución y descripciones
- ✅ Modularización del código para mejor mantenibilidad
- ✅ Servicio centralizado de fechas (formato DD/MM/YYYY consistente)
- ✅ Servicio modular de generación de PDFs
- ✅ Hooks personalizados para Kanban y WhatsApp
- ✅ Integración completa de WhatsApp con mensajes formateados

## 🤝 Contribución

Este es un proyecto privado. Para contribuir, contacta al administrador del repositorio.

## 📄 Licencia

Privado - Todos los derechos reservados

## 👥 Autores

Equipo Beezy

---

**Versión**: 2.0.0  
**Última actualización**: Enero 2026
