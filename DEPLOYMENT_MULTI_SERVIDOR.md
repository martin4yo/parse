# 🌐 DEPLOYMENT MULTI-SERVIDOR - ARQUITECTURA DISTRIBUIDA

## 📋 Tabla de Contenidos
1. [Arquitectura Distribuida](#arquitectura-distribuida)
2. [Topologías de Deployment](#topologías-de-deployment)
3. [Comunicación entre Servidores](#comunicación-entre-servidores)
4. [Configuración por Servidor](#configuración-por-servidor)
5. [Seguridad y Networking](#seguridad-y-networking)
6. [Monitoreo y Logs](#monitoreo-y-logs)
7. [Scripts de Deployment](#scripts-de-deployment)
8. [Casos de Uso](#casos-de-uso)

---

## 🏗️ Arquitectura Distribuida

### Concepto Principal

**SÍ, puedes tener cada aplicación en un servidor diferente:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    [Load Balancer]
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  SERVIDOR 1   │ │  SERVIDOR 2   │ │  SERVIDOR 3   │
│   (Core)      │ │ (Rendiciones) │ │ (Inventario)  │
├───────────────┤ ├───────────────┤ ├───────────────┤
│ 192.168.1.10  │ │ 192.168.1.20  │ │ 192.168.1.30  │
├───────────────┤ ├───────────────┤ ├───────────────┤
│               │ │               │ │               │
│ Backend Core  │ │ Backend       │ │ Backend       │
│ Puerto: 5000  │ │ Rendiciones   │ │ Inventario    │
│               │ │ Puerto: 5050  │ │ Puerto: 5060  │
│               │ │               │ │               │
│ Frontend      │ │ Frontend      │ │ Frontend      │
│ Admin         │ │ Rendiciones   │ │ Inventario    │
│ Puerto: 3000  │ │ Puerto: 8084  │ │ Puerto: 8085  │
│               │ │               │ │               │
│ PostgreSQL    │ │ PostgreSQL    │ │ PostgreSQL    │
│ Core DB       │ │ Rendiciones   │ │ Inventario    │
│ Puerto: 5432  │ │ Puerto: 5433  │ │ Puerto: 5434  │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Ventajas de Esta Arquitectura

✅ **Escalabilidad Independiente**: Escalar solo la app que lo necesite
✅ **Aislamiento de Fallos**: Si cae un servidor, los demás siguen funcionando
✅ **Deployment Independiente**: Deployar sin afectar otras apps
✅ **Recursos Dedicados**: CPU/RAM dedicados por app
✅ **Seguridad**: Segmentar redes y firewalls por app
✅ **Costos Optimizados**: Servidores de diferente tamaño según necesidad
✅ **Multi-Region**: Apps en diferentes zonas geográficas
✅ **Mantenimiento**: Actualizar un servidor sin downtime total

### Desventajas

❌ **Complejidad de Networking**: Configurar VPN/VPC entre servidores
❌ **Latencia**: Llamadas cross-server más lentas
❌ **Costos Operacionales**: Más servidores = más costos
❌ **Monitoreo Complejo**: Logs distribuidos en múltiples servidores
❌ **Debugging Difícil**: Seguir requests entre servidores

---

## 🗺️ Topologías de Deployment

### Opción 1: Servidores Dedicados por App (RECOMENDADA)

**Cada app tiene su propio servidor con backend + frontend + BD**

```
SERVIDOR 1 (Core Admin)
├── Backend Core API (Express)
├── Frontend Admin (Next.js)
└── PostgreSQL (core_db)
    ├── tenants
    ├── users
    ├── parametros_maestros
    └── ai_prompts

SERVIDOR 2 (Rendiciones)
├── Backend Rendiciones API (Express)
├── Frontend Rendiciones (Next.js)
└── PostgreSQL (rendiciones_db)
    ├── documentos_procesados
    ├── rendicion_tarjeta_items
    └── tarjetas

SERVIDOR 3 (Inventario)
├── Backend Inventario API (Express)
├── Frontend Inventario (Next.js)
└── PostgreSQL (inventario_db)
    ├── productos
    ├── stock
    └── movimientos
```

**Ventajas:**
- ✅ Máxima independencia
- ✅ Fácil de escalar
- ✅ Backup selectivo

**Ideal para:**
- Apps con alta carga
- Equipos separados por app
- Multi-región

---

### Opción 2: Backend Centralizado, Frontends Distribuidos

**Backends juntos, frontends separados**

```
SERVIDOR 1 (Backends)
├── Backend Core (Puerto 5000)
├── Backend Rendiciones (Puerto 5050)
├── Backend Inventario (Puerto 5060)
└── PostgreSQL
    ├── core_db
    ├── rendiciones_db
    └── inventario_db

SERVIDOR 2 (Frontend Core)
└── Frontend Admin (Puerto 3000)

SERVIDOR 3 (Frontend Rendiciones)
└── Frontend Rendiciones (Puerto 8084)

SERVIDOR 4 (Frontend Inventario)
└── Frontend Inventario (Puerto 8085)
```

**Ventajas:**
- ✅ BDs juntas = joins posibles
- ✅ Frontends cerca de usuarios

**Ideal para:**
- Apps con baja carga
- BD compartida necesaria
- Usuarios en diferentes zonas

---

### Opción 3: Microservicios Puros

**Cada servicio en su propio servidor**

```
SERVIDOR 1 (Auth Service)
└── /api/auth

SERVIDOR 2 (Tenants Service)
└── /api/tenants

SERVIDOR 3 (Documentos Service)
└── /api/documentos

SERVIDOR 4 (Rendiciones Service)
└── /api/rendiciones

SERVIDOR 5 (Frontend Gateway)
└── Next.js app que consume todos los servicios
```

**Ventajas:**
- ✅ Escalado quirúrgico
- ✅ Deployments atómicos

**Desventajas:**
- ❌ Muy complejo para comenzar
- ❌ Latencia alta

**Ideal para:**
- Alto tráfico (>100k usuarios)
- Equipos grandes (>20 devs)

---

### Opción 4: Híbrida (MEJOR PARA EMPEZAR)

**Core + BD centralizado, Apps distribuidas**

```
SERVIDOR 1 (Core + Base de Datos)
├── Backend Core API (Puerto 5000)
├── Frontend Admin (Puerto 3000)
└── PostgreSQL
    ├── core_db (compartida)
    ├── rendiciones_db
    └── inventario_db

SERVIDOR 2 (Rendiciones)
├── Backend Rendiciones (Puerto 5050)
└── Frontend Rendiciones (Puerto 8084)
   (Conecta a PostgreSQL del Servidor 1)

SERVIDOR 3 (Inventario)
├── Backend Inventario (Puerto 5060)
└── Frontend Inventario (Puerto 8085)
   (Conecta a PostgreSQL del Servidor 1)
```

**Ventajas:**
- ✅ Balance entre complejidad y escalabilidad
- ✅ BD centralizada = backups simples
- ✅ Apps independientes

**Ideal para:**
- Comenzar con arquitectura distribuida
- 2-5 apps
- Equipo mediano (5-15 devs)

---

## 🔗 Comunicación entre Servidores

### Estrategia 1: API Gateway Centralizado (RECOMENDADA)

**Un servidor hace de proxy a todos los demás**

```nginx
# SERVIDOR 1 - Nginx como API Gateway
# /etc/nginx/sites-available/api-gateway

upstream core_backend {
    server localhost:5000;
}

upstream rendiciones_backend {
    server 192.168.1.20:5050;  # Servidor 2
}

upstream inventario_backend {
    server 192.168.1.30:5060;  # Servidor 3
}

server {
    listen 80;
    server_name api.tuorg.com;

    # Headers comunes
    add_header X-Gateway-Server "core-gateway" always;

    # Core APIs (local)
    location /api/auth {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/tenants {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    location /api/users {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    location /api/parametros {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    # Rendiciones APIs (remoto)
    location /api/documentos {
        proxy_pass http://rendiciones_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;

        # Retry en caso de falla
        proxy_next_upstream error timeout invalid_header http_500;
    }

    location /api/rendiciones {
        proxy_pass http://rendiciones_backend;
        proxy_set_header Host $host;
    }

    location /api/tarjetas {
        proxy_pass http://rendiciones_backend;
        proxy_set_header Host $host;
    }

    # Inventario APIs (remoto)
    location /api/productos {
        proxy_pass http://inventario_backend;
        proxy_set_header Host $host;
    }

    location /api/stock {
        proxy_pass http://inventario_backend;
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Configuración del Frontend:**
```javascript
// apps/rendiciones/frontend/.env
NEXT_PUBLIC_API_URL=http://api.tuorg.com/api

// Todos los requests van al gateway
fetch(`${process.env.NEXT_PUBLIC_API_URL}/documentos`)
```

**Ventajas:**
- ✅ Frontend tiene una sola URL
- ✅ CORS configurado en un solo lugar
- ✅ Rate limiting centralizado
- ✅ SSL/TLS terminado en gateway

---

### Estrategia 2: Service Discovery (Para Producción Grande)

**Apps se registran dinámicamente**

```javascript
// Usando Consul para service discovery

// apps/rendiciones/backend/src/index.js
import consul from 'consul';

const consulClient = consul({ host: '192.168.1.10', port: 8500 });

// Registrar servicio
await consulClient.agent.service.register({
  name: 'rendiciones-api',
  address: '192.168.1.20',
  port: 5050,
  check: {
    http: 'http://192.168.1.20:5050/health',
    interval: '10s'
  }
});

// Descubrir otros servicios
const services = await consulClient.catalog.service.nodes('core-api');
const coreUrl = `http://${services[0].ServiceAddress}:${services[0].ServicePort}`;
```

---

### Estrategia 3: Llamadas Directas entre Backends

**Cada backend conoce las IPs de los otros**

```javascript
// apps/rendiciones/backend/src/config/services.js
export const CORE_API_URL = process.env.CORE_API_URL || 'http://192.168.1.10:5000';
export const INVENTARIO_API_URL = process.env.INVENTARIO_API_URL || 'http://192.168.1.30:5060';

// apps/rendiciones/backend/src/services/TenantValidator.js
import axios from 'axios';
import { CORE_API_URL } from '../config/services.js';

export async function validateTenant(tenantId, token) {
  try {
    const response = await axios.get(
      `${CORE_API_URL}/api/tenants/${tenantId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000 // 5 segundos
      }
    );

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Core API no disponible');
    }
    throw error;
  }
}

// Uso en middleware
export async function validateTenantMiddleware(req, res, next) {
  const { tenantId } = req;
  const token = req.headers.authorization;

  try {
    const tenant = await validateTenant(tenantId, token);

    if (!tenant.activo) {
      return res.status(403).json({ error: 'Tenant inactivo' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Error validando tenant:', error);
    res.status(500).json({ error: 'Error validando tenant' });
  }
}
```

**Variables de Entorno:**
```env
# apps/rendiciones/backend/.env
PORT=5050
RENDICIONES_DATABASE_URL=postgresql://user:pass@localhost:5433/rendiciones_db
CORE_API_URL=http://192.168.1.10:5000
INVENTARIO_API_URL=http://192.168.1.30:5060
```

---

### Estrategia 4: Message Queue (Asíncrono)

**Para operaciones no críticas**

```javascript
// Usando RabbitMQ o Redis Pub/Sub

// apps/rendiciones/backend/src/events/publisher.js
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://192.168.1.10');
const channel = await connection.createChannel();

await channel.assertExchange('ecosystem', 'topic', { durable: true });

export async function publishDocumentoCreado(documento) {
  const message = JSON.stringify({
    event: 'documento.creado',
    data: documento,
    timestamp: new Date().toISOString()
  });

  channel.publish('ecosystem', 'documentos.created', Buffer.from(message));
  console.log('Evento publicado: documento.creado');
}

// apps/inventario/backend/src/events/subscriber.js
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://192.168.1.10');
const channel = await connection.createChannel();

await channel.assertQueue('inventario-events');
await channel.bindQueue('inventario-events', 'ecosystem', 'documentos.*');

channel.consume('inventario-events', async (msg) => {
  const event = JSON.parse(msg.content.toString());

  if (event.event === 'documento.creado') {
    // Actualizar stock basado en documento
    await actualizarStockDesdeDocumento(event.data);
  }

  channel.ack(msg);
});
```

---

## ⚙️ Configuración por Servidor

### Servidor 1: Core Admin

**Especificaciones:**
- CPU: 4 cores
- RAM: 8GB
- Disco: 100GB SSD
- OS: Ubuntu 22.04 LTS

**Instalación:**
```bash
#!/bin/bash
# scripts/setup-servidor-1-core.sh

echo "🚀 Configurando Servidor 1 (Core Admin)..."

# 1. Actualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Instalar pnpm
npm install -g pnpm

# 4. Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 5. Crear base de datos
sudo -u postgres psql << EOF
CREATE DATABASE core_db;
CREATE USER core_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE core_db TO core_user;
EOF

# 6. Instalar Nginx
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 7. Instalar PM2
npm install -g pm2

# 8. Clonar repositorio
cd /opt
git clone https://github.com/tuorg/ecosystem.git
cd ecosystem

# 9. Instalar dependencias
pnpm install

# 10. Build paquetes compartidos
pnpm --filter "@tuorg/*" build

# 11. Configurar variables de entorno
cat > apps/core-admin/backend/.env << EOF
NODE_ENV=production
PORT=5000
CORE_DATABASE_URL=postgresql://core_user:secure_password_here@localhost:5432/core_db
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF

cat > apps/core-admin/frontend/.env << EOF
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=http://api.tuorg.com/api
EOF

# 12. Migrar base de datos
cd apps/core-admin/backend
npx prisma migrate deploy

# 13. Configurar Nginx
sudo cp /opt/ecosystem/infrastructure/nginx/core-admin.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/core-admin.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 14. Iniciar servicios con PM2
cd /opt/ecosystem
pm2 start infrastructure/pm2/core-admin.config.js
pm2 save
pm2 startup

echo "✅ Servidor 1 configurado correctamente"
echo "   Backend: http://localhost:5000"
echo "   Frontend: http://localhost:3000"
```

**PM2 Config:**
```javascript
// infrastructure/pm2/core-admin.config.js
module.exports = {
  apps: [
    {
      name: 'core-backend',
      script: './apps/core-admin/backend/src/index.js',
      cwd: '/opt/ecosystem',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/core-backend-error.log',
      out_file: '/var/log/pm2/core-backend-out.log',
      time: true
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
      time: true
    }
  ]
};
```

**Nginx Config:**
```nginx
# infrastructure/nginx/core-admin.conf
upstream core_backend {
    server localhost:5000;
}

upstream admin_frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name admin.tuorg.com;

    # Backend API
    location /api {
        proxy_pass http://core_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://admin_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

### Servidor 2: Rendiciones

**Especificaciones:**
- CPU: 4 cores
- RAM: 16GB (más por procesamiento de PDFs)
- Disco: 200GB SSD
- OS: Ubuntu 22.04 LTS

**Instalación:**
```bash
#!/bin/bash
# scripts/setup-servidor-2-rendiciones.sh

echo "🚀 Configurando Servidor 2 (Rendiciones)..."

# 1-7. Igual que Servidor 1

# 8. Clonar repositorio (solo rama de rendiciones)
cd /opt
git clone -b main --single-branch https://github.com/tuorg/ecosystem.git
cd ecosystem

# 9. Instalar dependencias
pnpm install

# 10. Build paquetes
pnpm --filter "@tuorg/*" build
pnpm --filter rendiciones-backend build
pnpm --filter rendiciones-frontend build

# 11. Configurar variables de entorno
cat > apps/rendiciones/backend/.env << EOF
NODE_ENV=production
PORT=5050
RENDICIONES_DATABASE_URL=postgresql://rendiciones_user:secure_password@localhost:5433/rendiciones_db
CORE_DATABASE_URL=postgresql://core_user:secure_password@192.168.1.10:5432/core_db
CORE_API_URL=http://192.168.1.10:5000
GEMINI_API_KEY=your_gemini_key_here
ENABLE_AI_EXTRACTION=true
EOF

cat > apps/rendiciones/frontend/.env << EOF
NODE_ENV=production
PORT=8084
NEXT_PUBLIC_API_URL=http://rendiciones.tuorg.com/api
NEXT_PUBLIC_CORE_API_URL=http://api.tuorg.com/api
EOF

# 12. Crear base de datos
sudo -u postgres psql << EOF
CREATE DATABASE rendiciones_db;
CREATE USER rendiciones_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE rendiciones_db TO rendiciones_user;
EOF

# 13. Migrar base de datos
cd apps/rendiciones/backend
npx prisma migrate deploy

# 14. Configurar Nginx
sudo cp /opt/ecosystem/infrastructure/nginx/rendiciones.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/rendiciones.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 15. Iniciar servicios
cd /opt/ecosystem
pm2 start infrastructure/pm2/rendiciones.config.js
pm2 save
pm2 startup

echo "✅ Servidor 2 configurado correctamente"
```

**Nginx Config:**
```nginx
# infrastructure/nginx/rendiciones.conf
upstream rendiciones_backend {
    server localhost:5050;
}

upstream rendiciones_frontend {
    server localhost:8084;
}

server {
    listen 80;
    server_name rendiciones.tuorg.com;

    # Aumentar tamaño de upload para PDFs
    client_max_body_size 50M;

    # Backend API
    location /api {
        proxy_pass http://rendiciones_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Timeouts más largos para procesamiento de PDFs
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend
    location / {
        proxy_pass http://rendiciones_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

### Servidor 3: Inventario

**Similar a Servidor 2, pero con configuración específica de inventario**

---

## 🔒 Seguridad y Networking

### VPN entre Servidores (Wireguard)

**Para que los servidores se comuniquen de forma segura:**

```bash
# En cada servidor, instalar Wireguard
sudo apt install -y wireguard

# Servidor 1 (Core) - 10.0.0.1
sudo wg genkey | sudo tee /etc/wireguard/privatekey | wg pubkey | sudo tee /etc/wireguard/publickey

cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address = 10.0.0.1/24
PrivateKey = <private_key_servidor_1>
ListenPort = 51820

[Peer]
# Servidor 2 (Rendiciones)
PublicKey = <public_key_servidor_2>
AllowedIPs = 10.0.0.2/32

[Peer]
# Servidor 3 (Inventario)
PublicKey = <public_key_servidor_3>
AllowedIPs = 10.0.0.3/32
EOF

sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

**Luego actualizar URLs a usar IPs privadas:**
```env
# apps/rendiciones/backend/.env
CORE_API_URL=http://10.0.0.1:5000  # IP privada de Wireguard
```

### Firewall (UFW)

```bash
# Servidor 1 (Core)
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 51820/udp  # Wireguard
sudo ufw allow from 10.0.0.0/24 to any port 5432  # PostgreSQL solo desde VPN
sudo ufw enable

# Servidor 2 (Rendiciones)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw allow 51820/udp
sudo ufw enable
```

### JWT Compartido entre Servidores

**Usar el mismo JWT_SECRET en todos los servidores:**

```env
# Generar secreto en Servidor 1
openssl rand -hex 32
# Output: a1b2c3d4e5f6...

# Copiar a todos los servidores
# apps/*/backend/.env
JWT_SECRET=a1b2c3d4e5f6...
```

**Entonces un JWT generado en Core funcionará en Rendiciones:**
```javascript
// Backend Rendiciones valida token de Core
import jwt from 'jsonwebtoken';

const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// ✅ Funciona porque JWT_SECRET es el mismo
```

---

## 📊 Monitoreo y Logs

### Logs Centralizados con Loki + Grafana

```bash
# Servidor 1: Instalar Loki
docker run -d \
  --name=loki \
  -p 3100:3100 \
  grafana/loki:latest

# En cada servidor: Instalar Promtail
wget https://github.com/grafana/loki/releases/download/v2.9.0/promtail-linux-amd64.zip
unzip promtail-linux-amd64.zip
sudo mv promtail-linux-amd64 /usr/local/bin/promtail

# Configurar Promtail
cat > /etc/promtail/config.yml << EOF
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://192.168.1.10:3100/loki/api/v1/push

scrape_configs:
  - job_name: rendiciones
    static_configs:
      - targets:
          - localhost
        labels:
          job: rendiciones-backend
          server: servidor-2
          __path__: /var/log/pm2/*.log
EOF

sudo systemctl start promtail
```

### Métricas con Prometheus

```yaml
# prometheus.yml en Servidor 1
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'core-backend'
    static_configs:
      - targets: ['localhost:5000']

  - job_name: 'rendiciones-backend'
    static_configs:
      - targets: ['192.168.1.20:5050']

  - job_name: 'inventario-backend'
    static_configs:
      - targets: ['192.168.1.30:5060']
```

### Alertas

```yaml
# alertmanager.yml
route:
  receiver: 'slack'

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/xxx'
        channel: '#alerts'
        text: '{{ .CommonAnnotations.summary }}'

# Reglas de alerta
groups:
  - name: backend_alerts
    rules:
      - alert: BackendDown
        expr: up{job=~".*-backend"} == 0
        for: 1m
        annotations:
          summary: "Backend {{ $labels.job }} está caído"
```

---

## 🚀 Scripts de Deployment

### Script de Deployment General

```bash
#!/bin/bash
# scripts/deploy-app.sh
# Uso: ./deploy-app.sh rendiciones servidor-2

APP_NAME=$1
SERVER=$2

if [ -z "$APP_NAME" ] || [ -z "$SERVER" ]; then
  echo "Uso: ./deploy-app.sh <app> <servidor>"
  exit 1
fi

echo "🚀 Deploying $APP_NAME a $SERVER..."

# 1. Build local
pnpm --filter "$APP_NAME-backend" build
pnpm --filter "$APP_NAME-frontend" build

# 2. Crear tarball
tar -czf "$APP_NAME.tar.gz" \
  apps/$APP_NAME \
  packages \
  node_modules

# 3. Copiar a servidor
scp "$APP_NAME.tar.gz" "$SERVER:/opt/ecosystem/"

# 4. Extraer y reiniciar en servidor
ssh "$SERVER" << EOF
cd /opt/ecosystem
tar -xzf "$APP_NAME.tar.gz"
cd apps/$APP_NAME/backend
npx prisma migrate deploy
pm2 restart $APP_NAME-backend
pm2 restart $APP_NAME-frontend
EOF

echo "✅ Deployment completado"
```

### Script de Rollback

```bash
#!/bin/bash
# scripts/rollback-app.sh

APP_NAME=$1
SERVER=$2

echo "⏪ Rollback de $APP_NAME en $SERVER..."

ssh "$SERVER" << EOF
cd /opt/ecosystem
git fetch origin
git checkout HEAD~1  # Volver a commit anterior
pnpm install
pnpm --filter "$APP_NAME-backend" build
pm2 restart $APP_NAME-backend
EOF

echo "✅ Rollback completado"
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

SERVERS=(
  "http://192.168.1.10:5000/health|Core"
  "http://192.168.1.20:5050/health|Rendiciones"
  "http://192.168.1.30:5060/health|Inventario"
)

for server in "${SERVERS[@]}"; do
  IFS='|' read -r url name <<< "$server"

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  if [ "$response" == "200" ]; then
    echo "✅ $name: OK"
  else
    echo "❌ $name: DOWN (HTTP $response)"
    # Enviar alerta
    curl -X POST https://hooks.slack.com/services/xxx \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"⚠️ $name está caído\"}"
  fi
done
```

---

## 🎯 Casos de Uso

### Caso 1: Startup con 2 Apps

**Escenario:** Tienes Rendiciones y estás por lanzar Inventario

**Recomendación:** Opción Híbrida

```
SERVIDOR 1 (VPS $50/mes)
├── Backend Core + BD (Core + Rendiciones + Inventario)
└── Frontend Admin

SERVIDOR 2 (VPS $30/mes)
├── Backend Rendiciones
└── Frontend Rendiciones

SERVIDOR 3 (VPS $30/mes)
├── Backend Inventario
└── Frontend Inventario
```

**Costo Total:** $110/mes
**Escalabilidad:** Buena para <10k usuarios

---

### Caso 2: Empresa Mediana con 5+ Apps

**Escenario:** Múltiples aplicaciones, diferentes equipos

**Recomendación:** Servidores Dedicados + API Gateway

```
SERVIDOR 1 (API Gateway + Core)
├── Nginx (Gateway)
├── Backend Core
└── PostgreSQL Core

SERVIDOR 2-6 (Apps)
├── Backend App X
├── Frontend App X
└── PostgreSQL App X

SERVIDOR 7 (Shared Services)
├── Redis
├── RabbitMQ
└── Logs (Loki)
```

**Costo Total:** ~$500-800/mes
**Escalabilidad:** Hasta 100k usuarios

---

### Caso 3: Enterprise Multi-Región

**Escenario:** Usuarios en Argentina, Brasil, México

**Recomendación:** Microservicios + CDN

```
REGIÓN ARGENTINA (Servidor en Buenos Aires)
├── Core API
├── Rendiciones API
└── PostgreSQL Primary

REGIÓN BRASIL (Servidor en São Paulo)
├── Core API (Réplica)
├── Inventario API
└── PostgreSQL Replica

REGIÓN MÉXICO (Servidor en México DF)
├── Core API (Réplica)
└── PostgreSQL Replica

CDN GLOBAL (Cloudflare)
└── Frontends servidos desde edge
```

**Costo Total:** $2000-5000/mes
**Escalabilidad:** Millones de usuarios

---

## 📋 Checklist de Deployment Multi-Servidor

### Pre-Deployment
- [ ] Configurar Wireguard/VPN entre servidores
- [ ] Sincronizar JWT_SECRET en todos los servidores
- [ ] Configurar firewalls (UFW)
- [ ] Setup monitoring (Prometheus + Grafana)
- [ ] Configurar backups automáticos de BD
- [ ] Documentar IPs y puertos

### Por Cada Servidor
- [ ] Instalar Node.js, PostgreSQL, Nginx, PM2
- [ ] Crear base de datos
- [ ] Clonar repositorio
- [ ] Configurar variables de entorno
- [ ] Build y migrar BD
- [ ] Configurar Nginx
- [ ] Iniciar servicios con PM2
- [ ] Verificar health check

### Post-Deployment
- [ ] Testing end-to-end
- [ ] Load testing
- [ ] Configurar alertas
- [ ] Documentar procedimientos
- [ ] Training del equipo

---

**Última actualización:** 2025-10-23
**Versión:** 1.0.0
