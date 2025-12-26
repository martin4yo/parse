const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authWithTenant } = require('../middleware/authWithTenant');
const prisma = new PrismaClient();

/**
 * Genera una API key segura con prefijo
 */
function generateApiKey() {
  const prefix = 'sk';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${randomPart}`;
}

/**
 * Hash de la API key para almacenamiento seguro
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Crea un preview de la key para mostrar (primeros y últimos 4 caracteres)
 */
function createKeyPreview(apiKey) {
  if (apiKey.length < 12) return apiKey;
  const start = apiKey.substring(0, 7); // sk_ + 4 chars
  const end = apiKey.substring(apiKey.length - 4);
  return `${start}...${end}`;
}

/**
 * GET /api/sync/api-keys
 * Lista todas las API keys del tenant actual
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { activo } = req.query;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    const where = {
      tenantId: req.tenantId // Solo API keys del tenant actual
    };

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    const apiKeys = await prisma.sync_api_keys.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        keyPreview: true,
        permisos: true,
        activo: true,
        ultimoUso: true,
        ultimoUsoIp: true,
        vecesUtilizada: true,
        expiraEn: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        usuarioId: true,
        tenants: {
          select: {
            nombre: true,
            slug: true,
          },
        },
        users: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    console.error('Error al listar API keys:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sync/api-keys/:id
 * Obtiene una API key por ID (solo del tenant actual)
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    const apiKey = await prisma.sync_api_keys.findFirst({
      where: {
        id,
        tenantId: req.tenantId // Solo del tenant actual
      },
      select: {
        id: true,
        nombre: true,
        keyPreview: true,
        permisos: true,
        activo: true,
        ultimoUso: true,
        ultimoUsoIp: true,
        vecesUtilizada: true,
        expiraEn: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        usuarioId: true,
        tenants: {
          select: {
            nombre: true,
            slug: true,
          },
        },
        users: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key no encontrada',
      });
    }

    res.json({
      success: true,
      data: apiKey,
    });
  } catch (error) {
    console.error('Error al obtener API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/api-keys
 * Crea una nueva API key (solo para el tenant actual)
 */
router.post('/', authWithTenant, async (req, res) => {
  try {
    const { nombre, permisos = {}, expiraEn, usuarioId } = req.body;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    // Usar siempre el tenantId del usuario autenticado
    const tenantId = req.tenantId;

    // Validar campos requeridos
    if (!nombre) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
      });
    }

    // Validar que el usuarioId pertenezca al tenant (si se proporciona)
    if (usuarioId) {
      const usuario = await prisma.users.findFirst({
        where: {
          id: usuarioId,
          tenantId: tenantId,
          activo: true
        }
      });

      if (!usuario) {
        return res.status(400).json({
          success: false,
          error: 'El usuario seleccionado no existe o no pertenece al tenant'
        });
      }
    }

    // Generar la API key
    const plainKey = generateApiKey();
    const hashedKey = hashApiKey(plainKey);
    const preview = createKeyPreview(plainKey);

    // Crear el registro
    const apiKey = await prisma.sync_api_keys.create({
      data: {
        id: uuidv4(),
        tenantId,
        usuarioId: usuarioId || null,
        nombre,
        key: hashedKey,
        keyPreview: preview,
        permisos,
        expiraEn: expiraEn ? new Date(expiraEn) : null,
        createdBy: req.user.id,
        updatedAt: new Date(),
      },
      include: {
        tenants: {
          select: {
            nombre: true,
            slug: true,
          },
        },
        users: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    // IMPORTANTE: Solo devolvemos la key en texto plano UNA VEZ al crearla
    res.status(201).json({
      success: true,
      data: {
        ...apiKey,
        plainKey, // Solo se muestra al crear
      },
      message: '⚠️ IMPORTANTE: Guarda esta API key, no se volverá a mostrar.',
    });
  } catch (error) {
    console.error('Error al crear API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/sync/api-keys/:id
 * Actualiza una API key (solo del tenant actual)
 */
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, permisos, activo, expiraEn, usuarioId } = req.body;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    // Verificar que la API key existe y pertenece al tenant actual
    const existingKey = await prisma.sync_api_keys.findFirst({
      where: {
        id,
        tenantId: req.tenantId // Solo del tenant actual
      },
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key no encontrada',
      });
    }

    // Validar que el usuarioId pertenezca al tenant (si se proporciona)
    if (usuarioId) {
      const usuario = await prisma.users.findFirst({
        where: {
          id: usuarioId,
          tenantId: req.tenantId,
          activo: true
        }
      });

      if (!usuario) {
        return res.status(400).json({
          success: false,
          error: 'El usuario seleccionado no existe o no pertenece al tenant'
        });
      }
    }

    const updateData = { updatedAt: new Date() };
    if (nombre !== undefined) updateData.nombre = nombre;
    if (permisos !== undefined) updateData.permisos = permisos;
    if (activo !== undefined) updateData.activo = activo;
    if (expiraEn !== undefined)
      updateData.expiraEn = expiraEn ? new Date(expiraEn) : null;
    if (usuarioId !== undefined)
      updateData.usuarioId = usuarioId || null; // Permite null para quitar asignación

    const apiKey = await prisma.sync_api_keys.update({
      where: { id },
      data: updateData,
      include: {
        tenants: {
          select: {
            nombre: true,
            slug: true,
          },
        },
        users: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: apiKey,
    });
  } catch (error) {
    console.error('Error al actualizar API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/sync/api-keys/:id
 * Elimina una API key (solo del tenant actual)
 */
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    // Verificar que la API key existe y pertenece al tenant actual
    const existingKey = await prisma.sync_api_keys.findFirst({
      where: {
        id,
        tenantId: req.tenantId // Solo del tenant actual
      },
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key no encontrada',
      });
    }

    await prisma.sync_api_keys.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'API key eliminada correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/api-keys/:id/regenerate
 * Regenera una API key (crea una nueva key pero mantiene la configuración) (solo del tenant actual)
 */
router.post('/:id/regenerate', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    // Verificar que la API key existe y pertenece al tenant actual
    const existingKey = await prisma.sync_api_keys.findFirst({
      where: {
        id,
        tenantId: req.tenantId // Solo del tenant actual
      },
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key no encontrada',
      });
    }

    // Generar nueva API key
    const plainKey = generateApiKey();
    const hashedKey = hashApiKey(plainKey);
    const preview = createKeyPreview(plainKey);

    // Actualizar con la nueva key
    const apiKey = await prisma.sync_api_keys.update({
      where: { id },
      data: {
        key: hashedKey,
        keyPreview: preview,
        vecesUtilizada: 0, // Resetear contador
        ultimoUso: null,
        ultimoUsoIp: null,
      },
      include: {
        tenants: {
          select: {
            nombre: true,
            slug: true,
          },
        },
      },
    });

    // IMPORTANTE: Solo devolvemos la key en texto plano UNA VEZ
    res.json({
      success: true,
      data: {
        ...apiKey,
        plainKey, // Solo se muestra al regenerar
      },
      message: '⚠️ IMPORTANTE: Guarda esta API key, no se volverá a mostrar.',
    });
  } catch (error) {
    console.error('Error al regenerar API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sync/api-keys/parse-logs
 * Obtener logs de Parse API para el tenant actual (uso interno desde frontend)
 */
router.get('/parse-logs', authWithTenant, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    const {
      limit = '50',
      offset = '0',
      estado,
      operacion,
      desde,
      hasta
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    // Construir filtros
    const where = {
      tenantId: req.tenantId
    };

    if (estado) {
      where.estado = estado;
    }

    if (operacion) {
      where.operacion = operacion;
    }

    if (desde || hasta) {
      where.createdAt = {};
      if (desde) {
        where.createdAt.gte = new Date(desde);
      }
      if (hasta) {
        where.createdAt.lte = new Date(hasta);
      }
    }

    // Obtener logs y estadísticas en paralelo
    const [logs, total, completados, errores, avgDuration] = await Promise.all([
      prisma.parse_api_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offsetNum
      }),
      prisma.parse_api_logs.count({ where }),
      prisma.parse_api_logs.count({
        where: { tenantId: req.tenantId, estado: 'completado' }
      }),
      prisma.parse_api_logs.count({
        where: { tenantId: req.tenantId, estado: 'error' }
      }),
      prisma.parse_api_logs.aggregate({
        where: { tenantId: req.tenantId, estado: 'completado' },
        _avg: { duracionMs: true }
      })
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + logs.length < total
      },
      stats: {
        total: completados + errores,
        completados,
        errores,
        tasaExito: completados + errores > 0
          ? Math.round((completados / (completados + errores)) * 100)
          : 0,
        promedioMs: Math.round(avgDuration._avg.duracionMs || 0)
      }
    });

  } catch (error) {
    console.error('Error obteniendo parse logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/api-keys/parse-logs/:id
 * Obtener detalle de un log específico
 */
router.get('/parse-logs/:id', authWithTenant, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Debe tener un tenant asignado'
      });
    }

    const log = await prisma.parse_api_logs.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log no encontrado'
      });
    }

    res.json({
      success: true,
      log
    });

  } catch (error) {
    console.error('Error obteniendo log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { router, hashApiKey };
