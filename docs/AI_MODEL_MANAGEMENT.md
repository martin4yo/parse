# Sistema de Gestión de Modelos de IA

## Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Backend](#backend)
4. [Frontend](#frontend)
5. [Guía de Uso](#guía-de-uso)
6. [Mantenimiento](#mantenimiento)
7. [Troubleshooting](#troubleshooting)

---

## Descripción General

El sistema de gestión de modelos de IA permite configurar y cambiar los modelos de inteligencia artificial desde la interfaz web, sin necesidad de modificar código o reiniciar servicios.

### Problema que Resuelve

**Antes:**
- Los modelos estaban hardcodeados en el código
- Cuando un proveedor discontinuaba un modelo (ej: Claude 3.5 → Claude 3.7), había que:
  - Modificar archivos de código
  - Realizar deploy
  - Reiniciar servicios
- Los errores solo se detectaban cuando la aplicación fallaba

**Ahora:**
- Cambio de modelos en tiempo real desde la UI
- Catálogo centralizado con estado de cada modelo (recomendado, activo, obsoleto)
- Sin necesidad de deploy para cambios de modelo
- Visibilidad clara del estado de cada modelo

### Proveedores Soportados

1. **Anthropic (Claude)**
   - Claude 3.7 Sonnet (Recomendado)
   - Claude 3.5 Sonnet (Oct 2024)
   - Claude 3.5 Sonnet (Jun 2024 - Deprecado)
   - Claude 3 Opus
   - Claude 3 Haiku

2. **Google (Gemini)**
   - Gemini 1.5 Flash Latest (Recomendado)
   - Gemini 1.5 Pro Latest
   - Gemini 1.5 Flash
   - Gemini 1.5 Pro

3. **OpenAI**
   - GPT-4o (Recomendado)
   - GPT-4o Mini
   - GPT-4 Turbo
   - GPT-4

---

## Arquitectura

### Flujo de Configuración

```
┌─────────────────┐
│   Frontend UI   │
│  (ia-config)    │
└────────┬────────┘
         │
         │ 1. getAvailableModels()
         │ 2. updateModel()
         ▼
┌─────────────────┐
│   API Routes    │
│  (ai-configs)   │
└────────┬────────┘
         │
         │ 3. Lógica de negocio
         ▼
┌─────────────────┐
│ aiConfigService │
│   (Servicio)    │
└────────┬────────┘
         │
         │ 4. Persistencia
         ▼
┌─────────────────┐
│ Prisma/Database │
│ (ai_provider_   │
│    configs)     │
└─────────────────┘
```

### Cascada de Resolución de API Keys

```
Tenant Custom → Global (.env) → Error
```

1. **Tenant Custom**: Si el tenant tiene configurada su propia API key (feature premium)
2. **Global**: Fallback a las keys configuradas en `.env`
3. **Error**: Si no hay ninguna configuración disponible

---

## Backend

### 1. Servicio: `aiConfigService.js`

**Ubicación:** `backend/src/services/aiConfigService.js`

#### Métodos Principales

##### `getApiKey(provider, tenantId)`
Obtiene la API key para un proveedor siguiendo la cascada de resolución.

```javascript
const apiKey = await aiConfigService.getApiKey('anthropic', tenantId);
```

##### `getProviderConfig(provider, tenantId)`
Obtiene configuración completa (API key, modelo, límites).

```javascript
const config = await aiConfigService.getProviderConfig('anthropic', tenantId);
// Returns: { apiKey, modelo, maxRequestsPerDay, config }
```

##### `getAvailableModels()`
**⭐ NUEVO** - Retorna catálogo completo de modelos disponibles.

```javascript
const models = aiConfigService.getAvailableModels();
// Returns:
{
  'anthropic': [
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet',
      description: 'Más reciente, balanceado en velocidad y calidad',
      recommended: true,
      active: true
    },
    // ... más modelos
  ],
  'gemini': [...],
  'openai': [...]
}
```

##### `updateModel(tenantId, provider, modelo)`
**⭐ NUEVO** - Actualiza solo el modelo sin tocar la API key.

```javascript
const result = await aiConfigService.updateModel(
  tenantId,
  'anthropic',
  'claude-3-7-sonnet-20250219'
);
// Returns: { success: true, provider, modelo, modelName }
```

##### `setCustomApiKey(tenantId, provider, apiKey, config)`
Configura una API key personalizada para un tenant (feature premium).

```javascript
await aiConfigService.setCustomApiKey(tenantId, 'anthropic', apiKey, {
  modelo: 'claude-3-7-sonnet-20250219',
  maxRequestsPerDay: 1000,
  additionalConfig: {}
});
```

##### `getTenantConfigs(tenantId)`
Obtiene todas las configuraciones de un tenant.

```javascript
const configs = await aiConfigService.getTenantConfigs(tenantId);
```

#### Métodos de Cifrado

##### `encrypt(text)`
Cifra texto usando AES-256-GCM.

```javascript
const encrypted = aiConfigService.encrypt('sk-ant-api-key-123');
// Returns: "iv:authTag:encrypted"
```

##### `decrypt(encryptedText)`
Descifra texto cifrado.

```javascript
const decrypted = aiConfigService.decrypt(encryptedText);
```

#### Métodos Auxiliares

##### `getEnvKeyForProvider(provider)`
Mapea provider a variable de entorno.

##### `getDefaultModel(provider)`
Retorna el modelo por defecto (recomendado) para un provider.

---

### 2. Rutas: `ai-configs.js`

**Ubicación:** `backend/src/routes/ai-configs.js`

#### Endpoints

##### `GET /api/ai-configs`
Obtiene todas las configuraciones del tenant autenticado.

**Response:**
```json
[
  {
    "id": "uuid",
    "provider": "anthropic",
    "modelo": "claude-3-7-sonnet-20250219",
    "maxRequestsPerDay": 1000,
    "activo": true,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-15T00:00:00Z"
  }
]
```

##### `GET /api/ai-configs/providers`
Lista proveedores disponibles con sus modelos.

**Response:**
```json
[
  {
    "id": "anthropic",
    "nombre": "Anthropic Claude",
    "descripcion": "Claude 3.7 y 3.5 - Con capacidades de visión",
    "modelosDisponibles": [
      {
        "id": "claude-3-7-sonnet-20250219",
        "name": "Claude 3.7 Sonnet",
        "description": "Más reciente, balanceado",
        "recommended": true,
        "active": true
      }
    ],
    "requiresApiKey": true
  }
]
```

##### `GET /api/ai-configs/available-models` ⭐ NUEVO
Obtiene catálogo completo de modelos con metadata.

**Response:**
```json
{
  "anthropic": [
    {
      "id": "claude-3-7-sonnet-20250219",
      "name": "Claude 3.7 Sonnet",
      "description": "Más reciente, balanceado en velocidad y calidad",
      "recommended": true,
      "active": true,
      "deprecated": false
    }
  ],
  "gemini": [...],
  "openai": [...]
}
```

##### `PATCH /api/ai-configs/update-model` ⭐ NUEVO
Actualiza solo el modelo de un provider.

**Request:**
```json
{
  "provider": "anthropic",
  "modelo": "claude-3-7-sonnet-20250219"
}
```

**Response:**
```json
{
  "success": true,
  "provider": "anthropic",
  "modelo": "claude-3-7-sonnet-20250219",
  "modelName": "Claude 3.7 Sonnet"
}
```

##### `POST /api/ai-configs`
Crear o actualizar configuración completa.

**Request:**
```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-api-key-123",
  "modelo": "claude-3-7-sonnet-20250219",
  "maxRequestsPerDay": 1000,
  "activo": true
}
```

##### `PUT /api/ai-configs/:id`
Actualizar configuración existente.

##### `DELETE /api/ai-configs/:id`
Eliminar configuración.

##### `POST /api/ai-configs/test`
Probar conexión con un proveedor.

---

## Frontend

### 1. API Client: `lib/api.ts`

**Ubicación:** `frontend/src/lib/api.ts`

#### Interfaces TypeScript

```typescript
export interface AIModel {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  active: boolean;
  deprecated?: boolean;
}

export interface AIAvailableModels {
  anthropic: AIModel[];
  gemini: AIModel[];
  openai: AIModel[];
}

export interface AIProviderConfig {
  id: string;
  provider: string;
  modelo: string;
  maxRequestsPerDay: number;
  config?: any;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIProvider {
  id: string;
  nombre: string;
  descripcion: string;
  modelosDisponibles: Array<{
    value: string;
    label: string;
  }>;
  requiresApiKey: boolean;
}
```

#### API Functions

```typescript
export const aiConfigsApi = {
  // Obtener todas las configuraciones
  getAll: async (): Promise<AIProviderConfig[]>

  // Obtener configuración por ID
  getById: async (id: string): Promise<AIProviderConfig>

  // Obtener proveedores disponibles
  getProviders: async (): Promise<AIProvider[]>

  // ⭐ NUEVO: Obtener catálogo de modelos
  getAvailableModels: async (): Promise<AIAvailableModels>

  // ⭐ NUEVO: Actualizar solo modelo
  updateModel: async (
    provider: string,
    modelo: string
  ): Promise<{
    success: boolean;
    provider: string;
    modelo: string;
    modelName: string;
  }>

  // Crear configuración
  create: async (data: {...}): Promise<AIProviderConfig>

  // Actualizar configuración
  update: async (id: string, data: {...}): Promise<AIProviderConfig>

  // Eliminar configuración
  delete: async (id: string): Promise<void>

  // Probar conexión
  test: async (provider: string, apiKey: string): Promise<{
    success: boolean;
    message: string;
  }>
}
```

---

### 2. Página: `ia-config/page.tsx`

**Ubicación:** `frontend/src/app/(protected)/ia-config/page.tsx`

#### Componentes de la UI

##### Provider Card

Cada proveedor configurado se muestra en una tarjeta que incluye:

1. **Header**
   - Nombre del proveedor
   - Nombre del modelo actual
   - Badge de estado (Recomendado/Obsoleto)
   - Estado activo/inactivo

2. **Quick Model Selector** ⭐ NUEVO
   - Dropdown para cambiar modelo instantáneamente
   - Indicadores visuales: ⭐ recomendado, ⚠️ obsoleto
   - Descripción del modelo seleccionado
   - Spinner de carga durante actualización

3. **Información**
   - Límite diario de requests

4. **Acciones**
   - Botón "Editar" (abre modal completo)
   - Botón "Eliminar"

##### Modal de Configuración

Modal para crear/editar configuración completa:

1. **Proveedor**: Select (solo en creación)
2. **Modelo**: Select mejorado con:
   - Íconos de estado (⭐ recomendado, ⚠️ obsoleto)
   - Descripción del modelo seleccionado
3. **API Key**: Input con toggle show/hide
4. **Límite de Requests**: Número
5. **Activo**: Checkbox

#### Funciones Principales

```typescript
// Cargar datos iniciales
const loadData = async () => {
  const [configsData, providersData, modelsData] = await Promise.all([
    aiConfigsApi.getAll(),
    aiConfigsApi.getProviders(),
    aiConfigsApi.getAvailableModels()  // ⭐ NUEVO
  ]);
}

// ⭐ NUEVO: Cambio rápido de modelo
const handleQuickModelChange = async (
  config: AIProviderConfig,
  newModelId: string
) => {
  await aiConfigsApi.updateModel(config.provider, newModelId);
  toast.success('Modelo actualizado correctamente');
  loadData();
}

// Obtener info del modelo actual
const getCurrentModelInfo = (
  providerId: string,
  modelId: string
): AIModel | null => {
  const models = getProviderAvailableModels(providerId);
  return models.find(m => m.id === modelId) || null;
}
```

---

## Guía de Uso

### Para Usuarios Finales

#### 1. Ver Configuraciones Actuales

1. Navegar a **Configuración de IA** en el menú
2. Ver tarjetas de proveedores configurados
3. Cada tarjeta muestra:
   - Proveedor (ej: Anthropic Claude)
   - Modelo actual (ej: Claude 3.7 Sonnet)
   - Estado del modelo (Recomendado/Obsoleto)
   - Límite diario de requests

#### 2. Cambiar Modelo Rápidamente ⭐ NUEVO

**Caso de uso:** Claude discontinuó Sonnet 3.5 y necesitas cambiar a 3.7

1. Localizar la tarjeta del proveedor
2. En la sección "Cambiar modelo":
   - Abrir el dropdown
   - Seleccionar el nuevo modelo
   - ⭐ = Recomendado
   - ⚠️ = Obsoleto (evitar)
3. El cambio se aplica **inmediatamente**
4. Ver descripción del modelo seleccionado

**Tiempo total: 5 segundos** ✅
**Antes: 30+ minutos** (modificar código, deploy, reinicio)

#### 3. Agregar Nuevo Proveedor

1. Click en "Agregar Proveedor"
2. Seleccionar proveedor (Anthropic, Gemini, OpenAI)
3. Seleccionar modelo (los recomendados tienen ⭐)
4. Ingresar API Key del proveedor
5. Configurar límite diario (default: 1000)
6. Marcar como activo
7. Guardar

#### 4. Editar Configuración Completa

1. Click en "Editar" en la tarjeta del proveedor
2. Modificar:
   - Modelo
   - API Key (opcional, dejar en blanco para no cambiar)
   - Límite diario
   - Estado activo/inactivo
3. Guardar

#### 5. Eliminar Proveedor

1. Click en botón de eliminar (ícono de basura)
2. Confirmar eliminación
3. El sistema volverá a usar las keys globales del .env

---

### Para Administradores

#### Monitoreo de Modelos Obsoletos

**Indicador visual:** Badge amarillo "Obsoleto" + ⚠️

**Acción recomendada:** Cambiar a modelo recomendado (con ⭐)

#### Best Practices

1. **Siempre usar modelos recomendados** cuando sea posible
2. **Evitar modelos obsoletos** (pueden dejar de funcionar)
3. **Configurar límites diarios** según el plan del tenant
4. **Probar la conexión** antes de activar un proveedor
5. **Mantener API keys seguras** (se cifran automáticamente)

---

## Mantenimiento

### Agregar Nuevos Modelos

**Cuando salga un nuevo modelo de Claude, Gemini u OpenAI:**

**Archivo:** `backend/src/services/aiConfigService.js`

**Método:** `getAvailableModels()`

**Ejemplo:** Agregar Claude 4.0 Opus

```javascript
getAvailableModels() {
  return {
    'anthropic': [
      {
        id: 'claude-4-opus-20250301',           // ⭐ NUEVO
        name: 'Claude 4 Opus',                   // ⭐ NUEVO
        description: 'Más potente, nueva generación',  // ⭐ NUEVO
        recommended: true,                        // ⭐ NUEVO
        active: true                              // ⭐ NUEVO
      },
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        description: 'Balanceado en velocidad y calidad',
        recommended: false,                       // 👈 Ya no es el recomendado
        active: true
      },
      // ... otros modelos
    ]
  }
}
```

**Pasos:**

1. Editar `aiConfigService.js` línea ~297
2. Agregar nuevo objeto en el array del proveedor
3. Guardar archivo
4. Reiniciar backend: `npm run dev` o deploy
5. El nuevo modelo aparecerá automáticamente en el frontend

### Marcar Modelo como Obsoleto

Cuando un proveedor anuncia que discontinuará un modelo:

```javascript
{
  id: 'claude-3-5-sonnet-20240620',
  name: 'Claude 3.5 Sonnet (Jun 2024)',
  description: 'Versión anterior - puede estar descontinuada',
  recommended: false,
  active: false,           // 👈 Cambiar a false
  deprecated: true         // 👈 Agregar flag
}
```

**Resultado en UI:**
- Badge amarillo "Obsoleto"
- Ícono ⚠️ en los selects
- Sigue apareciendo en la lista para usuarios que lo usen
- No se recomienda para nuevas configuraciones

### Agregar Nuevo Proveedor

**Ejemplo:** Agregar Cohere

1. **Backend - Variables de entorno** (`.env`)
```env
COHERE_API_KEY=sk-cohere-key-123
```

2. **Backend - Servicio** (`aiConfigService.js`)

```javascript
// Línea ~281: getEnvKeyForProvider()
getEnvKeyForProvider(provider) {
  const mapping = {
    'gemini': process.env.GEMINI_API_KEY,
    'anthropic': process.env.ANTHROPIC_API_KEY,
    'openai': process.env.OPENAI_API_KEY,
    'cohere': process.env.COHERE_API_KEY,  // ⭐ NUEVO
    'google-document-ai': process.env.GOOGLE_APPLICATION_CREDENTIALS
  };
  return mapping[provider];
}

// Línea ~297: getAvailableModels()
getAvailableModels() {
  return {
    'anthropic': [...],
    'gemini': [...],
    'openai': [...],
    'cohere': [                              // ⭐ NUEVO
      {
        id: 'command-r-plus',
        name: 'Command R+',
        description: 'Modelo avanzado de Cohere',
        recommended: true,
        active: true
      }
    ]
  };
}
```

3. **Backend - Rutas** (`ai-configs.js` línea ~85)

```javascript
const providers = [
  {
    id: 'anthropic',
    nombre: 'Anthropic Claude',
    descripcion: 'Claude 3.7 y 3.5 - Con capacidades de visión',
    modelosDisponibles: availableModels.anthropic || [],
    requiresApiKey: true
  },
  {
    id: 'cohere',                           // ⭐ NUEVO
    nombre: 'Cohere',                       // ⭐ NUEVO
    descripcion: 'Command R+ - RAG optimizado',  // ⭐ NUEVO
    modelosDisponibles: availableModels.cohere || [],  // ⭐ NUEVO
    requiresApiKey: true                    // ⭐ NUEVO
  }
];
```

4. **Frontend - Tipos** (`lib/api.ts`)

```typescript
export interface AIAvailableModels {
  anthropic: AIModel[];
  gemini: AIModel[];
  openai: AIModel[];
  cohere: AIModel[];  // ⭐ NUEVO
}
```

---

## Troubleshooting

### Error: "No hay API key configurada para [provider]"

**Causa:** No hay API key en `.env` ni configuración custom del tenant

**Solución:**
1. Verificar que existe `[PROVIDER]_API_KEY` en `.env`
2. O configurar API key custom desde el frontend
3. Reiniciar backend si se modificó `.env`

### Error: "El plan del tenant no permite configurar API keys personalizadas"

**Causa:** Feature `AI_CUSTOM_API_KEYS` no habilitado en el plan del tenant

**Solución:**
1. Verificar tabla `features` y `tenant_features` en BD
2. Habilitar feature para el tenant o actualizar plan

### Error: "Modelo [modelo] no encontrado para el proveedor [provider]"

**Causa:** Se intentó configurar un modelo que no existe en el catálogo

**Solución:**
1. Verificar `getAvailableModels()` en `aiConfigService.js`
2. Usar un modelo del catálogo oficial
3. Si es un modelo nuevo, agregarlo al catálogo

### El cambio de modelo no se refleja

**Posibles causas:**

1. **Caché del navegador**
   - Solución: Refrescar página (F5) o limpiar caché

2. **No se recargó la lista después del update**
   - Solución: Verificar que `loadData()` se llama después del update
   - En el código: línea 150 de `ia-config/page.tsx`

3. **Error en el backend**
   - Solución: Revisar logs del backend
   - Verificar que el modelo existe en el catálogo

### Error: "ENCRYPTION_KEY no configurada"

**Causa:** Falta la variable de entorno para cifrar API keys

**Solución:**
```bash
# Generar nueva key
openssl rand -hex 32

# Agregar a .env
ENCRYPTION_KEY=tu_key_generada_aqui
```

### Los modelos no aparecen en el dropdown

**Causa:** `getAvailableModels()` no retorna datos para ese provider

**Debug:**
```javascript
console.log('Available models:', availableModels);
console.log('Provider:', config.provider);
console.log('Models:', getProviderAvailableModels(config.provider));
```

**Solución:**
1. Verificar que el provider existe en `getAvailableModels()`
2. Verificar que el nombre del provider coincide (case-sensitive)
3. Revisar que el backend retorna datos correctos

---

## Variables de Entorno

### Backend (.env)

```bash
# Cifrado de API Keys
ENCRYPTION_KEY=tu_encryption_key_de_64_caracteres

# API Keys Globales (Fallback)
ANTHROPIC_API_KEY=sk-ant-api-key-xxx
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-xxx

# Google Document AI (Opcional)
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Rate Limiting
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_DEV=1000
RATE_LIMIT_PROD=2000

# Environment
NODE_ENV=development
PORT=5050
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:5050
```

---

## Base de Datos

### Tabla: `ai_provider_configs`

```sql
CREATE TABLE ai_provider_configs (
  id VARCHAR(36) PRIMARY KEY,
  tenantId VARCHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  apiKeyEncrypted TEXT,           -- Cifrada con AES-256-GCM
  modelo VARCHAR(100),
  maxRequestsPerDay INT DEFAULT 1000,
  config JSON,                     -- Configuración adicional
  activo BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),

  UNIQUE KEY tenantId_provider (tenantId, provider),
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

### Índices

```sql
-- Búsqueda rápida por tenant
CREATE INDEX idx_ai_configs_tenant ON ai_provider_configs(tenantId);

-- Búsqueda por tenant + provider (único)
CREATE UNIQUE INDEX idx_ai_configs_tenant_provider
  ON ai_provider_configs(tenantId, provider);
```

---

## Seguridad

### Cifrado de API Keys

**Algoritmo:** AES-256-GCM

**Formato almacenado:** `iv:authTag:encrypted`

**Partes:**
- `iv`: Initialization Vector (16 bytes)
- `authTag`: Authentication Tag (16 bytes)
- `encrypted`: Datos cifrados

**Código:**
```javascript
// backend/src/services/aiConfigService.js líneas 228-272

encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

### Best Practices

1. ✅ **API Keys nunca se devuelven en las respuestas**
2. ✅ **Se cifran antes de almacenar en BD**
3. ✅ **Solo se descifran al momento de usar**
4. ✅ **ENCRYPTION_KEY debe ser de 64 caracteres hex (32 bytes)**
5. ✅ **Usar HTTPS en producción**
6. ✅ **Rate limiting habilitado**
7. ✅ **Autenticación requerida en todos los endpoints**

---

## Testing

### Test Manual - Cambio de Modelo

1. Navegar a `/ia-config`
2. Localizar proveedor configurado
3. Cambiar modelo en dropdown
4. Verificar:
   - ✅ Spinner aparece durante actualización
   - ✅ Toast de éxito se muestra
   - ✅ Modelo se actualiza en la tarjeta
   - ✅ Badges se actualizan (recomendado/obsoleto)
   - ✅ Descripción cambia

### Test de API

```bash
# 1. Obtener modelos disponibles
curl -X GET http://localhost:5050/api/ai-configs/available-models \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Actualizar modelo
curl -X PATCH http://localhost:5050/api/ai-configs/update-model \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "modelo": "claude-3-7-sonnet-20250219"
  }'

# 3. Verificar cambio
curl -X GET http://localhost:5050/api/ai-configs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Logs y Monitoreo

### Logs del Backend

```bash
# Configuración exitosa
✅ API key custom configurada para tenant xxx - anthropic

# Modelo actualizado
✅ Modelo actualizado para tenant xxx - anthropic: claude-3-7-sonnet-20250219

# Uso de API key
🔑 Usando API key custom del tenant xxx para anthropic
🔑 Usando API key global (.env) para gemini

# Errores
❌ Error obteniendo API key para anthropic: No hay API key configurada
❌ Error actualizando modelo: Modelo xxx no encontrado
```

### Monitoreo Recomendado

1. **Cambios de modelo**
   - Quién cambió
   - Cuándo
   - De qué modelo a qué modelo

2. **Uso de API**
   - Requests por tenant
   - Límites alcanzados
   - Errores de autenticación

3. **Modelos obsoletos**
   - Alertar cuando se usa un modelo deprecado
   - Sugerir migración a modelo recomendado

---

## Roadmap Futuro

### Mejoras Planeadas

1. **Auto-actualización de modelos**
   - Notificaciones cuando sale un nuevo modelo
   - Auto-switch a modelo recomendado cuando uno se depreca

2. **Analytics de uso**
   - Dashboard de uso por modelo
   - Costos estimados por proveedor
   - Comparativa de performance

3. **Validación de modelos**
   - Test automático al cambiar modelo
   - Rollback automático si falla

4. **Multi-modelo**
   - Fallback entre proveedores
   - Load balancing entre modelos

5. **Catálogo dinámico**
   - Obtener modelos desde API del proveedor
   - Actualización automática del catálogo

---

## Referencias

### Documentación de Proveedores

- **Anthropic Claude:** https://docs.anthropic.com/claude/docs/models-overview
- **Google Gemini:** https://ai.google.dev/gemini-api/docs/models/gemini
- **OpenAI:** https://platform.openai.com/docs/models

### Archivos del Proyecto

| Archivo | Descripción | Líneas Clave |
|---------|-------------|--------------|
| `backend/src/services/aiConfigService.js` | Servicio principal | 297 (modelos), 422 (updateModel) |
| `backend/src/routes/ai-configs.js` | API endpoints | 33 (available-models), 49 (update-model) |
| `frontend/src/lib/api.ts` | Cliente API | 1291 (interfaces), 1364 (funciones) |
| `frontend/src/app/(protected)/ia-config/page.tsx` | UI | 133 (helpers), 143 (quick change) |

---

## Contacto y Soporte

Para dudas o problemas:

1. Revisar esta documentación
2. Verificar logs del backend
3. Revisar consola del navegador (DevTools)
4. Consultar código en las ubicaciones indicadas

**Última actualización:** Enero 2025
**Versión:** 1.0.0
