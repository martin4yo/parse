# 🖥️ EJEMPLOS DE CONFIGURACIÓN POR SERVIDOR

## 📋 Contenido
1. [Configuración Completa Servidor Core](#servidor-1-core-admin)
2. [Configuración Completa Servidor Rendiciones](#servidor-2-rendiciones)
3. [Configuración Completa Servidor Inventario](#servidor-3-inventario-ejemplo)
4. [Variables de Entorno por Escenario](#variables-de-entorno)
5. [Scripts de Automatización](#scripts-de-automatización)

---

## 🎯 SERVIDOR 1: CORE ADMIN

### Datos del Servidor
```yaml
Hostname: core-admin
IP Privada: 192.168.1.10
IP Pública: 200.50.100.10
OS: Ubuntu 22.04 LTS
CPU: 4 cores
RAM: 8GB
Disco: 100GB SSD
```

### Estructura de Directorios
```
/opt/ecosystem/
├── apps/
│   └── core-admin/
│       ├── backend/
│       │   ├── src/
│       │   ├── prisma/
│       │   ├── .env
│       │   └── package.json
│       └── frontend/
│           ├── src/
│           ├── .env
│           └── package.json
├── packages/
│   ├── auth-core/
│   ├── tenant-admin/
│   ├── parametros/
│   └── ai-prompts/
└── infrastructure/
```

### Variables de Entorno

#### Backend Core
```env
# apps/core-admin/backend/.env

# Modo
NODE_ENV=production

# Servidor
PORT=5000
HOST=0.0.0.0

# Base de Datos
CORE_DATABASE_URL=postgresql://core_user:P@ssw0rd_Core_2024@localhost:5432/core_db

# Seguridad
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
JWT_EXPIRATION=24h
ENCRYPTION_KEY=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4321

# CORS
CORS_ORIGIN=http://admin.tuorg.com,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/ecosystem/core-backend.log

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@tuorg.com
SMTP_PASS=smtp_password_here

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://api.tuorg.com/api/auth/google/callback
```

#### Frontend Admin
```env
# apps/core-admin/frontend/.env

NODE_ENV=production
PORT=3000

# API URLs
NEXT_PUBLIC_API_URL=http://api.tuorg.com/api
NEXT_PUBLIC_WS_URL=ws://api.tuorg.com

# App Info
NEXT_PUBLIC_APP_NAME=Admin Panel
NEXT_PUBLIC_APP_VERSION=1.0.0

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
```

### PM2 Configuration
```javascript
// /opt/ecosystem/infrastructure/pm2/core-admin.config.js
module.exports = {
  apps: [
    {
      name: 'core-backend',
      script: './apps/core-admin/backend/src/index.js',
      cwd: '/opt/ecosystem',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/core-backend-error.log',
      out_file: '/var/log/pm2/core-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      // Auto-restart en caso de falla
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true
    },
    {
      name: 'admin-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/opt/ecosystem/apps/core-admin/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/admin-frontend-error.log',
      out_file: '/var/log/pm2/admin-frontend-out.log',
      time: true,
      autorestart: true
    }
  ]
};
```

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/core-admin

# Upstream para backend
upstream core_backend {
    least_conn;  # Balanceo por menor conexiones
    server localhost:5000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Upstream para frontend
upstream admin_frontend {
    server localhost:3000;
    keepalive 16;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

# Cache para assets estáticos
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static_cache:10m max_size=100m inactive=60m;

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name admin.tuorg.com api.tuorg.com;

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - Admin Frontend
server {
    listen 443 ssl http2;
    server_name admin.tuorg.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/admin.tuorg.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.tuorg.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Frontend
    location / {
        proxy_pass http://admin_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Next.js static files
    location /_next/static {
        proxy_pass http://admin_frontend;
        proxy_cache static_cache;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}

# HTTPS - API Gateway
server {
    listen 443 ssl http2;
    server_name api.tuorg.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/api.tuorg.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tuorg.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # CORS
    add_header Access-Control-Allow-Origin "https://admin.tuorg.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    add_header Access-Control-Max-Age 3600 always;

    # Preflight OPTIONS
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    # Core APIs (local)
    location /api/auth {
        limit_req zone=login_limit burst=5 nodelay;

        proxy_pass http://core_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # No cache para auth
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location /api/tenants {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    location /api/users {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    location /api/parametros {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    location /api/prompts {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    # Rendiciones APIs (remoto - Servidor 2)
    location /api/documentos {
        limit_req zone=api_limit burst=30 nodelay;

        proxy_pass http://192.168.1.20:5050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Timeouts más largos para upload de PDFs
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;

        # Retry en caso de error
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    location /api/rendiciones {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://192.168.1.20:5050;
        proxy_set_header Host $host;
    }

    location /api/tarjetas {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://192.168.1.20:5050;
        proxy_set_header Host $host;
    }

    # Inventario APIs (remoto - Servidor 3)
    location /api/productos {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://192.168.1.30:5060;
        proxy_set_header Host $host;
    }

    location /api/stock {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://192.168.1.30:5060;
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Metrics (solo desde red local)
    location /metrics {
        allow 192.168.1.0/24;
        deny all;

        proxy_pass http://core_backend/metrics;
    }
}
```

### PostgreSQL Configuration
```bash
# Configurar PostgreSQL para aceptar conexiones remotas

# 1. Editar postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Agregar/modificar:
listen_addresses = '*'
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10485kB
min_wal_size = 1GB
max_wal_size = 4GB

# 2. Editar pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Agregar líneas para permitir conexión desde otros servidores
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    core_db         core_user       192.168.1.0/24          md5
host    all             all             10.0.0.0/24             md5  # Red VPN

# 3. Reiniciar PostgreSQL
sudo systemctl restart postgresql

# 4. Crear usuario y base de datos
sudo -u postgres psql << EOF
CREATE DATABASE core_db;
CREATE USER core_user WITH PASSWORD 'P@ssw0rd_Core_2024';
GRANT ALL PRIVILEGES ON DATABASE core_db TO core_user;

-- Dar permisos al schema público
\c core_db
GRANT ALL ON SCHEMA public TO core_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO core_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO core_user;
EOF
```

### Script de Instalación Completo
```bash
#!/bin/bash
# scripts/install-servidor-1-core.sh

set -e  # Exit on error

echo "🚀 Instalando Servidor 1 (Core Admin)..."

# Variables
ECOSYSTEM_DIR="/opt/ecosystem"
DB_PASSWORD="P@ssw0rd_Core_2024"
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 1. Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependencias básicas
sudo apt install -y curl git build-essential

# 3. Instalar Node.js 20
echo "📦 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Instalar pnpm
npm install -g pnpm

# 5. Instalar PostgreSQL 15
echo "📦 Instalando PostgreSQL..."
sudo apt install -y postgresql-15 postgresql-contrib-15
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 6. Configurar PostgreSQL
echo "🔧 Configurando PostgreSQL..."
sudo -u postgres psql << EOF
CREATE DATABASE core_db;
CREATE USER core_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE core_db TO core_user;
\c core_db
GRANT ALL ON SCHEMA public TO core_user;
EOF

# Permitir conexiones remotas
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf
echo "host    all    all    192.168.1.0/24    md5" | sudo tee -a /etc/postgresql/15/main/pg_hba.conf
sudo systemctl restart postgresql

# 7. Instalar Nginx
echo "📦 Instalando Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 8. Instalar Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# 9. Instalar PM2
echo "📦 Instalando PM2..."
npm install -g pm2

# 10. Clonar repositorio
echo "📥 Clonando repositorio..."
sudo mkdir -p $ECOSYSTEM_DIR
sudo chown $USER:$USER $ECOSYSTEM_DIR
cd /opt
git clone https://github.com/tuorg/ecosystem.git
cd ecosystem

# 11. Instalar dependencias
echo "📦 Instalando dependencias del proyecto..."
pnpm install

# 12. Build paquetes compartidos
echo "🔨 Building paquetes compartidos..."
pnpm --filter "@tuorg/*" build

# 13. Configurar variables de entorno - Backend
echo "⚙️ Configurando variables de entorno..."
cat > apps/core-admin/backend/.env << EOF
NODE_ENV=production
PORT=5000
CORE_DATABASE_URL=postgresql://core_user:$DB_PASSWORD@localhost:5432/core_db
JWT_SECRET=$JWT_SECRET
JWT_EXPIRATION=24h
ENCRYPTION_KEY=$ENCRYPTION_KEY
CORS_ORIGIN=http://admin.tuorg.com,https://admin.tuorg.com
LOG_LEVEL=info
EOF

# 14. Configurar variables de entorno - Frontend
cat > apps/core-admin/frontend/.env << EOF
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://api.tuorg.com/api
NEXT_PUBLIC_APP_NAME=Admin Panel
EOF

# 15. Migrar base de datos
echo "🔄 Migrando base de datos..."
cd apps/core-admin/backend
npx prisma migrate deploy
npx prisma generate

# 16. Build aplicaciones
echo "🔨 Building aplicaciones..."
cd /opt/ecosystem
pnpm --filter core-admin-backend build
pnpm --filter core-admin-frontend build

# 17. Copiar configuración de Nginx
echo "⚙️ Configurando Nginx..."
sudo cp infrastructure/nginx/core-admin.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/core-admin.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 18. Crear directorios de logs
sudo mkdir -p /var/log/pm2
sudo mkdir -p /var/log/ecosystem
sudo chown $USER:$USER /var/log/pm2
sudo chown $USER:$USER /var/log/ecosystem

# 19. Iniciar aplicaciones con PM2
echo "🚀 Iniciando aplicaciones..."
pm2 start infrastructure/pm2/core-admin.config.js
pm2 save
pm2 startup

# 20. Configurar firewall
echo "🔒 Configurando firewall..."
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow from 192.168.1.0/24 to any port 5432  # PostgreSQL
sudo ufw --force enable

# 21. Obtener certificado SSL
echo "🔒 Obteniendo certificado SSL..."
sudo certbot --nginx -d admin.tuorg.com -d api.tuorg.com --non-interactive --agree-tos -m admin@tuorg.com

# 22. Verificar instalación
echo "✅ Verificando instalación..."
sleep 5
curl -f http://localhost:5000/health && echo "✅ Backend OK" || echo "❌ Backend ERROR"
curl -f http://localhost:3000 && echo "✅ Frontend OK" || echo "❌ Frontend ERROR"

echo ""
echo "════════════════════════════════════════════"
echo "✅ Servidor 1 (Core Admin) configurado correctamente"
echo "════════════════════════════════════════════"
echo ""
echo "📝 Información importante:"
echo "   Backend URL: http://localhost:5000"
echo "   Frontend URL: http://localhost:3000"
echo "   PostgreSQL: localhost:5432/core_db"
echo ""
echo "🔑 Credenciales guardadas en:"
echo "   - JWT_SECRET: $JWT_SECRET"
echo "   - ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo "   - DB_PASSWORD: $DB_PASSWORD"
echo ""
echo "📋 Comandos útiles:"
echo "   pm2 logs          # Ver logs"
echo "   pm2 restart all   # Reiniciar servicios"
echo "   pm2 status        # Ver estado"
echo ""
echo "🌐 URLs públicas (después de configurar DNS):"
echo "   Admin: https://admin.tuorg.com"
echo "   API: https://api.tuorg.com"
echo ""
```

---

## 🎯 SERVIDOR 2: RENDICIONES

### Datos del Servidor
```yaml
Hostname: rendiciones-app
IP Privada: 192.168.1.20
IP Pública: 200.50.100.20
OS: Ubuntu 22.04 LTS
CPU: 4 cores
RAM: 16GB  # Más RAM por procesamiento de PDFs
Disco: 200GB SSD
```

### Variables de Entorno

#### Backend Rendiciones
```env
# apps/rendiciones/backend/.env

NODE_ENV=production
PORT=5050

# Base de Datos Local
RENDICIONES_DATABASE_URL=postgresql://rendiciones_user:P@ssw0rd_Rend_2024@localhost:5433/rendiciones_db

# Conexión a Core (Servidor 1)
CORE_DATABASE_URL=postgresql://core_user:P@ssw0rd_Core_2024@192.168.1.10:5432/core_db
CORE_API_URL=http://192.168.1.10:5000

# Seguridad (MISMO que Servidor 1)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
ENCRYPTION_KEY=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4321

# IA - Procesamiento de Documentos
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8
OPENAI_API_KEY=sk-proj-xxx  # Opcional

# Document AI (futuro)
GOOGLE_APPLICATION_CREDENTIALS=/opt/ecosystem/credentials/document-ai.json
GCP_PROJECT_ID=tu-proyecto
DOCUMENT_AI_PROCESSOR_ID=xxx

# File Upload
MAX_FILE_SIZE=50MB
UPLOAD_DIR=/opt/ecosystem/data/uploads
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/ecosystem/rendiciones-backend.log

# CORS
CORS_ORIGIN=http://rendiciones.tuorg.com,https://rendiciones.tuorg.com
```

#### Frontend Rendiciones
```env
# apps/rendiciones/frontend/.env

NODE_ENV=production
PORT=8084

# API URLs
NEXT_PUBLIC_API_URL=https://rendiciones.tuorg.com/api
NEXT_PUBLIC_CORE_API_URL=https://api.tuorg.com/api

# App Info
NEXT_PUBLIC_APP_NAME=Rendiciones
NEXT_PUBLIC_APP_VERSION=1.0.0

# Features
NEXT_PUBLIC_ENABLE_DOCUMENT_AI=true
NEXT_PUBLIC_MAX_UPLOAD_SIZE=52428800  # 50MB en bytes
```

### PM2 Configuration
```javascript
// infrastructure/pm2/rendiciones.config.js
module.exports = {
  apps: [
    {
      name: 'rendiciones-backend',
      script: './apps/rendiciones/backend/src/index.js',
      cwd: '/opt/ecosystem',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '2G',  # Más memoria por PDFs
      env: {
        NODE_ENV: 'production',
        PORT: 5050
      },
      error_file: '/var/log/pm2/rendiciones-backend-error.log',
      out_file: '/var/log/pm2/rendiciones-backend-out.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'rendiciones-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/opt/ecosystem/apps/rendiciones/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8084
      },
      error_file: '/var/log/pm2/rendiciones-frontend-error.log',
      out_file: '/var/log/pm2/rendiciones-frontend-out.log',
      time: true
    }
  ]
};
```

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/rendiciones

upstream rendiciones_backend {
    server localhost:5050;
    keepalive 32;
}

upstream rendiciones_frontend {
    server localhost:8084;
    keepalive 16;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=rendiciones_api:10m rate=10r/s;

server {
    listen 80;
    server_name rendiciones.tuorg.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rendiciones.tuorg.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/rendiciones.tuorg.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rendiciones.tuorg.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Aumentar límite de upload para PDFs
    client_max_body_size 50M;
    client_body_timeout 120s;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Backend API
    location /api {
        limit_req zone=rendiciones_api burst=30 nodelay;

        proxy_pass http://rendiciones_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts más largos para procesamiento de PDFs
        proxy_connect_timeout 90s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;

        # Buffer para uploads grandes
        proxy_request_buffering off;
    }

    # Frontend
    location / {
        proxy_pass http://rendiciones_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://rendiciones_backend/health;
    }
}
```

### Script de Instalación
```bash
#!/bin/bash
# scripts/install-servidor-2-rendiciones.sh

set -e

echo "🚀 Instalando Servidor 2 (Rendiciones)..."

# Variables
ECOSYSTEM_DIR="/opt/ecosystem"
DB_PASSWORD="P@ssw0rd_Rend_2024"
CORE_DB_PASSWORD="P@ssw0rd_Core_2024"  # Del Servidor 1
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0"  # Del Servidor 1
ENCRYPTION_KEY="z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4321"  # Del Servidor 1

# 1-4. Instalar Node.js, pnpm (igual que Servidor 1)

# 5. Instalar PostgreSQL en puerto diferente
echo "📦 Instalando PostgreSQL..."
sudo apt install -y postgresql-15
sudo systemctl start postgresql

# Configurar PostgreSQL en puerto 5433
sudo sed -i "s/port = 5432/port = 5433/" /etc/postgresql/15/main/postgresql.conf
sudo systemctl restart postgresql

# 6. Crear base de datos
sudo -u postgres psql -p 5433 << EOF
CREATE DATABASE rendiciones_db;
CREATE USER rendiciones_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE rendiciones_db TO rendiciones_user;
\c rendiciones_db
GRANT ALL ON SCHEMA public TO rendiciones_user;
EOF

# 7. Instalar Nginx, PM2 (igual que Servidor 1)

# 8. Clonar repositorio
cd /opt
git clone https://github.com/tuorg/ecosystem.git
cd ecosystem
pnpm install
pnpm --filter "@tuorg/*" build

# 9. Configurar .env - Backend
cat > apps/rendiciones/backend/.env << EOF
NODE_ENV=production
PORT=5050
RENDICIONES_DATABASE_URL=postgresql://rendiciones_user:$DB_PASSWORD@localhost:5433/rendiciones_db
CORE_DATABASE_URL=postgresql://core_user:$CORE_DB_PASSWORD@192.168.1.10:5432/core_db
CORE_API_URL=http://192.168.1.10:5000
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8
MAX_FILE_SIZE=50MB
UPLOAD_DIR=/opt/ecosystem/data/uploads
LOG_LEVEL=info
EOF

# 10. Configurar .env - Frontend
cat > apps/rendiciones/frontend/.env << EOF
NODE_ENV=production
PORT=8084
NEXT_PUBLIC_API_URL=https://rendiciones.tuorg.com/api
NEXT_PUBLIC_CORE_API_URL=https://api.tuorg.com/api
EOF

# 11. Migrar BD
cd apps/rendiciones/backend
npx prisma migrate deploy

# 12. Build
cd /opt/ecosystem
pnpm --filter rendiciones-backend build
pnpm --filter rendiciones-frontend build

# 13. Crear directorio de uploads
sudo mkdir -p /opt/ecosystem/data/uploads
sudo chown $USER:$USER /opt/ecosystem/data/uploads

# 14. Configurar Nginx
sudo cp infrastructure/nginx/rendiciones.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/rendiciones.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 15. Iniciar con PM2
pm2 start infrastructure/pm2/rendiciones.config.js
pm2 save
pm2 startup

# 16. Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 17. SSL
sudo certbot --nginx -d rendiciones.tuorg.com --non-interactive --agree-tos -m admin@tuorg.com

# 18. Verificar
sleep 5
curl -f http://localhost:5050/health && echo "✅ Backend OK" || echo "❌ Backend ERROR"

echo "✅ Servidor 2 (Rendiciones) configurado correctamente"
```

---

## 🏪 SERVIDOR 3: INVENTARIO (Ejemplo)

### Variables de Entorno

```env
# apps/inventario/backend/.env
NODE_ENV=production
PORT=5060
INVENTARIO_DATABASE_URL=postgresql://inventario_user:P@ssw0rd_Inv_2024@localhost:5434/inventario_db
CORE_DATABASE_URL=postgresql://core_user:P@ssw0rd_Core_2024@192.168.1.10:5432/core_db
CORE_API_URL=http://192.168.1.10:5000
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

---

## 🔑 RESUMEN DE VARIABLES DE ENTORNO

### Variables Compartidas (DEBEN SER IGUALES en todos los servidores)
```env
# Seguridad
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
ENCRYPTION_KEY=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4321
JWT_EXPIRATION=24h
```

### Variables Específicas por Servidor

| Variable | Servidor 1 | Servidor 2 | Servidor 3 |
|----------|-----------|-----------|-----------|
| PORT (Backend) | 5000 | 5050 | 5060 |
| PORT (Frontend) | 3000 | 8084 | 8085 |
| DATABASE_URL | localhost:5432/core_db | localhost:5433/rendiciones_db | localhost:5434/inventario_db |
| CORE_API_URL | - | http://192.168.1.10:5000 | http://192.168.1.10:5000 |

---

## 🤖 Scripts de Automatización

### Script para Generar Secrets
```bash
#!/bin/bash
# scripts/generate-secrets.sh

echo "🔑 Generando secrets..."

JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat > .secrets << EOF
# ⚠️ IMPORTANTE: Copiar estos valores a TODOS los servidores

# Seguridad (compartido)
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Base de Datos (generar password diferente por servidor)
CORE_DB_PASSWORD=$(openssl rand -base64 24)
RENDICIONES_DB_PASSWORD=$(openssl rand -base64 24)
INVENTARIO_DB_PASSWORD=$(openssl rand -base64 24)
EOF

echo "✅ Secrets guardados en .secrets"
echo "⚠️ RECORDAR: Usar el mismo JWT_SECRET y ENCRYPTION_KEY en todos los servidores"
```

### Script de Health Check Multi-Servidor
```bash
#!/bin/bash
# scripts/health-check-all.sh

SERVERS=(
  "https://api.tuorg.com/health|Core API"
  "https://admin.tuorg.com|Admin Frontend"
  "https://rendiciones.tuorg.com/api/health|Rendiciones API"
  "https://rendiciones.tuorg.com|Rendiciones Frontend"
  "https://inventario.tuorg.com/api/health|Inventario API"
)

echo "🏥 Health Check de todos los servidores..."
echo ""

for server in "${SERVERS[@]}"; do
  IFS='|' read -r url name <<< "$server"

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)

  if [ "$response" == "200" ]; then
    echo "✅ $name: OK"
  else
    echo "❌ $name: DOWN (HTTP $response)"

    # Enviar alerta a Slack
    curl -X POST https://hooks.slack.com/services/YOUR_WEBHOOK \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"⚠️ $name está caído (HTTP $response)\"}" \
      2>/dev/null
  fi
done

echo ""
echo "Health check completado."
```

### Script de Deployment Automatizado
```bash
#!/bin/bash
# scripts/deploy-to-server.sh <app> <server>

APP=$1
SERVER=$2

if [ -z "$APP" ] || [ -z "$SERVER" ]; then
  echo "Uso: ./deploy-to-server.sh <app> <servidor>"
  echo "Ejemplo: ./deploy-to-server.sh rendiciones user@192.168.1.20"
  exit 1
fi

echo "🚀 Deploying $APP a $SERVER..."

# 1. Build local
echo "📦 Building aplicación..."
pnpm --filter "$APP-backend" build
pnpm --filter "$APP-frontend" build

# 2. Crear tarball
echo "📦 Creando paquete..."
tar -czf "$APP-deploy.tar.gz" \
  apps/$APP/backend/dist \
  apps/$APP/frontend/.next \
  packages \
  package.json \
  pnpm-workspace.yaml

# 3. Copiar a servidor
echo "📤 Copiando a servidor..."
scp "$APP-deploy.tar.gz" "$SERVER:/tmp/"

# 4. Desplegar en servidor
echo "🔧 Desplegando en servidor..."
ssh "$SERVER" << EOF
  cd /opt/ecosystem

  # Backup actual
  tar -czf "/tmp/backup-$APP-\$(date +%Y%m%d-%H%M%S).tar.gz" apps/$APP

  # Extraer nuevo deploy
  tar -xzf /tmp/$APP-deploy.tar.gz

  # Reinstalar dependencias
  pnpm install --prod

  # Migrar BD
  cd apps/$APP/backend
  npx prisma migrate deploy

  # Reiniciar servicios
  pm2 restart $APP-backend
  pm2 restart $APP-frontend

  # Limpiar
  rm /tmp/$APP-deploy.tar.gz

  echo "✅ Deploy completado"
EOF

echo "✅ Deployment exitoso"
```

---

**Última actualización:** 2025-10-23
**Versión:** 1.0.0
