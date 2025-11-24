# 📡 Guía Completa: Webhooks en Parse

## ¿Qué son los Webhooks?

Los **webhooks** son notificaciones HTTP automáticas que Parse envía a tu sistema cuando ocurren eventos importantes. En lugar de que tu aplicación consulte constantemente "¿pasó algo nuevo?", Parse te avisa inmediatamente cuando algo sucede.

### Analogía del Mundo Real

Piensa en los webhooks como un **servicio de mensajería**:

- **Sin webhooks** (Polling): Llamas cada 5 minutos a la pizzería preguntando "¿ya está lista mi pizza?"
- **Con webhooks**: La pizzería te llama cuando tu pizza está lista

## ¿Cómo Funcionan los Webhooks en Parse?

### 1. Flujo Básico

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Parse     │       │   Evento    │       │  Tu Sistema │
│   (Origen)  │──────▶│  Ocurre     │──────▶│ (Destino)   │
└─────────────┘       └─────────────┘       └─────────────┘
                            │
                            ▼
                      Parse envía
                      HTTP POST a
                      tu endpoint
```

### 2. Ejemplo Concreto

**Escenario**: Procesas una factura en Parse y quieres que se cree automáticamente en tu ERP.

1. **Upload**: Subes una factura PDF a Parse
2. **Procesamiento**: Parse extrae los datos (CUIT, número, total, etc.)
3. **Trigger**: Parse dispara el evento `document.processed`
4. **Webhook**: Parse envía un POST a `https://tu-erp.com/webhooks/parse`
5. **Acción**: Tu ERP recibe los datos y crea la factura automáticamente

---

## Configuración de Webhooks

### Paso 1: Crear un Endpoint en Tu Sistema

Primero necesitas un endpoint HTTP que pueda recibir las notificaciones de Parse.

**Ejemplo en Node.js/Express**:

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Endpoint que recibirá los webhooks de Parse
app.post('/webhooks/parse', async (req, res) => {
  try {
    // 1. Validar firma HMAC (seguridad)
    const signature = req.headers['x-webhook-signature'];
    const secret = 'whsec_tu_secret_del_webhook'; // Lo obtienes al crear el webhook

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ Firma inválida - posible ataque');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Procesar el evento
    const { event, data } = req.body;

    console.log(`📨 Recibido webhook: ${event}`);
    console.log('📄 Datos:', data);

    // 3. Ejecutar acción según el evento
    switch (event) {
      case 'document.processed':
        await crearFacturaEnERP(data);
        break;

      case 'document.exported':
        await notificarUsuario(data);
        break;

      case 'sync.completed':
        await actualizarDashboard(data);
        break;
    }

    // 4. Responder rápido (importante!)
    res.json({ received: true });

  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

async function crearFacturaEnERP(data) {
  // Aquí va tu lógica para crear la factura en tu ERP
  console.log('Creando factura en ERP:', {
    cuit: data.proveedor.cuit,
    numero: data.numero,
    total: data.total
  });

  // Ejemplo: llamada a API de tu ERP
  await fetch('https://mi-erp.com/api/facturas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proveedorCuit: data.proveedor.cuit,
      numeroFactura: data.numero,
      importe: data.total,
      fecha: data.fecha
    })
  });
}

app.listen(3000, () => {
  console.log('Servidor escuchando webhooks en puerto 3000');
});
```

### Paso 2: Crear el Webhook en Parse

**Opción A: Via API**

```bash
curl -X POST https://api.parsedemo.axiomacloud.com/api/webhooks \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Notificaciones a ERP",
    "url": "https://tu-erp.com/webhooks/parse",
    "eventos": [
      "document.processed",
      "document.exported"
    ]
  }'
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "wh_1234567890_abc123",
    "nombre": "Notificaciones a ERP",
    "url": "https://tu-erp.com/webhooks/parse",
    "secret": "whsec_a1b2c3d4e5f6...",  // ⚠️ GUARDA ESTO DE FORMA SEGURA
    "eventos": ["document.processed", "document.exported"],
    "activo": true
  }
}
```

**⚠️ IMPORTANTE**: Guarda el `secret` de forma segura. Lo necesitarás para validar las firmas HMAC.

**Opción B: Via Interfaz Web** (cuando esté implementada)

1. Ve a **Sincronización** → **Webhooks**
2. Click en **"Crear Webhook"**
3. Completa el formulario:
   - **Nombre**: Ej. "Notificaciones a ERP"
   - **URL**: `https://tu-erp.com/webhooks/parse`
   - **Eventos**: Selecciona los eventos que quieres recibir
4. Click en **"Guardar"**
5. Copia el **secret** generado

---

## Eventos Disponibles

Parse soporta los siguientes eventos de webhook:

| Evento | Cuándo se Dispara | Datos Incluidos |
|--------|-------------------|-----------------|
| `document.processed` | Documento procesado exitosamente | documentoId, tipo, número, total, proveedor, estado |
| `document.failed` | Falló el procesamiento | documentoId, error, timestamp |
| `document.exported` | Documento exportado a sistema externo | documentoId, tipo, número, total, externalId |
| `sync.completed` | Sincronización PULL completada | connectorId, success count, failed count |
| `sync.failed` | Falló sincronización PULL | connectorId, error |
| `export.completed` | Exportación PUSH completada | connectorId, success count, failed count |
| `export.failed` | Falló exportación PUSH | connectorId, error |

### Ejemplos de Payloads

**document.processed**:
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

**document.exported**:
```json
{
  "id": "evt_1234567890_xyz790",
  "event": "document.exported",
  "created": "2025-01-22T10:35:00.000Z",
  "data": {
    "documentoId": "doc_123",
    "tipo": "FACTURA_A",
    "numero": "0001-00012345",
    "total": 12500.50,
    "externalId": "ERP-INV-456",  // ID en el sistema externo
    "exportedAt": "2025-01-22T10:35:00.000Z"
  }
}
```

**sync.completed**:
```json
{
  "id": "evt_1234567890_xyz791",
  "event": "sync.completed",
  "created": "2025-01-22T11:00:00.000Z",
  "data": {
    "connectorId": "conn_123",
    "success": 45,
    "failed": 2,
    "timestamp": "2025-01-22T11:00:00.000Z"
  }
}
```

---

## Seguridad: Verificación de Firmas HMAC

**¿Por qué es importante?**

Cualquiera podría enviar requests HTTP a tu endpoint. La firma HMAC garantiza que:
- ✅ El request viene realmente de Parse
- ✅ Los datos no fueron modificados en tránsito
- ✅ No es un ataque de replay

### Validación en diferentes lenguajes

**Node.js**:
```javascript
const crypto = require('crypto');

function validateWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}

// Uso
const isValid = validateWebhook(
  req.body,
  req.headers['x-webhook-signature'],
  'whsec_tu_secret'
);
```

**Python**:
```python
import hmac
import hashlib
import json

def validate_webhook(payload, signature, secret):
    payload_str = json.dumps(payload, separators=(',', ':'))
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return signature == expected_signature

# Uso
is_valid = validate_webhook(
    request.json,
    request.headers.get('X-Webhook-Signature'),
    'whsec_tu_secret'
)
```

**PHP**:
```php
function validateWebhook($payload, $signature, $secret) {
    $payloadStr = json_encode($payload, JSON_UNESCAPED_SLASHES);
    $expectedSignature = hash_hmac('sha256', $payloadStr, $secret);

    return hash_equals($signature, $expectedSignature);
}

// Uso
$isValid = validateWebhook(
    json_decode(file_get_contents('php://input'), true),
    $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'],
    'whsec_tu_secret'
);
```

---

## Reintentos Automáticos

Parse implementa **reintentos automáticos** con **exponential backoff**:

| Intento | Delay | Condición |
|---------|-------|-----------|
| 1 | 0s | Inmediato |
| 2 | 1s | Si falla con 5xx o timeout |
| 3 | 2s | Si falla con 5xx o timeout |
| 4 | 4s | Si falla con 5xx o timeout |

**Códigos de respuesta**:
- `200-299`: ✅ Éxito - No se reintenta
- `400-499`: ⚠️ Error del cliente - No se reintenta (el webhook está mal configurado)
- `500-599`: 🔄 Error del servidor - Se reintenta hasta 3 veces
- `Timeout (>30s)`: 🔄 Se reintenta hasta 3 veces

### Mejores Prácticas

1. **Responde rápido**: Tu endpoint debe responder en <5 segundos
2. **Procesa async**: Si la tarea toma tiempo, usa una cola:

```javascript
app.post('/webhooks/parse', async (req, res) => {
  // 1. Validar firma
  if (!validateSignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  // 2. Responder inmediatamente
  res.json({ received: true });

  // 3. Procesar async (no bloquea la respuesta)
  processWebhookAsync(req.body).catch(err => {
    console.error('Error procesando webhook:', err);
  });
});

async function processWebhookAsync(payload) {
  // Aquí va tu lógica pesada
  await createInvoiceInERP(payload.data);
  await sendEmailNotification(payload.data);
  // ...
}
```

3. **Usa una cola** (Bull, RabbitMQ, etc.) para procesamiento más robusto:

```javascript
const Queue = require('bull');
const webhookQueue = new Queue('webhooks');

app.post('/webhooks/parse', async (req, res) => {
  if (!validateSignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  // Agregar a la cola
  await webhookQueue.add(req.body);

  res.json({ received: true });
});

// Procesador de la cola
webhookQueue.process(async (job) => {
  const { event, data } = job.data;

  if (event === 'document.processed') {
    await createInvoiceInERP(data);
  }
});
```

---

## Monitoreo y Debugging

### Ver Logs de Webhooks

**Via API**:
```bash
curl https://api.parsedemo.axiomacloud.com/api/webhooks/wh_123/logs \
  -H "Authorization: Bearer TU_JWT_TOKEN"
```

**Respuesta**:
```json
{
  "success": true,
  "data": [
    {
      "id": "whl_789",
      "evento": "document.processed",
      "statusCode": 200,
      "exitoso": true,
      "intentos": 1,
      "enviadoEn": "2025-01-22T10:30:00.000Z"
    },
    {
      "id": "whl_790",
      "evento": "document.processed",
      "statusCode": 503,
      "exitoso": false,
      "intentos": 3,
      "error": "HTTP 503",
      "enviadoEn": "2025-01-22T10:31:00.000Z"
    }
  ],
  "pagination": {
    "total": 2,
    "hasMore": false
  }
}
```

### Ver Estadísticas

**Via API**:
```bash
curl https://api.parsedemo.axiomacloud.com/api/webhooks/wh_123/stats?days=30 \
  -H "Authorization: Bearer TU_JWT_TOKEN"
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "exitosos": 1230,
    "fallidos": 20,
    "tasaExito": "98.40",
    "porEvento": [
      { "evento": "document.processed", "count": 850 },
      { "evento": "document.exported", "count": 400 }
    ]
  }
}
```

### Debugging

**Herramientas útiles**:

1. **webhook.site**: Para testear localmente
   - Ve a https://webhook.site
   - Copia la URL única generada
   - Úsala como URL del webhook en Parse
   - Verás todos los requests en tiempo real

2. **ngrok**: Para exponer tu localhost
   ```bash
   ngrok http 3000
   # Usa la URL https://xxx.ngrok.io/webhooks/parse
   ```

3. **Postman**: Para simular webhooks
   ```bash
   POST http://localhost:3000/webhooks/parse
   Headers:
     Content-Type: application/json
     X-Webhook-Signature: <generar con tu secret>
   Body:
     {
       "id": "evt_test",
       "event": "document.processed",
       "created": "2025-01-22T10:00:00Z",
       "data": { ... }
     }
   ```

---

## Casos de Uso Reales

### 1. Integración con ERP (SAP, Dynamics, etc.)

```javascript
async function handleDocumentProcessed(data) {
  // 1. Validar que tiene todos los campos requeridos
  if (!data.proveedor.cuit || !data.numero || !data.total) {
    console.warn('Documento incompleto, no se envía a SAP');
    return;
  }

  // 2. Mapear datos de Parse a formato SAP
  const sapInvoice = {
    LIFNR: data.proveedor.cuit.replace(/-/g, ''), // CUIT sin guiones
    XBLNR: data.numero,
    WRBTR: data.total,
    BLDAT: data.fecha,
    SGTXT: `Importado desde Parse - ${data.documentoId}`
  };

  // 3. Crear en SAP via BAPI o Web Service
  const response = await fetch('http://sap-server:8000/sap/bc/srt/rfc', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'Authorization': 'Basic ' + btoa('user:pass')
    },
    body: buildSoapRequest('BAPI_ACC_DOCUMENT_POST', sapInvoice)
  });

  if (!response.ok) {
    throw new Error(`Error SAP: ${response.statusText}`);
  }

  console.log('✅ Factura creada en SAP:', data.numero);
}
```

### 2. Notificaciones por Email/Slack

```javascript
async function handleDocumentFailed(data) {
  // Enviar email al equipo de operaciones
  await sendEmail({
    to: 'operaciones@empresa.com',
    subject: `⚠️ Error procesando documento ${data.documentoId}`,
    body: `
      Se produjo un error al procesar el documento:

      ID: ${data.documentoId}
      Error: ${data.error}
      Timestamp: ${data.timestamp}

      Por favor revisa el documento en Parse.
    `
  });

  // Notificar en Slack
  await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `❌ Error procesando documento ${data.documentoId}`,
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* ${data.error}\n*Documento:* ${data.documentoId}`
        }
      }]
    })
  });
}
```

### 3. Actualización de Dashboard en Tiempo Real

```javascript
async function handleSyncCompleted(data) {
  // Actualizar métricas en base de datos
  await db.query(`
    INSERT INTO sync_metrics (connector_id, success_count, failed_count, timestamp)
    VALUES ($1, $2, $3, $4)
  `, [data.connectorId, data.success, data.failed, new Date()]);

  // Enviar actualización via WebSocket a dashboard
  io.emit('sync-completed', {
    connectorId: data.connectorId,
    stats: {
      success: data.success,
      failed: data.failed
    }
  });

  console.log(`📊 Dashboard actualizado: ${data.success} docs sincronizados`);
}
```

---

## Troubleshooting

### Problema: Webhooks no se reciben

**Checklist**:
1. ✅ ¿El webhook está activo? (`activo: true`)
2. ✅ ¿La URL es accesible desde internet? (no `localhost`)
3. ✅ ¿El firewall permite conexiones entrantes?
4. ✅ ¿El certificado SSL es válido? (si usas HTTPS)
5. ✅ ¿Estás suscrito al evento correcto?

**Solución**:
```bash
# Test manual de conectividad
curl -X POST https://tu-servidor.com/webhooks/parse \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Problema: "Invalid signature"

**Causa**: El secret usado para validar no coincide

**Solución**:
1. Verifica que estás usando el secret correcto (obtenido al crear el webhook)
2. Asegúrate de serializar el JSON exactamente igual:
   ```javascript
   // ✅ Correcto
   JSON.stringify(payload)

   // ❌ Incorrecto
   JSON.stringify(payload, null, 2)  // Con espacios
   ```

### Problema: Webhooks duplicados

**Causa**: Tu endpoint demora >30s en responder, Parse reintenta

**Solución**: Implementa **idempotencia**

```javascript
const processedEvents = new Set();

app.post('/webhooks/parse', async (req, res) => {
  const eventId = req.body.id;

  // Verificar si ya procesamos este evento
  if (processedEvents.has(eventId)) {
    console.log('Evento ya procesado, ignorando');
    return res.json({ received: true });
  }

  // Marcar como procesado
  processedEvents.add(eventId);

  // Procesar...
  res.json({ received: true });
});
```

---

## Mejores Prácticas - Resumen

1. ✅ **Siempre valida la firma HMAC** - Seguridad primero
2. ✅ **Responde rápido** (<5s) - Evita reintentos innecesarios
3. ✅ **Procesa async** - Usa colas para tareas pesadas
4. ✅ **Implementa idempotencia** - Maneja duplicados correctamente
5. ✅ **Usa HTTPS** - Protege los datos en tránsito
6. ✅ **Monitorea logs** - Detecta problemas temprano
7. ✅ **Maneja errores gracefully** - Log + retry
8. ✅ **Testea localmente** - Usa webhook.site o ngrok

---

**Implementado**: 22 de Enero 2025
**Versión**: 1.0
