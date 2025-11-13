#!/bin/bash

# Script de deployment automático
# Uso: ./deploy.sh

set -e  # Salir si hay errores

echo "🚀 Iniciando deployment..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Directorio del proyecto
PROJECT_DIR="/var/www/Rendiciones"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/packages/web"

# Verificar que estamos en el directorio correcto
if [ ! -d "$PROJECT_DIR" ]; then
    error "Directorio del proyecto no encontrado: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

log "📁 Cambiando al directorio del proyecto: $(pwd)"

# 1. Hacer backup de archivos críticos
log "💾 Creando backup de .env..."
if [ -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 2. Stash cambios locales si los hay
log "📦 Guardando cambios locales..."
git stash push -m "Auto-stash antes de deploy $(date)"

# 3. Pull los últimos cambios
log "⬇️ Descargando últimos cambios..."
git pull origin master || git pull origin main || error "Falló git pull"

# 4. Instalar dependencias del backend
log "📦 Instalando dependencias del backend..."
cd "$BACKEND_DIR"
npm install --production

# 5. Ejecutar migraciones si es necesario
log "🗄️ Ejecutando migraciones de BD..."
if command -v npx &> /dev/null; then
    npx prisma migrate deploy || warn "Migraciones fallaron o no hay cambios"
    npx prisma generate || warn "Prisma generate falló"
else
    warn "npx no disponible, saltando migraciones"
fi

# 6. Compilar frontend si existe
if [ -d "$FRONTEND_DIR" ]; then
    log "🏗️ Compilando frontend..."
    cd "$FRONTEND_DIR"
    if [ -f "package.json" ]; then
        npm install --production
        npm run build || warn "Build del frontend falló"
    fi
fi

# 7. Reiniciar servicios
log "🔄 Reiniciando servicios..."
cd "$BACKEND_DIR"

# Detectar si usa PM2, systemctl o npm
if command -v pm2 &> /dev/null && pm2 list | grep -q "app"; then
    log "Reiniciando con PM2..."
    pm2 restart app
    pm2 save
elif systemctl is-active --quiet rendiciones; then
    log "Reiniciando con systemctl..."
    sudo systemctl restart rendiciones
else
    warn "No se detectó gestor de procesos. Reinicia manualmente."
fi

# 8. Verificar que el servicio está funcionando
log "✅ Verificando servicio..."
sleep 5

# Verificar si el backend responde
BACKEND_URL="http://localhost:5050"
if curl -sf "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    log "✅ Backend funcionando correctamente"
elif curl -sf "$BACKEND_URL" > /dev/null 2>&1; then
    log "✅ Backend responde (sin endpoint /health)"
else
    warn "⚠️ Backend no responde en $BACKEND_URL"
fi

# 9. Mostrar logs recientes si usa PM2
if command -v pm2 &> /dev/null; then
    log "📋 Últimos logs:"
    pm2 logs --lines 5
fi

log "🎉 ¡Deployment completado!"
log "📍 Verifica que todo funcione correctamente en: $BACKEND_URL"

# Opcional: enviar notificación
# curl -X POST "https://hooks.slack.com/..." -d "payload={\"text\":\"Deployment completado en $(hostname)\"}"