#!/bin/bash

# Script para ver el estado del backend en Elastic Beanstalk
# Uso: ./server/scripts/eb-status.sh

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
echo -e "${BLUE}║           📊 ESTADO DEL BACKEND - ELASTIC BEANSTALK             ║${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Obtener información del ambiente
ENV_INFO=$(aws elasticbeanstalk describe-environments \
    --application-name $APP_NAME \
    --environment-names $ENV_NAME \
    --region $REGION \
    --output json 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$ENV_INFO" ] || [ "$ENV_INFO" == "null" ]; then
    echo -e "${RED}❌ No se encontró el ambiente${NC}"
    echo -e "Para crear el backend, ejecuta: ${YELLOW}./server/scripts/eb-create.sh${NC}"
    exit 1
fi

STATUS=$(echo $ENV_INFO | jq -r '.Environments[0].Status')
HEALTH=$(echo $ENV_INFO | jq -r '.Environments[0].Health')
CNAME=$(echo $ENV_INFO | jq -r '.Environments[0].CNAME')
VERSION=$(echo $ENV_INFO | jq -r '.Environments[0].VersionLabel')
UPDATED=$(echo $ENV_INFO | jq -r '.Environments[0].DateUpdated')

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 INFORMACIÓN GENERAL${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Aplicación:  ${BLUE}$APP_NAME${NC}"
echo -e "Ambiente:    ${BLUE}$ENV_NAME${NC}"
echo ""

# Estado con color
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔍 ESTADO ACTUAL${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$STATUS" == "Ready" ]; then
    echo -e "Estado:      ${GREEN}●${NC} $STATUS"
else
    echo -e "Estado:      ${YELLOW}●${NC} $STATUS"
fi

case $HEALTH in
    "Green")
        echo -e "Salud:       ${GREEN}✅ $HEALTH${NC}"
        ;;
    "Yellow")
        echo -e "Salud:       ${YELLOW}⚠️  $HEALTH${NC}"
        ;;
    "Red")
        echo -e "Salud:       ${RED}❌ $HEALTH${NC}"
        ;;
    "Grey")
        echo -e "Salud:       ⚪ $HEALTH"
        ;;
    *)
        echo -e "Salud:       $HEALTH"
        ;;
esac

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🌐 ACCESO${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "URL:         ${GREEN}http://$CNAME${NC}"
echo ""

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📦 VERSIÓN${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Versión:     $VERSION"
echo -e "Actualizado: $UPDATED"
echo ""

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📊 RECURSOS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Obtener info de recursos
RESOURCES=$(aws elasticbeanstalk describe-environment-resources \
    --environment-name $ENV_NAME \
    --region $REGION \
    --output json 2>/dev/null)

if [ ! -z "$RESOURCES" ]; then
    INSTANCES=$(echo $RESOURCES | jq -r '.EnvironmentResources.Instances | length')
    echo -e "Instancias:  $INSTANCES"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔗 VARIABLES DE ENTORNO${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

aws elasticbeanstalk describe-configuration-settings \
    --application-name $APP_NAME \
    --environment-name $ENV_NAME \
    --region $REGION \
    --query 'ConfigurationSettings[0].OptionSettings[?Namespace==`aws:elasticbeanstalk:application:environment`].[OptionName,Value]' \
    --output table 2>/dev/null | grep -v "^---" | grep -v "^|.*|$" || echo "No configuradas"

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📈 ÚLTIMOS EVENTOS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

aws elasticbeanstalk describe-events \
    --environment-name $ENV_NAME \
    --region $REGION \
    --max-items 10 \
    --query 'Events[*].[EventDate,Severity,Message]' \
    --output table 2>/dev/null

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📌 ACCIONES DISPONIBLES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Pausar:      ${BLUE}./server/scripts/eb-stop.sh${NC}"
echo -e "Reanudar:    ${BLUE}./server/scripts/eb-start.sh${NC}"
echo -e "Actualizar:  ${BLUE}./server/scripts/eb-deploy.sh${NC}"
echo -e "Eliminar:    ${BLUE}./server/scripts/eb-delete.sh${NC}"
echo -e "Logs:        ${BLUE}./server/scripts/eb-logs.sh${NC}"
echo ""
