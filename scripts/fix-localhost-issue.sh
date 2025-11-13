#!/bin/bash
set -e

echo "========================================"
echo "Arreglar Frontend que apunta a localhost"
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

echo ""
echo -e "${YELLOW}Problema detectado:${NC}"
echo "El frontend intenta conectarse a: http://localhost:5050"
echo "Debería conectarse a:            http://$SERVER_IP:5050"
echo ""

read -p "¿Arreglar este problema? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${YELLOW}1. Deteniendo frontend...${NC}"
pm2 stop rendiciones-frontend

echo ""
echo -e "${YELLOW}2. Verificando .env.local actual...${NC}"
if [ -f "packages/web/.env.local" ]; then
    echo "Contenido actual:"
    cat packages/web/.env.local
else
    echo "No existe .env.local"
fi

echo ""
echo -e "${YELLOW}3. Creando .env.local correcto...${NC}"
cat > packages/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5050
EOF

echo "Nuevo contenido:"
cat packages/web/.env.local

echo ""
echo -e "${YELLOW}4. Eliminando build anterior...${NC}"
rm -rf packages/web/.next

echo ""
echo -e "${YELLOW}5. Compilando frontend con configuración correcta...${NC}"
echo "Esto tomará 1-2 minutos..."
npm run build:web

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Error al compilar${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}6. Verificando que se compiló correctamente...${NC}"
if grep -r "localhost:5050" packages/web/.next >/dev/null 2>&1; then
    echo -e "${RED}✗ ADVERTENCIA: Todavía hay referencias a localhost:5050${NC}"
    echo "El problema podría estar en otro lugar del código"
else
    echo -e "${GREEN}✓ No hay referencias a localhost:5050${NC}"
fi

if grep -r "$SERVER_IP:5050" packages/web/.next >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Se encontró la IP correcta ($SERVER_IP:5050) en el build${NC}"
else
    echo -e "${YELLOW}⚠ No se encontró la IP en el build${NC}"
fi

echo ""
echo -e "${YELLOW}7. Reiniciando frontend...${NC}"
pm2 restart rendiciones-frontend

echo ""
echo -e "${YELLOW}8. Esperando 5 segundos...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}9. Verificando que el frontend responde...${NC}"
if curl -s http://localhost:8084 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend respondiendo en puerto 8084${NC}"
else
    echo -e "${RED}✗ Frontend NO responde${NC}"
    echo "Ver logs:"
    pm2 logs rendiciones-frontend --lines 20 --nostream
    exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo -e "✓ Configuración aplicada"
echo -e "========================================${NC}"
echo ""
echo "El frontend ahora debería conectarse a:"
echo "  http://$SERVER_IP:5050/api/..."
echo ""
echo "Accede a:"
echo "  http://rendicionesapp.axiomacloud.com"
echo "  o"
echo "  http://$SERVER_IP:8084"
echo ""
echo "Si aún ves el error ERR_BLOCKED_BY_CLIENT:"
echo "  1. Limpia caché del navegador (Ctrl+Shift+Del)"
echo "  2. Abre en modo incógnito"
echo "  3. Desactiva extensiones (AdBlock, etc)"
echo "  4. Prueba con otro navegador"
echo ""
echo "Ver logs:"
echo "  pm2 logs"
echo ""
