#!/bin/bash

echo "=== FIX RÁPIDO PARA PROBLEMA DE LOCALHOST ==="
echo "Este script aplicará el fix directamente en el servidor"
echo ""

# Backup del archivo original
echo "1. Haciendo backup del archivo original..."
cp backend/src/routes/documentos.js backend/src/routes/documentos.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup creado"

# Aplicar el fix usando sed
echo "2. Aplicando fix..."
sed -i 's/baseUrl = `${protocol}:\/\/${host}`;/baseUrl = "http:\/\/149.50.148.198:8084";/g' backend/src/routes/documentos.js

# Verificar que el cambio se aplicó
echo "3. Verificando cambio..."
if grep -q "149.50.148.198:8084" backend/src/routes/documentos.js; then
    echo "✅ Fix aplicado correctamente"
else
    echo "❌ Fix no aplicado, restaurando backup..."
    cp backend/src/routes/documentos.js.backup.* backend/src/routes/documentos.js
    exit 1
fi

# Configurar variables de entorno
echo "4. Configurando variables de entorno..."
export NODE_ENV=production
export BASE_URL="http://149.50.148.198:8084"

# Reiniciar el servicio
echo "5. Reiniciando backend..."
if command -v pm2 &> /dev/null; then
    echo "Reiniciando con PM2..."
    pm2 restart backend || pm2 restart all
else
    echo "Matando procesos node existentes..."
    pkill -f node
    echo "Esperando 3 segundos..."
    sleep 3
    echo "Iniciando backend..."
    cd backend && npm start &
fi

echo "✅ Fix aplicado y servicio reiniciado"
echo ""
echo "Para verificar que funciona:"
echo "1. Ve a la aplicación web"
echo "2. Haz click en 'Ver Comprobante'"
echo "3. Debería abrir: http://149.50.148.198:8084/api/documentos/..."
echo ""
echo "Si no funciona, ejecuta: ./diagnostico-produccion.sh"