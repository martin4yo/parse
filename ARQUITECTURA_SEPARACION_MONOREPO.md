# 🏗️ ARQUITECTURA DE SEPARACIÓN - MONOREPO MULTITENANT

## 📋 Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Estructura del Monorepo](#estructura-del-monorepo)
3. [Estrategia de Base de Datos](#estrategia-de-base-de-datos)
4. [Plan de Migración por Fases](#plan-de-migración-por-fases)
5. [Deployment Multi-Servidor](#deployment-multi-servidor)
6. [Guías de Implementación](#guías-de-implementación)
7. [Scripts de Automatización](#scripts-de-automatización)
8. [Testing y Validación](#testing-y-validación)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visión General

### Objetivo
Separar la lógica común de **tenants, usuarios, parámetros y AI** en paquetes reutilizables para que múltiples aplicaciones puedan compartir la misma infraestructura de administración.

### Beneficios
✅ **Reutilización**: Código de auth/tenants compartido entre todas las apps
✅ **Consistencia**: Misma lógica de permisos en todo el ecosistema
✅ **Mantenibilidad**: Fix de bugs en un solo lugar
✅ **Escalabilidad**: Cada app puede deployarse independientemente
✅ **Deployment Distribuido**: Backend/Frontend principal en un servidor, apps en otros servidores

### Arquitectura Objetivo
```
Servidor 1 (Core)                    Servidor 2 (App 1)              Servidor 3 (App 2)
├─ Backend Core (Puerto 5000)        ├─ Backend Rendiciones          ├─ Backend Inventario
│  ├─ Auth API                       │  (Puerto 5050)                │  (Puerto 5060)
│  ├─ Tenants API                    │  └─ API Rendiciones           │  └─ API Inventario
│  ├─ Parámetros API                 └─ Frontend Rendiciones         └─ Frontend Inventario
│  └─ AI Config API                     (Puerto 8084)                   (Puerto 8085)
└─ Admin Frontend (Puerto 3000)
   ├─ Gestión Tenants
   ├─ Gestión Usuarios
   └─ Configuración Global
```

---

## 📦 Estructura del Monorepo

### Estructura Completa
```
ecosystem-root/
├── packages/                           # 🔧 Paquetes compartidos (NPM)
│   ├── @tuorg/auth-core/              # Autenticación y autorización
│   ├── @tuorg/tenant-admin/           # Gestión de tenants
│   ├── @tuorg/parametros/             # Sistema de parámetros
│   ├── @tuorg/ai-prompts/             # Sistema de IA y prompts
│   ├── @tuorg/ui-components/          # Componentes UI compartidos
│   └── @tuorg/shared-types/           # TypeScript types compartidos
│
├── apps/                               # 🚀 Aplicaciones del ecosistema
│   ├── core-admin/                    # App principal de administración
│   │   ├── backend/                   # API Core (deploy: servidor 1)
│   │   └── frontend/                  # Admin UI (deploy: servidor 1)
│   ├── rendiciones/                   # App de rendiciones (actual)
│   │   ├── backend/                   # API Rendiciones (deploy: servidor 2)
│   │   └── frontend/                  # UI Rendiciones (deploy: servidor 2)
│   ├── inventario/                    # App de inventario (ejemplo)
│   │   ├── backend/                   # API Inventario (deploy: servidor 3)
│   │   └── frontend/                  # UI Inventario (deploy: servidor 3)
│   └── ventas/                        # Otras apps futuras
│
├── infrastructure/                     # 🔧 Scripts de deployment
│   ├── docker/                        # Dockerfiles por app
│   ├── nginx/                         # Configs de proxy inverso
│   ├── pm2/                           # Configs PM2 por servidor
│   └── migrations/                    # Migraciones de BD
│
├── docs/                              # 📚 Documentación
│   ├── api/                           # Documentación de APIs
│   ├── architecture/                  # Diagramas de arquitectura
│   └── guides/                        # Guías de desarrollo
│
├── package.json                       # Workspace root
├── pnpm-workspace.yaml               # Configuración de workspace
├── turbo.json                        # Configuración de Turborepo
└── README.md
```

### Detalle de Paquetes Compartidos

#### 1. `@tuorg/auth-core`
```
packages/auth-core/
├── src/
│   ├── middleware/
│   │   ├── authWithTenant.js         # Middleware principal
│   │   ├── requireRole.js            # Validación de roles
│   │   ├── checkPlanLimits.js        # Límites por plan
│   │   └── index.js
│   ├── services/
│   │   ├── AuthService.js            # Lógica de autenticación
│   │   ├── TokenService.js           # Manejo de JWT
│   │   ├── SessionService.js         # Gestión de sesiones
│   │   └── index.js
│   ├── config/
│   │   └── passport.js               # Configuración OAuth
│   ├── utils/
│   │   ├── passwordUtils.js          # Hashing de contraseñas
│   │   └── tokenHelpers.js
│   └── index.js                      # Exportación principal
├── prisma/
│   └── schema.prisma                 # users, profiles, sessions
├── tests/
│   ├── middleware.test.js
│   └── services.test.js
├── package.json
└── README.md
```

**Exportaciones principales:**
```javascript
// Middleware
export { authWithTenant } from './middleware/authWithTenant.js';
export { requireRole } from './middleware/requireRole.js';

// Services
export { AuthService } from './services/AuthService.js';
export { TokenService } from './services/TokenService.js';

// Utils
export { hashPassword, comparePassword } from './utils/passwordUtils.js';
```

#### 2. `@tuorg/tenant-admin`
```
packages/tenant-admin/
├── src/
│   ├── routes/
│   │   ├── tenants.js                # CRUD de tenants
│   │   ├── users.js                  # CRUD de usuarios
│   │   ├── planes.js                 # Gestión de planes
│   │   └── index.js
│   ├── services/
│   │   ├── TenantService.js          # Lógica de tenants
│   │   ├── UserService.js            # Lógica de usuarios
│   │   ├── FeatureService.js         # Verificación de features
│   │   └── index.js
│   ├── validators/
│   │   ├── tenantValidators.js       # Validaciones con Zod
│   │   └── userValidators.js
│   └── index.js
├── prisma/
│   └── schema.prisma                 # tenants, planes, plan_features
├── tests/
└── package.json
```

#### 3. `@tuorg/parametros`
```
packages/parametros/
├── src/
│   ├── routes/
│   │   ├── maestros.js               # Parámetros maestros
│   │   ├── relaciones.js             # Relaciones entre parámetros
│   │   ├── atributos.js              # Atributos y valores
│   │   └── index.js
│   ├── services/
│   │   ├── ParametrosService.js      # Lógica de parámetros
│   │   └── CascadeService.js         # Lógica de cascadas
│   └── index.js
├── prisma/
│   └── schema.prisma                 # parametros_maestros, etc.
└── package.json
```

#### 4. `@tuorg/ai-prompts`
```
packages/ai-prompts/
├── src/
│   ├── routes/
│   │   ├── prompts.js                # CRUD de prompts
│   │   └── configs.js                # Configuración de providers
│   ├── services/
│   │   ├── AIConfigService.js        # Gestión de configs IA
│   │   ├── PromptManager.js          # Gestión de prompts
│   │   ├── DocumentExtractionOrchestrator.js
│   │   ├── ClassifierService.js
│   │   └── providers/
│   │       ├── GeminiProvider.js
│   │       ├── OpenAIProvider.js
│   │       ├── AnthropicProvider.js
│   │       └── DocumentAIProvider.js
│   └── index.js
├── prisma/
│   └── schema.prisma                 # ai_prompts, ai_provider_configs
└── package.json
```

#### 5. `@tuorg/ui-components`
```
packages/ui-components/
├── src/
│   ├── components/
│   │   ├── usuarios/
│   │   │   ├── UserTable.jsx
│   │   │   ├── UserForm.jsx
│   │   │   └── UserPermissions.jsx
│   │   ├── parametros/
│   │   │   ├── ParametroSelector.jsx
│   │   │   └── ParametroForm.jsx
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── MainLayout.jsx
│   │   └── shared/
│   │       ├── DataTable.jsx
│   │       ├── Modal.jsx
│   │       └── Form.jsx
│   ├── contexts/
│   │   ├── AuthContext.jsx
│   │   ├── TenantContext.jsx
│   │   └── ThemeContext.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useTenant.js
│   │   └── useApi.js
│   ├── lib/
│   │   └── api-client.js             # Cliente HTTP configurado
│   └── index.js
├── tailwind.config.js                # Config compartida
├── package.json
└── README.md
```

---

## 🗄️ Estrategia de Base de Datos

### Opción 1: Base de Datos Única (Corto Plazo)

**Arquitectura:**
```
PostgreSQL Único (puerto 5432)
├── Schema "auth"
│   ├── users
│   ├── profiles
│   └── sessions
├── Schema "tenants"
│   ├── tenants
│   ├── planes
│   └── plan_features
├── Schema "parametros"
│   ├── parametros_maestros
│   ├── parametros_relaciones
│   └── atributos
├── Schema "ai"
│   ├── ai_prompts
│   └── ai_provider_configs
├── Schema "rendiciones"
│   ├── documentos_procesados
│   ├── rendicion_tarjeta_items
│   └── tarjetas
└── Schema "inventario"
    ├── productos
    └── stock
```

**Configuración Prisma:**
```prisma
// packages/auth-core/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["auth"]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  tenantId  String?

  @@schema("auth")
}
```

**Ventajas:**
- ✅ Setup simple
- ✅ Joins nativos entre schemas
- ✅ Transacciones ACID garantizadas
- ✅ Backup único

**Desventajas:**
- ❌ No escala horizontalmente
- ❌ Acoplamiento físico
- ❌ Punto único de falla

### Opción 2: Bases de Datos Separadas (Largo Plazo) ⭐ RECOMENDADA

**Arquitectura:**
```
PostgreSQL "core" (Servidor 1, puerto 5432)
├── tenants
├── users
├── profiles
├── planes
├── parametros_maestros
├── ai_prompts
└── ai_provider_configs

PostgreSQL "rendiciones" (Servidor 2, puerto 5433)
├── documentos_procesados
├── rendicion_tarjeta_items
├── tarjetas
└── cajas
   (+ columna tenantId como FK virtual)

PostgreSQL "inventario" (Servidor 3, puerto 5434)
├── productos
├── stock
└── movimientos
   (+ columna tenantId como FK virtual)
```

**Configuración Prisma:**
```prisma
// packages/auth-core/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("CORE_DATABASE_URL")
}

// apps/rendiciones/backend/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("RENDICIONES_DATABASE_URL")
}

model DocumentoProcesado {
  id        String   @id @default(uuid())
  tenantId  String   // FK virtual a core.tenants.id
  // ... resto de campos
}
```

**Conexión entre BDs:**
```javascript
// apps/rendiciones/backend/src/services/TenantValidator.js
import { coreDB } from '@tuorg/auth-core/database';
import { rendicionesDB } from '../config/database.js';

export async function validateTenantExists(tenantId) {
  const tenant = await coreDB.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant || !tenant.activo) {
    throw new Error('Tenant inválido o inactivo');
  }

  return tenant;
}
```

**Ventajas:**
- ✅ Escalado horizontal por app
- ✅ Deployment independiente
- ✅ Backup selectivo
- ✅ Seguridad mejorada (aislamiento)
- ✅ Performance (menos contencion)

**Desventajas:**
- ❌ No hay joins nativos cross-database
- ❌ Consistencia eventual
- ❌ Múltiples conexiones

### Migración de BD Única → Separadas

**Script de migración:**
```sql
-- 1. Crear nueva BD para rendiciones
CREATE DATABASE rendiciones_db;

-- 2. Exportar datos de schemas específicos
pg_dump -U postgres -d ecosystem_db -n rendiciones --schema-only > rendiciones_schema.sql
pg_dump -U postgres -d ecosystem_db -n rendiciones --data-only > rendiciones_data.sql

-- 3. Restaurar en nueva BD
psql -U postgres -d rendiciones_db -f rendiciones_schema.sql
psql -U postgres -d rendiciones_db -f rendiciones_data.sql

-- 4. Verificar integridad referencial
SELECT
  d.tenantId,
  COUNT(*) as documentos
FROM documentos_procesados d
LEFT JOIN (
  SELECT id FROM dblink('dbname=core_db', 'SELECT id FROM tenants')
  AS t(id text)
) t ON d.tenantId = t.id
WHERE t.id IS NULL
GROUP BY d.tenantId;

-- 5. Eliminar schema viejo (después de validar)
-- DROP SCHEMA rendiciones CASCADE;
```

---

## 🚀 Deployment Multi-Servidor

### Arquitectura de Servidores

#### Servidor 1: Core Admin (IP: 192.168.1.10)
```
Servicios:
├─ PostgreSQL Core (puerto 5432)
│  └─ BD: core_db
├─ Backend Core API (puerto 5000)
│  ├─ /api/auth
│  ├─ /api/tenants
│  ├─ /api/users
│  ├─ /api/parametros
│  └─ /api/ai/config
└─ Frontend Admin (puerto 3000)
   └─ Panel de administración global
```

**Nginx Config:**
```nginx
# /etc/nginx/sites-available/core-admin
server {
    listen 80;
    server_name admin.tuorg.com;

    # API Backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend Admin
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

**PM2 Config:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'core-backend',
      script: './apps/core-admin/backend/src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        CORE_DATABASE_URL: 'postgresql://user:pass@localhost:5432/core_db'
      }
    },
    {
      name: 'admin-frontend',
      script: 'npm',
      args: 'start',
      cwd: './apps/core-admin/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://admin.tuorg.com/api'
      }
    }
  ]
};
```

#### Servidor 2: Rendiciones (IP: 192.168.1.20)
```
Servicios:
├─ PostgreSQL Rendiciones (puerto 5433)
│  └─ BD: rendiciones_db
├─ Backend Rendiciones (puerto 5050)
│  ├─ /api/documentos
│  ├─ /api/rendiciones
│  └─ /api/tarjetas
└─ Frontend Rendiciones (puerto 8084)
   └─ App de rendiciones
```

**Nginx Config:**
```nginx
# /etc/nginx/sites-available/rendiciones
server {
    listen 80;
    server_name rendiciones.tuorg.com;

    # API Backend
    location /api {
        proxy_pass http://localhost:5050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:8084;
        proxy_set_header Host $host;
    }
}
```

**PM2 Config:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'rendiciones-backend',
      script: './apps/rendiciones/backend/src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
        RENDICIONES_DATABASE_URL: 'postgresql://user:pass@localhost:5433/rendiciones_db',
        CORE_DATABASE_URL: 'postgresql://user:pass@192.168.1.10:5432/core_db',
        CORE_API_URL: 'http://192.168.1.10:5000'
      }
    },
    {
      name: 'rendiciones-frontend',
      script: 'npm',
      args: 'start',
      cwd: './apps/rendiciones/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 8084,
        NEXT_PUBLIC_API_URL: 'http://rendiciones.tuorg.com/api',
        NEXT_PUBLIC_CORE_API_URL: 'http://admin.tuorg.com/api'
      }
    }
  ]
};
```

#### Servidor 3: Inventario (IP: 192.168.1.30)
```
Servicios:
├─ PostgreSQL Inventario (puerto 5434)
│  └─ BD: inventario_db
├─ Backend Inventario (puerto 5060)
│  └─ /api/productos
└─ Frontend Inventario (puerto 8085)
   └─ App de inventario
```

### Comunicación entre Servidores

**Estrategia 1: API Gateway Centralizado**
```
Usuario → API Gateway (Core) → Enrutamiento a apps
```

**Nginx en Servidor Core como Gateway:**
```nginx
# /etc/nginx/sites-available/gateway
server {
    listen 80;
    server_name api.tuorg.com;

    # Core APIs
    location /api/auth {
        proxy_pass http://localhost:5000;
    }
    location /api/tenants {
        proxy_pass http://localhost:5000;
    }

    # Rendiciones
    location /api/rendiciones {
        proxy_pass http://192.168.1.20:5050;
    }
    location /api/documentos {
        proxy_pass http://192.168.1.20:5050;
    }

    # Inventario
    location /api/inventario {
        proxy_pass http://192.168.1.30:5060;
    }
    location /api/productos {
        proxy_pass http://192.168.1.30:5060;
    }
}
```

**Estrategia 2: Apps se Conectan Directamente**
```javascript
// apps/rendiciones/backend/src/config/services.js
export const CORE_API_URL = process.env.CORE_API_URL || 'http://192.168.1.10:5000';

// Validar tenant con Core API
import axios from 'axios';

export async function validateTenant(tenantId, token) {
  const response = await axios.get(
    `${CORE_API_URL}/api/tenants/${tenantId}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}
```

### Docker Compose Multi-Servidor

**Servidor 1 (Core):**
```yaml
# docker-compose.core.yml
version: '3.8'
services:
  core-db:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: core_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres-core:/var/lib/postgresql/data

  core-backend:
    build:
      context: .
      dockerfile: ./infrastructure/docker/Dockerfile.core-backend
    ports:
      - "5000:5000"
    depends_on:
      - core-db
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@core-db:5432/core_db

  admin-frontend:
    build:
      context: .
      dockerfile: ./infrastructure/docker/Dockerfile.admin-frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://admin.tuorg.com/api
```

**Servidor 2 (Rendiciones):**
```yaml
# docker-compose.rendiciones.yml
version: '3.8'
services:
  rendiciones-db:
    image: postgres:15
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: rendiciones_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres-rendiciones:/var/lib/postgresql/data

  rendiciones-backend:
    build:
      context: .
      dockerfile: ./infrastructure/docker/Dockerfile.rendiciones-backend
    ports:
      - "5050:5050"
    depends_on:
      - rendiciones-db
    environment:
      RENDICIONES_DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@rendiciones-db:5432/rendiciones_db
      CORE_DATABASE_URL: postgresql://postgres:${CORE_DB_PASSWORD}@192.168.1.10:5432/core_db
      CORE_API_URL: http://192.168.1.10:5000

  rendiciones-frontend:
    build:
      context: .
      dockerfile: ./infrastructure/docker/Dockerfile.rendiciones-frontend
    ports:
      - "8084:8084"
    environment:
      NEXT_PUBLIC_API_URL: http://rendiciones.tuorg.com/api
      NEXT_PUBLIC_CORE_API_URL: http://admin.tuorg.com/api
```

### Dockerfiles

```dockerfile
# infrastructure/docker/Dockerfile.core-backend
FROM node:20-alpine

WORKDIR /app

# Copiar workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copiar paquetes compartidos
COPY packages ./packages

# Copiar app core
COPY apps/core-admin/backend ./apps/core-admin/backend

# Instalar dependencias
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build paquetes
RUN pnpm --filter "@tuorg/*" build

# Build app
WORKDIR /app/apps/core-admin/backend
RUN pnpm build

EXPOSE 5000
CMD ["node", "dist/index.js"]
```

```dockerfile
# infrastructure/docker/Dockerfile.rendiciones-backend
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/rendiciones/backend ./apps/rendiciones/backend

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@tuorg/*" build

WORKDIR /app/apps/rendiciones/backend
RUN pnpm build

EXPOSE 5050
CMD ["node", "dist/index.js"]
```

---

## 📝 Plan de Migración por Fases

### FASE 0: Preparación (Semana 1-2)

#### 0.1 Auditoría de Código Actual
```bash
# Script de análisis de dependencias
node scripts/analyze-dependencies.js
```

**Script:**
```javascript
// scripts/analyze-dependencies.js
import { glob } from 'glob';
import fs from 'fs';

const files = await glob('backend/src/**/*.js');
const imports = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const importMatches = content.match(/import .+ from ['"](.+)['"]/g) || [];

  imports[file] = importMatches.map(m => {
    const match = m.match(/from ['"](.+)['"]/);
    return match ? match[1] : null;
  });
}

// Identificar imports que serán paquetes compartidos
const authImports = Object.entries(imports).filter(([file, deps]) =>
  deps.some(d => d.includes('middleware/authWithTenant'))
);

console.log('Archivos que usan authWithTenant:', authImports.length);
console.log(JSON.stringify(authImports, null, 2));
```

#### 0.2 Corregir Problemas Críticos

**Migración 1: Parámetros Maestros**
```sql
-- backend/prisma/migrations/001_fix_parametros_unique.sql
BEGIN;

-- Eliminar constraint viejo
ALTER TABLE parametros_maestros
  DROP CONSTRAINT IF EXISTS parametros_maestros_tipo_campo_codigo_key;

-- Verificar duplicados antes de agregar constraint
SELECT tipo_campo, codigo, tenantId, COUNT(*) as duplicados
FROM parametros_maestros
GROUP BY tipo_campo, codigo, tenantId
HAVING COUNT(*) > 1;

-- Si hay duplicados, eliminar o fusionar
-- DELETE FROM parametros_maestros WHERE id IN (...);

-- Agregar nuevo constraint
ALTER TABLE parametros_maestros
  ADD CONSTRAINT parametros_maestros_tipo_codigo_tenant_key
  UNIQUE (tipo_campo, codigo, tenantId);

COMMIT;
```

**Migración 2: Tarjetas sin Tenant Default**
```sql
-- backend/prisma/migrations/002_fix_tarjetas_tenant.sql
BEGIN;

-- Verificar tarjetas con tenant hardcodeado
SELECT * FROM tarjetas
WHERE tenantId = '36f4effe-2097-462e-a161-eda1d23162e3';

-- Actualizar a NULL para que sean globales, o asignar tenant correcto
UPDATE tarjetas
SET tenantId = NULL
WHERE tenantId = '36f4effe-2097-462e-a161-eda1d23162e3'
  AND codigo IN ('VISA', 'MASTERCARD', 'AMEX'); -- Tarjetas globales

COMMIT;
```

**Ejecutar migraciones:**
```bash
cd backend
npx prisma migrate dev --name fix_critical_constraints
```

#### 0.3 Crear Estructura de Monorepo
```bash
# Script de setup inicial
./scripts/setup-monorepo.sh
```

**Script:**
```bash
#!/bin/bash
# scripts/setup-monorepo.sh

echo "🚀 Creando estructura de monorepo..."

# Crear directorios principales
mkdir -p packages apps infrastructure docs

# Crear paquetes compartidos
mkdir -p packages/auth-core/src/{middleware,services,config,utils}
mkdir -p packages/tenant-admin/src/{routes,services,validators}
mkdir -p packages/parametros/src/{routes,services}
mkdir -p packages/ai-prompts/src/{routes,services}
mkdir -p packages/ui-components/src/{components,contexts,hooks}

# Crear apps
mkdir -p apps/core-admin/{backend,frontend}
mkdir -p apps/rendiciones/{backend,frontend}

# Crear infrastructure
mkdir -p infrastructure/{docker,nginx,pm2,migrations}

# Crear docs
mkdir -p docs/{api,architecture,guides}

# Configuración de workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# Root package.json
cat > package.json << 'EOF'
{
  "name": "tuorg-ecosystem",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.0.0"
  }
}
EOF

# Turbo config
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
EOF

echo "✅ Estructura creada. Ejecutar: pnpm install"
```

### FASE 1: Extracción de `@tuorg/auth-core` (Semana 3-4)

#### 1.1 Crear Paquete Base
```bash
cd packages/auth-core
pnpm init
```

**package.json:**
```json
{
  "name": "@tuorg/auth-core",
  "version": "1.0.0",
  "main": "src/index.js",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./middleware": "./src/middleware/index.js",
    "./services": "./src/services/index.js",
    "./database": "./src/config/database.js"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-jwt": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "prisma": "^5.0.0",
    "vitest": "^0.34.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "prisma:generate": "prisma generate"
  }
}
```

#### 1.2 Mover Archivos
```bash
# Script de migración
./scripts/migrate-auth-core.sh
```

**Script:**
```bash
#!/bin/bash
# scripts/migrate-auth-core.sh

echo "📦 Migrando auth-core..."

SRC="backend/src"
DEST="packages/auth-core/src"

# Copiar middleware
cp $SRC/middleware/authWithTenant.js $DEST/middleware/
cp $SRC/middleware/requireRole.js $DEST/middleware/

# Copiar config
cp $SRC/config/passport.js $DEST/config/

# Crear index de exportación
cat > $DEST/middleware/index.js << 'EOF'
export { authWithTenant } from './authWithTenant.js';
export { requireRole } from './requireRole.js';
EOF

cat > $DEST/index.js << 'EOF'
// Middleware
export * from './middleware/index.js';

// Services
export * from './services/index.js';

// Config
export { default as passport } from './config/passport.js';
EOF

echo "✅ Migración completada"
```

#### 1.3 Extraer Modelos Prisma
```prisma
// packages/auth-core/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/auth-core"
}

datasource db {
  provider = "postgresql"
  url      = env("CORE_DATABASE_URL")
}

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  passwordHash          String?
  tenantId              String?
  profileId             String?
  superuser             Boolean   @default(false)
  activo                Boolean   @default(true)
  emailVerified         Boolean   @default(false)
  googleId              String?   @unique
  esUsuarioTesoreria    Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Relaciones
  tenant                Tenant?   @relation(fields: [tenantId], references: [id])
  profile               Profile?  @relation(fields: [profileId], references: [id])
  sessions              Session[]

  @@index([tenantId])
  @@index([email])
}

model Profile {
  id                    String    @id @default(uuid())
  nombre                String
  descripcion           String?
  permisos              Json      @default("{}")
  activo                Boolean   @default(true)
  createdAt             DateTime  @default(now())

  users                 User[]
}

model Session {
  id                    String    @id @default(uuid())
  userId                String
  token                 String    @unique
  expiresAt             DateTime
  createdAt             DateTime  @default(now())

  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
```

#### 1.4 Generar Cliente Prisma
```bash
cd packages/auth-core
npx prisma generate
```

#### 1.5 Actualizar Imports en App Principal
```javascript
// apps/rendiciones/backend/src/index.js

// ANTES:
import { authWithTenant } from './middleware/authWithTenant.js';

// DESPUÉS:
import { authWithTenant } from '@tuorg/auth-core/middleware';
```

**Script de reemplazo automático:**
```bash
# scripts/update-imports.sh
find apps/rendiciones/backend/src -name "*.js" -exec sed -i \
  "s|from ['\"]\\.\\./middleware/authWithTenant['\"]|from '@tuorg/auth-core/middleware'|g" {} \;
```

#### 1.6 Testing
```javascript
// packages/auth-core/tests/middleware.test.js
import { describe, it, expect, vi } from 'vitest';
import { authWithTenant } from '../src/middleware/authWithTenant.js';

describe('authWithTenant middleware', () => {
  it('should inject tenantId into request', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' }
    };
    const res = {};
    const next = vi.fn();

    await authWithTenant(req, res, next);

    expect(req.tenantId).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
```

```bash
cd packages/auth-core
pnpm test
```

### FASE 2: Extracción de `@tuorg/tenant-admin` (Semana 5-6)

#### 2.1 Crear Paquete
```bash
cd packages/tenant-admin
pnpm init
```

#### 2.2 Mover Rutas y Servicios
```bash
# Copiar rutas
cp backend/src/routes/tenants.js packages/tenant-admin/src/routes/
cp backend/src/routes/users.js packages/tenant-admin/src/routes/
cp backend/src/routes/planes.js packages/tenant-admin/src/routes/

# Copiar servicios
cp backend/src/services/FeatureService.js packages/tenant-admin/src/services/
```

#### 2.3 Prisma Schema
```prisma
// packages/tenant-admin/prisma/schema.prisma
model Tenant {
  id                    String    @id @default(uuid())
  slug                  String    @unique
  nombre                String
  cuit                  String    @unique
  razonSocial           String?
  plan                  String    @default("Common")
  planId                String?
  activo                Boolean   @default(true)
  esDefault             Boolean   @default(false)
  fechaVencimiento      DateTime?
  configuracion         Json      @default("{}")
  limites               Json      @default("{}")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Relaciones (se mantienen como referencias)
  planRelation          Plan?     @relation(fields: [planId], references: [id])

  @@index([slug])
  @@index([activo])
}

model Plan {
  id                    String    @id @default(uuid())
  codigo                String    @unique
  nombre                String
  descripcion           String?
  precio                Decimal?  @db.Decimal(10, 2)
  activo                Boolean   @default(true)
  createdAt             DateTime  @default(now())

  tenants               Tenant[]
  features              PlanFeature[]
}

model PlanFeature {
  id                    String    @id @default(uuid())
  planId                String
  feature               String
  config                Json?
  activo                Boolean   @default(true)

  plan                  Plan      @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, feature])
  @@index([planId])
}
```

#### 2.4 Exportar Rutas
```javascript
// packages/tenant-admin/src/index.js
import tenantsRoutes from './routes/tenants.js';
import usersRoutes from './routes/users.js';
import planesRoutes from './routes/planes.js';

export { tenantsRoutes, usersRoutes, planesRoutes };

// Services
export { FeatureService } from './services/FeatureService.js';
export { TenantService } from './services/TenantService.js';
```

#### 2.5 Uso en Apps
```javascript
// apps/rendiciones/backend/src/index.js
import express from 'express';
import { authWithTenant } from '@tuorg/auth-core/middleware';
import { tenantsRoutes, usersRoutes } from '@tuorg/tenant-admin';

const app = express();

// Rutas compartidas
app.use('/api/tenants', authWithTenant, tenantsRoutes);
app.use('/api/users', authWithTenant, usersRoutes);

// Rutas específicas de rendiciones
app.use('/api/documentos', authWithTenant, documentosRoutes);
```

### FASE 3: Extracción de `@tuorg/parametros` y `@tuorg/ai-prompts` (Semana 7-8)

Repetir proceso similar a FASE 2 para:
- `@tuorg/parametros`
- `@tuorg/ai-prompts`

### FASE 4: Extracción de `@tuorg/ui-components` (Semana 9-10)

#### 4.1 Crear Paquete React
```json
// packages/ui-components/package.json
{
  "name": "@tuorg/ui-components",
  "version": "1.0.0",
  "main": "src/index.js",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./components/*": "./src/components/*",
    "./contexts/*": "./src/contexts/*",
    "./hooks/*": "./src/hooks/*"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.0"
  },
  "peerDependencies": {
    "next": "^14.0.0"
  }
}
```

#### 4.2 Mover Componentes
```bash
# Componentes compartidos
cp -r packages/web/src/components/usuarios packages/ui-components/src/components/
cp -r packages/web/src/components/parametros packages/ui-components/src/components/
cp -r packages/web/src/components/layout packages/ui-components/src/components/
```

#### 4.3 Contexts y Hooks
```javascript
// packages/ui-components/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children, apiUrl }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    // Cargar usuario desde localStorage o API
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setUser(data.user);
          setTenant(data.tenant);
        });
    }
  }, [apiUrl]);

  return (
    <AuthContext.Provider value={{ user, tenant, setUser, setTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

#### 4.4 Uso en Apps
```javascript
// apps/rendiciones/frontend/src/app/layout.jsx
import { AuthProvider } from '@tuorg/ui-components/contexts/AuthContext';
import { UserTable } from '@tuorg/ui-components/components/usuarios/UserTable';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider apiUrl={process.env.NEXT_PUBLIC_API_URL}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### FASE 5: Crear App Core Admin (Semana 11-12)

#### 5.1 Estructura
```
apps/core-admin/
├── backend/
│   ├── src/
│   │   ├── index.js              # Servidor Express
│   │   ├── routes/
│   │   │   └── admin.js          # Rutas administrativas
│   │   └── config/
│   │       └── database.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── tenants/          # Gestión de tenants
    │   │   ├── users/            # Gestión de usuarios
    │   │   ├── planes/           # Gestión de planes
    │   │   └── parametros/       # Gestión de parámetros
    │   └── components/
    └── package.json
```

#### 5.2 Backend Core
```javascript
// apps/core-admin/backend/src/index.js
import express from 'express';
import cors from 'cors';
import { authWithTenant, requireRole } from '@tuorg/auth-core/middleware';
import { tenantsRoutes, usersRoutes, planesRoutes } from '@tuorg/tenant-admin';
import { parametrosRoutes } from '@tuorg/parametros';
import { promptsRoutes } from '@tuorg/ai-prompts';

const app = express();

app.use(cors());
app.use(express.json());

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas administrativas (requieren superuser)
app.use('/api/tenants', authWithTenant, requireRole('superuser'), tenantsRoutes);
app.use('/api/users', authWithTenant, usersRoutes);
app.use('/api/planes', authWithTenant, requireRole('superuser'), planesRoutes);

// Rutas de configuración
app.use('/api/parametros', authWithTenant, parametrosRoutes);
app.use('/api/prompts', authWithTenant, promptsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Core Admin Backend listening on port ${PORT}`);
});
```

#### 5.3 Frontend Core
```javascript
// apps/core-admin/frontend/src/app/tenants/page.jsx
import { UserTable } from '@tuorg/ui-components/components/usuarios/UserTable';
import { TenantForm } from '@tuorg/ui-components/components/tenants/TenantForm';

export default function TenantsPage() {
  return (
    <div>
      <h1>Gestión de Tenants</h1>
      <TenantForm />
      <TenantTable />
    </div>
  );
}
```

### FASE 6: Migrar App Rendiciones al Monorepo (Semana 13-14)

#### 6.1 Mover Archivos
```bash
# Crear estructura
mkdir -p apps/rendiciones

# Mover backend
mv backend apps/rendiciones/

# Mover frontend
mv packages/web apps/rendiciones/frontend
```

#### 6.2 Actualizar package.json
```json
// apps/rendiciones/backend/package.json
{
  "name": "rendiciones-backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@tuorg/auth-core": "workspace:*",
    "@tuorg/tenant-admin": "workspace:*",
    "@tuorg/parametros": "workspace:*",
    "@tuorg/ai-prompts": "workspace:*",
    "express": "^4.18.0",
    "prisma": "^5.0.0"
  }
}
```

```json
// apps/rendiciones/frontend/package.json
{
  "name": "rendiciones-frontend",
  "version": "1.0.0",
  "dependencies": {
    "@tuorg/ui-components": "workspace:*",
    "next": "^14.0.0",
    "react": "^18.2.0"
  }
}
```

#### 6.3 Prisma Schema (solo modelos específicos)
```prisma
// apps/rendiciones/backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("RENDICIONES_DATABASE_URL")
}

// Solo modelos específicos de rendiciones
model DocumentoProcesado {
  id                        String    @id @default(uuid())
  tenantId                  String    // FK virtual a core.tenants.id
  rendicionItemId           String?
  nombreArchivo             String
  tipoArchivo               String
  estadoProcesamiento       String
  datosExtraidos            Json?
  // ... resto de campos

  lineas                    DocumentoLinea[]
  impuestos                 DocumentoImpuesto[]

  @@index([tenantId])
}

model DocumentoLinea {
  id                        String    @id @default(uuid())
  documentoId               String
  tenantId                  String
  numero                    Int
  descripcion               String
  // ... resto de campos

  documento                 DocumentoProcesado @relation(fields: [documentoId], references: [id], onDelete: Cascade)

  @@index([documentoId])
  @@index([tenantId])
}

// ... resto de modelos específicos
```

#### 6.4 Actualizar Imports
```bash
# Script de actualización masiva
./scripts/update-rendiciones-imports.sh
```

```bash
#!/bin/bash
# scripts/update-rendiciones-imports.sh

echo "🔄 Actualizando imports en rendiciones..."

APP_DIR="apps/rendiciones/backend/src"

# Actualizar middleware
find $APP_DIR -name "*.js" -exec sed -i \
  "s|from ['\"]\\.\\./middleware/authWithTenant['\"]|from '@tuorg/auth-core/middleware'|g" {} \;

# Actualizar servicios
find $APP_DIR -name "*.js" -exec sed -i \
  "s|from ['\"]\\.\\./services/FeatureService['\"]|from '@tuorg/tenant-admin/services'|g" {} \;

echo "✅ Imports actualizados"
```

#### 6.5 Testing
```bash
cd apps/rendiciones/backend
pnpm install
pnpm prisma generate
pnpm dev
```

### FASE 7: Separación de Bases de Datos (Semana 15-16)

#### 7.1 Crear Nueva BD para Rendiciones
```bash
# En Servidor 2
sudo -u postgres psql

CREATE DATABASE rendiciones_db;
CREATE USER rendiciones_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE rendiciones_db TO rendiciones_user;
```

#### 7.2 Migrar Datos
```bash
# Script de migración
./scripts/migrate-db-rendiciones.sh
```

```bash
#!/bin/bash
# scripts/migrate-db-rendiciones.sh

echo "📦 Migrando datos de rendiciones..."

# Variables
OLD_DB="postgresql://user:pass@localhost:5432/ecosystem_db"
NEW_DB="postgresql://rendiciones_user:secure_password@localhost:5433/rendiciones_db"

# 1. Exportar schema de rendiciones
pg_dump $OLD_DB \
  -t documentos_procesados \
  -t documento_lineas \
  -t documento_impuestos \
  -t rendicion_tarjeta_items \
  -t tarjetas \
  -t cajas \
  --schema-only > rendiciones_schema.sql

# 2. Exportar datos
pg_dump $OLD_DB \
  -t documentos_procesados \
  -t documento_lineas \
  -t documento_impuestos \
  -t rendicion_tarjeta_items \
  -t tarjetas \
  -t cajas \
  --data-only > rendiciones_data.sql

# 3. Restaurar en nueva BD
psql $NEW_DB -f rendiciones_schema.sql
psql $NEW_DB -f rendiciones_data.sql

# 4. Verificar conteos
echo "Verificando migración..."
psql $OLD_DB -c "SELECT COUNT(*) FROM documentos_procesados"
psql $NEW_DB -c "SELECT COUNT(*) FROM documentos_procesados"

echo "✅ Migración completada"
```

#### 7.3 Actualizar Conexiones
```env
# apps/rendiciones/backend/.env
RENDICIONES_DATABASE_URL=postgresql://rendiciones_user:secure_password@localhost:5433/rendiciones_db
CORE_DATABASE_URL=postgresql://core_user:secure_password@192.168.1.10:5432/core_db
CORE_API_URL=http://192.168.1.10:5000
```

#### 7.4 Validación de Tenants Cross-Database
```javascript
// apps/rendiciones/backend/src/middleware/validateTenant.js
import { PrismaClient as CorePrismaClient } from '@tuorg/auth-core/database';

const coreDB = new CorePrismaClient({
  datasources: {
    db: { url: process.env.CORE_DATABASE_URL }
  }
});

export async function validateTenantMiddleware(req, res, next) {
  const { tenantId } = req;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId requerido' });
  }

  try {
    const tenant = await coreDB.tenant.findUnique({
      where: { id: tenantId },
      include: { planRelation: true }
    });

    if (!tenant || !tenant.activo) {
      return res.status(403).json({ error: 'Tenant inválido o inactivo' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Error validando tenant:', error);
    res.status(500).json({ error: 'Error interno' });
  }
}
```

### FASE 8: Deployment Multi-Servidor (Semana 17-18)

#### 8.1 Preparar Servidor 1 (Core)
```bash
# Conectar a Servidor 1
ssh user@192.168.1.10

# Clonar repo
git clone https://github.com/tuorg/ecosystem.git
cd ecosystem

# Instalar dependencias
pnpm install

# Build paquetes compartidos
pnpm --filter "@tuorg/*" build

# Setup PostgreSQL
sudo apt install postgresql
sudo -u postgres psql -c "CREATE DATABASE core_db;"

# Migrar BD
cd apps/core-admin/backend
npx prisma migrate deploy

# Configurar PM2
pm2 start ecosystem.config.js --only core-backend,admin-frontend
pm2 save
pm2 startup
```

#### 8.2 Preparar Servidor 2 (Rendiciones)
```bash
# Conectar a Servidor 2
ssh user@192.168.1.20

# Clonar repo (solo branch de rendiciones, opcional)
git clone https://github.com/tuorg/ecosystem.git
cd ecosystem

pnpm install
pnpm --filter "@tuorg/*" build

# Setup PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE rendiciones_db;"

# Migrar datos (desde backup o migración)
cd apps/rendiciones/backend
npx prisma migrate deploy

# Variables de entorno
cat > .env << EOF
PORT=5050
RENDICIONES_DATABASE_URL=postgresql://user:pass@localhost:5433/rendiciones_db
CORE_DATABASE_URL=postgresql://core_user:pass@192.168.1.10:5432/core_db
CORE_API_URL=http://192.168.1.10:5000
EOF

# Configurar PM2
pm2 start ecosystem.config.js --only rendiciones-backend,rendiciones-frontend
pm2 save
```

#### 8.3 Configurar Nginx Gateway (Servidor 1)
```bash
# Instalar Nginx
sudo apt install nginx

# Configurar gateway
sudo nano /etc/nginx/sites-available/api-gateway
```

```nginx
# Gateway que enruta a todas las apps
upstream core_backend {
    server localhost:5000;
}

upstream rendiciones_backend {
    server 192.168.1.20:5050;
}

upstream inventario_backend {
    server 192.168.1.30:5060;
}

server {
    listen 80;
    server_name api.tuorg.com;

    # Core APIs
    location /api/auth {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/tenants {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    location /api/users {
        proxy_pass http://core_backend;
        proxy_set_header Host $host;
    }

    # Rendiciones
    location /api/documentos {
        proxy_pass http://rendiciones_backend;
        proxy_set_header Host $host;
    }

    location /api/rendiciones {
        proxy_pass http://rendiciones_backend;
        proxy_set_header Host $host;
    }

    # Inventario (futuro)
    location /api/inventario {
        proxy_pass http://inventario_backend;
        proxy_set_header Host $host;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/api-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 8.4 Testing End-to-End
```bash
# Desde cliente externo
curl http://api.tuorg.com/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Debería devolver token

# Probar endpoint de rendiciones
curl http://api.tuorg.com/api/documentos \
  -H "Authorization: Bearer <token>"

# Debería devolver documentos del tenant
```

---

## 🧪 Testing y Validación

### Testing de Paquetes Compartidos

#### Unit Tests
```javascript
// packages/auth-core/tests/services/AuthService.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/AuthService.js';

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it('should validate valid JWT token', async () => {
    const token = authService.generateToken({ userId: '123', tenantId: '456' });
    const decoded = authService.verifyToken(token);

    expect(decoded.userId).toBe('123');
    expect(decoded.tenantId).toBe('456');
  });

  it('should reject expired token', async () => {
    const token = authService.generateToken(
      { userId: '123' },
      { expiresIn: '0s' } // Expira inmediatamente
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(() => authService.verifyToken(token)).toThrow('Token expirado');
  });
});
```

#### Integration Tests
```javascript
// packages/auth-core/tests/integration/auth-flow.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../src/services/AuthService.js';

describe('Auth Flow Integration', () => {
  let prisma;
  let authService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } }
    });
    authService = new AuthService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should complete full login flow', async () => {
    // 1. Crear usuario
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: await authService.hashPassword('password123'),
        tenantId: 'test-tenant'
      }
    });

    // 2. Login
    const result = await authService.login('test@example.com', 'password123');

    expect(result.token).toBeDefined();
    expect(result.user.id).toBe(user.id);

    // 3. Verificar token
    const decoded = authService.verifyToken(result.token);
    expect(decoded.userId).toBe(user.id);

    // 4. Cleanup
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

### Testing de Apps

#### E2E Tests con Playwright
```javascript
// apps/rendiciones/frontend/tests/e2e/login.spec.js
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('http://localhost:8084');

    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:8084/dashboard');
    await expect(page.locator('text=Bienvenido')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:8084');

    await page.fill('[name="email"]', 'invalid@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Credenciales inválidas')).toBeVisible();
  });
});
```

### Load Testing
```javascript
// tests/load/auth-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
};

export default function () {
  const loginRes = http.post('http://api.tuorg.com/api/auth/login', {
    email: 'loadtest@example.com',
    password: 'password123',
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'token returned': (r) => r.json('token') !== undefined,
  });

  const token = loginRes.json('token');

  const docsRes = http.get('http://api.tuorg.com/api/documentos', {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(docsRes, {
    'docs status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

```bash
# Ejecutar load test
k6 run tests/load/auth-load.js
```

---

## 🚨 Troubleshooting

### Problema 1: Imports no Resueltos
```
Error: Cannot find module '@tuorg/auth-core/middleware'
```

**Solución:**
```bash
# 1. Verificar que el paquete está en workspace
pnpm list @tuorg/auth-core

# 2. Reinstalar dependencias
pnpm install

# 3. Verificar exports en package.json del paquete
cat packages/auth-core/package.json | grep exports

# 4. Build el paquete
cd packages/auth-core
pnpm build
```

### Problema 2: Prisma Client no Generado
```
Error: @prisma/client did not initialize yet
```

**Solución:**
```bash
# Generar clients de todos los paquetes
pnpm --filter "@tuorg/*" prisma:generate

# O específico
cd packages/auth-core
npx prisma generate
```

### Problema 3: Conexión Cross-Database Falla
```
Error: Connection refused to core database
```

**Solución:**
```bash
# 1. Verificar que PostgreSQL permite conexiones remotas
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Agregar línea:
host    core_db    core_user    192.168.1.0/24    md5

# 2. Permitir listen en todas las interfaces
sudo nano /etc/postgresql/15/main/postgresql.conf

# Cambiar:
listen_addresses = '*'

# 3. Reiniciar PostgreSQL
sudo systemctl restart postgresql

# 4. Probar conexión
psql -h 192.168.1.10 -U core_user -d core_db
```

### Problema 4: Workspace Dependencies Desactualizados
```
Error: Version mismatch between @tuorg/auth-core versions
```

**Solución:**
```bash
# 1. Limpiar todos los node_modules
pnpm clean

# 2. Reinstalar desde cero
pnpm install --force

# 3. Rebuild
pnpm build

# Script de limpieza completa
./scripts/clean-all.sh
```

```bash
#!/bin/bash
# scripts/clean-all.sh
echo "🧹 Limpiando workspace..."

# Eliminar node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# Eliminar dist
find . -name "dist" -type d -prune -exec rm -rf '{}' +

# Eliminar Prisma clients
find . -path "*/.prisma" -type d -prune -exec rm -rf '{}' +

# Reinstalar
pnpm install

echo "✅ Limpieza completada"
```

### Problema 5: PM2 Process No Inicia
```
Error: PM2 process exited with code 1
```

**Solución:**
```bash
# 1. Ver logs detallados
pm2 logs rendiciones-backend --lines 100

# 2. Verificar variables de entorno
pm2 env 0

# 3. Reiniciar con logs en vivo
pm2 delete rendiciones-backend
pm2 start ecosystem.config.js --only rendiciones-backend --watch

# 4. Verificar puerto no está en uso
sudo lsof -i :5050
```

---

## 📚 Comandos Útiles

### Desarrollo
```bash
# Instalar todas las dependencias
pnpm install

# Desarrollo de todos los paquetes
pnpm dev

# Desarrollo de paquete específico
pnpm --filter @tuorg/auth-core dev

# Build de todos los paquetes
pnpm build

# Testing
pnpm test
pnpm test:watch
pnpm test:coverage

# Linting
pnpm lint
pnpm lint:fix
```

### Prisma
```bash
# Generar todos los clients
pnpm --filter "@tuorg/*" prisma:generate

# Crear migración
cd packages/auth-core
npx prisma migrate dev --name add_new_field

# Aplicar migraciones en producción
npx prisma migrate deploy

# Abrir Prisma Studio
npx prisma studio
```

### Deployment
```bash
# Build para producción
pnpm build:prod

# Deploy app específica
./scripts/deploy-app.sh rendiciones

# Rollback
./scripts/rollback-app.sh rendiciones

# Health check
./scripts/health-check.sh
```

---

## 📋 Checklist de Migración

### Pre-Migración
- [ ] Backup completo de base de datos
- [ ] Documentar todos los endpoints actuales
- [ ] Identificar todas las dependencias
- [ ] Crear entorno de testing
- [ ] Configurar CI/CD pipeline

### Durante Migración
- [ ] Corregir constraints de BD
- [ ] Crear estructura de monorepo
- [ ] Extraer paquete auth-core
- [ ] Extraer paquete tenant-admin
- [ ] Extraer paquete parametros
- [ ] Extraer paquete ai-prompts
- [ ] Extraer paquete ui-components
- [ ] Migrar app rendiciones
- [ ] Crear app core-admin
- [ ] Testing exhaustivo

### Post-Migración
- [ ] Separar bases de datos
- [ ] Configurar servidores
- [ ] Deployment en producción
- [ ] Monitoreo y alertas
- [ ] Documentación actualizada
- [ ] Training del equipo

---

## 🎓 Recursos Adicionales

### Documentación
- [Turborepo Docs](https://turbo.build/repo/docs)
- [PNPM Workspaces](https://pnpm.io/workspaces)
- [Prisma Multi-Schema](https://www.prisma.io/docs/concepts/components/prisma-schema/multiple-files)
- [Next.js Monorepo](https://nextjs.org/docs/advanced-features/multi-zones)

### Herramientas
- [Nx](https://nx.dev/) - Alternativa a Turborepo
- [Lerna](https://lerna.js.org/) - Manejo de monorepos
- [Changesets](https://github.com/changesets/changesets) - Versionado de paquetes

---

**Última actualización:** 2025-10-23
**Versión:** 1.0.0
**Autor:** Equipo de Arquitectura
