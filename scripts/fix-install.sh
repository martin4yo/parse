#!/bin/bash
set -e

echo "========================================"
echo "Script de Recuperación - Rendiciones App"
echo "========================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/opt/rendiciones"
SERVER_IP="66.97.45.210"

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Error: $APP_DIR no existe. Ejecuta install-ubuntu.sh primero${NC}"
    exit 1
fi

cd $APP_DIR

echo -e "${YELLOW}1/6 Limpiando instalaciones previas...${NC}"
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf packages/web/node_modules packages/web/package-lock.json packages/web/.next
rm -rf packages/shared/node_modules packages/shared/package-lock.json
rm -rf packages/mobile/node_modules packages/mobile/package-lock.json

echo -e "${YELLOW}2/6 Actualizando npm...${NC}"
sudo npm install -g npm@latest

echo -e "${YELLOW}3/6 Reinstalando solo dependencias de desarrollo en raíz...${NC}"
npm install --only=dev

echo -e "${YELLOW}4/6 Reinstalando dependencias de workspaces...${NC}"
npm install --workspaces --legacy-peer-deps

echo -e "${YELLOW}Verificando que no haya React en raíz...${NC}"
if [ -d "node_modules/react" ]; then
    echo -e "${RED}¡Advertencia! React encontrado en node_modules raíz. Eliminando...${NC}"
    rm -rf node_modules/react node_modules/react-dom
fi

echo -e "${YELLOW}5/6 Configurando Prisma...${NC}"
cd $APP_DIR/backend
npx prisma generate
npx prisma db push --accept-data-loss

echo -e "${YELLOW}6/6 Compilando aplicación...${NC}"
cd $APP_DIR
npm run build:web

echo -e "${GREEN}========================================"
echo -e "✓ Recuperación completada"
echo -e "========================================${NC}"

echo ""
echo -e "${YELLOW}Iniciar aplicación:${NC}"
echo "  cd $APP_DIR"
echo "  pm2 start ecosystem.config.js"
echo ""
