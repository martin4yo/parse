/**
 * Webhooks - Endpoints CRUD
 *
 * Gestión de webhooks para notificaciones de eventos
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { getWebhookStats, EVENTOS } = require('../services/webhookService');

const prisma = new PrismaClient();

/**
 * GET /api/webhooks
 * Lista todos los webhooks del tenant
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;

    const webhooks = await prisma.webhooks.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: webhooks
    });

  } catch (error) {
    console.error('Error obteniendo webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener webhooks'
    });
  }
});

/**
 * GET /api/webhooks/:id
 * Obtiene un webhook por ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    res.json({
      success: true,
      data: webhook
    });

  } catch (error) {
    console.error('Error obteniendo webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener webhook'
    });
  }
});

/**
 * POST /api/webhooks
 * Crea un nuevo webhook
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { nombre, url, eventos } = req.body;

    // Validación
    if (!nombre || !url || !eventos) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: nombre, url, eventos'
      });
    }

    // Validar URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }

    // Validar eventos
    const eventosValidos = Object.values(EVENTOS);
    const eventosInvalidos = eventos.filter(e => !eventosValidos.includes(e));

    if (eventosInvalidos.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Eventos inválidos: ${eventosInvalidos.join(', ')}`,
        eventosValidos
      });
    }

    // Generar secret
    const secret = `whsec_${require('crypto').randomBytes(32).toString('hex')}`;

    const webhook = await prisma.webhooks.create({
      data: {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        tenantId,
        nombre,
        url,
        secret,
        eventos: JSON.stringify(eventos),
        activo: true,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: webhook
    });

  } catch (error) {
    console.error('Error creando webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear webhook'
    });
  }
});

/**
 * PUT /api/webhooks/:id
 * Actualiza un webhook
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { nombre, url, eventos, activo } = req.body;

    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    // Validar URL si se proporciona
    if (url) {
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'URL inválida'
        });
      }
    }

    // Validar eventos si se proporcionan
    if (eventos) {
      const eventosValidos = Object.values(EVENTOS);
      const eventosInvalidos = eventos.filter(e => !eventosValidos.includes(e));

      if (eventosInvalidos.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Eventos inválidos: ${eventosInvalidos.join(', ')}`,
          eventosValidos
        });
      }
    }

    const updated = await prisma.webhooks.update({
      where: { id },
      data: {
        ...(nombre && { nombre }),
        ...(url && { url }),
        ...(eventos && { eventos: JSON.stringify(eventos) }),
        ...(activo !== undefined && { activo }),
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error('Error actualizando webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar webhook'
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Elimina un webhook
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    await prisma.webhooks.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Webhook eliminado'
    });

  } catch (error) {
    console.error('Error eliminando webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar webhook'
    });
  }
});

/**
 * GET /api/webhooks/:id/stats
 * Obtiene estadísticas de un webhook
 */
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { days = 7 } = req.query;

    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    const stats = await getWebhookStats(id, parseInt(days));

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * GET /api/webhooks/:id/logs
 * Obtiene logs de un webhook
 */
router.get('/:id/logs', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { limit = 50, offset = 0, exitoso } = req.query;

    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    const where = { webhookId: id };

    if (exitoso !== undefined) {
      where.exitoso = exitoso === 'true';
    }

    const [logs, total] = await Promise.all([
      prisma.webhook_logs.findMany({
        where,
        orderBy: { enviadoEn: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.webhook_logs.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + logs.length)
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
 * GET /api/webhooks/eventos/disponibles
 * Lista eventos disponibles
 */
router.get('/eventos/disponibles', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: Object.entries(EVENTOS).map(([key, value]) => ({
      key,
      value,
      descripcion: getEventoDescripcion(value)
    }))
  });
});

function getEventoDescripcion(evento) {
  const descripciones = {
    'document.processed': 'Se procesó un documento exitosamente',
    'document.failed': 'Falló el procesamiento de un documento',
    'document.exported': 'Se exportó un documento',
    'sync.completed': 'Se completó una sincronización PULL',
    'sync.failed': 'Falló una sincronización PULL',
    'export.completed': 'Se completó una exportación PUSH',
    'export.failed': 'Falló una exportación PUSH'
  };

  return descripciones[evento] || evento;
}

module.exports = router;
