# Sesión 2025-01-22 - Implementación de Funcionalidades API Avanzadas

## 📋 Resumen de la Sesión

Se implementaron tres funcionalidades críticas para la API Pública de Parse:

1. ✅ **Rate Limiting con Redis** - Control de límites de peticiones por plan
2. ✅ **Sistema de Webhooks** - Notificaciones en tiempo real de eventos
3. ✅ **Dashboard de Métricas** - Monitoreo completo del sistema

---

## 🚦 1. Rate Limiting con Redis

### Objetivo

Proteger la API de abuso y garantizar uso justo según el plan del cliente (FREE, PRO, ENTERPRISE).

### Implementación

**Archivo creado**: `backend/src/middleware/rateLimiter.js`

**Características**:
- ✅ Soporte para Redis (producción) y memoria (desarrollo)
- ✅ Límites configurables por plan:
  - **FREE**: 10 req/min, 100 req/hora, 500 req/día
  - **PRO**: 60 req/min, 1000 req/hora, 10,000 req/día
  - **ENTERPRISE**: 300 req/min, 10,000 req/hora, 100,000 req/día
- ✅ Headers estándar de rate limiting:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After` (cuando se excede el límite)
- ✅ Limpieza automática de datos antiguos
- ✅ Estadísticas de uso por API Key

**Integración**:
```javascript
// backend/src/routes/parseApi.js
const rateLimiter = require('../middleware/rateLimiter');
router.use(rateLimiter);
```

**Configuración Redis** (opcional):
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**Funciones principales**:
```javascript
// Verificar límite con Redis
async function checkRateLimitRedis(key, limit, windowSeconds)

// Verificar límite en memoria (fallback)
function checkRateLimitMemory(key, limit, windowSeconds)

// Middleware principal
const rateLimiter = async (req, res, next)

// Obtener estadísticas de uso
async function getRateLimitStats(apiKeyId, tenantId, planId)
```

**Respuesta cuando se excede el límite**:
```json
{
  "error": "Rate limit exceeded",
  "message": "Has excedido el límite de peticiones...",
  "limit": 60,
  "window": "minute",
  "retryAfter": 45
}
```

---

## 🔔 2. Sistema de Webhooks

### Objetivo

Notificar a sistemas externos cuando ocurren eventos importantes en Parse (documentos procesados, sincronizaciones completadas, etc.).

### Implementación

**Archivos creados**:
1. `backend/src/services/webhookService.js` - Lógica de negocio
2. `backend/src/routes/webhooks.js` - Endpoints CRUD

**Modelo de datos** (Prisma):
```prisma
model webhooks {
  id          String    @id
  tenantId    String
  nombre      String
  url         String
  secret      String
  eventos     Json      @default("[]")
  activo      Boolean   @default(true)
  ultimoEnvio DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime
  webhook_logs webhook_logs[]
}

model webhook_logs {
  id            String    @id
  webhookId     String
  evento        String
  payload       Json
  statusCode    Int?
  respuesta     String?
  error         String?
  intentos      Int       @default(1)
  exitoso       Boolean   @default(false)
  enviadoEn     DateTime  @default(now())
}
```

### Eventos Soportados

```javascript
const EVENTOS = {
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_FAILED: 'document.failed',
  DOCUMENT_EXPORTED: 'document.exported',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',
  EXPORT_COMPLETED: 'export.completed',
  EXPORT_FAILED: 'export.failed'
};
```

### Características Avanzadas

**1. Firma HMAC para Seguridad**:
```javascript
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

El webhook incluye el header `X-Webhook-Signature` que el cliente debe validar.

**2. Reintentos Automáticos**:
- Máximo 3 reintentos
- Exponential backoff: 1s, 2s, 4s
- Solo se reintenta en errores 5xx o timeout

**3. Logging Completo**:
- Cada intento se registra en `webhook_logs`
- Se guarda status code, respuesta y error
- Útil para debugging

### Endpoints API

```javascript
GET    /api/webhooks                      // Listar webhooks
GET    /api/webhooks/:id                  // Obtener webhook
POST   /api/webhooks                      // Crear webhook
PUT    /api/webhooks/:id                  // Actualizar webhook
DELETE /api/webhooks/:id                  // Eliminar webhook
GET    /api/webhooks/:id/stats            // Estadísticas
GET    /api/webhooks/:id/logs             // Logs de envíos
GET    /api/webhooks/eventos/disponibles  // Listar eventos
```

### Ejemplo de Creación

**Request**:
```bash
POST /api/webhooks
{
  "nombre": "Notificaciones a ERP",
  "url": "https://erp.empresa.com/webhooks/parse",
  "eventos": ["document.processed", "document.exported"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "wh_1234567890_abc123",
    "tenantId": "tenant_123",
    "nombre": "Notificaciones a ERP",
    "url": "https://erp.empresa.com/webhooks/parse",
    "secret": "whsec_a1b2c3d4e5f6...",
    "eventos": ["document.processed", "document.exported"],
    "activo": true
  }
}
```

### Payload de Webhook

Cuando se dispara un evento, Parse envía:

```json
{
  "id": "evt_1234567890_xyz789",
  "event": "document.processed",
  "created": "2025-01-22T10:30:00.000Z",
  "data": {
    "documentoId": "doc_123",
    "tipo": "FACTURA_A",
    "numero": "0001-00012345",
    "fecha": "2025-01-20",
    "total": 12500.50,
    "proveedor": {
      "cuit": "30-12345678-9",
      "razonSocial": "Proveedor SA"
    },
    "estado": "completed"
  }
}
```

**Headers enviados**:
```
Content-Type: application/json
X-Webhook-Signature: sha256=a1b2c3d4e5f6...
X-Webhook-Event: document.processed
User-Agent: Parse-Webhook/1.0
```

### Validación del Webhook (Cliente)

```javascript
const crypto = require('crypto');

function validateWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}

// En tu endpoint
app.post('/webhooks/parse', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = 'whsec_tu_secret_del_webhook';

  if (!validateWebhook(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Procesar evento
  const { event, data } = req.body;

  if (event === 'document.processed') {
    // Crear registro en tu ERP
    await createInvoiceInERP(data);
  }

  res.json({ received: true });
});
```

### Funciones Helper para Disparar Webhooks

```javascript
// Cuando se procesa un documento
await triggerDocumentProcessed(tenantId, documento);

// Cuando falla el procesamiento
await triggerDocumentFailed(tenantId, documentoId, error);

// Cuando se exporta un documento
await triggerDocumentExported(tenantId, documento, externalId);

// Cuando se completa una sincronización
await triggerSyncCompleted(tenantId, connectorId, stats);

// Cuando falla una sincronización
await triggerSyncFailed(tenantId, connectorId, error);

// Cuando se completa una exportación
await triggerExportCompleted(tenantId, connectorId, stats);

// Cuando falla una exportación
await triggerExportFailed(tenantId, connectorId, error);
```

**IMPORTANTE**: Estas funciones deben ser integradas en los puntos relevantes del código:
- `documentProcessor.js` - Después de procesar documentos
- `apiPushService.js` - Después de exportar
- `syncService.js` - Después de sincronizar

---

## 📊 3. Dashboard de Métricas

### Objetivo

Proveer visualización completa de todas las métricas del sistema para monitoreo y análisis.

### Implementación

**Archivos creados**:
1. `backend/src/routes/metrics.js` - API de métricas
2. `frontend/src/app/(protected)/metrics/page.tsx` - Dashboard visual

### Endpoints API

```javascript
GET /api/metrics/overview         // Resumen general
GET /api/metrics/documentos       // Métricas de documentos
GET /api/metrics/api-usage        // Uso de API
GET /api/metrics/webhooks         // Métricas de webhooks
GET /api/metrics/sync             // Sincronizaciones
```

Todos soportan el parámetro `?days=7|30|90` para filtrar por período.

### Métricas Overview

**Endpoint**: `GET /api/metrics/overview?days=7`

**Response**:
```json
{
  "success": true,
  "data": {
    "documentos": {
      "total": 1250,
      "procesados": 1180,
      "errores": 70,
      "exportados": 950,
      "tasaExito": "94.40"
    },
    "sincronizacion": {
      "pullJobs": 45,
      "pushJobs": 38,
      "total": 83
    },
    "webhooks": {
      "total": 2340,
      "exitosos": 2315,
      "fallidos": 25,
      "tasaExito": "98.93"
    },
    "periodo": {
      "desde": "2025-01-15T00:00:00.000Z",
      "hasta": "2025-01-22T00:00:00.000Z",
      "dias": 7
    }
  }
}
```

### Métricas de Documentos

**Endpoint**: `GET /api/metrics/documentos?days=30`

**Response**:
```json
{
  "success": true,
  "data": {
    "porDia": [
      {
        "fecha": "2025-01-22",
        "total": 150,
        "completados": 142,
        "errores": 8
      },
      // ... más días
    ],
    "porTipo": [
      { "tipo": "FACTURA_A", "count": 850 },
      { "tipo": "FACTURA_B", "count": 320 },
      { "tipo": "FACTURA_C", "count": 80 }
    ],
    "topErrores": [
      {
        "errorMessage": "No se pudieron extraer datos suficientes del documento",
        "count": 35
      },
      {
        "errorMessage": "Comprobante duplicado: Ya existe...",
        "count": 20
      }
    ]
  }
}
```

### Métricas de API Usage

**Endpoint**: `GET /api/metrics/api-usage?days=30`

**Response**:
```json
{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "apiKeyId": "key_123",
        "nombre": "API Key Principal",
        "requestsToday": 450,
        "requestsThisHour": 55,
        "requestsThisMinute": 8,
        "limitsToday": 500,
        "limitsHour": 100,
        "limitsMinute": 10
      }
    ],
    "recentLogs": [
      {
        "endpoint": "/api/v1/parse/document",
        "statusCode": 200,
        "timestamp": "2025-01-22T10:30:00.000Z",
        "apiKeyId": "key_123"
      }
    ],
    "topEndpoints": [
      {
        "endpoint": "/api/v1/parse/document",
        "count": 1250,
        "avgResponseTime": 2.5
      }
    ]
  }
}
```

### Métricas de Webhooks

**Endpoint**: `GET /api/metrics/webhooks?days=30`

**Response**:
```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "webhookId": "wh_123",
        "nombre": "Notificaciones ERP",
        "activo": true,
        "total": 1200,
        "exitosos": 1190,
        "fallidos": 10,
        "tasaExito": "99.17"
      }
    ],
    "porDia": [
      {
        "fecha": "2025-01-22",
        "total": 150,
        "exitosos": 148,
        "fallidos": 2
      }
    ],
    "porEvento": [
      { "evento": "document.processed", "count": 850 },
      { "evento": "document.exported", "count": 320 }
    ]
  }
}
```

### Métricas de Sincronización

**Endpoint**: `GET /api/metrics/sync?days=30`

**Response**:
```json
{
  "success": true,
  "data": {
    "pull": [
      { "status": "completed", "count": 85 },
      { "status": "failed", "count": 5 }
    ],
    "push": [
      { "status": "completed", "count": 72 },
      { "status": "failed", "count": 3 }
    ],
    "porConector": [
      {
        "connectorName": "ERP Principal",
        "pullJobs": 45,
        "pushJobs": 38
      }
    ],
    "timeline": [
      {
        "fecha": "2025-01-22",
        "total": 12,
        "completados": 11,
        "fallidos": 1
      }
    ]
  }
}
```

### Dashboard Frontend

**Ubicación**: `/metrics`

**Componentes visuales**:
1. **Cards de resumen** - 3 tarjetas con métricas clave
2. **Gráfico de línea** - Documentos procesados por día
3. **Gráfico de torta** - Distribución por tipo de documento
4. **Lista de errores** - Top 5 errores más frecuentes
5. **Gráfico de barras** - Webhooks por día (exitosos vs fallidos)
6. **Gráfico de barras** - Webhooks por evento
7. **Tabla de webhooks** - Estado detallado de cada webhook

**Características**:
- ✅ Selector de período (7, 30, 90 días)
- ✅ Botón de actualización manual
- ✅ Indicadores de tendencia (↑ verde / ↓ rojo)
- ✅ Colores consistentes con el sistema
- ✅ Responsive design
- ✅ Tooltips informativos en gráficos

**Librerías usadas**:
```json
{
  "recharts": "^2.x" // Para gráficos
}
```

---

## 🔧 Integración Pendiente

Para completar la implementación, es necesario integrar los triggers de webhooks en los puntos relevantes del código:

### 1. En `documentProcessor.js`

**Después de procesar exitosamente**:
```javascript
const { triggerDocumentProcessed } = require('./services/webhookService');

// Al final de processDocument(), si exitoso:
if (resultado.estadoProcesamiento === 'completed') {
  await triggerDocumentProcessed(tenantId, resultado);
}
```

**Después de error**:
```javascript
const { triggerDocumentFailed } = require('./services/webhookService');

// En catch o cuando falla:
if (error) {
  await triggerDocumentFailed(tenantId, documentoId, error);
}
```

### 2. En `apiPushService.js`

**Después de exportar documento**:
```javascript
const { triggerDocumentExported } = require('./webhookService');

// En exportDocument(), después de enviar a API externa:
await triggerDocumentExported(tenantId, documento, response.data.externalId);
```

**Después de completar PUSH completo**:
```javascript
const { triggerExportCompleted, triggerExportFailed } = require('./webhookService');

// En executePush(), al final:
if (success > 0 && failed === 0) {
  await triggerExportCompleted(tenantId, connectorId, { success, failed });
} else if (failed > 0) {
  await triggerExportFailed(tenantId, connectorId, new Error(`${failed} exportaciones fallidas`));
}
```

### 3. En sincronización PULL

**Después de completar sync**:
```javascript
const { triggerSyncCompleted, triggerSyncFailed } = require('./webhookService');

// En syncService o donde se maneje PULL:
if (syncJob.status === 'completed') {
  await triggerSyncCompleted(tenantId, connectorId, {
    success: syncJob.processedRecords,
    failed: syncJob.failedRecords
  });
} else {
  await triggerSyncFailed(tenantId, connectorId, syncJob.error);
}
```

---

## 📦 Migraciones de Base de Datos

**Modelos agregados a Prisma**:

```prisma
model webhooks {
  id          String    @id
  tenantId    String
  nombre      String
  url         String
  secret      String
  eventos     Json      @default("[]")
  activo      Boolean   @default(true)
  ultimoEnvio DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime
  tenants     tenants   @relation(fields: [tenantId], references: [id])
  webhook_logs webhook_logs[]

  @@index([tenantId])
  @@index([activo])
}

model webhook_logs {
  id            String    @id
  webhookId     String
  evento        String
  payload       Json
  statusCode    Int?
  respuesta     String?   @db.Text
  error         String?   @db.Text
  intentos      Int       @default(1)
  exitoso       Boolean   @default(false)
  enviadoEn     DateTime  @default(now())
  webhooks      webhooks  @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@index([webhookId])
  @@index([evento])
  @@index([exitoso])
  @@index([enviadoEn])
}
```

**Tablas relacionadas que deben existir** (para métricas):
- `api_logs` - Para métricas de uso de API
- `sync_jobs` - Para métricas de PULL
- `export_jobs` - Para métricas de PUSH

Si no existen, crear con:

```prisma
model api_logs {
  id           String   @id @default(cuid())
  tenantId     String
  apiKeyId     String
  endpoint     String
  method       String
  statusCode   Int
  responseTime Float
  timestamp    DateTime @default(now())

  @@index([tenantId])
  @@index([apiKeyId])
  @@index([timestamp])
}

model sync_jobs {
  id               String   @id @default(cuid())
  tenantId         String
  connectorId      String
  status           String   // 'pending' | 'running' | 'completed' | 'failed'
  processedRecords Int      @default(0)
  failedRecords    Int      @default(0)
  error            String?  @db.Text
  createdAt        DateTime @default(now())
  completedAt      DateTime?

  @@index([tenantId])
  @@index([connectorId])
  @@index([status])
  @@index([createdAt])
}

model export_jobs {
  id               String   @id @default(cuid())
  tenantId         String
  connectorId      String
  status           String   // 'pending' | 'running' | 'completed' | 'failed'
  processedRecords Int      @default(0)
  failedRecords    Int      @default(0)
  error            String?  @db.Text
  createdAt        DateTime @default(now())
  completedAt      DateTime?

  @@index([tenantId])
  @@index([connectorId])
  @@index([status])
  @@index([createdAt])
}
```

**Aplicar migraciones**:
```bash
cd backend
npx prisma db push
npx prisma generate
```

---

## 🧪 Testing

### 1. Testing Rate Limiting

```bash
# Test con cURL
for i in {1..15}; do
  curl -H "X-API-Key: tu-api-key" \
       http://localhost:5100/api/v1/parse/sync/proveedores
  echo ""
done

# Debe bloquear después de 10 requests (plan FREE)
```

### 2. Testing Webhooks

**Crear webhook de prueba**:
```bash
curl -X POST http://localhost:5100/api/webhooks \
  -H "Authorization: Bearer tu-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test Webhook",
    "url": "https://webhook.site/unique-url",
    "eventos": ["document.processed"]
  }'
```

**Procesar documento para disparar webhook**:
```bash
curl -X POST http://localhost:5100/api/v1/parse/document \
  -H "X-API-Key: tu-api-key" \
  -F "file=@factura.pdf"
```

**Verificar logs**:
```bash
curl http://localhost:5100/api/webhooks/{webhook-id}/logs \
  -H "Authorization: Bearer tu-jwt-token"
```

### 3. Testing Dashboard

1. Abrir navegador en `http://localhost:3000/metrics`
2. Verificar que cargan todas las métricas
3. Cambiar selector de período (7/30/90 días)
4. Verificar que gráficos se actualizan
5. Click en "Actualizar" para refrescar

---

## 📝 Notas Importantes

### Seguridad

1. **Webhooks**:
   - ✅ Siempre validar la firma HMAC en el cliente
   - ✅ Usar HTTPS en producción para URLs de webhooks
   - ✅ Nunca exponer el `secret` del webhook
   - ✅ Implementar timeout en el endpoint receptor (máx 30s)

2. **Rate Limiting**:
   - ✅ En producción, usar Redis para compartir límites entre instancias
   - ✅ Monitorear métricas de rate limiting para detectar abusos
   - ✅ Ajustar límites según el plan del cliente

3. **API Keys**:
   - ✅ Rotar API Keys periódicamente
   - ✅ Revocar inmediatamente si se comprometen
   - ✅ Nunca commitear API Keys en el código

### Performance

1. **Webhooks**:
   - ✅ Se envían de forma asíncrona (no bloquean el flujo principal)
   - ✅ Considerar usar una cola (Bull/BullMQ) para alto volumen
   - ✅ Limpiar logs antiguos periódicamente

2. **Métricas**:
   - ✅ Las queries usan índices optimizados
   - ✅ Considerar cachear métricas overview por 5 minutos
   - ✅ Limitar período máximo a 90 días

### Monitoreo

Endpoints a monitorear en producción:
- `GET /api/health` - Debe retornar 200
- `GET /api/metrics/overview` - Para dashboards externos
- `GET /api/webhooks` - Estado de webhooks activos

Alertas recomendadas:
- Tasa de error de webhooks > 5%
- Rate limit exceeded > 100 veces/hora
- Documentos con error > 10%

---

## 🎯 Próximos Pasos Sugeridos

1. **Integrar triggers de webhooks** en el código existente
2. **Crear cola de trabajos** para webhooks (Bull/BullMQ)
3. **Implementar alertas** cuando métricas excedan umbrales
4. **Agregar más eventos** de webhook según necesidades
5. **Crear UI para gestionar webhooks** desde el frontend
6. **Implementar retry manual** para webhooks fallidos
7. **Agregar filtros avanzados** en el dashboard de métricas

---

## 📚 Referencias

- **Rate Limiting**: RFC 6585 (429 Too Many Requests)
- **Webhooks**: [Webhook Best Practices](https://webhooks.fyi/)
- **HMAC Signatures**: RFC 2104
- **Recharts**: https://recharts.org/

---

**Implementado**: 22 de Enero de 2025
**Versión**: 1.0
**Estado**: ✅ Completado (pendiente integración de triggers)
