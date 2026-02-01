#!/bin/bash

# Script para descargar logs de AWS (Elastic Beanstalk) y analizar si hubo
# carreras eliminadas o anomalías de IDs (desorden por fecha de creación).
# Uso: ./backend/scripts/eb-logs-analyze-carreras.sh [líneas_opcionales]
# Ejemplo: ./backend/scripts/eb-logs-analyze-carreras.sh 5000

set -e

APP_NAME="pedidos-backend"
ENV_NAME="pedidos-backend-prod"
REGION="us-east-1"
LINES="${1:-2000}"   # Por defecto últimas 2000 líneas del log

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     📋 ANÁLISIS DE LOGS AWS - CARRERAS ELIMINADAS / IDs          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Solicitar logs
aws elasticbeanstalk request-environment-info \
    --environment-name $ENV_NAME \
    --info-type tail \
    --region $REGION &> /dev/null || true

echo "Esperando 5 segundos para que AWS genere el log..."
sleep 5

LOG_URL=$(aws elasticbeanstalk retrieve-environment-info \
    --environment-name $ENV_NAME \
    --info-type tail \
    --region $REGION \
    --query 'EnvironmentInfo[0].Message' \
    --output text 2>/dev/null)

if [ -z "$LOG_URL" ] || [ "$LOG_URL" == "None" ]; then
    echo -e "${RED}❌ No se pudieron obtener los logs. Verifica AWS CLI y el ambiente.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Descargando últimas $LINES líneas del log...${NC}"
echo ""

LOG_FILE=$(mktemp)
trap "rm -f $LOG_FILE" EXIT
curl -s "$LOG_URL" | tail -n "$LINES" > "$LOG_FILE"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  1. IDs CREADOS (Added new order #N)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
CREATED=$(grep -oE 'Added new order #[0-9]+' "$LOG_FILE" | grep -oE '[0-9]+' || true)
if [ -n "$CREATED" ]; then
    echo "$CREATED" | sort -n | uniq
    TOTAL_CREATED=$(echo "$CREATED" | wc -l | tr -d ' ')
    echo -e "\n${GREEN}Total creaciones en este log: $TOTAL_CREATED${NC}"
else
    echo "(No se encontraron líneas 'Added new order #N' en este tramo del log)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  2. PRÓXIMOS IDs GENERADOS (next-id)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
NEXT_IDS=$(grep -oE 'Próximo ID generado: [0-9]+' "$LOG_FILE" | grep -oE '[0-9]+' || true)
if [ -n "$NEXT_IDS" ]; then
    echo "$NEXT_IDS" | sort -n | uniq
    echo -e "\nÚltimo 'próximo ID' en el log: $(echo "$NEXT_IDS" | tail -1)"
else
    echo "(No se encontraron líneas 'Próximo ID generado' en este tramo)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  3. ⚠️  ID DUPLICADO / YA EXISTE (posible sobrescritura evitada)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
DUP=$(grep -E 'ID [0-9]+ ya existe en fila|ADVERTENCIA: ID [0-9]+ ya existe|Nuevo ID asignado para evitar' "$LOG_FILE" || true)
if [ -n "$DUP" ]; then
    echo "$DUP"
    echo -e "\n${YELLOW}Si ves muchos de estos, hubo intentos de crear con ID ya usado (el backend genera nuevo ID).${NC}"
else
    echo "(Ninguno en este tramo)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  4. AUDIT CREAR (Pedido #N)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
AUDIT_CREAR=$(grep -oE '\[AUDIT\] CREAR - Pedido #[0-9]+' "$LOG_FILE" | grep -oE '[0-9]+' || true)
if [ -n "$AUDIT_CREAR" ]; then
    echo "$AUDIT_CREAR" | sort -n | uniq
else
    echo "(El audit log se escribe en el servidor; en EB solo ves console.log. Ninguna línea [AUDIT] en este tramo.)"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  5. DETECCIÓN DE HUECOS EN SECUENCIA DE IDs CREADOS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
ALL_IDS=$( (echo "$CREATED"; echo "$AUDIT_CREAR") | sort -n | uniq )
if [ -n "$ALL_IDS" ]; then
    MIN=$(echo "$ALL_IDS" | head -1)
    MAX=$(echo "$ALL_IDS" | tail -1)
    echo "Rango de IDs en este log: $MIN - $MAX"
    GAPS=""
    for (( id=MIN; id<=MAX; id++ )); do
        if ! echo "$ALL_IDS" | grep -qx "$id"; then
            GAPS="$GAPS $id"
        fi
    done
    if [ -n "$GAPS" ]; then
        echo -e "${YELLOW}Huecos (IDs no creados en este tramo pero dentro del rango):$GAPS${NC}"
        echo -e "${YELLOW}→ Pueden ser IDs de carreras que ya existían o que se eliminaron del sheet.${NC}"
    else
        echo "No hay huecos en la secuencia de IDs creados en este tramo."
    fi
else
    echo "No hay suficientes IDs en el log para calcular huecos."
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CÓMO INTERPRETAR SI HAY CARRERAS ELIMINADAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "• Si en el SHEET ves IDs desordenados por Fecha Registro (ej: ID 3776 con 08/01 después de 3775 con 31/01):"
echo "  → Es síntoma de que filas se borraron en el Sheet (manual o script) y el orden ya no es cronológico."
echo "• Compara: IDs que aparecen CREADOS en este log vs IDs que tienes hoy en el Sheet."
echo "  → Si un ID salió en el log como creado y ya NO está en el Sheet, esa carrera fue eliminada."
echo "• Para más líneas de log: ./backend/scripts/eb-logs-analyze-carreras.sh 10000"
echo "• URL de este log (guardar para revisar completo):"
echo "  $LOG_URL"
echo ""
