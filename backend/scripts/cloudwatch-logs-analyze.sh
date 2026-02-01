#!/bin/bash

# Script para descargar logs de CloudWatch y analizar carreras eliminadas
# Los logs de Elastic Beanstalk tail solo muestran nginx, no la app Node.js
# Para logs de la app necesitamos CloudWatch Logs
# Uso: ./backend/scripts/cloudwatch-logs-analyze.sh

set -e

REGION="us-east-1"
LOG_GROUP="/aws/elasticbeanstalk/pedidos-backend-prod/var/log/nodejs/nodejs.log"
HOURS_AGO="${1:-24}"  # Por defecto últimas 24 horas

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📋 ANÁLISIS DE CLOUDWATCH LOGS - CARRERAS ELIMINADAS          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Calcular timestamp (milisegundos desde epoch)
START_TIME=$(($(date +%s) * 1000 - $HOURS_AGO * 3600 * 1000))

echo -e "${YELLOW}Descargando logs de las últimas $HOURS_AGO horas desde CloudWatch...${NC}"
echo -e "${YELLOW}Log Group: $LOG_GROUP${NC}"
echo ""

# Crear archivo temporal
TEMP_LOG=$(mktemp)
trap "rm -f $TEMP_LOG" EXIT

# Descargar logs desde CloudWatch (filter-log-events devuelve JSON)
echo -e "${BLUE}Consultando CloudWatch...${NC}"
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --region "$REGION" \
    --output text \
    --query 'events[*].message' > "$TEMP_LOG" 2>/dev/null || {
    echo -e "${RED}❌ Error consultando CloudWatch. Verifica:${NC}"
    echo "  1. Que el log group existe: $LOG_GROUP"
    echo "  2. Que tienes permisos para logs:FilterLogEvents"
    echo "  3. Que AWS CLI está configurado correctamente"
    echo ""
    echo -e "${YELLOW}Para ver los log groups disponibles:${NC}"
    echo "  aws logs describe-log-groups --region $REGION --query 'logGroups[*].logGroupName'"
    exit 1
}

LINES=$(wc -l < "$TEMP_LOG" | tr -d ' ')
echo -e "${GREEN}✅ Descargados $LINES líneas de log${NC}"
echo ""

if [ "$LINES" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No hay logs en el rango de tiempo especificado${NC}"
    echo "Intenta con más horas: ./backend/scripts/cloudwatch-logs-analyze.sh 48"
    exit 0
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  1. IDs CREADOS (Added new order #N)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
CREATED=$(grep -oE 'Added new order #[0-9]+' "$TEMP_LOG" | grep -oE '[0-9]+' | sort -n | uniq || true)
if [ -n "$CREATED" ]; then
    echo "$CREATED"
    TOTAL_CREATED=$(echo "$CREATED" | wc -l | tr -d ' ')
    MIN_ID=$(echo "$CREATED" | head -1)
    MAX_ID=$(echo "$CREATED" | tail -1)
    echo -e "\n${GREEN}Total IDs creados: $TOTAL_CREATED (rango: $MIN_ID - $MAX_ID)${NC}"
else
    echo "(No se encontraron líneas 'Added new order' en este período)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  2. PRÓXIMOS IDs GENERADOS (/api/next-id)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
NEXT_IDS=$(grep -oE 'Próximo ID generado: [0-9]+' "$TEMP_LOG" | grep -oE '[0-9]+' | sort -n | uniq || true)
if [ -n "$NEXT_IDS" ]; then
    echo "$NEXT_IDS" | tail -20
    LAST_NEXT=$(echo "$NEXT_IDS" | tail -1)
    echo -e "\n${GREEN}Último 'próximo ID' generado: $LAST_NEXT${NC}"
else
    echo "(No se encontraron líneas 'Próximo ID generado' en este período)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  3. ⚠️  ID DUPLICADO / YA EXISTE${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
DUP=$(grep -E 'ID [0-9]+ ya existe en fila|ADVERTENCIA: ID [0-9]+ ya existe|Nuevo ID asignado' "$TEMP_LOG" | head -20 || true)
if [ -n "$DUP" ]; then
    echo "$DUP"
    COUNT=$(grep -cE 'ID [0-9]+ ya existe en fila|ADVERTENCIA: ID [0-9]+ ya existe' "$TEMP_LOG" || echo "0")
    echo -e "\n${YELLOW}Total de conflictos de ID: $COUNT${NC}"
else
    echo "(Ningún conflicto de ID detectado - ¡buena señal!)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  4. PEDIDOS EDITADOS (PUT /api/orders/:id)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
EDITED=$(grep -oE 'Updated order #[0-9]+' "$TEMP_LOG" | grep -oE '[0-9]+' | sort -n | uniq || true)
if [ -n "$EDITED" ]; then
    TOTAL_EDITED=$(echo "$EDITED" | wc -l | tr -d ' ')
    echo -e "${GREEN}Total de pedidos editados: $TOTAL_EDITED${NC}"
    echo "Últimos 10:"
    echo "$EDITED" | tail -10
else
    echo "(No se encontraron ediciones en este período)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  5. HUECOS EN SECUENCIA DE IDs${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "$CREATED" ]; then
    MIN=$(echo "$CREATED" | head -1)
    MAX=$(echo "$CREATED" | tail -1)
    echo "Rango de IDs creados en este período: $MIN - $MAX"
    
    GAPS=""
    for (( id=MIN; id<=MAX; id++ )); do
        if ! echo "$CREATED" | grep -qx "$id"; then
            GAPS="$GAPS $id"
        fi
    done
    
    if [ -n "$GAPS" ]; then
        GAP_COUNT=$(echo "$GAPS" | wc -w | tr -d ' ')
        echo -e "${YELLOW}Huecos encontrados ($GAP_COUNT IDs):$GAPS${NC}"
        echo -e "${YELLOW}→ Estos IDs NO fueron creados en este período de tiempo.${NC}"
        echo -e "${YELLOW}→ Pueden ser IDs que ya existían o que fueron eliminados del sheet.${NC}"
    else
        echo -e "${GREEN}✅ No hay huecos - secuencia continua de IDs${NC}"
    fi
else
    echo "No hay suficientes datos para analizar huecos"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CÓMO DETECTAR CARRERAS ELIMINADAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "1. Compara los IDs CREADOS arriba con los IDs que aparecen HOY en el Sheet"
echo "2. Si un ID fue CREADO en este log y NO está en el Sheet → fue eliminado"
echo "3. Revisa el Historial de Versiones del Google Sheet para ver quién eliminó filas"
echo ""
echo -e "${YELLOW}Para buscar más atrás en el tiempo:${NC}"
echo "  ./backend/scripts/cloudwatch-logs-analyze.sh 48   (últimas 48 horas)"
echo "  ./backend/scripts/cloudwatch-logs-analyze.sh 168  (última semana)"
echo ""
echo -e "${YELLOW}Para ver log groups disponibles:${NC}"
echo "  aws logs describe-log-groups --region $REGION"
echo ""
