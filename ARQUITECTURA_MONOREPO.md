# Arquitectura Monorepo - Sistema Axioma

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Estructura del Monorepo](#estructura-del-monorepo)
3. [Aplicaciones del Ecosistema](#aplicaciones-del-ecosistema)
4. [Sistema de Autenticación Unificado](#sistema-de-autenticación-unificado)
5. [Gestión Multi-Tenant](#gestión-multi-tenant)
6. [Arquitectura de Base de Datos](#arquitectura-de-base-de-datos)
7. [App Launcher](#app-launcher)
8. [Flujo de Acceso Completo](#flujo-de-acceso-completo)
9. [Deploy y Configuración](#deploy-y-configuración)
10. [Roadmap de Migración](#roadmap-de-migración)

---

## 🎯 Visión General

El sistema Axioma es un ecosistema de aplicaciones empresariales con:

- **Backend unificado** que gestiona autenticación, tenants y configuración global
- **Múltiples aplicaciones frontend** independientes pero integradas
- **Sistema multi-tenant** que aísla datos por organización
- **Autenticación compartida** entre todas las aplicaciones
- **App Launcher** centralizado para navegación entre apps

### Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────┐
│                    App Launcher                              │
│         rendicionesdemo.axiomacloud.com                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Rendiciones│  │  Parse   │  │Checkpoint│  │   Docs   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend Unificado (Puerto 5050)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Auth     │  │   Tenants   │  │   Config    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Rendiciones │  │    Parse    │  │ Checkpoint  │         │
│  │     API     │  │     API     │  │     API     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL Database                          │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│    │  tenants │  │  users   │  │rendiciones│               │
│    └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Monorepo

### Estado Actual

```
Rendiciones/
├── backend/                          # Backend Node.js + Express + Prisma
│   ├── src/
│   │   ├── index.js                  # Entry point
│   │   ├── routes/
│   │   │   ├── auth.js               # Autenticación unificada
│   │   │   ├── tenants.js            # Gestión de tenants
│   │   │   ├── users.js              # Gestión de usuarios
│   │   │   ├── menu.js               # Menú dinámico
│   │   │   ├── rendiciones.js        # API Rendiciones
│   │   │   ├── comprobantes.js       # API Comprobantes
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   ├── auth.js               # Middleware de autenticación
│   │   │   └── authWithTenant.js     # Auth + filtrado por tenant
│   │   └── services/
│   ├── prisma/
│   │   ├── schema.prisma             # Schema Prisma unificado
│   │   └── migrations/
│   └── package.json
│
├── packages/
│   └── web/                          # Frontend Next.js (Rendiciones + Launcher)
│       ├── src/
│       │   ├── app/
│       │   │   ├── app-launcher/     # ⭐ App Launcher
│       │   │   │   └── page.tsx
│       │   │   ├── auth/             # Login/Register compartido
│       │   │   │   ├── login/
│       │   │   │   └── register/
│       │   │   ├── dashboard/        # Rendiciones Dashboard
│       │   │   ├── rendiciones/      # Rendiciones features
│       │   │   ├── parse/            # Parse features (futuro)
│       │   │   └── admin/
│       │   │       ├── tenants/      # ⭐ Gestión de tenants
│       │   │       ├── menu/         # ⭐ Gestión de menú
│       │   │       └── ...
│       │   ├── components/
│       │   │   ├── launcher/         # Componentes del launcher
│       │   │   │   └── AppCard.tsx
│       │   │   └── layout/
│       │   │       └── Sidebar.tsx   # Sidebar con logo clickeable
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx   # ⭐ Contexto de autenticación
│       │   └── hooks/
│       │       └── useMenu.ts        # Hook para menú dinámico
│       ├── .env.local                # Config para desarrollo
│       ├── .env.production           # Config para producción
│       └── package.json
│
├── ARQUITECTURA_MONOREPO.md          # ⭐ Este archivo
├── CLAUDE.md                         # Instrucciones para Claude
└── package.json                      # Root package.json
```

### Estructura Futura (Migración a Subdominios)

```
Rendiciones/
├── backend/                          # Backend unificado
│
├── packages/
│   ├── web-launcher/                 # Next.js - app.axioma.com
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── launcher/
│   │   │   └── components/
│   │   └── .env.production
│   │       NEXT_PUBLIC_API_URL=https://api.axiomacloud.com
│   │
│   ├── web-rendiciones/              # Next.js - rendiciones.axiomacloud.com
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── dashboard/
│   │   │   │   └── rendiciones/
│   │   │   └── components/
│   │   └── .env.production
│   │       NEXT_PUBLIC_API_URL=https://api.axiomacloud.com
│   │
│   ├── web-parse/                    # Next.js - parse.axiomacloud.com
│   │   └── (estructura similar)
│   │
│   ├── web-checkpoint/               # Next.js - checkpoint.axiomacloud.com
│   │   └── (estructura similar)
│   │
│   ├── web-docs/                     # Vite + React - docs.axiomacloud.com
│   │   └── (estructura Vite)
│   │
│   ├── shared-components/            # Componentes React compartidos
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Card.tsx
│   │   └── package.json
│   │       {
│   │         "name": "@axioma/shared-components",
│   │         "peerDependencies": {
│   │           "react": "^18.0.0"
│   │         }
│   │       }
│   │
│   ├── shared-types/                 # Types TypeScript compartidos
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── tenant.ts
│   │   │   └── api.ts
│   │   └── package.json
│   │
│   └── shared-utils/                 # Utilidades compartidas
│       ├── src/
│       │   ├── format.ts
│       │   ├── validation.ts
│       │   └── api.ts
│       └── package.json
│
└── package.json                      # Root con workspaces
    {
      "workspaces": [
        "packages/*",
        "backend"
      ],
      "scripts": {
        "dev": "concurrently \"npm run dev:*\"",
        "dev:launcher": "npm run dev -w @axioma/web-launcher",
        "dev:rendiciones": "npm run dev -w @axioma/web-rendiciones",
        "build": "npm run build:launcher && npm run build:rendiciones"
      }
    }
```

---

## 🚀 Aplicaciones del Ecosistema

### 1. **Rendiciones**
- **Descripción:** Gestión completa de rendiciones de gastos y documentos
- **URL Actual:** https://rendicionesdemo.axiomacloud.com
- **URL Futura:** https://rendiciones.axiomacloud.com
- **Stack:** Next.js 14
- **Color:** Púrpura (#8E6AAA / #352151)
- **Ícono:** FileText

### 2. **Parse**
- **Descripción:** Extracción inteligente de datos con IA
- **URL Actual:** https://rendicionesdemo.axiomacloud.com/parse
- **URL Futura:** https://parse.axiomacloud.com
- **Stack:** Next.js 14
- **Color:** Verde (#10b981 / #059669)
- **Ícono:** ScanText

### 3. **Checkpoint**
- **Descripción:** Gestión de RRHH
- **URL Actual:** https://checkpoint.axiomacloud.com (externo)
- **URL Futura:** https://checkpoint.axiomacloud.com (integrado)
- **Stack:** Next.js 14 (a migrar)
- **Color:** Naranja/Rojo (#f97316 / #dc2626)
- **Ícono:** CheckCircle

### 4. **Docs**
- **Descripción:** Gestión de ISO y Documentación
- **URL Actual:** https://docs.axiomacloud.com (externo)
- **URL Futura:** https://docs.axiomacloud.com (integrado)
- **Stack:** Vite + React
- **Color:** Cyan/Sky (#06b6d4 / #0284c7)
- **Ícono:** BookOpen

---

## 🔐 Sistema de Autenticación Unificado

### Modelo de Usuario

```prisma
// backend/prisma/schema.prisma
model users {
  id                   String    @id @default(cuid())
  email                String    @unique
  password             String?
  nombre               String?
  apellido             String?
  googleId             String?   @unique
  superuser            Boolean   @default(false)
  esUsuarioTesoreria   Boolean   @default(false)
  tenantId             String?
  tenant               tenants?  @relation(fields: [tenantId], references: [id])
  profileId            String?
  profile              perfiles? @relation(fields: [profileId], references: [id])
  emailVerified        Boolean   @default(false)
  verificationToken    String?
  resetPasswordToken   String?
  resetPasswordExpires DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}
```

### Flujo de Autenticación

```typescript
// Frontend: packages/web/src/contexts/AuthContext.tsx
export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  superuser?: boolean;
  esUsuarioTesoreria?: boolean;
  profile?: {
    id: string;
    codigo: string;
    descripcion: string;
  };
  tenant?: {
    id: string;
    nombre: string;
  };
}

// Login
const login = async (email: string, password: string) => {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  setUser(data.user);
  localStorage.setItem('token', data.token);
};
```

```javascript
// Backend: backend/src/routes/auth.js
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validar credenciales
  const user = await prisma.users.findUnique({ where: { email } });
  const isValid = await bcrypt.compare(password, user.password);

  // Generar JWT con tenantId
  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      superuser: user.superuser
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Cookie compartida en todos los subdominios (futuro)
  res.cookie('axioma_token', token, {
    domain: '.axiomacloud.com',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ token, user });
});
```

### Middleware de Autenticación con Tenant

```javascript
// backend/src/middleware/authWithTenant.js
const authWithTenant = async (req, res, next) => {
  try {
    const token = req.cookies.axioma_token ||
                  req.headers.authorization?.split(' ')[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    // Agregar info al request
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.isSuperuser = decoded.superuser;

    // Cargar usuario completo
    req.user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: true,
        profile: true
      }
    });

    next();
  } catch (error) {
    res.status(401).json({ error: 'No autorizado' });
  }
};

// Uso en rutas
router.get('/api/rendiciones', authWithTenant, async (req, res) => {
  // Automáticamente filtrado por tenant
  const rendiciones = await prisma.rendiciones.findMany({
    where: {
      tenantId: req.tenantId  // ⭐ Filtrado automático
    }
  });

  res.json(rendiciones);
});
```

---

## 🏢 Gestión Multi-Tenant

### Modelo de Tenant

```prisma
model tenants {
  id                String    @id @default(cuid())
  nombre            String
  razonSocial       String?
  cuit              String?   @unique
  email             String?
  telefono          String?
  direccion         String?
  logoUrl           String?
  activo            Boolean   @default(true)
  configuracion     Json?     // Configuraciones específicas del tenant
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relaciones
  users             users[]
  rendiciones       rendiciones[]
  comprobantes      comprobantes[]
  tarjetas          tarjetas[]
  menu_items        menu_items[]
}
```

### Configuración por Tenant

```json
// Ejemplo de configuracion JSON en tenant
{
  "theme": {
    "primaryColor": "#8E6AAA",
    "logo": "https://cdn.example.com/logo.png"
  },
  "features": {
    "rendiciones": true,
    "parse": true,
    "checkpoint": false,
    "docs": true
  },
  "limites": {
    "maxUsuarios": 100,
    "maxRendicionesMes": 1000,
    "almacenamientoGB": 50
  },
  "integraciones": {
    "gemini": {
      "enabled": true,
      "apiKey": "encrypted_key"
    },
    "afip": {
      "enabled": true,
      "cuit": "20-12345678-9"
    }
  }
}
```

### Filtrado Automático por Tenant

Todas las consultas en el backend automáticamente filtran por `tenantId`:

```javascript
// ❌ MALO - Sin filtrado
const rendiciones = await prisma.rendiciones.findMany();

// ✅ BUENO - Con filtrado automático
router.get('/api/rendiciones', authWithTenant, async (req, res) => {
  const rendiciones = await prisma.rendiciones.findMany({
    where: {
      tenantId: req.tenantId  // Viene del middleware
    }
  });
  res.json(rendiciones);
});

// ✅ MEJOR - Helper function
const getTenantData = async (model, userId, additionalFilters = {}) => {
  const user = await prisma.users.findUnique({ where: { id: userId } });

  return await prisma[model].findMany({
    where: {
      tenantId: user.tenantId,
      ...additionalFilters
    }
  });
};
```

---

## 🗄️ Arquitectura de Base de Datos

### Decisión: Schemas Separados (Opción Híbrida)

El sistema utiliza **una sola instancia de PostgreSQL** con **schemas separados por aplicación**. Esto proporciona aislamiento lógico manteniendo la simplicidad operacional.

### Estructura de Schemas

```
PostgreSQL Database (axioma_db)
├── Schema: core                     ← Compartido entre todas las apps
│   ├── tenants
│   ├── users
│   ├── roles
│   ├── permissions
│   ├── menu_items
│   └── sync_admin
│
├── Schema: rendiciones              ← Específico de Rendiciones
│   ├── rendiciones
│   ├── comprobantes
│   ├── tarjetas
│   ├── planes
│   ├── bancos
│   └── categorias
│
├── Schema: parse                    ← Específico de Parse
│   ├── documents
│   ├── templates
│   ├── extractions
│   └── ai_models
│
├── Schema: checkpoint               ← Específico de Checkpoint
│   ├── empleados
│   ├── turnos
│   ├── asistencias
│   └── licencias
│
└── Schema: docs                     ← Específico de Docs
    ├── documentos
    ├── versiones
    ├── categorias
    └── aprobaciones
```

### Comparativa de Opciones

| Aspecto | DB Única | DB por App | Schemas (Elegida) |
|---------|----------|------------|-------------------|
| **Complejidad** | ⚠️ Media | ❌ Alta | ✅ Baja-Media |
| **Mantenimiento** | ⚠️ Schema grande | ❌ Múltiples DBs | ✅ Schemas organizados |
| **Backups** | ✅ Un backup | ❌ N backups | ✅ Un backup |
| **Escalabilidad** | ❌ Limitada | ✅ Excelente | ⚠️ Buena |
| **Aislamiento** | ❌ Bajo | ✅ Total | ✅ Alto (lógico) |
| **Performance** | ⚠️ Comparten recursos | ✅ Dedicado | ⚠️ Comparten, pero mejor |
| **Costo Infra** | ✅ Bajo | ❌ Alto | ✅ Bajo |
| **Migraciones** | ⚠️ Monolíticas | ❌ Múltiples | ✅ Por schema |
| **Transacciones** | ✅ Nativas | ❌ Distribuidas | ✅ Nativas en schema |

### Ventajas de Schemas Separados

1. **Aislamiento Lógico**
   - No puedes hacer `JOIN` accidental entre apps
   - Permisos de BD se pueden configurar por schema
   - Cada equipo trabaja en su schema sin riesgo

2. **Infraestructura Simple**
   - Un solo servidor PostgreSQL
   - Un solo backup/restore
   - Una sola conexión (menor overhead)

3. **Migraciones Independientes**
   - Cada app maneja sus propias migraciones
   - Sin riesgo de conflictos entre apps
   - Rollback independiente por schema

4. **Fácil Evolución**
   - Si una app crece mucho, puedes moverla a su propia DB
   - El schema se exporta/importa fácilmente

### Implementación en Prisma

```prisma
// backend/prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["core", "rendiciones", "parse", "checkpoint", "docs"]
}

// ============================================
// SCHEMA CORE - Datos Compartidos
// ============================================

model tenants {
  @@schema("core")
  id           String   @id @default(cuid())
  nombre       String
  razonSocial  String?
  cuit         String?  @unique
  activo       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  users        users[]
}

model users {
  @@schema("core")
  id             String    @id @default(cuid())
  email          String    @unique
  password       String?
  nombre         String?
  apellido       String?
  superuser      Boolean   @default(false)
  tenantId       String?
  tenant         tenants?  @relation(fields: [tenantId], references: [id])
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([tenantId])
  @@index([email])
}

model menu_items {
  @@schema("core")
  id             String       @id @default(cuid())
  parentId       String?
  title          String
  icon           String
  url            String?
  orderIndex     Int          @default(0)
  isActive       Boolean      @default(true)
  superuserOnly  Boolean      @default(false)
  tenantId       String?
  tenant         tenants?     @relation(fields: [tenantId], references: [id])
  parent         menu_items?  @relation("MenuHierarchy", fields: [parentId], references: [id])
  children       menu_items[] @relation("MenuHierarchy")

  @@index([tenantId])
  @@index([parentId])
}

// ============================================
// SCHEMA RENDICIONES - Datos Específicos
// ============================================

model rendiciones {
  @@schema("rendiciones")
  id                String   @id @default(cuid())
  tenantId          String   // Solo guarda el ID, no relación directa
  userId            String
  numero            String
  fecha             DateTime
  total             Decimal  @db.Decimal(10, 2)
  estado            String
  observaciones     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  comprobantes      comprobantes[]

  @@index([tenantId])
  @@index([userId])
  @@index([estado])
}

model comprobantes {
  @@schema("rendiciones")
  id              String      @id @default(cuid())
  rendicionId     String
  rendicion       rendiciones @relation(fields: [rendicionId], references: [id])
  tenantId        String
  tipoComprobante String
  numero          String?
  fecha           DateTime?
  monto           Decimal     @db.Decimal(10, 2)
  createdAt       DateTime    @default(now())

  @@index([rendicionId])
  @@index([tenantId])
}

model tarjetas {
  @@schema("rendiciones")
  id              String   @id @default(cuid())
  tenantId        String
  nombre          String
  ultimos4Digitos String
  bancoId         String?
  activo          Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@index([tenantId])
}

// ============================================
// SCHEMA PARSE - Datos Específicos
// ============================================

model parse_documents {
  @@schema("parse")
  id            String   @id @default(cuid())
  tenantId      String
  userId        String
  filename      String
  fileUrl       String
  status        String   // pending, processing, completed, failed
  extractedData Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([tenantId])
  @@index([userId])
  @@index([status])
}

model parse_templates {
  @@schema("parse")
  id          String   @id @default(cuid())
  tenantId    String
  nombre      String
  tipoDoc     String
  campos      Json     // Definición de campos a extraer
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@index([tipoDoc])
}

// ============================================
// SCHEMA CHECKPOINT - Datos Específicos
// ============================================

model checkpoint_empleados {
  @@schema("checkpoint")
  id          String   @id @default(cuid())
  tenantId    String
  legajo      String
  nombre      String
  apellido    String
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@index([legajo])
}

model checkpoint_turnos {
  @@schema("checkpoint")
  id          String   @id @default(cuid())
  tenantId    String
  empleadoId  String
  fecha       DateTime
  horaEntrada DateTime?
  horaSalida  DateTime?
  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@index([empleadoId])
  @@index([fecha])
}

// ============================================
// SCHEMA DOCS - Datos Específicos
// ============================================

model docs_documentos {
  @@schema("docs")
  id          String   @id @default(cuid())
  tenantId    String
  titulo      String
  codigo      String
  version     String
  fileUrl     String
  estado      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
  @@index([codigo])
}
```

### Migraciones por Schema

```bash
# Crear migración para schema core
npx prisma migrate dev --name add_menu_items --schema=core

# Crear migración para schema rendiciones
npx prisma migrate dev --name add_tarjetas --schema=rendiciones

# Aplicar todas las migraciones en producción
npx prisma migrate deploy
```

### Consultas Cross-Schema

```typescript
// backend/src/services/rendicionService.js

// ✅ PERMITIDO: Consultar datos de tu schema
const rendiciones = await prisma.rendiciones.findMany({
  where: { tenantId: req.tenantId },
  include: {
    comprobantes: true  // Mismo schema
  }
});

// ✅ PERMITIDO: Consultar datos compartidos (core)
const user = await prisma.users.findUnique({
  where: { id: userId },
  include: {
    tenant: true  // Schema core
  }
});

// ❌ NO PERMITIDO: JOIN directo entre schemas diferentes
// No puedes hacer:
// rendiciones { tenant: true }
// Prisma no permite relaciones cross-schema

// ✅ SOLUCIÓN: Consultas separadas
const rendicion = await prisma.rendiciones.findUnique({
  where: { id: rendicionId }
});

const tenant = await prisma.tenants.findUnique({
  where: { id: rendicion.tenantId }
});
```

### Permisos de Base de Datos

```sql
-- Crear usuarios por aplicación
CREATE USER rendiciones_app WITH PASSWORD 'secure_password';
CREATE USER parse_app WITH PASSWORD 'secure_password';
CREATE USER checkpoint_app WITH PASSWORD 'secure_password';

-- Dar permisos solo al schema correspondiente
GRANT USAGE ON SCHEMA core TO rendiciones_app, parse_app, checkpoint_app;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO rendiciones_app, parse_app, checkpoint_app;

GRANT ALL PRIVILEGES ON SCHEMA rendiciones TO rendiciones_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rendiciones TO rendiciones_app;

GRANT ALL PRIVILEGES ON SCHEMA parse TO parse_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA parse TO parse_app;

GRANT ALL PRIVILEGES ON SCHEMA checkpoint TO checkpoint_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA checkpoint TO checkpoint_app;
```

### Migración Desde Schema Público

**Paso 1: Crear los nuevos schemas**
```sql
CREATE SCHEMA core;
CREATE SCHEMA rendiciones;
CREATE SCHEMA parse;
CREATE SCHEMA checkpoint;
CREATE SCHEMA docs;
```

**Paso 2: Mover tablas existentes**
```sql
-- Mover tablas comunes a core
ALTER TABLE public.tenants SET SCHEMA core;
ALTER TABLE public.users SET SCHEMA core;
ALTER TABLE public.menu_items SET SCHEMA core;
ALTER TABLE public.perfiles SET SCHEMA core;

-- Mover tablas de rendiciones
ALTER TABLE public.rendiciones SET SCHEMA rendiciones;
ALTER TABLE public.comprobantes SET SCHEMA rendiciones;
ALTER TABLE public.tarjetas SET SCHEMA rendiciones;
ALTER TABLE public.planes SET SCHEMA rendiciones;
ALTER TABLE public.bancos SET SCHEMA rendiciones;
ALTER TABLE public.categorias SET SCHEMA rendiciones;

-- Verificar
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('core', 'rendiciones', 'parse', 'checkpoint', 'docs')
ORDER BY schemaname, tablename;
```

**Paso 3: Actualizar Prisma**
```bash
# Actualizar schema.prisma con los @@schema()
# Regenerar cliente
npx prisma generate

# Crear snapshot de migración
npx prisma migrate dev --name separate_schemas --create-only

# Editar la migración para que use ALTER TABLE SET SCHEMA
# Aplicar migración
npx prisma migrate deploy
```

### Estrategia de Backup

```bash
# Backup completo (todas las apps)
pg_dump axioma_db > backup_completo.sql

# Backup por schema (app específica)
pg_dump -n rendiciones axioma_db > backup_rendiciones.sql
pg_dump -n parse axioma_db > backup_parse.sql

# Restore de schema específico
psql axioma_db < backup_rendiciones.sql

# Backup solo de core (para restaurar en otra instancia)
pg_dump -n core axioma_db > backup_core.sql
```

### Monitoreo por Schema

```sql
-- Ver tamaño de cada schema
SELECT
  schemaname,
  pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size
FROM pg_tables
WHERE schemaname IN ('core', 'rendiciones', 'parse', 'checkpoint', 'docs')
GROUP BY schemaname
ORDER BY SUM(pg_total_relation_size(schemaname||'.'||tablename)) DESC;

-- Ver tablas más grandes por schema
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'rendiciones'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Evolución Futura: Separar a DB Independiente

Si una app crece mucho y necesita su propia base de datos:

```bash
# 1. Exportar schema completo
pg_dump -n rendiciones axioma_db > rendiciones_export.sql

# 2. Crear nueva base de datos
createdb rendiciones_db

# 3. Importar schema
psql rendiciones_db < rendiciones_export.sql

# 4. Actualizar connection string de la app
DATABASE_URL_RENDICIONES=postgresql://user:pass@host/rendiciones_db

# 5. El schema core se mantiene en la DB original
# Las apps consultan core para auth y tenants
```

---

## 🚀 App Launcher

### Componente Principal

```typescript
// packages/web/src/app/app-launcher/page.tsx
const apps: App[] = [
  {
    id: 'rendiciones',
    name: 'Rendiciones',
    description: 'Gestión completa de rendiciones de gastos y documentos',
    icon: <FileText className="w-16 h-16 text-white" />,
    color: '#352151',
    bgColor: '#8E6AAA',
    route: '/dashboard',  // Ruta interna (actual)
    // route: 'https://rendiciones.axiomacloud.com',  // URL externa (futuro)
  },
  {
    id: 'checkpoint',
    name: 'Checkpoint',
    description: 'Gestión de RRHH',
    icon: <CheckCircle className="w-16 h-16 text-white" />,
    color: '#dc2626',
    bgColor: '#f97316',
    route: 'https://checkpoint.axiomacloud.com',  // URL externa
  },
  // ... otras apps
];
```

### Animaciones

```typescript
// Entrada: Tarjetas caen desde arriba en cascada
const [isEntering, setIsEntering] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => setIsEntering(true), 100);
  return () => clearTimeout(timer);
}, []);

// En el render
{apps.map((app, index) => (
  <div
    style={{
      transform: isEntering ? 'translateY(0)' : 'translateY(-100vh)',
      opacity: isEntering ? 1 : 0,
      transitionDelay: `${index * 200}ms`,
      transition: 'all 1s ease-out'
    }}
  >
    <AppCard app={app} />
  </div>
))}
```

### Integración con Sidebar

```typescript
// packages/web/src/components/layout/Sidebar.tsx
// Click en logo de Axioma vuelve al launcher
<button
  onClick={() => router.push('/app-launcher')}
  className="bg-sidebar hover:opacity-80 transition-opacity"
  title="Volver a Aplicaciones"
>
  <Image src={axiomaLogo} alt="Axioma Logo" />
</button>
```

---

## 🔄 Flujo de Acceso Completo

### 1. Primera Vez

```
Usuario → https://rendicionesdemo.axiomacloud.com
           ↓ (no autenticado)
       /auth/login
           ↓ (ingresa credenciales)
       POST /api/auth/login
           ↓ (JWT generado con tenantId)
       Cookie + localStorage
           ↓
       /app-launcher (muestra apps disponibles)
           ↓ (selecciona "Rendiciones")
       /dashboard (app Rendiciones)
```

### 2. Usuario Recurrente

```
Usuario → https://rendicionesdemo.axiomacloud.com
           ↓ (cookie válida)
       /app-launcher (muestra apps según permisos)
           ↓ (selecciona "Parse")
       /parse (app Parse)
```

### 3. Navegación Entre Apps (Actual)

```
Dentro de Rendiciones:
  Click en logo Axioma (sidebar)
    ↓
  /app-launcher
    ↓ (selecciona "Checkpoint")
  https://checkpoint.axiomacloud.com (redirect externo)
```

### 4. Navegación Entre Apps (Futuro con Subdominios)

```
En https://rendiciones.axiomacloud.com:
  Click en logo Axioma
    ↓
  https://app.axiomacloud.com/launcher
    ↓ (selecciona "Parse")
  https://parse.axiomacloud.com
    ↓ (cookie .axiomacloud.com compartida)
  Automáticamente autenticado
```

---

## 🚢 Deploy y Configuración

### Configuración Actual (Monolito)

```bash
# Servidor: VPS
# Path: /var/www/Rendiciones

# Backend
cd /var/www/Rendiciones/backend
PORT=5050 npm start

# Frontend
cd /var/www/Rendiciones/packages/web
npm run build
PORT=8084 npm start
# Servido por PM2
```

### Variables de Entorno

```bash
# packages/web/.env.local (desarrollo)
NEXT_PUBLIC_API_URL=http://localhost:5050
NODE_ENV=development

# packages/web/.env.local (producción)
NEXT_PUBLIC_API_URL=https://rendicionesdemo.axiomacloud.com
BASE_URL=https://rendicionesdemo.axiomacloud.com
NODE_ENV=production
```

### PM2 Configuration

```json
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'rendiciones-backend',
      script: 'src/index.js',
      cwd: '/var/www/Rendiciones/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 5050
      }
    },
    {
      name: 'rendiciones-web',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/Rendiciones/packages/web',
      env: {
        NODE_ENV: 'production',
        PORT: 8084
      }
    }
  ]
};
```

### Nginx Configuration

```nginx
# Configuración actual
server {
    listen 443 ssl;
    server_name rendicionesdemo.axiomacloud.com;

    # Frontend
    location / {
        proxy_pass http://localhost:8084;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
}
```

### Nginx Configuration (Futuro con Subdominios)

```nginx
# App Launcher
server {
    listen 443 ssl;
    server_name app.axiomacloud.com;

    location / {
        proxy_pass http://localhost:3000;
    }
}

# Rendiciones
server {
    listen 443 ssl;
    server_name rendiciones.axiomacloud.com;

    location / {
        proxy_pass http://localhost:3001;
    }
}

# Parse
server {
    listen 443 ssl;
    server_name parse.axiomacloud.com;

    location / {
        proxy_pass http://localhost:3002;
    }
}

# Backend API (centralizado)
server {
    listen 443 ssl;
    server_name api.axiomacloud.com;

    location / {
        proxy_pass http://localhost:5050;
    }
}
```

---

## 🗺️ Roadmap de Migración

### Fase 1: Estado Actual ✅ COMPLETADO
- [x] Backend unificado con autenticación
- [x] Frontend monolítico con múltiples rutas
- [x] App Launcher funcional
- [x] Gestión de tenants
- [x] Menú dinámico desde base de datos
- [x] Deploy en servidor único

### Fase 2: Preparación para Separación 📍 PRÓXIMO
- [ ] Separar apps en packages distintos del monorepo
- [ ] Crear `shared-components`, `shared-types`, `shared-utils`
- [ ] Configurar TypeScript paths y aliases
- [ ] Configurar workspaces en package.json root
- [ ] Testing de build independiente

### Fase 3: Migración a Subdominios
- [ ] Configurar DNS para subdominios
- [ ] Configurar cookies compartidas (`.axiomacloud.com`)
- [ ] Actualizar middleware de autenticación
- [ ] Configurar CORS para subdominios
- [ ] Deploy de cada app en puerto diferente
- [ ] Configurar Nginx para subdominios

### Fase 4: Integración Completa
- [ ] Migrar Checkpoint al monorepo
- [ ] Migrar Docs al monorepo (mantener Vite)
- [ ] Implementar navegación entre apps vía subdominios
- [ ] Sincronizar sesión entre subdominios
- [ ] Testing end-to-end del ecosistema

### Fase 5: Optimización
- [ ] Implementar CI/CD por app
- [ ] Configurar deploy independiente
- [ ] Monitoreo y logging centralizado
- [ ] Implementar rate limiting por tenant
- [ ] Optimizar carga de assets compartidos

---

## 📝 Notas de Desarrollo

### Variables de Entorno Importantes

```bash
# IMPORTANTE: Next.js "quema" las variables NEXT_PUBLIC_* en tiempo de build
# Si cambias .env.local, DEBES recompilar:

cd packages/web
rm -rf .next
npm run build
pm2 restart rendiciones-web
```

### Debugging de Configuración

```bash
# Ver qué URL está usando el build actual
grep -r "localhost:5050" packages/web/.next/

# Debería mostrar la URL de producción después del build
grep -r "axiomacloud.com" packages/web/.next/ | head -5
```

### Verificación de Sesión

```typescript
// En el navegador (Console)
console.log(localStorage.getItem('token'));
console.log(document.cookie);

// Decodificar JWT
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// Debería mostrar: { userId, tenantId, email, superuser, ... }
```

---

## 🔧 Comandos Útiles

### Desarrollo Local

```bash
# Iniciar todo el stack
npm run dev  # (cuando esté configurado)

# O manualmente:
cd backend && npm run dev &
cd packages/web && npm run dev &
```

### Build y Deploy

```bash
# Build frontend
cd packages/web
npm run build

# Verificar build
npm run start  # Prueba local del build

# Deploy en producción
rsync -avz --exclude node_modules . user@server:/var/www/Rendiciones
ssh user@server "cd /var/www/Rendiciones/packages/web && npm ci && npm run build && pm2 restart rendiciones-web"
```

### Gestión de Base de Datos

```bash
# Crear migración
cd backend
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Ver estado de migraciones
npx prisma migrate status

# Regenerar Prisma Client
npx prisma generate
```

---

## 📚 Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)
- [Nginx Configuration](https://nginx.org/en/docs/)

---

**Última actualización:** 2025-10-24
**Versión:** 2.0.0
**Mantenido por:** Equipo Axioma Cloud
