# Solución al Error de React Version Conflict

## Error
```
Error: Minified React error #527
```

## Causa
Conflicto entre React 19.1.0 en el workspace raíz y React 18.2.0 en packages/web.

## Solución Rápida en el Servidor

```bash
cd /opt/rendiciones

# Ejecutar script de limpieza
chmod +x clean-react-conflict.sh
./clean-react-conflict.sh
```

## Solución Manual

```bash
cd /opt/rendiciones

# 1. Detener PM2
pm2 stop all

# 2. Limpiar todos los node_modules
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf packages/web/node_modules packages/web/package-lock.json packages/web/.next
rm -rf packages/shared/node_modules packages/shared/package-lock.json

# 3. Reinstalar SOLO dependencias de desarrollo en raíz
npm install --only=dev

# 4. Reinstalar dependencias de workspaces
npm install --workspaces --legacy-peer-deps

# 5. Verificar y eliminar React de raíz si existe
if [ -d "node_modules/react" ]; then
  rm -rf node_modules/react node_modules/react-dom
fi

# 6. Regenerar Prisma
cd backend
npx prisma generate
cd ..

# 7. Compilar frontend
npm run build:web

# 8. Reiniciar PM2
pm2 restart all
```

## Verificar que funcionó

```bash
pm2 logs rendiciones-frontend --lines 50
```

Deberías ver que el frontend inicia correctamente en el puerto 8080.

## Cambios Realizados

### 1. Eliminadas dependencias de React del `package.json` raíz

**Antes:**
```json
"dependencies": {
  "react": "^19.1.0",
  "react-native-svg": "^15.13.0",
  "react-refresh": "^0.17.0"
}
```

**Después:**
```json
"dependencies": {}
```

### 2. Scripts de instalación actualizados

Todos los scripts ahora usan `npm install --only=dev` en la raíz para evitar instalar dependencias de producción que puedan causar conflictos.

### 3. Verificación automática

Los scripts ahora verifican y eliminan automáticamente React del `node_modules` raíz si se encuentra.

## Por qué ocurre este error

El error ocurre porque:
1. styled-jsx (usado por Next.js) busca React en el node_modules más cercano
2. Si encuentra React en `/opt/rendiciones/node_modules/react` (raíz)
3. Pero react-dom está en `/opt/rendiciones/packages/web/node_modules/react-dom`
4. Estas dos copias de React tienen contextos diferentes
5. Resultado: "Cannot read properties of null (reading 'useContext')"

## Solución

Solo debe haber **UNA** copia de React en `packages/web/node_modules/react` (versión 18.2.0).

El workspace raíz solo debe tener dependencias de desarrollo (concurrently, typescript).
