# 🔄 Sistema de Procesamiento Asíncrono de Documentos

## 📋 Índice

1. [Problema Actual](#problema-actual)
2. [Solución Propuesta](#solución-propuesta)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Cambios en Base de Datos](#cambios-en-base-de-datos)
5. [Implementación Backend](#implementación-backend)
6. [Implementación Frontend](#implementación-frontend)
7. [Plan de Implementación](#plan-de-implementación)
8. [Opciones de Escalabilidad](#opciones-de-escalabilidad)

---

## 🔴 Problema Actual

### Sistema SÍNCRONO (Bloqueante)

```
Usuario sube PDF → Espera 2-3 minutos → Timeout o Respuesta
                    (pantalla bloqueada)
```

**Problemas**:
- ❌ Usuario debe esperar mirando spinner
- ❌ Timeouts frecuentes con Claude Sonnet
- ❌ No puede subir múltiples documentos simultáneamente
- ❌ Si cierra el navegador, pierde el procesamiento
- ❌ Mala experiencia de usuario

---

## ✅ Solución Propuesta

### Sistema ASÍNCRONO (No Bloqueante)

```
Usuario sube PDF → Respuesta inmediata (< 1s) → Sigue trabajando

Worker en background → Procesa documento → Actualiza estado
                       (puede tardar 3+ minutos sin problema)

Usuario ve progreso → Estados actualizándose en tiempo real
```

**Ventajas**:
- ✅ Respuesta instantánea al subir
- ✅ Sin timeouts
- ✅ Puede subir múltiples documentos
- ✅ Puede cerrar navegador y volver después
- ✅ Excelente experiencia de usuario
- ✅ Escalable a miles de documentos

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Upload Form  │  │ Docs Grid    │  │ Status Badge │      │
│  │              │  │ (Polling 3s) │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                 │                                 │
└─────────┼─────────────────┼─────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ POST /upload         │  │ GET /documentos      │        │
│  │ (guardar y responder)│  │ (con estados)        │        │
│  └──────┬───────────────┘  └──────────────────────┘        │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────┐                                  │
│  │  DATABASE (Prisma)   │                                  │
│  │  estado: PENDIENTE   │                                  │
│  └──────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
          │
          │ Worker consulta cada 5s
          ▼
┌─────────────────────────────────────────────────────────────┐
│              WORKER (Background Process)                    │
│                                                             │
│  while(true) {                                              │
│    documentos = findPendientes()                            │
│    for (doc of documentos) {                                │
│      processDocument(doc)  // 2-3 minutos                  │
│    }                                                        │
│    sleep(5s)                                                │
│  }                                                          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Extract    │→ │ AI Call    │→ │ Apply      │           │
│  │ Text       │  │ (Gemini/   │  │ Rules      │           │
│  │            │  │  Claude)   │  │            │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Estados del Documento

```javascript
PENDIENTE          → Subido, esperando procesamiento
EN_COLA            → En la cola del worker
PROCESANDO         → Worker lo está procesando
├─ EXTRAYENDO_TEXTO    → Leyendo PDF/imagen
├─ EXTRAYENDO_DATOS    → Llamando a IA (Gemini/Claude)
└─ APLICANDO_REGLAS    → Reglas de negocio
COMPLETADO         → ✅ Procesado exitosamente
ERROR              → ❌ Falló el procesamiento
TIMEOUT            → ⏱️ Excedió tiempo límite (retry automático)
```

---

## 🗄️ Cambios en Base de Datos

### Migración Prisma

```prisma
// prisma/schema.prisma

model documentos {
  id                    String    @id @default(uuid())

  // ... campos existentes (fecha, cuit, razonSocial, etc.) ...

  // ========== NUEVOS CAMPOS PARA PROCESAMIENTO ASÍNCRONO ==========

  // Estado del procesamiento
  estadoProcesamiento   String?   @default("PENDIENTE")
  // Valores posibles: PENDIENTE, EN_COLA, PROCESANDO,
  //                   EXTRAYENDO_TEXTO, EXTRAYENDO_DATOS,
  //                   APLICANDO_REGLAS, COMPLETADO, ERROR, TIMEOUT

  // Mensaje descriptivo del progreso actual
  progresoActual        String?
  // Ejemplo: "Extrayendo texto del PDF..."
  //          "Llamando a Claude Vision..."
  //          "✅ Procesamiento completado"

  // Control de reintentos
  intentosProcesamiento Int       @default(0)
  maxIntentos          Int       @default(3)

  // Timestamps de procesamiento
  ultimoIntento         DateTime?
  proximoIntento        DateTime? // Para reintentos automáticos
  inicioProcesamientoAt DateTime?
  finProcesamientoAt    DateTime?

  // Métricas y debugging
  tiempoProcesamientoMs Int?      // Duración total en milisegundos
  errorDetalle          String?   @db.Text // Stack trace completo si falla
  metodoExtraccionUsado String?   // "GEMINI", "CLAUDE_VISION", "CLAUDE_TEXT", "REGEX"

  // Prioridad de procesamiento (opcional)
  prioridad            String?   @default("NORMAL")
  // Valores: ALTA, NORMAL, BAJA

  // ========== ÍNDICES PARA PERFORMANCE ==========

  @@index([estadoProcesamiento])
  @@index([tenantId, estadoProcesamiento])
  @@index([proximoIntento])
  @@index([prioridad, createdAt])
}
```

### Script de Migración SQL

```sql
-- Agregar nuevas columnas
ALTER TABLE documentos ADD COLUMN "estadoProcesamiento" TEXT DEFAULT 'PENDIENTE';
ALTER TABLE documentos ADD COLUMN "progresoActual" TEXT;
ALTER TABLE documentos ADD COLUMN "intentosProcesamiento" INTEGER DEFAULT 0;
ALTER TABLE documentos ADD COLUMN "maxIntentos" INTEGER DEFAULT 3;
ALTER TABLE documentos ADD COLUMN "ultimoIntento" TIMESTAMP;
ALTER TABLE documentos ADD COLUMN "proximoIntento" TIMESTAMP;
ALTER TABLE documentos ADD COLUMN "inicioProcesamientoAt" TIMESTAMP;
ALTER TABLE documentos ADD COLUMN "finProcesamientoAt" TIMESTAMP;
ALTER TABLE documentos ADD COLUMN "tiempoProcesamientoMs" INTEGER;
ALTER TABLE documentos ADD COLUMN "errorDetalle" TEXT;
ALTER TABLE documentos ADD COLUMN "metodoExtraccionUsado" TEXT;
ALTER TABLE documentos ADD COLUMN "prioridad" TEXT DEFAULT 'NORMAL';

-- Crear índices
CREATE INDEX "idx_documentos_estado" ON documentos("estadoProcesamiento");
CREATE INDEX "idx_documentos_tenant_estado" ON documentos("tenantId", "estadoProcesamiento");
CREATE INDEX "idx_documentos_proximo_intento" ON documentos("proximoIntento");
CREATE INDEX "idx_documentos_prioridad" ON documentos("prioridad", "createdAt");

-- Actualizar documentos existentes
UPDATE documentos
SET "estadoProcesamiento" = 'COMPLETADO',
    "progresoActual" = '✅ Procesado (migración)',
    "metodoExtraccionUsado" = COALESCE("metodoExtraccion", 'DESCONOCIDO')
WHERE "estadoProcesamiento" IS NULL;
```

---

## 💻 Implementación Backend

### 1. Upload Endpoint (MODIFICADO - Ahora asíncrono)

**Archivo**: `backend/src/routes/documentos.js`

```javascript
// POST /api/documentos/upload
// ANTES: Subir + Procesar (bloqueante)
// DESPUÉS: Solo subir (instantáneo)

router.post('/upload', authWithTenant, upload.single('file'), async (req, res) => {
  try {
    const { tenantId, userId } = req;
    const file = req.file;

    // 1. Validar archivo
    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    // 2. Guardar archivo en disco
    const filePath = file.path;
    const tipoArchivo = file.mimetype.includes('pdf') ? 'pdf' : 'imagen';

    // 3. Crear registro en BD con estado PENDIENTE
    const documento = await prisma.documentos.create({
      data: {
        tenantId,
        usuarioId: userId,
        archivoOriginal: file.originalname,
        rutaArchivo: filePath,
        tipoArchivo,

        // NUEVO: Estados de procesamiento asíncrono
        estadoProcesamiento: 'PENDIENTE',
        progresoActual: 'Documento subido. Esperando procesamiento...',
        intentosProcesamiento: 0,
        prioridad: req.body.prioridad || 'NORMAL',

        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`📄 Documento ${documento.id} subido. Estado: PENDIENTE`);

    // 4. RESPONDER INMEDIATAMENTE (sin esperar procesamiento)
    return res.status(201).json({
      success: true,
      documentoId: documento.id,
      estado: 'PENDIENTE',
      mensaje: 'Documento subido correctamente. Se procesará en los próximos minutos.',
      documento: {
        id: documento.id,
        archivoOriginal: documento.archivoOriginal,
        estadoProcesamiento: documento.estadoProcesamiento,
        progresoActual: documento.progresoActual
      }
    });

  } catch (error) {
    console.error('Error en upload:', error);
    return res.status(500).json({
      error: 'Error al subir documento',
      details: error.message
    });
  }
});
```

### 2. Endpoint para Consultar Estados

**Archivo**: `backend/src/routes/documentos.js`

```javascript
// GET /api/documentos?incluirEstados=true
// Modificar endpoint existente para incluir estados

router.get('/', authWithTenant, async (req, res) => {
  try {
    const { tenantId } = req;
    const { page = 1, limit = 50, incluirEstados } = req.query;

    const documentos = await prisma.documentos.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      select: {
        id: true,
        archivoOriginal: true,
        fecha: true,
        cuit: true,
        razonSocial: true,
        numeroComprobante: true,
        importe: true,

        // NUEVO: Incluir estados si se solicita
        ...(incluirEstados && {
          estadoProcesamiento: true,
          progresoActual: true,
          intentosProcesamiento: true,
          tiempoProcesamientoMs: true,
          errorDetalle: true
        }),

        createdAt: true,
        updatedAt: true
      }
    });

    // Estadísticas de procesamiento
    const stats = incluirEstados ? await prisma.documentos.groupBy({
      by: ['estadoProcesamiento'],
      where: { tenantId },
      _count: true
    }) : null;

    return res.json({
      documentos,
      total: await prisma.documentos.count({ where: { tenantId } }),
      page: parseInt(page),
      limit: parseInt(limit),
      stats
    });

  } catch (error) {
    console.error('Error al obtener documentos:', error);
    return res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// GET /api/documentos/stats
// Nuevo endpoint para estadísticas de procesamiento

router.get('/stats', authWithTenant, async (req, res) => {
  try {
    const { tenantId } = req;

    const stats = await prisma.documentos.groupBy({
      by: ['estadoProcesamiento'],
      where: { tenantId },
      _count: true
    });

    const tiempoPromedio = await prisma.documentos.aggregate({
      where: {
        tenantId,
        estadoProcesamiento: 'COMPLETADO',
        tiempoProcesamientoMs: { not: null }
      },
      _avg: { tiempoProcesamientoMs: true }
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);
    const completados = stats.find(s => s.estadoProcesamiento === 'COMPLETADO')?._count || 0;

    return res.json({
      estados: stats,
      pendientes: stats.find(s => s.estadoProcesamiento === 'PENDIENTE')?._count || 0,
      procesando: stats.find(s => s.estadoProcesamiento === 'PROCESANDO')?._count || 0,
      completados,
      errores: stats.find(s => s.estadoProcesamiento === 'ERROR')?._count || 0,
      tiempoPromedioMs: tiempoPromedio._avg.tiempoProcesamientoMs,
      tasaExito: total > 0 ? ((completados / total) * 100).toFixed(2) : 0
    });

  } catch (error) {
    console.error('Error al obtener stats:', error);
    return res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});
```

### 3. Worker de Procesamiento (NUEVO)

**Archivo**: `backend/src/workers/documentProcessor.worker.js`

```javascript
const prisma = require('../lib/prisma');
const documentProcessor = require('../lib/documentProcessor');
const orchestrator = require('../services/documentExtractionOrchestrator');
const businessRulesService = require('../services/businessRulesService');

class DocumentProcessorWorker {
  constructor(config = {}) {
    this.isRunning = false;
    this.config = {
      pollInterval: config.pollInterval || 5000,        // 5 segundos
      maxConcurrent: config.maxConcurrent || 3,         // 3 docs simultáneos
      maxRetries: config.maxRetries || 3,               // 3 intentos
      retryDelay: config.retryDelay || 5 * 60 * 1000,   // 5 minutos
      timeout: config.timeout || 3 * 60 * 1000          // 3 minutos
    };
    this.currentJobs = new Map();
  }

  /**
   * Iniciar el worker
   */
  async start() {
    console.log('🚀 Worker de procesamiento de documentos iniciado');
    console.log(`   Intervalo de polling: ${this.config.pollInterval}ms`);
    console.log(`   Procesamiento concurrente: ${this.config.maxConcurrent}`);
    console.log(`   Max reintentos: ${this.config.maxRetries}`);

    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('❌ Error en ciclo del worker:', error);
      }

      // Esperar antes del próximo ciclo
      await this.sleep(this.config.pollInterval);
    }

    console.log('🛑 Worker detenido');
  }

  /**
   * Detener el worker
   */
  async stop() {
    console.log('⏸️  Deteniendo worker...');
    this.isRunning = false;

    // Esperar a que terminen los jobs actuales
    const jobsEnEjecucion = Array.from(this.currentJobs.values());
    if (jobsEnEjecucion.length > 0) {
      console.log(`   Esperando ${jobsEnEjecucion.length} jobs en ejecución...`);
      await Promise.allSettled(jobsEnEjecucion);
    }
  }

  /**
   * Procesar un lote de documentos
   */
  async processBatch() {
    // 1. Buscar documentos pendientes o que necesitan reintento
    const pendientes = await prisma.documentos.findMany({
      where: {
        OR: [
          // Documentos pendientes
          {
            estadoProcesamiento: { in: ['PENDIENTE', 'EN_COLA'] }
          },
          // Documentos que fallaron y están listos para reintentar
          {
            estadoProcesamiento: { in: ['ERROR', 'TIMEOUT'] },
            intentosProcesamiento: { lt: this.config.maxRetries },
            proximoIntento: { lte: new Date() }
          }
        ]
      },
      orderBy: [
        { prioridad: 'desc' },  // ALTA > NORMAL > BAJA
        { createdAt: 'asc' }    // Más antiguos primero
      ],
      take: this.config.maxConcurrent - this.currentJobs.size
    });

    if (pendientes.length === 0) {
      return; // No hay nada que procesar
    }

    console.log(`📋 Encontrados ${pendientes.length} documentos para procesar`);

    // 2. Procesar cada documento
    for (const documento of pendientes) {
      // No exceder el límite de concurrencia
      if (this.currentJobs.size >= this.config.maxConcurrent) {
        break;
      }

      // Procesar en paralelo (no bloqueante)
      const jobPromise = this.processDocument(documento)
        .finally(() => {
          this.currentJobs.delete(documento.id);
        });

      this.currentJobs.set(documento.id, jobPromise);
    }
  }

  /**
   * Procesar un documento individual
   */
  async processDocument(documento) {
    const startTime = Date.now();
    const documentoId = documento.id;

    try {
      console.log(`\n📄 Procesando documento: ${documento.archivoOriginal} (${documentoId})`);

      // 1. Marcar como EN_COLA
      await this.updateStatus(documentoId, 'EN_COLA', 'En cola de procesamiento');

      // 2. Marcar como PROCESANDO
      await this.updateStatus(documentoId, 'PROCESANDO', 'Iniciando procesamiento...');
      await prisma.documentos.update({
        where: { id: documentoId },
        data: {
          inicioProcesamientoAt: new Date(),
          intentosProcesamiento: documento.intentosProcesamiento + 1
        }
      });

      // 3. Extraer texto del documento
      await this.updateStatus(documentoId, 'EXTRAYENDO_TEXTO', 'Extrayendo texto del documento...');

      const tipoArchivo = documento.rutaArchivo.toLowerCase().endsWith('.pdf') ? 'pdf' : 'imagen';
      let processingResult;

      if (tipoArchivo === 'pdf') {
        processingResult = await documentProcessor.processPDF(documento.rutaArchivo);
      } else {
        processingResult = await documentProcessor.processImage(documento.rutaArchivo);
      }

      if (!processingResult.success) {
        throw new Error(`Error extrayendo texto: ${processingResult.error}`);
      }

      console.log(`   ✅ Texto extraído: ${processingResult.text.length} caracteres`);

      // 4. Extraer datos con IA
      await this.updateStatus(documentoId, 'EXTRAYENDO_DATOS', 'Extrayendo datos con IA...');

      const extractionResult = await orchestrator.extractData(
        processingResult.text,
        documento.tenantId,
        documento.usuarioId,
        documento.rutaArchivo
      );

      if (!extractionResult || !extractionResult.datos) {
        throw new Error('No se pudieron extraer datos del documento');
      }

      console.log(`   ✅ Datos extraídos con método: ${extractionResult.metodo}`);

      // 5. Aplicar reglas de negocio (si hay datos de IA)
      let datosFinales = extractionResult.datos;

      if (extractionResult.metodo !== 'REGEX') {
        await this.updateStatus(documentoId, 'APLICANDO_REGLAS', 'Aplicando reglas de negocio...');

        try {
          datosFinales = await businessRulesService.applyRules(
            documentoId,
            extractionResult.datos,
            documento.tenantId
          );
          console.log(`   ✅ Reglas de negocio aplicadas`);
        } catch (error) {
          console.warn(`   ⚠️  Error aplicando reglas (continuando): ${error.message}`);
        }
      }

      // 6. Guardar datos extraídos y marcar como COMPLETADO
      const tiempoProcesamientoMs = Date.now() - startTime;

      await prisma.documentos.update({
        where: { id: documentoId },
        data: {
          // Datos extraídos
          ...datosFinales,

          // Estado de procesamiento
          estadoProcesamiento: 'COMPLETADO',
          progresoActual: '✅ Procesamiento completado exitosamente',
          metodoExtraccionUsado: extractionResult.metodo,

          // Timestamps y métricas
          finProcesamientoAt: new Date(),
          tiempoProcesamientoMs,
          errorDetalle: null, // Limpiar errores previos

          updatedAt: new Date()
        }
      });

      console.log(`✅ Documento ${documentoId} completado en ${(tiempoProcesamientoMs / 1000).toFixed(1)}s`);

    } catch (error) {
      // Error durante el procesamiento
      console.error(`❌ Error procesando documento ${documentoId}:`, error);

      const tiempoProcesamientoMs = Date.now() - startTime;
      const esTimeout = tiempoProcesamientoMs > this.config.timeout;
      const intentos = documento.intentosProcesamiento + 1;
      const puedeReintentar = intentos < this.config.maxRetries;

      await prisma.documentos.update({
        where: { id: documentoId },
        data: {
          estadoProcesamiento: esTimeout ? 'TIMEOUT' : 'ERROR',
          progresoActual: puedeReintentar
            ? `❌ Error (intento ${intentos}/${this.config.maxRetries}): ${error.message}`
            : `❌ Error final: ${error.message}`,
          errorDetalle: error.stack,
          finProcesamientoAt: new Date(),
          tiempoProcesamientoMs,
          proximoIntento: puedeReintentar
            ? new Date(Date.now() + this.config.retryDelay)
            : null,
          updatedAt: new Date()
        }
      });

      if (puedeReintentar) {
        console.log(`   ⏰ Se reintentará en ${this.config.retryDelay / 1000 / 60} minutos`);
      } else {
        console.log(`   ⛔ Se alcanzó el máximo de reintentos`);
      }
    }
  }

  /**
   * Actualizar estado del documento
   */
  async updateStatus(documentoId, estado, mensaje) {
    await prisma.documentos.update({
      where: { id: documentoId },
      data: {
        estadoProcesamiento: estado,
        progresoActual: mensaje,
        ultimoIntento: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`   📊 Estado: ${estado} - ${mensaje}`);
  }

  /**
   * Utilidad: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DocumentProcessorWorker;
```

### 4. Script para Iniciar el Worker

**Archivo**: `backend/src/scripts/start-worker.js`

```javascript
#!/usr/bin/env node

require('dotenv').config();
const DocumentProcessorWorker = require('../workers/documentProcessor.worker');

// Configuración del worker desde variables de entorno
const config = {
  pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL) || 5000,
  maxConcurrent: parseInt(process.env.WORKER_MAX_CONCURRENT) || 3,
  maxRetries: parseInt(process.env.WORKER_MAX_RETRIES) || 3,
  retryDelay: parseInt(process.env.WORKER_RETRY_DELAY) || 5 * 60 * 1000,
  timeout: parseInt(process.env.WORKER_TIMEOUT) || 3 * 60 * 1000
};

const worker = new DocumentProcessorWorker(config);

// Manejo de señales para detención limpia
process.on('SIGTERM', async () => {
  console.log('\n📢 Señal SIGTERM recibida. Deteniendo worker...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n📢 Señal SIGINT recibida (Ctrl+C). Deteniendo worker...');
  await worker.stop();
  process.exit(0);
});

// Iniciar worker
(async () => {
  try {
    console.log('\n🚀 Iniciando Worker de Procesamiento de Documentos...\n');
    await worker.start();
  } catch (error) {
    console.error('💥 Error fatal en el worker:', error);
    process.exit(1);
  }
})();
```

### 5. Integración con Server Principal (Opcional)

**Archivo**: `backend/src/index.js` (modificar)

```javascript
// ... imports existentes ...
const DocumentProcessorWorker = require('./workers/documentProcessor.worker');

// ... código existente del servidor ...

// Iniciar worker si está habilitado
if (process.env.ENABLE_DOCUMENT_WORKER === 'true') {
  const workerConfig = {
    pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL) || 5000,
    maxConcurrent: parseInt(process.env.WORKER_MAX_CONCURRENT) || 3,
    maxRetries: parseInt(process.env.WORKER_MAX_RETRIES) || 3
  };

  const documentWorker = new DocumentProcessorWorker(workerConfig);

  // Iniciar worker en background
  documentWorker.start().catch(error => {
    console.error('Error iniciando worker:', error);
  });

  console.log('✅ Document Worker iniciado en background');
}

// ... resto del código ...
```

---

## 🎨 Implementación Frontend

### 1. Componente de Subida (Modificado)

**Archivo**: `frontend/src/components/UploadDocumento.jsx`

```jsx
import { useState } from 'react';
import { toast } from 'react-toastify';

export default function UploadDocumento({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);

    try {
      const response = await fetch('/api/documentos/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // NUEVO: Respuesta inmediata sin esperar procesamiento
        toast.success('✅ Documento subido! Se procesará en breve...');

        // Notificar al componente padre para refrescar la lista
        onUploadSuccess(data.documento);
      } else {
        toast.error('Error al subir documento');
      }

    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-zone">
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && <p>Subiendo archivo...</p>}
    </div>
  );
}
```

### 2. Grilla de Documentos con Estados (Modificado)

**Archivo**: `frontend/src/components/DocumentosGrid.jsx`

```jsx
import { useState, useEffect } from 'react';
import { Badge, Spinner, Tooltip } from '@/components/ui';

export default function DocumentosGrid() {
  const [documentos, setDocumentos] = useState([]);
  const [stats, setStats] = useState(null);

  // Polling para actualizar estados cada 3 segundos
  useEffect(() => {
    fetchDocumentos();

    const interval = setInterval(() => {
      fetchDocumentos(true); // Silent refresh
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchDocumentos = async (silent = false) => {
    try {
      const response = await fetch('/api/documentos?incluirEstados=true');
      const data = await response.json();

      setDocumentos(data.documentos);
      setStats(data.stats);

    } catch (error) {
      if (!silent) {
        console.error('Error fetching documentos:', error);
      }
    }
  };

  return (
    <div className="documentos-grid">
      {/* Panel de estadísticas */}
      <StatsPanel stats={stats} />

      {/* Tabla de documentos */}
      <table>
        <thead>
          <tr>
            <th>Archivo</th>
            <th>Estado</th>
            <th>Progreso</th>
            <th>CUIT</th>
            <th>Razón Social</th>
            <th>Importe</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map(doc => (
            <DocumentoRow key={doc.id} documento={doc} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentoRow({ documento }) {
  return (
    <tr>
      <td>{documento.archivoOriginal}</td>

      {/* Estado con badge de color */}
      <td>
        <EstadoBadge estado={documento.estadoProcesamiento} />
      </td>

      {/* Progreso actual */}
      <td>
        {documento.estadoProcesamiento === 'PROCESANDO' && (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-sm text-gray-600">
              {documento.progresoActual}
            </span>
          </div>
        )}

        {documento.estadoProcesamiento === 'PENDIENTE' && (
          <span className="text-sm text-yellow-600">
            ⏳ {documento.progresoActual}
          </span>
        )}

        {documento.estadoProcesamiento === 'COMPLETADO' && (
          <Tooltip content={`Procesado en ${(documento.tiempoProcesamientoMs / 1000).toFixed(1)}s`}>
            <span className="text-sm text-green-600">
              ✅ Completado
            </span>
          </Tooltip>
        )}

        {documento.estadoProcesamiento === 'ERROR' && (
          <Tooltip content={documento.errorDetalle}>
            <span className="text-sm text-red-600">
              ❌ Error (intento {documento.intentosProcesamiento})
            </span>
          </Tooltip>
        )}
      </td>

      <td>{documento.cuit || '-'}</td>
      <td>{documento.razonSocial || '-'}</td>
      <td>{documento.importe ? `$${documento.importe}` : '-'}</td>
      <td>{formatDate(documento.createdAt)}</td>
    </tr>
  );
}

function EstadoBadge({ estado }) {
  const config = {
    PENDIENTE: { color: 'yellow', icon: '⏳', label: 'Pendiente' },
    EN_COLA: { color: 'blue', icon: '📋', label: 'En Cola' },
    PROCESANDO: { color: 'purple', icon: '🔄', label: 'Procesando' },
    EXTRAYENDO_TEXTO: { color: 'purple', icon: '📄', label: 'Extrayendo Texto' },
    EXTRAYENDO_DATOS: { color: 'purple', icon: '🤖', label: 'Extrayendo Datos' },
    APLICANDO_REGLAS: { color: 'purple', icon: '📐', label: 'Aplicando Reglas' },
    COMPLETADO: { color: 'green', icon: '✅', label: 'Completado' },
    ERROR: { color: 'red', icon: '❌', label: 'Error' },
    TIMEOUT: { color: 'orange', icon: '⏱️', label: 'Timeout' }
  };

  const { color, icon, label } = config[estado] || { color: 'gray', icon: '❓', label: estado };

  return (
    <Badge color={color}>
      <span className="mr-1">{icon}</span>
      {label}
    </Badge>
  );
}

function StatsPanel({ stats }) {
  if (!stats) return null;

  const totals = stats.reduce((acc, s) => ({ ...acc, [s.estadoProcesamiento]: s._count }), {});

  return (
    <div className="stats-panel grid grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Pendientes"
        value={totals.PENDIENTE || 0}
        color="yellow"
        icon="⏳"
      />
      <StatCard
        label="Procesando"
        value={totals.PROCESANDO || 0}
        color="purple"
        icon="🔄"
        pulse
      />
      <StatCard
        label="Completados"
        value={totals.COMPLETADO || 0}
        color="green"
        icon="✅"
      />
      <StatCard
        label="Errores"
        value={totals.ERROR || 0}
        color="red"
        icon="❌"
      />
    </div>
  );
}

function StatCard({ label, value, color, icon, pulse }) {
  return (
    <div className={`stat-card bg-${color}-50 border border-${color}-200 p-4 rounded-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
        </div>
        <div className={`text-3xl ${pulse ? 'animate-pulse' : ''}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
```

---

## 📝 Plan de Implementación

### Fase 1: Preparación (30 minutos)

#### 1.1 Actualizar Base de Datos
```bash
# 1. Editar schema.prisma (agregar campos nuevos)
code backend/prisma/schema.prisma

# 2. Crear migración
cd backend
npx prisma migrate dev --name add_async_processing_fields

# 3. Aplicar migración
npx prisma migrate deploy

# 4. Generar cliente Prisma
npx prisma generate
```

#### 1.2 Configurar Variables de Entorno
```bash
# Agregar a backend/.env

# Worker Configuration
ENABLE_DOCUMENT_WORKER=true
WORKER_POLL_INTERVAL=5000        # 5 segundos
WORKER_MAX_CONCURRENT=3          # 3 documentos simultáneos
WORKER_MAX_RETRIES=3             # Max 3 reintentos
WORKER_RETRY_DELAY=300000        # 5 minutos entre reintentos
WORKER_TIMEOUT=180000            # 3 minutos timeout
```

---

### Fase 2: Backend (2 horas)

#### 2.1 Modificar Upload Endpoint (30 min)
- ✅ Archivo: `backend/src/routes/documentos.js`
- ✅ Cambiar lógica para NO procesar, solo guardar
- ✅ Responder inmediatamente con estado PENDIENTE
- ✅ Eliminar timeout y procesamiento bloqueante

#### 2.2 Crear Worker (1 hora)
- ✅ Archivo: `backend/src/workers/documentProcessor.worker.js`
- ✅ Implementar polling de documentos pendientes
- ✅ Implementar procesamiento asíncrono
- ✅ Agregar manejo de estados y errores
- ✅ Implementar sistema de reintentos

#### 2.3 Script de Inicio (15 min)
- ✅ Archivo: `backend/src/scripts/start-worker.js`
- ✅ Configurar manejo de señales (SIGTERM, SIGINT)
- ✅ Leer configuración de .env

#### 2.4 Endpoints de Estado (15 min)
- ✅ Modificar GET /documentos para incluir estados
- ✅ Crear GET /documentos/stats para estadísticas

---

### Fase 3: Frontend (1.5 horas)

#### 3.1 Modificar Componente de Upload (20 min)
- ✅ Quitar spinner de espera largo
- ✅ Mostrar confirmación instantánea
- ✅ Refrescar lista al subir

#### 3.2 Actualizar Grilla (40 min)
- ✅ Agregar columna de Estado
- ✅ Agregar columna de Progreso
- ✅ Implementar polling cada 3 segundos
- ✅ Mostrar badges de color según estado

#### 3.3 Panel de Estadísticas (30 min)
- ✅ Crear StatsPanel component
- ✅ Mostrar: Pendientes, Procesando, Completados, Errores
- ✅ Actualizar en tiempo real

---

### Fase 4: Testing (1 hora)

#### 4.1 Testing Manual
```bash
# 1. Iniciar servidor
npm run dev

# 2. Iniciar worker (en otra terminal)
npm run worker

# 3. Subir 5 PDFs simultáneamente

# 4. Verificar:
✅ Respuesta instantánea al subir
✅ Estados actualizándose en grilla
✅ Documentos procesándose en background
✅ Todos llegan a COMPLETADO
```

#### 4.2 Testing de Errores
```bash
# 1. Subir PDF corrupto
✅ Debe llegar a ERROR y reintentar

# 2. Desactivar API de Gemini/Claude
✅ Debe fallar y marcar ERROR con detalle

# 3. Detener worker con Ctrl+C mientras procesa
✅ Debe terminar jobs actuales antes de cerrar
```

#### 4.3 Testing de Carga
```bash
# 1. Subir 50 PDFs simultáneamente
✅ Todos deben quedar PENDIENTES
✅ Worker debe procesarlos de 3 en 3
✅ Grilla debe actualizar estados
✅ Todos deben llegar a COMPLETADO
```

---

### Fase 5: Deployment (30 minutos)

#### 5.1 Configurar PM2 (Producción)

**Archivo**: `backend/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
        ENABLE_DOCUMENT_WORKER: 'false' // API no ejecuta worker
      }
    },
    {
      name: 'document-worker',
      script: 'src/scripts/start-worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_POLL_INTERVAL: '5000',
        WORKER_MAX_CONCURRENT: '5',
        WORKER_MAX_RETRIES: '3'
      }
    }
  ]
};
```

#### 5.2 Comandos de Deployment
```bash
# Detener servicios actuales
pm2 stop all

# Aplicar migraciones
cd backend
npx prisma migrate deploy

# Iniciar servicios
pm2 start ecosystem.config.js

# Verificar estado
pm2 status
pm2 logs document-worker --lines 50

# Guardar configuración
pm2 save
pm2 startup
```

---

## 🚀 Opciones de Escalabilidad

### Opción 1: Worker Simple (ACTUAL)
**Características**:
- ✅ Sin dependencias extra
- ✅ Implementación rápida (3-4 horas)
- ✅ Suficiente para < 1000 docs/día

**Limitaciones**:
- ⚠️ Un solo worker (no distribuible)
- ⚠️ Sin persistencia de cola
- ⚠️ Si se cae, pierde estado

**Cuándo usar**: MVP, prueba de concepto, bajo volumen

---

### Opción 2: BullMQ + Redis (RECOMENDADO para escalar)

**Instalación**:
```bash
npm install bull redis ioredis
```

**Configuración**:

**Archivo**: `backend/src/queues/documentQueue.js`

```javascript
const Queue = require('bull');

const documentQueue = new Queue('document-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,  // Mantener últimos 100 completados
    removeOnFail: 500       // Mantener últimos 500 fallidos
  }
});

// Processor
documentQueue.process('process-document', 5, async (job) => {
  const { documentoId, tenantId } = job.data;

  // Lógica de procesamiento (mismo código que worker simple)
  await processDocument(documentoId, tenantId);

  return { documentoId, status: 'completed' };
});

// Eventos
documentQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completado`);
});

documentQueue.on('failed', (job, error) => {
  console.error(`❌ Job ${job.id} falló:`, error.message);
});

documentQueue.on('progress', (job, progress) => {
  console.log(`🔄 Job ${job.id}: ${progress}%`);
});

module.exports = documentQueue;
```

**Upload modificado para usar BullMQ**:
```javascript
// En el upload endpoint
const documentQueue = require('../queues/documentQueue');

// Agregar a la cola en lugar de marcar como PENDIENTE
await documentQueue.add('process-document', {
  documentoId: documento.id,
  tenantId: documento.tenantId
}, {
  priority: documento.prioridad === 'ALTA' ? 1 : 5,
  jobId: `doc-${documento.id}`
});
```

**Ventajas de BullMQ**:
- ✅ **Reintentos automáticos** con backoff exponencial
- ✅ **Prioridades** de procesamiento
- ✅ **Distributable** en múltiples servidores
- ✅ **Persistencia** (no se pierde si el worker cae)
- ✅ **Dashboard** de monitoreo (Bull Board)
- ✅ **Rate limiting** y concurrencia configurable
- ✅ **Delayed jobs** (procesar después)

**Cuándo usar**: Producción, alto volumen, múltiples servidores

---

### Opción 3: AWS SQS + Lambda (Cloud Native)

**Arquitectura**:
```
Upload → S3 → SQS → Lambda → Update DB
```

**Ventajas**:
- ✅ Infinitamente escalable
- ✅ Serverless (sin mantenimiento)
- ✅ Pago por uso

**Desventajas**:
- ⚠️ Vendor lock-in (AWS)
- ⚠️ Mayor complejidad
- ⚠️ Costos en alto volumen

**Cuándo usar**: Escala masiva (10K+ docs/día)

---

## 📊 Comparativa de Opciones

| Característica | Worker Simple | BullMQ + Redis | AWS SQS + Lambda |
|---|---|---|---|
| **Implementación** | 3-4 horas | 1-2 días | 3-5 días |
| **Dependencias** | Ninguna | Redis | AWS Account |
| **Escalabilidad** | Baja | Alta | Infinita |
| **Costo** | $0 | $10-50/mes | Variable |
| **Mantenimiento** | Medio | Bajo | Muy bajo |
| **Reintentos** | Manual | Automático | Automático |
| **Distribución** | No | Sí | Sí |
| **Monitoreo** | Logs | Bull Board | CloudWatch |
| **Recomendado para** | < 1K docs/día | 1K-100K docs/día | > 100K docs/día |

---

## 🎯 Recomendación Final

### Para AHORA (Implementar YA):
**Worker Simple con setInterval**
- Implementación rápida
- Sin dependencias
- Resuelve el problema de timeouts
- Fácil de mantener

### Para DESPUÉS (Cuando crezca):
**BullMQ + Redis**
- Migración relativamente simple
- Solo cambiar el polling por queue.add()
- Mucho más robusto

---

## 📚 Referencias

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board (Monitoring)](https://github.com/felixmosh/bull-board)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [PM2 Process Manager](https://pm2.keymetrics.io/)

---

**Fecha de documentación**: 30 de octubre de 2025
**Estado**: Diseño completo - Listo para implementar
**Prioridad**: Alta (resuelve problema crítico de timeouts)
**Esfuerzo estimado**: 3-4 horas (Worker Simple) | 1-2 días (BullMQ)
