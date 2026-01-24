#!/bin/bash

# Script para eliminar completamente el backend de Elastic Beanstalk
# Uso: ./server/scripts/eb-delete.sh

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

echo -e "${RED}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                                  ║${NC}"
echo -e "${RED}║              🗑️  ELIMINAR BACKEND COMPLETAMENTE                 ║${NC}"
echo -e "${RED}║                                                                  ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${RED}⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE${NC}"
echo -e "${YELLOW}Esto eliminará:${NC}"
echo -e "  - El ambiente de producción"
echo -e "  - La aplicación Elastic Beanstalk"
echo -e "  - Todas las versiones de código en S3"
echo ""

# Confirmar
read -p "¿Estás seguro? Escribe 'DELETE' para confirmar: " CONFIRM
if [ "$CONFIRM" != "DELETE" ]; then
    echo -e "${YELLOW}Cancelado${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🗑️  PASO 1: Terminar ambiente${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verificar si el ambiente existe
if aws elasticbeanstalk describe-environments \
    --application-name $APP_NAME \
    --environment-names $ENV_NAME \
    --region $REGION | grep -q "EnvironmentName"; then
    
    echo "Terminando ambiente..."
    aws elasticbeanstalk terminate-environment \
        --environment-name $ENV_NAME \
        --region $REGION
    
    echo "Esperando que el ambiente termine..."
    for i in {1..30}; do
        STATUS=$(aws elasticbeanstalk describe-environments \
            --application-name $APP_NAME \
            --environment-names $ENV_NAME \
            --region $REGION \
            --query 'Environments[0].Status' \
            --output text 2>/dev/null || echo "Terminated")
        
        echo -ne "\rEstado: $STATUS | Intentos: $i/30"
        
        if [ "$STATUS" == "Terminated" ]; then
            echo ""
            break
        fi
        
        sleep 10
    done
    
    echo -e "${GREEN}✅ Ambiente terminado${NC}"
else
    echo -e "${YELLOW}⚠️  El ambiente ya no existe${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🗑️  PASO 2: Eliminar aplicación${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if aws elasticbeanstalk describe-applications \
    --application-names $APP_NAME \
    --region $REGION &> /dev/null; then
    
    echo "Eliminando aplicación..."
    aws elasticbeanstalk delete-application \
        --application-name $APP_NAME \
        --terminate-env-by-force \
        --region $REGION
    
    echo -e "${GREEN}✅ Aplicación eliminada${NC}"
else
    echo -e "${YELLOW}⚠️  La aplicación ya no existe${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🗑️  PASO 3: Limpiar archivos en S3${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BUCKET_NAME="elasticbeanstalk-$REGION-$(aws sts get-caller-identity --query Account --output text)"

if aws s3 ls s3://$BUCKET_NAME/pedidos-backend/ &> /dev/null; then
    echo "Eliminando archivos de código..."
    aws s3 rm s3://$BUCKET_NAME/pedidos-backend/ --recursive
    echo -e "${GREEN}✅ Archivos eliminados${NC}"
else
    echo -e "${YELLOW}⚠️  No hay archivos para eliminar${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║              ✅ BACKEND ELIMINADO COMPLETAMENTE                  ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Los roles IAM y políticas se mantienen para futuro uso.${NC}"
echo -e "${BLUE}Para crear un nuevo backend: ${YELLOW}./server/scripts/eb-create.sh${NC}"
echo ""
