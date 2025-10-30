# Parse - Sistema de Extracción y Transformación de Comprobantes

## 📋 Descripción General

**Parse** es una aplicación especializada en la extracción, transformación y envío de datos de comprobantes fiscales y comerciales argentinos. No gestiona pagos ni rendiciones - su único propósito es procesar documentos y entregar datos estructurados.

### Características Distintivas
- ✅ **Multitenant**: Soporte para múltiples clientes/organizaciones
- ✅ **Pipeline de IA en 2 fases**: Clasificación → Extracción específica
- ✅ **Prompts configurables**: Sin necesidad de modificar código
- ✅ **Sincronización bidireccional**: Integración con sistemas externos via SQL

---

## 🎯 Funcionalidades Core

### 1. Carga de Comprobantes
- Soporta **PDF** e **Imágenes**
- Upload mediante interfaz web
- Almacenamiento temporal para procesamiento

### 2. Extracción de Datos (Pipeline de IA en 2 Fases)

**Fase 1: Clasificador**
- Detecta el tipo de comprobante del documento cargado
- Tipos soportados:
  - Factura A / B / C
  - Nota de Crédito / Débito
  - Remito
  - Recibo
  - Despacho de aduana
  - Ticket fiscal

**Fase 2: Extractor Especializado**
- Usa prompt específico según el tipo detectado en Fase 1
- Extrae campos estructurados:
  - **Cabecera**: Número, fecha, emisor, receptor, CUIT, totales, IVA
  - **Detalle**: Items con descripción, cantidad, precio unitario, subtotal
  - **Impuestos**: IVA, percepciones, retenciones

**Proveedores de IA Soportados:**
- ✅ Google Gemini (actual)
- ✅ OpenAI
- ✅ Anthropic Claude
- 🎯 Google Document AI (roadmap - mejor precisión para facturas)

### 3. Prompts Editables
- Almacenados en **tabla de base de datos**
- Modificables por usuario sin tocar código
- Estructura:
  - Prompt de detección de tipo
  - Prompts específicos por tipo de comprobante (Factura A/B/C, Remito, Recibo, etc.)

### 4. Reglas de Negocio
- **Sistema de transformación** de datos extraídos
- Ejecución secuencial de reglas configurables
- Permite:
  - Normalizar formatos (fechas, números, CUIT)
  - Validar datos según estándares AFIP
  - Calcular campos derivados
  - Aplicar lógica condicional

### 5. Tabla de Parámetros
- **Completa datos faltantes** basándose en valores extraídos
- Ejemplos:
  - CUIT → Razón Social
  - Código producto → Descripción, categoría
  - Centro de costo → Cuenta contable
- Configuración dinámica sin hardcodear lógica

### 6. Sincronización SQL (Bidireccional)
- **API de entrada**: Recibe datos de sistemas externos
- **API de salida**: Envía comprobantes procesados
- Integración con ERP/contabilidad
- Endpoints ya implementados

---

## 🗄️ Base de Datos

### Información General
- **Nombre**: `parse_db`
- **Motor**: PostgreSQL 14+
- **ORM**: Prisma
- **Estado**: Base de datos operativa, migrada desde `rendiciones_db`

### Tablas Principales

#### Procesamiento de Documentos
- `documentos_procesados` - Comprobantes cargados y procesados
- `documento_lineas` - Detalle/items de cada comprobante
- `documento_impuestos` - Impuestos extraídos (IVA, percepciones, retenciones)

#### Configuración de IA
- `ai_prompts` - Prompts editables para clasificación y extracción
  - Prompt clasificador
  - Prompts específicos por tipo de comprobante
- Editable desde UI sin tocar código

#### Reglas de Negocio
- `reglas_negocio` - Reglas de transformación y validación
  - Normalización de formatos
  - Validaciones AFIP
  - Cálculos derivados
  - Lógica condicional
- `parametros_maestros` - Tabla de parámetros para completado automático
  - Mapeos CUIT → Razón Social
  - Código producto → Descripción/Categoría
  - Centro de costo → Cuenta contable

#### Sincronización
- `sync_configurations` - Configuración de conexiones SQL externas
- Endpoints para integración bidireccional con ERP/sistemas contables

#### Multitenant
- `tenants` - Organizaciones/clientes
- `users` - Usuarios con asociación a tenants
- Aislamiento de datos por tenant

---

## 🚫 Funcionalidades NO Incluidas

Parse **NO** gestiona:
- ❌ Efectivo ni tarjetas
- ❌ Rendiciones de gastos
- ❌ Flujos de aprobación
- ❌ Reembolsos
- ❌ Gestión de usuarios con roles de aprobación
- ❌ Reportes financieros

Estas funcionalidades pertenecían a la aplicación anterior (`rendiciones_db`) y serán eliminadas.

---

## 🔄 Flujo de Procesamiento

```
1. UPLOAD
   ↓
2. DETECCIÓN (Prompt General)
   ↓
3. EXTRACCIÓN (Prompt Específico)
   ↓
4. TRANSFORMACIÓN (Reglas de Negocio)
   ↓
5. COMPLETADO (Tabla Parámetros)
   ↓
6. VALIDACIÓN
   ↓
7. ENVÍO A SQL (API)
```

---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express
- **ORM**: Prisma
- **Base de datos**: PostgreSQL 14+
- **Auth**: JWT + Google OAuth
- **Puerto**: **5050** (API REST)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: Shadcn/ui + Tailwind CSS
- **State Management**: React Context
- **Forms**: React Hook Form + Zod
- **Puerto desarrollo**: **3000**
- **Puerto producción**: **8084** (servidor PM2)

### IA/OCR
- **Actual**: Google Gemini API
- **Futuro**: Google Document AI (roadmap - 95%+ precisión)
- **Fallback**: Procesamiento local con Regex
- **Alternativa futura**: Ollama (IA local) - Ver CLAUDE.md

### Seguridad
- Autenticación JWT
- Multitenant con aislamiento de datos
- API keys encriptadas en BD
- Rate limiting
- CORS configurado

### Variables de Entorno Clave

**Backend** (`backend/.env`):
```env
# Base de datos
DATABASE_URL="postgresql://user:password@host:5432/parse_db"

# API
PORT=5050
NODE_ENV=production

# IA
ENABLE_AI_EXTRACTION=true
GEMINI_API_KEY=tu_api_key

# Auth
JWT_SECRET=tu_jwt_secret
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5050
```

---

## 📊 Arquitectura de Prompts

### Prompt de Detección
```
Analiza este documento y determina el tipo:
- Factura A/B/C
- Remito
- Recibo
- Nota de Crédito/Débito
- Ticket fiscal
- Otro
```

### Prompts Específicos (Ejemplos)

**Factura:**
```json
{
  "tipo": "FACTURA_A",
  "campos_extraer": [
    "punto_venta", "numero", "fecha_emision",
    "cuit_emisor", "razon_social_emisor",
    "cuit_receptor", "razon_social_receptor",
    "subtotal", "iva_21", "iva_10.5", "total",
    "items": [
      {"descripcion", "cantidad", "precio_unitario", "subtotal"}
    ]
  ]
}
```

---

## 🎯 Casos de Uso

1. **Digitalización masiva de facturas**
   - Escanear lote de facturas → Parse extrae datos → Envía a sistema contable

2. **Integración con ERP**
   - ERP envía PDF factura → Parse procesa → Devuelve JSON estructurado

3. **Validación fiscal**
   - Parse extrae CUIT → Valida contra tabla parámetros → Completa datos empresa

4. **Procesamiento híbrido**
   - Parse intenta IA → Si falla, marca para revisión manual → Usuario corrige → Re-procesa

---

## 🏗️ Estructura del Proyecto

```
parse/
├── backend/               # API Node.js + Express + Prisma
│   ├── src/
│   │   ├── routes/        # Endpoints REST
│   │   │   ├── auth.js
│   │   │   ├── documentos.js
│   │   │   └── tenants.js
│   │   ├── services/      # Lógica de negocio
│   │   │   └── documentProcessor.js  # Pipeline de IA
│   │   └── middleware/    # Auth, validación, etc.
│   ├── prisma/
│   │   ├── schema.prisma  # Esquema de BD
│   │   └── migrations/
│   └── .env               # Variables de entorno
│
├── frontend/              # Web app Next.js
│   ├── src/
│   │   ├── app/           # Pages (App Router)
│   │   │   ├── auth/login/
│   │   │   └── (protected)/
│   │   │       ├── parse/
│   │   │       ├── usuarios/
│   │   │       └── parametros/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   └── ui/        # Shadcn components
│   │   └── lib/           # Utilidades
│   └── .env.local
│
├── docs/                  # Documentación
│   ├── PARSE_CONTEXT.md  # Este archivo
│   ├── CLAUDE.md         # Config desarrollo
│   └── README.md         # Guía principal
│
└── package.json           # Scripts del proyecto
```

---

## 🚀 Comandos de Desarrollo

### Instalación
```bash
# Instalar dependencias de backend y frontend
npm run install:all
```

### Base de Datos
```bash
cd backend
npx prisma db push          # Sincronizar schema con BD
npx prisma generate         # Generar cliente Prisma
npx prisma studio           # Abrir GUI de BD
```

### Desarrollo
```bash
# Opción 1: Ejecutar ambos servidores
npm run dev

# Opción 2: Por separado
npm run dev:backend   # Backend en puerto 5050
npm run dev:frontend  # Frontend en puerto 3000
```

### Producción
```bash
# Build
cd frontend && npm run build
cd backend && npm run build

# Ejecutar con PM2
pm2 start ecosystem.config.js
```

### Testing
```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## 📊 Estado Actual del Proyecto

### ✅ Problemas Resueltos (según CLAUDE.md)
1. **Regex Error**: Agregado flag `g` a patrón en `extractTipoComprobante()` línea 1041
2. **JSON Parsing Gemini**: Mejorada limpieza de respuestas con logs detallados
3. **Error Handling**: Documentos ya no se eliminan al fallar extracción

### 🔄 Flujo de Procesamiento con Reintentos
1. 🤖 **Primero**: Intenta extracción con Gemini (3 reintentos)
2. 🔧 **Segundo**: Si falla, usa procesamiento local con regex
3. 💾 **Resultado**: Documento se guarda siempre (incluso con datos parciales)

### 📝 Git Status Actual
```
Branch: master

Archivos modificados:
- backend/prisma/schema.prisma
- backend/src/routes/auth.js
- backend/src/routes/documentos.js
- backend/src/routes/tenants.js
- backend/src/seed/menu-items.js
- frontend/src/app/(protected)/parametros/page.tsx
- frontend/src/app/(protected)/parse/page.tsx
- frontend/src/app/(protected)/usuarios/page.tsx
- frontend/src/app/auth/login/page.tsx
- frontend/src/components/layout/Sidebar.tsx

Archivos eliminados:
- frontend/src/app/app-launcher/page.tsx
- frontend/src/components/launcher/AppCard.tsx

Commits recientes:
- Fix: Corregir referencias a campo 'plan' inexistente en tenants
- Update: Cambiar título de página a 'Axioma - Parse'
- Update: Cambiar login de Rendiciones a Parse con icono ScanText
- Fix: Agregar campos tipo, cajaId y rendicionItemId al schema
```

---

## 📈 Roadmap

### Corto Plazo (Completado)
- ✅ Migración a `parse_db`
- ✅ Corrección de errores críticos de parsing
- ✅ Sistema de reintentos y fallback
- ✅ Mejora de logs de debugging

### Mediano Plazo (En planificación)
- 🎯 Migración a Google Document AI (95%+ precisión)
  - Costo: $60 USD por 1000 páginas
  - Incluye 1000 páginas gratis/mes
  - Mejor detección de tablas y campos fiscales
- 🎯 Editor visual de reglas de negocio
- 🎯 API webhooks para notificaciones
- 🎯 Integración con AFIP (validación CUIT, facturas)

### Largo Plazo (Roadmap)
- 🔮 Custom ML model entrenado con facturas argentinas
- 🔮 OCR mejorado para fotos de baja calidad
- 🔮 Procesamiento batch automático
- 🔮 Exportación directa a SAP/ERP
- 🔮 Machine Learning para categorización automática de gastos

### Alternativa Futura: IA Local con Ollama
- Modelo recomendado: `llama3.2:3b` (2GB disco, 4GB RAM)
- Función ya implementada: `extractWithOllama()` en `documentProcessor.js:324`
- Ventajas: Sin costos por token, offline, datos privados
- Requiere configuración en `.env`: `USE_OLLAMA=true`

---

## 🔍 Debugging y Logs

### Logs Actuales de Procesamiento
```javascript
// Logs implementados en backend/src/services/documentProcessor.js
console.log('Raw Gemini response:', response);      // Respuesta completa de Gemini
console.log('Cleaned JSON text:', cleanedText);     // JSON después de limpieza
console.log('Re-cleaned JSON:', reCleanedText);     // Segundo intento si falla parsing
```

### Variables de Debug (opcionales)
```env
DEBUG_AI_RESPONSES=true
LOG_LEVEL=debug
SAVE_FAILED_EXTRACTIONS=true
```

### Archivos Clave para Debugging
- `backend/src/services/documentProcessor.js` - Pipeline de IA, línea 324 (Ollama), línea 1041 (regex)
- `backend/src/routes/documentos.js` - Endpoints de carga/procesamiento
- `backend/prisma/schema.prisma` - Esquema de BD

---

## 🎓 Contexto de Negocio

### ¿Qué hace Parse?
Parse es un **transformador de documentos fiscales**. Toma PDFs o imágenes de facturas argentinas y los convierte en datos estructurados listos para enviar a sistemas contables/ERP.

### ¿Qué NO hace Parse?
- ❌ No gestiona pagos ni tarjetas de crédito
- ❌ No maneja rendiciones de gastos
- ❌ No tiene flujos de aprobación
- ❌ No genera reportes financieros

**Nota**: Estas funcionalidades existían en la app anterior (`rendiciones_db`) pero fueron removidas para enfocar Parse exclusivamente en **extracción y transformación**.

### Casos de Uso Típicos

1. **Digitalización masiva**: Cliente escanea 100 facturas → Parse extrae todos los datos → Envía a contabilidad
2. **Integración ERP**: Sistema externo envía PDF de factura → Parse procesa → Devuelve JSON estructurado
3. **Validación fiscal**: Parse extrae CUIT → Busca en tabla parámetros → Completa razón social automáticamente
4. **Procesamiento híbrido**: Parse intenta IA → Si falla marca para revisión manual → Usuario corrige → Re-procesa

---

## 📞 Recursos y Documentación

### Archivos de Documentación
- **PARSE_CONTEXT.md** (este archivo) - Contexto completo del proyecto
- **README.md** - Guía de inicio rápido
- **CLAUDE.md** - Configuración de desarrollo, puertos, y notas técnicas
- **PROMPT_RECUPERACION.md** - Prompt para recuperar contexto en nuevas sesiones (si existe)
- **PLAN_LIMPIEZA.md** - Plan de limpieza de código heredado (si existe)

### Comandos Útiles de Git
```bash
git status                    # Ver archivos modificados
git log --oneline -10         # Ver últimos 10 commits
git diff                      # Ver cambios no commiteados
```

### Acceso Rápido
- **Frontend local**: http://localhost:3000
- **Backend API**: http://localhost:5050
- **Prisma Studio**: http://localhost:5555 (después de `npx prisma studio`)

---

## 🔑 Información Importante para Recuperación de Contexto

### Para Claude en Futuras Sesiones:

**Puertos configurados (NO cambiar):**
- Backend: 5050
- Frontend desarrollo: 3000
- Frontend producción: 8084

**Base de datos:**
- Nombre: `parse_db`
- Motor: PostgreSQL
- ORM: Prisma

**Proyecto enfocado en:**
- Extracción de datos de comprobantes fiscales argentinos
- Pipeline de IA en 2 fases (clasificación → extracción)
- Multitenant con aislamiento de datos
- Integración con sistemas externos via API

**Archivos críticos:**
- `backend/src/services/documentProcessor.js` - Lógica de extracción de IA
- `backend/prisma/schema.prisma` - Esquema de base de datos
- `frontend/src/app/(protected)/parse/page.tsx` - UI principal de procesamiento

**Estado actual:**
- Sistema operativo y funcional
- Pipeline de IA con Gemini funcionando
- Reintentos y fallback implementados
- Multitenant activo

---

**Última actualización**: 2025-10-29
**Versión**: 1.0.0
**Estado**: Operativo - Migrado de rendiciones_db a parse_db
**Rama actual**: master
