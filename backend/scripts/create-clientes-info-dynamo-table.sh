#!/bin/bash
# Crea la tabla DynamoDB de info de clientes (beezy-clientes-info / beezy-clientes-info-dev).
# Idempotente: si la tabla ya existe, no hace nada.
#
# La tabla es la FUENTE DE VERDAD de la "Información del Cliente" (Cuenta, Procedimientos,
# Etiqueta, Envíos, Tipo de pago). Un ítem por cliente. Se lee con Scan + caché en memoria
# (son cientos de filas), por eso no lleva GSI.
#
# Esquema:
#   PK: id (S) — sha256(nombreClave[#n]).slice(0,32); no cambia aunque se renombre el cliente
#
# Uso: ./create-clientes-info-dynamo-table.sh <TABLE_NAME>
#   dev:  ./create-clientes-info-dynamo-table.sh beezy-clientes-info-dev
#   prod: ./create-clientes-info-dynamo-table.sh beezy-clientes-info

set -euo pipefail

REGION=us-east-1

if [ $# -ne 1 ] || [ -z "${1:-}" ]; then
  echo "❌ Falta el nombre de la tabla (es obligatorio, sin default)."
  echo "Uso: $0 <TABLE_NAME>"
  exit 1
fi

TABLE="$1"

if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "✅ Tabla $TABLE ya existe"
else
  echo "📦 Creando tabla $TABLE..."
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" >/dev/null
  echo "⏳ Esperando a que la tabla esté activa..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
  echo "✅ Tabla $TABLE creada"
fi

aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" \
  --query "Table.[TableName,TableStatus,BillingModeSummary.BillingMode]" --output text
