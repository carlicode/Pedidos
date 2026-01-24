#!/bin/bash
# Script para ver el ESTADO de la app de Amplify

APP_ID="d3bpt5tsbpx0os"
REGION="us-east-1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ESTADO DE LA APP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Información de la app
echo "📱 Información de la app:"
aws amplify get-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --query 'app.{Nombre:name,URL:defaultDomain,Rol:iamServiceRoleArn}' \
  --output table

echo ""

# Estado del branch
echo "🌿 Estado del branch master:"
aws amplify get-branch \
  --app-id "$APP_ID" \
  --branch-name master \
  --region "$REGION" \
  --query 'branch.{Branch:branchName,AutoBuild:enableAutoBuild,UltimoUpdate:updateTime}' \
  --output table

echo ""

# Variables de entorno
echo "🔐 Variables de entorno configuradas:"
aws amplify get-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --query 'app.environmentVariables' \
  --output table

echo ""

# Último build
echo "🏗️  Últimos builds:"
aws amplify list-jobs \
  --app-id "$APP_ID" \
  --branch-name master \
  --region "$REGION" \
  --max-results 5 \
  --query 'jobSummaries[*].{JobID:jobId,Status:status,Inicio:startTime,Tipo:jobType}' \
  --output table

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "App: https://master.d3bpt5tsbpx0os.amplifyapp.com"
echo "Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
