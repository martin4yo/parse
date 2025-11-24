# 🔄 Sistema de Conector API Bidireccional

**Fecha de inicio:** 21 de Enero 2025
**Estado:** En Desarrollo
**Versión:** 1.0.0

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura General](#arquitectura-general)
3. [Casos de Uso](#casos-de-uso)
4. [Modelo de Datos](#modelo-de-datos)
5. [Configuración JSON](#configuración-json)
6. [Servicios Backend](#servicios-backend)
7. [API Endpoints](#api-endpoints)
8. [Componentes Frontend](#componentes-frontend)
9. [Flujos de Trabajo](#flujos-de-trabajo)
10. [Plan de Implementación](#plan-de-implementación)

---

## 📖 Resumen Ejecutivo

### Objetivo

Desarrollar un sistema **universal y flexible** para sincronización bidireccional de datos con APIs REST externas, permitiendo:

- **PULL:** Importar datos desde sistemas externos (ERPs, APIs públicas)
- **PUSH:** Exportar datos hacia sistemas externos (Contabilidad, APIs de terceros)
- **Configuración Self-Service:** Los usuarios pueden configurar conectores sin intervención técnica
- **Soporte Universal:** Cualquier API REST con configuración declarativa JSON

### Alcance

✅ **Incluido:**
- Autenticación: API Key, Bearer Token, OAuth 2.0, Basic Auth, Custom Headers
- Paginación automática (page-based, cursor-based, offset-based)
- Mapeo flexible de campos (externa ↔ interna)
- Validación opcional con staging manual
- Programación automática (cron/interval)
- Rate limiting y manejo de reintentos
- Descarga y envío de archivos (Base64)
- Callbacks post-procesamiento
- Logs completos de importación/exportación

❌ **No incluido (futuro):**
- Webhooks entrantes (push desde sistema externo hacia nosotros)
- GraphQL (solo REST)
- SOAP/XML (solo JSON)
- Transformaciones avanzadas con código custom (solo declarativas)

---

## 🏗️ Arquitectura General

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────┐
│         API SYNC ORCHESTRATOR                   │
│  (Gestiona programación y ejecución)            │
└──────────────────┬──────────────────────────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
┌─────▼─────────┐     ┌────────▼────────┐
│  API PULL     │     │   API PUSH      │
│  SERVICE      │     │   SERVICE       │
│  (Importar)   │     │   (Exportar)    │
└───────┬───────┘     └────────┬────────┘
        │                      │
        ├─ Autenticación       │
        ├─ Extracción          │
        ├─ Transformación      │
        ├─ Validación          │
        └─ Importación         │
                               │
        ┌──────────────────────┘
        │
┌───────▼───────────────────────────────┐
│   API CONNECTOR SERVICE (Base)        │
│  - HTTP Client                        │
│  - Rate Limiting                      │
│  - Error Handling                     │
│  - Auth Management                    │
└───────────────────────────────────────┘
```

### Flujo PULL (Importar)

```
1. Sistema Externo
   └─→ API Request (GET /facturas?status=pending)

2. API Pull Service
   ├─→ Autenticación (OAuth2/Bearer/etc)
   ├─→ Extracción con paginación
   ├─→ Transformación (Externa → Interna)
   └─→ Validación (opcional)

3. Destino
   ├─→ Staging (si requireValidation = true)
   │   └─→ Aprobación manual
   └─→ documentos_procesados (directo)
```

### Flujo PUSH (Exportar)

```
1. Origen
   └─→ documentos_procesados (exportado = false)

2. API Push Service
   ├─→ Transformación (Interna → Externa)
   ├─→ Autenticación
   ├─→ Envío en batches
   └─→ Procesar respuesta

3. Sistema Externo
   └─→ API Request (POST /contabilidad/facturas)

4. Actualización
   └─→ Marcar exportado = true
   └─→ Guardar externalSystemId
```

---

## 🎯 Casos de Uso

### Caso de Uso 1: Importar Facturas desde ERP

**Escenario:**
Una empresa tiene un ERP (SAP/Odoo) que expone una API REST con facturas pendientes de procesar.

**Flujo:**
1. Usuario configura conector API (URL, auth, mapeo)
2. Programación: cada 6 horas
3. Sistema consulta `GET /api/invoices?status=pending`
4. Transforma campos: `invoice_number` → `numeroComprobanteExtraido`
5. Descarga PDFs desde `attachment_url`
6. Importa a `documentos_procesados`
7. Usuario procesa normalmente en Parse

**Beneficio:** Automatización total, sin intervención manual.

---

### Caso de Uso 2: Exportar a Sistema Contable

**Escenario:**
Empresa procesa facturas en Parse y necesita exportarlas a su sistema de contabilidad que tiene API.

**Flujo:**
1. Usuario procesa documentos en Parse
2. Marca documentos como "Exportar"
3. Selecciona destino: "Contabilidad API"
4. Sistema transforma datos (interna → formato de Contabilidad)
5. Envía `POST /contabilidad/asientos` con JSON
6. Recibe `external_id` del sistema contable
7. Marca documentos como `exportado = true`

**Beneficio:** Eliminación de exportaciones manuales a Excel/CSV.

---

### Caso de Uso 3: Sincronización Bidireccional

**Escenario:**
Empresa importa órdenes de compra desde ERP y exporta facturas procesadas al mismo ERP.

**Flujo:**
1. **PULL:** Importar órdenes de compra (`GET /purchase-orders`)
2. **Procesamiento:** Usuario valida y procesa en Parse
3. **PUSH:** Exportar facturas validadas (`POST /invoices`)
4. **Callback:** Notificar al ERP que se procesaron (`POST /webhooks/processed`)

**Beneficio:** Integración completa con sistema externo, sin duplicar datos.

---

## 🗄️ Modelo de Datos

### Tabla: `api_connector_configs`

Almacena la configuración de cada conector API.

```sql
CREATE TABLE api_connector_configs (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  nombre VARCHAR(100) NOT NULL,           -- "Integración SAP", "API Contabilium"
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,

  -- Dirección del conector
  direction VARCHAR(20) NOT NULL,         -- 'pull', 'push', 'bidirectional'

  -- Configuración de conexión
  baseUrl VARCHAR(500) NOT NULL,          -- "https://api.ejemplo.com/v1"
  authType VARCHAR(50) NOT NULL,          -- 'api_key', 'bearer_token', 'oauth2', 'basic_auth', 'custom_headers'
  authConfig JSON NOT NULL,               -- Configuración específica de auth

  -- Recursos (endpoints)
  pullResources JSON,                     -- Endpoints para PULL
  pushResources JSON,                     -- Endpoints para PUSH

  -- Mapeo de campos
  pullFieldMapping JSON,                  -- Externa → Interna
  pushFieldMapping JSON,                  -- Interna → Externa

  -- Validación
  requireValidation BOOLEAN DEFAULT false,
  validationRules JSON,

  -- Programación
  pullSchedule JSON,                      -- Cron/interval para PULL
  pushSchedule JSON,                      -- Cron/interval/on_demand para PUSH

  -- Callbacks
  callbackConfig JSON,

  -- Metadata
  lastPullSync TIMESTAMP,
  lastPullStatus VARCHAR(50),             -- 'success', 'error', 'partial'
  lastPushSync TIMESTAMP,
  lastPushStatus VARCHAR(50),

  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy UUID,

  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

---

### Tabla: `api_sync_staging`

Almacena datos importados pendientes de validación manual.

```sql
CREATE TABLE api_sync_staging (
  id UUID PRIMARY KEY,
  configId UUID NOT NULL,
  resourceId VARCHAR(100),                -- "facturas_pendientes"
  tenantId UUID NOT NULL,

  -- Datos
  rawData JSON NOT NULL,                  -- Datos originales de API externa
  transformedData JSON NOT NULL,          -- Datos después de mapeo

  -- Validación
  validationStatus VARCHAR(50),           -- 'pending', 'approved', 'rejected'
  validationErrors JSON,                  -- Errores de validación automática
  validatedBy UUID,
  validatedAt TIMESTAMP,

  -- Metadata
  syncBatchId UUID,                       -- Agrupa datos de una misma sincronización
  createdAt TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (configId) REFERENCES api_connector_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

---

### Tabla: `api_pull_logs`

Historial de importaciones (PULL).

```sql
CREATE TABLE api_pull_logs (
  id UUID PRIMARY KEY,
  configId UUID NOT NULL,
  tenantId UUID NOT NULL,
  resourceId VARCHAR(100),

  -- Resultado
  status VARCHAR(50),                     -- 'success', 'partial', 'failed'
  recordsFound INT DEFAULT 0,
  recordsImported INT DEFAULT 0,
  recordsFailed INT DEFAULT 0,

  -- Respuesta
  apiResponse JSON,

  -- Metadata
  executedAt TIMESTAMP DEFAULT NOW(),
  durationMs INT,
  errorDetails JSON,

  FOREIGN KEY (configId) REFERENCES api_connector_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

---

### Tabla: `api_export_logs`

Historial de exportaciones (PUSH).

```sql
CREATE TABLE api_export_logs (
  id UUID PRIMARY KEY,
  configId UUID NOT NULL,
  tenantId UUID NOT NULL,

  -- Documentos exportados
  documentIds UUID[],
  totalDocuments INT,

  -- Resultado
  status VARCHAR(50),                     -- 'success', 'partial', 'failed'
  successfulCount INT DEFAULT 0,
  failedCount INT DEFAULT 0,

  -- Respuesta de API externa
  externalResponse JSON,
  externalIds TEXT[],                     -- IDs asignados por sistema externo

  -- Metadata
  exportedBy UUID,
  exportedAt TIMESTAMP DEFAULT NOW(),
  durationMs INT,
  errorDetails JSON,

  FOREIGN KEY (configId) REFERENCES api_connector_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

---

### Modificación: `documentos_procesados`

Campos adicionales para exportación:

```sql
ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS externalSystemId VARCHAR(100);
ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS lastExportedAt TIMESTAMP;
ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS exportConfigId UUID;
```

---

## ⚙️ Configuración JSON

### 1. authConfig (Autenticación)

#### API Key
```json
{
  "type": "api_key",
  "key": "X-API-Key",
  "value": "abc123xyz",
  "location": "header"
}
```

#### Bearer Token
```json
{
  "type": "bearer_token",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshUrl": "https://api.ejemplo.com/auth/refresh",
  "refreshToken": "refresh_token_here"
}
```

#### OAuth 2.0
```json
{
  "type": "oauth2",
  "clientId": "your_client_id",
  "clientSecret": "your_secret",
  "tokenUrl": "https://api.ejemplo.com/oauth/token",
  "scopes": ["read:invoices", "write:documents"],
  "grantType": "client_credentials"
}
```

#### Basic Auth
```json
{
  "type": "basic_auth",
  "username": "usuario@empresa.com",
  "password": "encrypted_password_here"
}
```

#### Custom Headers
```json
{
  "type": "custom_headers",
  "headers": {
    "X-Tenant-ID": "tenant_123",
    "X-API-Version": "2.0",
    "Authorization": "Custom abc123"
  }
}
```

---

### 2. pullResources (Endpoints para importar)

```json
{
  "resources": [
    {
      "id": "facturas_pendientes",
      "nombre": "Facturas Pendientes de Exportar",
      "enabled": true,

      "endpoint": {
        "method": "GET",
        "path": "/invoices",
        "queryParams": {
          "status": "pending",
          "limit": "100"
        }
      },

      "pagination": {
        "enabled": true,
        "type": "page_based",
        "pageParam": "page",
        "pageSizeParam": "limit",
        "maxPages": 10,
        "nextPagePath": "data.pagination.nextPage"
      },

      "rateLimit": {
        "requestsPerMinute": 60,
        "retryOnLimit": true,
        "retryDelay": 5000
      },

      "dataPath": "data.invoices",
      "targetEntity": "documentos_procesados"
    }
  ]
}
```

---

### 3. pullFieldMapping (Mapeo Externa → Interna)

```json
{
  "mappings": {
    "facturas_pendientes": {
      "fields": [
        {
          "source": "invoice_number",
          "target": "numeroComprobanteExtraido",
          "type": "string",
          "required": true,
          "transform": "uppercase"
        },
        {
          "source": "invoice_date",
          "target": "fechaExtraida",
          "type": "date",
          "required": true,
          "transform": "parse_iso_date"
        },
        {
          "source": "total_amount",
          "target": "importeExtraido",
          "type": "decimal",
          "required": true
        },
        {
          "source": "supplier.tax_id",
          "target": "cuitExtraido",
          "type": "string"
        },
        {
          "source": "document_type",
          "target": "tipoComprobanteExtraido",
          "type": "string",
          "valueMapping": {
            "INV": "FACTURA A",
            "CN": "NOTA DE CRÉDITO A"
          }
        },
        {
          "source": "attachment_url",
          "target": "rutaArchivo",
          "type": "string",
          "transform": "download_file",
          "transformConfig": {
            "downloadPath": "/uploads/from_api"
          }
        }
      ],

      "relations": {
        "documento_lineas": {
          "sourcePath": "line_items",
          "fields": [
            { "source": "description", "target": "descripcion" },
            { "source": "quantity", "target": "cantidad" },
            { "source": "unit_price", "target": "precioUnitario" }
          ]
        }
      }
    }
  }
}
```

---

### 4. pushResources (Endpoints para exportar)

```json
{
  "pushResources": [
    {
      "id": "exportar_facturas",
      "nombre": "Exportar Facturas a Contabilidad",
      "enabled": true,

      "trigger": {
        "type": "on_demand"
      },

      "endpoint": {
        "method": "POST",
        "path": "/contabilidad/facturas"
      },

      "sourceEntity": "documentos_procesados",
      "sourceFilter": {
        "exportado": false,
        "estadoProcesamiento": "completado"
      },

      "batchSize": 50,

      "responseHandling": {
        "successPath": "data.success",
        "errorPath": "error.message",
        "idPath": "data.external_id",

        "onSuccess": {
          "updateField": "exportado",
          "updateValue": true,
          "storeExternalId": true,
          "externalIdField": "externalSystemId"
        }
      }
    }
  ]
}
```

---

### 5. pushFieldMapping (Mapeo Interna → Externa)

```json
{
  "mappings": {
    "exportar_facturas": {
      "fields": [
        {
          "source": "numeroComprobanteExtraido",
          "target": "invoice_number",
          "type": "string",
          "required": true
        },
        {
          "source": "fechaExtraida",
          "target": "invoice_date",
          "type": "date",
          "transform": "format_iso_date"
        },
        {
          "source": "tipoComprobanteExtraido",
          "target": "document_type",
          "type": "string",
          "valueMapping": {
            "FACTURA A": "INV",
            "NOTA DE CRÉDITO A": "CN"
          }
        },
        {
          "source": "rutaArchivo",
          "target": "attachment_base64",
          "type": "file",
          "transform": "encode_base64"
        }
      ],

      "envelope": {
        "wrapIn": "data",
        "additionalFields": {
          "source": "parse_app",
          "version": "1.0"
        }
      }
    }
  }
}
```

---

### 6. validationRules

```json
{
  "autoValidationRules": [
    {
      "field": "importeExtraido",
      "rule": "greater_than",
      "value": 0,
      "errorMessage": "El importe debe ser mayor a 0",
      "severity": "error"
    },
    {
      "field": "cuitExtraido",
      "rule": "matches_pattern",
      "pattern": "^\\d{2}-\\d{8}-\\d{1}$",
      "errorMessage": "CUIT inválido",
      "severity": "error"
    },
    {
      "rule": "no_duplicates",
      "fields": ["cuitExtraido", "tipoComprobanteExtraido", "numeroComprobanteExtraido"],
      "errorMessage": "Comprobante duplicado",
      "severity": "warning"
    }
  ]
}
```

---

### 7. pullSchedule / pushSchedule

```json
{
  "enabled": true,
  "type": "cron",
  "expression": "0 */6 * * *",
  "timezone": "America/Argentina/Buenos_Aires"
}
```

O intervalo simple:

```json
{
  "enabled": true,
  "type": "interval",
  "intervalMinutes": 30
}
```

---

### 8. callbackConfig

```json
{
  "enabled": true,
  "callbacks": [
    {
      "event": "after_import",
      "endpoint": {
        "method": "POST",
        "path": "/invoices/mark_exported",
        "body": {
          "invoice_ids": "{{imported_ids}}",
          "exported_at": "{{sync_timestamp}}",
          "status": "exported"
        }
      }
    }
  ]
}
```

---

## 🔧 Servicios Backend

### ApiConnectorService (Base)

**Archivo:** `backend/src/services/apiConnectorService.js`

**Métodos principales:**
- `authenticate()` - Autenticación según authType
- `makeRequest(endpoint, params)` - HTTP request con retry
- `respectRateLimit(config)` - Control de rate limiting
- `getNestedValue(obj, path)` - Acceso a propiedades anidadas
- `setNestedValue(obj, path, value)` - Setear propiedades anidadas

---

### ApiPullService

**Archivo:** `backend/src/services/apiPullService.js`

**Métodos principales:**
- `pullData(resourceId)` - Importación completa
- `fetchWithPagination(resource)` - Manejo de paginación
- `transformPullData(rawData, mapping)` - Transformación externa → interna
- `validateData(data, rules)` - Validación automática
- `saveToStaging(data)` - Guardar en staging
- `saveToDatabaseDirect(data)` - Importar directo
- `downloadFile(url, path)` - Descarga de archivos

---

### ApiPushService

**Archivo:** `backend/src/services/apiPushService.js`

**Métodos principales:**
- `pushData(documentIds)` - Exportación completa
- `transformPushData(documents, mapping)` - Transformación interna → externa
- `sendBatch(batch, resource)` - Envío en lotes
- `handlePushResponse(response, batch)` - Procesar respuesta
- `updateExportedDocuments(results)` - Actualizar BD
- `readFileAndEncode(filePath)` - Codificar archivo a Base64

---

### ApiSyncOrchestrator

**Archivo:** `backend/src/services/apiSyncOrchestrator.js`

**Métodos principales:**
- `scheduleConfig(configId)` - Programar ejecución automática
- `executePullNow(configId)` - Ejecutar importación manual
- `executePushNow(configId, documentIds)` - Ejecutar exportación manual
- `executeCallbacks(config, context)` - Ejecutar callbacks

---

## 🛣️ API Endpoints

### CRUD Configuraciones

```
GET    /api/api-connectors              - Listar conectores
GET    /api/api-connectors/:id          - Obtener uno
POST   /api/api-connectors              - Crear
PUT    /api/api-connectors/:id          - Actualizar
DELETE /api/api-connectors/:id          - Eliminar
POST   /api/api-connectors/:id/test     - Probar conexión
```

### PULL (Importar)

```
POST   /api/api-connectors/:id/pull                    - Ejecutar importación
GET    /api/api-connectors/:id/pull-logs               - Historial
GET    /api/api-connectors/:id/staging                 - Ver staging
POST   /api/api-connectors/:id/staging/:stagingId/approve - Aprobar
POST   /api/api-connectors/:id/staging/:stagingId/reject  - Rechazar
```

### PUSH (Exportar)

```
POST   /api/api-connectors/:id/push                    - Exportar
GET    /api/api-connectors/:id/push-logs               - Historial
GET    /api/api-connectors/available-for-export        - Conectores disponibles
```

---

## 🎨 Componentes Frontend

### Páginas

```
/api-connectors                         - Lista de conectores
/api-connectors/new                     - Wizard nuevo conector
/api-connectors/[id]/edit               - Wizard editar
/api-connectors/[id]/staging            - Preview staging
/api-connectors/[id]/logs               - Historial logs
```

### Componentes Reutilizables

```
- AuthConfigForm.tsx                    - Formulario autenticación
- ResourceConfigForm.tsx                - Configurar endpoints
- FieldMappingBuilder.tsx               - Visual mapper
- ValidationRulesForm.tsx               - Configurar validaciones
- ScheduleConfigForm.tsx                - Configurar cron
- TestConnectionButton.tsx              - Probar conexión
- StagingDataTable.tsx                  - Tabla staging
- LogsViewer.tsx                        - Visor de logs
```

---

## 🔄 Flujos de Trabajo

### Flujo 1: Configurar Conector PULL

1. Usuario va a `/api-connectors` → Click "Nuevo Conector"
2. Wizard Paso 1: Nombre, descripción, dirección = "pull"
3. Wizard Paso 2: URL base, tipo auth, credenciales → Probar conexión
4. Wizard Paso 3: Configurar endpoint (method, path, params)
5. Wizard Paso 4: Configurar paginación y rate limiting
6. Wizard Paso 5: Mapeo de campos (drag & drop)
7. Wizard Paso 6: Validación (opcional)
8. Wizard Paso 7: Programación (cron)
9. Wizard Paso 8: Resumen → Guardar
10. Sistema programa ejecución automática

---

### Flujo 2: Importación Manual

1. Usuario va a `/api-connectors`
2. Click "Ejecutar Ahora" en un conector PULL
3. Sistema ejecuta ApiPullService.pullData()
4. Si requireValidation = true:
   - Datos van a staging
   - Usuario ve `/api-connectors/[id]/staging`
   - Usuario revisa datos (raw vs transformed)
   - Click "Aprobar" o "Rechazar"
5. Si requireValidation = false:
   - Datos se importan directo
6. Toast: "X documentos importados exitosamente"

---

### Flujo 3: Exportación Manual

1. Usuario va a `/exportar`
2. Selecciona documentos (checkboxes)
3. Dropdown "Exportar a..." → Selecciona conector API
4. Modal de confirmación con preview
5. Click "Exportar"
6. Sistema ejecuta ApiPushService.pushData()
7. Progress bar muestra avance
8. Documentos marcados como exportado = true
9. Toast: "X documentos exportados, Y fallaron"

---

## 📅 Plan de Implementación

### Sprint 1: Base + PULL Básico (Semana 1-2)

**Objetivo:** Sistema funcional para importar datos desde API externa

**Tareas:**
- ✅ Schema BD (4 tablas nuevas)
- ✅ ApiConnectorService (base)
- ✅ ApiPullService (sin validación todavía)
- ✅ Endpoints CRUD configs
- ✅ Endpoints PULL básicos
- ✅ UI: Lista de conectores
- ✅ UI: Wizard pasos 1-3 (info + conexión + recursos)

**Entregable:** Importar datos de API pública (ej: JSONPlaceholder)

---

### Sprint 2: PULL Completo + Validación (Semana 3)

**Objetivo:** PULL con validación manual

**Tareas:**
- ✅ Sistema de validación y staging
- ✅ Endpoints staging
- ✅ UI: Preview de staging
- ✅ Completar wizard pasos 4-9
- ✅ OAuth2 con refresh token
- ✅ Descarga de archivos

**Entregable:** PULL completo con staging

---

### Sprint 3: PUSH (Semana 4)

**Objetivo:** Exportación a APIs externas

**Tareas:**
- ✅ ApiPushService
- ✅ Endpoints PUSH
- ✅ Integración en `/exportar`
- ✅ Mapeo inverso en wizard
- ✅ Encode archivos a Base64

**Entregable:** Sistema bidireccional completo

---

### Sprint 4: Orquestación (Semana 5)

**Objetivo:** Programación automática

**Tareas:**
- ✅ ApiSyncOrchestrator
- ✅ Cron jobs
- ✅ Callbacks
- ✅ UI: Logs e historial
- ✅ Componentes reutilizables

**Entregable:** Sistema con scheduling

---

### Sprint 5: Testing y Docs (Semana 6)

**Objetivo:** Production-ready

**Tareas:**
- ✅ Tests unitarios
- ✅ Tests de integración
- ✅ Documentación de usuario
- ✅ Casos de uso reales

**Entregable:** Sistema completo

---

## 🧪 Testing

### APIs Públicas para Testing

- **JSONPlaceholder:** https://jsonplaceholder.typicode.com
- **ReqRes:** https://reqres.in/api
- **Fake Store API:** https://fakestoreapi.com
- **MockAPI:** https://mockapi.io

### Tests Críticos

1. Autenticación OAuth2 con refresh
2. Paginación con 1000+ registros
3. Rate limiting (simular 429)
4. Mapeo de objetos anidados complejos
5. Descarga de archivos grandes
6. Validación con duplicados
7. Exportación con errores parciales
8. Callbacks con timeout

---

## 📝 Notas de Implementación

### Seguridad

- **Credenciales:** Encriptar passwords en authConfig con AES-256
- **OAuth tokens:** Guardar refresh tokens encriptados
- **Validación input:** Sanitizar todos los JSONs de configuración
- **Rate limiting:** Respetar límites de APIs externas

### Performance

- **Caching:** Cachear tokens OAuth2 en memoria
- **Batching:** Procesar en lotes de 50-100 registros
- **Async:** Todas las operaciones de red asíncronas
- **Timeout:** 30s default, configurable

### Monitoreo

- **Logs:** Todos los eventos en api_pull_logs y api_export_logs
- **Alertas:** Notificar si >50% de requests fallan
- **Métricas:** Tracking de duración, éxito/fallo

---

## 🔗 Referencias

- [REST API Design Best Practices](https://restfulapi.net/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [JSON Schema](https://json-schema.org/)
- [Cron Expression](https://crontab.guru/)

---

**Última actualización:** 21 de Enero 2025
**Autor:** Claude Code
**Estado:** 📝 Documentación completa - Listo para desarrollo
