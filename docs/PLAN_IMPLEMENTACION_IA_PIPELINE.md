# Plan de Implementación: Sistema de IA con Pipeline Multi-tier

**Proyecto:** Rendiciones App
**Fecha:** 2025-01-18
**Versión:** 1.0
**Estado:** 📋 Planificación

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Objetivos](#objetivos)
3. [Arquitectura General](#arquitectura-general)
4. [Componentes a Implementar](#componentes-a-implementar)
5. [Plan de Trabajo Detallado](#plan-de-trabajo-detallado)
6. [Estructura de Base de Datos](#estructura-de-base-de-datos)
7. [APIs y Servicios](#apis-y-servicios)
8. [Testing y Validación](#testing-y-validación)
9. [Riesgos y Mitigación](#riesgos-y-mitigación)
10. [Cronograma](#cronograma)

---

## 📊 Resumen Ejecutivo

### Problema Actual
- ❌ Todos los tenants usan las mismas API keys (rate limits compartidos)
- ❌ Un solo prompt intenta parsear todos los tipos de documentos
- ❌ Baja precisión en extracción (~70-75%)
- ❌ No hay diferenciación por planes
- ❌ Configuración rígida (solo .env)

### Solución Propuesta
- ✅ Sistema de planes con features específicos
- ✅ Pipeline de 2 pasos (clasificador + extractor especializado)
- ✅ Configuración híbrida (global + por tenant)
- ✅ API keys personalizadas por tenant (feature premium)
- ✅ Precisión mejorada (~85-95%)

---

## 🎯 Objetivos

### Objetivos Principales
1. Implementar sistema de **Planes y Features** escalable
2. Crear **pipeline de extracción** de 2 pasos con IA especializada
3. Permitir **configuración por tenant** (BYO API keys)
4. Mejorar **precisión de extracción** en 15-20%
5. Habilitar **monetización** por capacidades de IA

### Métricas de Éxito
- 📈 Precisión de extracción: 85%+ (actual: 70-75%)
- ⚡ Tiempo de procesamiento: <10s por documento
- 💰 Reducción de costos: 30% (por uso de modelos apropiados)
- 🎯 Clasificación correcta: 95%+ de documentos
- 👥 Satisfacción del usuario: NPS >8

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        TENANTS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Common   │  │Uncommon  │  │  Rare    │  │  Mythic  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │              │          │
│       └─────────────┴──────────────┴──────────────┘          │
│                             │                                │
│                     ┌───────▼────────┐                      │
│                     │  PLAN ASIGNADO │                      │
│                     └───────┬────────┘                      │
└─────────────────────────────┼────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   PLAN_FEATURES    │
                    │  - AI_PIPELINE     │
                    │  - AI_SIMPLE       │
                    │  - CUSTOM_KEYS     │
                    └─────────┬──────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
    ┌───────▼────────┐              ┌──────────▼─────────┐
    │ FEATURE        │              │ AI_CONFIG          │
    │ SERVICE        │              │ SERVICE            │
    │                │              │                    │
    │ isEnabled()    │              │ getApiKey()        │
    │ getConfig()    │              │ getProviderConfig()│
    └───────┬────────┘              └──────────┬─────────┘
            │                                   │
            └─────────────┬─────────────────────┘
                          │
                ┌─────────▼──────────┐
                │   ORCHESTRATOR      │
                │                     │
                │ 1. Check Features   │
                │ 2. Get AI Config    │
                │ 3. Route to Pipeline│
                └─────────┬───────────┘
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
┌───────▼────────┐              ┌───────────▼────────┐
│ SIMPLE         │              │ PIPELINE           │
│ (1 Prompt)     │              │ (2 Pasos)          │
│                │              │                    │
│ Gemini Flash   │              │ 1. Clasificador    │
│ Claude Haiku   │              │ 2. Extractor       │
└────────────────┘              │    Especializado   │
                                └────────────────────┘
```

---

## 🧩 Componentes a Implementar

### 1. Base de Datos

#### Nuevas Tablas
- `planes` - Definición de planes (Common, Uncommon, Rare, Mythic)
- `plan_features` - Features por plan
- `ai_provider_configs` - Configuración de APIs de IA por tenant

#### Tablas Modificadas
- `tenants` - Agregar campo `planId`
- `ai_prompts` - Agregar campo `tipo` para clasificar prompts

### 2. Backend Services

#### Nuevos Servicios
- `FeatureService` - Gestión de features por plan
- `AIConfigService` - Gestión de configuraciones de IA (híbrido)
- `DocumentExtractionOrchestrator` - Orquestador principal
- `ClassifierService` - Servicio de clasificación de documentos
- `EncryptionService` - Cifrado/descifrado de API keys

#### Servicios Modificados
- `DocumentProcessor` - Integrar con nuevo orquestador
- `AIPromptService` - Soporte para tipos de prompts

### 3. Frontend

#### Nuevas Páginas
- `/admin/planes` - Gestión de planes y features (superuser)
- `/admin/ai-config` - Configuración de IA por tenant (superuser)
- `/settings/ai-keys` - Configuración de API keys propias (Mythic plan)

#### Componentes Modificados
- Panel de tenants - Mostrar features del plan
- Dashboard - Indicadores de uso de IA

---

## 📝 Plan de Trabajo Detallado

### FASE 1: Estructura de Base de Datos (2-3 horas)

#### Tarea 1.1: Crear tablas de Planes y Features
**Archivo:** `backend/prisma/schema.prisma`

```prisma
model planes {
  id          String   @id @default(cuid())
  codigo      String   @unique
  nombre      String
  descripcion String?  @db.Text
  precio      Decimal? @db.Decimal(10, 2)
  activo      Boolean  @default(true)
  orden       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  features    plan_features[]
  tenants     tenants[]

  @@index([codigo])
}

model plan_features {
  id        String   @id @default(cuid())
  planId    String
  feature   String
  config    Json?
  createdAt DateTime @default(now())

  plan      planes   @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, feature])
  @@index([planId])
  @@index([feature])
}
```

#### Tarea 1.2: Crear tabla de Configuraciones de IA
**Archivo:** `backend/prisma/schema.prisma`

```prisma
model ai_provider_configs {
  id                String   @id @default(cuid())
  tenantId          String?
  provider          String
  apiKeyEncrypted   String?  @db.Text
  modelo            String?
  maxRequestsPerDay Int?
  config            Json?
  activo            Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  tenant            tenants? @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, provider])
  @@index([tenantId])
  @@index([provider])
}
```

#### Tarea 1.3: Modificar tabla tenants
**Archivo:** `backend/prisma/schema.prisma`

```prisma
model tenants {
  // ... campos existentes ...

  planId              String?
  plan                planes?               @relation(fields: [planId], references: [id])
  ai_provider_configs ai_provider_configs[]
}
```

#### Tarea 1.4: Modificar tabla ai_prompts
**Archivo:** `backend/prisma/schema.prisma`

```prisma
model ai_prompts {
  // ... campos existentes ...

  tipo        String?  @default("EXTRACTOR_SIMPLE")
  // Tipos: "CLASIFICADOR", "EXTRACTOR_ESPECIALIZADO", "EXTRACTOR_SIMPLE"
}
```

**Entregable:** Schema de Prisma actualizado

---

### FASE 2: Migraciones y Seeds (1-2 horas)

#### Tarea 2.1: Aplicar migración
**Comando:**
```bash
cd backend
npx prisma db push
npx prisma generate
```

#### Tarea 2.2: Crear seed de planes
**Archivo:** `backend/prisma/seeds/planes.js`

```javascript
const planes = [
  {
    codigo: 'Common',
    nombre: 'Plan Common',
    descripcion: 'Plan básico para pequeñas empresas',
    precio: 0,
    orden: 1,
    features: [
      { feature: 'AI_SIMPLE_EXTRACTION', config: { modelo: 'gemini-flash', maxDocumentosPorMes: 100 } },
      { feature: 'MANUAL_CORRECTION', config: {} }
    ]
  },
  // ... resto de planes
];

async function seedPlanes() {
  for (const planData of planes) {
    const { features, ...planInfo } = planData;

    const plan = await prisma.planes.create({
      data: planInfo
    });

    for (const feature of features) {
      await prisma.plan_features.create({
        data: {
          planId: plan.id,
          ...feature
        }
      });
    }
  }
}
```

#### Tarea 2.3: Migrar tenants existentes a planes
**Archivo:** `backend/prisma/seeds/migrate-tenants-to-plans.js`

```javascript
async function migrateTenants() {
  const planMap = {
    'Common': await prisma.planes.findUnique({ where: { codigo: 'Common' } }),
    'Uncommon': await prisma.planes.findUnique({ where: { codigo: 'Uncommon' } }),
    'Rare': await prisma.planes.findUnique({ where: { codigo: 'Rare' } }),
    'Mythic': await prisma.planes.findUnique({ where: { codigo: 'Mythic' } })
  };

  const tenants = await prisma.tenants.findMany();

  for (const tenant of tenants) {
    const plan = planMap[tenant.plan]; // tenant.plan es string actualmente

    if (plan) {
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: { planId: plan.id }
      });
    }
  }
}
```

#### Tarea 2.4: Seed de prompts especializados
**Archivo:** `backend/prisma/seeds/prompts.js`

```javascript
const prompts = [
  {
    clave: 'CLASIFICADOR_DOCUMENTO',
    tipo: 'CLASIFICADOR',
    motor: 'gemini',
    prompt: `Analiza este documento y clasifícalo...`,
    activo: true
  },
  {
    clave: 'EXTRACCION_FACTURA_A',
    tipo: 'EXTRACTOR_ESPECIALIZADO',
    motor: 'anthropic',
    prompt: `Eres un experto en facturas argentinas tipo A...`,
    activo: true
  },
  // ... más prompts especializados
];
```

**Entregable:** Base de datos migrada con planes y seeds

---

### FASE 3: Backend Services (4-5 horas)

#### Tarea 3.1: Crear FeatureService
**Archivo:** `backend/src/services/featureService.js`

**Funciones principales:**
- `isEnabled(tenantId, featureName)` - Verifica si tenant tiene feature
- `getTenantFeatures(tenantId)` - Obtiene todos los features del tenant
- `getFeatureConfig(tenantId, featureName)` - Obtiene configuración específica

**Tests:**
```javascript
// Tests unitarios
describe('FeatureService', () => {
  test('tenant Common tiene AI_SIMPLE_EXTRACTION', async () => {
    const hasFeature = await featureService.isEnabled(tenantId, 'AI_SIMPLE_EXTRACTION');
    expect(hasFeature).toBe(true);
  });

  test('tenant Common NO tiene AI_PIPELINE_EXTRACTION', async () => {
    const hasFeature = await featureService.isEnabled(tenantId, 'AI_PIPELINE_EXTRACTION');
    expect(hasFeature).toBe(false);
  });
});
```

#### Tarea 3.2: Crear AIConfigService
**Archivo:** `backend/src/services/aiConfigService.js`

**Funciones principales:**
- `getApiKey(provider, tenantId)` - Obtiene API key (cascada: custom → global)
- `getProviderConfig(provider, tenantId)` - Config completa del proveedor
- `setCustomApiKey(tenantId, provider, apiKey)` - Configura key custom (solo Mythic)
- `encrypt(text)` - Cifrado AES-256-GCM
- `decrypt(encryptedText)` - Descifrado

**Variables de entorno necesarias:**
```env
# Generar con: openssl rand -hex 32
ENCRYPTION_KEY=a1b2c3d4e5f6...64chars
```

**Tests:**
```javascript
describe('AIConfigService', () => {
  test('cifrado y descifrado funciona correctamente', () => {
    const original = 'sk-ant-api-test-key';
    const encrypted = aiConfigService.encrypt(original);
    const decrypted = aiConfigService.decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  test('tenant sin custom key usa global .env', async () => {
    const apiKey = await aiConfigService.getApiKey('gemini', tenantId);
    expect(apiKey).toBe(process.env.GEMINI_API_KEY);
  });
});
```

#### Tarea 3.3: Crear ClassifierService
**Archivo:** `backend/src/services/classifierService.js`

**Función principal:**
- `classify(documentText, tenantId)` - Clasifica el documento

**Retorno:**
```javascript
{
  tipoDocumento: 'FACTURA_A', // | 'DESPACHO_ADUANA' | 'COMPROBANTE_IMPORTACION'
  confianza: 0.95,
  subtipos: ['SERVICIOS'], // Opcional
  modelo: 'gemini-flash'
}
```

#### Tarea 3.4: Crear DocumentExtractionOrchestrator
**Archivo:** `backend/src/services/documentExtractionOrchestrator.js`

**Flujo completo:**
```javascript
async extractData(documentText, tenantId, userId) {
  // 1. Check features
  const hasPipeline = await featureService.isEnabled(tenantId, 'AI_PIPELINE_EXTRACTION');

  // 2. Route según plan
  if (hasPipeline) {
    return await this.extractWithPipeline(documentText, tenantId);
  } else {
    return await this.extractWithSimplePrompt(documentText, tenantId);
  }
}

async extractWithPipeline(documentText, tenantId) {
  // Paso 1: Clasificar
  const clasificacion = await classifierService.classify(documentText, tenantId);

  // Paso 2: Extraer con prompt especializado
  const promptKey = this.getPromptKeyForType(clasificacion.tipoDocumento);
  const datos = await this.extract(documentText, promptKey, tenantId);

  return {
    metodo: 'PIPELINE',
    clasificacion,
    datos,
    promptUtilizado: promptKey
  };
}
```

**Entregable:** Services funcionando con tests unitarios

---

### FASE 4: Integración en Endpoints (2-3 horas)

#### Tarea 4.1: Modificar endpoint de procesamiento
**Archivo:** `backend/src/routes/documentos.js`

**Antes:**
```javascript
const datos = await documentProcessor.extractData(texto);
```

**Después:**
```javascript
const resultado = await orchestrator.extractData(texto, tenantId, userId);

console.log(`✅ Método: ${resultado.metodo}`);
console.log(`📝 Prompt: ${resultado.promptUtilizado}`);

// Guardar datos extraídos
await prisma.documentos_procesados.update({
  where: { id: documentoId },
  data: {
    ...resultado.datos,
    modeloIA: resultado.promptUtilizado,
    estadoProcesamiento: 'completado'
  }
});
```

#### Tarea 4.2: Crear endpoint de configuración de IA
**Archivo:** `backend/src/routes/ai-config.js`

```javascript
// GET /api/ai-config/:tenantId
router.get('/:tenantId', async (req, res) => {
  const configs = await aiConfigService.getTenantConfigs(req.params.tenantId);
  res.json(configs);
});

// POST /api/ai-config/:tenantId/custom-key
router.post('/:tenantId/custom-key', async (req, res) => {
  const { provider, apiKey } = req.body;
  await aiConfigService.setCustomApiKey(req.params.tenantId, provider, apiKey);
  res.json({ success: true });
});
```

**Entregable:** Endpoints integrados y funcionando

---

### FASE 5: Frontend - Administración (3-4 horas)

#### Tarea 5.1: Página de gestión de planes
**Archivo:** `packages/web/src/app/(protected)/admin/planes/page.tsx`

**Componentes:**
- Tabla de planes con features
- Modal para editar features de un plan
- Visualización de config JSON por feature

#### Tarea 5.2: Panel de configuración de IA (Mythic only)
**Archivo:** `packages/web/src/app/(protected)/settings/ai-keys/page.tsx`

**Funcionalidad:**
- Solo visible para tenants con plan Mythic
- Formulario para ingresar API keys propias
- Cifrado automático antes de enviar al backend
- Test de conexión con la API

#### Tarea 5.3: Dashboard de uso de IA
**Archivo:** `packages/web/src/app/(protected)/dashboard/page.tsx`

**Métricas a mostrar:**
- Documentos procesados este mes
- Método usado (Simple vs Pipeline)
- Precisión promedio
- Límites del plan vs uso actual

**Entregable:** UI completa y funcional

---

### FASE 6: Testing Completo (2-3 horas)

#### Tarea 6.1: Tests Unitarios

**FeatureService:**
```javascript
describe('Feature Service', () => {
  test('Common plan tiene features correctos');
  test('Mythic plan tiene todos los features');
  test('Feature inexistente retorna false');
});
```

**AIConfigService:**
```javascript
describe('AI Config Service', () => {
  test('Cifrado/descifrado es reversible');
  test('Tenant sin custom key usa global');
  test('Tenant Mythic puede setear custom key');
  test('Tenant Common no puede setear custom key');
});
```

**Orchestrator:**
```javascript
describe('Document Extraction Orchestrator', () => {
  test('Common plan usa simple extraction');
  test('Rare plan usa pipeline extraction');
  test('Clasificación retorna tipo correcto');
  test('Extractor especializado es llamado');
});
```

#### Tarea 6.2: Tests de Integración

```javascript
describe('Full Integration Flow', () => {
  test('Procesar factura con tenant Common', async () => {
    // Upload documento
    // Verificar que usa simple extraction
    // Verificar datos extraídos
  });

  test('Procesar factura con tenant Rare', async () => {
    // Upload documento
    // Verificar que usa pipeline (2 llamadas)
    // Verificar clasificación
    // Verificar datos extraídos más precisos
  });
});
```

#### Tarea 6.3: Tests Manuales

**Checklist:**
- [ ] Crear tenant con plan Common
- [ ] Subir factura A → Verificar simple extraction
- [ ] Verificar precisión de datos
- [ ] Cambiar plan a Rare
- [ ] Subir misma factura → Verificar pipeline
- [ ] Comparar precisión (debe mejorar)
- [ ] Configurar API key custom (Mythic)
- [ ] Verificar uso de key custom
- [ ] Verificar límites de plan

**Entregable:** Suite de tests completa y pasando

---

### FASE 7: Documentación y Deployment (1-2 horas)

#### Tarea 7.1: Actualizar README
**Archivo:** `README.md`

Secciones a agregar:
- Sistema de planes y features
- Configuración de API keys
- Cómo agregar nuevos extractores
- Troubleshooting común

#### Tarea 7.2: Variables de entorno
**Archivo:** `.env.example`

```env
# ============================================
# API KEYS GLOBALES
# ============================================
GEMINI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here

# ============================================
# ENCRYPTION
# ============================================
ENCRYPTION_KEY=generate-with-openssl-rand-hex-32
```

#### Tarea 7.3: Deployment checklist
- [ ] Generar ENCRYPTION_KEY en producción
- [ ] Migrar base de datos de producción
- [ ] Ejecutar seeds de planes
- [ ] Migrar tenants existentes
- [ ] Verificar API keys en .env
- [ ] Restart backend service
- [ ] Smoke tests en producción

**Entregable:** Sistema documentado y deployado

---

## 🗄️ Estructura de Base de Datos Final

```sql
-- PLANES Y FEATURES
planes (id, codigo, nombre, descripcion, precio, activo, orden)
plan_features (id, planId, feature, config)

-- CONFIGURACIÓN DE IA
ai_provider_configs (id, tenantId, provider, apiKeyEncrypted, modelo, config)

-- PROMPTS
ai_prompts (id, clave, tipo, motor, prompt, tenantId, activo)
  tipo: "CLASIFICADOR" | "EXTRACTOR_ESPECIALIZADO" | "EXTRACTOR_SIMPLE"

-- TENANTS (modificado)
tenants (... campos existentes, planId)
```

---

## 🔌 APIs y Servicios

### Servicios Backend

| Servicio | Responsabilidad | Dependencias |
|----------|----------------|--------------|
| `FeatureService` | Gestión de features por plan | Prisma |
| `AIConfigService` | Config híbrida de APIs | Prisma, Crypto |
| `ClassifierService` | Clasificación de documentos | AIConfigService, AIPromptService |
| `DocumentExtractionOrchestrator` | Orquestador principal | FeatureService, AIConfigService, ClassifierService |

### Endpoints API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/planes` | GET | Listar todos los planes |
| `/api/planes/:id/features` | GET | Features de un plan |
| `/api/tenants/:id/features` | GET | Features del tenant |
| `/api/ai-config/:tenantId` | GET | Configuración de IA |
| `/api/ai-config/:tenantId/custom-key` | POST | Setear API key custom |
| `/api/documentos/procesar` | POST | Procesar documento (usa orchestrator) |

---

## ✅ Testing y Validación

### Criterios de Aceptación

#### Feature Service
- ✅ Tenant Common tiene solo features básicos
- ✅ Tenant Mythic tiene todos los features
- ✅ Consulta de feature inexistente retorna false
- ✅ Config de feature se retorna correctamente

#### AI Config Service
- ✅ Cifrado es reversible
- ✅ Cascada funciona (custom → global → error)
- ✅ Solo Mythic puede setear custom keys
- ✅ Keys se almacenan cifradas en BD

#### Orchestrator
- ✅ Common usa simple extraction
- ✅ Rare+ usa pipeline extraction
- ✅ Clasificador detecta tipo correcto (>90%)
- ✅ Extractor especializado mejora precisión (+15%)
- ✅ Logs muestran método usado

#### Integración E2E
- ✅ Flujo completo Common: upload → simple → datos guardados
- ✅ Flujo completo Rare: upload → pipeline → datos más precisos
- ✅ Custom API key es usada correctamente
- ✅ Límites de plan son respetados

---

## ⚠️ Riesgos y Mitigación

### Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Cifrado comprometido** | Baja | Crítico | Usar AES-256-GCM, key rotation policy |
| **Clasificador falla** | Media | Alto | Fallback a simple extraction |
| **API rate limits** | Alta | Medio | Implementar queue y retry logic |
| **Migración de datos falla** | Baja | Alto | Backup completo antes de migrar |
| **Performance degradado** | Media | Medio | Caching de configs, async processing |

### Riesgos de Negocio

| Riesgo | Mitigación |
|--------|------------|
| **Costos de IA exceden presupuesto** | Límites por plan, monitoring de uso |
| **Clientes no pagan por features premium** | Freemium con límites claros, trial de Rare |
| **Complejidad confunde usuarios** | UI intuitiva, tooltips, documentación |

---

## 📅 Cronograma

### Semana 1: Backend Core
- **Día 1-2:** FASE 1 + 2 (Base de datos, migraciones, seeds)
- **Día 3-4:** FASE 3 (Services: Feature, AIConfig, Classifier)
- **Día 5:** FASE 3 continuación (Orchestrator)

### Semana 2: Integración y Frontend
- **Día 1-2:** FASE 4 (Integración en endpoints)
- **Día 3-4:** FASE 5 (Frontend: admin de planes, config IA)
- **Día 5:** FASE 6 (Testing completo)

### Semana 3: Testing y Deployment
- **Día 1-2:** Testing E2E y fixes
- **Día 3:** FASE 7 (Documentación)
- **Día 4:** Deployment a staging
- **Día 5:** Deployment a producción + monitoring

**Total: ~15-20 días de desarrollo**

---

## 📚 Referencias

### Documentación Técnica
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [Anthropic API Docs](https://docs.anthropic.com/claude/reference)
- [Google Gemini API](https://ai.google.dev/docs)

### Mejores Prácticas
- [12-Factor App](https://12factor.net/)
- [OWASP Encryption Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [SaaS Feature Flags](https://martinfowler.com/articles/feature-toggles.html)

---

## 📝 Notas Finales

### Decisiones Arquitectónicas

1. **Por qué sistema híbrido de config?**
   - Balance entre seguridad (.env) y flexibilidad (BD)
   - Permite BYO API keys para clientes enterprise
   - Facilita testing (mock de configs)

2. **Por qué pipeline de 2 pasos?**
   - Mayor precisión por especialización
   - Costos optimizados (clasificador barato)
   - Escalabilidad (agregar nuevos tipos es trivial)

3. **Por qué cifrado en BD?**
   - Compliance (PCI-DSS, SOC2)
   - Permite auditoría de uso
   - Key rotation sin cambiar código

### Trabajo Futuro (Post-MVP)

- [ ] Fine-tuning de modelos con docs argentinos
- [ ] Cache de clasificaciones frecuentes
- [ ] Batch processing optimizado
- [ ] Webhooks para integración con ERPs
- [ ] Analytics dashboard de precisión por tipo
- [ ] A/B testing de prompts
- [ ] Multi-region deployment

---

**Última actualización:** 2025-01-18
**Autor:** Claude AI + Development Team
**Estado:** ✅ Listo para implementación
