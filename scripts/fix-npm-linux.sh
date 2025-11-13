#!/bin/bash

###############################################################################
# Script Robusto para Instalar Dependencias en Linux
# Soluciona EBADPLATFORM limpiando completamente el caché de npm
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
echo "║    INSTALACIÓN LIMPIA DE DEPENDENCIAS PARA LINUX              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar que estamos en Linux
if [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "msys" ]]; then
    log_error "Este script debe ejecutarse en Linux, no en Windows"
    exit 1
fi

log_success "Plataforma: Linux detectado"

# Frontend
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "FRONTEND: Limpieza completa..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend

log_info "Limpiando caché de npm..."
npm cache clean --force

log_info "Eliminando node_modules, package-lock.json y .next..."
rm -rf node_modules package-lock.json .next

log_info "Instalando dependencias (puede tardar unos minutos)..."
echo ""

# Intentar instalación normal primero
if npm install --force; then
    log_success "Instalación exitosa con --force"
else
    log_warning "Instalación con --force falló, intentando con --legacy-peer-deps..."
    if npm install --legacy-peer-deps --force; then
        log_success "Instalación exitosa con --legacy-peer-deps"
    else
        log_error "Instalación falló completamente"
        echo ""
        log_info "Intentando última opción: instalación sin package-lock..."
        npm install --no-package-lock --force
    fi
fi

log_success "Frontend: dependencias instaladas"

# Verificar que se instaló la versión correcta de @next/swc
log_info "Verificando instalación de @next/swc..."
if ls node_modules/@next/ | grep -q "swc-linux"; then
    log_success "✓ @next/swc-linux instalado correctamente"
else
    log_warning "No se encontró @next/swc-linux, pero continuando..."
fi

# Build frontend
echo ""
log_info "Compilando frontend para producción..."
if npm run build; then
    log_success "Frontend compilado exitosamente"
else
    log_error "Error compilando frontend"
    exit 1
fi

# Backend
cd ../backend

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "BACKEND: Limpieza completa..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "Limpiando caché de npm..."
npm cache clean --force

log_info "Eliminando node_modules y package-lock.json..."
rm -rf node_modules package-lock.json

log_info "Instalando dependencias..."
echo ""

if npm install --production --force; then
    log_success "Backend: dependencias instaladas"
else
    log_warning "Instalación con --force falló, intentando con --legacy-peer-deps..."
    npm install --production --legacy-peer-deps --force
    log_success "Backend: dependencias instaladas"
fi

# Verificar Sharp
log_info "Verificando Sharp..."
if node -e "require('sharp')" 2>/dev/null; then
    log_success "Sharp funciona correctamente"
else
    log_warning "Sharp no funciona, intentando rebuild..."
    npm rebuild sharp
    if node -e "require('sharp')" 2>/dev/null; then
        log_success "Sharp rebuild exitoso"
    else
        log_error "Sharp falló, pero continuando..."
    fi
fi

cd ..

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  INSTALACIÓN COMPLETADA                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "Todas las dependencias instaladas para Linux"
echo ""
echo "Archivos generados:"
echo "  - frontend/.next/          (build de Next.js)"
echo "  - frontend/node_modules/   (dependencias Linux)"
echo "  - backend/node_modules/    (dependencias Linux)"
echo ""
echo "Próximos pasos:"
echo "  1. pm2 start ecosystem.config.js"
echo "  2. pm2 save"
echo "  3. pm2 status"
echo ""
