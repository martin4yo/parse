# Configuración de Puertos - Parse

## 📋 Puertos Configurados

| Servicio | Puerto Local | Dominio Público | Archivo de Configuración |
|----------|--------------|-----------------|--------------------------|
| Backend API | **5100** | https://api.parsedemo.axiomacloud.com | `backend/.env` |
| Frontend Producción | **8087** | https://parsedemo.axiomacloud.com | `ecosystem.config.js` |
| Frontend Desarrollo | **3000** | http://localhost:3000 | Por defecto Next.js |

**Nota:** Nginx actúa como reverse proxy en puerto 443 (HTTPS) y redirige a los puertos locales.

---

## 🔧 Cómo Cambiar los Puertos

### Backend (Puerto 5100)

**Archivo:** `backend/.env`

```env
# Cambiar este valor
PORT=5100
```

Luego reiniciar el backend:
```bash
pm2 restart parse-backend
```

### Frontend Producción (Puerto 8087)

**Archivo:** `ecosystem.config.js`

```javascript
{
  name: 'parse-frontend',
  args: 'start -p 8087',  // ← Cambiar este puerto
  // ...
}
```

Luego reiniciar el frontend:
```bash
pm2 restart parse-frontend
```

### URL del Backend en Frontend

**Archivo:** `frontend/.env`

```env
# Debe apuntar al puerto del backend
NEXT_PUBLIC_API_URL=http://localhost:5100
```

**⚠️ IMPORTANTE:** Si cambias el puerto del backend, debes actualizar esta variable y recompilar el frontend:

```bash
cd frontend
npm run build
pm2 restart parse-frontend
```

---

## 🚀 Deployment

Al desplegar con `bash DEPLOY-COMMAND.sh`, el script:

1. ✅ Lee `PORT` del `backend/.env` (o usa 5100 por defecto)
2. ✅ Lee `NEXT_PUBLIC_API_URL` del `frontend/.env`
3. ✅ Compila el frontend con la URL correcta del backend
4. ✅ Inicia ambos servicios con PM2

---

## 🔍 Verificar Configuración

```bash
# Backend - debería responder en puerto 5100
curl http://localhost:5100/health

# Frontend - debería responder en puerto 8087
curl http://localhost:8087

# Ver qué puertos están escuchando
pm2 describe parse-backend | grep "PORT"
netstat -an | grep -E "5100|8087"
```

---

## 🌐 Producción con Dominio

Si usas un dominio en producción:

### Backend `.env`
```env
PORT=5100
BASE_URL=https://api.tu-dominio.com
FRONTEND_URL=https://app.tu-dominio.com
```

### Frontend `.env`
```env
NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
```

### Nginx Reverse Proxy (Ejemplo)
```nginx
# Backend
server {
    listen 80;
    server_name api.tu-dominio.com;

    location / {
        proxy_pass http://localhost:5100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Frontend
server {
    listen 80;
    server_name app.tu-dominio.com;

    location / {
        proxy_pass http://localhost:8087;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🐛 Troubleshooting

### Error: "Port already in use"

```bash
# Ver qué proceso está usando el puerto
lsof -i :5100
lsof -i :8087

# Matar el proceso (reemplazar PID)
kill -9 <PID>

# O reiniciar con PM2
pm2 restart parse-backend
pm2 restart parse-frontend
```

### Error: "Failed to fetch" en el frontend

1. Verificar que backend está corriendo:
   ```bash
   pm2 logs parse-backend
   curl http://localhost:5100/health
   ```

2. Verificar la variable de entorno en frontend:
   ```bash
   cat frontend/.env | grep NEXT_PUBLIC_API_URL
   ```

3. Si cambió, recompilar frontend:
   ```bash
   cd frontend
   npm run build
   pm2 restart parse-frontend
   ```

---

## 📝 Checklist Pre-Deploy

- [ ] `backend/.env` tiene `PORT=5100` configurado
- [ ] `frontend/.env` tiene `NEXT_PUBLIC_API_URL=http://localhost:5100`
- [ ] `ecosystem.config.js` tiene frontend en `-p 8087`
- [ ] Ejecutar `bash DEPLOY-COMMAND.sh`
- [ ] Verificar ambos servicios responden

---

**Última actualización:** Enero 2025
