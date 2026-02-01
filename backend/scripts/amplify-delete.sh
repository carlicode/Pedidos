#!/bin/bash
# Script para ELIMINAR completamente la app de Amplify
# ⚠️  CUIDADO: Esta acción NO se puede deshacer

set -e

APP_ID="d3i6av0lx664fk"
REGION="us-east-1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  ELIMINAR APP DE AMPLIFY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  ADVERTENCIA:"
echo "   Esta acción eliminará COMPLETAMENTE la app de Amplify."
echo "   - Se perderá la URL: https://master.d3i6av0lx664fk.amplifyapp.com"
echo "   - Se eliminarán todos los builds y logs"
echo "   - Esta acción NO se puede deshacer"
echo ""
echo "Si solo quieres pausarla temporalmente, usa:"
echo "   ./server/scripts/amplify-pause.sh"
echo ""

read -p "¿Estás SEGURO que quieres eliminar la app? (escribe 'ELIMINAR' para confirmar): " CONFIRM

if [ "$CONFIRM" != "ELIMINAR" ]; then
  echo ""
  echo "❌ Cancelado. La app no fue eliminada."
  exit 0
fi

echo ""
echo "🗑️  Eliminando app..."

aws amplify delete-app \
  --app-id "$APP_ID" \
  --region "$REGION"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ APP ELIMINADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "La app ha sido eliminada completamente."
echo ""
echo "Para volver a crearla:"
echo "   1. Genera un nuevo GitHub token"
echo "   2. Ejecuta: ./server/scripts/create-amplify-app.sh YOUR_TOKEN"
echo ""
echo "Nota: Tus secretos en AWS Secrets Manager siguen intactos."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
