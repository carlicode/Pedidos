#!/bin/bash

# Script para probar el fix del bug de sobrescritura de IDs
# Ejecuta el test automatizado

set -e

echo "🧪 Ejecutando test del fix de sobrescritura de IDs..."
echo ""

# Verificar que node-fetch esté instalado
if ! node -e "import('node-fetch')" 2>/dev/null; then
  echo "📦 Instalando node-fetch..."
  cd "$(dirname "$0")/.."
  npm install node-fetch
fi

# Ejecutar el test
cd "$(dirname "$0")/.."
node scripts/test-id-overwrite-fix.mjs "$@"

exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo ""
  echo "✅ Test completado exitosamente"
else
  echo ""
  echo "❌ Test falló - revisa los errores arriba"
fi

exit $exit_code
