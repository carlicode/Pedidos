#!/bin/bash
# Crea la tabla DynamoDB espejo de pedidos (beezy-pedidos-prod).
# Idempotente: si la tabla ya existe, no hace nada.
#
# La tabla es un ESPEJO del Google Sheet (pestaña Registros), que sigue
# siendo la fuente de verdad. El backend escribe aquí best-effort vía
# services/pedidosMirror.js y el panel admin de bee-tracked-turbo la lee.
#
# Esquema:
#   PK: id (S)             — ID del pedido (mismo de la columna A del Sheet)
#   GSI fecha-index: fecha (S, YYYY-MM-DD) — consultas por día desde el panel
#
# Uso: ./create-pedidos-dynamo-table.sh

set -euo pipefail

REGION=us-east-1
TABLE=beezy-pedidos-prod

if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "✅ Tabla $TABLE ya existe"
else
  echo "📦 Creando tabla $TABLE..."
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions \
      AttributeName=id,AttributeType=S \
      AttributeName=fecha,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --global-secondary-indexes '[
      {
        "IndexName": "fecha-index",
        "KeySchema": [{"AttributeName": "fecha", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"}
      }
    ]' \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" >/dev/null
  echo "⏳ Esperando a que la tabla esté activa..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
  echo "✅ Tabla $TABLE creada"
fi

aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" \
  --query "Table.[TableStatus,GlobalSecondaryIndexes[0].[IndexName,IndexStatus]]" --output text
