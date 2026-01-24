#!/bin/bash

# Script para actualizar/desplegar nueva versión del backend
# Uso: ./server/scripts/eb-deploy.sh

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
echo -e "${BLUE}║              📦 DESPLEGANDO NUEVA VERSIÓN                        ║${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "server/package.json" ]; then
    echo -e "${RED}❌ Error: Debes ejecutar este script desde la raíz del proyecto${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 Empaquetando código...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd server
zip -r ../pedidos-backend.zip . -x "*.git*" "node_modules/*" "scripts/*" "test-*" "logs/*"
cd ..

echo -e "${GREEN}✅ Código empaquetado${NC}"
echo ""

VERSION_LABEL="v$(date +%Y%m%d-%H%M%S)"
BUCKET_NAME="elasticbeanstalk-$REGION-$(aws sts get-caller-identity --query Account --output text)"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}☁️  Subiendo a S3...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

aws s3 cp pedidos-backend.zip s3://$BUCKET_NAME/pedidos-backend/$VERSION_LABEL.zip

echo -e "${GREEN}✅ Código subido${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Creando versión de aplicación...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

aws elasticbeanstalk create-application-version \
    --application-name $APP_NAME \
    --version-label $VERSION_LABEL \
    --source-bundle S3Bucket=$BUCKET_NAME,S3Key=pedidos-backend/$VERSION_LABEL.zip \
    --region $REGION

echo -e "${GREEN}✅ Versión creada: $VERSION_LABEL${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Desplegando al ambiente...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

aws elasticbeanstalk update-environment \
    --application-name $APP_NAME \
    --environment-name $ENV_NAME \
    --version-label $VERSION_LABEL \
    --region $REGION

# Limpiar
rm pedidos-backend.zip

echo ""
echo -e "${YELLOW}⏳ Esperando que el despliegue complete...${NC}"
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
    
    VERSION=$(aws elasticbeanstalk describe-environments \
        --application-name $APP_NAME \
        --environment-names $ENV_NAME \
        --region $REGION \
        --query 'Environments[0].VersionLabel' \
        --output text)
    
    echo -ne "\rEstado: $STATUS | Salud: $HEALTH | Versión: $VERSION | Intentos: $i/60"
    
    if [ "$STATUS" == "Ready" ] && [ "$VERSION" == "$VERSION_LABEL" ]; then
        echo ""
        break
    fi
    
    sleep 10
done

echo ""
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║              ✅ DESPLIEGUE COMPLETADO                            ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 INFORMACIÓN${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Versión:     ${GREEN}$VERSION_LABEL${NC}"
echo -e "Estado:      ${GREEN}$STATUS${NC}"
echo -e "Salud:       ${GREEN}$HEALTH${NC}"
echo ""
echo -e "Ver estado:  ${BLUE}./server/scripts/eb-status.sh${NC}"
echo -e "Ver logs:    ${BLUE}./server/scripts/eb-logs.sh${NC}"
echo ""
