#!/bin/bash
# Script para PAUSAR la app de Amplify
# Útil para ahorrar costos cuando no se está usando

set -e

APP_ID="d3i6av0lx664fk"
REGION="us-east-1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏸️  PAUSANDO APP DE AMPLIFY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Deshabilitar auto-build
echo "🔧 Deshabilitando auto-build..."
aws amplify update-branch \
  --app-id "$APP_ID" \
  --branch-name master \
  --enable-auto-build false \
  --region "$REGION" \
  --query 'branch.{branchName:branchName,enableAutoBuild:enableAutoBuild}' \
  --output json

echo "✅ Auto-build deshabilitado"
echo ""

# 2. Mostrar estado
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ APP PAUSADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "La app sigue online en:"
echo "   https://master.d3i6av0lx664fk.amplifyapp.com"
echo ""
echo "Pero:"
echo "   ❌ No se ejecutarán builds automáticos en push"
echo "   💰 No consumirá minutos de build"
echo "   💰 Solo pagas el hosting (~$0.01/GB/mes)"
echo ""
echo "Para reactivarla:"
echo "   ./server/scripts/amplify-start.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
