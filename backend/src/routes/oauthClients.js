const express = require('express');
const router = express.Router();
const oauthService = require('../services/oauthService');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

/**
 * Endpoints para gestionar OAuth Clients
 * Estos endpoints son para la UI de administración, NO para la API pública
 * Requieren autenticación de usuario (session-based) y permisos de admin
 */

/**
 * GET /api/oauth-clients
 * Listar todos los OAuth clients del tenant actual
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const clients = await oauthService.listClients(req.user.tenantId);

    res.json({
      success: true,
      data: clients
    });
  } catch (error) {
    console.error('❌ Error listando OAuth clients:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar clientes OAuth',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/oauth-clients/:clientId
 * Obtener detalles de un OAuth client específico
 */
router.get('/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await oauthService.getClient(clientId, req.user.tenantId);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    res.json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error('❌ Error obteniendo OAuth client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente OAuth',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/oauth-clients
 * Crear un nuevo OAuth client
 *
 * Body:
 * {
 *   "nombre": "Mi Sistema ERP",
 *   "descripcion": "Integración con ERP principal",
 *   "allowedScopes": ["read:documents", "write:documents"],
 *   "customRateLimit": false,
 *   "requestsPerMinute": 60,
 *   "requestsPerHour": 3000,
 *   "requestsPerDay": 50000
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "clientId": "client_abc123",
 *     "clientSecret": "secret_xyz789",  // SOLO SE MUESTRA EN LA CREACIÓN
 *     ...
 *   },
 *   "message": "Cliente OAuth creado exitosamente. Guarde el client_secret, no podrá verlo nuevamente."
 * }
 */
router.post('/', authenticateToken, checkPermission('manage_integrations'), async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      allowedScopes,
      customRateLimit,
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay
    } = req.body;

    // Validaciones
    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido'
      });
    }

    // Scopes válidos disponibles
    const validScopes = [
      'read:documents',
      'write:documents',
      'read:files',
      'read:all',
      'write:all'
    ];

    // Validar scopes
    if (allowedScopes && !Array.isArray(allowedScopes)) {
      return res.status(400).json({
        success: false,
        error: 'allowedScopes debe ser un array'
      });
    }

    if (allowedScopes) {
      const invalidScopes = allowedScopes.filter(s => !validScopes.includes(s));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Scopes inválidos: ${invalidScopes.join(', ')}`,
          validScopes
        });
      }
    }

    // Crear cliente
    const client = await oauthService.createClient({
      tenantId: req.user.tenantId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      allowedScopes: allowedScopes || ['read:documents', 'write:documents'],
      customRateLimit: customRateLimit || false,
      requestsPerMinute: customRateLimit ? requestsPerMinute : null,
      requestsPerHour: customRateLimit ? requestsPerHour : null,
      requestsPerDay: customRateLimit ? requestsPerDay : null,
      createdBy: req.user.id
    });

    console.log(`✅ Cliente OAuth creado: ${client.clientId} por usuario ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: client,
      message: 'Cliente OAuth creado exitosamente. IMPORTANTE: Guarde el client_secret en un lugar seguro, no podrá verlo nuevamente.'
    });
  } catch (error) {
    console.error('❌ Error creando OAuth client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear cliente OAuth',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/oauth-clients/:clientId
 * Actualizar un OAuth client
 *
 * Body:
 * {
 *   "nombre": "Nuevo nombre",
 *   "descripcion": "Nueva descripción",
 *   "allowedScopes": ["read:documents"],
 *   "activo": false,
 *   "customRateLimit": true,
 *   "requestsPerMinute": 120
 * }
 */
router.put('/:clientId', authenticateToken, checkPermission('manage_integrations'), async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      nombre,
      descripcion,
      allowedScopes,
      activo,
      customRateLimit,
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay
    } = req.body;

    // Preparar datos a actualizar
    const updateData = {};

    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (allowedScopes !== undefined) updateData.allowedScopes = allowedScopes;
    if (activo !== undefined) updateData.activo = activo;
    if (customRateLimit !== undefined) updateData.customRateLimit = customRateLimit;
    if (requestsPerMinute !== undefined) updateData.requestsPerMinute = requestsPerMinute;
    if (requestsPerHour !== undefined) updateData.requestsPerHour = requestsPerHour;
    if (requestsPerDay !== undefined) updateData.requestsPerDay = requestsPerDay;

    // Actualizar
    const updated = await oauthService.updateClient(clientId, req.user.tenantId, updateData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    console.log(`✅ Cliente OAuth actualizado: ${clientId} por usuario ${req.user.email}`);

    res.json({
      success: true,
      data: updated,
      message: 'Cliente OAuth actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando OAuth client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cliente OAuth',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/oauth-clients/:clientId
 * Eliminar un OAuth client (y todos sus tokens)
 */
router.delete('/:clientId', authenticateToken, checkPermission('manage_integrations'), async (req, res) => {
  try {
    const { clientId } = req.params;

    const deleted = await oauthService.deleteClient(clientId, req.user.tenantId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    console.log(`✅ Cliente OAuth eliminado: ${clientId} por usuario ${req.user.email}`);

    res.json({
      success: true,
      message: 'Cliente OAuth eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error eliminando OAuth client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cliente OAuth',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/oauth-clients/:clientId/stats
 * Obtener estadísticas de uso de un cliente
 *
 * Query params:
 *   - days: Días hacia atrás (default: 30)
 */
router.get('/:clientId/stats', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const stats = await oauthService.getClientStats(clientId, days);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error obteniendo stats de OAuth client:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/oauth-clients/:clientId/dashboard
 * Obtener métricas detalladas para dashboard con gráficos temporales
 *
 * Query params:
 *   - days: Días hacia atrás para el análisis (default: 30)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "clientId": "client_abc123",
 *     "nombre": "Mi App",
 *     "period": { "days": 30, "startDate": "2025-01-01", "endDate": "2025-01-31" },
 *     "summary": { "totalRequests": 15420, "avgResponseTime": 245, "errorRate": "2.3" },
 *     "charts": {
 *       "requestsByDay": [{ "date": "2025-01-01", "count": 520 }, ...],
 *       "requestsByHour": [{ "hour": 0, "count": 45 }, ...],
 *       "latencyByDay": [{ "date": "2025-01-01", "avgLatency": 230, "minLatency": 120, "maxLatency": 890 }, ...],
 *       "statusCodes": [{ "category": "success", "code": 200, "count": 14580 }, ...],
 *       "topEndpoints": [{ "endpoint": "/api/v1/documents", "count": 8520 }, ...],
 *       "rateLimitByDay": [...],
 *       "errorsByEndpoint": [...]
 *     }
 *   }
 * }
 */
router.get('/:clientId/dashboard', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const days = parseInt(req.query.days) || 30;

    // Validar días
    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro days debe estar entre 1 y 365'
      });
    }

    const metrics = await oauthService.getClientDashboardMetrics(clientId, days);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('❌ Error obteniendo dashboard metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas del dashboard',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/oauth-clients/:clientId/regenerate-secret
 * Regenerar el client_secret de un cliente
 *
 * IMPORTANTE: Esto invalidará el secret anterior y todos los tokens activos
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "clientId": "client_abc123",
 *     "clientSecret": "secret_new_xyz789"  // SOLO SE MUESTRA UNA VEZ
 *   },
 *   "message": "Client secret regenerado. Actualice su sistema con el nuevo secret."
 * }
 */
router.post('/:clientId/regenerate-secret', authenticateToken, checkPermission('manage_integrations'), async (req, res) => {
  try {
    const { clientId } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    const prisma = new PrismaClient();

    // Buscar cliente
    const client = await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId: req.user.tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente OAuth no encontrado'
      });
    }

    // Generar nuevo secret
    const newClientSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;
    const hashedSecret = await bcrypt.hash(newClientSecret, 10);

    // Actualizar en BD
    await prisma.oauth_clients.update({
      where: { id: client.id },
      data: { clientSecret: hashedSecret }
    });

    // Revocar todos los tokens activos del cliente
    await prisma.oauth_tokens.updateMany({
      where: {
        clientId: client.id,
        revoked: false
      },
      data: {
        revoked: true,
        revokedAt: new Date()
      }
    });

    console.log(`✅ Client secret regenerado para: ${clientId} por usuario ${req.user.email}`);

    res.json({
      success: true,
      data: {
        clientId: client.clientId,
        clientSecret: newClientSecret  // Texto plano para mostrar al usuario
      },
      message: 'Client secret regenerado exitosamente. IMPORTANTE: Todos los tokens activos han sido revocados. Actualice su sistema con el nuevo secret.'
    });
  } catch (error) {
    console.error('❌ Error regenerando secret:', error);
    res.status(500).json({
      success: false,
      error: 'Error al regenerar client secret',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
