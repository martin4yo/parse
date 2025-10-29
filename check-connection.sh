#!/bin/bash

echo "========================================"
echo "Diagnóstico de Conexión Backend-Frontend"
echo "========================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/opt/rendiciones"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="$(pwd)"
fi

cd $APP_DIR

echo ""
echo -e "${YELLOW}1. Estado de PM2:${NC}"
pm2 status

echo ""
echo -e "${YELLOW}2. Configuración del frontend (.env.local):${NC}"
if [ -f "packages/web/.env.local" ]; then
    cat packages/web/.env.local
else
    echo -e "${RED}No existe packages/web/.env.local${NC}"
fi

echo ""
echo -e "${YELLOW}3. Puerto del backend (ecosystem.config.js):${NC}"
if [ -f "ecosystem.config.js" ]; then
    grep -A 5 "PORT" ecosystem.config.js | head -n 6
else
    echo -e "${RED}No existe ecosystem.config.js${NC}"
fi

echo ""
echo -e "${YELLOW}4. Verificando puerto 5050:${NC}"
if lsof -Pi :5050 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Puerto 5050 está en uso (backend corriendo)${NC}"
    lsof -Pi :5050 -sTCP:LISTEN
else
    echo -e "${RED}✗ Puerto 5050 NO está en uso (backend NO corriendo)${NC}"
fi

echo ""
echo -e "${YELLOW}5. Verificando puerto 8084:${NC}"
if lsof -Pi :8084 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Puerto 8084 está en uso (frontend corriendo)${NC}"
    lsof -Pi :8084 -sTCP:LISTEN
else
    echo -e "${RED}✗ Puerto 8084 NO está en uso (frontend NO corriendo)${NC}"
fi

echo ""
echo "========================================"
echo "Resumen"
echo "========================================"
echo ""

# Obtener la IP del servidor
SERVER_IP=$(hostname -I | awk '{print $1}')

echo "IP del servidor: $SERVER_IP"
echo ""

# Leer configuración
if [ -f "packages/web/.env.local" ]; then
    FRONTEND_API_URL=$(cat packages/web/.env.local | grep NEXT_PUBLIC_API_URL | cut -d '=' -f2)
    echo "Frontend configurado para: $FRONTEND_API_URL"
fi

if [ -f "ecosystem.config.js" ]; then
    BACKEND_PORT=$(grep -A 5 "rendiciones-backend" ecosystem.config.js | grep "PORT" | grep -o '[0-9]*')
    echo "Backend configurado para puerto: $BACKEND_PORT"
fi

echo ""
