# API Pública - Parse Document Processing

Documentación completa de la API pública para procesamiento de documentos y sincronización de datos.

## 📋 Índice

1. [Autenticación](#autenticación)
2. [Rate Limiting](#rate-limiting)
3. [Endpoints de Procesamiento](#endpoints-de-procesamiento)
4. [Endpoints de Sincronización](#endpoints-de-sincronización)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Códigos de Error](#códigos-de-error)

---

## 🔐 Autenticación

Todos los endpoints (excepto `/health`) requieren autenticación mediante API Key.

### Obtener API Key

1. Ingresar a Parse → Sync Admin → API Keys
2. Crear nueva API Key con permisos adecuados
3. Copiar la API Key (se muestra solo una vez)

### Headers de Autenticación

**Opción 1: Header X-API-Key** (Recomendado)
```bash
X-API-Key: sk_live_abc123...
```

**Opción 2: Authorization Bearer**
```bash
Authorization: Bearer sk_live_abc123...
```

### Permisos de API Key

| Permiso | Descripción |
|---------|-------------|
| `parse` | Permite parsear documentos |
| `sync` | Permite sincronizar tablas maestras |
| `write` | Permite guardar documentos en BD |

---

## ⏱️ Rate Limiting

| Plan | Requests/minuto | Requests/hora |
|------|-----------------|---------------|
| Free | 10 | 100 |
| Pro | 60 | 1000 |
| Enterprise | 300 | 10000 |

**Headers de respuesta:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

---

## 📄 Endpoints de Procesamiento

### POST /api/v1/parse/document

Parsea un documento (PDF o imagen) y devuelve JSON estructurado SIN guardarlo en base de datos.

**Headers:**
```
X-API-Key: tu-api-key
Content-Type: multipart/form-data
```

**Body (multipart/form-data):**
```
file: archivo.pdf
tipoDocumento: "FACTURA_A" | "FACTURA_B" | "FACTURA_C" | "AUTO" (opcional)
```

**Response 200:**
```json
{
  "success": true,
  "documento": {
    "cabecera": {
      "tipoComprobante": "FACTURA_A",
      "puntoVenta": "0001",
      "numeroComprobante": "00012345",
      "fecha": "2025-01-15",
      "cuitProveedor": "30-12345678-9",
      "razonSocialProveedor": "Proveedor SA",
      "total": 12100.00,
      "subtotal": 10000.00,
      "iva": 2100.00,
      "cae": "12345678901234"
    },
    "items": [
      {
        "numeroLinea": 1,
        "descripcion": "Producto 1",
        "cantidad": 10,
        "precioUnitario": 1000.00,
        "subtotal": 10000.00
      }
    ],
    "impuestos": [
      {
        "tipo": "IVA 21%",
        "baseImponible": 10000.00,
        "tasa": 21.00,
        "importe": 2100.00
      }
    ],
    "modeloIA": "Claude Vision",
    "confianza": 0.95,
    "usedPattern": false
  },
  "metadata": {
    "processingTime": 2500,
    "fileSize": 245678,
    "mimeType": "application/pdf"
  }
}
```

**Ejemplo con cURL:**
```bash
curl -X POST https://api.parsedemo.axiomacloud.com/api/v1/parse/document \
  -H "X-API-Key: sk_live_abc123..." \
  -F "file=@factura.pdf" \
  -F "tipoDocumento=AUTO"
```

---

### POST /api/v1/parse/apply-rules

Aplica reglas de negocio a datos extraídos (clasificación de productos, asignación de cuentas, etc.).

**Headers:**
```
X-API-Key: tu-api-key
Content-Type: application/json
```

**Body:**
```json
{
  "documento": {
    "cabecera": {...},
    "items": [...],
    "impuestos": [...]
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "documento": {
    "cabecera": {
      ...
      "cuentaContable": "1101010101"
    },
    "items": [
      {
        ...
        "tipoProducto": "SERVICIO",
        "categoria": "HOSTING",
        "cuentaContable": "5101020301"
      }
    ],
    "impuestos": [
      {
        ...
        "cuentaContable": "1105020101"
      }
    ]
  },
  "reglas_aplicadas": 15
}
```

---

### POST /api/v1/parse/full

Parsea documento + aplica reglas (combina `/document` y `/apply-rules`).

**Ejemplo:**
```bash
curl -X POST https://api.parsedemo.axiomacloud.com/api/v1/parse/full \
  -H "X-API-Key: sk_live_abc123..." \
  -F "file=@factura.pdf"
```

---

### POST /api/v1/parse/save

Parsea + aplica reglas + guarda en base de datos.

**Requiere permiso:** `parse` + `write`

**Response 200:**
```json
{
  "success": true,
  "documentoId": "doc_abc123",
  "documento": {...},
  "saved": true
}
```

---

### GET /api/v1/parse/stats

Obtiene estadísticas de uso de la API Key.

**Response 200:**
```json
{
  "success": true,
  "stats": {
    "totalDocumentos": 1523,
    "documentosHoy": 45,
    "documentosMes": 890,
    "ahorroCostoIA": {
      "porcentaje": 67.5,
      "ahorradoUSD": 125.30
    }
  }
}
```

---

## 🔄 Endpoints de Sincronización

Endpoints para obtener datos maestros del tenant (proveedores, productos, cuentas, etc.).

**Requiere permiso:** `sync`

### Parámetros Comunes (Query String)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `limit` | int | 100 | Registros por página (max: 1000) |
| `offset` | int | 0 | Offset para paginación |
| `search` | string | - | Búsqueda por texto |
| `activo` | boolean | - | Filtrar por estado activo |
| `updatedSince` | ISO date | - | Solo registros actualizados desde fecha |

---

### GET /api/v1/parse/sync/proveedores

Obtiene lista de proveedores.

**Ejemplo:**
```bash
curl "https://api.parsedemo.axiomacloud.com/api/v1/parse/sync/proveedores?limit=50&activo=true" \
  -H "X-API-Key: sk_live_abc123..."
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prov_123",
      "razonSocial": "Proveedor SA",
      "cuit": "30-12345678-9",
      "email": "contacto@proveedor.com",
      "telefono": "+54 11 1234-5678",
      "direccion": "Av. Ejemplo 123",
      "activo": true,
      "lastExportedAt": null,
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### GET /api/v1/parse/sync/productos

Obtiene lista de productos.

**Ejemplo:**
```bash
curl "https://api.parsedemo.axiomacloud.com/api/v1/parse/sync/productos?search=hosting" \
  -H "X-API-Key: sk_live_abc123..."
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_456",
      "codigo": "PROD001",
      "valor": "Hosting Mensual",
      "descripcion": "Servicio de hosting cloud",
      "activo": true,
      "lastExportedAt": null,
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-10T09:15:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### GET /api/v1/parse/sync/cuentas-contables

Obtiene lista de cuentas contables.

**Ejemplo:**
```bash
curl "https://api.parsedemo.axiomacloud.com/api/v1/parse/sync/cuentas-contables" \
  -H "X-API-Key: sk_live_abc123..."
```

---

### GET /api/v1/parse/sync/centros-costo

Obtiene lista de centros de costo.

**Ejemplo:**
```bash
curl "https://api.parsedemo.axiomacloud.com/api/v1/parse/sync/centros-costo" \
  -H "X-API-Key: sk_live_abc123..."
```

---

### GET /api/v1/parse/sync/documentos

Obtiene lista de documentos procesados.

**Parámetros adicionales:**
- `tipoComprobante`: filtrar por tipo (FACTURA_A, FACTURA_B, etc.)
- `proveedorId`: filtrar por proveedor
- `exportedOnly`: solo documentos exportados (true/false)

**Ejemplo:**
```bash
curl "https://api.parsedemo.axiomacloud.com/api/v1/parse/sync/documentos?updatedSince=2025-01-15T00:00:00Z&exportedOnly=true" \
  -H "X-API-Key: sk_live_abc123..."
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_789",
      "numeroComprobante": "0001-00012345",
      "tipoComprobanteExtraido": "FACTURA_A",
      "fechaComprobante": "2025-01-15",
      "totalComprobante": 12100.00,
      "exportado": true,
      "proveedor": {
        "razonSocial": "Proveedor SA",
        "cuit": "30-12345678-9"
      },
      "documento_lineas": [...],
      "documento_impuestos": [...]
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## 💡 Ejemplos de Uso

### Sincronización Incremental (Recomendado)

Obtener solo datos actualizados desde la última sincronización:

```bash
# Guardar timestamp de última sync
LAST_SYNC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Sincronizar proveedores nuevos/actualizados
curl "https://api.parsedemo.axiomacloud.com/api/v1/parse/sync/proveedores?updatedSince=$LAST_SYNC" \
  -H "X-API-Key: sk_live_abc123..."
```

---

### Procesamiento en Lote

```bash
#!/bin/bash

API_KEY="sk_live_abc123..."
FILES_DIR="/path/to/facturas"

for file in $FILES_DIR/*.pdf; do
  echo "Procesando: $file"

  curl -X POST https://api.parsedemo.axiomacloud.com/api/v1/parse/save \
    -H "X-API-Key: $API_KEY" \
    -F "file=@$file" \
    -o "result_$(basename $file).json"

  sleep 1  # Respetar rate limit
done
```

---

### Uso con Python

```python
import requests

API_KEY = 'sk_live_abc123...'
BASE_URL = 'https://api.parsedemo.axiomacloud.com/api/v1/parse'

headers = {
    'X-API-Key': API_KEY
}

# Parsear documento
with open('factura.pdf', 'rb') as file:
    files = {'file': file}
    response = requests.post(
        f'{BASE_URL}/document',
        headers=headers,
        files=files
    )

    if response.status_code == 200:
        documento = response.json()['documento']
        print(f"Total: ${documento['cabecera']['total']}")
    else:
        print(f"Error: {response.json()['error']}")

# Sincronizar proveedores
params = {
    'limit': 100,
    'activo': 'true',
    'updatedSince': '2025-01-15T00:00:00Z'
}

response = requests.get(
    f'{BASE_URL}/sync/proveedores',
    headers=headers,
    params=params
)

if response.status_code == 200:
    data = response.json()
    print(f"Total proveedores: {data['pagination']['total']}")
    for proveedor in data['data']:
        print(f"- {proveedor['razonSocial']} ({proveedor['cuit']})")
```

---

### Uso con JavaScript/Node.js

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_KEY = 'sk_live_abc123...';
const BASE_URL = 'https://api.parsedemo.axiomacloud.com/api/v1/parse';

const headers = {
  'X-API-Key': API_KEY
};

// Parsear documento
async function parseDocument(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const response = await axios.post(`${BASE_URL}/document`, form, {
      headers: {
        ...headers,
        ...form.getHeaders()
      }
    });

    console.log('Documento parseado:', response.data.documento);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Sincronizar productos
async function syncProductos() {
  try {
    const response = await axios.get(`${BASE_URL}/sync/productos`, {
      headers,
      params: {
        limit: 100,
        activo: 'true'
      }
    });

    console.log(`Total productos: ${response.data.pagination.total}`);
    response.data.data.forEach(producto => {
      console.log(`- ${producto.codigo}: ${producto.valor}`);
    });

    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Ejecutar
parseDocument('./factura.pdf');
syncProductos();
```

---

## ⚠️ Códigos de Error

| Código | Mensaje | Solución |
|--------|---------|----------|
| 401 | API Key requerida | Agregar header X-API-Key |
| 401 | API Key inválida | Verificar API Key |
| 403 | API Key desactivada | Contactar administrador |
| 403 | Sin permiso "parse" | Habilitar permiso en API Key |
| 403 | Sin permiso "sync" | Habilitar permiso en API Key |
| 429 | Rate limit excedido | Esperar antes de reintentar |
| 400 | Campo "file" requerido | Enviar archivo en multipart |
| 500 | Error interno | Reintentar más tarde |

---

## 📚 Recursos Adicionales

- **Base URL Producción:** `https://api.parsedemo.axiomacloud.com`
- **Base URL Desarrollo:** `http://localhost:5100`
- **Ruta:** `/api/v1/parse`
- **Formato:** JSON
- **Encoding:** UTF-8

### Headers Recomendados

```
X-API-Key: tu-api-key
Content-Type: application/json  (o multipart/form-data para archivos)
Accept: application/json
```

### Webhooks (Próximamente)

```json
{
  "url": "https://tu-app.com/webhooks/parse",
  "events": ["document.processed", "document.failed"],
  "secret": "whsec_..."
}
```

---

## 🔒 Seguridad

1. **Nunca compartir API Keys** en código fuente público
2. **Usar HTTPS** siempre en producción
3. **Rotar API Keys** cada 90 días
4. **Monitorear uso** desde el dashboard
5. **Limitar permisos** solo a los necesarios

---

## 🆘 Soporte

- **Email:** soporte@axiomacloud.com
- **Slack:** #api-support
- **Documentación:** https://docs.parsedemo.axiomacloud.com

---

**Última actualización:** 2025-01-21
**Versión API:** 1.0.0
