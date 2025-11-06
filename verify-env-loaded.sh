#!/bin/bash

###############################################################################
# Script para Verificar que las Variables de Entorno se Cargan Correctamente
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
echo "║      VERIFICAR CARGA DE VARIABLES DE ENTORNO                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd /var/www/parse/backend

# 1. Verificar que .env existe
if [ ! -f ".env" ]; then
    log_error ".env no existe en $(pwd)"
    exit 1
fi

log_success ".env encontrado en $(pwd)"
echo ""

# 2. Mostrar contenido del .env (enmascarando valores sensibles)
log_info "Contenido actual del .env (valores enmascarados):"
echo "────────────────────────────────────────────────────────────────"
while IFS= read -r line; do
    # Saltar líneas vacías y comentarios
    if [[ -z "$line" ]] || [[ "$line" =~ ^# ]]; then
        echo "$line"
    else
        # Mostrar variable con valor parcialmente enmascarado
        var_name=$(echo "$line" | cut -d '=' -f1)
        var_value=$(echo "$line" | cut -d '=' -f2-)

        # Detectar si tiene comillas
        if [[ $var_value == \"*\" ]]; then
            echo -e "${RED}$var_name=$var_value ${YELLOW}<--- TIENE COMILLAS (INCORRECTO)${NC}"
        else
            # Mostrar solo primeros caracteres
            echo "$var_name=${var_value:0:20}..."
        fi
    fi
done < .env
echo "────────────────────────────────────────────────────────────────"
echo ""

# 3. Verificar variables críticas
log_info "Verificando variables críticas:"
echo ""

# Cargar variables
export $(grep -v '^#' .env | xargs)

# JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    log_error "JWT_SECRET no está definido o está vacío"
else
    log_success "JWT_SECRET cargado (${#JWT_SECRET} caracteres)"
    echo "   Valor: ${JWT_SECRET:0:20}..."

    # Verificar si tiene comillas
    if [[ $JWT_SECRET == \"*\" ]]; then
        log_error "JWT_SECRET todavía tiene comillas!"
        echo "   Ejecuta: ./fix-jwt-env.sh"
    fi
fi

# DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL no está definido o está vacío"
else
    log_success "DATABASE_URL cargado (${#DATABASE_URL} caracteres)"
    echo "   Valor: ${DATABASE_URL:0:30}..."
fi

# JWT_EXPIRES_IN
if [ -z "$JWT_EXPIRES_IN" ]; then
    log_warning "JWT_EXPIRES_IN no está definido (usará default '7d')"
else
    log_success "JWT_EXPIRES_IN: $JWT_EXPIRES_IN"
fi

# NODE_ENV
if [ -z "$NODE_ENV" ]; then
    log_warning "NODE_ENV no está definido"
else
    log_success "NODE_ENV: $NODE_ENV"
fi

echo ""
log_info "Probando si Node.js puede cargar las variables..."
echo ""

# 4. Crear un script temporal de Node para verificar
cat > /tmp/test-env.js <<'NODESCRIPT'
require('dotenv').config({ path: '/var/www/parse/backend/.env' });

console.log('🔍 Variables cargadas en Node.js:');
console.log('');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? `✓ Definido (${process.env.JWT_SECRET.length} chars): ${process.env.JWT_SECRET.substring(0, 20)}...` : '✗ NO DEFINIDO');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? `✓ Definido (${process.env.DATABASE_URL.length} chars)` : '✗ NO DEFINIDO');
console.log('JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || '✗ NO DEFINIDO (usará default)');
console.log('NODE_ENV:', process.env.NODE_ENV || '✗ NO DEFINIDO');
console.log('');

if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET NO SE ESTÁ CARGANDO EN NODE.JS');
    console.error('   Este es el problema que causa el error en PM2');
    process.exit(1);
} else {
    console.log('✅ JWT_SECRET se carga correctamente en Node.js');
    console.log('   El problema puede estar en cómo PM2 ejecuta la aplicación');
}
NODESCRIPT

node /tmp/test-env.js
TEST_RESULT=$?

echo ""

if [ $TEST_RESULT -eq 0 ]; then
    log_success "Node.js puede cargar las variables correctamente"
    echo ""
    log_info "El problema está en la configuración de PM2"
    echo ""
    echo "Solución: Reiniciar PM2 con variables actualizadas:"
    echo ""
    echo "  cd /var/www/parse"
    echo "  pm2 delete parse-backend"
    echo "  pm2 start ecosystem.config.js --only parse-backend"
    echo "  pm2 logs parse-backend"
    echo ""
else
    log_error "Node.js NO puede cargar JWT_SECRET"
    echo ""
    log_info "Ejecuta el script de corrección:"
    echo ""
    echo "  ./fix-jwt-env.sh"
    echo ""
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                 VERIFICACIÓN COMPLETA                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
