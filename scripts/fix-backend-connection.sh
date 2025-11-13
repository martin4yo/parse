#!/bin/bash
set -e

echo "========================================"
echo "Arreglando Conexión Backend-Frontend"
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
echo -e "${YELLOW}1. Verificando PM2...${NC}"
pm2 status

echo ""
echo -e "${YELLOW}2. Corrigiendo variables de entorno...${NC}"

# Backend .env
echo "Actualizando backend/.env..."
cat > backend/.env <<EOF
# Database
DATABASE_URL="postgresql://postgres:Q27G4B98@localhost:5432/rendiciones_db?schema=public"

# Server
PORT=5050
NODE_ENV=production

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-secret-key")
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-session-key")

# CORS
CORS_ORIGIN=http://$SERVER_IP:8084

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

# Frontend .env.local
echo "Actualizando packages/web/.env.local..."
cat > packages/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5050
EOF

echo -e "${GREEN}✓ Variables de entorno actualizadas${NC}"

echo ""
echo -e "${YELLOW}3. Verificando ecosystem.config.js...${NC}"
if ! grep -q "PORT: 5050" ecosystem.config.js; then
    echo -e "${RED}Advertencia: ecosystem.config.js podría tener puerto incorrecto${NC}"
    echo "Puerto actual del backend:"
    grep -A 3 "rendiciones-backend" ecosystem.config.js | grep "PORT"
fi

echo ""
echo -e "${YELLOW}4. Recompilando frontend...${NC}"
npm run build:web

echo ""
echo -e "${YELLOW}5. Reiniciando servicios...${NC}"
pm2 restart all

echo ""
echo -e "${YELLOW}6. Esperando 3 segundos...${NC}"
sleep 3

echo ""
echo -e "${YELLOW}7. Verificando conexiones...${NC}"

# Verificar puerto 5050
if curl -s http://localhost:5050/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend respondiendo en puerto 5050${NC}"
else
    echo -e "${RED}✗ Backend NO responde en puerto 5050${NC}"
    echo "Logs del backend:"
    pm2 logs rendiciones-backend --lines 10 --nostream
fi

# Verificar puerto 8084
if curl -s http://localhost:8084 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend respondiendo en puerto 8084${NC}"
else
    echo -e "${RED}✗ Frontend NO responde en puerto 8084${NC}"
    echo "Logs del frontend:"
    pm2 logs rendiciones-frontend --lines 10 --nostream
fi

echo ""
echo -e "${GREEN}========================================"
echo -e "Configuración aplicada"
echo -e "========================================${NC}"
echo ""
echo "URLs:"
echo "  Frontend: http://$SERVER_IP:8084"
echo "  Backend:  http://$SERVER_IP:5050"
echo ""
echo "Comandos útiles:"
echo "  pm2 status"
echo "  pm2 logs"
echo ""
