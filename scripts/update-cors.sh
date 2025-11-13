#!/bin/bash
set -e

echo "========================================"
echo "Actualizar CORS con Nuevos Dominios"
echo "========================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/opt/rendiciones"
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Error: $APP_DIR no existe${NC}"
    exit 1
fi

cd $APP_DIR

echo ""
echo -e "${YELLOW}Dominios que se agregarán a CORS:${NC}"
echo "  ✓ http://rendicionesapp.axiomacloud.com"
echo "  ✓ https://rendicionesapp.axiomacloud.com"
echo "  ✓ http://rendicionesdemo.axiomacloud.com"
echo "  ✓ https://rendicionesdemo.axiomacloud.com"
echo "  ✓ http://149.50.148.198:8084"
echo ""

read -p "¿Continuar? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${YELLOW}1. Verificando git status...${NC}"
git status --short

echo ""
echo -e "${YELLOW}2. Guardando cambios locales si existen...${NC}"
git stash || true

echo ""
echo -e "${YELLOW}3. Haciendo pull de cambios...${NC}"
git pull origin master

if [ $? -ne 0 ]; then
    echo -e "${RED}Error al hacer git pull${NC}"
    echo "Resuelve conflictos manualmente y vuelve a ejecutar"
    exit 1
fi

echo ""
echo -e "${YELLOW}4. Verificando configuración de CORS...${NC}"
echo "Buscando dominios en backend/src/index.js:"
grep -n "rendicionesapp.axiomacloud.com\|rendicionesdemo.axiomacloud.com" backend/src/index.js || {
    echo -e "${RED}No se encontraron los dominios en el código${NC}"
    echo "Verifica que el pull se haya realizado correctamente"
    exit 1
}

echo ""
echo -e "${YELLOW}5. Reiniciando backend...${NC}"
pm2 restart rendiciones-backend

echo ""
echo -e "${YELLOW}6. Esperando 3 segundos...${NC}"
sleep 3

echo ""
echo -e "${YELLOW}7. Verificando backend...${NC}"
pm2 status | grep rendiciones-backend

echo ""
echo -e "${YELLOW}8. Verificando logs del backend...${NC}"
pm2 logs rendiciones-backend --lines 10 --nostream

echo ""
echo -e "${GREEN}========================================"
echo -e "✓ CORS actualizado"
echo -e "========================================${NC}"
echo ""
echo "Dominios permitidos:"
echo "  ✓ http://rendicionesapp.axiomacloud.com"
echo "  ✓ https://rendicionesapp.axiomacloud.com"
echo "  ✓ http://rendicionesdemo.axiomacloud.com"
echo "  ✓ https://rendicionesdemo.axiomacloud.com"
echo "  ✓ http://149.50.148.198:8084"
echo ""
echo "Puedes acceder desde cualquiera de estos dominios."
echo ""
echo "Ver logs completos:"
echo "  pm2 logs rendiciones-backend"
echo ""
