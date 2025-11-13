#!/bin/bash

###############################################################################
# Script para Regenerar Prisma Client con Variables de Entorno
# Soluciona: "Environment variable not found: DATABASE_URL"
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   REGENERAR PRISMA CLIENT CON VARIABLES DE ENTORNO           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd /var/www/parse/backend

# 1. Verificar que .env existe
if [ ! -f ".env" ]; then
    log_error ".env no existe en $(pwd)"
    exit 1
fi

log_success ".env encontrado"

# 2. Cargar variables del .env
export $(grep -v '^#' .env | xargs)

log_success "Variables cargadas desde .env"

# 3. Verificar DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL no está definida en .env"
    exit 1
fi

log_success "DATABASE_URL encontrada: ${DATABASE_URL:0:30}..."

# 4. Limpiar Prisma Client anterior
log_info "Limpiando Prisma Client anterior..."
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client

# 5. Regenerar Prisma Client CON la variable de entorno
log_info "Regenerando Prisma Client..."
npx prisma generate

log_success "Prisma Client regenerado con DATABASE_URL"

# 6. Opcional: Verificar conexión a base de datos
log_info "Verificando conexión a base de datos..."
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    log_success "Conexión a base de datos exitosa"
else
    log_error "No se pudo conectar a la base de datos"
    log_info "Verifica tus credenciales en .env"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              PRISMA CLIENT REGENERADO                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

log_success "Ahora puedes reiniciar PM2:"
echo ""
echo "  cd /var/www/parse"
echo "  pm2 restart parse-backend"
echo "  pm2 logs parse-backend"
echo ""
