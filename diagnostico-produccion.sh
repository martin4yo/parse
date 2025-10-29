#!/bin/bash

echo "=== DIAGNÓSTICO DEL PROBLEMA DE LOCALHOST EN PRODUCCIÓN ==="
echo "Fecha: $(date)"
echo "Servidor: $(hostname -I)"
echo ""

echo "1. VERIFICANDO CÓDIGO ACTUALIZADO..."
echo "Buscando la línea con 149.50.148.198:8084:"
grep -n "149.50.148.198:8084" backend/src/routes/documentos.js
if [ $? -eq 0 ]; then
    echo "✅ Código actualizado encontrado"
else
    echo "❌ Código NO actualizado"
fi
echo ""

echo "2. VERIFICANDO ESTRUCTURA DEL ARCHIVO..."
echo "Mostrando líneas 270-290 del archivo:"
sed -n '270,290p' backend/src/routes/documentos.js
echo ""

echo "3. VERIFICANDO VARIABLES DE ENTORNO..."
echo "NODE_ENV: $NODE_ENV"
echo "BASE_URL: $BASE_URL"
echo "PORT: $PORT"
echo ""

echo "4. VERIFICANDO PROCESOS NODE..."
echo "Procesos Node corriendo:"
ps aux | grep node | grep -v grep
echo ""

echo "5. VERIFICANDO PM2 (si existe)..."
if command -v pm2 &> /dev/null; then
    echo "PM2 procesos:"
    pm2 list
    echo ""
    echo "PM2 logs recientes:"
    pm2 logs --lines 10
else
    echo "PM2 no encontrado"
fi
echo ""

echo "6. VERIFICANDO PUERTO 8084..."
echo "¿Hay algo corriendo en puerto 8084?"
netstat -tlnp | grep :8084
echo ""

echo "7. VERIFICANDO CONECTIVIDAD..."
echo "Probando conexión local al backend:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8084/api/health || echo "No responde en puerto 8084"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:5050/api/health || echo "No responde en puerto 5050"
echo ""

echo "8. VERIFICANDO LOGS RECIENTES..."
if [ -f "logs/backend.log" ]; then
    echo "Últimas 10 líneas del log:"
    tail -10 logs/backend.log
elif [ -f "backend.log" ]; then
    echo "Últimas 10 líneas del log:"
    tail -10 backend.log
else
    echo "No se encontró archivo de log"
fi
echo ""

echo "=== FIN DEL DIAGNÓSTICO ==="
echo "Por favor envía toda esta salida para el análisis"