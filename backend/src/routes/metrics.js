/**
 * Metrics - Dashboard de métricas y monitoreo
 *
 * Endpoints para visualizar estadísticas del sistema
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { getRateLimitStats } = require('../middleware/rateLimiter');

const prisma = new PrismaClient();

/**
 * GET /api/metrics/overview
 * Resumen general de métricas del tenant
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Métricas de documentos
    const [
      totalDocumentos,
      documentosProcesados,
      documentosError,
      documentosExportados
    ] = await Promise.all([
      prisma.documentos_procesados.count({
        where: { tenantId, createdAt: { gte: startDate } }
      }),
      prisma.documentos_procesados.count({
        where: {
          tenantId,
          estadoProcesamiento: 'completed',
          createdAt: { gte: startDate }
        }
      }),
      prisma.documentos_procesados.count({
        where: {
          tenantId,
          estadoProcesamiento: 'error',
          createdAt: { gte: startDate }
        }
      }),
      prisma.documentos_procesados.count({
        where: {
          tenantId,
          exportado: true,
          createdAt: { gte: startDate }
        }
      })
    ]);

    // Métricas de sincronización (opcional - tablas pueden no existir aún)
    let pullJobs = 0;
    let pushJobs = 0;
    try {
      [pullJobs, pushJobs] = await Promise.all([
        prisma.sync_jobs.count({
          where: {
            tenantId,
            createdAt: { gte: startDate }
          }
        }),
        prisma.export_jobs.count({
          where: {
            tenantId,
            createdAt: { gte: startDate }
          }
        })
      ]);
    } catch (e) {
      // Tablas no existen aún, usar valores por defecto
    }

    // Métricas de webhooks
    const [totalWebhooks, webhooksExitosos, webhooksFallidos] = await Promise.all([
      prisma.webhook_logs.count({
        where: {
          webhooks: { tenantId },
          enviadoEn: { gte: startDate }
        }
      }),
      prisma.webhook_logs.count({
        where: {
          webhooks: { tenantId },
          exitoso: true,
          enviadoEn: { gte: startDate }
        }
      }),
      prisma.webhook_logs.count({
        where: {
          webhooks: { tenantId },
          exitoso: false,
          enviadoEn: { gte: startDate }
        }
      })
    ]);

    // Calcular tasas
    const tasaExitoDocumentos = totalDocumentos > 0
      ? ((documentosProcesados / totalDocumentos) * 100).toFixed(2)
      : 0;

    const tasaExitoWebhooks = totalWebhooks > 0
      ? ((webhooksExitosos / totalWebhooks) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        documentos: {
          total: totalDocumentos,
          procesados: documentosProcesados,
          errores: documentosError,
          exportados: documentosExportados,
          tasaExito: tasaExitoDocumentos
        },
        sincronizacion: {
          pullJobs,
          pushJobs,
          total: pullJobs + pushJobs
        },
        webhooks: {
          total: totalWebhooks,
          exitosos: webhooksExitosos,
          fallidos: webhooksFallidos,
          tasaExito: tasaExitoWebhooks
        },
        periodo: {
          desde: startDate,
          hasta: new Date(),
          dias: parseInt(days)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas overview:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas'
    });
  }
});

/**
 * GET /api/metrics/documentos
 * Métricas detalladas de procesamiento de documentos
 */
router.get('/documentos', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Documentos por día
    const documentosPorDia = await prisma.$queryRaw`
      SELECT
        DATE("createdAt") as fecha,
        COUNT(*) as total,
        SUM(CASE WHEN "estadoProcesamiento" = 'completed' THEN 1 ELSE 0 END) as completados,
        SUM(CASE WHEN "estadoProcesamiento" = 'error' THEN 1 ELSE 0 END) as errores
      FROM documentos_procesados
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY fecha DESC
    `;

    // Documentos por tipo
    const documentosPorTipo = await prisma.documentos_procesados.groupBy({
      by: ['tipoComprobanteExtraido'],
      where: {
        tenantId,
        createdAt: { gte: startDate }
      },
      _count: { id: true }
    });

    // Top errores
    const topErrores = await prisma.$queryRaw`
      SELECT
        "errorMessage",
        COUNT(*) as count
      FROM documentos_procesados
      WHERE "tenantId" = ${tenantId}
        AND "estadoProcesamiento" = 'error'
        AND "createdAt" >= ${startDate}
        AND "errorMessage" IS NOT NULL
      GROUP BY "errorMessage"
      ORDER BY count DESC
      LIMIT 10
    `;

    // Convertir BigInt a Number para serialización JSON
    const documentosPorDiaJSON = documentosPorDia.map(d => ({
      fecha: d.fecha,
      total: Number(d.total),
      completados: Number(d.completados),
      errores: Number(d.errores)
    }));

    const topErroresJSON = topErrores.map(e => ({
      errorMessage: e.errorMessage,
      count: Number(e.count)
    }));

    res.json({
      success: true,
      data: {
        porDia: documentosPorDiaJSON,
        porTipo: documentosPorTipo.map(t => ({
          tipo: t.tipoComprobanteExtraido || 'Sin tipo',
          count: t._count.id
        })),
        topErrores: topErroresJSON
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas de documentos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de documentos'
    });
  }
});

/**
 * GET /api/metrics/api-usage
 * Métricas de uso de API (Rate Limiting)
 */
router.get('/api-usage', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Obtener API Keys del tenant
    let apiKeys = [];
    try {
      apiKeys = await prisma.api_keys.findMany({
        where: { tenantId, activo: true },
        select: { id: true, nombre: true }
      });
    } catch (e) {
      // Tabla api_keys no existe aún
    }

    // Obtener stats de rate limiting para cada API Key
    const apiKeyStats = await Promise.all(
      apiKeys.map(async (key) => {
        const stats = await getRateLimitStats(key.id, tenantId, null);
        return {
          apiKeyId: key.id,
          nombre: key.nombre,
          ...stats
        };
      })
    );

    // Logs de API (últimas 100 llamadas) - opcional
    let recentApiLogs = [];
    let endpointStats = [];
    try {
      recentApiLogs = await prisma.api_logs.findMany({
        where: {
          tenantId,
          timestamp: { gte: startDate }
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        select: {
          endpoint: true,
          statusCode: true,
          timestamp: true,
          apiKeyId: true
        }
      });

      // Endpoints más usados
      endpointStats = await prisma.$queryRaw`
        SELECT
          endpoint,
          COUNT(*) as count,
          AVG("responseTime") as "avgResponseTime"
        FROM api_logs
        WHERE "tenantId" = ${tenantId}
          AND timestamp >= ${startDate}
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      `;
    } catch (e) {
      // Tabla api_logs no existe aún
    }

    res.json({
      success: true,
      data: {
        apiKeys: apiKeyStats,
        recentLogs: recentApiLogs,
        topEndpoints: endpointStats
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas de API:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de API'
    });
  }
});

/**
 * GET /api/metrics/webhooks
 * Métricas de webhooks
 */
router.get('/webhooks', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Webhooks del tenant
    const webhooks = await prisma.webhooks.findMany({
      where: { tenantId },
      select: { id: true, nombre: true, activo: true }
    });

    // Stats por webhook
    const webhookStats = await Promise.all(
      webhooks.map(async (webhook) => {
        const [total, exitosos, fallidos] = await Promise.all([
          prisma.webhook_logs.count({
            where: {
              webhookId: webhook.id,
              enviadoEn: { gte: startDate }
            }
          }),
          prisma.webhook_logs.count({
            where: {
              webhookId: webhook.id,
              exitoso: true,
              enviadoEn: { gte: startDate }
            }
          }),
          prisma.webhook_logs.count({
            where: {
              webhookId: webhook.id,
              exitoso: false,
              enviadoEn: { gte: startDate }
            }
          })
        ]);

        return {
          webhookId: webhook.id,
          nombre: webhook.nombre,
          activo: webhook.activo,
          total,
          exitosos,
          fallidos,
          tasaExito: total > 0 ? ((exitosos / total) * 100).toFixed(2) : 0
        };
      })
    );

    // Webhooks por día
    const webhooksPorDia = await prisma.$queryRaw`
      SELECT
        DATE("enviadoEn") as fecha,
        COUNT(*) as total,
        SUM(CASE WHEN exitoso = true THEN 1 ELSE 0 END) as exitosos,
        SUM(CASE WHEN exitoso = false THEN 1 ELSE 0 END) as fallidos
      FROM webhook_logs
      WHERE "webhookId" IN (
        SELECT id FROM webhooks WHERE "tenantId" = ${tenantId}
      )
      AND "enviadoEn" >= ${startDate}
      GROUP BY DATE("enviadoEn")
      ORDER BY fecha DESC
    `;

    // Webhooks por evento
    const porEvento = await prisma.webhook_logs.groupBy({
      by: ['evento'],
      where: {
        webhooks: { tenantId },
        enviadoEn: { gte: startDate }
      },
      _count: { id: true }
    });

    // Convertir BigInt a Number
    const webhooksPorDiaJSON = webhooksPorDia.map(d => ({
      fecha: d.fecha,
      total: Number(d.total),
      exitosos: Number(d.exitosos),
      fallidos: Number(d.fallidos)
    }));

    res.json({
      success: true,
      data: {
        webhooks: webhookStats,
        porDia: webhooksPorDiaJSON,
        porEvento: porEvento.map(e => ({
          evento: e.evento,
          count: e._count.id
        }))
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas de webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de webhooks'
    });
  }
});

/**
 * GET /api/metrics/sync
 * Métricas de sincronización (PULL/PUSH)
 */
router.get('/sync', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let pullStats = [];
    let pushStats = [];
    let jobsPorConector = [];
    let syncTimeline = [];

    try {
      // Sync jobs (PULL)
      pullStats = await prisma.sync_jobs.groupBy({
        by: ['status'],
        where: {
          tenantId,
          createdAt: { gte: startDate }
        },
        _count: { id: true }
      });

      // Export jobs (PUSH)
      pushStats = await prisma.export_jobs.groupBy({
        by: ['status'],
        where: {
          tenantId,
          createdAt: { gte: startDate }
        },
        _count: { id: true }
      });

      // Jobs por conector
      jobsPorConector = await prisma.$queryRaw`
        SELECT
          ac.nombre as "connectorName",
          COUNT(sj.id) as "pullJobs",
          COUNT(ej.id) as "pushJobs"
        FROM api_connectors ac
        LEFT JOIN sync_jobs sj ON sj."connectorId" = ac.id AND sj."createdAt" >= ${startDate}
        LEFT JOIN export_jobs ej ON ej."connectorId" = ac.id AND ej."createdAt" >= ${startDate}
        WHERE ac."tenantId" = ${tenantId}
        GROUP BY ac.id, ac.nombre
        ORDER BY ("pullJobs" + "pushJobs") DESC
      `;

      // Timeline de sincronizaciones
      syncTimeline = await prisma.$queryRaw`
        SELECT
          DATE("createdAt") as fecha,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completados,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fallidos
        FROM (
          SELECT "createdAt", status FROM sync_jobs WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${startDate}
          UNION ALL
          SELECT "createdAt", status FROM export_jobs WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${startDate}
        ) combined
        GROUP BY DATE("createdAt")
        ORDER BY fecha DESC
      `;
    } catch (e) {
      // Tablas sync_jobs/export_jobs no existen aún
    }

    res.json({
      success: true,
      data: {
        pull: pullStats.map(s => ({ status: s.status, count: s._count.id })),
        push: pushStats.map(s => ({ status: s.status, count: s._count.id })),
        porConector: jobsPorConector,
        timeline: syncTimeline
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas de sync:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de sincronización'
    });
  }
});

module.exports = router;
