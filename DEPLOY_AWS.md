# Deploy Configuration for AWS Amplify

## Variables de Entorno Requeridas

Configura estas variables en AWS Amplify Console -> App Settings -> Environment Variables:

```bash
# AWS Secrets Manager
AWS_REGION=us-east-1
AWS_SECRET_NAME=pedidos/prod/all-secrets

# Node Environment
NODE_ENV=production

# Puerto (Amplify usa 3000 por defecto, pero puedes especificar)
PORT=5055
```

## Build Settings (amplify.yml)

El archivo `amplify.yml` en la raíz del proyecto contiene la configuración de build.

## Permisos de IAM Requeridos

El rol de servicio de Amplify necesita estos permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:447924811196:secret:pedidos/prod/all-secrets-*"
    }
  ]
}
```

## Pasos para Deploy

### 1. Crear Rol de IAM para Amplify

```bash
# Crear archivo de política
cat > amplify-secrets-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:447924811196:secret:pedidos/prod/all-secrets-*"
    }
  ]
}
EOF

# Crear la política
aws iam create-policy \
  --policy-name PedidosAmplifySecretsAccess \
  --policy-document file://amplify-secrets-policy.json

# Nota: El ARN de la política se mostrará en el output
```

### 2. Verificar Secretos

```bash
# Verificar que los secretos existen
node server/scripts/verify-secrets.mjs
```

### 3. Inicializar Amplify

Opción A: Desde la consola web
1. Ve a AWS Amplify Console
2. Click "New App" -> "Host web app"
3. Conecta tu repositorio de GitHub
4. Configura las variables de entorno
5. Asigna el rol de IAM creado
6. Deploy!

Opción B: Desde CLI
```bash
# Instalar Amplify CLI
npm install -g @aws-amplify/cli

# Inicializar
amplify init

# Agregar hosting
amplify add hosting

# Publicar
amplify publish
```

## Verificación Post-Deploy

Una vez desplegado, verifica:

```bash
# Endpoint de ejemplo (reemplaza con tu URL de Amplify)
AMPLIFY_URL="https://main.d1234567890.amplifyapp.com"

# Probar endpoint de salud
curl $AMPLIFY_URL/api/health

# Probar endpoint protegido (requiere login primero)
# 1. Login
TOKEN=$(curl -X POST $AMPLIFY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  | jq -r '.token')

# 2. Usar token
curl $AMPLIFY_URL/api/client/clientes \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Error: "Unable to get secret"
- Verifica que el rol de Amplify tiene permisos para Secrets Manager
- Verifica que las variables de entorno están configuradas
- Verifica que el nombre del secreto es correcto

### Error: "GOOGLE_MAPS_API_KEY not found"
- Verifica que el secreto en AWS contiene GOOGLE_MAPS_API_KEY
- Ejecuta `verify-secrets.mjs` localmente para confirmar

### Error: Google Sheets API fails
- Verifica que GOOGLE_SERVICE_ACCOUNT_JSON existe en el secreto
- Verifica que las credenciales son válidas

## Rollback

Si algo sale mal:

```bash
# Volver a variables de entorno locales
# Comentar la inicialización de secretos en index.js
# O configurar las variables directamente en Amplify
```

## Monitoreo

- Logs: AWS Amplify Console -> Hosting -> Logs
- CloudWatch: AWS CloudWatch -> Log Groups -> /aws/amplify/...

## Costos Estimados

- AWS Amplify: ~$15-30/mes (según tráfico)
- AWS Secrets Manager: ~$0.40/mes por secreto
- Total estimado: ~$16-31/mes
