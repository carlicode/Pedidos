# ✅ Checklist de Deploy a AWS Amplify

## Pre-Deploy (Completado ✅)

- [x] Credenciales migradas a AWS Secrets Manager
- [x] Código actualizado para usar AWS Secrets Manager
- [x] Política de IAM creada
- [x] Secretos verificados y funcionando
- [x] Archivo amplify.yml creado
- [x] Variables sensibles protegidas en .gitignore

## Deploy a AWS Amplify

### Paso 1: Preparar el Repositorio Git

```bash
# Verificar que todo está commiteado
git status

# Si hay cambios, commitearlos
git add .
git commit -m "feat: Configuración para AWS Amplify con Secrets Manager"
git push origin master
```

### Paso 2: Crear App en AWS Amplify Console

1. Ve a: https://console.aws.amazon.com/amplify/
2. Click "New app" → "Host web app"
3. Selecciona tu proveedor Git (GitHub, GitLab, etc.)
4. Autoriza AWS Amplify para acceder a tus repos
5. Selecciona el repositorio "Pedidos"
6. Selecciona la rama "master" (o main)

### Paso 3: Configurar Build Settings

Amplify detectará automáticamente el archivo `amplify.yml`. Verifica que muestre:

```yaml
frontend:
  - preBuild: npm ci
  - build: npm run build
  artifacts: dist/**/*

backend:
  - preBuild: cd server && npm ci
  artifacts: server/**/*
```

### Paso 4: Configurar Variables de Entorno

En "Environment variables", agrega:

```
AWS_REGION=us-east-1
AWS_SECRET_NAME=pedidos/prod/all-secrets
NODE_ENV=production
PORT=5055
```

### Paso 5: Configurar Service Role

**Opción A: Crear nuevo rol**
1. En "Service role", click "Create new role"
2. Selecciona "Amplify" como servicio
3. Click "Next"
4. Amplify creará el rol automáticamente

**Opción B: Usar rol existente**
1. Si ya tienes un rol, selecciónalo

**Importante**: Después de crear el rol, ejecuta:

```bash
# Reemplaza ROLE_NAME con el nombre del rol de Amplify
aws iam attach-role-policy \
  --role-name amplify-pedidos-XXXXXX \
  --policy-arn arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess
```

Para encontrar el nombre del rol:
```bash
aws iam list-roles --query 'Roles[?contains(RoleName, `amplify`)].RoleName' --output table
```

### Paso 6: Advanced Settings (Opcional)

- **Build image**: `Amazon Linux:2023` (recomendado)
- **Build timeout**: 30 minutos
- **Auto-deploy**: Activado (deploys automáticos en push)

### Paso 7: Review and Deploy

1. Revisa toda la configuración
2. Click "Save and deploy"
3. Espera a que el deploy complete (~5-10 minutos)

## Post-Deploy

### Verificar el Deploy

```bash
# Tu URL será algo como:
AMPLIFY_URL="https://main.d1234567890.amplifyapp.com"

# 1. Verificar que el sitio carga
curl -I $AMPLIFY_URL

# 2. Verificar backend (reemplaza con tu URL)
curl $AMPLIFY_URL/api/health

# 3. Probar login
curl -X POST $AMPLIFY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"usuario","password":"password"}'
```

### Configurar Dominio Custom (Opcional)

Si tienes un dominio:
1. En Amplify Console → Domain management
2. Click "Add domain"
3. Sigue las instrucciones para configurar DNS

### Monitoreo

- **Logs**: Amplify Console → App → Hosting → Logs
- **CloudWatch**: CloudWatch → Log Groups → `/aws/amplify/pedidos`

## Troubleshooting

### Error: "Access Denied to Secrets Manager"

```bash
# Verificar que el rol tiene permisos
aws iam list-attached-role-policies --role-name amplify-ROLE-NAME

# Si no aparece PedidosAmplifySecretsAccess, adjuntarla:
aws iam attach-role-policy \
  --role-name amplify-ROLE-NAME \
  --policy-arn arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess
```

### Error: "Build Failed"

1. Revisa los logs en Amplify Console
2. Verifica que `amplify.yml` está en la raíz
3. Verifica que `package.json` tiene los scripts correctos

### Error: "Module not found"

```bash
# Limpiar caché de build
# En Amplify Console → Build settings → Edit → Clear cache
```

### El frontend carga pero el backend no responde

1. Verifica que las variables de entorno están configuradas
2. Verifica los logs del servidor
3. Verifica que el puerto es correcto

## URLs Útiles

- Amplify Console: https://console.aws.amazon.com/amplify/
- IAM Console: https://console.aws.amazon.com/iam/
- Secrets Manager: https://console.aws.amazon.com/secretsmanager/
- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/

## Costo Estimado

- **AWS Amplify**: ~$15-30/mes
  - Build minutes: ~1000 min/mes incluidos
  - Storage: 5 GB incluidos
  - Data transfer: 15 GB/mes incluidos
  
- **AWS Secrets Manager**: ~$0.40/mes por secreto

- **Total**: ~$16-31/mes

## Rollback

Si necesitas revertir:

1. En Amplify Console → Deployments
2. Selecciona un deployment anterior
3. Click "Redeploy this version"

O desde CLI:
```bash
git revert HEAD
git push origin master
# Amplify auto-deploiará la versión anterior
```

## Backup

Tus secretos están seguros en AWS Secrets Manager. Para backup local:

```bash
# Exportar secretos (¡MANTENER SEGURO!)
aws secretsmanager get-secret-value \
  --secret-id pedidos/prod/all-secrets \
  --query SecretString \
  --output text > secrets-backup.json

# ¡NO COMMITEAR ESTE ARCHIVO!
```

## ¿Necesitas Ayuda?

- Docs de Amplify: https://docs.amplify.aws/
- Soporte AWS: https://console.aws.amazon.com/support/
