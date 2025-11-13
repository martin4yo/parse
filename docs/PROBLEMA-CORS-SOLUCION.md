# Solución al Error de CORS

## Error Actual

```
Access to fetch at 'http://149.50.148.198:5050/api/auth/login'
from origin 'http://rendicionesapp.axiomacloud.com'
has been blocked by CORS policy
```

## Causa

El backend solo permite peticiones CORS desde:
- `http://localhost:*` (varios puertos)
- `http://149.50.148.198:8084`

Pero el frontend está en:
- `http://rendicionesapp.axiomacloud.com` ❌ (NO permitido)

## Solución Aplicada

### 1. Código actualizado (backend/src/index.js)

Se agregaron los dominios al array de CORS:

```javascript
app.use(cors({
  origin: [
    // ... otros orígenes
    'http://149.50.148.198:8084',
    'http://rendicionesapp.axiomacloud.com',   // ✅ NUEVO
    'https://rendicionesapp.axiomacloud.com'   // ✅ NUEVO (para SSL)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
```

## Aplicar en el Servidor

### Opción 1: Script Automático (RECOMENDADO)

```bash
cd /opt/rendiciones

# Pull cambios y aplicar configuración
chmod +x fix-cors-domain.sh
./fix-cors-domain.sh
```

### Opción 2: Manual

```bash
cd /opt/rendiciones

# 1. Detener servicios
pm2 stop all

# 2. Pull cambios
git stash
git pull origin master

# 3. Reiniciar backend (para que tome el nuevo código CORS)
pm2 restart rendiciones-backend

# 4. Esperar y verificar
sleep 3
pm2 logs rendiciones-backend --lines 20
```

## Verificar que Funciona

1. **Ver logs del backend:**
   ```bash
   pm2 logs rendiciones-backend --lines 50
   ```

2. **Acceder al frontend:**
   ```
   http://rendicionesapp.axiomacloud.com
   ```

3. **Intentar hacer login**
   - Deberías poder ver las peticiones llegando al backend
   - NO debería haber más errores de CORS

## Detalles Técnicos

### ¿Por qué pasa esto?

1. El frontend accede desde un dominio: `http://rendicionesapp.axiomacloud.com`
2. Hace peticiones a: `http://149.50.148.198:5050/api/...` (diferente origen)
3. El navegador verifica CORS antes de enviar la petición
4. Si el backend no tiene configurado ese origen → error CORS

### Flujo de la petición

```
Browser en rendicionesapp.axiomacloud.com
  ↓
  1. Preflight request (OPTIONS)
     → Backend verifica si el origen está permitido
     → Si NO está: ❌ Error CORS
     → Si está: ✅ Responde con headers CORS
  ↓
  2. Petición real (POST /api/auth/login)
     → Backend procesa la petición
     → Responde con datos + headers CORS
```

## Troubleshooting

### Error persiste después de aplicar cambios

```bash
# Verificar que el código se actualizó
cd /opt/rendiciones
grep -n "rendicionesapp.axiomacloud.com" backend/src/index.js

# Debería mostrar las líneas 99-100 con el dominio
```

### Backend no reinició correctamente

```bash
# Ver logs
pm2 logs rendiciones-backend --lines 50

# Si hay error, reiniciar manualmente
pm2 restart rendiciones-backend
```

### Todavía dice CORS error

Verificar en el navegador (F12 → Network):
1. ¿Qué origin está enviando? (debería ser `http://rendicionesapp.axiomacloud.com`)
2. ¿Qué responde el backend en los headers? (buscar `Access-Control-Allow-Origin`)

Si el header `Access-Control-Allow-Origin` no está presente, el backend NO se reinició correctamente.

## Configuración Final

Una vez funcionando:

- **Frontend**: `http://rendicionesapp.axiomacloud.com` o `http://rendicionesdemo.axiomacloud.com`
- **Backend**: `http://149.50.148.198:5050`
- **CORS**: Permite los siguientes dominios:
  - ✅ `http://rendicionesapp.axiomacloud.com`
  - ✅ `https://rendicionesapp.axiomacloud.com`
  - ✅ `http://rendicionesdemo.axiomacloud.com`
  - ✅ `https://rendicionesdemo.axiomacloud.com`
  - ✅ `http://149.50.148.198:8084`

## Próximos Pasos (Opcional)

### Configurar SSL (HTTPS)

Si quieres usar HTTPS:

```bash
# Instalar certbot (ya debería estar)
sudo apt-get install certbot

# Obtener certificado
sudo certbot certonly --standalone -d rendicionesapp.axiomacloud.com

# Configurar Nginx para HTTPS (ver documentación)
```

Luego actualizar:
- Backend: CORS para `https://rendicionesapp.axiomacloud.com` ✅ (ya está)
- Frontend: `NEXT_PUBLIC_API_URL=https://...` (si la API también tiene SSL)
