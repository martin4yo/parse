#!/bin/bash

###############################################################################
# Script para Verificar y Corregir JWT_SECRET en .env
# Soluciona: "secretOrPrivateKey must have a value"
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

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        VERIFICAR Y CORREGIR JWT_SECRET EN .ENV               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd /var/www/parse/backend

# 1. Verificar que .env existe
if [ ! -f ".env" ]; then
    log_error ".env no existe en $(pwd)"
    exit 1
fi

log_success ".env encontrado"

# 2. Verificar JWT_SECRET existe
if ! grep -q "^JWT_SECRET=" .env; then
    log_error "JWT_SECRET no está definido en .env"
    exit 1
fi

log_success "JWT_SECRET encontrado en .env"

# 3. Mostrar valor actual (parcialmente enmascarado)
CURRENT_VALUE=$(grep "^JWT_SECRET=" .env | cut -d '=' -f2-)
if [[ $CURRENT_VALUE == \"*\" ]]; then
    log_warning "JWT_SECRET tiene comillas, se eliminarán"
    echo "   Valor actual: ${CURRENT_VALUE:0:20}..."

    # Crear backup
    cp .env .env.backup.jwt.$(date +%Y%m%d_%H%M%S)
    log_info "Backup creado: .env.backup.jwt.$(date +%Y%m%d_%H%M%S)"

    # Eliminar comillas de JWT_SECRET
    sed -i 's/^JWT_SECRET="\(.*\)"$/JWT_SECRET=\1/' .env

    NEW_VALUE=$(grep "^JWT_SECRET=" .env | cut -d '=' -f2-)
    log_success "JWT_SECRET corregido (sin comillas)"
    echo "   Nuevo valor: ${NEW_VALUE:0:20}..."
else
    log_success "JWT_SECRET ya está sin comillas"
    echo "   Valor: ${CURRENT_VALUE:0:20}..."
fi

# 4. Verificar otras variables importantes también
log_info "Verificando otras variables..."

if grep -q "^DATABASE_URL=\"" .env; then
    log_warning "DATABASE_URL tiene comillas, corrigiendo..."
    sed -i 's/^DATABASE_URL="\(.*\)"$/DATABASE_URL=\1/' .env
    log_success "DATABASE_URL corregido"
fi

if grep -q "^JWT_EXPIRES_IN=\"" .env; then
    log_warning "JWT_EXPIRES_IN tiene comillas, corrigiendo..."
    sed -i 's/^JWT_EXPIRES_IN="\(.*\)"$/JWT_EXPIRES_IN=\1/' .env
    log_success "JWT_EXPIRES_IN corregido"
fi

# 5. Verificar que las variables se pueden exportar
log_info "Verificando que las variables se pueden cargar..."
export $(grep -v '^#' .env | xargs)

if [ -z "$JWT_SECRET" ]; then
    log_error "JWT_SECRET no se pudo cargar"
    exit 1
fi

log_success "JWT_SECRET cargado correctamente"
echo "   Longitud: ${#JWT_SECRET} caracteres"

if [ ${#JWT_SECRET} -lt 32 ]; then
    log_warning "JWT_SECRET es muy corto (< 32 caracteres)"
    log_warning "Se recomienda usar un secreto más largo para producción"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              VARIABLES CORREGIDAS                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

log_success "Ahora reinicia PM2:"
echo ""
echo "  cd /var/www/parse"
echo "  pm2 restart parse-backend --update-env"
echo "  pm2 logs parse-backend --lines 50"
echo ""
