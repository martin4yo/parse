# Configuración de FRONTEND_URL - Guía Completa

## 🚨 Problema Común: Enlaces de Verificación Rotos

### Síntomas
- Los usuarios reciben emails de verificación de cuenta
- Al hacer clic en el enlace del email, aparece error o no funciona
- El enlace tiene una IP diferente al dominio desde donde se envió el email
- Errores de cookies o CORS en el navegador

### Causa
La variable de entorno `FRONTEND_URL` no coincide con la URL que los usuarios usan para acceder a la aplicación.

## 📍 ¿Qué es FRONTEND_URL?

`FRONTEND_URL` se usa en el backend para:
1. **Emails de verificación** (`/auth/verify-email?token=...`)
2. **Emails de notificación** (enlaces directos a rendiciones)
3. **Configuración de CORS** (permitir requests desde el frontend)
4. **OAuth callbacks** (Google login, etc.)

## ✅ Regla de Oro

> **FRONTEND_URL DEBE SER EXACTAMENTE LA URL QUE LOS USUARIOS ESCRIBEN EN SU NAVEGADOR**

## 🔍 Diagnóstico: ¿Qué URL usar?

### Paso 1: Identifica cómo acceden los usuarios

Pregunta a un usuario: "¿Qué escribes en el navegador para acceder a la app?"

#### Caso A: Usan un dominio
```
Usuario escribe: https://rendiciones.miempresa.com
→ FRONTEND_URL debe ser: "https://rendiciones.miempresa.com"
```

#### Caso B: Usan IP con puerto
```
Usuario escribe: http://149.50.148.198:8084
→ FRONTEND_URL debe ser: "http://149.50.148.198:8084"
```

#### Caso C: Desarrollo local
```
Usuario escribe: http://localhost:3000
→ FRONTEND_URL debe ser: "http://localhost:3000"
```

### Paso 2: Verifica la configuración actual

Conéctate al servidor y revisa el archivo `.env`:

```bash
ssh root@tu-servidor
cd /var/www/Rendiciones/backend
cat .env | grep FRONTEND_URL
```

### Paso 3: Compara y corrige

Si `FRONTEND_URL` NO coincide con lo que escriben los usuarios → **HAY QUE CORREGIRLO**

## 🛠️ Solución: Configurar Correctamente

### Configuración en Producción

#### Si tienes dominio (RECOMENDADO)

```bash
# Editar archivo .env en el servidor
ssh root@tu-servidor
cd /var/www/Rendiciones/backend
nano .env
```

Cambiar:
```env
# ❌ INCORRECTO (si los usuarios usan dominio)
FRONTEND_URL="http://149.50.148.198:8084"

# ✅ CORRECTO
FRONTEND_URL="https://rendiciones.miempresa.com"
```

#### Si solo tienes IP

```env
# ✅ CORRECTO (si los usuarios acceden por IP)
FRONTEND_URL="http://149.50.148.198:8084"
```

### Reiniciar Servicios

Después de cambiar `.env`, DEBES reiniciar el backend:

```bash
pm2 restart rendiciones-backend
```

### Verificar el cambio

```bash
pm2 logs rendiciones-backend --lines 50 | grep CORS
# Debería mostrar:
# 🔗 CORS enabled for: https://tu-dominio-correcto.com
```

## 🧪 Prueba de Verificación

1. **Registra un usuario de prueba** con un email real
2. **Revisa el email** que recibe
3. **Inspecciona el enlace** de verificación:
   ```
   ✅ CORRECTO: https://tu-dominio.com/auth/verify-email?token=...
   ❌ INCORRECTO: http://192.168.1.100:3000/auth/verify-email?token=...
   ```
4. **Haz clic en el enlace** y verifica que funcione

## 🔧 Configurar Dominio (Recomendado)

Si actualmente usas IP y quieres configurar un dominio:

### Opción 1: Con Nginx (Tu Configuración Actual)

Tu archivo nginx (`/etc/nginx/sites-available/rendiciones`) ya está configurado.
Solo necesitas:

1. **Comprar/configurar un dominio** (ej: `rendiciones.miempresa.com`)
2. **Apuntar el dominio** a tu IP `149.50.148.198`
3. **Actualizar nginx**:
   ```nginx
   server {
       listen 80;
       server_name rendiciones.miempresa.com;  # Cambiar esto
       # ... resto de la config
   }
   ```
4. **Configurar SSL** (HTTPS) con Let's Encrypt:
   ```bash
   apt install certbot python3-certbot-nginx
   certbot --nginx -d rendiciones.miempresa.com
   ```
5. **Actualizar FRONTEND_URL** en `.env`
6. **Reiniciar servicios**

### Opción 2: Sin dominio (Solo IP)

Si no puedes configurar un dominio, asegúrate de que:
- `FRONTEND_URL` use la IP completa con puerto
- Los usuarios siempre accedan por esa misma IP
- No uses HTTPS (las cookies `secure` fallarán)

## 📋 Checklist Final

Antes de dar por resuelto el problema:

- [ ] `FRONTEND_URL` coincide con lo que escriben los usuarios en el navegador
- [ ] Reiniciaste el backend con `pm2 restart`
- [ ] Verificaste los logs de CORS
- [ ] Enviaste un email de prueba y el enlace funciona
- [ ] No hay errores de cookies en el navegador (F12 → Console)
- [ ] Si usas HTTPS, el certificado es válido

## 🆘 Solución de Problemas

### Error: "Failed to fetch" en el navegador
**Causa**: CORS no está permitiendo la URL del frontend
**Solución**: Verifica `FRONTEND_URL` y reinicia backend

### Error: "Cookies blocked"
**Causa**: Usas HTTPS en frontend pero HTTP en backend (o viceversa)
**Solución**: Ambos deben usar el mismo protocolo (HTTP o HTTPS)

### Error: "Token inválido o expirado"
**Causa**: El token de verificación expiró (24 horas)
**Solución**: Reenviar email de verificación desde la app

### Email no llega
**Causa**: Configuración SMTP incorrecta
**Solución**: Verifica `SMTP_USER`, `SMTP_PASS` en `.env`

## 📚 Archivos Relacionados

- `backend/.env` - Configuración de variables de entorno
- `backend/src/services/emailService.js:148` - Construcción de URL de verificación
- `backend/src/index.js:96` - Configuración de CORS
- `backend/src/routes/auth.js:775,788,795` - OAuth callbacks
- `DEPLOYMENT.md` - Guía de despliegue completa

## 💡 Mejores Prácticas

1. **Usa dominio** en lugar de IP para producción
2. **Habilita HTTPS** con Let's Encrypt (gratis)
3. **Documenta** la URL de producción en `DEPLOYMENT.md`
4. **Prueba** emails después de cada cambio de configuración
5. **Monitorea** logs de CORS: `pm2 logs rendiciones-backend | grep CORS`

---

**Última actualización**: Octubre 2025
**Autor**: Equipo Axioma - Rendiciones
