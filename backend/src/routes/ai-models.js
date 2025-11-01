const express = require('express');
const { authWithTenant } = require('../middleware/authWithTenant');
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/ai-models - Obtener todos los modelos (opcionalmente filtrar por provider)
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { provider, active } = req.query;

    const where = {};

    if (provider) {
      where.provider = provider;
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const models = await prisma.ai_models.findMany({
      where,
      orderBy: [
        { provider: 'asc' },
        { orderIndex: 'asc' }
      ]
    });

    res.json(models);

  } catch (error) {
    console.error('Error fetching AI models:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/ai-models/by-provider - Obtener modelos agrupados por provider
router.get('/by-provider', authWithTenant, async (req, res) => {
  try {
    const models = await prisma.ai_models.findMany({
      orderBy: [
        { provider: 'asc' },
        { orderIndex: 'asc' }
      ]
    });

    // Agrupar por provider
    const grouped = models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {});

    res.json(grouped);

  } catch (error) {
    console.error('Error fetching AI models by provider:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/ai-models/:id - Obtener un modelo específico
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const model = await prisma.ai_models.findUnique({
      where: { id }
    });

    if (!model) {
      return res.status(404).json({
        error: 'Modelo no encontrado'
      });
    }

    res.json(model);

  } catch (error) {
    console.error('Error fetching AI model:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/ai-models - Crear nuevo modelo
router.post('/', authWithTenant, async (req, res) => {
  try {
    const {
      provider,
      modelId,
      name,
      description,
      recommended,
      active,
      deprecated,
      orderIndex
    } = req.body;

    // Validaciones
    if (!provider || !modelId || !name) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Provider, modelId y name son obligatorios'
      });
    }

    // Verificar que no exista ya
    const existing = await prisma.ai_models.findUnique({
      where: {
        provider_modelId: { provider, modelId }
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'Modelo duplicado',
        message: `Ya existe un modelo con ID "${modelId}" para el proveedor "${provider}"`
      });
    }

    // Si se marca como recomendado, quitar recomendado de otros modelos del mismo provider
    if (recommended) {
      await prisma.ai_models.updateMany({
        where: {
          provider,
          recommended: true
        },
        data: {
          recommended: false,
          updatedAt: new Date()
        }
      });
    }

    // Crear modelo
    const newModel = await prisma.ai_models.create({
      data: {
        id: uuidv4(),
        provider,
        modelId,
        name,
        description: description || null,
        recommended: recommended || false,
        active: active !== undefined ? active : true,
        deprecated: deprecated || false,
        orderIndex: orderIndex || 0,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Modelo creado: ${name} (${provider})`);

    res.status(201).json(newModel);

  } catch (error) {
    console.error('Error creating AI model:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PUT /api/ai-models/:id - Actualizar modelo
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      modelId,
      name,
      description,
      recommended,
      active,
      deprecated,
      orderIndex
    } = req.body;

    // Verificar que existe
    const existing = await prisma.ai_models.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Modelo no encontrado'
      });
    }

    // Si se marca como recomendado, quitar recomendado de otros modelos del mismo provider
    if (recommended && !existing.recommended) {
      await prisma.ai_models.updateMany({
        where: {
          provider: existing.provider,
          recommended: true,
          id: { not: id }
        },
        data: {
          recommended: false,
          updatedAt: new Date()
        }
      });
    }

    const updateData = {};

    if (modelId !== undefined) updateData.modelId = modelId;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (recommended !== undefined) updateData.recommended = recommended;
    if (active !== undefined) updateData.active = active;
    if (deprecated !== undefined) updateData.deprecated = deprecated;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;

    updateData.updatedAt = new Date();

    const updated = await prisma.ai_models.update({
      where: { id },
      data: updateData
    });

    console.log(`✅ Modelo actualizado: ${updated.name} (${updated.provider})`);

    res.json(updated);

  } catch (error) {
    console.error('Error updating AI model:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Modelo duplicado',
        message: 'Ya existe un modelo con ese ID para este proveedor'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// DELETE /api/ai-models/:id - Eliminar modelo
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existing = await prisma.ai_models.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Modelo no encontrado'
      });
    }

    // Verificar si está en uso (opcional - podrías agregar una verificación)
    // Por ejemplo, verificar si hay configuraciones usando este modelo
    const inUse = await prisma.ai_provider_configs.count({
      where: {
        provider: existing.provider,
        modelo: existing.modelId
      }
    });

    if (inUse > 0) {
      return res.status(409).json({
        error: 'Modelo en uso',
        message: `Este modelo está siendo usado por ${inUse} configuración(es). Cambia las configuraciones antes de eliminarlo.`
      });
    }

    await prisma.ai_models.delete({
      where: { id }
    });

    console.log(`✅ Modelo eliminado: ${existing.name} (${existing.provider})`);

    res.json({
      message: 'Modelo eliminado correctamente',
      id
    });

  } catch (error) {
    console.error('Error deleting AI model:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PATCH /api/ai-models/:id/toggle-recommended - Toggle recomendado
router.patch('/:id/toggle-recommended', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const model = await prisma.ai_models.findUnique({
      where: { id }
    });

    if (!model) {
      return res.status(404).json({
        error: 'Modelo no encontrado'
      });
    }

    const newRecommended = !model.recommended;

    // Si se marca como recomendado, quitar de otros
    if (newRecommended) {
      await prisma.ai_models.updateMany({
        where: {
          provider: model.provider,
          recommended: true,
          id: { not: id }
        },
        data: {
          recommended: false,
          updatedAt: new Date()
        }
      });
    }

    const updated = await prisma.ai_models.update({
      where: { id },
      data: {
        recommended: newRecommended,
        updatedAt: new Date()
      }
    });

    res.json(updated);

  } catch (error) {
    console.error('Error toggling recommended:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
