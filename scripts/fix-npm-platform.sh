#!/bin/bash

###############################################################################
# Script para Limpiar Dependencias de NPM
# Soluciona el error: EBADPLATFORM con @next/swc-win32-x64-msvc
###############################################################################

set -e

# Colores
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
echo "║         LIMPIEZA DE DEPENDENCIAS NPM                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

log_info "Este script limpiará node_modules y package-lock.json"
log_info "para regenerarlos en la plataforma actual (Linux)"
echo ""

# Backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "BACKEND: Limpiando dependencias..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend

if [ -d "node_modules" ]; then
    log_info "Eliminando node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    log_info "Eliminando package-lock.json..."
    rm -f package-lock.json
fi

log_info "Instalando dependencias..."
npm install --production

log_success "Backend: dependencias instaladas correctamente"

# Frontend
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "FRONTEND: Limpiando dependencias..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd ../frontend

if [ -d "node_modules" ]; then
    log_info "Eliminando node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    log_info "Eliminando package-lock.json..."
    rm -f package-lock.json
fi

log_info "Instalando dependencias..."
npm install --production

log_success "Frontend: dependencias instaladas correctamente"

# Build frontend
echo ""
log_info "Compilando frontend para producción..."
npm run build

if [ $? -eq 0 ]; then
    log_success "Frontend compilado exitosamente"
else
    log_error "Error compilando frontend"
    exit 1
fi

cd ..

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  LIMPIEZA COMPLETADA                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "Dependencias regeneradas correctamente para Linux"
echo ""
echo "Próximos pasos:"
echo "  1. Iniciar servicios: pm2 start ecosystem.config.js"
echo "  2. O reiniciar: pm2 restart all"
echo ""
