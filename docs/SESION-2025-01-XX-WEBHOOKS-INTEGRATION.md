# Sesión 2025-01-XX - Integración Completa de Webhooks

## 📋 Resumen de la Sesión

Se completó exitosamente la integración de webhooks en todos los puntos críticos del sistema, permitiendo notificaciones en tiempo real de eventos importantes.

**Duración:** ~45 minutos
**Estado:** ✅ 100% Completado

---

## ✅ Tareas Completadas

### 1. ✅ Refactoring Frontend (Ya completado previamente)

Según `docs/REFACTORING-PROGRESS.md`:
- **10/10 páginas principales** refactorizadas con `useApiMutation`
- **37 handlers** de mutaciones API refactorizados
- **~394 líneas** de código eliminadas
- **Build status:** ✅ Sin errores TypeScript

**Páginas migradas:**
- webhooks, api-connectors, prompts-ia, usuarios
- ia-config, sync-admin, planes, sugerencias-ia
- exportar, parse (muy compleja)

### 2. ✅ Integración de Webhooks en documentProcessor

**Archivo modificado:** `backend/src/routes/documentos.js`

#### Webhook: `document.processed` (Línea 3071-3081)

Disparado cuando un documento se procesa exitosamente:

```javascript
// Disparar webhook de documento procesado
try {
  const { triggerDocumentProcessed } = require('../services/webhookService');
  const documentoCompleto = await prisma.documentos_procesados.findUnique({
    where: { id: documentoId }
  });
  await triggerDocumentProcessed(documento.tenantId, documentoCompleto);
} catch (webhookError) {
  console.warn('⚠️  Error disparando webhook document.processed:', webhookError.message);
  // No fallar el procesamiento por error de webhook
}
```

**Payload enviado:**
```json
{
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
```

#### Webhook: `document.failed` (Línea 3102-3116)

Disparado cuando falla el procesamiento:

```javascript
// Disparar webhook de documento fallido
try {
  const { triggerDocumentFailed } = require('../services/webhookService');
  // Obtener tenantId del documento
  const doc = await prisma.documentos_procesados.findUnique({
    where: { id: documentoId },
    select: { tenantId: true }
  });
  if (doc && doc.tenantId) {
    await triggerDocumentFailed(doc.tenantId, documentoId, error);
  }
} catch (webhookError) {
  console.warn('⚠️  Error disparando webhook document.failed:', webhookError.message);
}
```

**Payload enviado:**
```json
{
  "documentoId": "doc_123",
  "error": "No se pudieron extraer datos suficientes del documento...",
  "timestamp": "2025-01-XX T10:30:00.000Z"
}
```

---

### 3. ✅ Integración de Webhooks en apiPushService

**Archivo modificado:** `backend/src/services/apiPushService.js`

#### Webhook: `document.exported` (Línea 501-509)

Disparado cuando se exporta un documento individual:

```javascript
// Disparar webhook de documento exportado
try {
  const { triggerDocumentExported } = require('./webhookService');
  const externalId = response.data?.id || response.data?.externalId || 'unknown';
  await triggerDocumentExported(connector.tenantId, documento, externalId);
} catch (webhookError) {
  console.warn('⚠️  Error disparando webhook document.exported:', webhookError.message);
  // No fallar la exportación por error de webhook
}
```

**Payload enviado:**
```json
{
  "documentoId": "doc_123",
  "tipo": "FACTURA_A",
  "numero": "0001-00012345",
  "total": 12500.50,
  "externalId": "ext_789",
  "exportedAt": "2025-01-XX T10:30:00.000Z"
}
```

#### Webhooks: `export.completed` y `export.failed` (Línea 86-107)

Disparados al completar/fallar una exportación PUSH completa:

```javascript
// Disparar webhooks según el resultado
try {
  const { triggerExportCompleted, triggerExportFailed } = require('./webhookService');

  if (results.success > 0 && results.failed === 0) {
    // Exportación completamente exitosa
    await triggerExportCompleted(connector.tenantId, connectorId, {
      success: results.success,
      failed: results.failed,
      skipped: results.skipped
    });
  } else if (results.failed > 0) {
    // Hubo fallos en la exportación
    const errorMsg = results.errors.length > 0
      ? results.errors.map(e => e.error).join('; ')
      : `${results.failed} exportaciones fallidas`;
    await triggerExportFailed(connector.tenantId, connectorId, new Error(errorMsg));
  }
} catch (webhookError) {
  console.warn('⚠️  Error disparando webhooks export:', webhookError.message);
}
```

---

### 4. ✅ Integración de Webhooks en apiPullService

**Archivo modificado:** `backend/src/services/apiPullService.js`

#### Webhooks: `sync.completed` y `sync.failed` (Línea 103-124)

Disparados al completar/fallar una sincronización PULL:

```javascript
// Disparar webhooks según el resultado
try {
  const { triggerSyncCompleted, triggerSyncFailed } = require('./webhookService');

  if (finalStatus === 'SUCCESS' || finalStatus === 'PARTIAL') {
    // Sincronización exitosa o parcial
    await triggerSyncCompleted(this.connector.tenantId, this.connector.id, {
      success: results.importedRecords,
      failed: results.failedRecords,
      staged: results.stagedRecords
    });
  } else {
    // Sincronización fallida
    const errorMsg = results.errors.length > 0
      ? results.errors.map(e => e.message).join('; ')
      : 'Fallo en la sincronización';
    await triggerSyncFailed(this.connector.tenantId, this.connector.id, new Error(errorMsg));
  }
} catch (webhookError) {
  console.warn('⚠️  Error disparando webhooks sync:', webhookError.message);
}
```

---

## 🧪 Verificación de Sintaxis

**Resultado:** ✅ Todos los archivos compilan sin errores

```bash
cd backend
node -c src/routes/documentos.js       # ✅ OK
node -c src/services/apiPushService.js # ✅ OK
node -c src/services/apiPullService.js # ✅ OK
```

---

## 📊 Resumen de Eventos de Webhook Implementados

| Evento | Ubicación | Trigger | Payload |
|--------|-----------|---------|---------|
| `document.processed` | documentos.js:3071 | Documento procesado exitosamente | documentoId, tipo, número, fecha, total, proveedor |
| `document.failed` | documentos.js:3102 | Fallo en procesamiento | documentoId, error, timestamp |
| `document.exported` | apiPushService.js:501 | Documento exportado a sistema externo | documentoId, tipo, total, externalId |
| `export.completed` | apiPushService.js:90 | Exportación PUSH completa exitosa | success, failed, skipped |
| `export.failed` | apiPushService.js:97 | Fallos en exportación PUSH | error, connectorId |
| `sync.completed` | apiPullService.js:108 | Sincronización PULL exitosa | success, failed, staged |
| `sync.failed` | apiPullService.js:115 | Fallo en sincronización PULL | error, connectorId |

**Total eventos:** 7 de 7 requeridos ✅

---

## 🎯 Estado de API Connectors Sprint 3 - PUSH

Según `docs/SESION-2025-01-21-API-CONNECTORS.md`:

### ✅ Ya Implementado

- ✅ **ApiPushService** - Servicio completo (589 líneas, 9 métodos)
  - `executePush()` - Ejecuta exportación completa
  - `exportResource()` - Exporta un tipo de recurso
  - `exportDocument()` - Exporta documento individual
  - `markAsExported()` - Marca registro como exportado
  - `logExport()` - Logging de exportaciones
  - `getExportStats()` - Estadísticas de exportación

- ✅ **Endpoints de exportación** (api-connectors.js)
  - `POST /api/api-connectors/:id/execute-push` - Ejecutar PUSH completo
  - `POST /api/api-connectors/:id/documents/:documentoId/export` - Exportar documento individual

- ✅ **Marcar documentos como exportados**
  - Campo `externalSystemId` en `documentos_procesados`
  - Campo `lastExportedAt` en `documentos_procesados`
  - Campo `exportConfigId` en `documentos_procesados`

- ✅ **Logs de exportación**
  - Tabla `api_export_logs` con historial completo
  - Método `logExport()` registra cada exportación
  - Método `getExportStats()` para métricas

### 🟡 Pendiente de Implementación

- 🟡 **UI de exportación manual** - Falta integrar en `/exportar`
  - La página actual solo exporta a JSON
  - Necesita dropdown/selector de API Connectors configurados
  - Botón "Exportar a [Conector]" para cada documento seleccionado

---

## 📝 Próximos Pasos Recomendados

### Opción A: Completar Sprint 3 - UI de Exportación (RECOMENDADO)

**Objetivo:** Permitir exportar documentos a sistemas externos desde la UI

**Tareas:**
1. Agregar dropdown de API Connectors en `/exportar`
2. Filtrar solo conectores con `direction: 'PUSH' | 'BIDIRECTIONAL'`
3. Agregar botón "Exportar a [Nombre Conector]"
4. Llamar a `POST /api/api-connectors/:id/execute-push` con documentos seleccionados
5. Mostrar resultado de exportación (éxitos/fallos)
6. Actualizar lista de documentos post-exportación

**Estimación:** 1-2 horas
**Beneficio:** Sprint 3 completado al 100%

### Opción B: Sprint 4 - API Pública con OAuth 2.0

**Tareas:**
1. Implementar OAuth 2.0 server (client_credentials + authorization_code)
2. Crear endpoints públicos `/api/v1/parse/*`
3. Rate limiting ya implementado ✅ (SESION-2025-01-22-API-FEATURES.md)
4. UI para gestión de API clients
5. Generación de client_id/client_secret

**Estimación:** 4-6 horas
**Beneficio:** API pública funcional para integraciones externas

### Opción C: Sprint 5 - Orquestación y Automatización

**Tareas:**
1. Cron jobs para sincronizaciones programadas (node-cron o Bull)
2. UI para configurar schedules (cron expressions)
3. Webhooks ya implementados ✅
4. Dashboard de estadísticas ya implementado ✅ (SESION-2025-01-22-API-FEATURES.md)
5. Retry automático en fallos
6. Alertas por email (Nodemailer)

**Estimación:** 6-8 horas
**Beneficio:** Sistema completamente automatizado

---

## 📂 Archivos Modificados en Esta Sesión

### Modificados
- ✅ `backend/src/routes/documentos.js` (2 webhooks integrados)
- ✅ `backend/src/services/apiPushService.js` (3 webhooks integrados)
- ✅ `backend/src/services/apiPullService.js` (2 webhooks integrados)

### Verificados (Sin errores)
- ✅ `backend/src/services/webhookService.js` (servicio base, creado en sesión anterior)
- ✅ `backend/src/routes/webhooks.js` (endpoints CRUD, creado en sesión anterior)

---

## 🎉 Logros de la Sesión

1. ✅ **100% de eventos webhook integrados** (7/7)
2. ✅ **Procesamiento de documentos** con notificaciones en tiempo real
3. ✅ **Sincronización PULL/PUSH** con webhooks automáticos
4. ✅ **Código sin errores** de sintaxis
5. ✅ **Error handling robusto** - Los webhooks no bloquean el flujo principal
6. ✅ **Logging detallado** para debugging

---

## 📚 Referencias

- **Diseño de webhooks:** `docs/SESION-2025-01-22-API-FEATURES.md`
- **Servicio base:** `backend/src/services/webhookService.js`
- **API Connectors:** `docs/SESION-2025-01-21-API-CONNECTORS.md`
- **Refactoring:** `docs/REFACTORING-PROGRESS.md`

---

**Fecha de finalización:** 2025-01-XX
**Estado:** ✅ Webhooks 100% Integrados
**Próximo Milestone:** Completar Sprint 3 - UI de Exportación Manual
