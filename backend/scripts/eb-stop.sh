#!/bin/bash

# Script para pausar/detener el backend en Elastic Beanstalk
# Uso: ./server/scripts/eb-stop.sh

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

echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                                                                  ║${NC}"
echo -e "${YELLOW}║              ⏸️  PAUSANDO BACKEND (AHORRAR COSTOS)              ║${NC}"
echo -e "${YELLOW}║                                                                  ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📋 Esto terminará el ambiente pero mantendrá la configuración${NC}"
echo -e "${BLUE}   Para reanudar: ${YELLOW}./server/scripts/eb-start.sh${NC}"
echo ""

# Confirmar
read -p "¿Continuar? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Cancelado${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 Terminando ambiente...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

aws elasticbeanstalk terminate-environment \
    --environment-name $ENV_NAME \
    --region $REGION

echo ""
echo -e "${YELLOW}⏳ Esperando que el ambiente termine...${NC}"

# Esperar
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

echo ""
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║              ✅ BACKEND PAUSADO EXITOSAMENTE                     ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}💰 AHORRO DE COSTOS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "✅ Ya no se cobrarán recursos de EC2"
echo -e "✅ La configuración se mantiene guardada"
echo -e "✅ El código está seguro en S3"
echo ""
echo -e "${BLUE}Para reanudar el backend:${NC}"
echo -e "   ${GREEN}./server/scripts/eb-start.sh${NC}"
echo ""
