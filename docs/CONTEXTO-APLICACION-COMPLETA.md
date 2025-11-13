# 📋 CONTEXTO COMPLETO - Sistema de Rendiciones y Procesamiento de Documentos

**Nombre del Proyecto:** Parse - Document Extraction & Transformation System
**Versión:** 1.0.0
**Fecha última actualización:** 2025-10-30
**Estado:** ✅ En Producción

---

## 🎯 Descripción General

Sistema web multi-tenant para **procesamiento automático de documentos fiscales argentinos** (facturas, tickets, notas de débito/crédito) utilizando IA para extracción de datos, reglas de negocio para transformación, y sincronización bidireccional con SQL Server.

### Características Principales

- ✅ Extracción automática de datos con IA (Gemini/Claude)
- ✅ Sistema de reglas de negocio configurable
- ✅ Multi-tenant con aislamiento de datos
- ✅ Sincronización bidireccional con SQL Server
- ✅ API REST completa
- ✅ Sistema de permisos y roles
- ✅ Procesamiento batch en background
- ✅ Validación de duplicados
- ✅ Exportación a Excel/CSV

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

**Backend:**
- Node.js 18+ (Express.js)
- PostgreSQL (base de datos principal)
- Prisma ORM
- JWT para autenticación
- Passport.js (Google OAuth)
- Multer (upload de archivos)

**Frontend:**
- Next.js 14 (React 18.2)
- TypeScript
- Tailwind CSS
- Axios (HTTP client)
- React Hook Form
- React Hot Toast

**IA / ML:**
- Google Gemini 1.5 Flash (primario)
- Anthropic Claude 3 Haiku (fallback)
- Tesseract.js (OCR local)

**Integraciones:**
- SQL Server (sincronización bidireccional)
- Google OAuth 2.0
- Email (Nodemailer)

### Arquitectura de Capas

```
┌─────────────────────────────────────────────────┐
│         FRONTEND (Next.js + TypeScript)         │
│  /parse /dashboard /usuarios /sync-admin etc.   │
└─────────────────────────────────────────────────┘
                      ↕ HTTP/REST API
┌─────────────────────────────────────────────────┐
│          BACKEND (Express.js + Node)            │
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │  Routes    │  │  Services  │  │  Lib     │ │
│  │  /api/*    │  │  Business  │  │  Utils   │ │
│  └────────────┘  └────────────┘  └──────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐│
│  │         Middleware Layer                   ││
│  │  Auth | Rate Limit | Tenant | Validation  ││
│  └────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
           ↕                    ↕
┌──────────────────┐   ┌───────────────────┐
│   PostgreSQL     │   │   External APIs   │
│   (Prisma ORM)   │   │   Gemini/Claude   │
└──────────────────┘   └───────────────────┘
           ↕
┌──────────────────┐
│   SQL Server     │
│  (Sync target)   │
└──────────────────┘
```

---

## 🗄️ Base de Datos (PostgreSQL + Prisma)

### Modelos Principales

#### 1. **tenants** (Multi-tenancy)
```prisma
- id: String (UUID)
- slug: String (unique, ej: "empresa-abc")
- nombre: String
- cuit: String (unique)
- planId: String (relación a planes)
- activo: Boolean
- configuracion: Json
- limites: Json
```

**Relaciones:** Todos los modelos principales tienen `tenantId` para aislamiento de datos.

#### 2. **users** (Usuarios)
```prisma
- id: String (UUID)
- email: String (unique)
- password: String (hasheado)
- nombre: String
- apellido: String
- tenantId: String
- profileId: String (relación a profiles)
- superuser: Boolean
- activo: Boolean
- googleId: String? (OAuth)
```

**Roles:** Controlados por tabla `profiles` (ADMIN, USER, VIEWER, etc.)

#### 3. **documentos_procesados** (Documentos)
```prisma
- id: String (UUID)
- nombreArchivo: String
- tipoArchivo: String (pdf/image)
- rutaArchivo: String (path en storage)
- estadoProcesamiento: String (procesando/completado/error)
- datosExtraidos: Json (datos raw del PDF)
- fechaExtraida: DateTime
- importeExtraido: Decimal
- cuitExtraido: String
- razonSocialExtraida: String
- numeroComprobanteExtraido: String
- tipoComprobanteExtraido: String (FACTURA A/B/C, etc.)
- netoGravadoExtraido: Decimal
- impuestosExtraido: Decimal
- exentoExtraido: Decimal
- monedaExtraida: String (ARS/USD)
- modeloIA: String (gemini/anthropic/local)
- exportado: Boolean
- usuarioId: String
- tenantId: String
```

**Relaciones:**
- `documento_lineas[]` (items del documento)
- `documento_impuestos[]` (IVA, percepciones, etc.)

#### 4. **documento_lineas** (Line Items)
```prisma
- id: String
- documentoId: String
- numero: Int (línea 1, 2, 3...)
- descripcion: String
- cantidad: Decimal
- precioUnitario: Decimal
- subtotal: Decimal
- alicuotaIva: Decimal? (21%, 10.5%, etc.)
- importeIva: Decimal?
- totalLinea: Decimal
```

#### 5. **reglas_negocio** (Business Rules)
```prisma
- id: String
- codigo: String (unique, ej: "COMPLETAR_RAZON_SOCIAL")
- nombre: String
- tipo: String (TRANSFORMACION/IMPORTACION_DKT)
- activa: Boolean
- prioridad: Int (orden de ejecución)
- configuracion: Json (condiciones, acciones, etc.)
- tenantId: String?
```

**Tipos de operaciones:**
- LOOKUP_JSON: Buscar en campos JSON
- LOOKUP: Buscar en tablas relacionales
- LOOKUP_CHAIN: Lookup encadenado
- SET: Asignar valor
- CALCULATE: Cálculos

#### 6. **parametros_maestros** (Master Data)
```prisma
- id: Int (autoincrement)
- codigo: String
- nombre: String
- tipo_campo: String (proveedor/centro_costo/etc.)
- parametros_json: Json (datos adicionales, ej: CUIT)
- activo: Boolean
- tenantId: String?
```

**Uso:** Lookup tables para reglas de negocio.

#### 7. **ai_prompts** (Prompts para IA)
```prisma
- id: String
- clave: String (unique con tenantId)
- nombre: String
- prompt: String (template del prompt)
- motor: String (gemini/anthropic)
- tipo: String (EXTRACTOR_SIMPLE/etc.)
- vecesUsado: Int
- tasaExito: Decimal
- activo: Boolean
- tenantId: String?
```

#### 8. **sync_configurations** (Configuración SQL Sync)
```prisma
- id: String
- tenantId: String (unique)
- sqlServerHost: String
- sqlServerDatabase: String
- sqlServerUser: String
- sqlServerPassword: String (encriptado)
- configuracionTablas: Json (mapeo de tablas)
- activo: Boolean
```

#### 9. **processing_jobs** (Background Jobs)
```prisma
- id: String
- type: String (IMPORT_DKT/BULK_PROCESS/etc.)
- status: String (pending/running/completed/failed)
- progress: Int (0-100)
- userId: String
- parameters: Json
- result: Json?
- error: String?
```

### Índices Importantes

- `documentos_procesados`: tenantId, estadoProcesamiento, exportado
- `reglas_negocio`: tipo, activa, prioridad
- `users`: email, tenantId
- `parametros_maestros`: tipo_campo, codigo, tenantId

---

## 🔧 Backend (Express.js + Node.js)

### Configuración de Puertos

| Servicio | Puerto | Uso |
|----------|--------|-----|
| Backend API | **5050** | Express server |
| Frontend Dev | 3000 | npm run dev |
| Frontend Prod | **8084** | PM2 production |
| PostgreSQL | 5432 | Base de datos |

### Estructura de Directorios

```
backend/
├── src/
│   ├── config/           # Configuraciones (passport, db)
│   ├── lib/              # Librerías core
│   │   └── documentProcessor.js  # Procesamiento de PDFs
│   ├── middleware/       # Middlewares (auth, tenant, etc.)
│   │   ├── auth.js
│   │   ├── tenant.js
│   │   └── rateLimiter.js
│   ├── routes/           # Rutas de API
│   │   ├── auth.js
│   │   ├── documentos.js     # ⭐ PRINCIPAL
│   │   ├── reglas.js
│   │   ├── parametros.js
│   │   ├── sync.js
│   │   └── ...
│   ├── services/         # Servicios de negocio
│   │   ├── businessRulesEngine.js  # ⭐ Motor de reglas
│   │   ├── promptManager.js
│   │   ├── emailService.js
│   │   └── jobProcessor.js
│   ├── utils/            # Utilidades
│   ├── scripts/          # Scripts auxiliares
│   └── index.js          # ⭐ Entry point
├── prisma/
│   ├── schema.prisma     # ⭐ Schema de DB
│   └── migrations/
├── uploads/              # Archivos subidos (PDFs, imágenes)
└── package.json
```

### Rutas de API Principales

**Base URL:** `http://localhost:5050/api`

#### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login con email/password
- `POST /api/auth/google` - Login con Google OAuth
- `POST /api/auth/logout` - Cerrar sesión
- `POST /api/auth/refresh` - Refresh token

#### Documentos (⭐ Core)
- `POST /api/documentos/upload` - Subir PDF/imagen
- `GET /api/documentos` - Listar documentos (con filtros)
- `GET /api/documentos/:id` - Ver documento específico
- `PUT /api/documentos/:id` - Actualizar datos manualmente
- `DELETE /api/documentos/:id` - Eliminar documento
- `POST /api/documentos/aplicar-reglas` - ⭐ Aplicar reglas de transformación
- `POST /api/documentos/exportar` - Exportar a Excel/CSV
- `POST /api/documentos/batch-delete` - Eliminar múltiples

#### Reglas de Negocio
- `GET /api/reglas` - Listar reglas
- `POST /api/reglas` - Crear regla
- `PUT /api/reglas/:id` - Actualizar regla
- `DELETE /api/reglas/:id` - Eliminar regla
- `POST /api/reglas/test` - Probar regla

#### Parámetros Maestros
- `GET /api/parametros` - Listar parámetros
- `GET /api/parametros/por-tipo/:tipo` - Filtrar por tipo
- `POST /api/parametros` - Crear parámetro
- `PUT /api/parametros/:id` - Actualizar parámetro

#### Sincronización SQL
- `GET /api/sync` - Ver configuración
- `POST /api/sync` - Crear configuración
- `POST /api/sync/test-connection` - Probar conexión
- `POST /api/sync/execute` - Ejecutar sincronización
- `GET /api/sync/logs` - Ver logs de sincronización

#### Usuarios
- `GET /api/users` - Listar usuarios
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

#### Tenants (Multi-tenancy)
- `GET /api/tenants` - Listar tenants (superuser)
- `POST /api/tenants` - Crear tenant
- `PUT /api/tenants/:id` - Actualizar tenant
- `GET /api/tenants/:id/stats` - Estadísticas del tenant

#### IA Configs
- `GET /api/ai-configs` - Ver configs de IA por tenant
- `POST /api/ai-configs` - Configurar API keys (Gemini/Claude)
- `PUT /api/ai-configs/:id` - Actualizar config

#### Prompts
- `GET /api/prompts` - Listar prompts
- `GET /api/prompts/:clave` - Ver prompt específico
- `POST /api/prompts` - Crear prompt
- `PUT /api/prompts/:id` - Actualizar prompt
- `GET /api/prompts/stats` - Estadísticas de uso

#### Jobs (Background)
- `GET /api/jobs` - Listar jobs
- `GET /api/jobs/:id` - Ver job específico
- `POST /api/jobs/:id/cancel` - Cancelar job

### Middleware Principal

#### 1. **auth.js** (Autenticación)
```javascript
const authWithTenant = async (req, res, next) => {
  // Verifica JWT token
  // Obtiene tenant del usuario
  // Agrega req.user y req.tenant
}
```

#### 2. **tenant.js** (Multi-tenancy)
```javascript
const tenantMiddleware = (req, res, next) => {
  // Inyecta tenantId en queries de Prisma
  // Asegura aislamiento de datos
}
```

#### 3. **rateLimiter.js** (Rate Limiting)
```javascript
// 2000 requests / 15 minutos en producción
// 1000 requests / 15 minutos en desarrollo
```

### Servicios Principales

#### 1. **businessRulesEngine.js** (Motor de Reglas)

**Funciones principales:**
```javascript
class BusinessRulesEngine {
  async loadRules(tipo, forceReload, prismaInstance)
  async applyRules(itemData, resumenData, options)
  evaluateCondition(condition, data, transformedData)
  async applyLookupJSON(result, fullData, accion, transformedData)
  async applyLookup(result, fullData, accion, transformedData)
  applyCalculation(result, transformedData, accion)
}
```

**Operadores de condiciones:**
- EQUALS, NOT_EQUALS
- CONTAINS, NOT_CONTAINS
- STARTS_WITH, ENDS_WITH
- IS_EMPTY, IS_NOT_EMPTY
- IS_NULL, IS_NOT_NULL
- GREATER_THAN, LESS_THAN
- IN, NOT_IN
- REGEX

**Operaciones de acciones:**
- SET: Asignar valor fijo o desde otro campo
- APPEND: Agregar a valor existente
- CALCULATE: Realizar cálculos
- LOOKUP: Buscar en tablas
- LOOKUP_JSON: Buscar en campos JSON (⭐ con normalización CUIT)
- LOOKUP_CHAIN: Lookup encadenado

**Cache:**
- Cache de reglas (5 minutos)
- Cache de lookups (en memoria)

#### 2. **documentProcessor.js** (Procesamiento de PDFs)

**Funciones principales:**
```javascript
class DocumentProcessor {
  async processPDF(filePath)           // Extrae texto con pdf-parse
  async processImage(filePath)         // OCR con Tesseract
  async extractData(text)              // Coordina extracción
  async extractDataWithAI(text)        // IA Gemini/Claude
  async extractWithGemini(text)        // Gemini API
  async extractWithClaude(text)        // Claude API

  // Extractores con regex (fallback)
  extractFecha(text)
  extractImporte(text)
  extractCUIT(text)
  extractNumeroComprobante(text)
  extractRazonSocial(text)
  extractNetoGravado(text)
  extractImpuestos(text)
}
```

**Flujo de extracción:**
```
1. Intentar con Gemini (3 reintentos)
2. Si falla, intentar con Claude
3. Si falla, usar regex local
4. Siempre guardar documento (incluso con datos parciales)
```

**Validaciones:**
- Duplicados por contenido (CUIT + tipo + número)
- Duplicados por nombre de archivo
- Datos mínimos (2 de 3: fecha, importe, CUIT)

#### 3. **promptManager.js** (Gestión de Prompts)

**Funciones:**
```javascript
async obtenerPrompt(clave, tenantId, motor)
async registrarResultado(clave, exitoso, tenantId, motor)
async crearPromptDefault(clave, tenantId)
```

**Prompts disponibles:**
- EXTRACCION_FACTURA_GEMINI
- EXTRACCION_FACTURA_CLAUDE
- EXTRACCION_RESUMEN_TARJETA

---

## 🎨 Frontend (Next.js 14 + TypeScript)

### Estructura de Directorios

```
frontend/
├── src/
│   ├── app/
│   │   ├── (protected)/       # Rutas protegidas (requieren auth)
│   │   │   ├── dashboard/     # Dashboard principal
│   │   │   ├── parse/         # ⭐ Procesamiento de docs
│   │   │   ├── exportar/      # Exportación de documentos
│   │   │   ├── usuarios/      # Gestión de usuarios
│   │   │   ├── parametros/    # Parámetros maestros
│   │   │   ├── ia-config/     # Config de API keys IA
│   │   │   ├── prompts-ia/    # Gestión de prompts
│   │   │   ├── sync-admin/    # Sincronización SQL
│   │   │   └── admin/         # Admin (tenants, planes)
│   │   ├── auth/              # Autenticación
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── google/
│   │   ├── layout.tsx         # Layout principal
│   │   └── page.tsx           # Home page
│   ├── components/            # Componentes reutilizables
│   ├── lib/                   # Utilidades
│   │   └── api.ts             # Axios config
│   └── types/                 # TypeScript types
└── package.json
```

### Páginas Principales

#### 1. **/parse** (⭐ Core - Procesamiento de Documentos)

**Archivo:** `src/app/(protected)/parse/page.tsx`

**Funcionalidades:**
- Upload de PDFs/imágenes (drag & drop)
- Tabla de documentos con filtros
- Edición manual de datos extraídos
- Botón "Aplicar reglas" (aplica transformaciones)
- Vista previa de documentos
- Búsqueda y filtros avanzados
- Paginación
- Selección múltiple y acciones batch
- Export a Excel

**Estados de documentos:**
- `procesando` - Se está procesando
- `completado` - Procesamiento exitoso
- `error` - Falló procesamiento
- `exportado` - Ya fue exportado

**Columnas de la tabla:**
- Checkbox (selección)
- Nombre archivo
- Fecha
- CUIT
- Razón Social
- Tipo Comprobante
- N° Comprobante
- Importe
- Moneda (ARS/USD)
- Estado
- Acciones (Ver/Editar/Eliminar)

**Flujo de uso:**
```
1. Usuario sube PDF
2. Backend extrae datos con IA
3. Documento aparece en tabla con estado "completado"
4. Usuario revisa/edita datos si es necesario
5. Usuario click "Aplicar reglas" (opcional)
6. Reglas completan/transforman datos faltantes
7. Usuario exporta documentos
```

#### 2. **/dashboard**

**Funcionalidades:**
- Resumen de documentos procesados
- Gráficos de actividad
- Estadísticas del mes
- Documentos recientes
- Alerts/notificaciones

#### 3. **/exportar**

**Funcionalidades:**
- Seleccionar documentos para exportar
- Elegir formato (Excel/CSV)
- Filtros por fecha, tipo, etc.
- Preview antes de exportar
- Historial de exportaciones

#### 4. **/sync-admin** (Sincronización SQL)

**Funcionalidades:**
- Configurar conexión a SQL Server
- Mapear tablas y campos
- Ejecutar sincronización manual
- Ver logs de sincronización
- Gestión de API keys

#### 5. **/parametros** (Master Data)

**Funcionalidades:**
- CRUD de parámetros maestros
- Organización por tipo (proveedor, centro_costo, etc.)
- Campos JSON editables
- Importación desde Excel
- Jerarquías (padre-hijo)

#### 6. **/ia-config** (Configuración IA)

**Funcionalidades:**
- Configurar API keys (Gemini, Claude)
- Ver estadísticas de uso por modelo
- Configurar límites de requests
- Probar conexión

#### 7. **/prompts-ia** (Gestión de Prompts)

**Funcionalidades:**
- CRUD de prompts
- Templates con variables
- Versionado de prompts
- Estadísticas (veces usado, tasa de éxito)
- Probar prompt con texto de ejemplo

#### 8. **/usuarios**

**Funcionalidades:**
- CRUD de usuarios
- Asignar roles/perfiles
- Asignar atributos (centro de costos, etc.)
- Activar/desactivar usuarios

### Componentes Reutilizables

**Layout principal:**
```tsx
- Sidebar con navegación
- Header con usuario y tenant actual
- Breadcrumbs
- Toast notifications (react-hot-toast)
```

**Componentes comunes:**
- Modal
- DataTable (tabla con filtros y paginación)
- FileUpload (drag & drop)
- LoadingSpinner
- ErrorBoundary
- ConfirmDialog

### Configuración de API (axios)

**Archivo:** `src/lib/api.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🔄 Flujos Principales de la Aplicación

### 1. Flujo de Registro y Autenticación

```
REGISTRO
┌─────────────────────────────────────┐
│ 1. Usuario llena formulario registro│
│    - Email, password, nombre, etc.   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Backend crea usuario y tenant    │
│    - Hashea password (bcrypt)        │
│    - Asigna tenant por CUIT          │
│    - Envía email de verificación     │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Usuario verifica email            │
│    - Click en link de verificación   │
│    - emailVerified = true            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Usuario puede hacer login         │
└─────────────────────────────────────┘

LOGIN (Email/Password)
┌─────────────────────────────────────┐
│ 1. Usuario ingresa credenciales     │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Backend valida password           │
│    - Compara hash con bcrypt         │
│    - Verifica que esté activo        │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Backend genera JWT token          │
│    - Incluye userId, tenantId, rol   │
│    - Expira en 24h                   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Frontend guarda token             │
│    - localStorage                    │
│    - Agrega en headers de requests   │
└─────────────────────────────────────┘

LOGIN (Google OAuth)
┌─────────────────────────────────────┐
│ 1. Usuario click "Login con Google" │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Redirect a Google OAuth           │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Google callback con perfil       │
│    - Email, nombre, googleId         │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Backend busca/crea usuario        │
│    - Si existe por email: asocia ID  │
│    - Si no existe: crea usuario      │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 5. Backend genera JWT token          │
└─────────────────────────────────────┘
```

### 2. Flujo de Procesamiento de Documentos (⭐ CORE)

```
UPLOAD Y EXTRACCIÓN
┌─────────────────────────────────────┐
│ 1. Usuario sube PDF/imagen          │
│    - Drag & drop en /parse           │
│    - Puede subir múltiples archivos  │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Frontend valida archivo           │
│    - Tamaño < 10MB                   │
│    - Tipo: pdf, jpg, png             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Frontend sube a POST /upload      │
│    - FormData con archivo            │
│    - Muestra progress bar            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Backend guarda archivo            │
│    - Path: uploads/TENANT/YYYY-MM/   │
│    - Crea registro en DB             │
│    - Estado: "procesando"            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 5. Backend extrae texto del PDF      │
│    - pdf-parse para PDFs nativos     │
│    - Tesseract OCR para imágenes     │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 6. Backend extrae datos con IA       │
│    ┌────────────────────────────┐   │
│    │ A. Intenta con Gemini      │   │
│    │    - 3 reintentos          │   │
│    │    - Timeout 30s           │   │
│    └────────────────────────────┘   │
│                ↓ (si falla)          │
│    ┌────────────────────────────┐   │
│    │ B. Intenta con Claude      │   │
│    │    - 2 reintentos          │   │
│    └────────────────────────────┘   │
│                ↓ (si falla)          │
│    ┌────────────────────────────┐   │
│    │ C. Usa regex local         │   │
│    │    - Patrones argentinos   │   │
│    └────────────────────────────┘   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 7. Backend valida duplicados         │
│    - Por nombre de archivo           │
│    - Por CUIT+tipo+número            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 8. Backend guarda datos extraídos    │
│    - Campos principales en columnas  │
│    - JSON completo en datosExtraidos │
│    - Estado: "completado"            │
│    - Line items en documento_lineas  │
│    - Impuestos en documento_impuestos│
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 9. Frontend recibe respuesta         │
│    - Muestra toast success           │
│    - Recarga tabla de documentos     │
│    - Documento aparece en lista      │
└─────────────────────────────────────┘

❌ NO SE APLICAN REGLAS AQUÍ
   (Solo extracción + guardado)
```

### 3. Flujo de Aplicación de Reglas de Negocio

```
APLICACIÓN MANUAL DE REGLAS
┌─────────────────────────────────────┐
│ 1. Usuario click "Aplicar reglas"   │
│    - Botón en /parse                 │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Frontend POST /aplicar-reglas     │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Backend busca documentos          │
│    - estadoProcesamiento: completado │
│    - exportado: false                │
│    - Del tenant del usuario          │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Backend carga reglas              │
│    - Tipo: TRANSFORMACION            │
│    - activa: true                    │
│    - Orden por prioridad             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 5. Para cada documento:              │
│    ┌────────────────────────────┐   │
│    │ A. Evalúa condiciones      │   │
│    │    - AND / OR logic        │   │
│    │    - Operadores variados   │   │
│    └────────────────────────────┘   │
│                ↓ (si cumple)         │
│    ┌────────────────────────────┐   │
│    │ B. Ejecuta acciones        │   │
│    │    - LOOKUP_JSON           │   │
│    │    - SET valores           │   │
│    │    - CALCULATE             │   │
│    └────────────────────────────┘   │
│                ↓                     │
│    ┌────────────────────────────┐   │
│    │ C. Actualiza en DB         │   │
│    │    - Solo campos cambiados │   │
│    │    - Log de cambios        │   │
│    └────────────────────────────┘   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 6. Backend responde con resultados   │
│    - Total procesados                │
│    - Total transformados             │
│    - Logs en consola                 │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 7. Frontend muestra resultado        │
│    - Toast: "X de Y transformados"   │
│    - Recarga tabla con datos nuevos  │
└─────────────────────────────────────┘

EJEMPLO DE LOG EN CONSOLA:
✅ Documento 30585357657_fc_0028-00045226.pdf:
   📐 1 regla(s) aplicada(s)
   🔄 Cambios realizados:
      - razonSocial: "IND. QUIMICA..." → "CALZETTA HNOS."
```

### 4. Flujo de Exportación

```
EXPORTACIÓN A EXCEL/CSV
┌─────────────────────────────────────┐
│ 1. Usuario selecciona documentos     │
│    - Checkboxes en tabla /exportar   │
│    - O "Exportar todos"              │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Usuario elige formato             │
│    - Excel (.xlsx)                   │
│    - CSV                             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Frontend POST /exportar           │
│    - documentoIds: [...]             │
│    - formato: "xlsx"                 │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Backend aplica reglas pre-export  │
│    - Tipo: TRANSFORMACION_DOCUMENTO  │
│    - (Opcional, si existen reglas)   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 5. Backend genera archivo            │
│    - Biblioteca: xlsx                │
│    - Headers configurables           │
│    - Cálculos agregados              │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 6. Backend marca como exportados     │
│    - exportado: true                 │
│    - fechaExportacion: now()         │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 7. Frontend descarga archivo         │
│    - Blob download                   │
│    - Nombre: documentos_YYYY-MM-DD   │
└─────────────────────────────────────┘
```

### 5. Flujo de Sincronización SQL Server

```
CONFIGURACIÓN INICIAL
┌─────────────────────────────────────┐
│ 1. Usuario accede a /sync-admin      │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Usuario completa form config      │
│    - Host SQL Server                 │
│    - Base de datos                   │
│    - Credenciales                    │
│    - Mapeo de tablas                 │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Backend prueba conexión           │
│    - POST /sync/test-connection      │
│    - Valida credenciales             │
│    - Lista tablas disponibles        │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Backend guarda configuración      │
│    - Tabla: sync_configurations      │
│    - Password encriptado             │
└─────────────────────────────────────┘

EJECUCIÓN DE SINCRONIZACIÓN
┌─────────────────────────────────────┐
│ 1. Usuario click "Sincronizar ahora" │
│    O cron job automático             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Backend POST /sync/execute        │
│    - direccion: "postgres_to_sql"    │
│    - O "sql_to_postgres"             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 3. Backend ejecuta sincronización    │
│    ┌────────────────────────────┐   │
│    │ A. Conecta a SQL Server    │   │
│    │    - Usa config guardada   │   │
│    └────────────────────────────┘   │
│                ↓                     │
│    ┌────────────────────────────┐   │
│    │ B. Para cada tabla:        │   │
│    │    - Lee datos origen      │   │
│    │    - Transforma campos     │   │
│    │    - Inserta/actualiza     │   │
│    └────────────────────────────┘   │
│                ↓                     │
│    ┌────────────────────────────┐   │
│    │ C. Registra log            │   │
│    │    - Tabla: sync_logs      │   │
│    │    - Registros afectados   │   │
│    │    - Duración              │   │
│    └────────────────────────────┘   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 4. Frontend muestra resultado        │
│    - Toast success/error             │
│    - Tabla de logs actualizada       │
└─────────────────────────────────────┘
```

---

## ⚙️ Variables de Entorno

### Backend (.env)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rendiciones"

# Server
PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=tu-secreto-super-seguro-cambiar-en-produccion
JWT_EXPIRATION=24h

# IA - Gemini (Primario)
GEMINI_API_KEY=AIzaSyChQdergthmXWkNDJ2xaDfyqfov3ac2fM8
ENABLE_AI_EXTRACTION=true

# IA - Anthropic Claude (Fallback)
ANTHROPIC_API_KEY=sk-ant-api03-xxxx
# O también: CLAUDE_API_KEY

# Google OAuth
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5050/api/auth/google/callback

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-app-password
EMAIL_FROM="Parse App <noreply@parseapp.com>"

# Rate Limiting
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_DEV=1000
RATE_LIMIT_PROD=2000

# Storage
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB en bytes

# SQL Server Sync (opcional)
SQL_SERVER_ENCRYPTION=true

# IA Local (Futuro - Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
USE_OLLAMA=false
```

### Frontend (.env.local)

```bash
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:5050/api

# Google OAuth (debe coincidir con backend)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com

# App Info
NEXT_PUBLIC_APP_NAME="Parse - Document Extraction"
NEXT_PUBLIC_APP_VERSION=1.0.0
```

---

## 🔥 Sistema de Reglas de Negocio (Detallado)

### Arquitectura del Motor de Reglas

```
┌────────────────────────────────────────────────┐
│          businessRulesEngine.js                │
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │  loadRules(tipo, forceReload)            │ │
│  │  - Carga desde reglas_negocio            │ │
│  │  - Cache 5 minutos                       │ │
│  │  - Filtra por tipo y activa=true         │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │  applyRules(itemData, resumen, opts)     │ │
│  │  - Aplica reglas en orden de prioridad   │ │
│  │  - Devuelve datos transformados          │ │
│  └──────────────────────────────────────────┘ │
│         ↓                 ↓                     │
│  ┌─────────────┐   ┌──────────────────────┐  │
│  │ Condiciones │   │     Acciones         │  │
│  │  evaluate   │   │  LOOKUP_JSON         │  │
│  │  Condition  │   │  LOOKUP              │  │
│  │             │   │  LOOKUP_CHAIN        │  │
│  │ AND/OR      │   │  SET/CALCULATE       │  │
│  │ logic       │   │  APPEND              │  │
│  └─────────────┘   └──────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Ejemplo de Regla: COMPLETAR_RAZON_SOCIAL_POR_CUIT

**Objetivo:** Completar razón social buscando por CUIT en parametros_maestros

**Configuración JSON:**
```json
{
  "logicOperator": "OR",
  "condiciones": [
    {
      "campo": "razonSocialExtraida",
      "operador": "IS_EMPTY"
    },
    {
      "campo": "razonSocialExtraida",
      "operador": "CONTAINS",
      "valor": "TIMBO"
    }
  ],
  "acciones": [
    {
      "campo": "razonSocialExtraida",
      "operacion": "LOOKUP_JSON",
      "tipoCampo": "proveedor",
      "campoJSON": "CUIT",
      "valorConsulta": "{cuitExtraido}",
      "campoResultado": "nombre",
      "valorDefecto": null
    }
  ]
}
```

**Cómo funciona:**

1. **Condiciones** (OR logic):
   - Si razón social está vacía
   - O si razón social contiene "TIMBO"

2. **Acción** (LOOKUP_JSON):
   - Busca en `parametros_maestros` donde `tipo_campo = 'proveedor'`
   - En el campo JSON `parametros_json.CUIT`
   - Compara con `{cuitExtraido}` del documento
   - Si encuentra match, devuelve `nombre`
   - ⭐ **Normalización CUIT**: Remueve guiones antes de comparar

3. **Resultado:**
   - Si encuentra: `razonSocialExtraida = "CALZETTA HNOS."`
   - Si no encuentra: `razonSocialExtraida = null`

**Normalización CUIT (FIX CRÍTICO):**
```javascript
// businessRulesEngine.js líneas 544-553
const normalizedJsonValue = String(jsonValue).replace(/[-\s]/g, '').toUpperCase();
const normalizedSearchValue = String(valorBusqueda).replace(/[-\s]/g, '').toUpperCase();

if (normalizedJsonValue === normalizedSearchValue) {
  encontrado = param;
  break;
}
```

### Tipos de Reglas

#### 1. TRANSFORMACION
- **Cuándo:** Manual (botón "Aplicar reglas")
- **Objetivo:** Completar/transformar datos faltantes
- **Ejemplos:**
  - Completar razón social por CUIT
  - Asignar centro de costos por usuario
  - Normalizar tipos de comprobante

#### 2. TRANSFORMACION_DOCUMENTO
- **Cuándo:** Antes de exportar
- **Objetivo:** Ajustes finales pre-exportación
- **Ejemplos:**
  - Formatear campos para ERP
  - Agregar códigos de cuenta
  - (Aún no implementadas)

#### 3. IMPORTACION_DKT
- **Cuándo:** Migración de datos DKT
- **Objetivo:** Transformar datos legacy
- **Contexto:** Solo para importación histórica

### Operadores de Condiciones

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| EQUALS | Igualdad exacta | campo = "FACTURA A" |
| NOT_EQUALS | Desigualdad | campo != "TICKET" |
| CONTAINS | Contiene substring | campo.includes("IVA") |
| NOT_CONTAINS | No contiene | !campo.includes("EXENTO") |
| STARTS_WITH | Empieza con | campo.startsWith("30-") |
| ENDS_WITH | Termina con | campo.endsWith(".pdf") |
| IS_EMPTY | Está vacío | campo === '' \|\| null |
| IS_NOT_EMPTY | No está vacío | campo !== '' && !== null |
| IS_NULL | Es null | campo === null |
| IS_NOT_NULL | No es null | campo !== null |
| GREATER_THAN | Mayor que | campo > 1000 |
| LESS_THAN | Menor que | campo < 500 |
| IN | Está en lista | campo in ["A","B","C"] |
| NOT_IN | No está en lista | campo not in ["X","Y"] |
| REGEX | Expresión regular | /^\d{11}$/.test(campo) |

### Operaciones de Acciones

#### 1. SET (Asignar valor)
```json
{
  "operacion": "SET",
  "campo": "tipoComprobanteExtraido",
  "valor": "FACTURA A"
}
```

#### 2. APPEND (Agregar texto)
```json
{
  "operacion": "APPEND",
  "campo": "observaciones",
  "valor": " - Procesado automáticamente"
}
```

#### 3. CALCULATE (Cálculos)
```json
{
  "operacion": "CALCULATE",
  "campo": "totalConImpuestos",
  "formula": "{importeExtraido} * 1.21"
}
```

#### 4. LOOKUP (Buscar en tabla)
```json
{
  "operacion": "LOOKUP",
  "campo": "nombreUsuario",
  "tabla": "users",
  "campoConsulta": "id",
  "valorConsulta": "{usuarioId}",
  "campoResultado": "nombre"
}
```

#### 5. LOOKUP_JSON (Buscar en campo JSON)
```json
{
  "operacion": "LOOKUP_JSON",
  "campo": "razonSocialExtraida",
  "tipoCampo": "proveedor",
  "campoJSON": "CUIT",
  "valorConsulta": "{cuitExtraido}",
  "campoResultado": "nombre"
}
```

#### 6. LOOKUP_CHAIN (Lookup encadenado)
```json
{
  "operacion": "LOOKUP_CHAIN",
  "campo": "codigoDimension",
  "valorConsulta": "{usuarioId}",
  "cadena": [
    {
      "tabla": "user_atributos",
      "campoConsulta": "userId",
      "campoResultado": "valorAtributoId"
    },
    {
      "tabla": "valores_atributo",
      "campoConsulta": "id",
      "campoResultado": "codigo"
    }
  ]
}
```

---

## 🤖 Sistema de Extracción con IA

### Modelos Disponibles

#### 1. Google Gemini 1.5 Flash (Primario)
- **Modelo:** `gemini-1.5-flash`
- **Costo:** ~$0.001 por request
- **Velocidad:** Rápido (2-5 segundos)
- **Precisión:** 70-80%
- **Límites:** Rate limiting agresivo
- **Capacidades:** Solo texto (actual), Visión (posible upgrade)

#### 2. Anthropic Claude 3 Haiku (Fallback)
- **Modelo:** `claude-3-haiku-20240307`
- **Costo:** ~$0.00025 por 1K tokens
- **Velocidad:** Rápido (1-3 segundos)
- **Precisión:** 70-80%
- **Capacidades:** Solo texto

#### 3. Tesseract OCR (Local)
- **Modelo:** Tesseract + Sharp (preprocesamiento)
- **Costo:** Gratis
- **Velocidad:** Lento (10-30 segundos)
- **Precisión:** 50-60%
- **Uso:** Fallback para imágenes

### Flujo de Extracción (Prioridad)

```
1. INTENTAR GEMINI (3 reintentos)
   ↓ (si falla o rate limit)
2. INTENTAR CLAUDE (2 reintentos)
   ↓ (si falla)
3. USAR REGEX LOCAL
   ↓
4. GUARDAR DOCUMENTO (siempre, incluso con datos parciales)
```

### Prompt Template (Gemini/Claude)

**Archivo:** `ai_prompts` tabla, clave: `EXTRACCION_FACTURA_GEMINI`

```
Eres un experto en extracción de datos de facturas y comprobantes fiscales argentinos.

IMPORTANTE: Debes devolver SOLO un objeto JSON válido, sin texto adicional antes ni después.

Analiza el siguiente texto de una factura argentina y extrae la información solicitada:

{TEXTO_DEL_DOCUMENTO}

Devuelve un objeto JSON con esta estructura exacta:

{
  "fecha": "YYYY-MM-DD",
  "importe": 123.45,
  "cuit": "30-12345678-9",
  "razonSocial": "NOMBRE DE LA EMPRESA S.A.",
  "numeroComprobante": "0001-00001234",
  "tipoComprobante": "FACTURA A",
  "cae": "12345678901234",
  "netoGravado": 100.00,
  "impuestos": 21.00,
  "exento": 0.00,
  "moneda": "ARS",
  "lineItems": [
    {
      "numero": 1,
      "descripcion": "Producto o servicio",
      "cantidad": 1.0,
      "precioUnitario": 100.00,
      "subtotal": 100.00,
      "alicuotaIva": 21.0,
      "importeIva": 21.00,
      "totalLinea": 121.00
    }
  ],
  "impuestosDetalle": [
    {
      "tipo": "IVA 21%",
      "alicuota": 21.0,
      "baseImponible": 100.00,
      "importe": 21.00
    }
  ]
}

REGLAS IMPORTANTES:
- SOLO devuelve JSON, nada más
- Si un campo no se puede extraer, usa null
- Fechas en formato YYYY-MM-DD
- Números sin símbolos de moneda
- CUIT con guiones si los tiene
```

### Campos Extraídos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| fecha | Date | Fecha de emisión |
| importe | Decimal | Total del comprobante |
| cuit | String | CUIT del emisor |
| razonSocial | String | Razón social del emisor |
| numeroComprobante | String | Nro punto de venta + nro |
| tipoComprobante | String | FACTURA A/B/C, TICKET, etc. |
| cae | String | Código de autorización AFIP |
| netoGravado | Decimal | Importe gravado (sin IVA) |
| impuestos | Decimal | Total de impuestos |
| exento | Decimal | Importe exento |
| moneda | String | ARS/USD/EUR |
| cupon | String | Cupón de tarjeta (si aplica) |
| descuentoGlobal | Decimal | Descuento global |
| descuentoGlobalTipo | String | PORCENTAJE/IMPORTE |
| lineItems | Array | Detalle de líneas |
| impuestosDetalle | Array | Detalle de impuestos |

### Validación de Datos Mínimos

**Criterio de éxito:**
- Al menos 2 de 3 campos críticos: `fecha`, `importe`, `cuit`
- O 1 campo crítico + texto útil (>200 caracteres)

**Si no cumple:**
- Documento se elimina
- Error: "No se pudieron extraer datos suficientes"

### Detección de Duplicados

**Por nombre de archivo:**
```sql
SELECT * FROM documentos_procesados
WHERE nombreArchivo = ?
AND tenantId = ?
AND estadoProcesamiento = 'completado'
```

**Por contenido (CUIT + tipo + número):**
```sql
SELECT * FROM documentos_procesados
WHERE cuitExtraido = ?
AND tipoComprobanteExtraido = ?
AND numeroComprobanteExtraido = ?
AND estadoProcesamiento = 'completado'
AND tenantId = ?
```

---

## 📊 Mejoras Futuras (Roadmap)

### 🔥 Alta Prioridad

#### 1. Google Document AI
- **Objetivo:** Reemplazar Gemini con Document AI
- **Beneficios:**
  - 95%+ precisión vs 70-80% actual
  - OCR avanzado integrado
  - Especializado en facturas
  - Lee imágenes embebidas en PDFs
- **Costo:** $60/1000 páginas (1000 gratis/mes)
- **Implementación:** 1-2 días
- **Prioridad:** ⭐⭐⭐⭐⭐

#### 2. PDF → Imagen + Gemini Vision
- **Objetivo:** Leer imágenes pegadas en PDFs
- **Beneficios:**
  - Gemini puede ver TODO (texto + imágenes)
  - Mejor que Document AI para casos simples
- **Costo:** Similar a Gemini actual
- **Implementación:** 4-6 horas
- **Prioridad:** ⭐⭐⭐⭐

#### 3. Fix schema reglas_ejecuciones
- **Objetivo:** Re-habilitar logging de ejecuciones
- **Problema:** Campo `id` no se genera automáticamente
- **Solución:** Agregar `@default(uuid())` al schema
- **Implementación:** 30 minutos
- **Prioridad:** ⭐⭐⭐⭐

### 📈 Media Prioridad

#### 4. Agregar más proveedores
- **Objetivo:** Aumentar base de parametros_maestros
- **Actual:** Solo 2 proveedores
- **Meta:** 50+ proveedores
- **Fuente:** Importar desde AFIP o contabilidad
- **Prioridad:** ⭐⭐⭐

#### 5. Validación AFIP
- **Objetivo:** Verificar CUIT y CAE válidos
- **API:** AFIP Web Services
- **Beneficios:** Detección de facturas falsas
- **Prioridad:** ⭐⭐⭐

#### 6. Ollama (IA Local)
- **Objetivo:** Alternativa offline a Gemini
- **Modelo:** llama3.2:3b
- **Código:** Ya existe en documentProcessor.js
- **Necesita:** Testing y ajuste de prompts
- **Prioridad:** ⭐⭐

### 🔮 Baja Prioridad / Ideas

#### 7. Machine Learning para Categorización
- Auto-clasificar tipo de gasto
- Sugerir centro de costos
- Detectar anomalías

#### 8. OCR Mejorado
- Preprocesamiento de imágenes
- Denoising, deskew
- Para fotos de mala calidad

#### 9. Integración Directa con ERPs
- SAP, Tango, Bejerman
- Conectores nativos
- Sincronización en tiempo real

#### 10. Mobile App
- React Native
- Upload desde cámara
- Notificaciones push

---

## 🛠️ Scripts Útiles

### Backend Scripts

**Ubicación:** `backend/src/scripts/`

| Script | Comando | Descripción |
|--------|---------|-------------|
| ver-regla-transformacion.js | `node src/scripts/ver-regla-transformacion.js` | Ver configuración de regla de transformación activa |
| ver-proveedores.js | `node src/scripts/ver-proveedores.js` | Listar proveedores en parametros_maestros |
| ver-cuits-documentos.js | `node src/scripts/ver-cuits-documentos.js` | Listar CUITs en documentos procesados |
| test-aplicar-reglas.js | `node src/scripts/test-aplicar-reglas.js` | Test de aplicación de reglas con documento específico |
| test-regla-timbo.js | `node src/scripts/test-regla-timbo.js` | Test de lógica OR con condición CONTAINS |
| check-tipos-reglas.js | `node src/scripts/check-tipos-reglas.js` | Listar todos los tipos de reglas en DB |

### Prisma Scripts

```bash
# Generar cliente Prisma (después de cambios en schema)
npm run db:generate

# Crear nueva migración
npm run db:migrate

# Push schema sin migración (desarrollo)
npm run db:push

# Abrir Prisma Studio (GUI de DB)
npm run db:studio

# Ejecutar seed
npm run db:seed
```

### PM2 (Producción)

```bash
# Iniciar aplicación
pm2 start ecosystem.config.js

# Ver logs
pm2 logs parse-backend
pm2 logs parse-frontend

# Reiniciar
pm2 restart all

# Ver estado
pm2 status

# Monitoreo
pm2 monit
```

---

## ⚠️ Problemas Conocidos

### 1. reglas_ejecuciones - Schema Issue

**Problema:**
```
Error: Argument `id` is missing
```

**Causa:** Campo `id` en schema no tiene `@default(uuid())`

**Workaround:** Logging deshabilitado (`logExecution: false`)

**Solución pendiente:**
```prisma
model reglas_ejecuciones {
  id String @id @default(uuid())  // ← Agregar @default
  // ... rest of fields
}
```

### 2. Rate Limiting de Gemini

**Problema:** Gemini devuelve 429 (rate limit) frecuentemente

**Workaround:**
- Solo 1 reintento (antes eran 3)
- Delay progresivo entre reintentos
- Fallback a Claude

**Solución pendiente:** Migrar a Document AI (sin rate limiting)

### 3. Valor por Defecto NULL en Regla

**Problema:** Regla con `valorDefecto: null` sobrescribe valores existentes

**Ejemplo:**
- Doc: "INDUSTRIAS QUÍMICAS TIMBO"
- CUIT no tiene match → razónSocial = null

**Solución:**
- Remover `valorDefecto` de regla
- O cambiar condición a solo `IS_EMPTY`

### 4. PDFs con Imágenes Pegadas

**Problema:** pdf-parse no puede leer texto en imágenes embebidas

**Solución propuesta:** PDF → Imagen + Gemini Vision (ver roadmap)

### 5. Timeout en Uploads Grandes

**Problema:** PDFs de 8-10MB timeout al procesar

**Workaround:**
- Límite actual: 10MB
- Timeout: 120 segundos

**Solución:** Procesamiento async en background job

---

## 📝 Notas de Configuración

### Permisos de Archivos

```bash
# uploads/ debe tener permisos de escritura
chmod -R 755 backend/uploads

# Crear estructura de directorios
mkdir -p backend/uploads/{tenant1,tenant2}/{pdf,images}
```

### Base de Datos

**PostgreSQL versión:** 13+

**Conexión:**
```bash
psql -U postgres -d rendiciones
```

**Backup manual:**
```bash
pg_dump -U postgres rendiciones > backup_$(date +%Y%m%d).sql
```

**Restore:**
```bash
psql -U postgres rendiciones < backup_20250130.sql
```

### Logs

**Ubicación:**
- Backend: `pm2 logs parse-backend`
- Frontend: `pm2 logs parse-frontend`
- PostgreSQL: `/var/log/postgresql/`

**Nivel de logs:**
- Development: Verbose (todos los logs)
- Production: Error + Warning only

---

## 🚀 Comandos de Inicio Rápido

### Desarrollo Local

```bash
# 1. Clonar repo (si aplica)
git clone <repo-url>
cd parse

# 2. Instalar dependencias
cd backend && npm install
cd ../frontend && npm install

# 3. Configurar .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Editar con tus valores

# 4. Iniciar base de datos
# (Asegurar que PostgreSQL esté corriendo)

# 5. Generar Prisma client
cd backend && npm run db:generate

# 6. Ejecutar migraciones
npm run db:migrate

# 7. Seed inicial (opcional)
npm run db:seed

# 8. Iniciar backend (puerto 5050)
npm run dev

# 9. En otra terminal, iniciar frontend (puerto 3000)
cd frontend && npm run dev

# 10. Abrir en navegador
http://localhost:3000
```

### Producción (PM2)

```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Configurar PM2
cd .. && pm2 start ecosystem.config.js

# 3. Guardar config PM2
pm2 save

# 4. Setup auto-start
pm2 startup

# 5. Ver estado
pm2 status
```

---

## 📞 Puntos de Contacto con el Código

### ¿Necesitas modificar...?

#### Extracción de Documentos
- **Procesamiento:** `backend/src/lib/documentProcessor.js`
- **Prompts:** Tabla `ai_prompts` o `backend/src/services/promptManager.js`
- **Validaciones:** `backend/src/routes/documentos.js` (líneas 2200-2360)

#### Reglas de Negocio
- **Motor:** `backend/src/services/businessRulesEngine.js`
- **Endpoint aplicación:** `backend/src/routes/documentos.js` (líneas 2988-3119)
- **CRUD reglas:** `backend/src/routes/reglas.js`

#### Frontend - Tabla de Documentos
- **Página principal:** `frontend/src/app/(protected)/parse/page.tsx`
- **Componentes:** `frontend/src/components/`
- **API client:** `frontend/src/lib/api.ts`

#### Sincronización SQL
- **Configuración:** `backend/src/routes/sync.js`
- **Ejecución:** `backend/src/services/sqlSyncService.js`
- **Frontend admin:** `frontend/src/app/(protected)/sync-admin/`

#### Autenticación
- **Backend:** `backend/src/routes/auth.js`
- **Passport config:** `backend/src/config/passport.js`
- **Middleware:** `backend/src/middleware/auth.js`
- **Frontend:** `frontend/src/app/auth/`

---

## 🎓 Convenciones del Proyecto

### Estilo de Código

**Backend (JavaScript):**
- CamelCase para variables y funciones
- PascalCase para clases
- Snake_case para nombres de tablas DB (Prisma)
- 2 espacios de indentación
- Semicolons opcionales (no enforced)

**Frontend (TypeScript):**
- CamelCase para variables y funciones
- PascalCase para componentes React
- Interfaces con prefijo `I` opcional
- 2 espacios de indentación
- Prettier para formateo

### Commits

**Formato:**
```
tipo: descripción corta

Descripción más detallada si es necesario

tipo puede ser:
- feat: Nueva funcionalidad
- fix: Bug fix
- docs: Documentación
- refactor: Refactorización
- test: Tests
- chore: Tareas menores
```

**Ejemplos:**
```
feat: Add currency field to document extraction
fix: CUIT normalization in LOOKUP_JSON operation
docs: Update API documentation for /aplicar-reglas
```

### Pruebas

**Backend:**
- Scripts en `backend/src/scripts/test-*.js`
- Ejecutar con Node.js
- No hay framework de testing formal (pendiente)

**Frontend:**
- No hay tests configurados (pendiente)

---

## 📚 Recursos Adicionales

### Documentación Oficial

- **Prisma:** https://www.prisma.io/docs
- **Next.js:** https://nextjs.org/docs
- **Express:** https://expressjs.com
- **Gemini API:** https://ai.google.dev/docs
- **Claude API:** https://docs.anthropic.com

### Documentos del Proyecto

1. **CLAUDE.md** - Instrucciones para Claude Code
2. **CONTEXTO-SESION-REGLAS-NEGOCIO.md** - Sesión de reglas de negocio
3. **backend/src/scripts/RESUMEN-FIX-CUIT.md** - Fix normalización CUIT
4. **Este documento** - Contexto completo de la aplicación

---

## ✅ Checklist para Nuevas Sesiones

Al iniciar una nueva sesión de desarrollo, usar este checklist:

### Contexto Recuperado
- [ ] Leído CONTEXTO-APLICACION-COMPLETA.md
- [ ] Leído CLAUDE.md (config de puertos, etc.)
- [ ] Revisado issues pendientes
- [ ] Verificado estado de la base de datos

### Ambiente Verificado
- [ ] Backend corriendo en puerto 5050
- [ ] Frontend corriendo en puerto 3000
- [ ] PostgreSQL conectado
- [ ] Variables de entorno configuradas

### Pruebas Rápidas
- [ ] Login funciona
- [ ] Upload de documento funciona
- [ ] Reglas de negocio funcionan
- [ ] No hay errores en consola

---

**FIN DEL DOCUMENTO DE CONTEXTO COMPLETO**

✅ Sistema documentado completamente
📅 Última actualización: 2025-10-30
👤 Desarrollado con Claude Code
🚀 Parse - Document Extraction & Transformation System v1.0.0
