const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { authenticateSyncClient } = require('../middleware/syncAuth');
const { rateLimiter } = require('../middleware/rateLimiter');
const DocumentProcessor = require('../lib/documentProcessor');
const BusinessRulesEngine = require('../services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs').promises;
const path = require('path');

// Aplicar rate limiting a todas las rutas de esta API
router.use(rateLimiter);

// Instancia global de DocumentProcessor
const documentProcessor = new DocumentProcessor();

// Directorio de uploads con ruta absoluta
const UPLOAD_DIR = path.join(__dirname, '../../uploads/api-parse');

// Crear directorio si no existe
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(err => {
  console.error('Error creando directorio de uploads:', err);
});

// Configurar multer para subida de archivos con preservación de extensión
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Preservar la extensión original del archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * POST /api/v1/parse/document
 * Parsear documento y devolver JSON (sin guardar en BD)
 *
 * NUEVO: Sistema de aprendizaje de patrones integrado
 * - Detecta documentos idénticos (100% ahorro de IA)
 * - Usa templates de proveedores conocidos (60-80% ahorro)
 * - Aprende automáticamente de extracciones exitosas
 *
 * Headers requeridos:
 *   X-API-Key: tu-api-key-aqui
 *
 * Body (multipart/form-data):
 *   file: archivo PDF/imagen
 *   tipoDocumento: "FACTURA_A" | "FACTURA_B" | "FACTURA_C" | "AUTO" (opcional, default: AUTO)
 *
 * Response:
 *   {
 *     "success": true,
 *     "documento": {
 *       "cabecera": {...},
 *       "items": [...],
 *       "impuestos": [...},
 *       "modeloIA": "Claude Vision" | "Gemini" | "Pattern Cache",
 *       "confianza": 0.95,
 *       "usedPattern": false,  // NUEVO: true si usó patrón aprendido
 *       "patternInfo": {       // NUEVO: info del patrón (si usedPattern=true)
 *         "type": "exact_match" | "template",
 *         "confidence": 0.99,
 *         "occurrences": 15
 *       }
 *     },
 *     "metadata": {...}
 *   }
 */
router.post('/document', authenticateSyncClient, upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    // Validar permiso
    if (!req.syncClient.permisos.parse) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "parse". La API key debe tener el permiso "parse" habilitado.'
      });
    }

    const { file } = req;
    const tipoDocumento = req.body.tipoDocumento || 'AUTO';

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Campo "file" requerido. Debe enviar un archivo PDF o imagen.'
      });
    }

    // Check for X-Force-AI header to bypass pattern cache
    const forceAI = req.headers['x-force-ai'] === 'true';
    if (forceAI) {
      console.log('⚡ [FORCE-AI] Header X-Force-AI detectado - se forzará procesamiento con IA');
    }

    console.log(`📄 [Parse API] Procesando documento para tenant: ${req.syncClient.tenant.nombre}`);
    console.log(`   Archivo: ${file.originalname}`);
    console.log(`   Tamaño: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`   Tipo: ${file.mimetype}`);
    console.log(`   ForceAI: ${forceAI}`);

    // Procesar documento usando el pipeline existente
    const resultado = await documentProcessor.processFileForAPI(
      file.path,
      req.syncClient.tenantId,
      tipoDocumento,
      forceAI
    );

    // Limpiar archivo temporal
    await fs.unlink(file.path).catch(err =>
      console.error('Error eliminando archivo temporal:', err)
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Documento procesado exitosamente en ${duration}ms`);

    res.json({
      success: true,
      documento: {
        cabecera: resultado.cabecera || {},
        items: resultado.items || [],
        impuestos: resultado.impuestos || []
      },
      metadata: {
        tipoDocumento: resultado.tipoDocumento,
        modeloIA: resultado.modeloIA,
        confianza: resultado.confianza,
        processingTimeMs: duration
      }
    });

  } catch (error) {
    console.error('❌ Error parseando documento:', error);

    // Limpiar archivo en caso de error
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando documento',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/v1/parse/apply-rules
 * Aplicar reglas de negocio a un documento parseado
 *
 * Headers requeridos:
 *   X-API-Key: tu-api-key-aqui
 *   Content-Type: application/json
 *
 * Body (JSON):
 *   {
 *     "documento": {
 *       "cabecera": {...},
 *       "items": [...],
 *       "impuestos": [...]
 *     },
 *     "tipoReglas": "TRANSFORMACION" | "VALIDACION" (opcional, default: TRANSFORMACION)
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "documentoTransformado": {...},
 *     "reglasAplicadas": [...],
 *     "estadisticas": {...}
 *   }
 */
router.post('/apply-rules', authenticateSyncClient, async (req, res) => {
  const startTime = Date.now();

  try {
    // Validar permiso
    if (!req.syncClient.permisos.applyRules) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "applyRules". La API key debe tener el permiso "applyRules" habilitado.'
      });
    }

    const { documento, tipoReglas = 'TRANSFORMACION' } = req.body;

    if (!documento) {
      return res.status(400).json({
        success: false,
        error: 'Campo "documento" requerido en el body JSON'
      });
    }

    if (!documento.cabecera && !documento.items && !documento.impuestos) {
      return res.status(400).json({
        success: false,
        error: 'El documento debe contener al menos "cabecera", "items" o "impuestos"'
      });
    }

    console.log(`🔧 [Parse API] Aplicando reglas para tenant: ${req.syncClient.tenant.nombre}`);
    console.log(`   Tipo de reglas: ${tipoReglas}`);

    // Inicializar motor de reglas
    const engine = new BusinessRulesEngine(req.syncClient.tenantId);
    await engine.loadRules(tipoReglas, true, prisma);

    console.log(`   Reglas cargadas: ${engine.rules.length}`);

    // Preparar datos para el motor (simular estructura de BD)
    const documentoParaReglas = {
      ...(documento.cabecera || {}),
      documento_lineas: documento.items || [],
      documento_impuestos: documento.impuestos || []
    };

    // Aplicar reglas a la cabecera
    let cabeceraTransformada = documento.cabecera || {};
    if (documento.cabecera) {
      cabeceraTransformada = await engine.applyRules(
        documentoParaReglas,
        'DOCUMENTO'
      );
    }

    // Aplicar reglas a cada item
    const itemsTransformados = await Promise.all(
      (documento.items || []).map(async (item, index) => {
        const itemConDocumento = {
          ...item,
          documentoId: 'temp',
          numero: index + 1
        };
        return await engine.applyRules(itemConDocumento, 'LINEA_DOCUMENTO');
      })
    );

    // Aplicar reglas a cada impuesto
    const impuestosTransformados = await Promise.all(
      (documento.impuestos || []).map(async (impuesto) => {
        const impuestoConDocumento = {
          ...impuesto,
          documentoId: 'temp'
        };
        return await engine.applyRules(impuestoConDocumento, 'IMPUESTO');
      })
    );

    // Obtener reglas aplicadas
    const reglasAplicadas = engine.rules
      .filter(r => r.ejecutada)
      .map(r => ({
        codigo: r.codigo,
        nombre: r.nombre,
        tipo: r.tipo,
        esGlobal: r.esGlobal,
        prioridad: r.prioridad
      }));

    const duration = Date.now() - startTime;
    console.log(`✅ Reglas aplicadas exitosamente en ${duration}ms`);
    console.log(`   Reglas ejecutadas: ${reglasAplicadas.length}`);

    res.json({
      success: true,
      documentoTransformado: {
        cabecera: cabeceraTransformada,
        items: itemsTransformados,
        impuestos: impuestosTransformados
      },
      reglasAplicadas,
      estadisticas: {
        totalReglasCargadas: engine.rules.length,
        reglasEjecutadas: reglasAplicadas.length,
        itemsProcesados: itemsTransformados.length,
        impuestosProcesados: impuestosTransformados.length,
        processingTimeMs: duration
      }
    });

  } catch (error) {
    console.error('❌ Error aplicando reglas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error aplicando reglas',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/v1/parse/full
 * Parsear documento Y aplicar reglas en una sola llamada
 *
 * Headers requeridos:
 *   X-API-Key: tu-api-key-aqui
 *
 * Body (multipart/form-data):
 *   file: archivo PDF/imagen
 *   tipoDocumento: "FACTURA_A" | "FACTURA_B" | "AUTO" (opcional)
 *   tipoReglas: "TRANSFORMACION" | "VALIDACION" (opcional)
 *   aplicarReglas: "true" | "false" (opcional, default: true)
 *
 * Response:
 *   {
 *     "success": true,
 *     "documentoParsed": {...},
 *     "documentoTransformado": {...},
 *     "reglasAplicadas": [...]
 *   }
 */
router.post('/full', authenticateSyncClient, upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    // Validar permisos
    if (!req.syncClient.permisos.parse) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "parse". La API key debe tener el permiso "parse" habilitado.'
      });
    }

    const { file } = req;
    const {
      tipoDocumento = 'AUTO',
      tipoReglas = 'TRANSFORMACION',
      aplicarReglas = 'true'
    } = req.body;

    const shouldApplyRules = aplicarReglas === 'true' || aplicarReglas === true;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Campo "file" requerido'
      });
    }

    if (shouldApplyRules && !req.syncClient.permisos.applyRules) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "applyRules". Para aplicar reglas, la API key debe tener el permiso "applyRules" habilitado.'
      });
    }

    console.log(`🚀 [Parse API] Full processing para tenant: ${req.syncClient.tenant.nombre}`);
    console.log(`   Archivo: ${file.originalname}`);
    console.log(`   Aplicar reglas: ${shouldApplyRules}`);

    // 1. Parsear documento
    const parseStartTime = Date.now();
    const documentoParsed = await documentProcessor.processFileForAPI(
      file.path,
      req.syncClient.tenantId,
      tipoDocumento
    );
    const parseTime = Date.now() - parseStartTime;

    console.log(`   ✅ Documento parseado en ${parseTime}ms`);

    let documentoTransformado = null;
    let reglasAplicadas = [];
    let rulesTime = 0;

    // 2. Aplicar reglas si está habilitado
    if (shouldApplyRules) {
      const rulesStartTime = Date.now();

      const engine = new BusinessRulesEngine(req.syncClient.tenantId);
      await engine.loadRules(tipoReglas, true, prisma);

      console.log(`   Reglas cargadas: ${engine.rules.length}`);

      const documentoParaReglas = {
        ...(documentoParsed.cabecera || {}),
        documento_lineas: documentoParsed.items || [],
        documento_impuestos: documentoParsed.impuestos || []
      };

      const cabeceraTransformada = await engine.applyRules(documentoParaReglas, 'DOCUMENTO');

      const itemsTransformados = await Promise.all(
        (documentoParsed.items || []).map(async (item, index) => {
          return await engine.applyRules({ ...item, numero: index + 1 }, 'LINEA_DOCUMENTO');
        })
      );

      const impuestosTransformados = await Promise.all(
        (documentoParsed.impuestos || []).map(async (impuesto) => {
          return await engine.applyRules(impuesto, 'IMPUESTO');
        })
      );

      documentoTransformado = {
        cabecera: cabeceraTransformada,
        items: itemsTransformados,
        impuestos: impuestosTransformados
      };

      reglasAplicadas = engine.rules.filter(r => r.ejecutada).map(r => ({
        codigo: r.codigo,
        nombre: r.nombre,
        tipo: r.tipo,
        esGlobal: r.esGlobal
      }));

      rulesTime = Date.now() - rulesStartTime;
      console.log(`   ✅ Reglas aplicadas en ${rulesTime}ms`);
    }

    // Limpiar archivo
    await fs.unlink(file.path).catch(() => {});

    const totalTime = Date.now() - startTime;
    console.log(`✅ Procesamiento completo en ${totalTime}ms`);

    const response = {
      success: true,
      documentoParsed: {
        cabecera: documentoParsed.cabecera,
        items: documentoParsed.items,
        impuestos: documentoParsed.impuestos
      },
      metadata: {
        tipoDocumento: documentoParsed.tipoDocumento,
        modeloIA: documentoParsed.modeloIA,
        parseTimeMs: parseTime,
        rulesTimeMs: rulesTime,
        totalTimeMs: totalTime
      }
    };

    if (shouldApplyRules) {
      response.documentoTransformado = documentoTransformado;
      response.reglasAplicadas = reglasAplicadas;
      response.estadisticas = {
        reglasEjecutadas: reglasAplicadas.length
      };
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error en procesamiento completo:', error);
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/v1/parse/save
 * Guardar documento procesado en la base de datos
 *
 * Headers requeridos:
 *   X-API-Key: tu-api-key-aqui
 *
 * Body (multipart/form-data):
 *   file: archivo PDF/imagen
 *   tipoDocumento: "FACTURA_A" | "FACTURA_B" | "FACTURA_C" | "AUTO" (opcional, default: AUTO)
 *   aplicarReglas: "true" | "false" (opcional, default: false)
 *   metadata: JSON string con metadata adicional (opcional)
 *
 * Response:
 *   {
 *     "success": true,
 *     "documento": {...},
 *     "message": "Documento guardado exitosamente"
 *   }
 */
router.post('/save', authenticateSyncClient, upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    // Validar permiso saveDocs
    if (!req.syncClient.permisos.saveDocs) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "saveDocs". La API key debe tener el permiso "saveDocs" habilitado.'
      });
    }

    const { file } = req;
    const tipoDocumento = req.body.tipoDocumento || 'AUTO';
    const aplicarReglas = req.body.aplicarReglas === 'true';

    let metadata = {};
    if (req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch (e) {
        console.warn('⚠️ Metadata inválida, ignorando:', e.message);
      }
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Campo "file" requerido. Debe enviar un archivo PDF o imagen.'
      });
    }

    console.log(`💾 [Parse API - Save] Guardando documento para tenant: ${req.syncClient.tenant.nombre}`);
    console.log(`   Archivo: ${file.originalname}`);
    console.log(`   Tamaño: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`   Aplicar reglas: ${aplicarReglas}`);

    // 1. Procesar documento
    const resultado = await documentProcessor.processFileForAPI(
      file.path,
      req.syncClient.tenantId,
      tipoDocumento
    );

    // 2. Guardar en la base de datos usando el procesador de documentos
    // Obtener un usuario administrador del tenant para asociar el documento
    const adminUser = await prisma.users.findFirst({
      where: {
        tenantId: req.syncClient.tenantId,
        activo: true
      },
      orderBy: { createdAt: 'asc' } // El primer usuario creado suele ser admin
    });

    if (!adminUser) {
      console.error('❌ No se encontró usuario para el tenant:', req.syncClient.tenantId);
      return res.status(500).json({
        success: false,
        error: 'No hay usuarios configurados para este tenant'
      });
    }

    // Determinar tipo de archivo por extensión
    const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
    const tipoArchivo = ['pdf'].includes(extension) ? 'pdf' :
                        ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) ? 'imagen' : extension;

    const documentoGuardado = await prisma.documentos_procesados.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: req.syncClient.tenantId,
        usuarioId: adminUser.id,
        nombreArchivo: file.originalname,
        tipoArchivo: tipoArchivo,
        rutaArchivo: file.path,
        tipo: 'documento',
        tipoComprobanteExtraido: resultado.tipoDocumento || tipoDocumento,
        estadoProcesamiento: 'completado',
        fechaProcesamiento: new Date(),
        modeloIA: resultado.modeloIA,
        datosExtraidos: {
          cabecera: resultado.cabecera || {},
          items: resultado.items || [],
          impuestos: resultado.impuestos || [],
          modeloIA: resultado.modeloIA,
          confianza: resultado.confianza,
          metadata: metadata
        },
        // Extraer campos del resultado para búsqueda/filtrado
        cuitExtraido: resultado.cabecera?.cuitEmisor || null,
        razonSocialExtraida: resultado.cabecera?.razonSocialEmisor || null,
        importeExtraido: resultado.cabecera?.total || null,
        fechaExtraida: resultado.cabecera?.fecha ? new Date(resultado.cabecera.fecha) : null,
        numeroComprobanteExtraido: resultado.cabecera?.numeroComprobante || null,
        caeExtraido: resultado.cabecera?.cae || null,
        updatedAt: new Date()
      }
    });

    // 3. Aplicar reglas si fue solicitado
    let documentoTransformado = null;
    let reglasAplicadas = [];

    if (aplicarReglas) {
      const engine = new BusinessRulesEngine(req.syncClient.tenantId);
      await engine.loadRules('TRANSFORMACION', true, prisma);

      // Aplicar reglas al documento guardado
      const docParaReglas = {
        cabecera: resultado.cabecera || {},
        items: resultado.items || [],
        impuestos: resultado.impuestos || []
      };

      const resultadoReglas = await engine.applyRulesToDocument(docParaReglas);
      documentoTransformado = resultadoReglas.documentoTransformado;
      reglasAplicadas = resultadoReglas.reglasAplicadas;

      // Actualizar documento con datos transformados
      await prisma.documentos_procesados.update({
        where: { id: documentoGuardado.id },
        data: {
          datosExtraidos: {
            ...documentoGuardado.datosExtraidos,
            transformado: documentoTransformado,
            reglasAplicadas: reglasAplicadas.map(r => ({ codigo: r.codigo, nombre: r.nombre }))
          }
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Documento guardado exitosamente (ID: ${documentoGuardado.id}) en ${duration}ms`);

    const response = {
      success: true,
      documento: {
        id: documentoGuardado.id,
        nombreArchivo: documentoGuardado.nombreArchivo,
        tipoDocumento: documentoGuardado.tipoDocumento,
        estadoProcesamiento: documentoGuardado.estadoProcesamiento,
        fechaProcesamiento: documentoGuardado.fechaProcesamiento,
        cabecera: resultado.cabecera || {},
        items: resultado.items || [],
        impuestos: resultado.impuestos || []
      },
      metadata: {
        processingTimeMs: duration,
        modeloIA: resultado.modeloIA,
        confianza: resultado.confianza
      },
      message: 'Documento guardado exitosamente'
    };

    if (aplicarReglas) {
      response.documentoTransformado = documentoTransformado;
      response.reglasAplicadas = reglasAplicadas;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error guardando documento:', error);
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/v1/parse/stats
 * Obtener estadísticas de uso de patrones y ahorro de IA
 *
 * Query params:
 *   - days: Número de días hacia atrás (default: 30)
 *
 * Response:
 *   - totalRequests: Total de requests de parsing
 *   - patternCacheHits: Veces que se usó cache de patrones
 *   - exactMatchHits: Documentos idénticos (100% ahorro)
 *   - templateHits: Templates de proveedor (60-80% ahorro)
 *   - estimatedSavings: Ahorro estimado en costo y tiempo
 *   - topPatterns: Top 10 patrones más usados
 *   - trends: Tendencias diarias
 */
router.get('/stats', authenticateSyncClient, async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Obtener tenantId desde la API key
    const apiKeyRecord = await prisma.api_keys.findUnique({
      where: { key: apiKey }
    });

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'API key inválida' });
    }

    const tenantId = apiKeyRecord.tenantId;

    // 1. Total de documentos procesados en el período
    const totalRequests = await prisma.documentos_procesados.count({
      where: {
        tenantId,
        fechaProcesamiento: { gte: startDate }
      }
    });

    // 2. Estadísticas de patrones aprendidos
    const patronesStats = await prisma.patrones_aprendidos.findMany({
      where: {
        tenantId,
        ultima_fecha: { gte: startDate }
      },
      select: {
        tipo_patron: true,
        num_ocurrencias: true,
        confianza: true,
        output_campo: true,
        hash_pattern: true
      }
    });

    // 3. Calcular hits de cache
    const exactMatchHits = patronesStats
      .filter(p => p.tipo_patron.includes('hash'))
      .reduce((sum, p) => sum + p.num_ocurrencias, 0);

    const templateHits = patronesStats
      .filter(p => p.tipo_patron.includes('template'))
      .reduce((sum, p) => sum + p.num_ocurrencias, 0);

    const patternCacheHits = exactMatchHits + templateHits;

    // 4. Top 10 patrones más usados
    const topPatterns = patronesStats
      .sort((a, b) => b.num_ocurrencias - a.num_ocurrencias)
      .slice(0, 10)
      .map(p => ({
        type: p.tipo_patron,
        field: p.output_campo,
        hits: p.num_ocurrencias,
        confidence: parseFloat(p.confianza.toFixed(2))
      }));

    // 5. Calcular ahorro estimado
    // Asumiendo:
    // - Costo promedio de IA: $0.003 por documento
    // - Exact match ahorra 100%: $0.003
    // - Template ahorra 60%: $0.0018
    // - Tiempo promedio de IA: 8 segundos
    // - Tiempo con pattern: 1 segundo (exact) o 3 segundos (template)

    const costPerDocument = 0.003;
    const exactMatchSavings = exactMatchHits * costPerDocument;
    const templateSavings = templateHits * (costPerDocument * 0.6);
    const totalCostSavings = exactMatchSavings + templateSavings;

    const timePerDocument = 8; // segundos
    const exactMatchTimeSaved = exactMatchHits * (timePerDocument - 1);
    const templateTimeSaved = templateHits * (timePerDocument - 3);
    const totalTimeSaved = exactMatchTimeSaved + templateTimeSaved;

    // Convertir a horas
    const hoursSaved = (totalTimeSaved / 3600).toFixed(2);

    // 6. Tendencias (agrupado por día)
    const trends = await prisma.$queryRaw`
      SELECT
        DATE(ultima_fecha) as date,
        COUNT(*) as patterns_used,
        SUM(num_ocurrencias) as total_hits
      FROM patrones_aprendidos
      WHERE "tenantId" = ${tenantId}
        AND ultima_fecha >= ${startDate}
      GROUP BY DATE(ultima_fecha)
      ORDER BY date DESC
      LIMIT 30
    `;

    // 7. Tasa de cache hit
    const cacheHitRate = totalRequests > 0
      ? ((patternCacheHits / totalRequests) * 100).toFixed(1)
      : '0.0';

    // 8. Respuesta
    res.json({
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      },
      totalRequests,
      patternCacheHits,
      cacheHitRate: `${cacheHitRate}%`,
      breakdown: {
        exactMatchHits,
        templateHits,
        aiCalls: totalRequests - patternCacheHits
      },
      estimatedSavings: {
        cost: `$${totalCostSavings.toFixed(4)}`,
        time: `${hoursSaved} hours`,
        costBreakdown: {
          exactMatch: `$${exactMatchSavings.toFixed(4)}`,
          template: `$${templateSavings.toFixed(4)}`
        }
      },
      topPatterns,
      trends: trends.map(t => ({
        date: t.date,
        patternsUsed: parseInt(t.patterns_used),
        totalHits: parseInt(t.total_hits)
      }))
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/parse/health
 * Health check endpoint (no requiere autenticación)
 */
router.get('/health', async (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Parse API',
    version: '1.0.0'
  });
});

// ============================================================================
// SINCRONIZACIÓN DE TABLAS MAESTRAS
// ============================================================================

/**
 * GET /api/v1/parse/sync/proveedores
 * Obtiene lista de proveedores del tenant
 *
 * Query params:
 *   - limit: número de registros (default: 100, max: 1000)
 *   - offset: offset para paginación (default: 0)
 *   - search: búsqueda por razón social o CUIT
 *   - activo: filtrar por estado activo (true/false)
 *   - updatedSince: fecha ISO para obtener solo actualizados desde esa fecha
 */
router.get('/sync/proveedores', authenticateSyncClient, async (req, res) => {
  try {
    // Validar permiso
    if (!req.syncClient.permisos.sync) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "sync". La API key debe tener el permiso "sync" habilitado.'
      });
    }

    const {
      limit = 100,
      offset = 0,
      search,
      activo,
      updatedSince
    } = req.query;

    const where = {
      tenantId: req.syncClient.tenantId
    };

    // Filtros opcionales
    if (search) {
      where.OR = [
        { razonSocial: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search } }
      ];
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (updatedSince) {
      where.updatedAt = { gte: new Date(updatedSince) };
    }

    const [proveedores, total] = await Promise.all([
      prisma.proveedores.findMany({
        where,
        take: Math.min(parseInt(limit), 1000),
        skip: parseInt(offset),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          email: true,
          telefono: true,
          direccion: true,
          activo: true,
          lastExportedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.proveedores.count({ where })
    ]);

    res.json({
      success: true,
      data: proveedores,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + proveedores.length)
      }
    });

  } catch (error) {
    console.error('Error sync proveedores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar proveedores'
    });
  }
});

/**
 * GET /api/v1/parse/sync/productos
 * Obtiene lista de productos (parámetros maestros tipo 'producto')
 */
router.get('/sync/productos', authenticateSyncClient, async (req, res) => {
  try {
    if (!req.syncClient.permisos.sync) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "sync"'
      });
    }

    const {
      limit = 100,
      offset = 0,
      search,
      activo,
      updatedSince
    } = req.query;

    const where = {
      tenantId: req.syncClient.tenantId,
      tipo_campo: 'producto'
    };

    if (search) {
      where.OR = [
        { valor: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search } }
      ];
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (updatedSince) {
      where.updatedAt = { gte: new Date(updatedSince) };
    }

    const [productos, total] = await Promise.all([
      prisma.parametros_maestros.findMany({
        where,
        take: Math.min(parseInt(limit), 1000),
        skip: parseInt(offset),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          codigo: true,
          valor: true,
          descripcion: true,
          activo: true,
          lastExportedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.parametros_maestros.count({ where })
    ]);

    res.json({
      success: true,
      data: productos,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + productos.length)
      }
    });

  } catch (error) {
    console.error('Error sync productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar productos'
    });
  }
});

/**
 * GET /api/v1/parse/sync/cuentas-contables
 * Obtiene lista de cuentas contables (parámetros maestros tipo 'cuenta_contable')
 */
router.get('/sync/cuentas-contables', authenticateSyncClient, async (req, res) => {
  try {
    if (!req.syncClient.permisos.sync) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "sync"'
      });
    }

    const {
      limit = 100,
      offset = 0,
      search,
      activo,
      updatedSince
    } = req.query;

    const where = {
      tenantId: req.syncClient.tenantId,
      tipo_campo: 'cuenta_contable'
    };

    if (search) {
      where.OR = [
        { valor: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search } }
      ];
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (updatedSince) {
      where.updatedAt = { gte: new Date(updatedSince) };
    }

    const [cuentas, total] = await Promise.all([
      prisma.parametros_maestros.findMany({
        where,
        take: Math.min(parseInt(limit), 1000),
        skip: parseInt(offset),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          codigo: true,
          valor: true,
          descripcion: true,
          activo: true,
          lastExportedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.parametros_maestros.count({ where })
    ]);

    res.json({
      success: true,
      data: cuentas,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + cuentas.length)
      }
    });

  } catch (error) {
    console.error('Error sync cuentas contables:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar cuentas contables'
    });
  }
});

/**
 * GET /api/v1/parse/sync/centros-costo
 * Obtiene lista de centros de costo (parámetros maestros tipo 'centro_costo')
 */
router.get('/sync/centros-costo', authenticateSyncClient, async (req, res) => {
  try {
    if (!req.syncClient.permisos.sync) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "sync"'
      });
    }

    const {
      limit = 100,
      offset = 0,
      search,
      activo,
      updatedSince
    } = req.query;

    const where = {
      tenantId: req.syncClient.tenantId,
      tipo_campo: 'centro_costo'
    };

    if (search) {
      where.OR = [
        { valor: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search } }
      ];
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (updatedSince) {
      where.updatedAt = { gte: new Date(updatedSince) };
    }

    const [centros, total] = await Promise.all([
      prisma.parametros_maestros.findMany({
        where,
        take: Math.min(parseInt(limit), 1000),
        skip: parseInt(offset),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          codigo: true,
          valor: true,
          descripcion: true,
          activo: true,
          lastExportedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.parametros_maestros.count({ where })
    ]);

    res.json({
      success: true,
      data: centros,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + centros.length)
      }
    });

  } catch (error) {
    console.error('Error sync centros de costo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar centros de costo'
    });
  }
});

/**
 * GET /api/v1/parse/sync/documentos
 * Obtiene lista de documentos procesados
 */
router.get('/sync/documentos', authenticateSyncClient, async (req, res) => {
  try {
    if (!req.syncClient.permisos.sync) {
      return res.status(403).json({
        success: false,
        error: 'Sin permiso "sync"'
      });
    }

    const {
      limit = 100,
      offset = 0,
      tipoComprobante,
      proveedorId,
      updatedSince,
      exportedOnly = false
    } = req.query;

    const where = {
      tenantId: req.syncClient.tenantId,
      estadoProcesamiento: 'completado'
    };

    if (tipoComprobante) {
      where.tipoComprobanteExtraido = tipoComprobante;
    }

    if (proveedorId) {
      where.proveedorId = proveedorId;
    }

    if (updatedSince) {
      where.updatedAt = { gte: new Date(updatedSince) };
    }

    if (exportedOnly === 'true') {
      where.exportado = true;
    }

    const [documentos, total] = await Promise.all([
      prisma.documentos_procesados.findMany({
        where,
        take: Math.min(parseInt(limit), 1000),
        skip: parseInt(offset),
        orderBy: { updatedAt: 'desc' },
        include: {
          proveedor: {
            select: {
              razonSocial: true,
              cuit: true
            }
          },
          documento_lineas: {
            select: {
              id: true,
              numeroLinea: true,
              descripcion: true,
              cantidad: true,
              precioUnitario: true,
              subtotal: true,
              cuentaContable: true
            }
          },
          documento_impuestos: {
            select: {
              id: true,
              tipoImpuesto: true,
              baseImponible: true,
              tasaPorcentaje: true,
              importeImpuesto: true,
              cuentaContable: true
            }
          }
        }
      }),
      prisma.documentos_procesados.count({ where })
    ]);

    res.json({
      success: true,
      data: documentos,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + documentos.length)
      }
    });

  } catch (error) {
    console.error('Error sync documentos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar documentos'
    });
  }
});

module.exports = router;
