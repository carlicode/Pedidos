#!/bin/bash

# Script para analizar los archivos de audit log locales
# Detecta: carreras creadas, editadas, posibles duplicados, y ayuda a identificar carreras eliminadas
# Uso: ./backend/scripts/analyze-audit-logs.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

AUDIT_LOG="backend/logs/audit/audit-log.json"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           📋 ANÁLISIS DE AUDIT LOGS - CARRERAS                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar que existe el archivo
if [ ! -f "$AUDIT_LOG" ]; then
    echo -e "${RED}❌ No se encontró el archivo: $AUDIT_LOG${NC}"
    echo "Asegúrate de ejecutar este script desde la raíz del proyecto."
    exit 1
fi

echo -e "${GREEN}✅ Analizando: $AUDIT_LOG${NC}"
echo ""

# Verificar que jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Este script requiere 'jq' para parsear JSON.${NC}"
    echo "Instalar con: brew install jq (macOS) o apt-get install jq (Linux)"
    exit 1
fi

# Crear archivo temporal para análisis
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

# 1. ESTADÍSTICAS GENERALES
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  1. ESTADÍSTICAS GENERALES${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TOTAL_ENTRIES=$(jq '. | length' "$AUDIT_LOG")
echo -e "Total de entradas en el log: ${GREEN}$TOTAL_ENTRIES${NC}"

CREAR_COUNT=$(jq '[.[] | select(.action == "CREAR")] | length' "$AUDIT_LOG")
EDITAR_COUNT=$(jq '[.[] | select(.action == "EDITAR")] | length' "$AUDIT_LOG")
ELIMINAR_COUNT=$(jq '[.[] | select(.action == "ELIMINAR")] | length' "$AUDIT_LOG")

echo -e "  • CREAR:   ${GREEN}$CREAR_COUNT${NC}"
echo -e "  • EDITAR:  ${YELLOW}$EDITAR_COUNT${NC}"
echo -e "  • ELIMINAR: ${RED}$ELIMINAR_COUNT${NC}"

# 2. TODAS LAS CARRERAS CREADAS
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  2. TODAS LAS CARRERAS CREADAS (según audit log)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

jq -r '.[] | select(.action == "CREAR") | "\(.orderId) - \(.timestamp) - \(.operator)"' "$AUDIT_LOG" | \
    sort -t'-' -k1,1n > "$TEMP_FILE"

if [ -s "$TEMP_FILE" ]; then
    echo "ID      | Timestamp                | Operador"
    echo "--------+-------------------------+-----------------"
    cat "$TEMP_FILE" | awk -F' - ' '{printf "%-7s | %-23s | %s\n", $1, $2, $3}'
    echo ""
    echo -e "${GREEN}Total: $CREAR_COUNT carreras creadas${NC}"
else
    echo "No se encontraron carreras creadas en el log."
fi

# 3. DETECTAR DUPLICADOS (mismo ID creado múltiples veces)
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  3. ⚠️  CARRERAS CON MÚLTIPLES CREACIONES (duplicados)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

DUPLICATES=$(jq -r '.[] | select(.action == "CREAR") | .orderId' "$AUDIT_LOG" | sort | uniq -d)

if [ -n "$DUPLICATES" ]; then
    echo -e "${YELLOW}⚠️  Se encontraron IDs con múltiples creaciones (posible sobrescritura):${NC}"
    echo ""
    for id in $DUPLICATES; do
        echo -e "${RED}ID $id fue creado múltiples veces:${NC}"
        jq -r ".[] | select(.action == \"CREAR\" and .orderId == \"$id\") | \"  → \(.timestamp) por \(.operator)\"" "$AUDIT_LOG"
        
        # Verificar si hay advertencia de ID duplicado
        if jq -e ".[] | select(.action == \"CREAR\" and .orderId == \"$id\" and .metadata.warning)" "$AUDIT_LOG" > /dev/null 2>&1; then
            echo -e "  ${YELLOW}(El backend detectó duplicado y asignó nuevo ID)${NC}"
        fi
        echo ""
    done
else
    echo -e "${GREEN}✅ No se detectaron IDs duplicados en las creaciones${NC}"
fi

# 4. CARRERAS CON ADVERTENCIAS
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  4. ⚠️  CARRERAS CON ADVERTENCIAS O FLAGS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

WARNINGS=$(jq -r '.[] | select(.metadata.warning or .metadata.suspicious) | "\(.orderId)|\(.action)|\(.timestamp)|\(.metadata.warning // .metadata.suspicious)"' "$AUDIT_LOG")

if [ -n "$WARNINGS" ]; then
    echo "ID      | Acción | Timestamp                | Advertencia"
    echo "--------+--------+-------------------------+--------------------------------"
    echo "$WARNINGS" | awk -F'|' '{printf "%-7s | %-6s | %-23s | %s\n", $1, $2, $3, $4}'
else
    echo -e "${GREEN}✅ No hay advertencias registradas${NC}"
fi

# 5. OPERADORES MÁS ACTIVOS
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  5. 👥 OPERADORES MÁS ACTIVOS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

jq -r '.[] | .operator' "$AUDIT_LOG" | sort | uniq -c | sort -rn | \
    awk '{printf "%-20s: %s operaciones\n", $2, $1}'

# 6. ACTIVIDAD POR DÍA
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  6. 📅 ACTIVIDAD POR DÍA${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

jq -r '.[] | .timestamp | split("T")[0]' "$AUDIT_LOG" | sort | uniq -c | sort | \
    awk '{printf "%s: %s operaciones\n", $2, $1}'

# 7. RANGO DE IDs CREADOS
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  7. 🔢 RANGO DE IDs CREADOS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

IDS=$(jq -r '.[] | select(.action == "CREAR") | .orderId' "$AUDIT_LOG" | sort -n)

if [ -n "$IDS" ]; then
    MIN_ID=$(echo "$IDS" | head -1)
    MAX_ID=$(echo "$IDS" | tail -1)
    
    echo -e "ID mínimo creado: ${GREEN}$MIN_ID${NC}"
    echo -e "ID máximo creado: ${GREEN}$MAX_ID${NC}"
    echo -e "Rango: ${GREEN}$MIN_ID - $MAX_ID${NC}"
    
    # Detectar huecos en la secuencia
    echo ""
    echo "Detectando huecos en la secuencia de IDs..."
    
    GAPS=""
    COUNT_GAPS=0
    for (( id=$MIN_ID; id<=$MAX_ID; id++ )); do
        if ! echo "$IDS" | grep -qx "$id"; then
            GAPS="$GAPS $id"
            COUNT_GAPS=$((COUNT_GAPS + 1))
        fi
    done
    
    if [ -n "$GAPS" ]; then
        echo -e "${YELLOW}⚠️  Se encontraron $COUNT_GAPS huecos en la secuencia:${NC}"
        if [ $COUNT_GAPS -le 50 ]; then
            echo "$GAPS" | tr ' ' '\n' | grep -v '^$' | column -x
        else
            echo "(Demasiados huecos para mostrar - total: $COUNT_GAPS)"
            echo "Primeros 20:"
            echo "$GAPS" | tr ' ' '\n' | grep -v '^$' | head -20 | column -x
        fi
        echo ""
        echo -e "${YELLOW}NOTA: Estos IDs NO aparecen como CREADOS en el audit log.${NC}"
        echo "Pueden ser:"
        echo "  • IDs que ya existían antes de activar el audit log"
        echo "  • Carreras que se eliminaron del Sheet"
        echo "  • IDs saltados por el sistema de prevención de duplicados"
    else
        echo -e "${GREEN}✅ No hay huecos - secuencia continua de $MIN_ID a $MAX_ID${NC}"
    fi
else
    echo "No se encontraron IDs en el log."
fi

# 8. CARRERAS MÁS EDITADAS
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  8. 📝 CARRERAS MÁS EDITADAS (top 10)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

jq -r '.[] | select(.action == "EDITAR") | .orderId' "$AUDIT_LOG" | sort | uniq -c | sort -rn | head -10 | \
    awk '{printf "Carrera #%-7s: %s ediciones\n", $2, $1}'

# 9. INFORMACIÓN DEL ARCHIVO
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  9. 📁 INFORMACIÓN DEL ARCHIVO${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

FILE_SIZE=$(du -h "$AUDIT_LOG" | awk '{print $1}')
echo -e "Tamaño: ${GREEN}$FILE_SIZE${NC}"

OLDEST=$(jq -r '.[0].timestamp' "$AUDIT_LOG")
NEWEST=$(jq -r '.[-1].timestamp' "$AUDIT_LOG")
echo -e "Primera entrada: ${GREEN}$OLDEST${NC}"
echo -e "Última entrada:  ${GREEN}$NEWEST${NC}"

# 10. INSTRUCCIONES PARA DETECTAR CARRERAS ELIMINADAS
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  📋 CÓMO DETECTAR CARRERAS ELIMINADAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. Exporta la columna ID de tu Google Sheet actual"
echo "2. Compara con los IDs que aparecen como CREADOS en este audit log"
echo "3. Los IDs que están en el audit log pero NO en el Sheet fueron eliminados"
echo ""
echo "Comandos útiles:"
echo ""
echo "• Ver historial de una carrera específica:"
echo "  cat $AUDIT_LOG | jq '.[] | select(.orderId == \"4866\")'"
echo ""
echo "• Exportar solo los IDs creados:"
echo "  cat $AUDIT_LOG | jq -r '.[] | select(.action == \"CREAR\") | .orderId' | sort -n"
echo ""
echo "• Ver cambios de una carrera específica:"
echo "  cat $AUDIT_LOG | jq '.[] | select(.orderId == \"4866\" and .action == \"EDITAR\") | .changes'"
echo ""
echo "• Ver carreras creadas hoy:"
echo "  cat $AUDIT_LOG | jq '.[] | select(.action == \"CREAR\" and (.timestamp | startswith(\"$(date +%Y-%m-%d)\")))'"
echo ""
echo -e "${GREEN}✅ Análisis completado${NC}"
echo ""
