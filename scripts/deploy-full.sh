#!/bin/bash

# Script de deployment completo para Rendiciones App
# Compila backend, frontend y reinicia servicios PM2
# Uso: ./deploy-full.sh

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Función para logs coloridos
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Configuración
PROJECT_DIR="/var/www/Rendiciones"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/packages/web"

# Verificar que estamos en el directorio correcto
if [ ! -d "$PROJECT_DIR" ]; then
    error "Directorio del proyecto no encontrado: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

echo -e "${CYAN}"
echo "========================================="
echo "🚀 DEPLOYMENT RENDICIONES APP"
echo "========================================="
echo -e "${NC}"

log "📁 Directorio del proyecto: $(pwd)"

# ============================================
# PASO 1: ACTUALIZAR CÓDIGO
# ============================================
step "1. Actualizando código desde repositorio..."

# Hacer backup de .env si existe
if [ -f "$BACKEND_DIR/.env" ]; then
    log "💾 Creando backup de .env..."
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Stash cambios locales
log "📦 Guardando cambios locales..."
git stash push -m "Auto-stash deploy $(date)" || info "No hay cambios para guardar"

# Pull cambios
log "⬇️ Descargando últimos cambios..."
git pull origin master || git pull origin main || error "Falló git pull"

log "✅ Código actualizado"

# ============================================
# PASO 2: COMPILAR BACKEND
# ============================================
step "2. Compilando Backend..."

cd "$BACKEND_DIR"

if [ ! -f "package.json" ]; then
    error "package.json no encontrado en backend"
fi

# Instalar dependencias
log "📦 Instalando dependencias del backend..."
npm install --production --silent

# Generar cliente Prisma
log "🔧 Generando cliente Prisma..."
npx prisma generate || warn "Prisma generate falló"

# Ejecutar migraciones si es necesario
log "🗄️ Ejecutando migraciones..."
npx prisma migrate deploy || warn "No hay migraciones pendientes"

log "✅ Backend compilado exitosamente"

# ============================================
# PASO 3: COMPILAR FRONTEND
# ============================================
step "3. Compilando Frontend..."

if [ ! -d "$FRONTEND_DIR" ]; then
    warn "Directorio frontend no encontrado: $FRONTEND_DIR"
else
    cd "$FRONTEND_DIR"

    if [ ! -f "package.json" ]; then
        warn "package.json no encontrado en frontend"
    else
        # Instalar dependencias
        log "📦 Instalando dependencias del frontend..."
        npm install --silent

        # Compilar frontend
        log "🏗️ Compilando frontend..."
        npm run build || error "Falló la compilación del frontend"

        log "✅ Frontend compilado exitosamente"
    fi
fi

# ============================================
# PASO 4: REINICIAR SERVICIOS PM2
# ============================================
step "4. Reiniciando servicios PM2..."

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    error "PM2 no está instalado. Instálalo con: npm install -g pm2"
fi

# Mostrar estado actual
log "📋 Estado actual de PM2:"
pm2 status

# Reiniciar backend
log "🔄 Reiniciando rendiciones-backend..."
if pm2 list | grep -q "rendiciones-backend"; then
    pm2 restart rendiciones-backend
    log "✅ rendiciones-backend reiniciado"
else
    warn "Proceso 'rendiciones-backend' no encontrado en PM2"
    info "Procesos disponibles:"
    pm2 list --no-colors | grep -E "│.*│" || info "No hay procesos PM2 corriendo"
fi

# Reiniciar frontend
log "🔄 Reiniciando rendiciones-frontend..."
if pm2 list | grep -q "rendiciones-frontend"; then
    pm2 restart rendiciones-frontend
    log "✅ rendiciones-frontend reiniciado"
else
    warn "Proceso 'rendiciones-frontend' no encontrado en PM2"
    info "Si el frontend se sirve con Nginx, no necesita PM2"
fi

# Guardar configuración PM2
log "💾 Guardando configuración PM2..."
pm2 save

# ============================================
# PASO 5: VERIFICACIONES
# ============================================
step "5. Verificando servicios..."

sleep 3

# Verificar backend
BACKEND_URL="http://localhost:5050"
log "🔍 Verificando backend en $BACKEND_URL..."

if curl -sf "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    log "✅ Backend funcionando correctamente (/api/health)"
elif curl -sf "$BACKEND_URL" > /dev/null 2>&1; then
    log "✅ Backend responde (puerto 5050)"
else
    warn "⚠️ Backend no responde en $BACKEND_URL"
    info "Verifica los logs: pm2 logs rendiciones-backend"
fi

# Verificar frontend (si es servido por PM2)
if pm2 list | grep -q "rendiciones-frontend"; then
    FRONTEND_URL="http://localhost:3000"
    log "🔍 Verificando frontend en $FRONTEND_URL..."

    if curl -sf "$FRONTEND_URL" > /dev/null 2>&1; then
        log "✅ Frontend funcionando correctamente"
    else
        warn "⚠️ Frontend no responde en $FRONTEND_URL"
        info "Verifica los logs: pm2 logs rendiciones-frontend"
    fi
fi

# ============================================
# PASO 6: RESUMEN FINAL
# ============================================
echo -e "${CYAN}"
echo "========================================="
echo "🎉 DEPLOYMENT COMPLETADO"
echo "========================================="
echo -e "${NC}"

log "📊 Estado final de los servicios:"
pm2 status

log "📋 Últimos logs del backend:"
pm2 logs rendiciones-backend --lines 3 --raw || warn "No se pudieron obtener logs del backend"

if pm2 list | grep -q "rendiciones-frontend"; then
    log "📋 Últimos logs del frontend:"
    pm2 logs rendiciones-frontend --lines 3 --raw || warn "No se pudieron obtener logs del frontend"
fi

echo -e "${GREEN}"
echo "✅ Deployment completado exitosamente!"
echo "🌐 Backend: http://localhost:5050"
echo "🌐 Frontend: http://localhost:3000"
echo -e "${NC}"

info "Si hay problemas, revisa los logs con:"
info "  pm2 logs rendiciones-backend"
info "  pm2 logs rendiciones-frontend"
info "  pm2 monit"

# Opcional: Mostrar tiempo total
END_TIME=$(date +%s)
if [ ! -z "$START_TIME" ]; then
    DURATION=$((END_TIME - START_TIME))
    info "⏱️ Tiempo total de deployment: ${DURATION}s"
fi