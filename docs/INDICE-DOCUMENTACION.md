# 📚 Índice de Documentación - Parse Rendiciones App

**Última actualización:** 21 de Enero 2025

Este documento sirve como índice maestro de toda la documentación técnica del proyecto Parse.

---

## 📖 Documentación General

### Configuración del Proyecto

| Documento | Descripción |
|-----------|-------------|
| [`CLAUDE.md`](../CLAUDE.md) | **Documentación principal del proyecto** - Configuración, actualizaciones recientes, roadmap |
| [`README.md`](../README.md) | Información general del proyecto |
| [`backend/.env.example`](../backend/.env.example) | Plantilla de variables de entorno |

---

## ✅ Sprints Completados

### Sprint 4 - OAuth 2.0 + API Pública (Enero 2025)

| Documento | Descripción | Líneas |
|-----------|-------------|--------|
| [`SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) | **Documentación técnica completa del Sprint 4** - OAuth 2.0, API pública, endpoints, seguridad | ~1,100 |
| [`API-PUBLICA-PARSE.md`](./API-PUBLICA-PARSE.md) | Especificación de la API pública con ejemplos | ~760 |

**Resumen:**
- ✅ Sistema OAuth 2.0 completo (Client Credentials flow)
- ✅ API REST pública `/api/v1/documents/*`
- ✅ UI de gestión de clientes OAuth `/api-clients`
- ✅ Rate limiting configurable
- ✅ Auditoría completa de requests
- ✅ 5 archivos backend + 1 frontend + 3 tablas BD

---

### Sprint 1-3 - Sistema de API Connectors Bidireccionales (Enero 2025)

| Documento | Descripción | Líneas |
|-----------|-------------|--------|
| [`SESION-2025-01-20-COMPLETA.md`](./SESION-2025-01-20-COMPLETA.md) | Sesión completa de implementación | ~1,500 |
| [`SESION-2025-01-21-API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) | Detalles de API Connectors base | ~800 |
| [`SESION-2025-01-22-API-FEATURES.md`](./SESION-2025-01-22-API-FEATURES.md) | Features avanzadas de API Connectors | ~650 |
| [`SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) | Integración de webhooks en connectors | ~650 |
| [`SESION-2025-01-XX-EXPORTACION-API-UI.md`](./SESION-2025-01-XX-EXPORTACION-API-UI.md) | UI de exportación manual a API | ~580 |
| [`CONECTOR-API-BIDIRECCIONAL.md`](./CONECTOR-API-BIDIRECCIONAL.md) | Diseño y especificación del sistema | ~900 |

**Resumen:**
- ✅ PULL: Importar datos desde APIs externas
- ✅ PUSH: Exportar documentos a sistemas externos
- ✅ UI completa en `/api-connectors`
- ✅ Sistema de webhooks (7 eventos)
- ✅ Validación y staging
- ✅ OAuth2, API Key, Bearer Token

---

### Sistema de Aprendizaje de Patrones (Enero 2025)

| Documento | Descripción | Líneas |
|-----------|-------------|--------|
| [`SISTEMA-APRENDIZAJE-PATRONES.md`](./SISTEMA-APRENDIZAJE-PATRONES.md) | Documentación completa del sistema de pattern learning | ~800 |
| [`APRENDIZAJE-PATRONES-PROMPTS.md`](./APRENDIZAJE-PATRONES-PROMPTS.md) | Extensión para prompts de extracción | ~550 |
| [`API-PUBLICA-APRENDIZAJE-PATRONES.md`](./API-PUBLICA-APRENDIZAJE-PATRONES.md) | Integración con API pública | ~400 |

**Resumen:**
- ✅ Aprendizaje automático de clasificaciones
- ✅ Reducción 60-85% de llamadas a IA
- ✅ Hash matching para documentos idénticos
- ✅ Templates de proveedores recurrentes
- ✅ Sistema de confianza progresivo

---

### Dimensiones y Subcuentas (Enero 2025)

| Documento | Descripción | Líneas |
|-----------|-------------|--------|
| [`SESION-2025-01-16-DIMENSIONES-DOCUMENTO.md`](./SESION-2025-01-16-DIMENSIONES-DOCUMENTO.md) | Dimensiones contables a nivel documento | ~450 |

**Resumen:**
- ✅ Asignar dimensiones al documento completo
- ✅ Validación de subcuentas (suma 100%)
- ✅ Modal reutilizable para documento/línea/impuesto

---

### Refactoring Frontend (Enero 2025)

| Documento | Descripción | Líneas |
|-----------|-------------|--------|
| [`SESION-2025-01-22-REFACTORING-FASE1.md`](./SESION-2025-01-22-REFACTORING-FASE1.md) | Fase 1 del refactoring con useApiMutation | ~700 |
| [`REFACTORING-PROGRESS.md`](./REFACTORING-PROGRESS.md) | Progreso del refactoring frontend | ~250 |

**Resumen:**
- ✅ Hook `useApiMutation` para estandarizar mutaciones
- ✅ 10/10 páginas migradas
- ✅ ~394 líneas de código eliminadas
- ✅ Manejo consistente de errores y loading states

---

### Otros (Enero 2025)

| Documento | Descripción |
|-----------|-------------|
| [`SESION-2025-01-13.md`](./SESION-2025-01-13.md) | Prompts GLOBAL + fix de crash del backend |

---

## 🗂️ Documentación Técnica por Tema

### Autenticación y Seguridad

| Tema | Documentos |
|------|-----------|
| **OAuth 2.0** | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| **API Keys** | [`API-PUBLICA-PARSE.md`](./API-PUBLICA-PARSE.md) |
| **Webhooks con HMAC** | [`WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) |

### APIs y Conectores

| Tema | Documentos |
|------|-----------|
| **API Pública OAuth** | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| **API Parse (upload)** | [`API-PUBLICA-PARSE.md`](./API-PUBLICA-PARSE.md) |
| **API Connectors** | [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md), [`API-FEATURES.md`](./SESION-2025-01-22-API-FEATURES.md) |
| **Webhooks** | [`WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) |

### Inteligencia Artificial

| Tema | Documentos |
|------|-----------|
| **Pattern Learning** | [`SISTEMA-APRENDIZAJE-PATRONES.md`](./SISTEMA-APRENDIZAJE-PATRONES.md) |
| **Pattern Learning (Prompts)** | [`APRENDIZAJE-PATRONES-PROMPTS.md`](./APRENDIZAJE-PATRONES-PROMPTS.md) |
| **Prompts GLOBAL** | [`SESION-2025-01-13.md`](./SESION-2025-01-13.md) |

### Frontend

| Tema | Documentos |
|------|-----------|
| **Refactoring con useApiMutation** | [`REFACTORING-FASE1.md`](./SESION-2025-01-22-REFACTORING-FASE1.md) |
| **UI de API Clients** | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| **UI de Exportación** | [`EXPORTACION-API-UI.md`](./SESION-2025-01-XX-EXPORTACION-API-UI.md) |

### Backend

| Tema | Documentos |
|------|-----------|
| **OAuth Service** | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| **API Push/Pull Services** | [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| **Pattern Learning Service** | [`SISTEMA-APRENDIZAJE-PATRONES.md`](./SISTEMA-APRENDIZAJE-PATRONES.md) |
| **Webhook Service** | [`WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) |

---

## 📊 Base de Datos

### Tablas Principales

| Tabla | Descripción | Documentación |
|-------|-------------|---------------|
| `documentos_procesados` | Documentos procesados con datos extraídos | Todos los docs |
| `documento_lineas` | Líneas de factura | Todos los docs |
| `documento_impuestos` | Impuestos de documentos | Todos los docs |
| `documento_distribuciones` | Dimensiones contables | [`DIMENSIONES-DOCUMENTO.md`](./SESION-2025-01-16-DIMENSIONES-DOCUMENTO.md) |

### Tablas de Integraciones

| Tabla | Descripción | Documentación |
|-------|-------------|---------------|
| `oauth_clients` | Clientes OAuth 2.0 | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| `oauth_tokens` | Access y refresh tokens | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| `oauth_api_logs` | Logs de API pública | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| `api_connector_configs` | Configuraciones de conectores | [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| `api_pull_logs` | Logs de importación (PULL) | [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| `api_export_logs` | Logs de exportación (PUSH) | [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| `api_sync_staging` | Staging de datos importados | [`API-FEATURES.md`](./SESION-2025-01-22-API-FEATURES.md) |
| `webhooks` | Configuraciones de webhooks | [`WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) |

### Tablas de IA

| Tabla | Descripción | Documentación |
|-------|-------------|---------------|
| `patrones_aprendidos` | Patrones aprendidos para IA | [`SISTEMA-APRENDIZAJE-PATRONES.md`](./SISTEMA-APRENDIZAJE-PATRONES.md) |
| `ai_prompts` | Prompts de IA (incluye GLOBAL) | [`SESION-2025-01-13.md`](./SESION-2025-01-13.md) |
| `reglas_negocio` | Reglas de transformación | Todos los docs |

---

## 🛣️ Endpoints de la API

### API Pública OAuth (`/api/v1/*`)

**Documentación:** [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md)

#### Autenticación
- `POST /api/v1/auth/token` - Obtener access token
- `POST /api/v1/auth/refresh` - Refrescar token
- `POST /api/v1/auth/revoke` - Revocar token
- `GET /api/v1/auth/me` - Info del cliente autenticado

#### Documentos
- `GET /api/v1/documents` - Listar documentos
- `GET /api/v1/documents/:id` - Ver documento
- `GET /api/v1/documents/:id/lineas` - Ver líneas
- `GET /api/v1/documents/:id/impuestos` - Ver impuestos
- `GET /api/v1/documents/:id/file` - Descargar archivo
- `POST /api/v1/documents/:id/mark-exported` - Marcar como exportado

### API Parse (`/api/v1/parse/*`)

**Documentación:** [`API-PUBLICA-PARSE.md`](./API-PUBLICA-PARSE.md)

- `POST /api/v1/parse/document` - Parsear documento (no guarda)
- `POST /api/v1/parse/apply-rules` - Aplicar reglas de negocio
- `POST /api/v1/parse/full` - Parsear + aplicar reglas
- `POST /api/v1/parse/save` - Parsear + guardar en BD
- `GET /api/v1/parse/stats` - Estadísticas de pattern learning
- `GET /api/v1/parse/sync/*` - Sincronización de tablas maestras

### API de Gestión (`/api/*`)

**Documentación:** Múltiples documentos

#### OAuth Clients (Admin)
- `GET /api/oauth-clients` - Listar clientes
- `POST /api/oauth-clients` - Crear cliente
- `PUT /api/oauth-clients/:id` - Actualizar cliente
- `DELETE /api/oauth-clients/:id` - Eliminar cliente
- `GET /api/oauth-clients/:id/stats` - Ver estadísticas
- `POST /api/oauth-clients/:id/regenerate-secret` - Regenerar secret

#### API Connectors
- `GET /api/api-connectors` - Listar conectores
- `POST /api/api-connectors` - Crear conector
- `PUT /api/api-connectors/:id` - Actualizar conector
- `DELETE /api/api-connectors/:id` - Eliminar conector
- `POST /api/api-connectors/:id/execute-pull` - Ejecutar importación
- `POST /api/api-connectors/:id/execute-push` - Ejecutar exportación

#### Webhooks
- `GET /api/webhooks` - Listar webhooks
- `POST /api/webhooks` - Crear webhook
- `PUT /api/webhooks/:id` - Actualizar webhook
- `DELETE /api/webhooks/:id` - Eliminar webhook
- `GET /api/webhooks/eventos/disponibles` - Eventos disponibles

#### Pattern Learning
- `POST /api/patrones-aprendidos/aprender-manual` - Aprender patrón manualmente
- `GET /api/patrones-aprendidos/stats` - Estadísticas de aprendizaje
- `GET /api/patrones-aprendidos/buscar` - Buscar patrones

---

## 🔍 Buscar Documentación

### Por Funcionalidad

| Busco... | Ver documento |
|----------|---------------|
| Cómo crear un cliente OAuth | [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| Cómo conectar con un ERP externo | [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| Cómo configurar webhooks | [`WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) |
| Cómo reducir costos de IA | [`SISTEMA-APRENDIZAJE-PATRONES.md`](./SISTEMA-APRENDIZAJE-PATRONES.md) |
| Cómo exportar documentos manualmente | [`EXPORTACION-API-UI.md`](./SESION-2025-01-XX-EXPORTACION-API-UI.md) |
| Cómo asignar dimensiones contables | [`DIMENSIONES-DOCUMENTO.md`](./SESION-2025-01-16-DIMENSIONES-DOCUMENTO.md) |

### Por Código

| Busco código de... | Ver archivo |
|-------------------|-------------|
| Servicio OAuth | `backend/src/services/oauthService.js` → [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| Middleware OAuth | `backend/src/middleware/oauthAuth.js` → [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| API Pública | `backend/src/routes/publicApi.js` → [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |
| API Push Service | `backend/src/services/apiPushService.js` → [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| API Pull Service | `backend/src/services/apiPullService.js` → [`API-CONNECTORS.md`](./SESION-2025-01-21-API-CONNECTORS.md) |
| Webhook Service | `backend/src/services/webhookService.js` → [`WEBHOOKS-INTEGRATION.md`](./SESION-2025-01-XX-WEBHOOKS-INTEGRATION.md) |
| Pattern Learning | `backend/src/services/patternLearningService.js` → [`SISTEMA-APRENDIZAJE-PATRONES.md`](./SISTEMA-APRENDIZAJE-PATRONES.md) |
| UI API Clients | `frontend/src/app/(protected)/api-clients/page.tsx` → [`SPRINT4-OAUTH-API-PUBLICA.md`](./SESION-2025-01-21-SPRINT4-OAUTH-API-PUBLICA.md) |

---

## 📈 Estadísticas de Documentación

| Métrica | Valor |
|---------|-------|
| Total de documentos | 18 |
| Líneas totales de documentación | ~11,000 |
| Sprints completados | 4 |
| Tablas de BD documentadas | 15+ |
| Endpoints documentados | 50+ |
| Archivos de código creados | 25+ |

---

## 🔄 Historial de Actualizaciones

| Fecha | Actualización |
|-------|---------------|
| 2025-01-21 | ✅ Sprint 4 completado - OAuth 2.0 + API Pública |
| 2025-01-22 | ✅ Refactoring Frontend Fase 1 completado |
| 2025-01-20 | ✅ Sistema de API Connectors + Webhooks completado |
| 2025-01-17 | ✅ Sistema de Pattern Learning implementado |
| 2025-01-16 | ✅ Dimensiones a nivel documento implementadas |
| 2025-01-13 | ✅ Prompts GLOBAL + Fix crash backend |

---

## 📞 Contacto y Soporte

Para consultas sobre la documentación o el proyecto:
- **Repositorio:** Parse Rendiciones App
- **Última sesión:** 21 de Enero 2025
- **Estado del proyecto:** ✅ Sprint 4 completado al 100%

---

**Nota:** Este índice se actualiza después de cada sprint completado. Última actualización: Sprint 4 (21 Enero 2025).
