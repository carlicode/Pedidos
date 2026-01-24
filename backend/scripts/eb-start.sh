#!/bin/bash

# Script para reanudar el backend en Elastic Beanstalk
# Uso: ./server/scripts/eb-start.sh

set -e

# Configuración
APP_NAME="pedidos-backend"
ENV_NAME="pedidos-backend-prod"
REGION="us-east-1"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║              ▶️  REANUDANDO BACKEND                              ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar si el ambiente existe y está terminado
STATUS=$(aws elasticbeanstalk describe-environments \
    --application-name $APP_NAME \
    --environment-names $ENV_NAME \
    --region $REGION \
    --query 'Environments[0].Status' \
    --output text 2>/dev/null || echo "NotFound")

if [ "$STATUS" == "NotFound" ]; then
    echo -e "${RED}❌ El ambiente no existe o ya fue eliminado${NC}"
    echo -e "Para crear uno nuevo: ${YELLOW}./server/scripts/eb-create.sh${NC}"
    exit 1
fi

if [ "$STATUS" != "Terminated" ]; then
    echo -e "${YELLOW}⚠️  El ambiente ya está activo (Estado: $STATUS)${NC}"
    echo -e "Usa ${BLUE}./server/scripts/eb-status.sh${NC} para ver detalles"
    exit 0
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 Recreando ambiente...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Obtener la última versión
LATEST_VERSION=$(aws elasticbeanstalk describe-application-versions \
    --application-name $APP_NAME \
    --region $REGION \
    --query 'ApplicationVersions | sort_by(@, &DateCreated) | [-1].VersionLabel' \
    --output text)

echo "Versión a desplegar: $LATEST_VERSION"
echo ""

# Recrear ambiente
ROLE_NAME="PedidosEBInstanceRole"
SECRET_NAME="pedidos/prod/all-secrets"

aws elasticbeanstalk create-environment \
    --application-name $APP_NAME \
    --environment-name $ENV_NAME \
    --version-label $LATEST_VERSION \
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

echo ""
echo -e "${YELLOW}⏳ Esperando que el ambiente esté listo...${NC}"
echo "Esto puede tardar 5-10 minutos..."
echo ""

# Esperar
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

BACKEND_URL=$(aws elasticbeanstalk describe-environments \
    --application-name $APP_NAME \
    --environment-names $ENV_NAME \
    --region $REGION \
    --query 'Environments[0].CNAME' \
    --output text)

echo ""
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║              ✅ BACKEND REANUDADO EXITOSAMENTE                   ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🌐 INFORMACIÓN${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "URL:         ${GREEN}http://$BACKEND_URL${NC}"
echo -e "Ver estado:  ${BLUE}./server/scripts/eb-status.sh${NC}"
echo ""
