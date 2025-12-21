/**
 * OAuth Webhooks API Routes
 *
 * Endpoints para que clientes OAuth gestionen sus webhooks
 * Requiere autenticación OAuth con scope 'manage:webhooks'
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateOAuth, requireScope } = require('../middleware/oauthAuth');
const webhookService = require('../services/webhookService');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * @swagger
 * /api/v1/webhooks:
 *   get:
 *     summary: Listar webhooks del cliente OAuth
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de webhooks
 */
router.get('/', authenticateOAuth, async (req, res) => {
  try {
    const webhooks = await prisma.webhooks.findMany({
      where: {
        oauthClientId: req.client.id,
        tenantId: null // Solo webhooks OAuth
      },
      orderBy: { createdAt: 'desc' }
    });

    // Ocultar secret completo, solo mostrar últimos 4 caracteres
    const webhooksSeguro = webhooks.map(w => ({
      ...w,
      secret: `****${w.secret.slice(-4)}`
    }));

    res.json({
      success: true,
      data: webhooksSeguro
    });

  } catch (error) {
    console.error('Error listando webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener webhooks'
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks:
 *   post:
 *     summary: Crear un nuevo webhook
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.post('/', authenticateOAuth, async (req, res) => {
  try {
    const { nombre, url, eventos } = req.body;

    // Validaciones
    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido'
      });
    }

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida. Debe comenzar con http:// o https://'
      });
    }

    if (!Array.isArray(eventos) || eventos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe seleccionar al menos un evento'
      });
    }

    // Validar que los eventos sean válidos
    const eventosValidos = Object.values(webhookService.EVENTOS);
    const eventosInvalidos = eventos.filter(e => !eventosValidos.includes(e));

    if (eventosInvalidos.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Eventos inválidos: ${eventosInvalidos.join(', ')}`
      });
    }

    // Generar secret único
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

    // Crear webhook
    const webhook = await prisma.webhooks.create({
      data: {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        oauthClientId: req.client.id,
        tenantId: null, // OAuth webhook
        nombre: nombre.trim(),
        url: url.trim(),
        secret,
        eventos,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ [OAuth Webhooks] Webhook creado: ${webhook.nombre} (${req.client.nombre})`);

    res.status(201).json({
      success: true,
      data: webhook,
      message: 'Webhook creado exitosamente. IMPORTANTE: Guarde el secret, no podrá verlo nuevamente.'
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
 * @swagger
 * /api/v1/webhooks/{id}:
 *   get:
 *     summary: Obtener detalle de un webhook
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id', authenticateOAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhooks.findFirst({
      where: {
        id,
        oauthClientId: req.client.id
      }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    // Ocultar secret
    const webhookSeguro = {
      ...webhook,
      secret: `****${webhook.secret.slice(-4)}`
    };

    res.json({
      success: true,
      data: webhookSeguro
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
 * @swagger
 * /api/v1/webhooks/{id}:
 *   put:
 *     summary: Actualizar un webhook
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.put('/:id', authenticateOAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, url, eventos, activo } = req.body;

    // Verificar que el webhook pertenece al cliente
    const webhookExistente = await prisma.webhooks.findFirst({
      where: {
        id,
        oauthClientId: req.client.id
      }
    });

    if (!webhookExistente) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    // Construir objeto de actualización
    const dataUpdate = {
      updatedAt: new Date()
    };

    if (nombre !== undefined) {
      if (nombre.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'El nombre no puede estar vacío'
        });
      }
      dataUpdate.nombre = nombre.trim();
    }

    if (url !== undefined) {
      if (!url.startsWith('http')) {
        return res.status(400).json({
          success: false,
          error: 'URL inválida'
        });
      }
      dataUpdate.url = url.trim();
    }

    if (eventos !== undefined) {
      if (!Array.isArray(eventos) || eventos.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe seleccionar al menos un evento'
        });
      }

      const eventosValidos = Object.values(webhookService.EVENTOS);
      const eventosInvalidos = eventos.filter(e => !eventosValidos.includes(e));

      if (eventosInvalidos.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Eventos inválidos: ${eventosInvalidos.join(', ')}`
        });
      }

      dataUpdate.eventos = eventos;
    }

    if (activo !== undefined) {
      dataUpdate.activo = Boolean(activo);
    }

    // Actualizar webhook
    const webhookActualizado = await prisma.webhooks.update({
      where: { id },
      data: dataUpdate
    });

    console.log(`✅ [OAuth Webhooks] Webhook actualizado: ${webhookActualizado.nombre}`);

    // Ocultar secret
    const webhookSeguro = {
      ...webhookActualizado,
      secret: `****${webhookActualizado.secret.slice(-4)}`
    };

    res.json({
      success: true,
      data: webhookSeguro,
      message: 'Webhook actualizado exitosamente'
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
 * @swagger
 * /api/v1/webhooks/{id}:
 *   delete:
 *     summary: Eliminar un webhook
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.delete('/:id', authenticateOAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el webhook pertenece al cliente
    const webhook = await prisma.webhooks.findFirst({
      where: {
        id,
        oauthClientId: req.client.id
      }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    // Eliminar webhook (los logs se mantienen por CASCADE)
    await prisma.webhooks.delete({
      where: { id }
    });

    console.log(`✅ [OAuth Webhooks] Webhook eliminado: ${webhook.nombre}`);

    res.json({
      success: true,
      message: 'Webhook eliminado exitosamente'
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
 * @swagger
 * /api/v1/webhooks/{id}/stats:
 *   get:
 *     summary: Obtener estadísticas de un webhook
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/stats', authenticateOAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.query;

    // Verificar que el webhook pertenece al cliente
    const webhook = await prisma.webhooks.findFirst({
      where: {
        id,
        oauthClientId: req.client.id
      }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    // Obtener estadísticas
    const stats = await webhookService.getWebhookStats(id, parseInt(days));

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks/{id}/logs:
 *   get:
 *     summary: Obtener logs de un webhook
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/logs', authenticateOAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verificar que el webhook pertenece al cliente
    const webhook = await prisma.webhooks.findFirst({
      where: {
        id,
        oauthClientId: req.client.id
      }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    const [logs, total] = await Promise.all([
      prisma.webhook_logs.findMany({
        where: { webhookId: id },
        orderBy: { enviadoEn: 'desc' },
        take: parsedLimit,
        skip: parsedOffset
      }),
      prisma.webhook_logs.count({
        where: { webhookId: id }
      })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: parsedOffset + parsedLimit < total
        }
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
 * @swagger
 * /api/v1/webhooks/events:
 *   get:
 *     summary: Listar eventos disponibles
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 */
router.get('/meta/events', authenticateOAuth, async (req, res) => {
  try {
    // Filtrar solo eventos de API pública
    const eventosApi = Object.entries(webhookService.EVENTOS)
      .filter(([key]) => key.startsWith('API_'))
      .map(([key, value]) => ({
        key,
        value,
        description: getEventDescription(value)
      }));

    res.json({
      success: true,
      data: eventosApi
    });

  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener eventos'
    });
  }
});

/**
 * Helper: Descripción de eventos
 */
function getEventDescription(evento) {
  const descriptions = {
    [webhookService.EVENTOS.API_DOCUMENT_ACCESSED]: 'Se accedió a un documento vía API',
    [webhookService.EVENTOS.API_DOCUMENT_EXPORTED]: 'Se marcó un documento como exportado',
    [webhookService.EVENTOS.API_DOCUMENT_DOWNLOADED]: 'Se descargó un archivo de documento',
    [webhookService.EVENTOS.API_CLIENT_ACTIVATED]: 'El cliente OAuth fue activado',
    [webhookService.EVENTOS.API_CLIENT_DEACTIVATED]: 'El cliente OAuth fue desactivado',
    [webhookService.EVENTOS.API_RATE_LIMIT_EXCEEDED]: 'Se excedió el límite de tasa'
  };

  return descriptions[evento] || 'Sin descripción';
}

module.exports = router;
