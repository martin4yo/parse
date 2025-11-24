/**
 * Webhook Service
 *
 * Maneja el envío de notificaciones webhook a sistemas externos
 * Soporta reintentos automáticos y logging completo
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const crypto = require('crypto');

// Eventos soportados
const EVENTOS = {
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_FAILED: 'document.failed',
  DOCUMENT_EXPORTED: 'document.exported',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',
  EXPORT_COMPLETED: 'export.completed',
  EXPORT_FAILED: 'export.failed'
};

/**
 * Genera firma HMAC para verificar autenticidad del webhook
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Envía un webhook con reintentos
 */
async function sendWebhook(webhookId, evento, payload, retryCount = 0) {
  const MAX_RETRIES = 3;

  try {
    // Obtener configuración del webhook
    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId }
    });

    if (!webhook || !webhook.activo) {
      console.log(`⏭️ Webhook ${webhookId} desactivado o no encontrado`);
      return;
    }

    // Verificar que el webhook esté suscrito a este evento
    const eventos = Array.isArray(webhook.eventos) ? webhook.eventos : JSON.parse(webhook.eventos || '[]');
    if (!eventos.includes(evento)) {
      console.log(`⏭️ Webhook ${webhook.nombre} no suscrito a evento ${evento}`);
      return;
    }

    // Preparar payload con metadata
    const webhookPayload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      event: evento,
      created: new Date().toISOString(),
      data: payload
    };

    // Generar firma
    const signature = generateSignature(webhookPayload, webhook.secret);

    // Enviar request HTTP
    console.log(`📤 Enviando webhook ${evento} a ${webhook.url}`);

    const response = await axios.post(webhook.url, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': evento,
        'User-Agent': 'Parse-Webhook/1.0'
      },
      timeout: 30000,
      validateStatus: (status) => status < 500 // Aceptar 4xx como respuesta válida
    });

    const exitoso = response.status >= 200 && response.status < 300;

    // Log del envío
    await prisma.webhook_logs.create({
      data: {
        id: `whl_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        webhookId: webhook.id,
        evento,
        payload: webhookPayload,
        statusCode: response.status,
        respuesta: JSON.stringify(response.data).substring(0, 5000),
        error: exitoso ? null : `HTTP ${response.status}`,
        intentos: retryCount + 1,
        exitoso,
        enviadoEn: new Date()
      }
    });

    // Actualizar último envío
    await prisma.webhooks.update({
      where: { id: webhook.id },
      data: { ultimoEnvio: new Date() }
    });

    if (exitoso) {
      console.log(`✅ Webhook enviado exitosamente a ${webhook.nombre}`);
    } else {
      console.warn(`⚠️ Webhook recibió respuesta ${response.status} de ${webhook.nombre}`);

      // Reintentar en caso de error 5xx
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`🔄 Reintentando en ${delay}ms...`);

        setTimeout(() => {
          sendWebhook(webhookId, evento, payload, retryCount + 1);
        }, delay);
      }
    }

    return exitoso;

  } catch (error) {
    console.error(`❌ Error enviando webhook ${webhookId}:`, error.message);

    // Log del error
    await prisma.webhook_logs.create({
      data: {
        id: `whl_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        webhookId,
        evento,
        payload,
        statusCode: null,
        respuesta: null,
        error: error.message.substring(0, 1000),
        intentos: retryCount + 1,
        exitoso: false,
        enviadoEn: new Date()
      }
    });

    // Reintentar
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`🔄 Reintentando en ${delay}ms...`);

      setTimeout(() => {
        sendWebhook(webhookId, evento, payload, retryCount + 1);
      }, delay);
    }

    return false;
  }
}

/**
 * Dispara webhooks para un evento específico
 */
async function triggerWebhooks(tenantId, evento, payload) {
  try {
    // Obtener todos los webhooks activos del tenant suscritos a este evento
    const webhooks = await prisma.webhooks.findMany({
      where: {
        tenantId,
        activo: true
      }
    });

    if (webhooks.length === 0) {
      console.log(`ℹ️ No hay webhooks configurados para tenant ${tenantId}`);
      return;
    }

    // Filtrar por evento y enviar async
    for (const webhook of webhooks) {
      const eventos = Array.isArray(webhook.eventos) ? webhook.eventos : JSON.parse(webhook.eventos || '[]');

      if (eventos.includes(evento)) {
        // Enviar async (no bloqueante)
        sendWebhook(webhook.id, evento, payload).catch(err => {
          console.error(`Error disparando webhook ${webhook.id}:`, err);
        });
      }
    }

  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

/**
 * Helper: Trigger cuando se procesa un documento
 */
async function triggerDocumentProcessed(tenantId, documento) {
  await triggerWebhooks(tenantId, EVENTOS.DOCUMENT_PROCESSED, {
    documentoId: documento.id,
    tipo: documento.tipoComprobanteExtraido,
    numero: documento.numeroComprobanteExtraido,
    fecha: documento.fechaComprobante,
    total: documento.totalComprobante,
    proveedor: {
      cuit: documento.cuitProveedor,
      razonSocial: documento.razonSocialProveedor
    },
    estado: documento.estadoProcesamiento
  });
}

/**
 * Helper: Trigger cuando falla el procesamiento
 */
async function triggerDocumentFailed(tenantId, documentoId, error) {
  await triggerWebhooks(tenantId, EVENTOS.DOCUMENT_FAILED, {
    documentoId,
    error: error.message || error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper: Trigger cuando se exporta un documento
 */
async function triggerDocumentExported(tenantId, documento, externalId) {
  await triggerWebhooks(tenantId, EVENTOS.DOCUMENT_EXPORTED, {
    documentoId: documento.id,
    tipo: documento.tipoComprobanteExtraido,
    numero: documento.numeroComprobanteExtraido,
    total: documento.totalComprobante,
    externalId,
    exportedAt: new Date().toISOString()
  });
}

/**
 * Helper: Trigger cuando se completa una sincronización
 */
async function triggerSyncCompleted(tenantId, connectorId, stats) {
  await triggerWebhooks(tenantId, EVENTOS.SYNC_COMPLETED, {
    connectorId,
    success: stats.success,
    failed: stats.failed,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper: Trigger cuando falla una sincronización
 */
async function triggerSyncFailed(tenantId, connectorId, error) {
  await triggerWebhooks(tenantId, EVENTOS.SYNC_FAILED, {
    connectorId,
    error: error.message || error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper: Trigger cuando se completa una exportación
 */
async function triggerExportCompleted(tenantId, connectorId, stats) {
  await triggerWebhooks(tenantId, EVENTOS.EXPORT_COMPLETED, {
    connectorId,
    success: stats.success,
    failed: stats.failed,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper: Trigger cuando falla una exportación
 */
async function triggerExportFailed(tenantId, connectorId, error) {
  await triggerWebhooks(tenantId, EVENTOS.EXPORT_FAILED, {
    connectorId,
    error: error.message || error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Obtiene estadísticas de webhooks
 */
async function getWebhookStats(webhookId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [total, exitosos, fallidos, porEvento] = await Promise.all([
    prisma.webhook_logs.count({
      where: {
        webhookId,
        enviadoEn: { gte: startDate }
      }
    }),
    prisma.webhook_logs.count({
      where: {
        webhookId,
        exitoso: true,
        enviadoEn: { gte: startDate }
      }
    }),
    prisma.webhook_logs.count({
      where: {
        webhookId,
        exitoso: false,
        enviadoEn: { gte: startDate }
      }
    }),
    prisma.webhook_logs.groupBy({
      by: ['evento'],
      where: {
        webhookId,
        enviadoEn: { gte: startDate }
      },
      _count: { id: true }
    })
  ]);

  return {
    total,
    exitosos,
    fallidos,
    tasaExito: total > 0 ? ((exitosos / total) * 100).toFixed(2) : 0,
    porEvento: porEvento.map(e => ({
      evento: e.evento,
      count: e._count.id
    }))
  };
}

module.exports = {
  EVENTOS,
  sendWebhook,
  triggerWebhooks,
  triggerDocumentProcessed,
  triggerDocumentFailed,
  triggerDocumentExported,
  triggerSyncCompleted,
  triggerSyncFailed,
  triggerExportCompleted,
  triggerExportFailed,
  getWebhookStats,
  generateSignature
};
