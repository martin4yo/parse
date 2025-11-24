# 🌐 API Pública de Parse - Especificación

**Fecha:** 21 de Enero 2025
**Versión:** 1.0.0
**Estado:** Diseño Aprobado - Pendiente de Desarrollo

---

## 📋 Resumen Ejecutivo

### Objetivo

Exponer una **API REST pública** que permita a sistemas externos:
- **Consultar** documentos procesados en Parse
- **Marcar** documentos como exportados desde el sistema externo
- **Descargar** archivos originales (PDFs/imágenes)
- **Integrarse** sin necesidad de acceso directo a la base de datos

### Alcance Inicial

✅ **Incluido (Fase 1):**
- Autenticación OAuth 2.0 (Client Credentials)
- Endpoints GET para consultar documentos
- Endpoint POST para marcar como exportado
- Endpoint GET para descargar archivos
- Rate limiting configurable por plan
- Gestión de API clients (UI)
- Logs completos de requests

❌ **No incluido (futuro):**
- Webhooks (eventos push)
- Escritura completa (crear/modificar documentos)
- GraphQL
- Endpoints de configuración

---

## 🏗️ Arquitectura

### Diagrama Completo del Sistema

```
┌─────────────────────────────────────────────────┐
│              PARSE APP                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐    ┌──────────────┐         │
│  │ Conector API │    │ SQL Server   │         │
│  │ (Bidireccional)   │ (Legacy)     │         │
│  │ - PULL       │    │ - Sync       │         │
│  │ - PUSH       │    │              │         │
│  └──────┬───────┘    └──────┬───────┘         │
│         │                   │                  │
│         ▼                   ▼                  │
│  ┌────────────────────────────────┐           │
│  │  DOCUMENTOS_PROCESADOS (BD)    │           │
│  └────────────┬───────────────────┘           │
│               │                                │
│               ▼                                │
│  ┌────────────────────────────────┐           │
│  │   API PÚBLICA v1 (REST)        │ ← NUEVO  │
│  │                                 │           │
│  │  - GET /documents               │           │
│  │  - POST /mark-exported          │           │
│  │  - GET /file                    │           │
│  └────────────┬───────────────────┘           │
└───────────────┼────────────────────────────────┘
                │
                │ OAuth 2.0 + API Key
                │
       ┌────────▼────────┐
       │ Sistema Externo │
       │ (ERP/Contable)  │
       │ hace GET/POST   │
       └─────────────────┘
```

---

## 🔐 Autenticación

### OAuth 2.0 - Client Credentials Flow

**Flujo:**

```
1. Sistema Externo solicita token
   POST /api/v1/auth/token
   {
     "client_id": "client_abc123",
     "client_secret": "secret_xyz789",
     "grant_type": "client_credentials"
   }

2. Parse valida credenciales y devuelve token
   {
     "access_token": "eyJhbGc...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "scope": "documents:read documents:write"
   }

3. Sistema Externo usa token en requests
   GET /api/v1/documents
   Authorization: Bearer eyJhbGc...
```

### Scopes Disponibles

| Scope | Descripción | Permisos |
|---|---|---|
| `documents:read` | Consultar documentos | GET /documents, GET /documents/:id |
| `documents:write` | Marcar como exportado | POST /documents/:id/mark-exported |
| `files:read` | Descargar archivos | GET /documents/:id/file |

---

## 🗄️ Modelo de Datos

### Tabla: `api_public_clients`

Almacena clientes autorizados a consumir la API pública.

```sql
CREATE TABLE api_public_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenantId UUID NOT NULL,

  -- Identificación
  nombre VARCHAR(100) NOT NULL,           -- "Sistema Contable XYZ"
  descripcion TEXT,

  -- Credenciales OAuth 2.0
  clientId VARCHAR(100) UNIQUE NOT NULL,  -- Generado automáticamente
  clientSecret VARCHAR(255) NOT NULL,     -- Hash bcrypt

  -- Permisos
  scopes JSON NOT NULL DEFAULT '["documents:read"]',

  -- Rate limiting (según plan del tenant)
  requestsPerMinute INT,                  -- NULL = usar default del plan
  requestsPerDay INT,                     -- NULL = usar default del plan

  -- Estado
  activo BOOLEAN DEFAULT true,

  -- IP Whitelist (opcional)
  ipWhitelist TEXT[],                     -- ["192.168.1.1", "10.0.0.0/8"]

  -- Metadata
  ultimoUso TIMESTAMP,
  totalRequests BIGINT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy UUID,

  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,

  @@index([tenantId]),
  @@index([clientId]),
  @@index([activo])
);
```

---

### Tabla: `api_request_logs`

Historial de requests a la API pública.

```sql
CREATE TABLE api_request_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clientId UUID NOT NULL,
  tenantId UUID NOT NULL,

  -- Request
  method VARCHAR(10) NOT NULL,            -- GET, POST, PUT, DELETE
  endpoint VARCHAR(500) NOT NULL,         -- /api/v1/documents
  queryParams JSON,
  requestBody JSON,

  -- Response
  statusCode INT NOT NULL,
  responseTime INT,                       -- Milisegundos

  -- Error tracking
  success BOOLEAN NOT NULL,
  errorMessage TEXT,

  -- IP y User Agent
  ipAddress VARCHAR(45),                  -- IPv4 o IPv6
  userAgent TEXT,

  -- Timestamp
  requestedAt TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (clientId) REFERENCES api_public_clients(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,

  @@index([clientId, requestedAt]),
  @@index([tenantId, requestedAt]),
  @@index([statusCode]),
  @@index([success])
);
```

---

### Tabla: `planes` (ampliar)

Agregar límites de rate limiting por plan.

```sql
ALTER TABLE planes ADD COLUMN IF NOT EXISTS apiRequestsPerMinute INT DEFAULT 60;
ALTER TABLE planes ADD COLUMN IF NOT EXISTS apiRequestsPerDay INT DEFAULT 10000;
```

**Valores sugeridos:**

| Plan | Requests/Minuto | Requests/Día |
|---|---|---|
| **Free** | 10 | 1,000 |
| **Basic** | 60 | 10,000 |
| **Pro** | 300 | 100,000 |
| **Enterprise** | 1000 | 1,000,000 |

---

## 🛣️ Endpoints de la API

### Base URL

```
Producción: https://api.parsedemo.axiomacloud.com/v1
Desarrollo: http://localhost:5100/api/v1
```

---

## 📡 1. Autenticación

### POST `/api/v1/auth/token`

Obtener access token para usar la API.

**Request:**
```json
POST /api/v1/auth/token
Content-Type: application/json

{
  "client_id": "client_abc123xyz",
  "client_secret": "secret_def456uvw",
  "grant_type": "client_credentials"
}
```

**Response 200 OK:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "documents:read documents:write files:read"
}
```

**Response 401 Unauthorized:**
```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

---

### POST `/api/v1/auth/refresh`

Refrescar un token expirado (futuro).

---

## 📄 2. Documentos

### GET `/api/v1/documents`

Listar documentos procesados.

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Query Parameters:**

| Parámetro | Tipo | Descripción | Default |
|---|---|---|---|
| `status` | string | completado, error, procesando | - |
| `exportado` | boolean | true, false | - |
| `fechaDesde` | date | YYYY-MM-DD | - |
| `fechaHasta` | date | YYYY-MM-DD | - |
| `tipoComprobante` | string | FACTURA A, FACTURA B, etc. | - |
| `cuit` | string | Filtrar por CUIT proveedor | - |
| `limit` | int | Máximo 1000 | 100 |
| `offset` | int | Para paginación | 0 |
| `sort` | string | fechaExtraida, importeExtraido | fechaProcesamiento |
| `order` | string | asc, desc | desc |

**Ejemplo Request:**
```bash
GET /api/v1/documents?status=completado&exportado=false&limit=50
Authorization: Bearer eyJhbGc...
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "599ee577-983e-44ca-b2c5-c2cb13a30f02",
        "nombreArchivo": "factura-001.pdf",
        "tipoArchivo": "application/pdf",
        "fechaProcesamiento": "2025-01-20T10:30:00Z",
        "estadoProcesamiento": "completado",

        "fechaExtraida": "2025-01-15",
        "importeExtraido": 1000.00,
        "cuitExtraido": "20-12345678-9",
        "numeroComprobanteExtraido": "00001-00000123",
        "razonSocialExtraida": "Proveedor Test SA",
        "tipoComprobanteExtraido": "FACTURA A",
        "netoGravadoExtraido": 800.00,
        "exentoExtraido": 0.00,
        "impuestosExtraido": 200.00,
        "caeExtraido": "12345678901234",

        "exportado": false,
        "externalSystemId": null,
        "lastExportedAt": null,

        "validationErrors": {
          "summary": {
            "total": 0,
            "bloqueantes": 0,
            "errores": 0,
            "warnings": 0
          }
        },

        "urls": {
          "self": "https://api.parsedemo.com/v1/documents/599ee577-983e-44ca-b2c5-c2cb13a30f02",
          "file": "https://api.parsedemo.com/v1/documents/599ee577-983e-44ca-b2c5-c2cb13a30f02/file",
          "lineas": "https://api.parsedemo.com/v1/documents/599ee577-983e-44ca-b2c5-c2cb13a30f02/lineas",
          "impuestos": "https://api.parsedemo.com/v1/documents/599ee577-983e-44ca-b2c5-c2cb13a30f02/impuestos"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true,
      "nextUrl": "https://api.parsedemo.com/v1/documents?offset=50&limit=50"
    }
  }
}
```

**Response 401 Unauthorized:**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired access token"
}
```

**Response 429 Too Many Requests:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit of 60 requests per minute exceeded",
  "retryAfter": 45
}
```

---

### GET `/api/v1/documents/:id`

Obtener detalles de un documento específico.

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    // ... mismo formato que en listado pero con más detalles
    "observaciones": "Documento procesado correctamente",
    "modeloIA": "gemini-2.5-flash",
    "reglasAplicadas": true,
    "fechaReglasAplicadas": "2025-01-20T10:35:00Z"
  }
}
```

**Response 404 Not Found:**
```json
{
  "error": "not_found",
  "message": "Document not found"
}
```

---

### GET `/api/v1/documents/:id/lineas`

Obtener líneas de un documento (items de factura).

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "lineas": [
      {
        "id": "f1460e51-3aa9-4874-8f97-8b088c9fe4ab",
        "numero": 1,
        "descripcion": "Producto 1",
        "cantidad": 2.000,
        "unidad": "UN",
        "precioUnitario": 100.00,
        "subtotal": 200.00,
        "alicuotaIva": 21.00,
        "importeIva": 42.00,
        "totalLinea": 242.00,
        "cuentaContable": "5101020301",
        "codigoDimension": "CC001",
        "subcuenta": "MARKETING"
      }
    ]
  }
}
```

---

### GET `/api/v1/documents/:id/impuestos`

Obtener impuestos de un documento.

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "impuestos": [
      {
        "id": "imp-123",
        "tipo": "IVA",
        "descripcion": "IVA 21%",
        "alicuota": 21.00,
        "baseImponible": 800.00,
        "importe": 168.00,
        "cuentaContable": "1080101"
      }
    ]
  }
}
```

---

### POST `/api/v1/documents/:id/mark-exported`

Marcar un documento como exportado desde el sistema externo.

**Headers:**
```
Authorization: Bearer eyJhbGc...
Content-Type: application/json
```

**Request:**
```json
{
  "externalSystemId": "ERP-INV-12345",
  "exportedAt": "2025-01-21T10:00:00Z",
  "notes": "Importado exitosamente a sistema contable"
}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Document marked as exported",
  "data": {
    "id": "599ee577-983e-44ca-b2c5-c2cb13a30f02",
    "exportado": true,
    "externalSystemId": "ERP-INV-12345",
    "lastExportedAt": "2025-01-21T10:00:00Z",
    "exportConfigId": "api-client-abc123"
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": "already_exported",
  "message": "Document was already marked as exported",
  "data": {
    "exportedAt": "2025-01-20T15:30:00Z",
    "externalSystemId": "ERP-INV-12340"
  }
}
```

---

### GET `/api/v1/documents/:id/file`

Descargar archivo original (PDF o imagen).

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response 200 OK:**
```
Content-Type: application/pdf (o image/jpeg, image/png, etc.)
Content-Disposition: attachment; filename="factura-001.pdf"
Content-Length: 245678

[Binary file content]
```

**Response 404 Not Found:**
```json
{
  "error": "file_not_found",
  "message": "Original file not found on server"
}
```

---

## 🚦 Rate Limiting

### Implementación

**Headers de Rate Limiting:**
```
X-RateLimit-Limit: 60         # Requests permitidos por ventana
X-RateLimit-Remaining: 45     # Requests restantes
X-RateLimit-Reset: 1705836000 # Unix timestamp cuando resetea
```

**Algoritmo:** Token Bucket (permite bursts)

**Límites:**
- Por defecto del plan del tenant
- Configurable por API client (override)
- Ventanas: 1 minuto y 24 horas

**Cuando se excede:**
```json
HTTP 429 Too Many Requests

{
  "error": "rate_limit_exceeded",
  "message": "Rate limit of 60 requests per minute exceeded",
  "retryAfter": 45,
  "limits": {
    "perMinute": 60,
    "perDay": 10000,
    "remaining": {
      "minute": 0,
      "day": 8542
    }
  }
}
```

---

## 🔒 Seguridad

### Mejores Prácticas

1. **HTTPS Obligatorio**
   - Toda comunicación cifrada
   - Certificado válido

2. **Client Secrets**
   - Hasheados con bcrypt (10 rounds)
   - Nunca se muestran completos en UI

3. **Access Tokens**
   - JWT firmados con RS256
   - Expiración: 1 hora
   - Incluyen: clientId, tenantId, scopes

4. **IP Whitelist (opcional)**
   - Restringir acceso por IP
   - Soporta rangos CIDR

5. **Logs Completos**
   - Todos los requests se registran
   - Auditoría completa
   - Detección de abusos

---

## 📊 Monitoreo y Alertas

### Métricas a Trackear

- Requests por minuto/hora/día
- Tasa de errores (4xx, 5xx)
- Latencia promedio
- Clients más activos
- Endpoints más usados

### Alertas

- Rate limit excedido > 10 veces en 1 hora
- Tasa de errores > 5%
- Latencia > 2 segundos
- Intentos de autenticación fallidos > 5 en 5 minutos

---

## 🎨 UI de Gestión

### Página: `/api-clients`

**Funcionalidades:**
- ✅ Listar API clients
- ✅ Crear nuevo client (genera clientId y secret)
- ✅ Ver/copiar client secret (solo al crear)
- ✅ Editar permisos (scopes)
- ✅ Configurar rate limits custom
- ✅ Activar/desactivar client
- ✅ Ver estadísticas de uso
- ✅ Ver logs de requests

**Mock UI:**
```
┌────────────────────────────────────────────────┐
│  API Clients                     [+ Nuevo]     │
├────────────────────────────────────────────────┤
│  Cliente           Requests    Estado  Acción  │
│  ─────────────────────────────────────────────│
│  📱 Sistema ERP     1,254/día   🟢     [...]  │
│  💼 Contabilidad      234/día   🟢     [...]  │
│  🔧 App Móvil          45/día   🔴     [...]  │
└────────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Endpoints de Prueba

**Sandbox:** `https://sandbox-api.parsedemo.com/v1`

- Datos de prueba pre-cargados
- Sin límites de rate limiting
- Credenciales demo disponibles

### Ejemplo con cURL

```bash
# 1. Obtener token
TOKEN=$(curl -X POST https://api.parsedemo.com/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"demo","client_secret":"demo123","grant_type":"client_credentials"}' \
  | jq -r '.access_token')

# 2. Consultar documentos
curl -X GET "https://api.parsedemo.com/v1/documents?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# 3. Marcar como exportado
curl -X POST https://api.parsedemo.com/v1/documents/DOC_ID/mark-exported \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"externalSystemId":"ERP-123","notes":"Importado OK"}' \
  | jq
```

---

## 📅 Plan de Implementación

### Sprint 4: API Pública Básica (1 semana)

**Backend:**
- ✅ Tabla `api_public_clients`
- ✅ Tabla `api_request_logs`
- ✅ Ampliar tabla `planes` con rate limits
- ✅ Middleware de autenticación OAuth
- ✅ Middleware de rate limiting
- ✅ Endpoints: `/auth/token`, `/documents`, `/documents/:id`
- ✅ Logs de requests

**Frontend:**
- ✅ Página `/api-clients` (listar)
- ✅ Modal crear API client
- ✅ Modal ver detalles y stats
- ✅ UI copiar client_id y secret

**Testing:**
- ✅ Tests unitarios de auth
- ✅ Tests de rate limiting
- ✅ Tests de endpoints
- ✅ Documentación API (Postman collection)

---

### Sprint 5: Endpoints Avanzados (3 días)

**Backend:**
- ✅ POST `/documents/:id/mark-exported`
- ✅ GET `/documents/:id/file`
- ✅ GET `/documents/:id/lineas`
- ✅ GET `/documents/:id/impuestos`

**Frontend:**
- ✅ Ver logs de requests en detalle
- ✅ Gráficos de uso

---

## 🔗 Referencias

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [REST API Best Practices](https://restfulapi.net/)
- [Rate Limiting Strategies](https://www.nginx.com/blog/rate-limiting-nginx/)
- [JWT.io](https://jwt.io/)

---

**Última actualización:** 21 de Enero 2025
**Autor:** Claude Code
**Estado:** ✅ Diseño aprobado - Listo para Sprint 4
