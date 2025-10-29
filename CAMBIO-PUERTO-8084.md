# Cambio de Puerto 8080 → 8084

## Resumen

Se ha actualizado la configuración para que el frontend corra en el **puerto 8084** en lugar de 8080.

## Archivos Modificados

### Configuración de producción
- ✅ `ecosystem.config.js` - Frontend ahora usa puerto 8084
- ✅ `install-ubuntu.sh` - Scripts de instalación actualizados
- ✅ Todos los scripts de diagnóstico y reparación

### Documentación actualizada
- ✅ `INSTALL.md`
- ✅ `SERVIDOR-PASOS.md`
- ✅ `CLAUDE.md`

## Aplicar Cambios en el Servidor

### Opción 1: Script Automático (RECOMENDADO)

```bash
cd /opt/rendiciones

# Hacer pull de los cambios
git pull origin master

# Ejecutar script de aplicación
chmod +x apply-port-8084.sh
./apply-port-8084.sh
```

Este script:
1. Detiene PM2
2. Actualiza `ecosystem.config.js` para usar puerto 8084
3. Actualiza CORS en `backend/.env`
4. Actualiza `packages/web/.env.local`
5. Recompila el frontend
6. Reinicia PM2
7. Verifica que todo funcione

### Opción 2: Manual

```bash
cd /opt/rendiciones

# 1. Detener PM2
pm2 stop all

# 2. Editar ecosystem.config.js
nano ecosystem.config.js
# Cambiar: args: 'start -p 8080' → args: 'start -p 8084'

# 3. Actualizar backend/.env
nano backend/.env
# Cambiar: CORS_ORIGIN=http://149.50.148.198:8080
#      a: CORS_ORIGIN=http://149.50.148.198:8084

# 4. Actualizar packages/web/.env.local
echo "NEXT_PUBLIC_API_URL=http://149.50.148.198:5050" > packages/web/.env.local

# 5. Recompilar frontend
npm run build:web

# 6. Reiniciar PM2
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

## Verificar que Funciona

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs --lines 50

# Verificar puerto 8084
curl http://localhost:8084

# Verificar puerto 5050 (backend)
curl http://localhost:5050/api/health
```

## Acceder a la Aplicación

**Nueva URL:**
```
http://149.50.148.198:8084
```

## Firewall

Si usas firewall, asegúrate de permitir el puerto 8084:

```bash
sudo ufw allow 8084/tcp
sudo ufw reload
```

## Troubleshooting

### Error: Connection Refused en puerto 8084

```bash
# Ver logs del frontend
pm2 logs rendiciones-frontend

# Verificar que el puerto esté en uso
lsof -i :8084
netstat -tulpn | grep 8084
```

### Frontend no inicia

```bash
# Ver ecosystem.config.js
cat ecosystem.config.js | grep -A 5 "rendiciones-frontend"

# Debería mostrar: args: 'start -p 8084'
```

### Backend rechaza peticiones (CORS)

```bash
# Verificar CORS en backend
cat backend/.env | grep CORS_ORIGIN

# Debería mostrar: CORS_ORIGIN=http://149.50.148.198:8084
```

## Rollback (Volver a Puerto 8080)

Si necesitas volver al puerto 8080:

```bash
cd /opt/rendiciones
sed -i 's/8084/8080/g' ecosystem.config.js
sed -i 's/8084/8080/g' backend/.env
echo "NEXT_PUBLIC_API_URL=http://149.50.148.198:5050" > packages/web/.env.local
npm run build:web
pm2 restart all
```
