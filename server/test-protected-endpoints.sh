#!/bin/bash

echo "🔐 Obteniendo token..."
TOKEN=$(curl -s -X POST http://localhost:5055/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"hogarvitaminas","password":"Hgr#Vtm2024$xK9"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

if [ -z "$TOKEN" ]; then
  echo "❌ Error obteniendo token"
  exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:50}..."
echo ""

echo "📦 Probando endpoint de pedidos..."
curl -s http://localhost:5055/api/client/orders \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | head -30

echo ""
echo ""

echo "📦 Probando endpoint de inventario..."
curl -s http://localhost:5055/api/client/inventario \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | head -30

