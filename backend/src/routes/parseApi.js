const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateSyncClient } = require('../middleware/syncAuth');
const DocumentProcessor = require('../lib/documentProcessor');
const BusinessRulesEngine = require('../services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs').promises;
const path = require('path');

// Instancia global de DocumentProcessor
const documentProcessor = new DocumentProcessor();

// Configurar multer para subida de archivos
const upload = multer({
  dest: 'uploads/api-parse/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * POST /api/v1/parse/document
 * Parsear documento y devolver JSON (sin guardar en BD)
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
 *       "impuestos": [...]
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

    console.log(`📄 [Parse API] Procesando documento para tenant: ${req.syncClient.tenant.nombre}`);
    console.log(`   Archivo: ${file.originalname}`);
    console.log(`   Tamaño: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`   Tipo: ${file.mimetype}`);

    // Procesar documento usando el pipeline existente
    const resultado = await documentProcessor.processFileForAPI(
      file.path,
      req.syncClient.tenantId,
      tipoDocumento
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
    // Reutilizamos la lógica del endpoint POST /api/documentos
    const documentoGuardado = await prisma.documentos_procesados.create({
      data: {
        tenantId: req.syncClient.tenantId,
        nombreArchivo: file.originalname,
        pathArchivo: file.path,
        tipoDocumento: resultado.tipoDocumento || tipoDocumento,
        estadoProcesamiento: 'completado',
        fechaProcesamiento: new Date(),
        datosExtraidos: {
          cabecera: resultado.cabecera || {},
          items: resultado.items || [],
          impuestos: resultado.impuestos || [],
          modeloIA: resultado.modeloIA,
          confianza: resultado.confianza,
          metadata: metadata
        },
        ...metadata, // Permite extender con campos personalizados
        createdAt: new Date(),
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

module.exports = router;
