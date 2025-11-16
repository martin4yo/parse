# Parse API - Documentación Completa

## 📋 Índice

1. [Introducción](#introducción)
2. [Autenticación](#autenticación)
3. [Endpoints Disponibles](#endpoints-disponibles)
4. [Ejemplos de Uso](#ejemplos-de-uso)
5. [Códigos de Respuesta](#códigos-de-respuesta)
6. [Limitaciones](#limitaciones)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Introducción

Parse API permite a aplicaciones externas:
- **Parsear documentos** (facturas, recibos, comprobantes) y obtener datos estructurados en JSON
- **Aplicar reglas de negocio** configuradas por tenant a documentos parseados
- **Procesamiento completo** (parse + reglas) en una sola llamada

### Características

✅ **Multi-tenant**: Cada API key pertenece a un tenant específico
✅ **Reglas personalizadas**: Aplica reglas globales y específicas del tenant
✅ **IA Avanzada**: Usa Claude Vision, Gemini 2.5, o Document AI según configuración
✅ **Procesamiento flexible**: Parse sin guardar O guardar en plataforma
✅ **Stateless**: Cada request es independiente
✅ **RESTful**: APIs HTTP estándar con JSON

---

## 🔐 Autenticación

Todas las APIs requieren autenticación mediante **API Keys**.

### Obtener una API Key

1. Ingresar a Parse como usuario del tenant
2. Ir a **Configuración → API Keys de Sincronización**
3. Crear nueva API key con permisos:
   - `parse`: Para parsear documentos (sin guardar en BD)
   - `applyRules`: Para aplicar reglas de negocio
   - `saveDocs`: Para guardar documentos procesados en la plataforma

### Usar la API Key

Incluir en **header** de cada request:

```http
X-API-Key: tu-api-key-aqui
```

O alternativamente:

```http
Authorization: Bearer tu-api-key-aqui
```

### Estructura de API Key

```json
{
  "id": "uuid",
  "tenantId": "uuid-del-tenant",
  "nombre": "API Key Producción",
  "key": "hash-sha256-de-la-key",
  "keyPreview": "sk_live_AbCd...XyZ",
  "permisos": {
    "parse": true,
    "applyRules": true,
    "saveDocs": true,
    "sync": false
  },
  "activo": true,
  "expiraEn": null
}
```

---

## 📡 Endpoints Disponibles

### Base URL

**Desarrollo**: `http://localhost:5100/api/v1/parse`
**Producción**: `https://parsedemo.axiomacloud.com/api/v1/parse`

---

### 1. POST /document

Parsear un documento y obtener datos estructurados.

#### Request

**Headers**:
```http
X-API-Key: tu-api-key
Content-Type: multipart/form-data
```

**Body** (form-data):
```
file: <archivo PDF o imagen>
tipoDocumento: "AUTO" | "FACTURA_A" | "FACTURA_B" | "FACTURA_C" (opcional)
```

#### Response (200 OK)

```json
{
  "success": true,
  "documento": {
    "cabecera": {
      "tipoComprobante": "FACTURA_A",
      "puntoVenta": "0003",
      "numeroComprobante": "00012345",
      "fecha": "2025-01-15",
      "cuitEmisor": "20-12345678-9",
      "razonSocialEmisor": "Proveedor SA",
      "total": 12100.00,
      "subtotal": 10000.00,
      "iva": 2100.00,
      "exento": 0,
      "ordenCompra": "OC-2025-001",
      "cae": "72345678901234",
      "moneda": "ARS"
    },
    "items": [
      {
        "numero": 1,
        "descripcion": "Producto ejemplo",
        "codigoProducto": "PROD-001",
        "cantidad": 2,
        "unidad": "UN",
        "precioUnitario": 5000.00,
        "subtotal": 10000.00,
        "alicuotaIva": 21,
        "importeIva": 2100.00,
        "totalLinea": 12100.00
      }
    ],
    "impuestos": [
      {
        "tipo": "IVA",
        "descripcion": "IVA 21%",
        "alicuota": 21,
        "baseImponible": 10000.00,
        "importe": 2100.00
      }
    ]
  },
  "metadata": {
    "tipoDocumento": "FACTURA_A",
    "modeloIA": "claude-3-5-sonnet",
    "confianza": 0.95,
    "processingTimeMs": 2341
  }
}
```

#### Tipos de Documento Soportados

- `AUTO`: Detección automática (recomendado)
- `FACTURA_A`: Factura A (AFIP)
- `FACTURA_B`: Factura B (AFIP)
- `FACTURA_C`: Factura C (AFIP)
- `FACTURA_E`: Factura E (exportación)
- `NOTA_CREDITO_A`: Nota de crédito A
- `NOTA_CREDITO_B`: Nota de crédito B
- `DESPACHO_ADUANA`: Despacho de importación

#### Formatos de Archivo Soportados

- **PDF**: `.pdf`
- **Imágenes**: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`, `.webp`
- **Tamaño máximo**: 10 MB

---

### 2. POST /apply-rules

Aplicar reglas de negocio a un documento ya parseado.

#### Request

**Headers**:
```http
X-API-Key: tu-api-key
Content-Type: application/json
```

**Body** (JSON):
```json
{
  "documento": {
    "cabecera": {
      "tipoComprobante": "FACTURA_A",
      "fecha": "2025-01-15",
      "cuitEmisor": "20-12345678-9",
      "total": 12100.00
    },
    "items": [
      {
        "descripcion": "Bandeja de acero inoxidable",
        "cantidad": 2,
        "precioUnitario": 5000.00,
        "subtotal": 10000.00
      }
    ],
    "impuestos": [
      {
        "tipo": "IVA",
        "alicuota": 21,
        "importe": 2100.00
      }
    ]
  },
  "tipoReglas": "TRANSFORMACION"
}
```

**Parámetros**:
- `documento`: Objeto con estructura parseada
- `tipoReglas`: (opcional) `"TRANSFORMACION"` | `"VALIDACION"`, default: `"TRANSFORMACION"`

#### Response (200 OK)

```json
{
  "success": true,
  "documentoTransformado": {
    "cabecera": {
      "tipoComprobante": "FACTURA_A",
      "fecha": "2025-01-15",
      "cuitEmisor": "20-12345678-9",
      "total": 12100.00,
      "cuentaContable": "1105020101",
      "codigoProveedor": "PROV-12345",
      "centroCostos": "CC-VENTAS"
    },
    "items": [
      {
        "descripcion": "Bandeja de acero inoxidable",
        "cantidad": 2,
        "precioUnitario": 5000.00,
        "subtotal": 10000.00,
        "codigoProducto": "BANDEJA-001",
        "categoria": "INSUMOS",
        "cuentaContable": "5101010101"
      }
    ],
    "impuestos": [
      {
        "tipo": "IVA",
        "alicuota": 21,
        "importe": 2100.00,
        "cuentaContable": "2105010101"
      }
    ]
  },
  "reglasAplicadas": [
    {
      "codigo": "REGLA_CUENTA_PROVEEDOR",
      "nombre": "Asignar cuenta por CUIT",
      "tipo": "TRANSFORMACION",
      "esGlobal": false,
      "prioridad": 10
    },
    {
      "codigo": "PRODUCTO_BANDEJAS",
      "nombre": "Clasificar producto Bandejas",
      "tipo": "TRANSFORMACION",
      "esGlobal": true,
      "prioridad": 20
    }
  ],
  "estadisticas": {
    "totalReglasCargadas": 15,
    "reglasEjecutadas": 2,
    "itemsProcesados": 1,
    "impuestosProcesados": 1,
    "processingTimeMs": 543
  }
}
```

#### Tipos de Reglas

**TRANSFORMACION**:
- Agregan campos calculados
- Buscan códigos en tablas maestras
- Clasifican automáticamente
- Usan IA para lookups inteligentes

**VALIDACION**:
- Validan formato de campos
- Verifican rangos de valores
- Comprueban consistencia de datos

---

### 3. POST /save

Guardar documento procesado en la base de datos de la plataforma.

**Requiere permiso**: `saveDocs`

#### Request

**Headers**:
```http
X-API-Key: tu-api-key
Content-Type: multipart/form-data
```

**Body** (form-data):
```
file: <archivo PDF o imagen>
tipoDocumento: "AUTO" | "FACTURA_A" | "FACTURA_B" | "FACTURA_C" (opcional)
aplicarReglas: "true" | "false" (opcional, default: false)
metadata: JSON string con metadata adicional (opcional)
```

#### Response (201 Created)

```json
{
  "success": true,
  "documento": {
    "id": "uuid-del-documento",
    "nombreArchivo": "factura_enero.pdf",
    "tipoDocumento": "FACTURA_A",
    "estadoProcesamiento": "completado",
    "fechaProcesamiento": "2025-01-15T10:30:00.000Z",
    "cabecera": {
      "tipoComprobante": "FACTURA_A",
      "puntoVenta": "0003",
      "numeroComprobante": "00012345",
      "fecha": "2025-01-15",
      "cuitEmisor": "20-12345678-9",
      "total": 12100.00
    },
    "items": [
      {
        "numero": 1,
        "descripcion": "Producto ejemplo",
        "cantidad": 2,
        "precioUnitario": 5000.00,
        "totalLinea": 12100.00
      }
    ],
    "impuestos": [
      {
        "tipo": "IVA",
        "alicuota": 21,
        "importe": 2100.00
      }
    ]
  },
  "metadata": {
    "processingTimeMs": 2543,
    "modeloIA": "claude-3-5-sonnet",
    "confianza": 0.95
  },
  "message": "Documento guardado exitosamente"
}
```

**Con reglas aplicadas** (`aplicarReglas=true`):

```json
{
  "success": true,
  "documento": { /* ... */ },
  "documentoTransformado": {
    "cabecera": { /* con campos agregados por reglas */ },
    "items": [ /* con clasificación */ ],
    "impuestos": [ /* con cuentas contables */ ]
  },
  "reglasAplicadas": [
    {
      "codigo": "REGLA_PRODUCTO_IA",
      "nombre": "Clasificar productos con IA"
    }
  ],
  "metadata": { /* ... */ },
  "message": "Documento guardado exitosamente"
}
```

#### Características

✅ El documento queda guardado en la plataforma
✅ Visible en la sección "Parse" de la aplicación web
✅ Se puede aplicar reglas de negocio antes de guardar
✅ Metadata personalizada se puede agregar
✅ Retorna ID del documento para futuras referencias

---

### 4. POST /full

Procesamiento completo: parsear + aplicar reglas en una sola llamada (sin guardar en BD).

#### Request

**Headers**:
```http
X-API-Key: tu-api-key
Content-Type: multipart/form-data
```

**Body** (form-data):
```
file: <archivo PDF o imagen>
tipoDocumento: "AUTO" | "FACTURA_A" | ... (opcional)
tipoReglas: "TRANSFORMACION" | "VALIDACION" (opcional)
aplicarReglas: "true" | "false" (opcional, default: true)
```

#### Response (200 OK)

```json
{
  "success": true,
  "documentoParsed": {
    "cabecera": { /* datos originales parseados */ },
    "items": [ /* items originales */ ],
    "impuestos": [ /* impuestos originales */ ]
  },
  "documentoTransformado": {
    "cabecera": { /* con campos agregados por reglas */ },
    "items": [ /* con clasificación y códigos */ ],
    "impuestos": [ /* con cuentas contables */ ]
  },
  "reglasAplicadas": [
    {
      "codigo": "REGLA_X",
      "nombre": "Nombre de la regla",
      "tipo": "TRANSFORMACION",
      "esGlobal": true
    }
  ],
  "metadata": {
    "tipoDocumento": "FACTURA_A",
    "modeloIA": "claude-3-5-sonnet",
    "parseTimeMs": 2341,
    "rulesTimeMs": 543,
    "totalTimeMs": 2884
  },
  "estadisticas": {
    "reglasEjecutadas": 3
  }
}
```

**Ventajas**:
- Un solo request para todo el flujo
- Más eficiente en términos de latencia
- Recibe tanto datos originales como transformados

---

### 5. GET /health

Health check (no requiere autenticación).

#### Response (200 OK)

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "Parse API",
  "version": "1.0.0"
}
```

---

## 💡 Ejemplos de Uso

### cURL

#### Parsear documento

```bash
curl -X POST https://parsedemo.axiomacloud.com/api/v1/parse/document \
  -H "X-API-Key: sk_AbCdEfGhIjKlMnOpQrStUvWxYz123456" \
  -F "file=@factura.pdf" \
  -F "tipoDocumento=AUTO"
```

#### Aplicar reglas

```bash
curl -X POST https://parsedemo.axiomacloud.com/api/v1/parse/apply-rules \
  -H "X-API-Key: sk_AbCdEfGhIjKlMnOpQrStUvWxYz123456" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": {
      "cabecera": {
        "tipoComprobante": "FACTURA_A",
        "cuitEmisor": "20-12345678-9",
        "total": 12100.00
      },
      "items": [],
      "impuestos": []
    }
  }'
```

#### Guardar documento

```bash
curl -X POST https://parsedemo.axiomacloud.com/api/v1/parse/save \
  -H "X-API-Key: sk_AbCdEfGhIjKlMnOpQrStUvWxYz123456" \
  -F "file=@factura.pdf" \
  -F "tipoDocumento=AUTO" \
  -F "aplicarReglas=true" \
  -F 'metadata={"ordenCompra":"OC-2025-001","departamento":"Compras"}'
```

#### Procesamiento completo

```bash
curl -X POST https://parsedemo.axiomacloud.com/api/v1/parse/full \
  -H "X-API-Key: sk_AbCdEfGhIjKlMnOpQrStUvWxYz123456" \
  -F "file=@factura.pdf" \
  -F "tipoDocumento=AUTO" \
  -F "aplicarReglas=true"
```

### JavaScript (Node.js)

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Configuración
const API_BASE_URL = 'https://parsedemo.axiomacloud.com/api/v1/parse';
const API_KEY = 'sk_AbCdEfGhIjKlMnOpQrStUvWxYz123456';

// 1. Parsear documento
async function parseDocument(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('tipoDocumento', 'AUTO');

  const response = await axios.post(`${API_BASE_URL}/document`, form, {
    headers: {
      'X-API-Key': API_KEY,
      ...form.getHeaders()
    }
  });

  return response.data;
}

// 2. Aplicar reglas
async function applyRules(documento) {
  const response = await axios.post(`${API_BASE_URL}/apply-rules`, {
    documento,
    tipoReglas: 'TRANSFORMACION'
  }, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// 3. Guardar documento en la plataforma
async function saveDocument(filePath, metadata = {}) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('aplicarReglas', 'true');
  form.append('metadata', JSON.stringify(metadata));

  const response = await axios.post(`${API_BASE_URL}/save`, form, {
    headers: {
      'X-API-Key': API_KEY,
      ...form.getHeaders()
    }
  });

  return response.data;
}

// 4. Procesamiento completo (sin guardar)
async function fullProcessing(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('aplicarReglas', 'true');

  const response = await axios.post(`${API_BASE_URL}/full`, form, {
    headers: {
      'X-API-Key': API_KEY,
      ...form.getHeaders()
    }
  });

  return response.data;
}

// Uso
(async () => {
  try {
    // Opción 1: Parse + Rules separados
    const parsed = await parseDocument('./factura.pdf');
    console.log('Documento parseado:', parsed);

    // Opción 2: Guardar en la plataforma
    const saved = await saveDocument('./factura.pdf', {
      ordenCompra: 'OC-2025-001',
      departamento: 'Compras'
    });
    console.log('Documento guardado con ID:', saved.documento.id);

    const transformed = await applyRules(parsed.documento);
    console.log('Documento transformado:', transformed);

    // Opción 2: Todo junto
    const full = await fullProcessing('./factura.pdf');
    console.log('Procesamiento completo:', full);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
})();
```

### Python

```python
import requests
from pathlib import Path

API_BASE_URL = "https://parsedemo.axiomacloud.com/api/v1/parse"
API_KEY = "sk_AbCdEfGhIjKlMnOpQrStUvWxYz123456"

headers = {
    "X-API-Key": API_KEY
}

# 1. Parsear documento
def parse_document(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'tipoDocumento': 'AUTO'}

        response = requests.post(
            f"{API_BASE_URL}/document",
            headers=headers,
            files=files,
            data=data
        )

        return response.json()

# 2. Aplicar reglas
def apply_rules(documento):
    response = requests.post(
        f"{API_BASE_URL}/apply-rules",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "documento": documento,
            "tipoReglas": "TRANSFORMACION"
        }
    )

    return response.json()

# 3. Procesamiento completo
def full_processing(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'aplicarReglas': 'true',
            'tipoDocumento': 'AUTO'
        }

        response = requests.post(
            f"{API_BASE_URL}/full",
            headers=headers,
            files=files,
            data=data
        )

        return response.json()

# Uso
if __name__ == "__main__":
    try:
        # Opción 1: Parse + Rules
        parsed = parse_document("factura.pdf")
        print("Documento parseado:", parsed)

        transformed = apply_rules(parsed['documento'])
        print("Documento transformado:", transformed)

        # Opción 2: Todo junto
        full = full_processing("factura.pdf")
        print("Procesamiento completo:", full)

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
```

---

## 📊 Códigos de Respuesta

| Código | Significado | Descripción |
|--------|-------------|-------------|
| `200` | OK | Request exitoso |
| `400` | Bad Request | Parámetros faltantes o inválidos |
| `401` | Unauthorized | API key faltante o inválida |
| `403` | Forbidden | API key sin permisos necesarios |
| `404` | Not Found | Endpoint no existe |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Error del servidor |

### Estructura de Errores

```json
{
  "success": false,
  "error": "Sin permiso \"parse\"",
  "details": "Stack trace (solo en desarrollo)"
}
```

---

## ⚙️ Limitaciones

### Rate Limiting

- **Desarrollo**: 1000 requests / 15 minutos
- **Producción**: 2000 requests / 15 minutos
- Por IP

### Tamaño de Archivos

- **Máximo**: 10 MB por archivo
- **Recomendado**: < 5 MB para mejor performance

### Formatos Soportados

**PDFs**:
- Texto nativo (mejor)
- Escaneos (usa OCR)
- Máximo 15 páginas

**Imágenes**:
- JPG, PNG, BMP, TIFF, WebP
- Mínimo 800x600 px
- Máximo 4000x4000 px

### Tiempos de Procesamiento

| Operación | Tiempo Promedio |
|-----------|-----------------|
| Parse PDF (texto) | 1-2 segundos |
| Parse PDF (escaneo) | 3-5 segundos |
| Parse Imagen | 2-4 segundos |
| Aplicar reglas | 0.5-1 segundo |
| Procesamiento completo | 2-6 segundos |

---

## 🔧 Troubleshooting

### Error 401: API key inválida

**Causas**:
- API key incorrecta
- API key expirada
- API key desactivada

**Solución**:
- Verificar que la key sea correcta
- Regenerar API key desde la UI
- Verificar que el tenant esté activo

---

### Error 403: Sin permiso "parse"

**Causa**: API key no tiene el permiso necesario

**Solución**:
1. Ir a Configuración → API Keys
2. Editar la API key
3. Habilitar permiso `parse` o `applyRules`
4. Guardar cambios

---

### Error 400: Campo "file" requerido

**Causa**: No se envió el archivo en el request

**Solución**:
- Verificar que el campo se llame exactamente `file`
- Usar `multipart/form-data` como Content-Type
- Verificar que el archivo exista en la ruta especificada

---

### Documento parseado con datos incompletos

**Causas**:
- Imagen de mala calidad
- PDF con texto no seleccionable
- Formato de factura no estándar

**Soluciones**:
- Usar imágenes de mayor resolución (min 1200x1600)
- Mejorar iluminación y contraste
- Asegurarse que el PDF tenga texto seleccionable
- Usar PDFs originales en lugar de escaneos

---

### Reglas no se aplican correctamente

**Verificar**:
1. Que el tenant tenga reglas configuradas
2. Que las reglas estén activas
3. Que las condiciones de las reglas coincidan con los datos
4. Que las reglas globales estén activadas para el tenant

**Debug**:
- Revisar campo `reglasAplicadas` en la respuesta
- Verificar `estadisticas.totalReglasCargadas`
- Si es 0, el tenant no tiene reglas configuradas

---

### Tiempo de respuesta muy lento

**Optimizaciones**:
- Reducir tamaño de imagen (usar 1200px max)
- Comprimir PDFs
- Usar formato JPEG en lugar de PNG
- Procesar en paralelo múltiples documentos

---

## 📞 Soporte

**Issues**: https://github.com/tu-org/parse/issues
**Email**: soporte@parsedemo.com
**Documentación adicional**: https://docs.parsedemo.com

---

## 🔄 Changelog

### v1.0.0 (2025-01-15)
- ✨ Release inicial
- 📡 3 endpoints principales
- 🔐 Autenticación con API Keys
- 🤖 Soporte para Claude Vision, Gemini 2.5
- 📝 Aplicación de reglas de negocio
- 🌍 Sistema multi-tenant

---

**Última actualización**: Enero 2025
**Versión de API**: 1.0.0
