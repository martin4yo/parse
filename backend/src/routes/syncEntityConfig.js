/**
 * API de Configuracion de Entidades para Sync
 * Administra las configuraciones de mapeo entre Hub y ERPs
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireSyncPermission } = require('../middleware/syncAuth');

const prisma = new PrismaClient();

/**
 * GET /api/sync-entity-config
 * Listar configuraciones del tenant
 */
router.get('/', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType, enabled } = req.query;

    const where = { tenantId };
    if (entityType) where.entityType = entityType;
    if (erpType) where.erpType = erpType;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const configs = await prisma.sync_entity_config.findMany({
      where,
      orderBy: [{ entityType: 'asc' }, { erpType: 'asc' }]
    });

    res.json({
      success: true,
      data: configs,
      count: configs.length
    });

  } catch (error) {
    console.error('[SYNC-CONFIG] Error listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync-entity-config/:entityType/:erpType
 * Obtener configuracion especifica
 */
router.get('/:entityType/:erpType', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType } = req.params;

    const config = await prisma.sync_entity_config.findUnique({
      where: {
        tenantId_entityType_erpType: {
          tenantId,
          entityType,
          erpType
        }
      }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuracion no encontrada'
      });
    }

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('[SYNC-CONFIG] Error getting:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-entity-config
 * Crear configuracion
 */
router.post('/', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const {
      entityType,
      erpType,
      sourceTable,
      primaryKey,
      timestampField,
      queries,
      fieldMapping,
      transformRules,
      direction,
      enabled,
      syncFrequency
    } = req.body;

    if (!entityType || !erpType || !direction) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: entityType, erpType, direction'
      });
    }

    const config = await prisma.sync_entity_config.create({
      data: {
        tenantId,
        entityType,
        erpType,
        sourceTable,
        primaryKey,
        timestampField,
        queries: queries || {},
        fieldMapping: fieldMapping || {},
        transformRules,
        direction,
        enabled: enabled !== false,
        syncFrequency
      }
    });

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('[SYNC-CONFIG] Error creating:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una configuracion para esta entidad/ERP'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sync-entity-config/:entityType/:erpType
 * Actualizar configuracion
 */
router.put('/:entityType/:erpType', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType } = req.params;
    const {
      sourceTable,
      primaryKey,
      timestampField,
      queries,
      fieldMapping,
      transformRules,
      direction,
      enabled,
      syncFrequency
    } = req.body;

    const config = await prisma.sync_entity_config.update({
      where: {
        tenantId_entityType_erpType: {
          tenantId,
          entityType,
          erpType
        }
      },
      data: {
        sourceTable,
        primaryKey,
        timestampField,
        queries,
        fieldMapping,
        transformRules,
        direction,
        enabled,
        syncFrequency
      }
    });

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('[SYNC-CONFIG] Error updating:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Configuracion no encontrada'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sync-entity-config/:entityType/:erpType
 * Eliminar configuracion
 */
router.delete('/:entityType/:erpType', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;
    const { entityType, erpType } = req.params;

    await prisma.sync_entity_config.delete({
      where: {
        tenantId_entityType_erpType: {
          tenantId,
          entityType,
          erpType
        }
      }
    });

    res.json({
      success: true,
      message: 'Configuracion eliminada'
    });

  } catch (error) {
    console.error('[SYNC-CONFIG] Error deleting:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Configuracion no encontrada'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-entity-config/seed-axioma
 * Crear configuraciones por defecto para AXIOMA
 */
router.post('/seed-axioma', requireSyncPermission('sync'), async (req, res) => {
  try {
    const tenantId = req.syncClient?.tenantId;

    const configs = [
      {
        tenantId,
        entityType: 'PURCHASE_ORDER',
        erpType: 'AXIOMA',
        sourceTable: 'dbo.OrdenesCom',
        primaryKey: 'ID',
        direction: 'OUT',
        enabled: true,
        syncFrequency: 'realtime',
        queries: {
          insert: `
            INSERT INTO dbo.OrdenesCom (
              NumeroOC, FechaOC, ProveedorCUIT, ProveedorNombre,
              Subtotal, Impuestos, Total, Estado, FechaImportacion
            ) OUTPUT INSERTED.ID VALUES (
              @numero, @fecha, @proveedorCuit, @proveedorNombre,
              @subtotal, @impuestos, @total, 'PENDIENTE', GETDATE()
            )
          `,
          update: `
            UPDATE dbo.OrdenesCom SET
              ProveedorCUIT = @proveedorCuit,
              ProveedorNombre = @proveedorNombre,
              Subtotal = @subtotal,
              Impuestos = @impuestos,
              Total = @total,
              Estado = @estado
            WHERE NumeroOC = @numero
          `
        },
        fieldMapping: {
          hub_to_erp: {
            'numero': 'numero',
            'fecha': 'fecha',
            'proveedor.cuit': 'proveedorCuit',
            'proveedor.razonSocial': 'proveedorNombre',
            'subtotal': 'subtotal',
            'impuestos': 'impuestos',
            'total': 'total',
            'estado': 'estado'
          }
        }
      },
      {
        tenantId,
        entityType: 'RECEPTION',
        erpType: 'AXIOMA',
        sourceTable: 'dbo.Recepciones',
        primaryKey: 'ID',
        direction: 'OUT',
        enabled: true,
        syncFrequency: 'realtime',
        queries: {
          insert: `
            INSERT INTO dbo.Recepciones (
              NumeroRecepcion, OrdenCompraID, FechaRecepcion,
              Estado, FechaImportacion
            ) OUTPUT INSERTED.ID VALUES (
              @numero, @ordenCompraId, @fecha, 'RECIBIDO', GETDATE()
            )
          `
        },
        fieldMapping: {
          hub_to_erp: {
            'numero': 'numero',
            'ordenCompraId': 'ordenCompraId',
            'fecha': 'fecha'
          }
        }
      }
    ];

    const results = [];
    for (const config of configs) {
      try {
        const created = await prisma.sync_entity_config.upsert({
          where: {
            tenantId_entityType_erpType: {
              tenantId: config.tenantId,
              entityType: config.entityType,
              erpType: config.erpType
            }
          },
          update: config,
          create: config
        });
        results.push({ entityType: config.entityType, action: 'OK', id: created.id });
      } catch (err) {
        results.push({ entityType: config.entityType, action: 'ERROR', error: err.message });
      }
    }

    res.json({
      success: true,
      results,
      message: 'Configuraciones AXIOMA creadas/actualizadas'
    });

  } catch (error) {
    console.error('[SYNC-CONFIG] Error seeding:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
