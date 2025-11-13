#!/bin/bash

###############################################################################
# Script de Diagnóstico para Parse
# Identifica por qué el backend no responde (error 502)
###############################################################################

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
echo "║         DIAGNÓSTICO DE PARSE - ERROR 502                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Estado de PM2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "1. Estado de PM2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 status | grep parse || log_error "No se encontraron servicios parse en PM2"

# 2. Detalle del backend
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "2. Detalle del Backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if pm2 describe parse-backend > /dev/null 2>&1; then
    pm2 describe parse-backend | grep -E "status|uptime|restarts"
else
    log_error "parse-backend no existe en PM2"
fi

# 3. Logs del backend (últimos errores)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "3. Últimos Errores del Backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if pm2 logs parse-backend --nostream --err --lines 20 2>/dev/null; then
    log_info "Errores mostrados arriba"
else
    log_error "No se pudieron obtener logs del backend"
fi

# 4. Variables de entorno
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "4. Variables de Entorno del Backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "/var/www/parse/backend/.env" ]; then
    log_success ".env existe"
    echo "PORT: $(cat /var/www/parse/backend/.env | grep "^PORT=" | cut -d'=' -f2)"
    echo "NODE_ENV: $(cat /var/www/parse/backend/.env | grep "^NODE_ENV=" | cut -d'=' -f2)"
    if cat /var/www/parse/backend/.env | grep -q "^DATABASE_URL="; then
        log_success "DATABASE_URL configurada"
    else
        log_error "DATABASE_URL NO configurada"
    fi
else
    log_error ".env NO existe en /var/www/parse/backend/"
fi

# 5. Puertos en uso
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "5. Puertos Usados por Node.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
netstat -tulpn | grep node || log_error "No hay procesos node escuchando"

# 6. Test directo al backend
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "6. Test Directo al Backend (localhost:5100)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:5100/health > /dev/null 2>&1; then
    log_success "Backend responde en localhost:5100"
    curl -s http://localhost:5100/health
else
    log_error "Backend NO responde en localhost:5100"
fi

# 7. Configuración de Nginx
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "7. Configuración de Nginx (Backend)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "/etc/nginx/sites-available/parse-backend" ]; then
    log_success "Archivo de configuración existe"
    echo "Proxy pass configurado:"
    cat /etc/nginx/sites-available/parse-backend | grep "proxy_pass" | head -1
else
    log_error "Archivo /etc/nginx/sites-available/parse-backend NO existe"
fi

# 8. Estado de Nginx
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "8. Estado de Nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if systemctl is-active --quiet nginx; then
    log_success "Nginx está corriendo"
else
    log_error "Nginx NO está corriendo"
fi

# 9. Logs de Nginx
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "9. Últimos Errores de Nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "/var/log/nginx/parse-backend-error.log" ]; then
    tail -20 /var/log/nginx/parse-backend-error.log
else
    log_error "Log de errores de Nginx no encontrado"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  DIAGNÓSTICO COMPLETADO                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Resumen
echo "RESUMEN DE PROBLEMAS ENCONTRADOS:"
echo ""

PROBLEMS=0

if ! pm2 describe parse-backend > /dev/null 2>&1; then
    echo "❌ parse-backend no está en PM2"
    PROBLEMS=$((PROBLEMS+1))
fi

if ! pm2 list | grep parse-backend | grep -q "online"; then
    echo "❌ parse-backend no está online"
    PROBLEMS=$((PROBLEMS+1))
fi

if [ ! -f "/var/www/parse/backend/.env" ]; then
    echo "❌ backend/.env no existe"
    PROBLEMS=$((PROBLEMS+1))
fi

if ! curl -s http://localhost:5100/health > /dev/null 2>&1; then
    echo "❌ Backend no responde en localhost:5100"
    PROBLEMS=$((PROBLEMS+1))
fi

if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx no está corriendo"
    PROBLEMS=$((PROBLEMS+1))
fi

if [ $PROBLEMS -eq 0 ]; then
    log_success "No se encontraron problemas obvios"
    echo ""
    echo "El problema puede ser más complejo. Revisa los logs arriba."
fi

echo ""
echo "SOLUCIONES SUGERIDAS:"
echo ""
echo "1. Si parse-backend no está en PM2:"
echo "   cd /var/www/parse && pm2 start ecosystem.config.js"
echo ""
echo "2. Si parse-backend está crasheando:"
echo "   pm2 logs parse-backend --err"
echo "   (resolver el error que aparece)"
echo ""
echo "3. Si .env no existe:"
echo "   cp backend/.env.example backend/.env"
echo "   nano backend/.env (configurar DATABASE_URL, etc.)"
echo ""
echo "4. Reiniciar todo:"
echo "   pm2 restart parse-backend && sudo systemctl reload nginx"
echo ""
