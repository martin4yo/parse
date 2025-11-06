#!/bin/bash

###############################################################################
# SCRIPT DE DESPLIEGUE AUTOMATIZADO
# Parse - Sistema de Rendiciones v1.1.0
#
# Este script automatiza el proceso de despliegue a producción
# Ejecutar: bash DEPLOY-COMMAND.sh
###############################################################################

set -e  # Detener en cualquier error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         PARSE - DESPLIEGUE A PRODUCCIÓN v1.1.0               ║"
echo "║         Sistema de Rendiciones                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Función para logging
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

# Función para confirmar
confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

###############################################################################
# PASO 0: Confirmación
###############################################################################

echo "Este script va a:"
echo "  1. Crear backup de la base de datos"
echo "  2. Instalar dependencias"
echo "  3. Ejecutar migraciones de Prisma"
echo "  4. Verificar el sistema"
echo "  5. Reiniciar los servicios"
echo ""

if ! confirm "¿Continuar con el despliegue?"; then
    log_error "Despliegue cancelado por el usuario"
    exit 1
fi

###############################################################################
# PASO 1: Backup de Base de Datos
###############################################################################

echo ""
log_info "PASO 1/6: Creando backup de base de datos..."

BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

# Verificar si pg_dump está disponible
if command -v pg_dump &> /dev/null; then
    log_info "Ejecutando pg_dump..."
    # Nota: Configurar DATABASE_URL en .env
    pg_dump $DATABASE_URL > "$BACKUP_FILE" 2>/dev/null || log_warning "No se pudo crear backup (continuando...)"

    if [ -f "$BACKUP_FILE" ]; then
        log_success "Backup creado: $BACKUP_FILE"
    else
        log_warning "No se creó backup (puede que no tengas pg_dump instalado)"
    fi
else
    log_warning "pg_dump no encontrado, saltando backup automático"
    log_warning "IMPORTANTE: Crea un backup manual antes de continuar"

    if ! confirm "¿Continuar sin backup automático?"; then
        exit 1
    fi
fi

###############################################################################
# PASO 2: Instalar Dependencias
###############################################################################

echo ""
log_info "PASO 2/6: Instalando dependencias de npm..."

cd backend

if [ ! -d "node_modules" ]; then
    log_info "node_modules no existe, instalando desde cero..."
    npm install --production
else
    log_info "Actualizando dependencias..."
    npm install --production
fi

log_success "Dependencias instaladas"

# Verificar Sharp específicamente
log_info "Verificando Sharp..."
if node -e "require('sharp')" 2>/dev/null; then
    log_success "Sharp funciona correctamente"
else
    log_warning "Sharp no funciona, intentando rebuild..."
    npm rebuild sharp

    if node -e "require('sharp')" 2>/dev/null; then
        log_success "Sharp rebuild exitoso"
    else
        log_error "Sharp no funciona después de rebuild"
        exit 1
    fi
fi

###############################################################################
# PASO 3: Migraciones de Prisma
###############################################################################

echo ""
log_info "PASO 3/6: Ejecutando migraciones de Prisma..."

# Ver estado de migraciones
log_info "Estado de migraciones:"
npx prisma migrate status || true

# Aplicar migraciones
log_info "Aplicando migraciones..."
npx prisma migrate deploy

# Regenerar cliente Prisma
log_info "Regenerando Prisma Client..."
npx prisma generate

log_success "Migraciones completadas"

###############################################################################
# PASO 4: Verificación del Sistema
###############################################################################

echo ""
log_info "PASO 4/6: Verificando sistema..."

if [ -f "src/scripts/verify-production.js" ]; then
    if node src/scripts/verify-production.js; then
        log_success "Sistema verificado exitosamente"
    else
        log_error "Verificación falló"
        log_error "No se puede continuar con el despliegue"
        exit 1
    fi
else
    log_warning "Script de verificación no encontrado"
    log_warning "Saltando verificación automática"
fi

###############################################################################
# PASO 5: Detener Servicios
###############################################################################

echo ""
log_info "PASO 5/6: Gestionando servicios..."

# Detectar gestor de procesos
if command -v pm2 &> /dev/null; then
    log_info "Detectado PM2"

    # Ver si el proceso existe
    if pm2 list | grep -q "parse-backend"; then
        log_info "Reiniciando parse-backend..."
        pm2 restart parse-backend
        pm2 save
    else
        log_info "Iniciando parse-backend..."
        pm2 start ecosystem.config.js
        pm2 save
    fi

    log_success "Servicios actualizados con PM2"

    # Mostrar logs
    echo ""
    log_info "Mostrando logs (Ctrl+C para salir)..."
    sleep 2
    pm2 logs parse-backend --lines 50

elif command -v systemctl &> /dev/null; then
    log_info "Detectado systemd"

    sudo systemctl restart parse-backend
    log_success "Servicio reiniciado con systemd"

    # Mostrar status
    sudo systemctl status parse-backend

else
    log_warning "No se detectó PM2 ni systemd"
    log_warning "Debes reiniciar el servicio manualmente"
fi

###############################################################################
# PASO 6: Verificación Post-Deploy
###############################################################################

echo ""
log_info "PASO 6/6: Verificación post-deploy..."

# Esperar a que el servidor inicie
log_info "Esperando a que el servidor inicie..."
sleep 5

# Verificar endpoint de health
PORT=${PORT:-5050}
if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
    log_success "Servidor respondiendo en puerto $PORT"
else
    log_warning "Servidor no responde en puerto $PORT"
    log_warning "Verifica los logs manualmente"
fi

###############################################################################
# RESUMEN FINAL
###############################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  DESPLIEGUE COMPLETADO                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "El despliegue ha finalizado"
echo ""
echo "Próximos pasos:"
echo "  1. Verificar logs: pm2 logs parse-backend"
echo "  2. Monitorear recursos: pm2 monit"
echo "  3. Test manual de upload de documento"
echo "  4. Revisar métricas en las próximas 2 horas"
echo ""
echo "Archivos importantes:"
echo "  - Backup BD: $BACKUP_FILE"
echo "  - Logs: pm2 logs parse-backend"
echo "  - Documentación: CHECKLIST-PRODUCCION.md"
echo ""

if [ -f "$BACKUP_FILE" ]; then
    log_info "Backup guardado en: $(pwd)/$BACKUP_FILE"
fi

echo ""
log_success "¡Deploy exitoso! 🎉"
echo ""
