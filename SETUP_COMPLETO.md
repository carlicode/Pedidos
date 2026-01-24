# 🎉 Configuración de Seguridad AWS Completada

## ✅ Lo que hemos hecho

### 1. Migración de Credenciales a AWS Secrets Manager
- ✅ Todas las credenciales sensibles migradas a AWS
- ✅ Google Maps API Key protegida
- ✅ Google Service Account JSON protegido
- ✅ Sheet IDs configurados
- ✅ Secret name: `pedidos/prod/all-secrets`

### 2. Código Actualizado
- ✅ `server/utils/secrets.js` actualizado para AWS Secrets Manager
- ✅ `server/index.js` usa secretos de AWS con fallback local
- ✅ Función `initializeSecrets()` implementada
- ✅ Compatibilidad con desarrollo local mantenida

### 3. Infraestructura AWS
- ✅ Política IAM creada: `PedidosAmplifySecretsAccess`
- ✅ ARN: `arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess`
- ✅ Permisos configurados para Secrets Manager

### 4. Archivos de Deploy
- ✅ `amplify.yml` - Configuración de build para Amplify
- ✅ `DEPLOY_AWS.md` - Documentación técnica
- ✅ `DEPLOY_CHECKLIST.md` - Guía paso a paso completa
- ✅ Scripts de verificación y setup

### 5. Scripts Útiles
- ✅ `migrate-secrets-to-aws.mjs` - Migrar secretos
- ✅ `verify-secrets.mjs` - Verificar secretos
- ✅ `setup-iam-permissions.sh` - Configurar IAM
- ✅ `pre-deploy-check.sh` - Verificación pre-deploy

## 📋 Próximos Pasos para Deploy

### Paso 1: Commitear Cambios

```bash
git add .
git commit -m "feat: Configuración completa para AWS Amplify con Secrets Manager

- Migración de credenciales a AWS Secrets Manager
- Actualización de código para usar secretos de AWS
- Configuración de IAM y políticas de seguridad
- Archivos de configuración para Amplify
- Scripts de verificación y deploy"

git push origin master
```

### Paso 2: Configurar AWS Amplify

1. **Ve a AWS Amplify Console**
   ```
   https://console.aws.amazon.com/amplify/
   ```

2. **Crear Nueva App**
   - Click "New app" → "Host web app"
   - Conecta tu repositorio Git
   - Selecciona branch: `master`

3. **Configurar Variables de Entorno**
   En Amplify Console → Environment variables:
   ```
   AWS_REGION=us-east-1
   AWS_SECRET_NAME=pedidos/prod/all-secrets
   NODE_ENV=production
   PORT=5055
   ```

4. **Configurar Service Role**
   
   a) Amplify creará un rol automáticamente, anota el nombre
   
   b) Adjuntar la política de secretos:
   ```bash
   # Lista los roles de Amplify
   aws iam list-roles --query 'Roles[?contains(RoleName, `amplify`)].RoleName'
   
   # Adjunta la política (reemplaza ROLE_NAME)
   aws iam attach-role-policy \
     --role-name amplify-ROLE-NAME \
     --policy-arn arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess
   ```

5. **Deploy**
   - Click "Save and deploy"
   - Espera ~5-10 minutos

### Paso 3: Verificar el Deploy

```bash
# Tu URL será algo como:
AMPLIFY_URL="https://main.dXXXXXXXXXX.amplifyapp.com"

# Verificar sitio
curl -I $AMPLIFY_URL

# Verificar backend
curl $AMPLIFY_URL/api/health

# Probar login
curl -X POST $AMPLIFY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

## 🔐 Seguridad

### Archivos Protegidos (.gitignore)
- ✅ `beezero-*.json` - No se sube a Git
- ✅ `.env` - No se sube a Git
- ✅ `secret/` - No se sube a Git
- ✅ Logs y caches - No se suben a Git

### Credenciales en AWS
- ✅ Google Maps API Key → AWS Secrets Manager
- ✅ Google Service Account → AWS Secrets Manager
- ✅ Sheet IDs → AWS Secrets Manager
- ✅ JWT Secret → AWS Secrets Manager (si existe)

### Acceso IAM
- ✅ Solo Amplify puede acceder a los secretos
- ✅ Permisos mínimos necesarios (GetSecretValue, DescribeSecret)
- ✅ Scope limitado al secreto específico

## 📊 Verificaciones

```bash
# Verificar secretos en AWS
node server/scripts/verify-secrets.mjs

# Verificación completa pre-deploy
./server/scripts/pre-deploy-check.sh

# Ver secretos en AWS (solo metadatos)
aws secretsmanager describe-secret --secret-id pedidos/prod/all-secrets

# Ver política IAM
aws iam get-policy --policy-arn arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess
```

## 💰 Costos Estimados

- **AWS Amplify**: ~$15-30/mes (según tráfico)
  - 1000 build minutes incluidos
  - 5 GB storage incluido
  - 15 GB/mes data transfer incluido

- **AWS Secrets Manager**: ~$0.40/mes por secreto

- **Total**: ~$16-31/mes

## 📚 Documentación

- `DEPLOY_CHECKLIST.md` - Guía completa paso a paso
- `DEPLOY_AWS.md` - Documentación técnica detallada
- `amplify.yml` - Configuración de build

## 🆘 Troubleshooting

### Problema: "Access Denied to Secrets Manager"
**Solución**: Adjuntar política al rol de Amplify
```bash
aws iam attach-role-policy \
  --role-name amplify-ROLE-NAME \
  --policy-arn arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess
```

### Problema: "Secreto no encontrado"
**Solución**: Verificar que el secreto existe
```bash
aws secretsmanager list-secrets --query 'SecretList[?Name==`pedidos/prod/all-secrets`]'
```

### Problema: "Build failed"
**Solución**: Revisar logs en Amplify Console

## 🔄 Actualizar Secretos

```bash
# Modificar secretos
aws secretsmanager update-secret \
  --secret-id pedidos/prod/all-secrets \
  --secret-string file://new-secrets.json

# O usar el script:
node server/scripts/migrate-secrets-to-aws.mjs
```

## 🎯 URL de tu App

Después del deploy, tu app estará disponible en:
```
https://main.dXXXXXXXXXX.amplifyapp.com
```

Puedes configurar un dominio custom si lo deseas.

## ✨ Resumen

🎉 **¡Todo está listo para producción!**

1. ✅ Credenciales seguras en AWS
2. ✅ Código actualizado y funcional
3. ✅ IAM configurado correctamente
4. ✅ Archivos de deploy listos
5. ✅ Scripts de verificación disponibles

**Siguiente acción**: Commitear cambios y deployar a Amplify

---

¿Preguntas? Revisa `DEPLOY_CHECKLIST.md` para más detalles.
