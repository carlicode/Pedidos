#!/bin/bash

# Script para crear y desplegar el backend en AWS Elastic Beanstalk
# Uso: ./server/scripts/eb-create.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}║          🚀 CREANDO BACKEND EN ELASTIC BEANSTALK                ║${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuración
APP_NAME="pedidos-backend"
ENV_NAME="pedidos-backend-prod"
REGION="us-east-1"
PLATFORM="node.js"

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 CONFIGURACIÓN${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Nombre de aplicación: ${GREEN}$APP_NAME${NC}"
echo -e "Nombre de ambiente:   ${GREEN}$ENV_NAME${NC}"
echo -e "Región:              ${GREEN}$REGION${NC}"
echo -e "Plataforma:          ${GREEN}$PLATFORM${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "server/package.json" ]; then
    echo -e "${RED}❌ Error: Debes ejecutar este script desde la raíz del proyecto${NC}"
    exit 1
fi

# Verificar que eb CLI está instalado
if ! command -v eb &> /dev/null; then
    echo -e "${YELLOW}⚠️  EB CLI no está instalado${NC}"
    echo -e "${BLUE}Instalando EB CLI...${NC}"
    pip3 install awsebcli --upgrade --user
fi

# Verificar que aws CLI está configurado
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI no está configurado${NC}"
    echo -e "Por favor, ejecuta: ${YELLOW}aws configure${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 PASO 1: Verificar secretos en AWS Secrets Manager${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SECRET_NAME="pedidos/prod/all-secrets"
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region $REGION &> /dev/null; then
    echo -e "${GREEN}✅ Secretos encontrados en Secrets Manager${NC}"
else
    echo -e "${RED}❌ No se encontraron los secretos${NC}"
    echo -e "Por favor, ejecuta primero: ${YELLOW}node server/scripts/migrate-secrets-to-aws.mjs${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🏗️  PASO 2: Crear aplicación en Elastic Beanstalk${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verificar si la aplicación ya existe
if aws elasticbeanstalk describe-applications --application-names $APP_NAME --region $REGION &> /dev/null; then
    echo -e "${YELLOW}⚠️  La aplicación ya existe${NC}"
else
    echo "Creando aplicación..."
    aws elasticbeanstalk create-application \
        --application-name $APP_NAME \
        --description "Backend API para sistema de pedidos" \
        --region $REGION
    echo -e "${GREEN}✅ Aplicación creada${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔐 PASO 3: Crear rol IAM para Elastic Beanstalk${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ROLE_NAME="PedidosEBInstanceRole"
POLICY_NAME="PedidosEBSecretsAccess"

# Crear política para acceder a Secrets Manager
if aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  La política ya existe${NC}"
else
    echo "Creando política para Secrets Manager..."
    cat > /tmp/eb-secrets-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": "arn:aws:secretsmanager:$REGION:$(aws sts get-caller-identity --query Account --output text):secret:$SECRET_NAME*"
        }
    ]
}
EOF
    
    aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document file:///tmp/eb-secrets-policy.json \
        --description "Permite acceso a secretos de Pedidos"
    
    rm /tmp/eb-secrets-policy.json
    echo -e "${GREEN}✅ Política creada${NC}"
fi

# Crear rol de instancia si no existe
if aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠️  El rol ya existe${NC}"
else
    echo "Creando rol de instancia..."
    cat > /tmp/eb-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
    
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/eb-trust-policy.json \
        --description "Rol de instancia para Elastic Beanstalk de Pedidos"
    
    rm /tmp/eb-trust-policy.json
    
    # Adjuntar políticas necesarias
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
    
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY_NAME"
    
    # Crear perfil de instancia
    aws iam create-instance-profile --instance-profile-name $ROLE_NAME
    aws iam add-role-to-instance-profile --instance-profile-name $ROLE_NAME --role-name $ROLE_NAME
    
    echo -e "${GREEN}✅ Rol e instance profile creados${NC}"
    echo -e "${YELLOW}⏳ Esperando 10 segundos para que se propague el rol...${NC}"
    sleep 10
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 PASO 4: Preparar código para deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd server

# Crear archivo zip con el código
echo "Empaquetando aplicación..."
zip -r ../pedidos-backend.zip . -x "*.git*" "node_modules/*" "scripts/*" "test-*" "logs/*"

cd ..

echo -e "${GREEN}✅ Aplicación empaquetada${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌍 PASO 5: Crear ambiente y desplegar${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Subir versión a S3
VERSION_LABEL="v$(date +%Y%m%d-%H%M%S)"
BUCKET_NAME="elasticbeanstalk-$REGION-$(aws sts get-caller-identity --query Account --output text)"

echo "Subiendo código a S3..."
aws s3 cp pedidos-backend.zip s3://$BUCKET_NAME/pedidos-backend/$VERSION_LABEL.zip

echo "Creando versión de aplicación..."
aws elasticbeanstalk create-application-version \
    --application-name $APP_NAME \
    --version-label $VERSION_LABEL \
    --source-bundle S3Bucket=$BUCKET_NAME,S3Key=pedidos-backend/$VERSION_LABEL.zip \
    --region $REGION

# Verificar si el ambiente ya existe
if aws elasticbeanstalk describe-environments --application-name $APP_NAME --environment-names $ENV_NAME --region $REGION | grep -q "EnvironmentName"; then
    echo -e "${YELLOW}⚠️  El ambiente ya existe. Actualizando...${NC}"
    aws elasticbeanstalk update-environment \
        --application-name $APP_NAME \
        --environment-name $ENV_NAME \
        --version-label $VERSION_LABEL \
        --region $REGION
else
    echo "Creando ambiente (esto puede tardar 5-10 minutos)..."
    aws elasticbeanstalk create-environment \
        --application-name $APP_NAME \
        --environment-name $ENV_NAME \
        --version-label $VERSION_LABEL \
        --solution-stack-name "64bit Amazon Linux 2023 v6.2.0 running Node.js 20" \
        --option-settings \
            Namespace=aws:autoscaling:launchconfiguration,OptionName=IamInstanceProfile,Value=$ROLE_NAME \
            Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=production \
            Namespace=aws:elasticbeanstalk:application:environment,OptionName=PORT,Value=8080 \
            Namespace=aws:elasticbeanstalk:application:environment,OptionName=SECRETS_REGION,Value=$REGION \
            Namespace=aws:elasticbeanstalk:application:environment,OptionName=SECRET_NAME,Value=$SECRET_NAME \
            Namespace=aws:autoscaling:launchconfiguration,OptionName=InstanceType,Value=t3.micro \
            Namespace=aws:elasticbeanstalk:environment,OptionName=EnvironmentType,Value=SingleInstance \
        --region $REGION
fi

# Limpiar
rm pedidos-backend.zip

echo ""
echo -e "${GREEN}✅ Deployment iniciado${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⏳ PASO 6: Esperando que el ambiente esté listo...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Esto puede tardar 5-10 minutos..."
echo ""

# Esperar a que esté listo
for i in {1..60}; do
    STATUS=$(aws elasticbeanstalk describe-environments \
        --application-name $APP_NAME \
        --environment-names $ENV_NAME \
        --region $REGION \
        --query 'Environments[0].Status' \
        --output text)
    
    HEALTH=$(aws elasticbeanstalk describe-environments \
        --application-name $APP_NAME \
        --environment-names $ENV_NAME \
        --region $REGION \
        --query 'Environments[0].Health' \
        --output text)
    
    echo -ne "\rEstado: $STATUS | Salud: $HEALTH | Intentos: $i/60"
    
    if [ "$STATUS" == "Ready" ] && [ "$HEALTH" == "Green" ]; then
        echo ""
        break
    fi
    
    if [ "$STATUS" == "Terminated" ]; then
        echo ""
        echo -e "${RED}❌ El ambiente falló al crear${NC}"
        exit 1
    fi
    
    sleep 10
done

echo ""
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 OBTENER URL DEL BACKEND${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BACKEND_URL=$(aws elasticbeanstalk describe-environments \
    --application-name $APP_NAME \
    --environment-names $ENV_NAME \
    --region $REGION \
    --query 'Environments[0].CNAME' \
    --output text)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║              ✅ BACKEND DESPLEGADO EXITOSAMENTE                  ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 INFORMACIÓN IMPORTANTE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "🌐 URL del Backend:"
echo -e "   ${GREEN}http://$BACKEND_URL${NC}"
echo ""
echo -e "🔗 Actualiza tu frontend con:"
echo -e "   ${BLUE}export const API_URL = 'http://$BACKEND_URL'${NC}"
echo ""
echo -e "📊 Ver estado:"
echo -e "   ${BLUE}./server/scripts/eb-status.sh${NC}"
echo ""
echo -e "⏸️  Pausar (ahorrar costos):"
echo -e "   ${BLUE}./server/scripts/eb-stop.sh${NC}"
echo ""
echo -e "▶️  Reanudar:"
echo -e "   ${BLUE}./server/scripts/eb-start.sh${NC}"
echo ""
echo -e "🗑️  Eliminar completamente:"
echo -e "   ${BLUE}./server/scripts/eb-delete.sh${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}¡Listo! Tu backend está funcionando en AWS 🚀${NC}"
echo ""
