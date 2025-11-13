#!/bin/bash
set -e

echo "========================================"
echo "Arreglando CORS para Dominio"
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
echo -e "${YELLOW}Problema:${NC}"
echo "El frontend está en: http://rendicionesapp.axiomacloud.com"
echo "Pero el backend solo permite CORS desde IP"
echo ""
echo -e "${YELLOW}Solución:${NC}"
echo "1. Pull cambios del repositorio (código CORS actualizado)"
echo "2. Actualizar .env.local con dominio"
echo "3. Recompilar frontend"
echo "4. Reiniciar backend"
echo ""

read -p "¿Continuar? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${YELLOW}1. Deteniendo servicios...${NC}"
pm2 stop all

echo ""
echo -e "${YELLOW}2. Haciendo pull de cambios...${NC}"
git stash || true
git pull origin master

if [ $? -ne 0 ]; then
    echo -e "${RED}Error al hacer git pull${NC}"
    echo "Si hay conflictos, resuélvelos y vuelve a ejecutar este script"
    exit 1
fi

echo ""
echo -e "${YELLOW}3. Actualizando packages/web/.env.local...${NC}"
cat > packages/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://149.50.148.198:5050
EOF

echo "Contenido:"
cat packages/web/.env.local

echo ""
echo -e "${YELLOW}4. Limpiando y recompilando frontend...${NC}"
rm -rf packages/web/.next
npm run build:web

if [ $? -ne 0 ]; then
    echo -e "${RED}Error al compilar frontend${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}5. Reiniciando servicios...${NC}"
pm2 restart all

echo ""
echo -e "${YELLOW}6. Esperando 5 segundos...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}7. Verificando servicios...${NC}"
pm2 status

echo ""
echo -e "${GREEN}========================================"
echo -e "✓ CORS configurado"
echo -e "========================================${NC}"
echo ""
echo "Orígenes permitidos:"
echo "  ✓ http://rendicionesapp.axiomacloud.com"
echo "  ✓ https://rendicionesapp.axiomacloud.com"
echo "  ✓ http://149.50.148.198:8084"
echo ""
echo "API:"
echo "  http://149.50.148.198:5050/api"
echo ""
echo "Accede a:"
echo "  http://rendicionesapp.axiomacloud.com"
echo ""
echo "Ver logs:"
echo "  pm2 logs rendiciones-backend --lines 30"
echo ""
