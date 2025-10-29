#!/bin/bash
set -e

echo "========================================"
echo "Instalación Rendiciones App - Ubuntu 22.04"
echo "========================================"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuración
REPO_URL="https://github.com/martin4yo/Rendiciones.git"
APP_DIR="/opt/rendiciones"
SERVER_IP="66.97.45.210"
FRONTEND_PORT="8084"
BACKEND_PORT="5050"
DB_NAME="rendiciones_db"
DB_USER="postgres"
DB_PASSWORD="Q27G4B98"

echo -e "${YELLOW}1/10 Actualizando sistema...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

echo -e "${YELLOW}2/10 Instalando dependencias del sistema...${NC}"
sudo apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    pkg-config \
    libssl-dev \
    nginx \
    certbot \
    python3-certbot-nginx

echo -e "${YELLOW}3/10 Instalando Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versión
echo -e "${GREEN}Node.js versión: $(node -v)${NC}"
echo -e "${GREEN}NPM versión: $(npm -v)${NC}"

# Actualizar npm
echo -e "${YELLOW}Actualizando npm...${NC}"
sudo npm install -g npm@latest

echo -e "${YELLOW}4/10 Instalando PostgreSQL...${NC}"
sudo apt-get install -y postgresql postgresql-contrib

# Configurar PostgreSQL
echo -e "${YELLOW}5/10 Configurando base de datos...${NC}"
sudo -u postgres psql <<EOF
ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

echo -e "${GREEN}Base de datos configurada: $DB_NAME${NC}"

echo -e "${YELLOW}6/10 Clonando repositorio...${NC}"
if [ -d "$APP_DIR" ]; then
    echo -e "${RED}Directorio $APP_DIR ya existe. Eliminando...${NC}"
    sudo rm -rf $APP_DIR
fi

sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR

echo -e "${YELLOW}7/10 Configurando variables de entorno...${NC}"

# Backend .env
cat > $APP_DIR/backend/.env <<EOF
# Database
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# Server
PORT=$BACKEND_PORT
NODE_ENV=production

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# CORS
CORS_ORIGIN=http://$SERVER_IP:$FRONTEND_PORT

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

# Frontend .env
cat > $APP_DIR/packages/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:$BACKEND_PORT
EOF

echo -e "${GREEN}Archivos .env creados${NC}"

echo -e "${YELLOW}8/10 Instalando dependencias...${NC}"
# Limpiar instalaciones previas si existen
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf packages/web/node_modules packages/web/package-lock.json packages/web/.next
rm -rf packages/shared/node_modules packages/shared/package-lock.json
rm -rf packages/mobile/node_modules packages/mobile/package-lock.json

# Instalar solo dependencias de desarrollo en raíz
echo -e "${YELLOW}Instalando dependencias de desarrollo en raíz...${NC}"
npm install --only=dev

# Instalar dependencias de workspaces
echo -e "${YELLOW}Instalando dependencias de workspaces...${NC}"
npm install --workspaces --legacy-peer-deps

# Verificar que no haya React en raíz
if [ -d "$APP_DIR/node_modules/react" ]; then
    echo -e "${RED}Advertencia: React encontrado en raíz. Eliminando...${NC}"
    rm -rf $APP_DIR/node_modules/react $APP_DIR/node_modules/react-dom
fi

echo -e "${YELLOW}9/10 Configurando Prisma y base de datos...${NC}"
cd $APP_DIR/backend

# Generar cliente Prisma
npx prisma generate

# Aplicar schema a la base de datos
npx prisma db push --accept-data-loss

# Ejecutar seed si existe
if [ -f "prisma/seed.js" ]; then
    echo -e "${YELLOW}Ejecutando seed de base de datos...${NC}"
    npm run db:seed-default || echo -e "${YELLOW}Seed falló o no existe${NC}"
fi

echo -e "${YELLOW}10/10 Compilando aplicación...${NC}"
cd $APP_DIR
npm run build:web

# Instalar PM2 globalmente
echo -e "${YELLOW}Instalando PM2...${NC}"
sudo npm install -g pm2

# Crear ecosystem.config.js
cat > $APP_DIR/ecosystem.config.js <<'EOFPM2'
module.exports = {
  apps: [
    {
      name: 'rendiciones-backend',
      cwd: './backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5050
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    },
    {
      name: 'rendiciones-frontend',
      cwd: './packages/web',
      script: 'node_modules/.bin/next',
      args: 'start -p $FRONTEND_PORT',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
};
EOFPM2

# Crear directorio de logs
mkdir -p $APP_DIR/logs

# Iniciar con PM2
cd $APP_DIR
pm2 start ecosystem.config.js

# Guardar configuración PM2
pm2 save

# Configurar inicio automático
pm2 startup systemd -u $USER --hp /home/$USER

echo -e "${GREEN}========================================"
echo -e "✓ Instalación completada"
echo -e "========================================${NC}"

echo ""
echo -e "${YELLOW}Servicios iniciados con PM2:${NC}"
pm2 status
echo ""
echo -e "${YELLOW}URLs:${NC}"
echo "  Backend:  http://$SERVER_IP:$BACKEND_PORT"
echo "  Frontend: http://$SERVER_IP:$FRONTEND_PORT"
echo ""
echo -e "${YELLOW}Comandos útiles:${NC}"
echo "  pm2 status          - Ver estado"
echo "  pm2 logs            - Ver logs"
echo "  pm2 restart all     - Reiniciar todo"
echo "  pm2 stop all        - Detener todo"
echo "  pm2 monit           - Monitor"
echo ""
