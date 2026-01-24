#!/bin/bash
# Script para crear app de Amplify con GitHub token
# Uso: ./create-amplify-app.sh YOUR_GITHUB_TOKEN

set -e

GITHUB_TOKEN="$1"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔑 CREAR GITHUB PERSONAL ACCESS TOKEN"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1️⃣  Abre: https://github.com/settings/tokens/new"
  echo ""
  echo "2️⃣  Configuración:"
  echo "   Note: 'AWS Amplify - Pedidos'"
  echo "   Expiration: 90 days"
  echo ""
  echo "3️⃣  Selecciona permisos:"
  echo "   ✅ repo (todos)"
  echo "   ✅ admin:repo_hook (todos)"
  echo ""
  echo "4️⃣  Click 'Generate token' y copia el token"
  echo ""
  echo "5️⃣  Ejecuta este script con el token:"
  echo "   ./server/scripts/create-amplify-app.sh ghp_xxxxx..."
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 CREANDO APP EN AWS AMPLIFY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Variables
APP_NAME="pedidos"
REPOSITORY="https://github.com/carlicode/Pedidos"
BRANCH="master"
REGION="us-east-1"

echo "📋 Configuración:"
echo "   App name: $APP_NAME"
echo "   Repository: $REPOSITORY"
echo "   Branch: $BRANCH"
echo "   Region: $REGION"
echo ""

# Crear la app
echo "🔧 Creando app en Amplify..."

APP_ID=$(aws amplify create-app \
  --name "$APP_NAME" \
  --repository "$REPOSITORY" \
  --access-token "$GITHUB_TOKEN" \
  --region "$REGION" \
  --platform WEB \
  --environment-variables '{"SECRETS_REGION":"us-east-1","SECRET_NAME":"pedidos/prod/all-secrets","NODE_ENV":"production","PORT":"5055"}' \
  --build-spec "$(cat amplify.yml)" \
  --enable-auto-branch-creation \
  --query 'app.appId' \
  --output text)

if [ -z "$APP_ID" ]; then
  echo "❌ Error creando la app"
  exit 1
fi

echo "✅ App creada!"
echo "   App ID: $APP_ID"
echo ""

# Conectar el branch
echo "🔗 Conectando branch $BRANCH..."

BRANCH_NAME=$(aws amplify create-branch \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION" \
  --enable-auto-build \
  --query 'branch.branchName' \
  --output text)

echo "✅ Branch conectado: $BRANCH_NAME"
echo ""

# Iniciar el primer build
echo "🏗️  Iniciando primer build..."

JOB_ID=$(aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-type RELEASE \
  --region "$REGION" \
  --query 'jobSummary.jobId' \
  --output text)

echo "✅ Build iniciado!"
echo "   Job ID: $JOB_ID"
echo ""

# Obtener información de la app
APP_INFO=$(aws amplify get-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --output json)

DEFAULT_DOMAIN=$(echo "$APP_INFO" | grep -o '"defaultDomain": "[^"]*"' | cut -d'"' -f4)
SERVICE_ROLE=$(echo "$APP_INFO" | grep -o '"serviceRoleArn": "[^"]*"' | cut -d'"' -f4)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ APP CREADA EXITOSAMENTE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 App ID: $APP_ID"
echo "🌐 URL: https://$BRANCH.$DEFAULT_DOMAIN"
echo "🔗 Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID"
echo ""

# Guardar info en archivo
cat > amplify-app-info.txt << EOL
App ID: $APP_ID
URL: https://$BRANCH.$DEFAULT_DOMAIN
Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID
Service Role ARN: $SERVICE_ROLE
Created: $(date)
EOL

echo "💾 Información guardada en: amplify-app-info.txt"
echo ""

# Extraer nombre del rol del ARN
if [ -n "$SERVICE_ROLE" ]; then
  ROLE_NAME=$(echo "$SERVICE_ROLE" | grep -o 'role/[^/]*' | cut -d'/' -f2)
  
  if [ -n "$ROLE_NAME" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔐 ADJUNTAR POLÍTICA IAM AL ROL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Service Role: $ROLE_NAME"
    echo ""
    
    read -p "¿Adjuntar política PedidosAmplifySecretsAccess ahora? (y/n): " ATTACH
    
    if [ "$ATTACH" = "y" ]; then
      echo ""
      echo "🔧 Adjuntando política..."
      
      aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess"
      
      echo "✅ Política adjuntada!"
    else
      echo ""
      echo "⚠️  Recuerda adjuntar la política manualmente:"
      echo ""
      echo "./server/scripts/attach-policy-to-amplify-role.sh"
    fi
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 BUILD EN PROGRESO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "El build tardará ~5-10 minutos."
echo ""
echo "Ver progreso:"
echo "  https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID/$BRANCH/$JOB_ID"
echo ""
echo "O desde CLI:"
echo "  aws amplify get-job --app-id $APP_ID --branch-name $BRANCH --job-id $JOB_ID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
