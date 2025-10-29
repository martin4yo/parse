const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
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
 * Lista todas las API keys del tenant
 */
router.get('/', async (req, res) => {
  try {
    const { tenantId, activo } = req.query;

    const where = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

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
        tenant: {
          select: {
            nombre: true,
            slug: true,
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
 * Obtiene una API key por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await prisma.sync_api_keys.findUnique({
      where: { id },
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
        tenant: {
          select: {
            nombre: true,
            slug: true,
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
 * Crea una nueva API key
 */
router.post('/', async (req, res) => {
  try {
    const { tenantId, nombre, permisos = {}, expiraEn, createdBy } = req.body;

    // Validar campos requeridos
    if (!tenantId || !nombre) {
      return res.status(400).json({
        success: false,
        error: 'tenantId y nombre son requeridos',
      });
    }

    // Verificar que el tenant existe
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant no encontrado',
      });
    }

    // Generar la API key
    const plainKey = generateApiKey();
    const hashedKey = hashApiKey(plainKey);
    const preview = createKeyPreview(plainKey);

    // Crear el registro
    const apiKey = await prisma.sync_api_keys.create({
      data: {
        tenantId,
        nombre,
        key: hashedKey,
        keyPreview: preview,
        permisos,
        expiraEn: expiraEn ? new Date(expiraEn) : null,
        createdBy,
      },
      include: {
        tenant: {
          select: {
            nombre: true,
            slug: true,
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
 * Actualiza una API key
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, permisos, activo, expiraEn } = req.body;

    // Verificar que la API key existe
    const existingKey = await prisma.sync_api_keys.findUnique({
      where: { id },
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key no encontrada',
      });
    }

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (permisos !== undefined) updateData.permisos = permisos;
    if (activo !== undefined) updateData.activo = activo;
    if (expiraEn !== undefined)
      updateData.expiraEn = expiraEn ? new Date(expiraEn) : null;

    const apiKey = await prisma.sync_api_keys.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            nombre: true,
            slug: true,
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
 * Elimina una API key
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la API key existe
    const existingKey = await prisma.sync_api_keys.findUnique({
      where: { id },
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
 * Regenera una API key (crea una nueva key pero mantiene la configuración)
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la API key existe
    const existingKey = await prisma.sync_api_keys.findUnique({
      where: { id },
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
        tenant: {
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

module.exports = { router, hashApiKey };
