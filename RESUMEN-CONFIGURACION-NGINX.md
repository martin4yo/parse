# ✅ Configuración Completa - Parse con Nginx

## 🌐 URLs de Producción

| Servicio | URL | Puerto Local |
|----------|-----|--------------|
| **Frontend** | https://parsedemo.axiomacloud.com | 8087 |
| **Backend API** | https://api.parsedemo.axiomacloud.com | 5100 |

---

## 📁 Archivos Creados/Actualizados

### ✅ Archivos de Configuración Nginx

1. **`nginx-parse-frontend.conf`** (NUEVO)
   - Configuración completa de Nginx para el frontend
   - Redirección HTTP → HTTPS
   - SSL con Let's Encrypt
   - Proxy a localhost:8087
   - Optimizaciones de caché para Next.js

2. **`nginx-parse-backend.conf`** (NUEVO)
   - Configuración completa de Nginx para el backend
   - Redirección HTTP → HTTPS
   - SSL con Let's Encrypt
   - Proxy a localhost:5100
   - Headers CORS configurados
   - Timeouts extendidos para procesamiento de documentos

### ✅ Archivos de Variables de Entorno

3. **`backend/.env.example`** (ACTUALIZADO)
   ```env
   PORT=5100
   BASE_URL=https://api.parsedemo.axiomacloud.com
   FRONTEND_URL=https://parsedemo.axiomacloud.com
   ```

4. **`frontend/.env.example`** (ACTUALIZADO)
   ```env
   NEXT_PUBLIC_API_URL=https://api.parsedemo.axiomacloud.com
   ```

### ✅ Documentación

5. **`NGINX-SETUP.md`** (NUEVO)
   - Guía completa paso a paso de instalación
   - Configuración de DNS
   - Instalación de SSL con Let's Encrypt
   - Troubleshooting completo
   - Comandos útiles de mantenimiento

6. **`CONFIGURACION-PUERTOS.md`** (CREADO ANTERIORMENTE)
   - Documentación de puertos
   - Guía de troubleshooting

7. **`CLAUDE.md`** (ACTUALIZADO)
   - Agregada información de dominios de producción
   - Referencias a archivos de configuración

---

## 🚀 Pasos para Deployment

### 1. Configurar DNS (ANTES DE TODO)

En tu panel de DNS (ej: Cloudflare), crear:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | parsedemo | IP_DE_TU_SERVIDOR | 3600 |
| A | api.parsedemo | IP_DE_TU_SERVIDOR | 3600 |

**Verificar:**
```bash
nslookup parsedemo.axiomacloud.com
nslookup api.parsedemo.axiomacloud.com
```

### 2. Instalar Nginx y Certbot

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 3. Obtener Certificados SSL

```bash
sudo certbot certonly --nginx -d parsedemo.axiomacloud.com
sudo certbot certonly --nginx -d api.parsedemo.axiomacloud.com
```

### 4. Copiar Configuraciones de Nginx

```bash
cd /ruta/a/parse

sudo cp nginx-parse-frontend.conf /etc/nginx/sites-available/parse-frontend
sudo cp nginx-parse-backend.conf /etc/nginx/sites-available/parse-backend

sudo ln -s /etc/nginx/sites-available/parse-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/parse-backend /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

### 5. Configurar Variables de Entorno

**Backend `.env`:**
```bash
cd backend
nano .env
```

Configurar:
```env
PORT=5100
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=tu-secret-super-seguro
BASE_URL=https://api.parsedemo.axiomacloud.com
FRONTEND_URL=https://parsedemo.axiomacloud.com

# API Keys de IA
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
ENABLE_AI_EXTRACTION=true
USE_CLAUDE_VISION=true
```

**Frontend `.env`:**
```bash
cd frontend
nano .env
```

Configurar:
```env
NEXT_PUBLIC_API_URL=https://api.parsedemo.axiomacloud.com
```

### 6. Desplegar con Script Automatizado

```bash
cd /ruta/a/parse
bash DEPLOY-COMMAND.sh
```

Este script automáticamente:
- ✅ Crea backup de base de datos
- ✅ Instala dependencias backend
- ✅ Instala dependencias frontend
- ✅ Compila frontend con la URL correcta
- ✅ Ejecuta migraciones Prisma
- ✅ Verifica el sistema
- ✅ Reinicia servicios con PM2

### 7. Verificar Funcionamiento

```bash
# Backend
curl https://api.parsedemo.axiomacloud.com/health
# Debe retornar: {"status":"ok"}

# Frontend
curl -I https://parsedemo.axiomacloud.com
# Debe retornar: HTTP/2 200

# Ver servicios
pm2 status

# Ver logs
pm2 logs parse-backend
pm2 logs parse-frontend
```

---

## 🔧 Arquitectura del Sistema

```
Internet
    │
    ├─────────────────────────────────────┐
    │                                     │
    ▼                                     ▼
[Nginx - Port 443]              [Nginx - Port 443]
parsedemo.axiomacloud.com       api.parsedemo.axiomacloud.com
    │                                     │
    │ (SSL Termination)                   │ (SSL Termination)
    │                                     │
    ▼                                     ▼
[PM2: parse-frontend]           [PM2: parse-backend]
localhost:8087                   localhost:5100
    │                                     │
    │                                     │
[Next.js App]                   [Node.js API]
                                        │
                                        ▼
                                [PostgreSQL Database]
```

---

## 📊 Configuraciones Importantes

### CORS
El backend está configurado para permitir:
- `https://parsedemo.axiomacloud.com`

Si necesitas agregar más orígenes, editar `backend/.env`:
```env
FRONTEND_URL=https://parsedemo.axiomacloud.com,https://otro-dominio.com
```

### Uploads de Archivos
- Max size: 10MB (configurado en Nginx y backend)
- Para cambiar: editar ambos archivos nginx y `backend/.env`

```nginx
# En archivos nginx
client_max_body_size 10M;
```

```env
# En backend/.env
MAX_FILE_SIZE=10mb
```

### Timeouts
Backend tiene timeouts extendidos para procesamiento de documentos:
- Connect: 120s
- Send: 120s
- Read: 120s

---

## 🔄 Actualizar la Aplicación

```bash
# Pull cambios (si usas git)
git pull origin master

# O subir archivos manualmente
scp -r backend/ usuario@servidor:/ruta/parse/
scp -r frontend/ usuario@servidor:/ruta/parse/

# Ejecutar deploy
bash DEPLOY-COMMAND.sh
```

---

## 🔐 Seguridad

### SSL/TLS
- ✅ Certificados Let's Encrypt (renovación automática cada 90 días)
- ✅ TLS 1.2 y 1.3 solamente
- ✅ Ciphers seguros
- ✅ HSTS habilitado

### Headers de Seguridad
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Strict-Transport-Security

### CORS
- ✅ Origen específico (no wildcard)
- ✅ Credentials: true
- ✅ Métodos permitidos: GET, POST, PUT, DELETE, OPTIONS, PATCH

---

## 📝 Mantenimiento

### Logs
```bash
# Nginx logs
sudo tail -f /var/log/nginx/parse-frontend-access.log
sudo tail -f /var/log/nginx/parse-backend-access.log

# PM2 logs
pm2 logs parse-backend --lines 100
pm2 logs parse-frontend --lines 100
```

### Renovación de Certificados
```bash
# Ver certificados
sudo certbot certificates

# Renovar (se hace automático con cron)
sudo certbot renew
sudo systemctl reload nginx
```

### Monitoreo
```bash
# Estado general
pm2 status
sudo systemctl status nginx

# Recursos
pm2 monit

# Conexiones activas
sudo netstat -an | grep :443 | grep ESTABLISHED | wc -l
```

---

## 🆘 Soporte

### Documentación Disponible

1. **`NGINX-SETUP.md`** - Guía completa de instalación paso a paso
2. **`CONFIGURACION-PUERTOS.md`** - Información de puertos y troubleshooting
3. **`DEPLOY-COMMAND.sh`** - Script de deployment automatizado
4. **`CHECKLIST-PRODUCCION.md`** - Checklist de deployment
5. **`RESUMEN-PRODUCCION-READY.md`** - Resumen de funcionalidades

### Comandos Rápidos

```bash
# Reiniciar todo
pm2 restart all && sudo systemctl reload nginx

# Ver errores
pm2 logs --err

# Status completo
pm2 status && sudo systemctl status nginx

# Verificar SSL
openssl s_client -connect parsedemo.axiomacloud.com:443
```

---

## ✅ Checklist Final

- [ ] DNS configurado (A records para ambos dominios)
- [ ] Nginx instalado y funcionando
- [ ] Certificados SSL obtenidos
- [ ] Archivos nginx copiados y linkeados
- [ ] Variables de entorno configuradas (backend y frontend)
- [ ] Frontend compilado con URLs de producción
- [ ] PM2 ejecutando ambos servicios
- [ ] `https://parsedemo.axiomacloud.com` carga correctamente
- [ ] `https://api.parsedemo.axiomacloud.com/health` responde
- [ ] Test de login/upload de documento funciona
- [ ] Firewall configurado (puertos 80, 443)
- [ ] Renovación automática SSL configurada

---

## 🎉 URLs Finales

**Frontend:** https://parsedemo.axiomacloud.com

**Backend API:** https://api.parsedemo.axiomacloud.com

**Health Check:** https://api.parsedemo.axiomacloud.com/health

---

**Sistema listo para producción con SSL/HTTPS** ✅

**Última actualización:** Enero 2025
