#!/bin/bash
set -e

echo "========================================"
echo "Solución Rápida - Rendiciones App"
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
echo -e "${YELLOW}Este script va a:${NC}"
echo "  1. Detener PM2"
echo "  2. Limpiar todo node_modules"
echo "  3. Reinstalar dependencias correctamente"
echo "  4. Regenerar Prisma"
echo "  5. Compilar frontend"
echo "  6. Reiniciar PM2"
echo ""
read -p "¿Continuar? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${YELLOW}[1/7] Deteniendo PM2...${NC}"
pm2 stop all || true

echo -e "${YELLOW}[2/7] Limpiando node_modules...${NC}"
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf packages/web/node_modules packages/web/package-lock.json packages/web/.next
rm -rf packages/shared/node_modules packages/shared/package-lock.json

echo -e "${YELLOW}[3/7] Instalando dependencias de desarrollo en raíz...${NC}"
npm install --only=dev

echo -e "${YELLOW}[4/7] Instalando dependencias de workspaces...${NC}"
npm install --workspaces --legacy-peer-deps

echo -e "${YELLOW}[5/7] Verificando React...${NC}"
if [ -d "node_modules/react" ]; then
    echo -e "${RED}Eliminando React de node_modules raíz...${NC}"
    rm -rf node_modules/react node_modules/react-dom
fi

if [ -f "packages/web/node_modules/react/package.json" ]; then
    WEB_VERSION=$(node -p "require('./packages/web/node_modules/react/package.json').version")
    echo -e "${GREEN}✓ React en packages/web: v$WEB_VERSION${NC}"
else
    echo -e "${RED}✗ React no encontrado en packages/web${NC}"
    exit 1
fi

echo -e "${YELLOW}[6/7] Regenerando Prisma y compilando...${NC}"
cd backend
npx prisma generate
cd ..
npm run build:web

echo -e "${YELLOW}[7/7] Reiniciando PM2...${NC}"
pm2 restart all

echo ""
echo -e "${GREEN}========================================"
echo -e "✓ Completado exitosamente"
echo -e "========================================${NC}"
echo ""
echo -e "${YELLOW}Verificar logs:${NC}"
echo "  pm2 logs --lines 50"
echo ""
echo -e "${YELLOW}URLs:${NC}"
echo "  Frontend: http://66.97.45.210:8084"
echo "  Backend:  http://66.97.45.210:5050"
echo ""
