# 🚀 Pedidos - Sistema de Gestión de Pedidos

Sistema completo de gestión de pedidos con integración a Google Sheets, cálculo de distancias con Google Maps, y autenticación segura.

## 🌟 Características

- ✅ Gestión completa de pedidos (Agregar, Editar, Cancelar, Entregar)
- ✅ Integración con Google Sheets para almacenamiento
- ✅ Cálculo automático de distancias y precios
- ✅ Validación de direcciones con Google Maps
- ✅ Sistema de notas del equipo
- ✅ Gestión de inventarios
- ✅ Horarios de bikers
- ✅ Dashboard con kanban
- ✅ Autenticación JWT segura
- ✅ Logs profesionales con Winston

## 🏗️ Stack Tecnológico

### Frontend
- React 18
- Vite
- React Router
- Lucide React (iconos)
- HTML2Canvas + jsPDF (reportes)

### Backend
- Node.js + Express
  - Google Sheets API
- Google Maps API (Distance Matrix, Geocoding)
- AWS DynamoDB (usuarios)
- AWS Secrets Manager (credenciales)
- Winston (logging)

## 📦 Instalación Local

### Prerrequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- AWS CLI configurado
- Cuenta de AWS con acceso a DynamoDB y Secrets Manager

### Setup

```bash
# 1. Clonar repositorio
git clone <tu-repo>
cd Pedidos

# 2. Instalar dependencias del frontend
npm install

# 3. Instalar dependencias del backend
cd server
npm install
cd ..

# 4. Configurar variables de entorno
cp server/env.example server/.env
# Editar server/.env con tus valores

# 5. Verificar que los secretos de AWS están configurados
node server/scripts/verify-secrets.mjs
```

## 🚀 Ejecución Local

### Opción 1: Todo junto
```bash
npm run dev:all
```

### Opción 2: Separado

Terminal 1 - Backend:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

## 🌐 Deploy a AWS Amplify

### ⚡ Quick Start

```bash
# 1. Commitear cambios
git add .
git commit -m "feat: Deploy a producción"
git push origin master

# 2. Verificar configuración
./server/scripts/pre-deploy-check.sh

# 3. Seguir la guía de deploy
```

### 📚 Documentación de Deploy

- **[SETUP_COMPLETO.md](./SETUP_COMPLETO.md)** - Resumen ejecutivo completo ⭐
- **[DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)** - Guía paso a paso detallada
- **[DEPLOY_AWS.md](./DEPLOY_AWS.md)** - Documentación técnica completa

### 🔐 Seguridad

Todas las credenciales están protegidas:
- ✅ Google Maps API Key → AWS Secrets Manager
- ✅ Google Service Account → AWS Secrets Manager
- ✅ Sheet IDs → AWS Secrets Manager
- ✅ JWT Secret → AWS Secrets Manager
- ✅ Archivos sensibles en .gitignore

## 🛠️ Scripts Disponibles

### Frontend
```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run preview      # Preview del build
```

### Backend
```bash
npm run server       # Iniciar servidor
cd server && npm run dev  # Con nodemon
```

### Deploy
```bash
# Verificar secretos en AWS
node server/scripts/verify-secrets.mjs

# Migrar secretos a AWS
node server/scripts/migrate-secrets-to-aws.mjs

# Configurar permisos IAM
./server/scripts/setup-iam-permissions.sh

# Verificación completa pre-deploy
./server/scripts/pre-deploy-check.sh
```

## 📁 Estructura del Proyecto

```
Pedidos/
├── src/                      # Frontend React
│   ├── components/          # Componentes
│   ├── pages/              # Páginas
│   ├── hooks/              # Custom hooks
│   ├── services/           # Servicios API
│   └── utils/              # Utilidades
├── server/                  # Backend Node.js
│   ├── routes/             # Rutas API
│   ├── middleware/         # Middlewares
│   ├── utils/              # Utilidades
│   └── scripts/            # Scripts de deploy
├── public/                 # Assets estáticos
├── amplify.yml            # Config AWS Amplify
└── package.json           # Dependencias

Documentación:
├── SETUP_COMPLETO.md      # ⭐ Empieza aquí
├── DEPLOY_CHECKLIST.md    # Guía de deploy
└── DEPLOY_AWS.md          # Docs técnicas
```

## 🔧 Configuración

### Variables de Entorno (server/.env)

```bash
# Google Sheets
SHEET_ID=tu_sheet_id
SHEET_NAME=Registros
INVENTARIO_SHEET_ID=tu_inventario_id

# AWS (para producción)
AWS_REGION=us-east-1
AWS_SECRET_NAME=pedidos/prod/all-secrets

# Puerto
PORT=5055
```

### Variables de Entorno para Amplify

```bash
AWS_REGION=us-east-1
AWS_SECRET_NAME=pedidos/prod/all-secrets
NODE_ENV=production
PORT=5055
```

## 🧪 Testing

### Probar Login
```bash
# Local
curl -X POST http://localhost:5055/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"usuario","password":"password"}'

# Producción (reemplaza con tu URL)
curl -X POST https://main.dXXXXXX.amplifyapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"usuario","password":"password"}'
```

## 📊 Endpoints API

### Autenticación
- `POST /api/auth/login` - Login de usuario

### Clientes
- `GET /api/client/clientes` - Listar clientes
- Requiere autenticación JWT

### Notas
- `GET /api/notes` - Obtener notas
- `POST /api/notes` - Crear nota
- `PUT /api/notes/:id` - Actualizar nota
- `DELETE /api/notes/:id` - Eliminar nota

## 💰 Costos Estimados (AWS)

- **AWS Amplify**: ~$15-30/mes
- **AWS Secrets Manager**: ~$0.40/mes
- **AWS DynamoDB**: Free tier (25 GB storage)
- **Total**: ~$16-31/mes

## 🆘 Troubleshooting

### Error: "No se pudo calcular la distancia"
- Verifica que GOOGLE_MAPS_API_KEY está configurada
- Verifica que las APIs están habilitadas en Google Cloud Console

### Error: "Access Denied to Secrets Manager"
- Verifica que el rol de Amplify tiene la política adjunta
- Ejecuta: `./server/scripts/setup-iam-permissions.sh`

### Error: "Google Sheets API error"
- Verifica que GOOGLE_SERVICE_ACCOUNT_JSON está en AWS Secrets
- Verifica que la cuenta de servicio tiene acceso al spreadsheet

## 📚 Recursos

- [Guía de Deploy Completa](./SETUP_COMPLETO.md)
- [AWS Amplify Docs](https://docs.amplify.aws/)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Google Maps API](https://developers.google.com/maps)

## 👥 Usuarios

Los usuarios se gestionan en AWS DynamoDB. Para agregar usuarios, usa el script en `server/scripts/` o la consola de DynamoDB.

## 🔄 Actualizar Secretos

```bash
# Método 1: Script automatizado
node server/scripts/migrate-secrets-to-aws.mjs

# Método 2: AWS CLI
aws secretsmanager update-secret \
  --secret-id pedidos/prod/all-secrets \
  --secret-string file://secrets.json
```

## 📝 Logs

### Local
- Logs del servidor: `server/logs/`
- Combined logs: `server/logs/combined.log`
- Error logs: `server/logs/error.log`

### Producción (AWS)
- Amplify Console → App → Hosting → Logs
- CloudWatch → Log Groups → `/aws/amplify/pedidos`

## 🎯 Próximos Pasos

1. ✅ Todo está configurado localmente
2. 📖 Lee [SETUP_COMPLETO.md](./SETUP_COMPLETO.md) para deploy a AWS
3. 🚀 Sigue [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) paso a paso
4. 🌐 Deploy a AWS Amplify
5. 🎉 ¡Comparte tu link!

## 🤝 Contribuir

Este es un proyecto privado. Para cambios:
1. Crea una rama feature
2. Haz tus cambios
3. Haz commit con mensajes descriptivos
4. Push y crea PR

## 📄 Licencia

Privado - Todos los derechos reservados

---

**¿Listo para deployar?** → Empieza con [SETUP_COMPLETO.md](./SETUP_COMPLETO.md) 🚀
