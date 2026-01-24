#!/bin/bash
# Script para REACTIVAR la app de Amplify

set -e

APP_ID="d3bpt5tsbpx0os"
REGION="us-east-1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶️  REACTIVANDO APP DE AMPLIFY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Habilitar auto-build
echo "🔧 Habilitando auto-build..."
aws amplify update-branch \
  --app-id "$APP_ID" \
  --branch-name master \
  --enable-auto-build true \
  --region "$REGION" \
  --query 'branch.{branchName:branchName,enableAutoBuild:enableAutoBuild}' \
  --output json

echo "✅ Auto-build habilitado"
echo ""

# 2. Opcional: Iniciar un nuevo build
read -p "¿Quieres iniciar un nuevo build ahora? (y/n): " START_BUILD

if [ "$START_BUILD" = "y" ]; then
  echo ""
  echo "🏗️  Iniciando build..."
  
  JOB_ID=$(aws amplify start-job \
    --app-id "$APP_ID" \
    --branch-name master \
    --job-type RELEASE \
    --region "$REGION" \
    --query 'jobSummary.jobId' \
    --output text)
  
  echo "✅ Build iniciado (Job ID: $JOB_ID)"
  echo ""
  echo "Ver progreso:"
  echo "   https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID/master/$JOB_ID"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ APP REACTIVADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "La app está online en:"
echo "   https://master.d3bpt5tsbpx0os.amplifyapp.com"
echo ""
echo "Características activas:"
echo "   ✅ Auto-deploy en cada push"
echo "   ✅ Build automático"
echo "   ✅ Hosting activo"
echo ""
echo "Para pausarla nuevamente:"
echo "   ./server/scripts/amplify-pause.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
