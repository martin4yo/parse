# Instalación en Ubuntu 22.04

## Requisitos Previos

- Ubuntu 22.04 limpio
- Acceso root o sudo
- Conexión a internet

## Configuración Actual

- **Servidor**: 66.97.45.210 / rendicionesapp.axiomacloud.com
- **Puerto Backend**: 5050
- **Puerto Frontend**: 8084
- **Base de Datos**: PostgreSQL
  - Usuario: postgres
  - Password: Q27G4B98
  - Database: rendiciones_db

## Pasos de Instalación

### 1. Descargar el script

```bash
# Clonar repositorio (o descargar install-ubuntu.sh)
git clone <URL_REPO> /tmp/rendiciones-setup
cd /tmp/rendiciones-setup
```

### 2. Configurar URL del repositorio

Editar `install-ubuntu.sh` y cambiar:
```bash
REPO_URL="https://github.com/tu-usuario/rendiciones.git"
```

Por la URL real de tu repositorio.

### 3. Ejecutar instalación

```bash
chmod +x install-ubuntu.sh
./install-ubuntu.sh
```

**Si la instalación falla en el paso de npm install:**

```bash
chmod +x fix-install.sh
./fix-install.sh
```

El script instalará:
- Node.js 20 LTS
- PostgreSQL
- PM2 (process manager)
- Nginx
- Dependencias del proyecto
- Configurará la base de datos
- Compilará la aplicación
- Iniciará los servicios con PM2

## Post-Instalación

### Verificar servicios

```bash
pm2 status
```

Deberías ver:
- `rendiciones-backend` - corriendo en puerto 5050
- `rendiciones-frontend` - corriendo en puerto 8080

### Ver logs

```bash
# Logs de todos los servicios
pm2 logs

# Logs solo del backend
pm2 logs rendiciones-backend

# Logs solo del frontend
pm2 logs rendiciones-frontend
```

### Acceder a la aplicación

- Frontend (producción): http://rendicionesapp.axiomacloud.com
- Frontend (demo): http://rendicionesdemo.axiomacloud.com
- Frontend (IP): http://66.97.45.210:8084
- Backend API: http://66.97.45.210:5050/api

## Gestión de Servicios

```bash
# Reiniciar todo
pm2 restart all

# Reiniciar solo backend
pm2 restart rendiciones-backend

# Reiniciar solo frontend
pm2 restart rendiciones-frontend

# Detener todo
pm2 stop all

# Ver consumo de recursos
pm2 monit
```

## Actualizar la Aplicación

```bash
cd /opt/rendiciones

# Detener servicios
pm2 stop all

# Actualizar código
git pull

# Reinstalar dependencias
npm install

# Regenerar Prisma
cd backend
npx prisma generate
npx prisma db push
cd ..

# Recompilar frontend
npm run build:web

# Reiniciar servicios
pm2 restart all
```

## Firewall

Si necesitas configurar firewall:

```bash
# Permitir puertos
sudo ufw allow 5050/tcp
sudo ufw allow 8084/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## Troubleshooting

### Error: Cannot read properties of null (reading 'useContext')

Este es un conflicto de versiones de React. Ocurre cuando hay dos copias de React instaladas.

**Solución automática (recomendada):**
```bash
cd /opt/rendiciones
chmod +x quick-fix.sh
./quick-fix.sh
```

**Diagnóstico manual:**
```bash
cd /opt/rendiciones
chmod +x check-react-versions.sh
./check-react-versions.sh
```

Ver `REACT-CONFLICT-FIX.md` para más detalles técnicos.

### Error: napi-postinstall not found

Si obtienes errores durante `npm install` sobre `napi-postinstall` o problemas con `@prisma/engines`:

```bash
cd /opt/rendiciones
chmod +x fix-install.sh
./fix-install.sh
```

Este script:
1. Limpia todos los node_modules
2. Actualiza npm a la última versión
3. Reinstala dependencias con `--legacy-peer-deps`
4. Regenera Prisma
5. Compila el frontend

### Backend no inicia

```bash
# Ver logs
pm2 logs rendiciones-backend

# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar conexión a DB
cd /opt/rendiciones/backend
npx prisma db push
```

### Frontend no compila

```bash
# Limpiar y reinstalar
cd /opt/rendiciones
rm -rf packages/web/.next
rm -rf node_modules
npm install
npm run build:web
pm2 restart rendiciones-frontend
```

### Problemas de memoria

```bash
# Aumentar límite de memoria en ecosystem.config.js
# Cambiar max_memory_restart de '1G' a '2G'
pm2 restart all
```
