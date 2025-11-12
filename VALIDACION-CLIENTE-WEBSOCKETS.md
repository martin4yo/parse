# Validación en Tiempo Real con Cliente Local

## Caso de Uso

Cuando se sube un documento a la plataforma, validar automáticamente contra el SQL Server local del cliente para:
- Verificar si la factura existe en el sistema local
- Comparar importes/datos con registros locales
- Detectar duplicados o inconsistencias

---

## Arquitectura Actual

```
Usuario → Frontend → Backend (Cloud) → Extracción IA
                                      ↓
                                   Guardar en PostgreSQL
```

## Arquitectura Propuesta

```
Usuario → Frontend → Backend (Cloud) → Extracción IA
                                      ↓
                           Validar con Cliente Local ←→ SQL Server Cliente
                                      ↓
                                   Guardar + Resultado Validación
```

---

# Opción 1: WebSocket en Tiempo Real ⭐ RECOMENDADO

## Ventajas
- ✅ Latencia < 1 segundo
- ✅ Usuario ve resultado inmediatamente
- ✅ Comunicación bidireccional
- ✅ Cliente detrás de NAT (no necesita IP pública)

## Desventajas
- ⚠️ Requiere mantener conexión persistente
- ⚠️ Si cliente se desconecta, falla la validación
- ⚠️ Más complejo de implementar

## Flujo

```
1. Sync-client inicia y conecta WebSocket a wss://api.parsedemo.axiomacloud.com/ws
2. Backend guarda referencia: Map<tenantId, WebSocket>
3. Usuario sube factura
4. Backend extrae datos con IA
5. Backend envía query al cliente vía WebSocket
6. Cliente consulta SQL Server local
7. Cliente responde vía WebSocket (< 1s)
8. Backend actualiza documento con resultado
9. Frontend muestra: "✅ Validado con sistema local"
```

## Implementación

### 1. Backend: Servidor WebSocket

**Archivo:** `backend/src/services/websocketServer.js`

```javascript
const WebSocket = require('ws');

class WebSocketServer {
  constructor(httpServer) {
    this.wss = new WebSocket.Server({ server: httpServer });
    this.clients = new Map(); // tenantId → WebSocket
    this.pendingQueries = new Map(); // queryId → resolver

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    // Extraer tenantId de query params
    const url = new URL(req.url, 'http://localhost');
    const tenantId = url.searchParams.get('tenantId');
    const apiKey = url.searchParams.get('apiKey');

    // Validar autenticación
    if (!this.validateAuth(tenantId, apiKey)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    console.log(`✅ Cliente conectado: ${tenantId}`);
    this.clients.set(tenantId, ws);

    ws.on('message', (data) => {
      this.handleMessage(tenantId, data);
    });

    ws.on('close', () => {
      console.log(`❌ Cliente desconectado: ${tenantId}`);
      this.clients.delete(tenantId);
    });

    ws.on('error', (error) => {
      console.error(`❌ Error WebSocket ${tenantId}:`, error.message);
    });
  }

  handleMessage(tenantId, data) {
    try {
      const message = JSON.parse(data);

      // Resolver queries pendientes
      if (message.queryId && this.pendingQueries.has(message.queryId)) {
        const resolver = this.pendingQueries.get(message.queryId);
        resolver(message.result);
        this.pendingQueries.delete(message.queryId);
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  validateAuth(tenantId, apiKey) {
    // TODO: Validar contra BD
    return true;
  }

  // Método para que otras partes del backend consulten al cliente
  async queryClient(tenantId, queryType, data, timeout = 10000) {
    const ws = this.clients.get(tenantId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cliente no conectado');
    }

    const queryId = `${Date.now()}-${Math.random()}`;

    // Promesa que se resuelve cuando el cliente responde
    const promise = new Promise((resolve, reject) => {
      this.pendingQueries.set(queryId, resolve);

      // Timeout
      setTimeout(() => {
        if (this.pendingQueries.has(queryId)) {
          this.pendingQueries.delete(queryId);
          reject(new Error('Query timeout'));
        }
      }, timeout);
    });

    // Enviar query al cliente
    ws.send(JSON.stringify({
      type: queryType,
      queryId,
      data
    }));

    return promise;
  }

  isClientConnected(tenantId) {
    const ws = this.clients.get(tenantId);
    return ws && ws.readyState === WebSocket.OPEN;
  }
}

module.exports = WebSocketServer;
```

**Archivo:** `backend/src/index.js` (modificar)

```javascript
const express = require('express');
const http = require('http');
const WebSocketServer = require('./services/websocketServer');

const app = express();
const server = http.createServer(app);

// Inicializar WebSocket
const wsServer = new WebSocketServer(server);
global.wsServer = wsServer; // Para acceder desde rutas

// Rutas normales
app.use('/api', routes);

server.listen(5100, () => {
  console.log('🚀 Servidor corriendo en puerto 5100');
  console.log('🔌 WebSocket listo en wss://api.parsedemo.axiomacloud.com/ws');
});
```

**Archivo:** `backend/src/routes/documentos.js` (agregar validación)

```javascript
router.post('/procesar', async (req, res) => {
  try {
    // 1. Subir archivo
    const documento = await subirArchivo(req.file);

    // 2. Extraer datos con IA
    const datos = await extraerDatos(documento);

    // 3. Validar con cliente vía WebSocket
    let validacion = null;
    const clienteConectado = global.wsServer.isClientConnected(req.user.tenantId);

    if (clienteConectado) {
      try {
        validacion = await global.wsServer.queryClient(
          req.user.tenantId,
          'VALIDATE_INVOICE',
          {
            numeroComprobante: datos.numeroComprobante,
            cuit: datos.cuit,
            fecha: datos.fecha,
            importe: datos.importe
          },
          10000 // timeout 10 segundos
        );

        console.log('✅ Validación exitosa:', validacion);
      } catch (error) {
        console.warn('⚠️  Error en validación:', error.message);
        validacion = { error: error.message, validated: false };
      }
    } else {
      console.warn('⚠️  Cliente no conectado, saltando validación');
      validacion = { error: 'Cliente offline', validated: false };
    }

    // 4. Guardar documento con resultado de validación
    await prisma.documentos_procesados.update({
      where: { id: documento.id },
      data: {
        datosExtraidos: {
          ...datos,
          validacion: {
            validated: validacion?.validated || false,
            existsInLocal: validacion?.exists || false,
            matchesLocal: validacion?.matches || false,
            localData: validacion?.data || null,
            error: validacion?.error || null,
            timestamp: new Date().toISOString()
          }
        }
      }
    });

    // 5. Responder al frontend
    res.json({
      success: true,
      documento: {
        ...documento,
        validacion
      }
    });

  } catch (error) {
    console.error('Error procesando documento:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Cliente: WebSocket Client

**Archivo:** `sync-client-standalone/src/websocketClient.js` (NUEVO)

```javascript
const WebSocket = require('ws');
const sql = require('mssql');

class WebSocketClient {
  constructor(config) {
    this.serverUrl = config.serverUrl; // wss://api.parsedemo.axiomacloud.com/ws
    this.tenantId = config.tenantId;
    this.apiKey = config.apiKey;
    this.sqlPool = config.sqlPool; // Conexión SQL Server
    this.ws = null;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // Reintentar siempre
  }

  connect() {
    console.log('🔌 Conectando a WebSocket del servidor...');

    // Conectar con autenticación en query params
    const wsUrl = `${this.serverUrl}?tenantId=${this.tenantId}&apiKey=${this.apiKey}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ WebSocket conectado');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.ws.on('message', async (data) => {
      await this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`❌ WebSocket desconectado (${code}): ${reason}`);
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('❌ Error WebSocket:', error.message);
    });
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 60000);
    console.log(`🔄 Reconectando en ${delay / 1000}s... (intento ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  async handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('📥 Mensaje recibido:', message.type);

      switch (message.type) {
        case 'VALIDATE_INVOICE':
          await this.validateInvoice(message);
          break;

        case 'QUERY_DATA':
          await this.queryLocalData(message);
          break;

        case 'PING':
          this.send({ type: 'PONG' });
          break;

        default:
          console.warn('⚠️  Tipo de mensaje desconocido:', message.type);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
    }
  }

  async validateInvoice(message) {
    const { queryId, data } = message;

    try {
      console.log('🔍 Validando factura:', data.numeroComprobante);

      // Consultar SQL Server local
      const result = await this.sqlPool.request()
        .input('numero', sql.VarChar, data.numeroComprobante)
        .query(`
          SELECT TOP 1
            NumeroComprobante,
            CUIT,
            Fecha,
            Importe,
            RazonSocial
          FROM Facturas
          WHERE NumeroComprobante = @numero
        `);

      const exists = result.recordset.length > 0;
      const localData = exists ? result.recordset[0] : null;

      // Comparar importes si existe
      let matches = false;
      if (exists && localData) {
        const localImporte = parseFloat(localData.Importe);
        const cloudImporte = parseFloat(data.importe);
        const diff = Math.abs(localImporte - cloudImporte);
        matches = diff < 0.01; // Tolerancia de 1 centavo
      }

      // Enviar respuesta al servidor
      this.send({
        type: 'VALIDATION_RESULT',
        queryId,
        result: {
          validated: true,
          exists,
          matches,
          data: localData,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`✅ Validación completada: exists=${exists}, matches=${matches}`);

    } catch (error) {
      console.error('❌ Error validando factura:', error);

      // Enviar error al servidor
      this.send({
        type: 'VALIDATION_RESULT',
        queryId,
        result: {
          validated: false,
          error: error.message
        }
      });
    }
  }

  async queryLocalData(message) {
    const { queryId, data } = message;

    try {
      console.log('🔍 Ejecutando query custom:', data.sql);

      // Ejecutar query en SQL Server local (CUIDADO: validar query)
      const result = await this.sqlPool.request().query(data.sql);

      this.send({
        type: 'QUERY_RESULT',
        queryId,
        result: {
          success: true,
          data: result.recordset,
          rowCount: result.recordset.length
        }
      });

    } catch (error) {
      console.error('❌ Error ejecutando query:', error);

      this.send({
        type: 'QUERY_RESULT',
        queryId,
        result: {
          success: false,
          error: error.message
        }
      });
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️  No se puede enviar mensaje, WebSocket no conectado');
    }
  }

  startHeartbeat() {
    // Enviar ping cada 30 segundos para mantener conexión viva
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING' });
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    console.log('🔌 Desconectando WebSocket...');
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = WebSocketClient;
```

**Archivo:** `sync-client-standalone/src/index.js` (modificar)

```javascript
const WebSocketClient = require('./websocketClient');
const SyncManager = require('./syncManager');
const sql = require('mssql');

async function main() {
  console.log('🚀 Iniciando Sync Client...');

  // Configuración
  const config = {
    serverUrl: process.env.WS_SERVER_URL || 'wss://api.parsedemo.axiomacloud.com/ws',
    tenantId: process.env.TENANT_ID,
    apiKey: process.env.API_KEY,
    sqlServer: {
      server: process.env.SQL_SERVER,
      database: process.env.SQL_DATABASE,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    }
  };

  // Conectar a SQL Server
  const sqlPool = await sql.connect(config.sqlServer);
  console.log('✅ Conectado a SQL Server local');

  // Iniciar sync normal (subida/bajada de datos)
  const syncManager = new SyncManager({ ...config, sqlPool });
  syncManager.start(); // Corre cada X minutos como siempre

  // Iniciar WebSocket para queries en tiempo real
  const wsClient = new WebSocketClient({ ...config, sqlPool });
  wsClient.connect();

  console.log('✅ Sync Client corriendo con WebSocket activo');

  // Manejo de cierre limpio
  process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando aplicación...');
    wsClient.disconnect();
    sqlPool.close();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
```

**Archivo:** `sync-client-standalone/.env` (agregar)

```env
# WebSocket
WS_SERVER_URL=wss://api.parsedemo.axiomacloud.com/ws

# Autenticación
TENANT_ID=ef9d53eb-9c7c-4713-9565-0cd6f898dac6
API_KEY=tu-api-key-aqui

# SQL Server Local
SQL_SERVER=localhost
SQL_DATABASE=ERP_DATABASE
SQL_USER=sa
SQL_PASSWORD=tu-password
```

**Instalar dependencias:**

```bash
cd sync-client-standalone
npm install ws
```

### 3. Frontend: Mostrar Resultado

**Archivo:** `frontend/src/app/(protected)/documentos/[id]/page.tsx` (modificar)

```typescript
// Mostrar badge de validación
{documento.datosExtraidos?.validacion && (
  <div className="mt-4 p-4 border rounded-lg">
    <h3 className="font-semibold mb-2">Validación con Sistema Local</h3>

    {documento.datosExtraidos.validacion.validated ? (
      <div className="space-y-2">
        {documento.datosExtraidos.validacion.existsInLocal ? (
          <>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span>Factura encontrada en sistema local</span>
            </div>

            {documento.datosExtraidos.validacion.matchesLocal ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Importes coinciden</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" />
                <span>Importes NO coinciden</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            <span>Factura NO encontrada en sistema local</span>
          </div>
        )}
      </div>
    ) : (
      <div className="flex items-center gap-2 text-gray-500">
        <XCircle className="w-5 h-5" />
        <span>Cliente offline - no se pudo validar</span>
      </div>
    )}
  </div>
)}
```

---

# Opción 2: Cola + Polling (Más Simple)

## Ventajas
- ✅ Muy simple de implementar
- ✅ Tolerante a desconexiones
- ✅ Cola persistente (no se pierden queries)
- ✅ No requiere WebSocket

## Desventajas
- ⚠️ Latencia de 5-10 segundos
- ⚠️ Usuario ve spinner más tiempo
- ⚠️ Más tráfico (polling constante)

## Flujo

```
1. Usuario sube factura
2. Backend extrae datos
3. Backend crea query en tabla "pending_queries" (status: PENDING)
4. Backend responde al frontend: { validando: true }
5. Frontend hace polling cada 2s: "¿Ya se validó?"
6. Cliente consulta endpoint cada 5s: "¿Hay queries pendientes?"
7. Cliente ejecuta query en SQL Server local
8. Cliente envía respuesta a backend
9. Backend actualiza query (status: COMPLETED)
10. Frontend recibe resultado en próximo poll
```

## Implementación

### 1. Backend: Tabla de Queries

**Migración Prisma:** `backend/prisma/schema.prisma`

```prisma
model pending_queries {
  id         String   @id @default(uuid())
  tenantId   String
  type       String   // 'VALIDATE_INVOICE', 'QUERY_DATA'
  data       Json     // { numeroComprobante, importe, etc. }
  status     String   @default("PENDING") // 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  result     Json?    // Resultado de la query
  error      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  responseAt DateTime?

  tenant tenants @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, status])
  @@index([status, createdAt])
}
```

**Ejecutar migración:**

```bash
cd backend
npx prisma migrate dev --name add_pending_queries
```

### 2. Backend: Endpoints

**Archivo:** `backend/src/routes/documentos.js` (modificar)

```javascript
router.post('/procesar', async (req, res) => {
  // 1-2. Subir y extraer
  const documento = await subirYExtraer(req.file);
  const datos = await extraerDatos(documento);

  // 3. Crear query pendiente para validación
  const query = await prisma.pending_queries.create({
    data: {
      tenantId: req.user.tenantId,
      type: 'VALIDATE_INVOICE',
      data: {
        documentoId: documento.id,
        numeroComprobante: datos.numeroComprobante,
        cuit: datos.cuit,
        importe: datos.importe,
        fecha: datos.fecha
      },
      status: 'PENDING'
    }
  });

  // 4. Responder INMEDIATAMENTE (sin esperar validación)
  res.json({
    success: true,
    documento: {
      ...documento,
      validando: true, // Frontend muestra spinner
      queryId: query.id
    }
  });
});

// Endpoint para polling del frontend
router.get('/documentos/:id/validation-status', async (req, res) => {
  const doc = await prisma.documentos_procesados.findUnique({
    where: { id: req.params.id },
    select: {
      datosExtraidos: true
    }
  });

  const validacion = doc.datosExtraidos?.validacion;

  res.json({
    validado: validacion?.validated || false,
    validando: !validacion || validacion.validated === undefined,
    resultado: validacion
  });
});
```

**Archivo:** `backend/src/routes/sync.js` (agregar endpoints)

```javascript
// Cliente consulta queries pendientes
router.get('/pending-queries', requireAuth, async (req, res) => {
  const tenantId = req.user.tenantId;

  const queries = await prisma.pending_queries.findMany({
    where: {
      tenantId,
      status: 'PENDING'
    },
    orderBy: { createdAt: 'asc' },
    take: 10 // Max 10 queries por request
  });

  // Marcar como PROCESSING
  await prisma.pending_queries.updateMany({
    where: {
      id: { in: queries.map(q => q.id) }
    },
    data: { status: 'PROCESSING' }
  });

  res.json({ success: true, queries });
});

// Cliente envía respuestas
router.post('/query-response', requireAuth, async (req, res) => {
  const { queryId, result, error } = req.body;

  // Actualizar query
  const query = await prisma.pending_queries.update({
    where: { id: queryId },
    data: {
      status: error ? 'FAILED' : 'COMPLETED',
      result,
      error,
      responseAt: new Date()
    }
  });

  // Actualizar documento si es validación de factura
  if (query.type === 'VALIDATE_INVOICE') {
    await prisma.documentos_procesados.update({
      where: { id: query.data.documentoId },
      data: {
        datosExtraidos: {
          ...doc.datosExtraidos,
          validacion: {
            validated: true,
            existsInLocal: result.exists,
            matchesLocal: result.matches,
            localData: result.data,
            error: error,
            timestamp: new Date().toISOString()
          }
        }
      }
    });
  }

  res.json({ success: true });
});
```

### 3. Cliente: Polling

**Archivo:** `sync-client-standalone/src/queryPoller.js` (NUEVO)

```javascript
const sql = require('mssql');

class QueryPoller {
  constructor(config) {
    this.apiUrl = config.apiUrl;
    this.tenantId = config.tenantId;
    this.apiKey = config.apiKey;
    this.sqlPool = config.sqlPool;
    this.interval = config.pollInterval || 5000; // 5 segundos
    this.timer = null;
  }

  start() {
    console.log('🔄 Iniciando polling de queries...');
    this.poll(); // Primera ejecución inmediata
    this.timer = setInterval(() => this.poll(), this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll() {
    try {
      // Obtener queries pendientes
      const response = await fetch(`${this.apiUrl}/sync/pending-queries`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const data = await response.json();

      if (!data.success || !data.queries || data.queries.length === 0) {
        return;
      }

      console.log(`📋 ${data.queries.length} queries pendientes`);

      // Procesar cada query
      for (const query of data.queries) {
        await this.processQuery(query);
      }

    } catch (error) {
      console.error('❌ Error en polling:', error.message);
    }
  }

  async processQuery(query) {
    try {
      console.log(`🔍 Procesando query ${query.id} (${query.type})`);

      let result = null;

      switch (query.type) {
        case 'VALIDATE_INVOICE':
          result = await this.validateInvoice(query.data);
          break;

        case 'QUERY_DATA':
          result = await this.queryData(query.data);
          break;

        default:
          throw new Error(`Tipo de query desconocido: ${query.type}`);
      }

      // Enviar respuesta al servidor
      await fetch(`${this.apiUrl}/sync/query-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queryId: query.id,
          result
        })
      });

      console.log(`✅ Query ${query.id} completada`);

    } catch (error) {
      console.error(`❌ Error procesando query ${query.id}:`, error.message);

      // Reportar error al servidor
      await fetch(`${this.apiUrl}/sync/query-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queryId: query.id,
          error: error.message
        })
      });
    }
  }

  async validateInvoice(data) {
    const result = await this.sqlPool.request()
      .input('numero', sql.VarChar, data.numeroComprobante)
      .query(`
        SELECT TOP 1
          NumeroComprobante,
          CUIT,
          Fecha,
          Importe,
          RazonSocial
        FROM Facturas
        WHERE NumeroComprobante = @numero
      `);

    const exists = result.recordset.length > 0;
    const localData = exists ? result.recordset[0] : null;

    let matches = false;
    if (exists && localData) {
      const localImporte = parseFloat(localData.Importe);
      const cloudImporte = parseFloat(data.importe);
      const diff = Math.abs(localImporte - cloudImporte);
      matches = diff < 0.01;
    }

    return {
      exists,
      matches,
      data: localData
    };
  }

  async queryData(data) {
    const result = await this.sqlPool.request().query(data.sql);
    return {
      data: result.recordset,
      rowCount: result.recordset.length
    };
  }
}

module.exports = QueryPoller;
```

**Archivo:** `sync-client-standalone/src/index.js` (modificar)

```javascript
const QueryPoller = require('./queryPoller');

async function main() {
  // ... código existente ...

  // Iniciar poller de queries
  const queryPoller = new QueryPoller({
    apiUrl: process.env.API_URL,
    tenantId: process.env.TENANT_ID,
    apiKey: process.env.API_KEY,
    sqlPool,
    pollInterval: 5000 // 5 segundos
  });
  queryPoller.start();

  console.log('✅ Sync Client corriendo con query poller activo');
}
```

### 4. Frontend: Polling

**Archivo:** `frontend/src/app/(protected)/documentos/components/UploadDocument.tsx`

```typescript
const handleUpload = async (file: File) => {
  setUploading(true);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/documentos/procesar', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();

  if (data.validando) {
    // Iniciar polling para ver resultado de validación
    setValidando(true);

    const pollInterval = setInterval(async () => {
      const statusRes = await fetch(`/api/documentos/${data.documento.id}/validation-status`);
      const status = await statusRes.json();

      if (!status.validando) {
        clearInterval(pollInterval);
        setValidando(false);

        // Mostrar notificación
        if (status.validado && status.resultado.existsInLocal) {
          toast.success('✅ Factura validada con sistema local');
        } else {
          toast.warning('⚠️ Factura no encontrada en sistema local');
        }

        // Recargar documento
        router.refresh();
      }
    }, 2000); // Cada 2 segundos
  }

  setUploading(false);
};
```

---

# Opción 3: Túnel Reverso + HTTP Callback

## Solo si necesitas que el servidor llame directamente al cliente

**No recomendado** - requiere configuración de túnel (Cloudflare Tunnel o ngrok)

Ver detalles en conversación original si es necesario.

---

# Comparación Final

| Criterio | WebSocket | Polling | Túnel HTTP |
|----------|-----------|---------|------------|
| **Latencia** | < 1s ⭐ | 5-10s | 2s |
| **Complejidad Backend** | Media | Baja ⭐ | Media |
| **Complejidad Cliente** | Media | Baja ⭐ | Alta |
| **Tolerancia a fallos** | Media | Alta ⭐ | Baja |
| **Tráfico de red** | Bajo ⭐ | Alto | Bajo |
| **Requiere servicios externos** | No ⭐ | No ⭐ | Sí (túnel) |
| **Usuario ve spinner** | 1s ⭐ | 5-10s | 2s |
| **Dependencias** | `ws` | Ninguna ⭐ | `cloudflared` |

---

# Recomendación Final

- **Para producción con UX óptima:** WebSocket (Opción 1)
- **Para MVP rápido y simple:** Polling (Opción 2)
- **Para debugging temporal:** Túnel HTTP (Opción 3)

---

# Próximos Pasos

1. Decidir qué opción implementar
2. Crear tabla `pending_queries` (si Polling)
3. Instalar `ws` en backend y cliente (si WebSocket)
4. Implementar código según la opción elegida
5. Probar con factura de prueba
6. Ajustar timeouts según latencia real
7. Agregar métricas de validación en dashboard
