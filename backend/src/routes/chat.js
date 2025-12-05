/**
 * Chat Routes - API para el asistente Axio
 *
 * Endpoints para comunicación con el agente de IA
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const aiAssistant = require('../services/aiAssistantService');
const actionExecutor = require('../services/actionExecutorService');
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

// Cache de acciones pendientes de confirmación
const pendingConfirmations = new Map();

/**
 * POST /api/chat
 * Procesa un mensaje del usuario y devuelve la respuesta del asistente
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message, tenantId, context: clientContext } = req.body;
    const userId = req.user.id;

    // Validar mensaje
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es requerido',
        error: 'INVALID_MESSAGE'
      });
    }

    // Validar tenant
    const effectiveTenantId = tenantId || req.user.tenantId;
    if (!effectiveTenantId) {
      return res.status(400).json({
        success: false,
        message: 'No hay tenant seleccionado',
        error: 'NO_TENANT'
      });
    }

    // Obtener información del usuario y tenant
    const [user, tenant] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId } }),
      prisma.tenants.findUnique({ where: { id: effectiveTenantId } })
    ]);

    const context = {
      userId,
      tenantId: effectiveTenantId,
      userName: user ? `${user.nombre} ${user.apellido}` : 'Usuario',
      tenantName: tenant?.nombre || 'Tenant',
      clientContext
    };

    console.log(`💬 [Chat] Mensaje de ${context.userName}: "${message.substring(0, 50)}..."`);

    // Procesar el mensaje con el asistente de IA
    const aiResponse = await aiAssistant.processCommand(message, context);

    if (!aiResponse.success) {
      return res.json({
        success: false,
        message: aiResponse.mensaje || 'Error procesando el mensaje',
        error: aiResponse.error
      });
    }

    // Si requiere confirmación, guardar la acción pendiente
    if (aiResponse.requiereConfirmacion) {
      const actionId = uuidv4();
      pendingConfirmations.set(actionId, {
        action: aiResponse.action,
        parametros: aiResponse.parametros,
        context,
        timestamp: Date.now()
      });

      console.log(`✅ [Chat] Acción pendiente guardada: ${actionId}`);
      console.log(`✅ [Chat] Total acciones pendientes: ${pendingConfirmations.size}`);

      // Limpiar confirmaciones antiguas (más de 10 minutos)
      cleanOldConfirmations();

      return res.json({
        success: true,
        message: aiResponse.mensaje,
        action: aiResponse.action,
        requiresConfirmation: true,
        pendingAction: {
          id: actionId,
          type: aiResponse.action,
          payload: aiResponse.parametros,
          description: aiResponse.mensaje
        }
      });
    }

    // Si no requiere confirmación, ejecutar directamente
    const result = await actionExecutor.executeAction(
      aiResponse.action,
      aiResponse.parametros,
      context
    );

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      action: result.action || aiResponse.action,
      requiresConfirmation: false
    });

  } catch (error) {
    console.error('🔴 [Chat] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/chat/confirm-action
 * Confirma o cancela una acción pendiente
 */
router.post('/confirm-action', authMiddleware, async (req, res) => {
  try {
    const { actionId, confirmed } = req.body;
    const userId = req.user.id;

    console.log(`🔄 [Chat] Confirmando acción: ${actionId}, confirmed: ${confirmed}`);
    console.log(`🔄 [Chat] Acciones pendientes: ${pendingConfirmations.size}`);
    console.log(`🔄 [Chat] IDs pendientes:`, Array.from(pendingConfirmations.keys()));

    if (!actionId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID de la acción',
        error: 'MISSING_ACTION_ID'
      });
    }

    // Buscar la acción pendiente
    const pendingAction = pendingConfirmations.get(actionId);
    if (!pendingAction) {
      console.log(`🔴 [Chat] Acción no encontrada: ${actionId}`);
      return res.status(404).json({
        success: false,
        message: 'La acción ya no está disponible o expiró. Intenta enviar el comando nuevamente.',
        error: 'ACTION_NOT_FOUND'
      });
    }

    // Eliminar de pendientes
    pendingConfirmations.delete(actionId);

    // Si canceló, devolver mensaje de cancelación
    if (!confirmed) {
      return res.json({
        success: true,
        message: '❌ Acción cancelada. No se realizaron cambios.',
        action: 'cancelled'
      });
    }

    // Ejecutar la acción confirmada
    const result = await actionExecutor.executeAction(
      pendingAction.action,
      pendingAction.parametros,
      pendingAction.context
    );

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      action: result.action || pendingAction.action
    });

  } catch (error) {
    console.error('🔴 [Chat] Error confirmando acción:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al confirmar la acción',
      error: error.message
    });
  }
});

/**
 * GET /api/chat/health
 * Verifica el estado del servicio de chat
 */
router.get('/health', async (req, res) => {
  try {
    // Verificar que tenemos API key de Anthropic
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

    return res.json({
      available: hasApiKey,
      service: 'axio',
      model: process.env.AXIO_MODEL || 'claude-sonnet-4-20250514',
      version: '1.0.0'
    });

  } catch (error) {
    console.error('🔴 [Chat] Error en health check:', error);
    return res.json({
      available: false,
      service: 'axio',
      model: 'unknown',
      error: error.message
    });
  }
});

/**
 * GET /api/chat/suggestions
 * Obtiene sugerencias de comandos según el contexto
 */
router.get('/suggestions', authMiddleware, async (req, res) => {
  try {
    const { context } = req.query;

    // Sugerencias base
    const suggestions = [
      'Crea una regla para clasificar gastos de combustible',
      'Muéstrame las reglas activas',
      'Analiza el prompt de extracción de facturas A',
      'Crea una regla con IA para asignar cuentas contables',
      'Mejora el prompt para que extraiga mejor el CAE',
      '¿Qué puedes hacer?'
    ];

    // En el futuro, personalizar según contexto
    return res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('🔴 [Chat] Error obteniendo sugerencias:', error);
    return res.json({
      success: true,
      suggestions: []
    });
  }
});

/**
 * GET /api/chat/context
 * Obtiene información de contexto del tenant para el asistente
 */
router.get('/context', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.json({
        success: true,
        context: {
          reglasCount: 0,
          promptsCount: 0,
          tiposCampo: []
        }
      });
    }

    const contextInfo = await aiAssistant.getContextInfo(tenantId);

    return res.json({
      success: true,
      context: contextInfo
    });

  } catch (error) {
    console.error('🔴 [Chat] Error obteniendo contexto:', error);
    return res.status(500).json({
      success: false,
      message: 'Error obteniendo contexto',
      error: error.message
    });
  }
});

/**
 * Limpia confirmaciones pendientes antiguas
 */
function cleanOldConfirmations() {
  const tenMinutes = 10 * 60 * 1000;
  const now = Date.now();

  for (const [key, value] of pendingConfirmations.entries()) {
    if (now - value.timestamp > tenMinutes) {
      pendingConfirmations.delete(key);
    }
  }
}

module.exports = router;
