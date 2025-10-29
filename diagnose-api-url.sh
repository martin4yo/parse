#!/bin/bash

echo "========================================"
echo "Diagnóstico de URL de API"
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

# Obtener IP del servidor
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${YELLOW}1. Configuración actual de .env.local:${NC}"
if [ -f "packages/web/.env.local" ]; then
    cat packages/web/.env.local
else
    echo -e "${RED}✗ No existe packages/web/.env.local${NC}"
fi

echo ""
echo -e "${YELLOW}2. Buscando NEXT_PUBLIC_API_URL compilado en el build:${NC}"
if [ -d "packages/web/.next" ]; then
    echo "Buscando en archivos compilados..."
    grep -r "localhost:5050" packages/web/.next 2>/dev/null | head -n 3

    if [ $? -eq 0 ]; then
        echo -e "${RED}✗ PROBLEMA: El frontend tiene 'localhost:5050' hardcoded${NC}"
        echo -e "${YELLOW}  Esto significa que se compiló con la configuración incorrecta${NC}"
    else
        echo -e "${GREEN}✓ No se encontró 'localhost:5050' en el build${NC}"
    fi

    echo ""
    echo "Buscando IP del servidor en archivos compilados..."
    grep -r "$SERVER_IP:5050" packages/web/.next 2>/dev/null | head -n 3

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ El frontend tiene la IP correcta compilada${NC}"
    else
        echo -e "${RED}✗ No se encontró la IP del servidor en el build${NC}"
    fi
else
    echo -e "${RED}✗ No existe packages/web/.next (frontend no compilado)${NC}"
fi

echo ""
echo -e "${YELLOW}3. Variables de entorno en tiempo de build:${NC}"
echo "Para que NEXT_PUBLIC_API_URL funcione, debe estar en .env.local ANTES de compilar"

echo ""
echo "========================================"
echo "Diagnóstico"
echo "========================================"
echo ""

# Verificar el problema
if [ -f "packages/web/.env.local" ]; then
    CURRENT_API_URL=$(cat packages/web/.env.local | grep NEXT_PUBLIC_API_URL | cut -d '=' -f2)
    echo "API URL configurada: $CURRENT_API_URL"

    if [[ "$CURRENT_API_URL" == *"localhost"* ]]; then
        echo -e "${RED}❌ PROBLEMA: .env.local tiene 'localhost'${NC}"
        echo -e "${YELLOW}Solución:${NC}"
        echo "  echo 'NEXT_PUBLIC_API_URL=http://$SERVER_IP:5050' > packages/web/.env.local"
        echo "  npm run build:web"
        echo "  pm2 restart rendiciones-frontend"
    elif [[ "$CURRENT_API_URL" == *"$SERVER_IP"* ]]; then
        echo -e "${GREEN}✓ .env.local tiene la IP correcta${NC}"
        echo ""
        echo -e "${YELLOW}Pero el frontend sigue intentando conectarse a localhost.${NC}"
        echo -e "${YELLOW}Esto significa que necesitas RECOMPILAR:${NC}"
        echo ""
        echo "  cd $APP_DIR"
        echo "  rm -rf packages/web/.next"
        echo "  npm run build:web"
        echo "  pm2 restart rendiciones-frontend"
    fi
else
    echo -e "${RED}❌ No existe .env.local${NC}"
    echo -e "${YELLOW}Crear archivo:${NC}"
    echo "  echo 'NEXT_PUBLIC_API_URL=http://$SERVER_IP:5050' > packages/web/.env.local"
    echo "  npm run build:web"
    echo "  pm2 restart rendiciones-frontend"
fi

echo ""
echo -e "${YELLOW}Sobre ERR_BLOCKED_BY_CLIENT:${NC}"
echo "Este error también puede ser causado por:"
echo "  - Extensiones de navegador (AdBlock, uBlock Origin, Privacy Badger)"
echo "  - Software antivirus/firewall"
echo "  - Configuración del navegador"
echo ""
echo "Pero primero arregla la URL de la API."
echo ""
