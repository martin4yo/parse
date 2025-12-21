/**
 * OAuth Client Webhooks - Admin Proxy Endpoints
 *
 * Permite a los admins gestionar webhooks de sus clientes OAuth
 * desde la UI de admin, sin necesitar el Bearer token del cliente.
 *
 * Rutas: /api/oauth-clients/:clientId/webhooks
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { getWebhookStats, EVENTOS } = require('../services/webhookService');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * GET /api/oauth-clients/:clientId/webhooks
 * Lista todos los webhooks de un cliente OAuth (admin view)
 */
router.get('/:clientId/webhooks', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    // Obtener webhooks del cliente
    const webhooks = await prisma.webhooks.findMany({
      where: {
        oauthClientId: client.id,
        tenantId: null // Solo webhooks OAuth
      },
      orderBy: { createdAt: 'desc' }
    });

    // Ocultar secret completo
    const webhooksSeguro = webhooks.map(w => ({
      ...w,
      secret: `****${w.secret.slice(-4)}`,
      eventos: Array.isArray(w.eventos) ? w.eventos : JSON.parse(w.eventos || '[]')
    }));

    return res.json({
      success: true,
      data: webhooksSeguro
    });

  } catch (error) {
    console.error('Error obteniendo webhooks del cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener webhooks'
    });
  }
});

/**
 * POST /api/oauth-clients/:clientId/webhooks
 * Crear un nuevo webhook para un cliente OAuth (admin view)
 */
router.post('/:clientId/webhooks', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { nombre, url, eventos } = req.body;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

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

    // Validar que los eventos sean válidos (solo eventos API_*)
    const eventosValidos = Object.values(EVENTOS).filter(e => e.startsWith('api.'));
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
        oauthClientId: client.id,
        tenantId: null, // Webhook OAuth
        nombre: nombre.trim(),
        url: url.trim(),
        secret,
        eventos: JSON.stringify(eventos),
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ [Admin Proxy] Webhook creado para cliente ${client.nombre}: ${webhook.nombre}`);

    // Devolver secret completo SOLO en creación
    res.status(201).json({
      success: true,
      data: {
        ...webhook,
        eventos: JSON.parse(webhook.eventos)
      },
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
 * PUT /api/oauth-clients/:clientId/webhooks/:webhookId
 * Actualizar un webhook de un cliente OAuth (admin view)
 */
router.put('/:clientId/webhooks/:webhookId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId, webhookId } = req.params;
    const { nombre, url, eventos, activo } = req.body;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    // Verificar que el webhook pertenece al cliente
    const webhookExistente = await prisma.webhooks.findFirst({
      where: {
        id: webhookId,
        oauthClientId: client.id
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

      const eventosValidos = Object.values(EVENTOS).filter(e => e.startsWith('api.'));
      const eventosInvalidos = eventos.filter(e => !eventosValidos.includes(e));

      if (eventosInvalidos.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Eventos inválidos: ${eventosInvalidos.join(', ')}`
        });
      }

      dataUpdate.eventos = JSON.stringify(eventos);
    }

    if (activo !== undefined) {
      dataUpdate.activo = Boolean(activo);
    }

    // Actualizar webhook
    const webhookActualizado = await prisma.webhooks.update({
      where: { id: webhookId },
      data: dataUpdate
    });

    console.log(`✅ [Admin Proxy] Webhook actualizado: ${webhookActualizado.nombre}`);

    // Ocultar secret
    res.json({
      success: true,
      data: {
        ...webhookActualizado,
        secret: `****${webhookActualizado.secret.slice(-4)}`,
        eventos: JSON.parse(webhookActualizado.eventos)
      },
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
 * DELETE /api/oauth-clients/:clientId/webhooks/:webhookId
 * Eliminar un webhook de un cliente OAuth (admin view)
 */
router.delete('/:clientId/webhooks/:webhookId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId, webhookId } = req.params;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    // Verificar que el webhook pertenece al cliente
    const webhook = await prisma.webhooks.findFirst({
      where: {
        id: webhookId,
        oauthClientId: client.id
      }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook no encontrado'
      });
    }

    // Eliminar webhook
    await prisma.webhooks.delete({
      where: { id: webhookId }
    });

    console.log(`✅ [Admin Proxy] Webhook eliminado: ${webhook.nombre}`);

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
 * GET /api/oauth-clients/:clientId/webhooks/eventos-disponibles
 * Obtener lista de eventos disponibles para webhooks OAuth
 */
router.get('/:clientId/webhooks-eventos', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    // Verificar que el cliente pertenece al tenant
    const client = await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    // Filtrar solo eventos de API pública
    const eventosApi = Object.entries(EVENTOS)
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
    'api.document.accessed': 'Se accedió a un documento vía API',
    'api.document.exported': 'Se marcó un documento como exportado',
    'api.document.downloaded': 'Se descargó un archivo de documento',
    'api.client.activated': 'El cliente OAuth fue activado',
    'api.client.deactivated': 'El cliente OAuth fue desactivado',
    'api.rate_limit.exceeded': 'Se excedió el límite de tasa'
  };

  return descriptions[evento] || 'Sin descripción';
}

module.exports = router;
