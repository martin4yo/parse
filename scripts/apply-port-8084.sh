#!/bin/bash
set -e

echo "========================================"
echo "Cambiando Puerto Frontend a 8084"
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

# Obtener IP del servidor
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "IP detectada del servidor: $SERVER_IP"

echo ""
echo -e "${YELLOW}1. Deteniendo servicios...${NC}"
pm2 stop all

echo ""
echo -e "${YELLOW}2. Actualizando ecosystem.config.js...${NC}"
sed -i "s/'start -p 8080'/'start -p 8084'/g" ecosystem.config.js
sed -i 's/"start -p 8080"/"start -p 8084"/g' ecosystem.config.js
sed -i 's/start -p 8080/start -p 8084/g' ecosystem.config.js

echo ""
echo -e "${YELLOW}3. Actualizando backend/.env (CORS)...${NC}"
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://$SERVER_IP:8084|g" backend/.env

echo ""
echo -e "${YELLOW}4. Actualizando packages/web/.env.local...${NC}"
echo "NEXT_PUBLIC_API_URL=http://$SERVER_IP:5050" > packages/web/.env.local

echo ""
echo -e "${YELLOW}5. Recompilando frontend...${NC}"
npm run build:web

echo ""
echo -e "${YELLOW}6. Reiniciando servicios con nueva configuración...${NC}"
pm2 delete all || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo -e "${YELLOW}7. Esperando 5 segundos...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}8. Verificando servicios...${NC}"
pm2 status

echo ""
echo -e "${YELLOW}9. Verificando puertos...${NC}"

# Backend
if curl -s http://localhost:5050/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend: OK (puerto 5050)${NC}"
else
    echo -e "${RED}✗ Backend: FALLO${NC}"
    pm2 logs rendiciones-backend --lines 20 --nostream
fi

# Frontend
if curl -s http://localhost:8084 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend: OK (puerto 8084)${NC}"
else
    echo -e "${RED}✗ Frontend: FALLO${NC}"
    pm2 logs rendiciones-frontend --lines 20 --nostream
fi

echo ""
echo -e "${GREEN}========================================"
echo -e "✓ Puerto cambiado a 8084"
echo -e "========================================${NC}"
echo ""
echo "Accede a la aplicación en:"
echo "  http://$SERVER_IP:8084"
echo ""
echo "Ver logs:"
echo "  pm2 logs"
echo ""
