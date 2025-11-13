#!/bin/bash

###############################################################################
# Script de Migración de Servicios PM2
# Migra de "rendiciones-*" a "parse-*"
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

confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         MIGRACIÓN DE SERVICIOS PM2                            ║"
echo "║         rendiciones-* → parse-*                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar servicios actuales
log_info "Servicios PM2 actuales:"
echo ""
pm2 list | grep -E "rendiciones|parse" || echo "No hay servicios rendiciones/parse"
echo ""

if ! confirm "¿Deseas continuar con la migración?"; then
    log_error "Migración cancelada"
    exit 1
fi

# Verificar que existe ecosystem.config.js
if [ ! -f "ecosystem.config.js" ]; then
    log_error "No se encontró ecosystem.config.js en $(pwd)"
    exit 1
fi

log_success "Archivo ecosystem.config.js encontrado"

echo ""
log_info "PASO 1: Detener servicios antiguos..."

# Detener servicios viejos si existen
if pm2 list | grep -q "rendiciones-backend"; then
    log_info "Deteniendo rendiciones-backend..."
    pm2 stop rendiciones-backend
    log_success "rendiciones-backend detenido"
else
    log_warning "rendiciones-backend no encontrado"
fi

if pm2 list | grep -q "rendiciones-frontend"; then
    log_info "Deteniendo rendiciones-frontend..."
    pm2 stop rendiciones-frontend
    log_success "rendiciones-frontend detenido"
else
    log_warning "rendiciones-frontend no encontrado"
fi

echo ""
log_info "PASO 2: Eliminar servicios antiguos de PM2..."

if pm2 list | grep -q "rendiciones-backend"; then
    pm2 delete rendiciones-backend
    log_success "rendiciones-backend eliminado"
fi

if pm2 list | grep -q "rendiciones-frontend"; then
    pm2 delete rendiciones-frontend
    log_success "rendiciones-frontend eliminado"
fi

echo ""
log_info "PASO 3: Iniciar nuevos servicios (parse-backend y parse-frontend)..."

# Iniciar nuevos servicios
pm2 start ecosystem.config.js

log_success "Nuevos servicios iniciados"

echo ""
log_info "PASO 4: Guardar configuración PM2..."

pm2 save

log_success "Configuración guardada"

echo ""
log_info "PASO 5: Configurar inicio automático..."

# Generar startup script
pm2 startup

echo ""
log_warning "IMPORTANTE: Copia y ejecuta el comando que aparece arriba para configurar inicio automático"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  MIGRACIÓN COMPLETADA                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Mostrar estado final
log_info "Estado final de los servicios:"
echo ""
pm2 status

echo ""
log_success "Migración completada exitosamente"
echo ""
echo "Comandos útiles:"
echo "  - Ver logs backend:  pm2 logs parse-backend"
echo "  - Ver logs frontend: pm2 logs parse-frontend"
echo "  - Ver todos los logs: pm2 logs"
echo "  - Monitorear: pm2 monit"
echo "  - Reiniciar: pm2 restart all"
echo ""
