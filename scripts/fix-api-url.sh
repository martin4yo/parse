#!/bin/bash
set -e

echo "========================================"
echo "Arreglando URL de API en Frontend"
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
echo -e "${YELLOW}Problema Detectado:${NC}"
echo "El frontend intenta llamar a: http://$SERVER_IP:8084/api/..."
echo "Pero la API está en:          http://$SERVER_IP:5050/api/..."
echo ""
echo -e "${YELLOW}Solución:${NC}"
echo "Configurar NEXT_PUBLIC_API_URL y recompilar el frontend"
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
echo -e "${YELLOW}2. Verificando .env.local actual...${NC}"
if [ -f "packages/web/.env.local" ]; then
    echo "Contenido actual:"
    cat packages/web/.env.local
else
    echo -e "${RED}No existe packages/web/.env.local${NC}"
fi

echo ""
echo -e "${YELLOW}3. Actualizando packages/web/.env.local...${NC}"
cat > packages/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5050
EOF

echo -e "${GREEN}✓ Nuevo contenido:${NC}"
cat packages/web/.env.local

echo ""
echo -e "${YELLOW}4. Actualizando backend/.env (CORS)...${NC}"
if [ -f "backend/.env" ]; then
    # Actualizar CORS_ORIGIN
    if grep -q "CORS_ORIGIN=" backend/.env; then
        sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://$SERVER_IP:8084|g" backend/.env
        echo -e "${GREEN}✓ CORS actualizado${NC}"
    else
        echo "CORS_ORIGIN=http://$SERVER_IP:8084" >> backend/.env
        echo -e "${GREEN}✓ CORS agregado${NC}"
    fi
else
    echo -e "${RED}No existe backend/.env${NC}"
fi

echo ""
echo -e "${YELLOW}5. Limpiando compilación anterior...${NC}"
rm -rf packages/web/.next

echo ""
echo -e "${YELLOW}6. Recompilando frontend (esto tomará un momento)...${NC}"
npm run build:web

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Error al compilar el frontend${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend compilado${NC}"

echo ""
echo -e "${YELLOW}7. Reiniciando servicios...${NC}"
pm2 restart all

echo ""
echo -e "${YELLOW}8. Esperando 5 segundos...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}9. Verificando servicios...${NC}"
pm2 status

echo ""
echo -e "${YELLOW}10. Probando conexiones...${NC}"

# Verificar backend
if curl -s http://localhost:5050/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend: OK en puerto 5050${NC}"
else
    if curl -s http://localhost:5050 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Backend responde en puerto 5050 pero /api/health no existe${NC}"
    else
        echo -e "${RED}✗ Backend NO responde en puerto 5050${NC}"
    fi
fi

# Verificar frontend
if curl -s http://localhost:8084 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend: OK en puerto 8084${NC}"
else
    echo -e "${RED}✗ Frontend NO responde en puerto 8084${NC}"
fi

echo ""
echo -e "${GREEN}========================================"
echo -e "✓ Configuración aplicada"
echo -e "========================================${NC}"
echo ""
echo "Configuración:"
echo "  Frontend en:  http://$SERVER_IP:8084"
echo "  API en:       http://$SERVER_IP:5050/api"
echo ""
echo "El frontend ahora hará peticiones a:"
echo "  http://$SERVER_IP:5050/api/auth/login  ✓"
echo "  http://$SERVER_IP:5050/api/...         ✓"
echo ""
echo "Accede a la aplicación:"
echo "  http://$SERVER_IP:8084"
echo ""
echo "Ver logs:"
echo "  pm2 logs"
echo ""
