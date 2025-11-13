#!/bin/bash

echo "========================================"
echo "Diagnóstico de versiones de React"
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
echo -e "${YELLOW}Buscando instalaciones de React...${NC}"
echo ""

# Verificar raíz
if [ -f "node_modules/react/package.json" ]; then
    ROOT_VERSION=$(node -p "require('./node_modules/react/package.json').version" 2>/dev/null)
    echo -e "${RED}❌ React encontrado en RAÍZ: v$ROOT_VERSION${NC}"
    echo "   Ubicación: $APP_DIR/node_modules/react"
    echo -e "   ${RED}ESTO ES UN PROBLEMA - debe ser eliminado${NC}"
else
    echo -e "${GREEN}✓ No hay React en node_modules raíz${NC}"
fi

echo ""

# Verificar packages/web
if [ -f "packages/web/node_modules/react/package.json" ]; then
    WEB_VERSION=$(node -p "require('./packages/web/node_modules/react/package.json').version" 2>/dev/null)
    echo -e "${GREEN}✓ React en packages/web: v$WEB_VERSION${NC}"
    echo "   Ubicación: $APP_DIR/packages/web/node_modules/react"
else
    echo -e "${RED}❌ No hay React en packages/web${NC}"
    echo -e "   ${RED}ESTO ES UN PROBLEMA - debe instalarse${NC}"
fi

echo ""

# Verificar backend
if [ -f "backend/node_modules/react/package.json" ]; then
    BACKEND_VERSION=$(node -p "require('./backend/node_modules/react/package.json').version" 2>/dev/null)
    echo -e "${YELLOW}⚠ React encontrado en backend: v$BACKEND_VERSION${NC}"
    echo "   Ubicación: $APP_DIR/backend/node_modules/react"
    echo "   (No debería ser necesario, pero no causa problemas)"
fi

echo ""
echo "========================================"
echo "Resumen"
echo "========================================"
echo ""

if [ -f "node_modules/react/package.json" ]; then
    echo -e "${RED}PROBLEMA DETECTADO:${NC}"
    echo "  React está instalado en el node_modules raíz"
    echo ""
    echo -e "${YELLOW}Solución:${NC}"
    echo "  chmod +x clean-react-conflict.sh"
    echo "  ./clean-react-conflict.sh"
elif [ ! -f "packages/web/node_modules/react/package.json" ]; then
    echo -e "${RED}PROBLEMA DETECTADO:${NC}"
    echo "  React NO está instalado en packages/web"
    echo ""
    echo -e "${YELLOW}Solución:${NC}"
    echo "  cd packages/web"
    echo "  npm install"
else
    echo -e "${GREEN}✓ Configuración correcta${NC}"
    echo "  Solo hay una copia de React en packages/web"
fi

echo ""
