const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { authenticateSyncClient } = require('../middleware/syncAuth');
const os = require('os');

const prisma = new PrismaClient();

/**
 * GET /api/v1/sync-clients/config
 * Obtiene la configuración del cliente desde la nube
 * El clientId se obtiene del registro previo o se puede pasar como query param
 *
 * Headers requeridos:
 *   X-API-Key: tu-api-key-aqui
 *
 * Query params (opcionales):
 *   clientId: ID del cliente si ya está registrado
 */
router.get('/config', authenticateSyncClient, async (req, res) => {
  try {
    const { clientId } = req.query;
    const tenantId = req.syncClient.tenantId;

    let client = null;

    if (clientId) {
      // Buscar cliente específico
      client = await prisma.sync_clients.findFirst({
        where: {
          id: clientId,
          tenantId: tenantId
        }
      });
    }

    // Si no hay cliente registrado, devolver config por defecto
    const config = client?.config || {
      api: {
        url: process.env.API_URL || 'https://api.parsedemo.axiomacloud.com',
        timeout: 120000,
        retryAttempts: 3
      },
      folder: {
        enabled: true,
        extensions: ['pdf', 'jpg', 'jpeg', 'png'],
        stabilityDelay: 2000,
        watchMode: 'polling',
        pollInterval: 5000
      },
      email: {
        enabled: false,
        pollInterval: 60000
      },
      output: {
        json: {
          enabled: true
        },
        sql: {
          enabled: false
        },
        cloud: {
          enabled: false
        }
      },
      processing: {
        concurrency: 1,
        tipoDocumento: 'AUTO',
        aplicarReglas: false
      },
      logging: {
        level: 'info',
        sendToCloud: true
      }
    };

    res.json({
      success: true,
      data: {
        clientId: client?.id || null,
        config,
        tenant: {
          id: tenantId,
          nombre: req.syncClient.tenant.nombre
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo config de cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración'
    });
  }
});

/**
 * POST /api/v1/sync-clients/register
 * Registra un nuevo cliente o actualiza uno existente
 *
 * Body:
 *   nombre: string - Nombre identificador del cliente (ej: "PC-Oficina-1")
 *   hostname: string - Nombre del host (automático)
 *   plataforma: string - Sistema operativo
 *   version: string - Versión del cliente
 */
router.post('/register', authenticateSyncClient, async (req, res) => {
  try {
    const { nombre, hostname, plataforma, version } = req.body;
    const tenantId = req.syncClient.tenantId;

    if (!nombre) {
      return res.status(400).json({
        success: false,
        error: 'El campo "nombre" es requerido'
      });
    }

    // Obtener IP del request
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.ip;

    // Buscar si ya existe un cliente con ese nombre para el tenant
    const existingClient = await prisma.sync_clients.findFirst({
      where: {
        tenantId,
        nombre
      }
    });

    let client;

    if (existingClient) {
      // Actualizar cliente existente
      client = await prisma.sync_clients.update({
        where: { id: existingClient.id },
        data: {
          hostname: hostname || existingClient.hostname,
          plataforma: plataforma || existingClient.plataforma,
          version: version || existingClient.version,
          estado: 'online',
          ultimoHeartbeat: new Date(),
          ultimaIp: ip,
          activo: true,
          updatedAt: new Date()
        }
      });

      console.log(`🔄 Cliente actualizado: ${nombre} (${client.id})`);

    } else {
      // Crear nuevo cliente
      client = await prisma.sync_clients.create({
        data: {
          id: uuidv4(),
          tenantId,
          nombre,
          hostname: hostname || os.hostname(),
          plataforma: plataforma || `${os.platform()} ${os.release()}`,
          version: version || '1.0.0',
          config: {}, // Config vacía, se carga del cloud
          estado: 'online',
          ultimoHeartbeat: new Date(),
          ultimaIp: ip,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Cliente registrado: ${nombre} (${client.id})`);
    }

    res.status(existingClient ? 200 : 201).json({
      success: true,
      data: {
        id: client.id,
        nombre: client.nombre,
        estado: client.estado,
        isNew: !existingClient
      },
      message: existingClient ? 'Cliente actualizado' : 'Cliente registrado exitosamente'
    });

  } catch (error) {
    console.error('Error registrando cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar cliente'
    });
  }
});

/**
 * POST /api/v1/sync-clients/:id/heartbeat
 * Envía heartbeat del cliente para indicar que está activo
 *
 * Body (opcional):
 *   stats: { pending, processing, completed, errors }
 *   version: string
 */
router.post('/:id/heartbeat', authenticateSyncClient, async (req, res) => {
  try {
    const { id } = req.params;
    const { stats, version } = req.body;
    const tenantId = req.syncClient.tenantId;

    // Verificar que el cliente existe y pertenece al tenant
    const client = await prisma.sync_clients.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Obtener IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.ip;

    // Preparar datos de actualización
    const updateData = {
      estado: 'online',
      ultimoHeartbeat: new Date(),
      ultimaIp: ip,
      updatedAt: new Date()
    };

    // Actualizar estadísticas si vienen
    if (stats) {
      if (typeof stats.completed === 'number') {
        updateData.documentosProcesados = stats.completed;
      }
      if (typeof stats.errors === 'number') {
        updateData.erroresCount = stats.errors;
      }
    }

    if (version) {
      updateData.version = version;
    }

    const updatedClient = await prisma.sync_clients.update({
      where: { id },
      data: updateData
    });

    // Verificar si hay cambios de configuración pendientes
    const hasConfigChanges = false; // TODO: implementar detección de cambios

    res.json({
      success: true,
      data: {
        estado: updatedClient.estado,
        configChanged: hasConfigChanges,
        serverTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar heartbeat'
    });
  }
});

/**
 * POST /api/v1/sync-clients/:id/logs
 * Recibe logs del cliente para almacenar en la nube
 *
 * Body:
 *   logs: Array de { nivel, mensaje, metadata?, timestamp? }
 */
router.post('/:id/logs', authenticateSyncClient, async (req, res) => {
  try {
    const { id } = req.params;
    const { logs } = req.body;
    const tenantId = req.syncClient.tenantId;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de logs'
      });
    }

    // Verificar que el cliente existe y pertenece al tenant
    const client = await prisma.sync_clients.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Crear logs en batch (máximo 100 por request)
    const logsToCreate = logs.slice(0, 100).map(log => ({
      id: uuidv4(),
      clientId: id,
      nivel: log.nivel || 'info',
      mensaje: log.mensaje || '',
      metadata: log.metadata || null,
      createdAt: log.timestamp ? new Date(log.timestamp) : new Date()
    }));

    await prisma.sync_client_logs.createMany({
      data: logsToCreate
    });

    // Si hay un error reciente, actualizar en el cliente
    const lastError = logs.find(l => l.nivel === 'error');
    if (lastError) {
      await prisma.sync_clients.update({
        where: { id },
        data: {
          ultimoError: lastError.mensaje?.substring(0, 500),
          updatedAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      data: {
        received: logsToCreate.length,
        truncated: logs.length > 100
      }
    });

  } catch (error) {
    console.error('Error guardando logs:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar logs'
    });
  }
});

/**
 * POST /api/v1/sync-clients/:id/document-processed
 * Notifica que un documento fue procesado
 *
 * Body:
 *   documentId: string - ID del documento si se guardó
 *   success: boolean
 *   error?: string
 */
router.post('/:id/document-processed', authenticateSyncClient, async (req, res) => {
  try {
    const { id } = req.params;
    const { documentId, success, error } = req.body;
    const tenantId = req.syncClient.tenantId;

    // Verificar cliente
    const client = await prisma.sync_clients.findFirst({
      where: { id, tenantId }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Actualizar estadísticas
    const updateData = {
      ultimoDocumento: new Date(),
      updatedAt: new Date()
    };

    if (success) {
      updateData.documentosProcesados = { increment: 1 };
    } else {
      updateData.erroresCount = { increment: 1 };
      if (error) {
        updateData.ultimoError = error.substring(0, 500);
      }
    }

    await prisma.sync_clients.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Estadísticas actualizadas'
    });

  } catch (error) {
    console.error('Error actualizando documento procesado:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estadísticas'
    });
  }
});

/**
 * GET /api/v1/sync-clients/:id/status
 * Obtiene el estado actual del cliente desde la perspectiva del servidor
 */
router.get('/:id/status', authenticateSyncClient, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.syncClient.tenantId;

    const client = await prisma.sync_clients.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        nombre: true,
        estado: true,
        version: true,
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

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Determinar si el cliente está activo basado en el último heartbeat
    const heartbeatThreshold = 5 * 60 * 1000; // 5 minutos
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
    console.error('Error obteniendo status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener status'
    });
  }
});

module.exports = router;
