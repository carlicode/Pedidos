#!/bin/bash
# Script para configurar permisos de IAM para AWS Amplify

set -e

ACCOUNT_ID="447924811196"
REGION="us-east-1"
SECRET_NAME="pedidos/prod/all-secrets"
POLICY_NAME="PedidosAmplifySecretsAccess"

echo "🔐 Configurando permisos de IAM para AWS Amplify"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo "Secret Name: $SECRET_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Crear archivo de política temporal
POLICY_FILE=$(mktemp)
cat > "$POLICY_FILE" << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${SECRET_NAME}-*"
    }
  ]
}
EOF

echo ""
echo "📄 Política a crear:"
cat "$POLICY_FILE"
echo ""

# Verificar si la política ya existe
echo "🔍 Verificando si la política ya existe..."
POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='$POLICY_NAME'].Arn" --output text 2>/dev/null || echo "")

if [ -n "$POLICY_ARN" ]; then
  echo "ℹ️  La política ya existe: $POLICY_ARN"
  echo "🔄 Creando nueva versión de la política..."
  
  # Obtener versiones existentes
  VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)
  
  # Eliminar versiones antiguas si hay más de 4
  for VERSION in $VERSIONS; do
    echo "   Eliminando versión antigua: $VERSION"
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$VERSION" 2>/dev/null || true
  done
  
  # Crear nueva versión
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document file://"$POLICY_FILE" \
    --set-as-default
  
  echo "✅ Política actualizada: $POLICY_ARN"
else
  echo "📝 Creando nueva política..."
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document file://"$POLICY_FILE" \
    --description "Permite a AWS Amplify acceder a secretos de Pedidos" \
    --query 'Policy.Arn' \
    --output text)
  
  echo "✅ Política creada: $POLICY_ARN"
fi

# Limpiar archivo temporal
rm "$POLICY_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CONFIGURACIÓN COMPLETADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1️⃣  Adjuntar esta política al rol de servicio de Amplify:"
echo "    - Ve a AWS IAM Console"
echo "    - Busca el rol 'amplify-*' o créalo si no existe"
echo "    - Adjunta la política: $POLICY_NAME"
echo ""
echo "2️⃣  O ejecuta este comando (reemplaza ROLE_NAME):"
echo "    aws iam attach-role-policy \\"
echo "      --role-name amplify-YOUR-ROLE-NAME \\"
echo "      --policy-arn $POLICY_ARN"
echo ""
echo "3️⃣  Configurar variables de entorno en Amplify Console:"
echo "    AWS_REGION=$REGION"
echo "    AWS_SECRET_NAME=$SECRET_NAME"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
