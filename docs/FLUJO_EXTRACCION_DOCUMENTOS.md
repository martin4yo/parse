# Flujo de Extracción de Datos de Documentos

## Índice
1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Punto de Entrada](#punto-de-entrada)
4. [Flujo de Decisión](#flujo-de-decisión)
5. [Modo Pipeline (2 pasos)](#modo-pipeline-2-pasos)
6. [Modo Simple (1 paso)](#modo-simple-1-paso)
7. [Sistema de Prompts](#sistema-de-prompts)
8. [Sistema de Planes y Features](#sistema-de-planes-y-features)
9. [Configuración de Motores de IA](#configuración-de-motores-de-ia)
10. [Estructura de Datos Extraídos](#estructura-de-datos-extraídos)
11. [Referencias de Código](#referencias-de-código)

---

## Introducción

Este documento describe el sistema completo de extracción automatizada de datos de documentos (facturas, tickets, despachos de aduana, etc.) utilizando Inteligencia Artificial.

El sistema es **multi-tenant** y soporta **planes diferenciados** con distintos niveles de precisión y funcionalidades según el plan contratado.

### Características Principales

- ✅ Extracción en **1 paso** (Simple) o **2 pasos** (Pipeline)
- ✅ **Clasificación automática** de tipo de documento
- ✅ **Prompts especializados** según tipo de documento
- ✅ **Prompts customizables** por tenant
- ✅ Soporte para múltiples **motores de IA** (Gemini, Claude, OpenAI)
- ✅ **API keys personalizadas** por tenant (feature premium)
- ✅ Sistema de **planes y features** configurable

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                  USUARIO SUBE DOCUMENTO                  │
│                  (PDF, JPG, PNG)                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│          documentExtractionOrchestrator.js              │
│              (Orquestador Principal)                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              featureService.canUsePipeline()            │
│         ¿Tenant tiene AI_PIPELINE_EXTRACTION?           │
└─────────────────────────────────────────────────────────┘
              ↓                           ↓
         ✅ SÍ                         ❌ NO
              ↓                           ↓
    ┌──────────────────┐       ┌──────────────────┐
    │  MODO PIPELINE   │       │   MODO SIMPLE    │
    │    (2 pasos)     │       │    (1 paso)      │
    └──────────────────┘       └──────────────────┘
              ↓                           ↓
    ┌──────────────────┐       ┌──────────────────┐
    │  Paso 1:         │       │  Prompt:         │
    │  CLASIFICACIÓN   │       │  EXTRACCION_     │
    │                  │       │  UNIVERSAL       │
    └──────────────────┘       └──────────────────┘
              ↓
    ┌──────────────────┐
    │  Paso 2:         │
    │  EXTRACCIÓN      │
    │  ESPECIALIZADA   │
    └──────────────────┘
              ↓
    ┌──────────────────┐
    │  Prompt según    │
    │  tipo:           │
    │  - FACTURA_A     │
    │  - FACTURA_B     │
    │  - TICKET        │
    │  - etc.          │
    └──────────────────┘
```

---

## Punto de Entrada

### Endpoint de Procesamiento

**Ruta**: `POST /api/documentos/procesar`

**Archivo**: `backend/src/routes/documentos.js:154`

**Request**:
```javascript
POST /api/documentos/procesar
Content-Type: multipart/form-data

{
  documento: File,              // PDF, JPG, PNG (max 10MB)
  tipo: "tarjeta" | "efectivo",
  rendicionItemId?: string,
  cajaId?: string
}
```

**Flujo Inicial**:
1. Valida archivo (tipo, tamaño)
2. Guarda en disco (`uploads/documentos/`)
3. Extrae texto del documento (OCR si es imagen)
4. **Llama al orquestador**: `orchestrator.extractData(documentText, tenantId, userId)`
5. Guarda datos extraídos en BD

---

## Flujo de Decisión

### 1. Verificación de Plan del Tenant

**Archivo**: `documentExtractionOrchestrator.js:33`

```javascript
const hasPipeline = await featureService.canUsePipeline(tenantId);

if (hasPipeline) {
  resultado = await this.extractWithPipeline(documentText, tenantId);
} else {
  resultado = await this.extractWithSimplePrompt(documentText, tenantId);
}
```

### 2. Cascada de Resolución

```
featureService.canUsePipeline(tenantId)
         ↓
1. Buscar tenant en BD
2. Obtener su plan (relación: tenant → plan)
3. Obtener features del plan (relación: plan → plan_features)
4. Verificar si existe feature "AI_PIPELINE_EXTRACTION"
5. Retornar true/false
```

**Archivo**: `backend/src/services/featureService.js:211`

---

## Modo Pipeline (2 pasos)

### Diagrama de Flujo

```
┌──────────────────────────────────────────┐
│  PASO 1: CLASIFICACIÓN                   │
│  classifierService.classify()            │
├──────────────────────────────────────────┤
│  1. Obtener prompt "CLASIFICADOR_        │
│     DOCUMENTO" de la BD                  │
│  2. Reemplazar {{DOCUMENT_TEXT}}         │
│  3. Llamar a IA (Gemini/Claude)          │
│  4. Parsear respuesta JSON               │
└──────────────────────────────────────────┘
                  ↓
        Resultado: {
          tipoDocumento: "FACTURA_A",
          confianza: 0.95,
          subtipos: ["SERVICIOS"]
        }
                  ↓
┌──────────────────────────────────────────┐
│  PASO 2: EXTRACCIÓN ESPECIALIZADA        │
│  extractWithSpecializedPrompt()          │
├──────────────────────────────────────────┤
│  1. Mapear tipo → prompt key             │
│     FACTURA_A → EXTRACCION_FACTURA_A     │
│  2. Obtener prompt especializado de BD   │
│  3. Reemplazar {{DOCUMENT_TEXT}}         │
│  4. Llamar a IA con prompt específico    │
│  5. Parsear respuesta JSON               │
└──────────────────────────────────────────┘
                  ↓
        Resultado: {
          numeroFactura: "...",
          fecha: "...",
          cuit: "...",
          ...
        }
```

### PASO 1: Clasificación de Documento

**Archivo**: `backend/src/services/classifierService.js:23`

**Función**: `classify(documentText, tenantId)`

**Prompt utilizado**: `CLASIFICADOR_DOCUMENTO`

**Búsqueda del prompt**:
```sql
-- 1. Buscar custom del tenant
SELECT * FROM ai_prompts
WHERE clave = 'CLASIFICADOR_DOCUMENTO'
  AND tipo = 'CLASIFICADOR'
  AND tenantId = 'tenant-123'
  AND activo = true
LIMIT 1;

-- 2. Si no existe, buscar global
SELECT * FROM ai_prompts
WHERE clave = 'CLASIFICADOR_DOCUMENTO'
  AND tipo = 'CLASIFICADOR'
  AND tenantId IS NULL
  AND activo = true
LIMIT 1;
```

**Respuesta esperada**:
```json
{
  "tipo": "FACTURA_A",
  "confianza": 0.95,
  "subtipos": ["SERVICIOS", "ELECTRONICA"]
}
```

**Fallback**: Si falla la clasificación con IA, usa regex básico (`defaultClassification`)

**Código**: `classifierService.js:171`

### PASO 2: Extracción Especializada

**Archivo**: `documentExtractionOrchestrator.js:74`

**Mapeo Tipo → Prompt Key**:

```javascript
getPromptKeyForType(tipoDocumento) {
  const mapping = {
    'FACTURA_A': 'EXTRACCION_FACTURA_A',
    'FACTURA_B': 'EXTRACCION_FACTURA_B',
    'FACTURA_C': 'EXTRACCION_FACTURA_C',
    'DESPACHO_ADUANA': 'EXTRACCION_DESPACHO_ADUANA',
    'COMPROBANTE_IMPORTACION': 'EXTRACCION_COMPROBANTE_IMPORTACION',
    'NOTA_CREDITO': 'EXTRACCION_FACTURA_A',  // Reutiliza Factura A
    'TICKET': 'EXTRACCION_FACTURA_C'         // Reutiliza Factura C
  };

  return mapping[tipoDocumento] || 'EXTRACCION_UNIVERSAL';
}
```

**Código**: `documentExtractionOrchestrator.js:292`

**Ejemplo de Prompt Especializado**:

```
Clave: EXTRACCION_FACTURA_A
Tipo: EXTRACTOR_ESPECIALIZADO
Motor: gemini

Prompt:
---
Eres un asistente especializado en extraer datos de Facturas tipo A argentinas.

Facturas tipo A son emitidas por responsables inscriptos a otros responsables inscriptos.
Contienen:
- CUIT del emisor y receptor
- Discriminación de IVA
- CAE (Código de Autorización Electrónico)

DOCUMENTO:
{{DOCUMENT_TEXT}}

Extrae TODOS los campos y devuelve SOLO un JSON válido:
{
  "numeroFactura": "0001-00012345",
  "fecha": "2024-03-15",
  "cuit": "20-12345678-9",
  "razonSocial": "EMPRESA EJEMPLO SA",
  "subtotal": 10000.00,
  "iva": 2100.00,
  "total": 12100.00,
  "cae": "74123456789012",
  "items": [...],
  "impuestos": [...]
}
---
```

---

## Modo Simple (1 paso)

### Diagrama de Flujo

```
┌──────────────────────────────────────────┐
│  EXTRACCIÓN DIRECTA                      │
│  extractWithSimplePrompt()               │
├──────────────────────────────────────────┤
│  1. Usar prompt "EXTRACCION_UNIVERSAL"   │
│  2. Reemplazar {{DOCUMENT_TEXT}}         │
│  3. Llamar a IA (sin clasificación)      │
│  4. Parsear respuesta JSON               │
└──────────────────────────────────────────┘
                  ↓
        Resultado: {
          numeroFactura: "...",
          fecha: "...",
          cuit: "...",
          ...
        }
```

**Archivo**: `documentExtractionOrchestrator.js:106`

**Prompt utilizado**: `EXTRACCION_UNIVERSAL`

**Características**:
- ✅ Más rápido (1 sola llamada a IA)
- ✅ Más económico (menos tokens)
- ⚠️ Menos preciso (prompt genérico)
- ⚠️ No detecta tipo de documento

**Ejemplo de Prompt Universal**:

```
Clave: EXTRACCION_UNIVERSAL
Tipo: EXTRACTOR_SIMPLE
Motor: gemini

Prompt:
---
Extrae datos de este comprobante fiscal (puede ser factura, ticket, recibo, etc.)

DOCUMENTO:
{{DOCUMENT_TEXT}}

Extrae todos los campos que encuentres y devuelve SOLO un JSON válido:
{
  "numeroFactura": "0001-00012345",
  "fecha": "2024-03-15",
  "cuit": "20-12345678-9",
  "razonSocial": "EMPRESA EJEMPLO SA",
  "total": 12100.00,
  "tipoComprobante": "FACTURA A",
  ...
}
---
```

---

## Sistema de Prompts

### Tabla: `ai_prompts`

**Esquema**: `backend/prisma/schema.prisma:1010`

```prisma
model ai_prompts {
  id          String   @id @default(cuid())
  clave       String   // "CLASIFICADOR_DOCUMENTO", "EXTRACCION_FACTURA_A"
  nombre      String   // "Clasificador de Documentos"
  descripcion String?  // Descripción del propósito
  prompt      String   @db.Text // Prompt completo con placeholders
  variables   Json?    // {"DOCUMENT_TEXT": "descripción"}
  activo      Boolean  @default(true)
  version     Int      @default(1)
  motor       String?  // "gemini" | "anthropic" | "openai" | null
  tipo        String?  // "CLASIFICADOR" | "EXTRACTOR_ESPECIALIZADO" | "EXTRACTOR_SIMPLE"

  // Tenant (null = global, string = custom)
  tenantId    String?

  // Métricas
  vecesUsado  Int      @default(0)
  ultimoUso   DateTime?
  tasaExito   Decimal?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Tipos de Prompts

| Tipo | Clave | Descripción |
|------|-------|-------------|
| **CLASIFICADOR** | `CLASIFICADOR_DOCUMENTO` | Identifica el tipo de documento (Factura A/B/C, Ticket, etc.) |
| **EXTRACTOR_ESPECIALIZADO** | `EXTRACCION_FACTURA_A` | Extrae datos específicos de Facturas tipo A |
| **EXTRACTOR_ESPECIALIZADO** | `EXTRACCION_FACTURA_B` | Extrae datos específicos de Facturas tipo B |
| **EXTRACTOR_ESPECIALIZADO** | `EXTRACCION_FACTURA_C` | Extrae datos específicos de Facturas tipo C |
| **EXTRACTOR_ESPECIALIZADO** | `EXTRACCION_DESPACHO_ADUANA` | Extrae datos de despachos de aduana |
| **EXTRACTOR_SIMPLE** | `EXTRACCION_UNIVERSAL` | Extracción genérica para cualquier documento |

### Cascada de Resolución de Prompts

**Archivo**: `documentExtractionOrchestrator.js:313`

```javascript
async getPrompt(clave, tenantId) {
  // 1. Buscar custom del tenant
  let prompt = await prisma.ai_prompts.findFirst({
    where: {
      clave,
      tenantId,
      activo: true
    }
  });

  // 2. Si no existe, buscar global
  if (!prompt) {
    prompt = await prisma.ai_prompts.findFirst({
      where: {
        clave,
        tenantId: null,
        activo: true
      }
    });
  }

  return prompt;
}
```

**Flujo de búsqueda**:

```
Necesito prompt "EXTRACCION_FACTURA_A" para tenant "empresa-123"
         ↓
┌─────────────────────────────────────────┐
│  1. Buscar custom del tenant            │
│     WHERE clave = 'EXTRACCION_FACTURA_A'│
│       AND tenantId = 'empresa-123'      │
│       AND activo = true                 │
└─────────────────────────────────────────┘
         ↓
    ✅ ¿Existe?
         ↓
      SÍ → USAR ESE (prompt personalizado)
         ↓
      NO → Continuar
         ↓
┌─────────────────────────────────────────┐
│  2. Buscar global                       │
│     WHERE clave = 'EXTRACCION_FACTURA_A'│
│       AND tenantId IS NULL              │
│       AND activo = true                 │
└─────────────────────────────────────────┘
         ↓
    ✅ ¿Existe?
         ↓
      SÍ → USAR ESE (prompt por defecto)
         ↓
      NO → ERROR
```

### Variables en Prompts

Los prompts pueden contener placeholders que se reemplazan en tiempo de ejecución:

```javascript
// Prompt en BD:
"Analiza el siguiente documento: {{DOCUMENT_TEXT}}"

// Reemplazo en ejecución:
const fullPrompt = prompt.prompt.replace('{{DOCUMENT_TEXT}}', documentText);

// Resultado:
"Analiza el siguiente documento: FACTURA A ... [texto completo]"
```

**Código**: `documentExtractionOrchestrator.js:152`

---

## Sistema de Planes y Features

### Arquitectura de Planes

```
┌─────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Tenant    │ ───→  │    Plan      │ ───→  │  Plan Features  │
└─────────────┘       └──────────────┘       └─────────────────┘
   empresa-123          Mythic                 - AI_PIPELINE_EXTRACTION
                        $99/mes                - AI_CUSTOM_API_KEYS
                                               - ADVANCED_OCR
                                               - CUSTOM_PROMPTS
```

### Tabla: `planes`

**Esquema**: `backend/prisma/schema.prisma:1053`

```prisma
model planes {
  id          String   @id @default(cuid())
  codigo      String   @unique // "Common", "Uncommon", "Rare", "Mythic"
  nombre      String   // "Plan Common"
  descripcion String?
  precio      Decimal? @db.Decimal(10, 2)
  activo      Boolean  @default(true)
  orden       Int      @default(0)

  features    plan_features[]
  tenants     tenants[]
}
```

### Tabla: `plan_features`

**Esquema**: `backend/prisma/schema.prisma:1072`

```prisma
model plan_features {
  id        String   @id @default(cuid())
  planId    String
  feature   String   // "AI_PIPELINE_EXTRACTION", "AI_SIMPLE_EXTRACTION"
  config    Json?    // Configuración específica

  plan      planes   @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, feature])
}
```

### Features Disponibles

| Feature | Descripción | Config Ejemplo |
|---------|-------------|----------------|
| `AI_SIMPLE_EXTRACTION` | Extracción en 1 paso (prompt universal) | `{ maxDocumentosPorMes: 100 }` |
| `AI_PIPELINE_EXTRACTION` | Extracción en 2 pasos (clasificación + especializada) | `{ maxDocumentosPorMes: 1000 }` |
| `AI_CUSTOM_API_KEYS` | Permite usar API keys propias del tenant | `{ providers: ["gemini", "anthropic"] }` |
| `CUSTOM_PROMPTS` | Permite crear prompts personalizados | `{}` |
| `ADVANCED_OCR` | OCR mejorado para imágenes de baja calidad | `{}` |

### Verificación de Features

**Archivo**: `backend/src/services/featureService.js:20`

```javascript
async isEnabled(tenantId, featureName) {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    include: {
      plan_relation: {
        include: {
          features: true
        }
      }
    }
  });

  if (!tenant?.plan_relation) {
    return false;
  }

  return tenant.plan_relation.features.some(
    f => f.feature === featureName
  );
}
```

**Ejemplo de uso**:

```javascript
// Verificar si puede usar pipeline
const hasPipeline = await featureService.isEnabled(
  'tenant-123',
  'AI_PIPELINE_EXTRACTION'
);

if (hasPipeline) {
  // Usar extracción en 2 pasos
} else {
  // Usar extracción simple
}
```

### Ejemplo de Configuración de Planes

**Seed**: `backend/prisma/seeds/planes.js`

```javascript
// Plan Common (Gratis)
{
  codigo: 'Common',
  nombre: 'Plan Common',
  precio: 0,
  features: [
    {
      feature: 'AI_SIMPLE_EXTRACTION',
      config: { maxDocumentosPorMes: 100 }
    }
  ]
}

// Plan Mythic (Premium)
{
  codigo: 'Mythic',
  nombre: 'Plan Mythic',
  precio: 99,
  features: [
    {
      feature: 'AI_PIPELINE_EXTRACTION',
      config: { maxDocumentosPorMes: 10000 }
    },
    {
      feature: 'AI_CUSTOM_API_KEYS',
      config: { providers: ['gemini', 'anthropic', 'openai'] }
    },
    {
      feature: 'CUSTOM_PROMPTS',
      config: {}
    }
  ]
}
```

---

## Configuración de Motores de IA

### Arquitectura de API Keys

```
┌──────────────────────────────────────────────┐
│  Necesito API key para "gemini"              │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  1. ¿Tenant tiene custom config?             │
│     ai_provider_configs                      │
│     WHERE tenantId = 'X' AND provider = 'Y'  │
└──────────────────────────────────────────────┘
                  ↓
            ✅ Existe?
                  ↓
       SÍ → Descifrar y usar
                  ↓
       NO → Buscar en .env global
                  ↓
            process.env.GEMINI_API_KEY
                  ↓
            ✅ Existe?
                  ↓
       SÍ → USAR
       NO → ERROR
```

### Tabla: `ai_provider_configs`

**Esquema**: `backend/prisma/schema.prisma:1091`

```prisma
model ai_provider_configs {
  id                String   @id @default(cuid())
  tenantId          String
  provider          String   // "gemini" | "anthropic" | "openai"
  apiKeyEncrypted   String   @db.Text // Cifrado AES-256-GCM
  modelo            String?  // "gemini-1.5-flash-latest"
  maxRequestsPerDay Int?     @default(1000)
  config            Json?    // Config adicional
  activo            Boolean  @default(true)

  tenant            tenants  @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, provider])
}
```

### Servicio: `aiConfigService`

**Archivo**: `backend/src/services/aiConfigService.js:33`

**Obtener API Key**:

```javascript
async getApiKey(provider, tenantId = null) {
  // 1. Intentar custom del tenant
  if (tenantId) {
    const tenantConfig = await prisma.ai_provider_configs.findUnique({
      where: {
        tenantId_provider: { tenantId, provider }
      }
    });

    if (tenantConfig?.apiKeyEncrypted && tenantConfig.activo) {
      console.log(`🔑 Usando API key custom del tenant`);
      return this.decrypt(tenantConfig.apiKeyEncrypted);
    }
  }

  // 2. Fallback a .env global
  const envKey = this.getEnvKeyForProvider(provider);
  if (envKey) {
    console.log(`🔑 Usando API key global (.env)`);
    return envKey;
  }

  throw new Error(`No hay API key configurada para ${provider}`);
}
```

**Mapeo de Providers**:

```javascript
getEnvKeyForProvider(provider) {
  const mapping = {
    'gemini': process.env.GEMINI_API_KEY,
    'anthropic': process.env.ANTHROPIC_API_KEY,
    'openai': process.env.OPENAI_API_KEY,
    'google-document-ai': process.env.GOOGLE_APPLICATION_CREDENTIALS
  };

  return mapping[provider];
}
```

### Cifrado de API Keys

**Algoritmo**: AES-256-GCM

**Formato**: `iv:authTag:encrypted`

**Código**: `aiConfigService.js:224`

```javascript
encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

### Modelos por Defecto

```javascript
getDefaultModel(provider) {
  const defaults = {
    'gemini': 'gemini-1.5-flash-latest',
    'anthropic': 'claude-3-5-sonnet-20241022',
    'openai': 'gpt-4o'
  };

  return defaults[provider] || 'default';
}
```

---

## Estructura de Datos Extraídos

### Respuesta del Orquestador

**Tipo**: `PIPELINE`

```json
{
  "metodo": "PIPELINE",
  "clasificacion": {
    "tipoDocumento": "FACTURA_A",
    "confianza": 0.95,
    "subtipos": ["SERVICIOS", "ELECTRONICA"],
    "modelo": "gemini-1.5-flash-latest"
  },
  "datos": {
    "numeroFactura": "0001-00012345",
    "fecha": "2024-03-15T00:00:00.000Z",
    "cuit": "20-12345678-9",
    "razonSocial": "EMPRESA EJEMPLO SA",
    "tipoComprobante": "FACTURA A",
    "subtotal": 10330.58,
    "iva": 2169.42,
    "total": 12500.00,
    "cae": "74123456789012",
    "vencimientoCae": "2024-03-25",
    "puntoVenta": "0001",
    "numeroComprobante": "00012345",
    "items": [
      {
        "numero": 1,
        "descripcion": "Servicio de consultoría",
        "cantidad": 10,
        "precioUnitario": 1033.06,
        "subtotal": 10330.58,
        "alicuotaIva": 21.00,
        "importeIva": 2169.42,
        "totalLinea": 12500.00
      }
    ],
    "impuestos": [
      {
        "tipo": "IVA",
        "descripcion": "IVA 21%",
        "alicuota": 21.00,
        "baseImponible": 10330.58,
        "importe": 2169.42
      }
    ]
  },
  "promptUtilizado": "EXTRACCION_FACTURA_A",
  "success": true
}
```

**Tipo**: `SIMPLE`

```json
{
  "metodo": "SIMPLE",
  "datos": {
    "numeroFactura": "0001-00012345",
    "fecha": "2024-03-15T00:00:00.000Z",
    "cuit": "20-12345678-9",
    "razonSocial": "EMPRESA EJEMPLO SA",
    "total": 12500.00,
    "tipoComprobante": "FACTURA A"
  },
  "promptUtilizado": "EXTRACCION_UNIVERSAL",
  "success": true
}
```

### Guardado en Base de Datos

**Tabla**: `documentos_procesados`

```sql
INSERT INTO documentos_procesados (
  id,
  tenantId,
  usuarioId,
  nombreArchivo,
  tipoArchivo,
  rutaArchivo,
  estadoProcesamiento,
  datosExtraidos,
  fechaExtraida,
  importeExtraido,
  cuitExtraido,
  numeroComprobanteExtraido,
  razonSocialExtraida,
  tipoComprobanteExtraido,
  caeExtraido,
  netoGravadoExtraido,
  impuestosExtraido,
  modeloIA
) VALUES (
  'doc-123',
  'tenant-123',
  'user-456',
  'factura-001.pdf',
  'pdf',
  '/uploads/documentos/factura-001.pdf',
  'completado',
  '{ "numeroFactura": "...", ... }',  -- JSON completo
  '2024-03-15',
  12500.00,
  '20-12345678-9',
  '0001-00012345',
  'EMPRESA EJEMPLO SA',
  'FACTURA A',
  '74123456789012',
  10330.58,
  2169.42,
  'gemini-1.5-flash-latest'
);
```

### Tablas Relacionadas

**Items del Documento**: `documento_lineas`

```sql
INSERT INTO documento_lineas (
  documentoId,
  tenantId,
  numero,
  descripcion,
  cantidad,
  precioUnitario,
  subtotal,
  alicuotaIva,
  importeIva,
  totalLinea
) VALUES (
  'doc-123',
  'tenant-123',
  1,
  'Servicio de consultoría',
  10.000,
  1033.06,
  10330.58,
  21.00,
  2169.42,
  12500.00
);
```

**Impuestos del Documento**: `documento_impuestos`

```sql
INSERT INTO documento_impuestos (
  documentoId,
  tenantId,
  tipo,
  descripcion,
  alicuota,
  baseImponible,
  importe
) VALUES (
  'doc-123',
  'tenant-123',
  'IVA',
  'IVA 21%',
  21.00,
  10330.58,
  2169.42
);
```

---

## Ejemplo de Logs Completos

### Extracción con Pipeline (Plan Mythic)

```bash
# Usuario sube documento
POST /api/documentos/procesar
Content-Type: multipart/form-data
{
  documento: factura-ejemplo.pdf,
  tipo: "tarjeta"
}

# ===== INICIO DEL PROCESO =====

📝 Procesando documento: {
  tipo: 'tarjeta',
  userId: 'user-456',
  fileName: 'factura-ejemplo.pdf'
}

# ===== ORQUESTADOR =====

🎯 ===== INICIANDO EXTRACCIÓN DE DOCUMENTO =====
👤 Tenant: empresa-abc-123
📄 Longitud de texto: 2450 caracteres

# Verificar plan
🔍 Tenant empresa-abc-123 (Mythic) - AI_PIPELINE_EXTRACTION: ✅

🔍 Tipo de extracción: PIPELINE (2 pasos)

# ===== PASO 1: CLASIFICACIÓN =====

📊 ===== EXTRACCIÓN CON PIPELINE =====
🔍 PASO 1: Clasificando documento...

# Buscar prompt clasificador
🔍 Buscando prompt: CLASIFICADOR_DOCUMENTO
✅ Prompt encontrado (global)

# Configuración de IA
🔑 Usando API key global (.env) para gemini
🤖 Usando motor: gemini
🔸 Modelo: gemini-1.5-flash-latest

# Llamada a IA
📤 Llamando a Gemini...
📤 Respuesta de Gemini recibida (245 caracteres)
✅ JSON parseado correctamente

# Resultado de clasificación
📋 Tipo detectado: FACTURA_A (confianza: 95.0%)

# ===== PASO 2: EXTRACCIÓN ESPECIALIZADA =====

🔍 PASO 2: Extrayendo con prompt especializado...
📝 Prompt seleccionado: EXTRACCION_FACTURA_A

# Buscar prompt especializado
🔍 Buscando prompt: EXTRACCION_FACTURA_A
✅ Prompt encontrado (global)

# Configuración de IA
🔑 Usando API key global (.env) para gemini
🤖 Usando motor: gemini
🔸 Modelo: gemini-1.5-flash-latest

# Llamada a IA
📤 Llamando a Gemini...
📤 Respuesta de Gemini recibida (890 caracteres)
✅ JSON parseado correctamente

# Resultado de extracción
✅ Extracción completada
📊 Campos extraídos: 12

# ===== FIN DEL PROCESO =====

✅ ===== EXTRACCIÓN COMPLETADA =====

# Guardar en BD
✅ Documento guardado: doc-123
✅ 1 líneas guardadas
✅ 1 impuestos guardados

Response 200 OK:
{
  "success": true,
  "documento": {
    "id": "doc-123",
    "estadoProcesamiento": "completado",
    "datosExtraidos": { ... },
    "metodo": "PIPELINE",
    "promptUtilizado": "EXTRACCION_FACTURA_A"
  }
}
```

### Extracción Simple (Plan Common)

```bash
# Usuario sube documento
POST /api/documentos/procesar

# ===== INICIO DEL PROCESO =====

🎯 ===== INICIANDO EXTRACCIÓN DE DOCUMENTO =====
👤 Tenant: empresa-xyz-456
📄 Longitud de texto: 1850 caracteres

# Verificar plan
🔍 Tenant empresa-xyz-456 (Common) - AI_PIPELINE_EXTRACTION: ❌

🔍 Tipo de extracción: SIMPLE (1 paso)

# ===== EXTRACCIÓN SIMPLE =====

📄 ===== EXTRACCIÓN SIMPLE =====

# Buscar prompt universal
🔍 Buscando prompt: EXTRACCION_UNIVERSAL
✅ Prompt encontrado (global)

# Configuración de IA
🔑 Usando API key global (.env) para gemini
🤖 Usando motor: gemini

# Llamada a IA
📤 Llamando a Gemini...
📤 Respuesta de Gemini recibida (650 caracteres)
✅ JSON parseado correctamente

# Resultado
✅ Extracción completada
📊 Campos extraídos: 8

✅ ===== EXTRACCIÓN COMPLETADA =====

Response 200 OK:
{
  "success": true,
  "documento": {
    "id": "doc-456",
    "estadoProcesamiento": "completado",
    "datosExtraidos": { ... },
    "metodo": "SIMPLE",
    "promptUtilizado": "EXTRACCION_UNIVERSAL"
  }
}
```

---

## Referencias de Código

### Archivos Principales

| Archivo | Descripción | Líneas Clave |
|---------|-------------|--------------|
| `backend/src/services/documentExtractionOrchestrator.js` | Orquestador principal de extracción | 26, 63, 106, 137, 292, 313 |
| `backend/src/services/classifierService.js` | Clasificador de documentos | 23, 67, 100, 137, 171, 206 |
| `backend/src/services/aiConfigService.js` | Gestión de API keys y configs | 33, 72, 224, 249, 276, 293 |
| `backend/src/services/featureService.js` | Verificación de features por plan | 20, 63, 101, 136, 211, 221 |
| `backend/src/routes/documentos.js` | Endpoint de procesamiento | 154 |
| `backend/prisma/schema.prisma` | Modelos de BD | 1010, 1053, 1072, 1091 |

### Seeds y Configuración

| Archivo | Descripción |
|---------|-------------|
| `backend/prisma/seeds/planes.js` | Configuración de planes y features |
| `backend/prisma/seeds/prompts-pipeline.js` | Prompts predefinidos (clasificador y extractores) |

### Interfaz de Usuario

| Ruta | Descripción |
|------|-------------|
| `/prompts-ia` | Gestión de prompts (ver y editar) |
| `/configuracion/planes` | Gestión de planes y features |

### Variables de Entorno

```env
# API Keys Globales
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Cifrado de API Keys Custom
ENCRYPTION_KEY=<64 caracteres hex>

# Habilitar extracción con IA
ENABLE_AI_EXTRACTION=true
```

---

## Resumen: ¿Cómo sabe qué prompt usar?

### Flujo de Decisión

```
1. Usuario sube documento
         ↓
2. Verificar plan del tenant
   featureService.canUsePipeline(tenantId)
         ↓
   ¿Tiene "AI_PIPELINE_EXTRACTION"?
         ↓
    ┌────┴────┐
    ✅         ❌
    SÍ         NO
    │          │
    ↓          ↓
3. PIPELINE   SIMPLE
    │          │
    ↓          └──────→ Usar "EXTRACCION_UNIVERSAL"
    │
    └──→ Clasificar con "CLASIFICADOR_DOCUMENTO"
              ↓
         Resultado: FACTURA_A
              ↓
         Mapear: FACTURA_A → "EXTRACCION_FACTURA_A"
              ↓
         Extraer con "EXTRACCION_FACTURA_A"
```

### Búsqueda de Prompts

```
Necesito prompt "EXTRACCION_FACTURA_A"
         ↓
1. ¿Existe custom del tenant?
   ai_prompts WHERE clave = 'X' AND tenantId = 'Y'
         ↓
   ✅ SÍ → USAR
   ❌ NO → Paso 2
         ↓
2. ¿Existe global?
   ai_prompts WHERE clave = 'X' AND tenantId IS NULL
         ↓
   ✅ SÍ → USAR
   ❌ NO → ERROR
```

### Selección de Motor de IA

```
Prompt indica motor = "gemini"
         ↓
1. ¿Tenant tiene API key custom?
   ai_provider_configs WHERE tenantId = 'X' AND provider = 'gemini'
         ↓
   ✅ SÍ → Descifrar y usar
   ❌ NO → Paso 2
         ↓
2. ¿Existe en .env?
   process.env.GEMINI_API_KEY
         ↓
   ✅ SÍ → USAR
   ❌ NO → ERROR
```

---

## Conclusión

El sistema de extracción de documentos es un **pipeline inteligente y configurable** que:

✅ Se adapta al plan del tenant (Simple vs Pipeline)
✅ Usa prompts especializados por tipo de documento
✅ Permite personalización por tenant (prompts y API keys)
✅ Soporta múltiples motores de IA (Gemini, Claude, OpenAI)
✅ Es escalable y fácil de extender con nuevos tipos de documentos

### Ventajas del Diseño

- **Flexibilidad**: Planes diferenciados según necesidades
- **Precisión**: Prompts especializados por tipo de documento
- **Personalización**: Tenants pueden customizar prompts y API keys
- **Multi-tenancy**: Configuración aislada por tenant
- **Seguridad**: API keys cifradas con AES-256-GCM
- **Extensibilidad**: Fácil agregar nuevos tipos de documentos

### Próximas Mejoras

- [ ] Integración con Google Document AI (mayor precisión)
- [ ] Soporte para Ollama (IA local, sin costos)
- [ ] Cache de clasificaciones (evitar re-clasificar)
- [ ] Métricas de precisión por prompt
- [ ] A/B testing de prompts

---

**Documentación generada**: 2024-03-15
**Versión**: 1.0
**Autor**: Sistema Rendiciones - IA Pipeline
