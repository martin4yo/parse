/**
 * API de Sincronizacion Generica
 * Endpoints para recibir datos de Hub y sincronizar con ERPs
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const SyncDataService = require('../services/syncDataService');
const erpSyncProcessor = require('../services/erpSyncProcessor');
const { requireSyncPermission } = require('../middleware/syncAuth');

const prisma = new PrismaClient();

/**
 * POST /api/sync-data
 * Recibir datos de Hub para sincronizar
 */
router.post('/', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { entityType, entityId, erpType, payload, userId } = req.body;
    const tenantId = req.syncClient?.tenantId;

    if (!entityType || !entityId || !erpType || !payload) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: entityType, entityId, erpType, payload'
      });
    }

    const result = await SyncDataService.enqueue({
      tenantId,
      entityType,
      entityId,
      erpType,
      payload,
      direction: 'OUT',
      sourceSystem: 'HUB',
      sourceUserId: userId || null
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-data/batch
 * Recibir multiples registros
 */
router.post('/batch', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { items } = req.body;
    const tenantId = req.syncClient?.tenantId;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de items'
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximo 100 items por batch'
      });
    }

    const results = [];
    for (const item of items) {
      try {
        const result = await SyncDataService.enqueue({
          tenantId,
          entityType: item.entityType,
          entityId: item.entityId,
          erpType: item.erpType,
          payload: item.payload,
          direction: 'OUT',
          sourceSystem: 'HUB',
          sourceUserId: item.userId || null
        });
        results.push({ entityId: item.entityId, ...result });
      } catch (err) {
        results.push({ entityId: item.entityId, action: 'ERROR', error: err.message });
      }
    }

    res.json({
      success: true,
      results,
      total: items.length,
      processed: results.filter(r => r.action !== 'ERROR').length
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-data/pending
 * Listar registros pendientes
 */
router.get('/pending', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType, limit } = req.query;

    const pending = await SyncDataService.getPending({
      tenantId,
      entityType,
      erpType,
      limit: parseInt(limit) || 100
    });

    res.json({
      success: true,
      data: pending,
      count: pending.length
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error pending:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-data/stats
 * Estadisticas de sincronizacion
 */
router.get('/stats', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const stats = await SyncDataService.getStats(tenantId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-data/history
 * Historial de sincronizacion
 */
router.get('/history', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType, status, limit, offset } = req.query;

    const history = await SyncDataService.getHistory({
      tenantId,
      entityType,
      erpType,
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      success: true,
      ...history
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-data/:entityType/:entityId/status
 * Obtener estado de sincronizacion de un registro
 */
router.get('/:entityType/:entityId/status', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { erpType } = req.query;
    const tenantId = req.syncClient?.tenantId;

    // Si se especifica erpType, obtener solo ese status
    if (erpType) {
      const status = await SyncDataService.getStatus(tenantId, entityType, entityId, erpType);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Registro no encontrado'
        });
      }

      return res.json({
        success: true,
        data: status
      });
    }

    // Si no se especifica, obtener todos los statuses
    const statuses = await SyncDataService.getAllStatuses(tenantId, entityType, entityId);

    if (statuses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    res.json({
      success: true,
      data: statuses
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-data/:id
 * Obtener registro completo con payload
 */
router.get('/:id', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.syncClient?.tenantId;

    const record = await SyncDataService.getById(id);

    if (!record || record.tenantId !== tenantId) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    res.json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error get:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-data/:id/complete
 * Marcar registro como completado (usado por procesador ERP)
 */
router.post('/:id/complete', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { id } = req.params;
    const { externalId } = req.body;
    const tenantId = req.syncClient?.tenantId;

    // Verificar que el registro pertenece al tenant
    const existing = await SyncDataService.getById(id);
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    const updated = await SyncDataService.markAsCompleted(id, externalId);

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        externalId: updated.externalId,
        syncedAt: updated.syncedAt
      }
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error complete:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-data/:id/fail
 * Marcar registro como fallido
 */
router.post('/:id/fail', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { id } = req.params;
    const { errorMessage } = req.body;
    const tenantId = req.syncClient?.tenantId;

    // Verificar que el registro pertenece al tenant
    const existing = await SyncDataService.getById(id);
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    const updated = await SyncDataService.markAsFailed(id, errorMessage || 'Unknown error');

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        errorMessage: updated.errorMessage,
        retryCount: updated.retryCount
      }
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error fail:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-data/retry-failed
 * Reintentar todos los registros fallidos
 */
router.post('/retry-failed', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType } = req.body;

    const result = await SyncDataService.retryFailed(tenantId, entityType);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error retry-failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-data/process
 * Procesar registros pendientes y enviar a ERP
 */
router.post('/process', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType, limit } = req.body;

    const result = await erpSyncProcessor.processPending({
      tenantId,
      entityType,
      erpType,
      limit: parseInt(limit) || 10
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error process:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-data/pull/:entityType
 * Obtener datos de una entidad (para que Hub consuma datos del ERP via Parse)
 * Usado cuando direction = 'IN' (ERP → Parse → Hub)
 */
router.get('/pull/:entityType', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType } = req.params;
    const { status, since, limit, offset } = req.query;

    const where = {
      tenantId,
      entityType,
      direction: 'IN', // Solo datos que vienen del ERP
    };

    if (status) where.status = status;
    if (since) {
      where.updatedAt = { gte: new Date(since) };
    }

    const [records, total] = await Promise.all([
      prisma.sync_data.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: parseInt(offset) || 0,
        take: parseInt(limit) || 100,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          erpType: true,
          payload: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.sync_data.count({ where })
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        hasMore: (parseInt(offset) || 0) + records.length < total
      }
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error pull:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-data/from-erp
 * Recibir datos del ERP para enviar a Hub (direction = 'IN')
 * Usado por el procesador ERP cuando obtiene datos nuevos
 */
router.post('/from-erp', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, entityId, erpType, payload } = req.body;

    if (!entityType || !entityId || !erpType || !payload) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: entityType, entityId, erpType, payload'
      });
    }

    const result = await SyncDataService.enqueue({
      tenantId,
      entityType,
      entityId,
      erpType,
      payload,
      direction: 'IN', // Viene del ERP, va hacia Hub
      sourceSystem: 'ERP',
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error from-erp:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sync-data/:id
 * Eliminar registro
 */
router.delete('/:id', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.syncClient?.tenantId;

    // Verificar que el registro pertenece al tenant
    const existing = await SyncDataService.getById(id);
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    await SyncDataService.delete(id);

    res.json({
      success: true,
      message: 'Registro eliminado'
    });

  } catch (error) {
    console.error('[SYNC-DATA] Error delete:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
