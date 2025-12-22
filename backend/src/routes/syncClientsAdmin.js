const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authWithTenant } = require('../middleware/authWithTenant');

const prisma = new PrismaClient();

/**
 * GET /api/sync-clients
 * Lista todos los sync clients del tenant
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { activo, estado } = req.query;

    const where = { tenantId };

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (estado) {
      where.estado = estado;
    }

    const clients = await prisma.sync_clients.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        hostname: true,
        plataforma: true,
        version: true,
        estado: true,
        ultimoHeartbeat: true,
        ultimaIp: true,
        documentosProcesados: true,
        erroresCount: true,
        ultimoError: true,
        ultimoDocumento: true,
        activo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Calcular si está online (heartbeat < 5 min)
    const clientsWithStatus = clients.map(client => {
      const heartbeatThreshold = 5 * 60 * 1000; // 5 minutos
      const isOnline = client.ultimoHeartbeat &&
        (Date.now() - new Date(client.ultimoHeartbeat).getTime()) < heartbeatThreshold;

      return {
        ...client,
        isOnline,
        lastSeenAgo: client.ultimoHeartbeat
          ? Math.floor((Date.now() - new Date(client.ultimoHeartbeat).getTime()) / 1000)
          : null
      };
    });

    res.json({
      success: true,
      data: clientsWithStatus
    });

  } catch (error) {
    console.error('Error listando sync clients:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener clientes'
    });
  }
});

/**
 * GET /api/sync-clients/:id
 * Obtiene detalle de un sync client incluyendo config
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const client = await prisma.sync_clients.findFirst({
      where: { id, tenantId }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Calcular estado online
    const heartbeatThreshold = 5 * 60 * 1000;
    const isOnline = client.ultimoHeartbeat &&
      (Date.now() - new Date(client.ultimoHeartbeat).getTime()) < heartbeatThreshold;

    res.json({
      success: true,
      data: {
        ...client,
        isOnline,
        lastSeenAgo: client.ultimoHeartbeat
          ? Math.floor((Date.now() - new Date(client.ultimoHeartbeat).getTime()) / 1000)
          : null
      }
    });

  } catch (error) {
    console.error('Error obteniendo sync client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente'
    });
  }
});

/**
 * PUT /api/sync-clients/:id
 * Actualiza configuración de un sync client
 */
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { nombre, config, activo } = req.body;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.sync_clients.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    const updateData = { updatedAt: new Date() };

    if (nombre !== undefined) updateData.nombre = nombre;
    if (config !== undefined) updateData.config = config;
    if (activo !== undefined) updateData.activo = activo;

    const updated = await prisma.sync_clients.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updated,
      message: 'Cliente actualizado'
    });

  } catch (error) {
    console.error('Error actualizando sync client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cliente'
    });
  }
});

/**
 * DELETE /api/sync-clients/:id
 * Elimina un sync client
 */
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.sync_clients.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Los logs se eliminan en cascada
    await prisma.sync_clients.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Cliente eliminado'
    });

  } catch (error) {
    console.error('Error eliminando sync client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cliente'
    });
  }
});

/**
 * GET /api/sync-clients/:id/logs
 * Obtiene logs de un sync client
 */
router.get('/:id/logs', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { nivel, limit = 100, offset = 0 } = req.query;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.sync_clients.findFirst({
      where: { id, tenantId },
      select: { id: true }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    const where = { clientId: id };
    if (nivel) {
      where.nivel = nivel;
    }

    const [logs, total] = await Promise.all([
      prisma.sync_client_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.sync_client_logs.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + logs.length < total
      }
    });

  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener logs'
    });
  }
});

/**
 * DELETE /api/sync-clients/:id/logs
 * Elimina logs de un sync client (limpieza)
 */
router.delete('/:id/logs', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { olderThanDays = 30 } = req.query;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.sync_clients.findFirst({
      where: { id, tenantId },
      select: { id: true }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));

    const result = await prisma.sync_client_logs.deleteMany({
      where: {
        clientId: id,
        createdAt: { lt: cutoffDate }
      }
    });

    res.json({
      success: true,
      message: `${result.count} logs eliminados`,
      deletedCount: result.count
    });

  } catch (error) {
    console.error('Error eliminando logs:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar logs'
    });
  }
});

/**
 * GET /api/sync-clients/:id/stats
 * Obtiene estadísticas del cliente
 */
router.get('/:id/stats', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { days = 7 } = req.query;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.sync_clients.findFirst({
      where: { id, tenantId }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Contar logs por nivel
    const logsByLevel = await prisma.sync_client_logs.groupBy({
      by: ['nivel'],
      where: {
        clientId: id,
        createdAt: { gte: startDate }
      },
      _count: { id: true }
    });

    // Contar logs por día
    const logsPerDay = await prisma.$queryRaw`
      SELECT
        DATE(createdAt) as fecha,
        COUNT(*) as total,
        SUM(CASE WHEN nivel = 'error' THEN 1 ELSE 0 END) as errores
      FROM sync_client_logs
      WHERE clientId = ${id}
        AND createdAt >= ${startDate}
      GROUP BY DATE(createdAt)
      ORDER BY fecha DESC
    `;

    res.json({
      success: true,
      data: {
        client: {
          documentosProcesados: client.documentosProcesados,
          erroresCount: client.erroresCount,
          ultimoHeartbeat: client.ultimoHeartbeat,
          estado: client.estado
        },
        logsByLevel: logsByLevel.reduce((acc, item) => {
          acc[item.nivel] = item._count.id;
          return acc;
        }, {}),
        logsPerDay
      }
    });

  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

module.exports = router;
