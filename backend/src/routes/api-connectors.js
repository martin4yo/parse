/**
 * API Connectors - Endpoints CRUD
 *
 * Gestión completa de conectores API:
 * - CRUD de configuraciones
 * - Ejecutar sincronizaciones PULL
 * - Gestionar staging de validación
 * - Ver logs de sincronizaciones
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const ApiPullService = require('../services/apiPullService');
const ApiPushService = require('../services/apiPushService');

const prisma = new PrismaClient();

// ============================================================================
// CRUD DE CONFIGURACIONES
// ============================================================================

/**
 * GET /api/api-connectors
 * Lista todas las configuraciones de conectores del tenant
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { direction, activo } = req.query;

    const where = { tenantId };

    if (direction) {
      where.direction = direction;
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    const connectors = await prisma.api_connector_configs.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        direction: true,
        baseUrl: true,
        authType: true,
        lastPullSync: true,
        lastPullStatus: true,
        lastPushSync: true,
        lastPushStatus: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true
      }
    });

    res.json({
      success: true,
      data: connectors
    });

  } catch (error) {
    console.error('Error obteniendo conectores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener conectores'
    });
  }
});

/**
 * GET /api/api-connectors/:id
 * Obtiene una configuración completa por ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    res.json({
      success: true,
      data: connector
    });

  } catch (error) {
    console.error('Error obteniendo conector:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener conector'
    });
  }
});

/**
 * POST /api/api-connectors
 * Crea una nueva configuración de conector
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const {
      nombre,
      descripcion,
      direction,
      baseUrl,
      authType,
      authConfig,
      pullResources,
      pushResources,
      pullFieldMapping,
      pushFieldMapping,
      requireValidation,
      validationRules,
      pullSchedule,
      pushSchedule,
      callbackConfig
    } = req.body;

    // Validaciones básicas
    if (!nombre || !direction || !baseUrl || !authType) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: nombre, direction, baseUrl, authType'
      });
    }

    if (!['PULL', 'PUSH', 'BIDIRECTIONAL'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: 'direction debe ser: PULL, PUSH o BIDIRECTIONAL'
      });
    }

    // Validar que PULL tenga recursos configurados
    if ((direction === 'PULL' || direction === 'BIDIRECTIONAL') && (!pullResources || pullResources.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Configuraciones PULL requieren al menos un recurso en pullResources'
      });
    }

    // Validar que PUSH tenga recursos configurados (solo para PUSH puro, no BIDIRECTIONAL aún)
    // BIDIRECTIONAL es opcional por ahora ya que PUSH se implementará en Sprint 3
    if (direction === 'PUSH' && (!pushResources || pushResources.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Configuraciones PUSH requieren al menos un recurso en pushResources'
      });
    }

    const connector = await prisma.api_connector_configs.create({
      data: {
        tenantId,
        nombre,
        descripcion,
        direction,
        baseUrl,
        authType,
        authConfig,
        pullResources,
        pushResources,
        pullFieldMapping,
        pushFieldMapping,
        requireValidation: requireValidation || false,
        validationRules,
        pullSchedule,
        pushSchedule,
        callbackConfig,
        activo: true,
        createdBy: userId
      }
    });

    console.log(`✅ Conector creado: ${connector.nombre} (${connector.id})`);

    res.status(201).json({
      success: true,
      data: connector
    });

  } catch (error) {
    console.error('Error creando conector:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear conector'
    });
  }
});

/**
 * PUT /api/api-connectors/:id
 * Actualiza una configuración existente
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Verificar que existe y pertenece al tenant
    const existente = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    // Campos actualizables
    const {
      nombre,
      descripcion,
      activo,
      baseUrl,
      authType,
      authConfig,
      pullResources,
      pushResources,
      pullFieldMapping,
      pushFieldMapping,
      requireValidation,
      validationRules,
      pullSchedule,
      pushSchedule,
      callbackConfig
    } = req.body;

    const updateData = {};

    if (nombre !== undefined) updateData.nombre = nombre;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (activo !== undefined) updateData.activo = activo;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (authType !== undefined) updateData.authType = authType;
    if (authConfig !== undefined) updateData.authConfig = authConfig;
    if (pullResources !== undefined) updateData.pullResources = pullResources;
    if (pushResources !== undefined) updateData.pushResources = pushResources;
    if (pullFieldMapping !== undefined) updateData.pullFieldMapping = pullFieldMapping;
    if (pushFieldMapping !== undefined) updateData.pushFieldMapping = pushFieldMapping;
    if (requireValidation !== undefined) updateData.requireValidation = requireValidation;
    if (validationRules !== undefined) updateData.validationRules = validationRules;
    if (pullSchedule !== undefined) updateData.pullSchedule = pullSchedule;
    if (pushSchedule !== undefined) updateData.pushSchedule = pushSchedule;
    if (callbackConfig !== undefined) updateData.callbackConfig = callbackConfig;

    const updated = await prisma.api_connector_configs.update({
      where: { id },
      data: updateData
    });

    console.log(`✅ Conector actualizado: ${updated.nombre}`);

    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error('Error actualizando conector:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar conector'
    });
  }
});

/**
 * DELETE /api/api-connectors/:id
 * Elimina una configuración (soft delete - marca como inactivo)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { hardDelete } = req.query;

    const existente = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    if (hardDelete === 'true') {
      // Hard delete (eliminar completamente)
      await prisma.api_connector_configs.delete({
        where: { id }
      });
      console.log(`🗑️ Conector eliminado (hard): ${existente.nombre}`);
    } else {
      // Soft delete (marcar como inactivo)
      await prisma.api_connector_configs.update({
        where: { id },
        data: { activo: false }
      });
      console.log(`🔒 Conector desactivado: ${existente.nombre}`);
    }

    res.json({
      success: true,
      message: hardDelete === 'true' ? 'Conector eliminado' : 'Conector desactivado'
    });

  } catch (error) {
    console.error('Error eliminando conector:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar conector'
    });
  }
});

// ============================================================================
// EJECUCIÓN DE SINCRONIZACIONES
// ============================================================================

/**
 * POST /api/api-connectors/:id/pull
 * Ejecuta una sincronización PULL
 */
router.post('/:id/pull', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { resourceId } = req.body;

    // Verificar que existe y pertenece al tenant
    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    if (!connector.activo) {
      return res.status(400).json({
        success: false,
        error: 'El conector está desactivado'
      });
    }

    // Inicializar servicio y ejecutar PULL
    const pullService = new ApiPullService(id);
    await pullService.initialize();

    const result = await pullService.executePull(resourceId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error ejecutando PULL:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al ejecutar sincronización PULL'
    });
  }
});

/**
 * POST /api/api-connectors/:id/test-connection
 * Prueba la conexión y autenticación del conector
 */
router.post('/:id/test-connection', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    // Inicializar servicio para probar autenticación
    const pullService = new ApiPullService(id);
    await pullService.initialize();

    // Intentar hacer un request simple (GET al baseUrl)
    try {
      await pullService.makeRequest({
        method: 'GET',
        endpoint: '/',
        maxRetries: 1
      });

      res.json({
        success: true,
        message: 'Conexión exitosa'
      });

    } catch (error) {
      res.json({
        success: false,
        message: 'Conexión falló',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Error probando conexión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al probar conexión'
    });
  }
});

// ============================================================================
// GESTIÓN DE STAGING
// ============================================================================

/**
 * GET /api/api-connectors/:id/staging
 * Lista registros en staging pendientes de validación
 */
router.get('/:id/staging', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { validationStatus, limit = 50, offset = 0 } = req.query;

    const where = {
      configId: id,
      tenantId
    };

    if (validationStatus) {
      where.validationStatus = validationStatus;
    }

    const [staging, total] = await Promise.all([
      prisma.api_sync_staging.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.api_sync_staging.count({ where })
    ]);

    res.json({
      success: true,
      data: staging,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo staging:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener registros de staging'
    });
  }
});

/**
 * POST /api/api-connectors/:id/staging/process
 * Procesa (valida y aprueba) un batch de registros en staging
 */
router.post('/:id/staging/process', authMiddleware, async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;
    const { stagingIds } = req.body;

    if (!stagingIds || !Array.isArray(stagingIds) || stagingIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'stagingIds requerido (array de IDs)'
      });
    }

    // Verificar que todos los registros pertenecen al tenant
    const staging = await prisma.api_sync_staging.findMany({
      where: {
        id: { in: stagingIds },
        configId: id,
        tenantId
      }
    });

    if (staging.length !== stagingIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Algunos registros no fueron encontrados o no pertenecen al tenant'
      });
    }

    // Inicializar servicio y procesar batch
    const pullService = new ApiPullService(id);
    await pullService.initialize();

    const result = await pullService.processStagingBatch(stagingIds, userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error procesando staging:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar registros de staging'
    });
  }
});

/**
 * DELETE /api/api-connectors/:id/staging/:stagingId
 * Elimina un registro de staging (rechazar importación)
 */
router.delete('/:id/staging/:stagingId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id, stagingId } = req.params;

    const staging = await prisma.api_sync_staging.findFirst({
      where: {
        id: stagingId,
        configId: id,
        tenantId
      }
    });

    if (!staging) {
      return res.status(404).json({
        success: false,
        error: 'Registro de staging no encontrado'
      });
    }

    await prisma.api_sync_staging.delete({
      where: { id: stagingId }
    });

    res.json({
      success: true,
      message: 'Registro rechazado y eliminado'
    });

  } catch (error) {
    console.error('Error eliminando staging:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar registro de staging'
    });
  }
});

// ============================================================================
// LOGS DE SINCRONIZACIONES
// ============================================================================

/**
 * GET /api/api-connectors/:id/pull-logs
 * Lista logs de sincronizaciones PULL
 */
router.get('/:id/pull-logs', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    const where = {
      configId: id,
      tenantId
    };

    if (status) {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.api_pull_logs.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.api_pull_logs.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo logs PULL:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener logs'
    });
  }
});

/**
 * GET /api/api-connectors/:id/export-logs
 * Lista logs de exportaciones (PUSH)
 */
router.get('/:id/export-logs', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    const where = {
      configId: id,
      tenantId
    };

    if (status) {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.api_export_logs.findMany({
        where,
        orderBy: { exportedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.api_export_logs.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo logs de exportación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener logs'
    });
  }
});

// ============================================================================
// EXPORTACIÓN (PUSH)
// ============================================================================

/**
 * POST /api/api-connectors/:id/execute-push
 * Ejecuta exportación PUSH (manual o programada)
 */
router.post('/:id/execute-push', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { forceAll = false, limit = 100 } = req.body;

    // Verificar que el conector existe y pertenece al tenant
    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    // Verificar que está activo
    if (!connector.activo) {
      return res.status(400).json({
        success: false,
        error: 'El conector está desactivado'
      });
    }

    // Verificar que soporta PUSH
    if (connector.direction !== 'PUSH' && connector.direction !== 'BIDIRECTIONAL') {
      return res.status(400).json({
        success: false,
        error: 'Este conector no está configurado para exportación PUSH'
      });
    }

    // Ejecutar exportación
    console.log(`\n🚀 [API] Ejecutando PUSH para conector ${connector.nombre}...`);

    const result = await ApiPushService.executePush(id, { forceAll, limit });

    // Actualizar estado del último PUSH
    await prisma.api_connector_configs.update({
      where: { id },
      data: {
        lastPushSync: new Date(),
        lastPushStatus: result.failed === 0 ? 'SUCCESS' :
                       result.success === 0 ? 'FAILED' : 'PARTIAL'
      }
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error ejecutando PUSH:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al ejecutar exportación'
    });
  }
});

/**
 * POST /api/api-connectors/:id/export-document/:documentoId
 * Exporta un documento específico manualmente
 */
router.post('/:id/export-document/:documentoId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id, documentoId } = req.params;

    // Verificar que el conector existe y pertenece al tenant
    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    // Verificar que el documento existe y pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id: documentoId, tenantId }
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Exportar documento
    console.log(`\n📤 [API] Exportando documento ${documentoId} a ${connector.nombre}...`);

    const result = await ApiPushService.exportDocument(id, documentoId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error exportando documento:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al exportar documento'
    });
  }
});

/**
 * GET /api/api-connectors/:id/export-stats
 * Obtiene estadísticas de exportación de un conector
 */
router.get('/:id/export-stats', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { startDate, endDate, resourceType } = req.query;

    // Verificar que el conector existe y pertenece al tenant
    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    const stats = await ApiPushService.getExportStats(id, {
      startDate,
      endDate,
      resourceType
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de exportación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * GET /api/api-connectors/:id/pending-exports
 * Lista documentos pendientes de exportar
 */
router.get('/:id/pending-exports', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verificar que el conector existe y pertenece al tenant
    const connector = await prisma.api_connector_configs.findFirst({
      where: { id, tenantId }
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Conector no encontrado'
      });
    }

    // Obtener documentos pendientes de exportar
    const where = {
      tenantId,
      estadoProcesamiento: 'completado',
      lastExportedAt: null
    };

    const [documentos, total] = await Promise.all([
      prisma.documentos_procesados.findMany({
        where,
        orderBy: { fechaCarga: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          numeroComprobante: true,
          fechaComprobante: true,
          totalComprobante: true,
          tipoComprobante: true,
          proveedor: {
            select: {
              razonSocial: true,
              cuit: true
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
        hasMore: total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo documentos pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener documentos pendientes'
    });
  }
});

/**
 * GET /api/api-connectors/:id/document-export-history/:documentoId
 * Obtiene historial de exportaciones de un documento
 */
router.get('/:id/document-export-history/:documentoId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id, documentoId } = req.params;

    // Verificar que el documento existe y pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id: documentoId, tenantId }
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    const history = await ApiPushService.getDocumentExportHistory(documentoId);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error obteniendo historial de exportación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial'
    });
  }
});

module.exports = router;
