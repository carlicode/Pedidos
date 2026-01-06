# 🐝 Beezy App

Sistema de gestión de pedidos y entregas para Beezy - Plataforma de delivery y logística.

## 📋 Descripción

Beezy App es una aplicación web completa para gestionar pedidos, entregas, inventarios y cuentas de bikers. El sistema permite crear, editar y rastrear pedidos, calcular distancias automáticamente usando Google Maps API, y gestionar inventarios de empresas.

## ✨ Características Principales

### 🚚 Gestión de Pedidos
- Creación y edición de pedidos
- Cálculo automático de distancias usando Google Maps
- Validación automática de links de Google Maps
- Cálculo automático de precios según distancia y medio de transporte
- Gestión de estados de pedidos (Pendiente, En carrera, Entregado, Cancelado)
- Vista Kanban para visualización de pedidos

### 💰 Cotización Rápida
- Modal de cotización rápida con botón flotante
- Cálculo instantáneo de distancia y precio
- Validación automática de links de Google Maps
- Llenado automático del formulario de pedido

### 📍 Validación de Links
- Validación automática de links de Google Maps
- Indicadores visuales (✅ válido, ❌ inválido)
- Mensajes informativos sobre el estado del link

### 🏢 Gestión de Empresas
- Base de datos de empresas con direcciones predefinidas
- Gestión de inventarios por empresa
- Cuentas y pagos por empresa

### 🚴 Gestión de Bikers
- Asignación de bikers a pedidos
- Cuentas y pagos de bikers
- Disponibilidad y horarios

### 📊 Dashboard
- Estadísticas y métricas
- Visualización de datos en tiempo real

### 👥 Sistema de Usuarios
- Autenticación de usuarios
- Roles: Admin, Operador, Cliente
- Acceso diferenciado según rol

## 🛠️ Tecnologías

- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **Base de Datos**: Google Sheets API
- **APIs Externas**: Google Maps API (Distance Matrix, Directions, Geocoding, Places)
- **Estilos**: CSS personalizado con soporte para dark mode

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
SERVICE_ACCOUNT_FILE=/Users/carli.code/Desktop/Pedidos/beezero-62dea82962da.json

# Google Maps API
GOOGLE_MAPS_API_KEY=tu_api_key

# Backend
PORT=5055
VITE_BACKEND_URL=http://localhost:5055
```

5. **Iniciar el servidor de desarrollo**
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
│   ├── components/       # Componentes React
│   │   ├── CotizacionModal.jsx
│   │   ├── FormularioPedidoCliente.jsx
│   │   ├── NovedadesModal.jsx
│   │   └── ...
│   ├── pages/            # Páginas principales
│   │   ├── Orders.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Login.jsx
│   │   └── ...
│   ├── hooks/            # Custom hooks
│   ├── utils/            # Utilidades
│   └── styles.css        # Estilos globales
├── server/
│   ├── routes/           # Rutas de la API
│   ├── utils/            # Utilidades del servidor
│   └── index.js          # Servidor principal
├── public/               # Archivos estáticos
└── package.json
```

## 🔐 Seguridad

- Las credenciales y API keys se almacenan en archivos `.env` (no incluidos en el repositorio)
- Autenticación basada en roles
- Validación de datos en frontend y backend

## 📝 Notas Importantes

- El sistema usa Google Sheets como base de datos
- Se requiere conexión a internet para usar las APIs de Google Maps
- Los archivos de credenciales (`beezero-62dea82962da.json`) no deben subirse al repositorio

## 🤝 Contribución

Este es un proyecto privado. Para contribuir, contacta al administrador del repositorio.

## 📄 Licencia

Privado - Todos los derechos reservados

## 👥 Autores

Equipo Beezy

---

**Versión**: 1.0.0  
**Última actualización**: 2024
