# Configuración Nginx + SSL para Parse

## 📋 Dominios Configurados

| Servicio | Dominio | Puerto Local |
|----------|---------|--------------|
| **Frontend** | `https://parsedemo.axiomacloud.com` | 8087 |
| **Backend API** | `https://api.parsedemo.axiomacloud.com` | 5100 |

---

## 🚀 Instalación Paso a Paso

### PASO 1: Instalar Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y

# Verificar instalación
nginx -v

# Iniciar y habilitar Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

### PASO 2: Configurar DNS

**Antes de continuar**, asegúrate de que los dominios apuntan al servidor:

```bash
# Verificar DNS
nslookup parsedemo.axiomacloud.com
nslookup api.parsedemo.axiomacloud.com
```

Ambos deben apuntar a la IP de tu servidor.

**En tu proveedor DNS (ej: Cloudflare, GoDaddy, etc.):**

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | parsedemo | IP_DEL_SERVIDOR | 3600 |
| A | api.parsedemo | IP_DEL_SERVIDOR | 3600 |

### PASO 3: Instalar Certbot (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Verificar instalación
certbot --version
```

### PASO 4: Obtener Certificados SSL

```bash
# Certificado para el frontend
sudo certbot certonly --nginx -d parsedemo.axiomacloud.com

# Certificado para el backend
sudo certbot certonly --nginx -d api.parsedemo.axiomacloud.com

# Seguir las instrucciones:
# 1. Ingresar email para notificaciones
# 2. Aceptar términos de servicio
# 3. Opcional: compartir email con EFF
```

Los certificados se guardarán en:
- Frontend: `/etc/letsencrypt/live/parsedemo.axiomacloud.com/`
- Backend: `/etc/letsencrypt/live/api.parsedemo.axiomacloud.com/`

### PASO 5: Copiar Configuraciones de Nginx

```bash
# Ir al directorio del proyecto
cd /ruta/a/parse

# Copiar configuración del frontend
sudo cp nginx-parse-frontend.conf /etc/nginx/sites-available/parse-frontend

# Copiar configuración del backend
sudo cp nginx-parse-backend.conf /etc/nginx/sites-available/parse-backend

# Crear enlaces simbólicos
sudo ln -s /etc/nginx/sites-available/parse-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/parse-backend /etc/nginx/sites-enabled/

# Opcional: Eliminar sitio por defecto
sudo rm /etc/nginx/sites-enabled/default
```

### PASO 6: Verificar Configuración

```bash
# Test de configuración de Nginx
sudo nginx -t

# Debe mostrar:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### PASO 7: Recargar Nginx

```bash
# Recargar configuración
sudo systemctl reload nginx

# O reiniciar completamente
sudo systemctl restart nginx

# Verificar estado
sudo systemctl status nginx
```

### PASO 8: Configurar Variables de Entorno

**Backend `.env`:**
```bash
cd /ruta/a/parse/backend
nano .env
```

Actualizar:
```env
PORT=5100
NODE_ENV=production
BASE_URL=https://api.parsedemo.axiomacloud.com
FRONTEND_URL=https://parsedemo.axiomacloud.com
DATABASE_URL=postgresql://...
JWT_SECRET=tu-secret-super-seguro
```

**Frontend `.env`:**
```bash
cd /ruta/a/parse/frontend
nano .env
```

Actualizar:
```env
NEXT_PUBLIC_API_URL=https://api.parsedemo.axiomacloud.com
```

### PASO 9: Recompilar y Desplegar

```bash
# Desde la raíz del proyecto
cd /ruta/a/parse

# Opción A: Script automatizado
bash DEPLOY-COMMAND.sh

# Opción B: Manual
cd frontend
npm run build
cd ..
pm2 restart parse-frontend
pm2 restart parse-backend
```

### PASO 10: Verificar Funcionamiento

```bash
# Backend API
curl https://api.parsedemo.axiomacloud.com/health
# Debe retornar: {"status":"ok"}

# Frontend
curl -I https://parsedemo.axiomacloud.com
# Debe retornar: HTTP/2 200

# Verificar SSL
openssl s_client -connect parsedemo.axiomacloud.com:443 -servername parsedemo.axiomacloud.com
openssl s_client -connect api.parsedemo.axiomacloud.com:443 -servername api.parsedemo.axiomacloud.com
```

---

## 🔄 Renovación Automática de Certificados

Let's Encrypt expira cada 90 días. Certbot configura auto-renovación:

```bash
# Verificar timer de renovación
sudo systemctl status certbot.timer

# Test de renovación (dry-run)
sudo certbot renew --dry-run

# Si no está configurado, agregarlo al cron
sudo crontab -e

# Agregar esta línea para renovar cada día a las 3 AM
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## 🔧 Comandos Útiles

```bash
# Ver logs de Nginx
sudo tail -f /var/log/nginx/parse-frontend-access.log
sudo tail -f /var/log/nginx/parse-backend-access.log
sudo tail -f /var/log/nginx/parse-frontend-error.log
sudo tail -f /var/log/nginx/parse-backend-error.log

# Ver logs en tiempo real
sudo journalctl -u nginx -f

# Recargar configuración sin downtime
sudo nginx -s reload

# Reiniciar Nginx
sudo systemctl restart nginx

# Verificar certificados SSL
sudo certbot certificates

# Renovar certificados manualmente
sudo certbot renew
sudo systemctl reload nginx
```

---

## 🔥 Configuración de Firewall

```bash
# Ubuntu UFW
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status

# O con iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

---

## 🐛 Troubleshooting

### Error: "502 Bad Gateway"

**Causa:** Backend no está corriendo o no responde en el puerto correcto

**Solución:**
```bash
# Verificar backend
pm2 status
pm2 logs parse-backend

# Verificar puerto
netstat -tulpn | grep 5100
netstat -tulpn | grep 8087

# Reiniciar servicios
pm2 restart all
```

### Error: "Certificate verification failed"

**Causa:** Certificado SSL no está configurado correctamente

**Solución:**
```bash
# Obtener nuevo certificado
sudo certbot certonly --nginx -d parsedemo.axiomacloud.com --force-renew

# Verificar paths en nginx config
sudo nano /etc/nginx/sites-available/parse-frontend

# Recargar nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Error: "Connection refused"

**Causa:** Nginx no está corriendo o puertos bloqueados

**Solución:**
```bash
# Verificar Nginx
sudo systemctl status nginx
sudo systemctl start nginx

# Verificar firewall
sudo ufw status
sudo ufw allow 'Nginx Full'

# Verificar logs
sudo tail -f /var/log/nginx/error.log
```

### Error: "CORS error" en el navegador

**Causa:** Backend no permite el dominio del frontend

**Solución:**
```bash
# Verificar FRONTEND_URL en backend/.env
cat backend/.env | grep FRONTEND_URL

# Debe ser:
FRONTEND_URL=https://parsedemo.axiomacloud.com

# Reiniciar backend
pm2 restart parse-backend
```

---

## 📊 Monitoreo

```bash
# Status general
sudo systemctl status nginx
pm2 status

# Conexiones activas
sudo netstat -an | grep :443 | grep ESTABLISHED | wc -l

# Uso de recursos
pm2 monit

# Logs en tiempo real
sudo tail -f /var/log/nginx/*.log

# Verificar SSL grade
# Usar: https://www.ssllabs.com/ssltest/
```

---

## 🔐 Mejoras de Seguridad Opcionales

### 1. Rate Limiting

Editar `/etc/nginx/nginx.conf` y agregar en el bloque `http`:

```nginx
http {
    # ...

    # Limit requests
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_status 429;
}
```

Luego en el server block del backend:
```nginx
location / {
    limit_req zone=api_limit burst=20 nodelay;
    # ... resto de la config
}
```

### 2. Fail2Ban

```bash
sudo apt install fail2ban -y

# Configurar para Nginx
sudo nano /etc/fail2ban/jail.local
```

Agregar:
```ini
[nginx-http-auth]
enabled = true
port = http,https

[nginx-noscript]
enabled = true
```

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

### 3. ModSecurity (WAF)

```bash
sudo apt install libapache2-mod-security2 -y

# Configurar reglas OWASP
sudo git clone https://github.com/coreruleset/coreruleset /etc/nginx/modsec-crs
```

---

## 📝 Checklist Final

- [ ] DNS configurado (A records para ambos dominios)
- [ ] Nginx instalado y corriendo
- [ ] Certificados SSL obtenidos con Certbot
- [ ] Archivos de configuración copiados a `/etc/nginx/sites-available/`
- [ ] Enlaces simbólicos creados en `/etc/nginx/sites-enabled/`
- [ ] `nginx -t` pasa sin errores
- [ ] Variables de entorno actualizadas (backend y frontend)
- [ ] Frontend recompilado con `npm run build`
- [ ] PM2 corriendo ambos servicios
- [ ] `https://parsedemo.axiomacloud.com` carga correctamente
- [ ] `https://api.parsedemo.axiomacloud.com/health` responde
- [ ] Firewall configurado (puertos 80, 443 abiertos)
- [ ] Renovación automática de SSL configurada

---

## 🌐 URLs Finales

**Frontend:** https://parsedemo.axiomacloud.com
**Backend:** https://api.parsedemo.axiomacloud.com
**Health Check:** https://api.parsedemo.axiomacloud.com/health

---

**Última actualización:** Enero 2025
