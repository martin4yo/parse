# Guía de Despliegue en Producción

## Servidor de Producción
- **IP**: 149.50.148.198
- **Puerto Frontend**: 8084
- **Puerto Backend**: 5050
- **URL de Acceso**: http://149.50.148.198:8084

## Arquitectura

```
Usuario → :8084 (nginx) → 
  ├── / → :3000 (Frontend Next.js)
  └── /api → :5050 (Backend Node.js/Express)
```

## Configuración del Servidor

### 1. Backend (`/var/www/Rendiciones/backend`)

#### Archivo `.env`:
```env
DATABASE_URL="postgresql://postgres:Q27G4B98@149.50.148.198:5432/rendiciones_db"
JWT_SECRET="tu-clave-secreta-jwt-muy-segura-para-produccion"
JWT_EXPIRES_IN="7d"
PORT=5050
NODE_ENV="development"
FRONTEND_URL="http://149.50.148.198:8084"
MAX_FILE_SIZE="52428800"
UPLOAD_DIR="uploads"
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=martin4yo@gmail.com
SMTP_PASS="qfiu rgyn dowu sfpi"
```

#### Comandos de gestión:
```bash
# Generar Prisma Client
npm run db:generate

# Iniciar con PM2
pm2 start src/index.js --name rendiciones-backend

# Ver logs
pm2 logs rendiciones-backend

# Reiniciar
pm2 restart rendiciones-backend
```

### 2. Frontend (`/var/www/Rendiciones/packages/web`)

#### Archivo `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://149.50.148.198:8084
```

#### Comandos de gestión:
```bash
# Build de producción
npm run build

# Iniciar con PM2
pm2 start 'npm run start' --name rendiciones-frontend

# Ver logs
pm2 logs rendiciones-frontend

# Reiniciar
pm2 restart rendiciones-frontend
```

### 3. Nginx (`/etc/nginx/sites-available/rendiciones`)

```nginx
server {
    listen 8084;
    server_name 149.50.148.198;
    
    # Frontend Next.js en puerto 3000
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Backend API en puerto 5050
    location /api {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    client_max_body_size 50M;
}
```

## Cambios Importantes para HTTP (sin HTTPS)

### 1. Cookies sin Secure Flag
En `packages/web/src/lib/auth.ts`, las cookies deben tener `secure: false`:
```javascript
Cookies.set(TOKEN_KEY, token, {
  expires: 7,
  secure: false, // Deshabilitado para permitir HTTP
  sameSite: 'lax'
});
```

### 2. CORS configurado
En `backend/src/index.js`, incluir la URL de producción:
```javascript
app.use(cors({
  origin: [
    // ... otros orígenes
    'http://149.50.148.198:8084'
  ],
  credentials: true
}));
```

### 3. Redirección después del Login
En `packages/web/src/app/auth/login/page.tsx`, usar `window.location.href`:
```javascript
toast.success('¡Bienvenido!');
window.location.href = '/dashboard'; // No usar router.push()
```

## Procesos PM2

Ver estado de todos los procesos:
```bash
pm2 status
```

Resultado esperado:
```
┌────┬─────────────────────────┬─────────┬─────────┬──────────┬──────┬───────────┐
│ id │ name                    │ version │ mode    │ pid      │ ↺    │ status    │
├────┼─────────────────────────┼─────────┼─────────┼──────────┼──────┼───────────┤
│ 9  │ rendiciones-backend     │ 1.0.0   │ fork    │ XXXXX    │ 0    │ online    │
│ 10 │ rendiciones-frontend    │ N/A     │ fork    │ XXXXX    │ 0    │ online    │
└────┴─────────────────────────┴─────────┴─────────┴──────────┴──────┴───────────┘
```

## Puertos Abiertos en Firewall (UFW)

```bash
# Ver puertos abiertos
ufw status

# Puertos necesarios
- 22 (SSH)
- 8084 (Nginx/Frontend)
- 5050 (Backend API) 
- 5432 (PostgreSQL)
```

## Usuario de Prueba

- **Email**: test@test.com
- **Password**: test123

## Solución de Problemas Comunes

### 502 Bad Gateway
- Verificar que el frontend esté corriendo: `pm2 status`
- Verificar logs: `pm2 logs rendiciones-frontend`
- Reiniciar: `pm2 restart rendiciones-frontend`

### Login no funciona
- Verificar cookies en el navegador (F12 → Application → Cookies)
- Verificar que `secure: false` en auth.ts
- Verificar CORS en backend incluye la URL de producción
- Probar en ventana incógnito

### Timeout desde fuera del servidor
- Verificar firewall del proveedor (Dattatec)
- Verificar UFW: `ufw status`
- Verificar que nginx escucha en 0.0.0.0:8084: `netstat -tlnp | grep 8084`

## Comandos Útiles

```bash
# Conectar al servidor
ssh root@149.50.148.198

# Ver logs en tiempo real
pm2 logs

# Reiniciar todo
pm2 restart all

# Ver uso de recursos
pm2 monit

# Verificar puertos activos
netstat -tlnp

# Verificar nginx
nginx -t
systemctl status nginx
```

## Notas Importantes

1. **NO usar HTTPS** mientras uses HTTP - las cookies secure no funcionarán
2. **Usuario admin** por defecto: admin@rendiciones.com (verificar contraseña en BD)
3. **Base de datos** PostgreSQL está en el mismo servidor
4. **Archivos subidos** se guardan en `/var/www/Rendiciones/backend/uploads`

## ⚠️ CRÍTICO: Configuración de FRONTEND_URL

### El Problema
Los emails de verificación de usuario y notificaciones contienen enlaces que usan `FRONTEND_URL`.
Si esta variable tiene una IP pero los usuarios acceden por dominio (o viceversa), habrá errores de:
- Cookies bloqueadas (SameSite policy)
- CORS errors
- Links rotos en emails

### La Solución
**FRONTEND_URL DEBE COINCIDIR CON LA URL QUE USAN LOS USUARIOS PARA ACCEDER**

#### Opción A: Tienes un dominio configurado
```env
# backend/.env
FRONTEND_URL="https://rendiciones.tu-empresa.com"
```

#### Opción B: Solo acceso por IP (actual)
```env
# backend/.env
FRONTEND_URL="http://149.50.148.198:8084"
```

### Verificar Configuración
1. ¿Cómo acceden los usuarios? → Usa esa misma URL en `FRONTEND_URL`
2. Reinicia el backend después de cambiar: `pm2 restart rendiciones-backend`
3. Prueba registrando un usuario nuevo y verificando el link del email

---

Última actualización: 11 de Septiembre 2025