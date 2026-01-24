# 🚀 Guía: Desplegar Frontend en AWS Amplify

## Opción 1: AWS Amplify con GitHub (Recomendado - CI/CD Automático) ⭐

### Paso 1: Abrir AWS Amplify Console

1. Ve a: https://console.aws.amazon.com/amplify/home?region=us-east-1
2. Click en **"Get Started"** o **"New app"**
3. Selecciona **"Host web app"**

### Paso 2: Conectar GitHub

1. Selecciona **GitHub** como proveedor
2. Click en **"Connect branch"**
3. **Autoriza AWS Amplify** en GitHub (se abrirá una ventana)
4. Selecciona tu repositorio: **`carlicode/Pedidos`**
5. Selecciona la rama: **`master`**
6. Click **"Next"**

### Paso 3: Configurar Build Settings

AWS Amplify detectará automáticamente tu `amplify.yml`. Verifica que muestre:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
```

Click **"Next"**

### Paso 4: Configurar Variables de Entorno ⚠️ IMPORTANTE

**Antes de hacer deploy**, agrega esta variable de entorno:

1. En la página de configuración, busca **"Environment variables"**
2. Click **"Add environment variable"**
3. Agrega:
   - **Key:** `VITE_API_URL`
   - **Value:** `http://pedidos-backend-prod.eba-c22x9qsa.us-east-1.elasticbeanstalk.com`

### Paso 5: Review y Deploy

1. Revisa la configuración
2. Click **"Save and deploy"**
3. **¡Espera 3-5 minutos!** 🕐

### Paso 6: Obtener tu URL

Una vez completado, obtendrás una URL como:
```
https://master.xxxxxxxxxxxxxx.amplifyapp.com
```

**¡Esa es la URL de tu aplicación!** 🎉

---

## Opción 2: Despliegue Manual Rápido (Sin CI/CD)

Si prefieres no conectar GitHub, puedes hacer deploy manual:

### Paso 1: Build Local

```bash
cd /Users/carli.code/Desktop/Pedidos/frontend

# Crear archivo .env.production
echo "VITE_API_URL=http://pedidos-backend-prod.eba-c22x9qsa.us-east-1.elasticbeanstalk.com" > .env.production

# Build
npm run build
```

### Paso 2: Subir a S3 + CloudFront

```bash
# Crear bucket S3
aws s3 mb s3://pedidos-frontend-$(date +%s) --region us-east-1

# Subir archivos
aws s3 sync dist/ s3://pedidos-frontend-XXXXXXX/ --acl public-read

# Habilitar hosting
aws s3 website s3://pedidos-frontend-XXXXXXX/ --index-document index.html --error-document index.html
```

---

## 🎯 Recomendación: Opción 1 (AWS Amplify + GitHub)

**¿Por qué?**
- ✅ Deploy automático con cada `git push`
- ✅ URL HTTPS gratis
- ✅ CDN global incluido
- ✅ Rollback fácil
- ✅ Preview de ramas
- ✅ Variables de entorno por rama
- ✅ **Gratis hasta 1000 build minutes/mes**

---

## 📝 Después del Deploy

### 1. Actualizar CORS en el Backend

Agregar tu URL de Amplify al backend:

```bash
# Actualizar el secreto con tu nueva URL de frontend
aws secretsmanager get-secret-value \
  --secret-id "pedidos/prod/all-secrets" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq '. + {FRONTEND_URL: "https://master.xxxxx.amplifyapp.com"}' > /tmp/secret.json

aws secretsmanager update-secret \
  --secret-id "pedidos/prod/all-secrets" \
  --region us-east-1 \
  --secret-string file:///tmp/secret.json
```

### 2. Redeploy del Backend

```bash
cd /Users/carli.code/Desktop/Pedidos/backend
./scripts/eb-deploy.sh
```

### 3. Probar la Aplicación

1. Abre tu URL de Amplify
2. Intenta hacer login
3. Verifica que se conecte al backend

---

## 🔧 Troubleshooting

### Error: "Network Error" al hacer login

**Problema:** CORS no configurado correctamente

**Solución:**
1. Verifica que `VITE_API_URL` esté configurada en Amplify
2. Verifica que la URL de Amplify esté en `FRONTEND_URL` del backend
3. Redeploy el backend

### Build falla en Amplify

**Problema:** Dependencias o configuración incorrecta

**Solución:**
1. Verifica que `amplify.yml` esté en la raíz del proyecto
2. Verifica que `frontend/package.json` tenga todas las dependencias
3. Revisa los logs de build en Amplify Console

---

## 💰 Costos de AWS Amplify

**Free Tier (Primer año):**
- ✅ 1000 build minutes/mes
- ✅ 15 GB de hosting/mes
- ✅ 5 GB de data transfer/mes

**Después del Free Tier:**
- Build: $0.01/minuto
- Hosting: $0.15/GB/mes
- Data transfer: $0.15/GB

**Estimado para tu app:** $0-2/mes

---

## 🎉 ¡Listo!

Una vez desplegado, tendrás:

- ✅ Frontend en AWS Amplify
- ✅ Backend en Elastic Beanstalk
- ✅ CI/CD automático con GitHub
- ✅ HTTPS gratis
- ✅ CDN global

**URL del Frontend:** `https://master.xxxxx.amplifyapp.com`  
**URL del Backend:** `http://pedidos-backend-prod.eba-c22x9qsa.us-east-1.elasticbeanstalk.com`
