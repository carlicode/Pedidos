#!/bin/bash

# Script para ver los logs del backend en Elastic Beanstalk
# Uso: ./server/scripts/eb-logs.sh

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

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}║              📋 LOGS DEL BACKEND                                 ║${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar que el ambiente existe
if ! aws elasticbeanstalk describe-environments \
    --application-name $APP_NAME \
    --environment-names $ENV_NAME \
    --region $REGION &> /dev/null; then
    echo -e "${RED}❌ El ambiente no existe${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📥 Solicitando logs...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Solicitar logs
aws elasticbeanstalk request-environment-info \
    --environment-name $ENV_NAME \
    --info-type tail \
    --region $REGION

echo "Esperando 5 segundos..."
sleep 5

# Obtener URL de los logs
LOG_URL=$(aws elasticbeanstalk retrieve-environment-info \
    --environment-name $ENV_NAME \
    --info-type tail \
    --region $REGION \
    --query 'EnvironmentInfo[0].Message' \
    --output text)

if [ -z "$LOG_URL" ] || [ "$LOG_URL" == "None" ]; then
    echo -e "${RED}❌ No se pudieron obtener los logs${NC}"
    echo "Intenta de nuevo en unos segundos"
    exit 1
fi

echo -e "${GREEN}✅ Logs obtenidos${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📄 ÚLTIMAS 100 LÍNEAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Descargar y mostrar logs
curl -s $LOG_URL | tail -100

echo ""
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}💡 OPCIONES${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Ver todos los logs:"
echo -e "   ${BLUE}curl -s $LOG_URL | less${NC}"
echo ""
echo -e "Buscar errores:"
echo -e "   ${BLUE}curl -s $LOG_URL | grep -i error${NC}"
echo ""
echo -e "Ver logs en tiempo real (CloudWatch):"
echo -e "   https://console.aws.amazon.com/cloudwatch/home?region=$REGION"
echo ""
