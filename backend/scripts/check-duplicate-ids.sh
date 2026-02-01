#!/bin/bash

# Script para verificar el estado del problema de IDs duplicados
# y ejecutar el detector

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 DETECTOR DE IDs DUPLICADOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Este script detectará si hay IDs duplicados en el Google Sheet"
echo "que están causando pérdida de datos al editar pedidos."
echo ""
echo "Ubicación del proyecto: $PROJECT_ROOT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar que existe el archivo .env
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "❌ ERROR: No se encontró el archivo .env"
    echo "   Por favor, asegúrate de tener configuradas las credenciales de Google"
    exit 1
fi

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js no está instalado"
    echo "   Por favor, instala Node.js para ejecutar este script"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo "✅ Archivo .env encontrado"
echo ""

# Ejecutar el detector
echo "🚀 Ejecutando detector de IDs duplicados..."
echo ""

cd "$PROJECT_ROOT/backend"
node scripts/detect-duplicate-ids.mjs

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ NO se encontraron IDs duplicados"
    echo "   El sistema está limpio"
else
    echo "🚨 SE ENCONTRARON IDs DUPLICADOS"
    echo "   Ver el reporte detallado arriba"
    echo ""
    echo "Siguiente paso:"
    echo "  1. Revisar el archivo: DUPLICATE_IDS_REPORT.json"
    echo "  2. Corregir manualmente los duplicados en Google Sheets"
    echo "  3. Ejecutar este script nuevamente para verificar"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE
