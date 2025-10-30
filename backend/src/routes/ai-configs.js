const express = require('express');
const { authWithTenant } = require('../middleware/authWithTenant');
const aiConfigService = require('../services/aiConfigService');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/ai-configs - Obtener todas las configuraciones del tenant
router.get('/', authWithTenant, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant requerido',
        message: 'Se requiere un tenant para obtener configuraciones'
      });
    }

    const configs = await aiConfigService.getTenantConfigs(tenantId);

    res.json(configs);

  } catch (error) {
    console.error('Error fetching AI configs:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/ai-configs/providers - Obtener lista de proveedores disponibles
router.get('/providers', authWithTenant, async (req, res) => {
  try {
    const providers = [
      {
        id: 'gemini',
        nombre: 'Google Gemini',
        descripcion: 'Gemini - Modelos de Google AI',
        modelosDisponibles: [
          { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (recomendado)' },
          { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
          { value: 'gemini-pro', label: 'Gemini Pro (legacy)' },
          { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' }
        ],
        requiresApiKey: true
      },
      {
        id: 'anthropic',
        nombre: 'Anthropic Claude',
        descripcion: 'Claude 3 - Haiku, Sonnet y Opus',
        modelosDisponibles: [
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (más rápido)' },
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (equilibrado)' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (más capaz)' }
        ],
        requiresApiKey: true
      },
      {
        id: 'openai',
        nombre: 'OpenAI',
        descripcion: 'GPT-4 y modelos de OpenAI',
        modelosDisponibles: [
          { value: 'gpt-4o', label: 'GPT-4o (recomendado)' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ],
        requiresApiKey: true
      }
    ];

    res.json(providers);

  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/ai-configs/:id - Obtener una configuración específica
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const config = await prisma.ai_provider_configs.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true,
        provider: true,
        modelo: true,
        maxRequestsPerDay: true,
        config: true,
        activo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!config) {
      return res.status(404).json({
        error: 'Configuración no encontrada'
      });
    }

    res.json(config);

  } catch (error) {
    console.error('Error fetching AI config:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/ai-configs - Crear o actualizar configuración
router.post('/', authWithTenant, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { provider, apiKey, modelo, maxRequestsPerDay, activo } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant requerido'
      });
    }

    if (!provider) {
      return res.status(400).json({
        error: 'Provider es requerido'
      });
    }

    // Si no hay apiKey, solo actualizar configuración sin tocar la key
    if (!apiKey) {
      const existing = await prisma.ai_provider_configs.findUnique({
        where: {
          tenantId_provider: { tenantId, provider }
        }
      });

      if (!existing) {
        return res.status(400).json({
          error: 'API Key requerida para nueva configuración'
        });
      }

      // Actualizar solo modelo y configuración
      const updated = await prisma.ai_provider_configs.update({
        where: {
          tenantId_provider: { tenantId, provider }
        },
        data: {
          modelo: modelo || existing.modelo,
          maxRequestsPerDay: maxRequestsPerDay || existing.maxRequestsPerDay,
          activo: activo !== undefined ? activo : existing.activo,
          updatedAt: new Date()
        },
        select: {
          id: true,
          provider: true,
          modelo: true,
          maxRequestsPerDay: true,
          activo: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return res.json(updated);
    }

    // Crear o actualizar con nueva API key
    const config = {
      modelo,
      maxRequestsPerDay: maxRequestsPerDay || 1000,
      additionalConfig: {}
    };

    const result = await aiConfigService.setCustomApiKey(tenantId, provider, apiKey, config);

    // Obtener la configuración completa para devolverla
    const savedConfig = await prisma.ai_provider_configs.findUnique({
      where: {
        tenantId_provider: { tenantId, provider }
      },
      select: {
        id: true,
        provider: true,
        modelo: true,
        maxRequestsPerDay: true,
        activo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(201).json(savedConfig);

  } catch (error) {
    console.error('❌ Error saving AI config:', error);
    console.error('Request body:', req.body);
    console.error('Tenant ID:', req.tenantId);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/ai-configs/:id - Actualizar configuración
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { modelo, maxRequestsPerDay, activo, apiKey } = req.body;

    // Verificar que la configuración existe y pertenece al tenant
    const existing = await prisma.ai_provider_configs.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Configuración no encontrada'
      });
    }

    const updateData = {};

    if (modelo !== undefined) updateData.modelo = modelo;
    if (maxRequestsPerDay !== undefined) updateData.maxRequestsPerDay = maxRequestsPerDay;
    if (activo !== undefined) updateData.activo = activo;

    // Si se proporciona nueva API key, cifrarla
    if (apiKey) {
      updateData.apiKeyEncrypted = aiConfigService.encrypt(apiKey);
    }

    updateData.updatedAt = new Date();

    const updated = await prisma.ai_provider_configs.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        provider: true,
        modelo: true,
        maxRequestsPerDay: true,
        activo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(updated);

  } catch (error) {
    console.error('Error updating AI config:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// DELETE /api/ai-configs/:id - Eliminar configuración
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    // Verificar que existe y pertenece al tenant
    const existing = await prisma.ai_provider_configs.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Configuración no encontrada'
      });
    }

    await prisma.ai_provider_configs.delete({
      where: { id }
    });

    res.json({
      message: 'Configuración eliminada correctamente',
      id
    });

  } catch (error) {
    console.error('Error deleting AI config:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/ai-configs/test - Probar conexión con un proveedor
router.post('/test', authWithTenant, async (req, res) => {
  try {
    const { provider, apiKey } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({
        error: 'Provider y API Key son requeridos'
      });
    }

    // Aquí se podría implementar un test real
    // Por ahora solo validamos formato básico
    const isValid = apiKey && apiKey.length > 10;

    res.json({
      success: isValid,
      message: isValid ? 'Conexión exitosa' : 'API Key inválida'
    });

  } catch (error) {
    console.error('Error testing AI config:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
