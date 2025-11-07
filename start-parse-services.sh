#!/bin/bash

###############################################################################
# Script para Iniciar Servicios de Parse en PM2
# Verifica requisitos y lanza los servicios
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

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         INICIAR SERVICIOS PARSE EN PM2                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "ecosystem.config.js" ]; then
    log_error "No se encontró ecosystem.config.js"
    log_error "Ejecuta este script desde /var/www/parse/"
    exit 1
fi

log_success "Directorio correcto: $(pwd)"

# Verificar requisitos
echo ""
log_info "Verificando requisitos..."

# 1. Verificar backend
if [ ! -f "backend/src/index.js" ]; then
    log_error "No existe backend/src/index.js"
    exit 1
fi
log_success "✓ Backend script existe"

# 2. Verificar node_modules backend
if [ ! -d "backend/node_modules" ]; then
    log_error "No existe backend/node_modules"
    log_error "Ejecuta: cd backend && npm install"
    exit 1
fi
log_success "✓ Backend node_modules existe"

# 3. Verificar .env backend
if [ ! -f "backend/.env" ]; then
    log_warning "⚠ No existe backend/.env (usará valores por defecto)"
else
    log_success "✓ Backend .env existe"
fi

# 4. Verificar frontend build
if [ ! -d "frontend/.next" ]; then
    log_error "No existe frontend/.next (frontend no compilado)"
    log_error "Ejecuta: cd frontend && npm run build"
    exit 1
fi
log_success "✓ Frontend compilado (.next existe)"

# 5. Verificar node_modules frontend
if [ ! -d "frontend/node_modules" ]; then
    log_error "No existe frontend/node_modules"
    log_error "Ejecuta: cd frontend && npm install"
    exit 1
fi
log_success "✓ Frontend node_modules existe"

# 6. Crear directorio logs si no existe
if [ ! -d "logs" ]; then
    log_info "Creando directorio logs..."
    mkdir -p logs
fi
log_success "✓ Directorio logs existe"

echo ""
log_info "Todos los requisitos cumplidos"
echo ""

# Verificar si los servicios ya existen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Verificando servicios existentes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if pm2 list | grep -q "parse-backend"; then
    log_warning "parse-backend ya existe en PM2"
    log_info "Reiniciando parse-backend..."
    pm2 restart parse-backend
else
    log_info "parse-backend no existe, será creado..."
fi

if pm2 list | grep -q "parse-frontend"; then
    log_warning "parse-frontend ya existe en PM2"
    log_info "Reiniciando parse-frontend..."
    pm2 restart parse-frontend
else
    log_info "parse-frontend no existe, será creado..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Iniciando servicios con PM2..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

pm2 start ecosystem.config.js

log_success "Servicios iniciados"

echo ""
log_info "Guardando configuración PM2..."
pm2 save

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Estado de los servicios:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 status

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Verificando que los servicios estén online..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sleep 3

# Verificar backend
if pm2 list | grep "parse-backend" | grep -q "online"; then
    log_success "✓ parse-backend está ONLINE"
else
    log_error "✗ parse-backend NO está online"
    log_error "Ver logs: pm2 logs parse-backend --err"
fi

# Verificar frontend
if pm2 list | grep "parse-frontend" | grep -q "online"; then
    log_success "✓ parse-frontend está ONLINE"
else
    log_error "✗ parse-frontend NO está online"
    log_error "Ver logs: pm2 logs parse-frontend --err"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  SERVICIOS INICIADOS                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "Parse Backend y Frontend están corriendo en PM2"
echo ""
echo "Comandos útiles:"
echo "  - Ver estado:          pm2 status"
echo "  - Ver logs backend:    pm2 logs parse-backend"
echo "  - Ver logs frontend:   pm2 logs parse-frontend"
echo "  - Ver todos los logs:  pm2 logs"
echo "  - Reiniciar backend:   pm2 restart parse-backend"
echo "  - Reiniciar frontend:  pm2 restart parse-frontend"
echo "  - Monitorear:          pm2 monit"
echo ""
echo "URLs locales:"
echo "  - Backend:  http://localhost:5100/health"
echo "  - Frontend: http://localhost:8087"
echo ""
echo "URLs públicas (si Nginx está configurado):"
echo "  - Backend:  https://api.parsedemo.axiomacloud.com/health"
echo "  - Frontend: https://parsedemo.axiomacloud.com"
echo ""
