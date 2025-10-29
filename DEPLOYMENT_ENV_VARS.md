# Variables de Entorno para Producción

## Problema Resuelto: URLs de Documentos en Producción

### El Problema
Cuando estás en producción, al hacer click en "Ver Comprobante" se abría `localhost:5050` en lugar de la URL real del servidor.

### La Solución
Configurar las siguientes variables de entorno en el servidor de producción:

## Variables Requeridas en Producción

### Backend (.env)
```bash
# Entorno
NODE_ENV=production

# URL base del servidor (IMPORTANTE - reemplazar con tu dominio real)
BASE_URL=https://tu-servidor.com
# O si usas IP:
# BASE_URL=http://192.168.1.100:5050

# Puerto del backend
PORT=5050

# Base de datos de producción
DATABASE_URL="postgresql://usuario:password@servidor:5432/rendiciones_db"

# JWT (usar una clave segura en producción)
JWT_SECRET="tu-clave-jwt-super-segura-para-produccion-cambiar-esto"

# CORS (permitir el frontend de producción)
FRONTEND_URL="https://tu-servidor.com"
```

### Frontend (.env.local)
```bash
# URL del backend en producción
NEXT_PUBLIC_API_URL=https://tu-servidor.com
```

## Cómo Configurar

### Opción 1: Archivo .env
1. En el servidor, crear/editar el archivo `backend/.env`
2. Agregar las variables mostradas arriba
3. Reemplazar `https://tu-servidor.com` con tu dominio real
4. Reiniciar el backend

### Opción 2: Variables de Sistema
```bash
export NODE_ENV=production
export BASE_URL=https://tu-servidor.com
export PORT=5050
# ... otras variables
```

### Opción 3: PM2 Ecosystem
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'rendiciones-backend',
    script: 'src/index.js',
    env_production: {
      NODE_ENV: 'production',
      BASE_URL: 'https://tu-servidor.com',
      PORT: 5050,
      // ... otras variables
    }
  }]
}
```

## Verificación

Después de configurar, puedes verificar que funcione:

1. Hacer click en "Ver Comprobante" en la grilla
2. Debería abrir una URL como: `https://tu-servidor.com/api/documentos/123/archivo?token=...`
3. **NO** debería mostrar `localhost:5050`

## Logs de Debug

El sistema ahora muestra logs cuando genera las URLs:
```
[DEBUG] Generando viewUrl - NODE_ENV: production, BASE_URL: https://tu-servidor.com, baseUrl: https://tu-servidor.com
```

Si ves este log con los valores correctos, la configuración está funcionando.

## Ejemplos Comunes

### Servidor con Dominio
```bash
BASE_URL=https://rendiciones.empresa.com
```

### Servidor con IP (Configuración Actual)
```bash
BASE_URL=http://149.50.148.198:8084
```

### Servidor con IP (Ejemplo Genérico)
```bash
BASE_URL=http://192.168.1.100:5050
```

### Nginx Reverse Proxy
```bash
BASE_URL=https://empresa.com/rendiciones
```

## Importante
- **Siempre** incluir el protocolo (http:// o https://)
- **NO** incluir `/api` al final de BASE_URL
- Si usas puerto específico, incluirlo: `:5050`
- En desarrollo, estas variables son opcionales (se detecta automáticamente)