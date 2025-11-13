#!/bin/bash
set -e

echo "========================================"
echo "Limpiando conflictos de React"
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

echo -e "${YELLOW}Deteniendo PM2...${NC}"
pm2 stop all || true

echo -e "${YELLOW}Eliminando node_modules conflictivos...${NC}"
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf packages/web/node_modules packages/web/package-lock.json packages/web/.next
rm -rf packages/shared/node_modules packages/shared/package-lock.json

echo -e "${YELLOW}Instalando solo dependencias de desarrollo en raíz...${NC}"
npm install --only=dev

echo -e "${YELLOW}Instalando dependencias de workspaces...${NC}"
npm install --workspaces --legacy-peer-deps

echo -e "${YELLOW}Verificando que no haya React en raíz...${NC}"
if [ -d "node_modules/react" ]; then
    echo -e "${RED}¡Advertencia! React encontrado en node_modules raíz. Eliminando...${NC}"
    rm -rf node_modules/react node_modules/react-dom
fi

echo -e "${YELLOW}Regenerando Prisma...${NC}"
cd backend
npx prisma generate
cd ..

echo -e "${YELLOW}Compilando frontend...${NC}"
npm run build:web

echo -e "${GREEN}========================================"
echo -e "✓ Conflictos resueltos"
echo -e "========================================${NC}"

echo ""
echo -e "${YELLOW}Reiniciar aplicación:${NC}"
echo "  pm2 restart all"
echo ""
