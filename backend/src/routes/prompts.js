const express = require('express');
const { body, validationResult } = require('express-validator');
const { authWithTenant } = require('../middleware/authWithTenant');
const promptManager = require('../services/promptManager');

const router = express.Router();

/**
 * GET /api/prompts
 * Listar todos los prompts del tenant actual
 * Si el usuario es superadmin, también incluye prompts GLOBAL
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { motor, activo, clave } = req.query;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Debe tener un tenant asignado' });
    }

    const filters = {
      tenantId: req.tenantId // Solo prompts del tenant actual
    };

    if (motor) filters.motor = motor;
    if (activo !== undefined) filters.activo = activo === 'true';
    if (clave) filters.clave = clave;

    let prompts = await promptManager.listPrompts(filters);

    // Si es superadmin, también traer prompts GLOBAL
    if (req.isSuperuser) {
      const globalFilters = { ...filters };
      delete globalFilters.tenantId; // Remover filtro de tenant
      globalFilters.tenantId = null; // Buscar solo GLOBAL

      const globalPrompts = await promptManager.listPrompts(globalFilters);

      // Combinar prompts del tenant con prompts GLOBAL
      prompts = [...prompts, ...globalPrompts];

      console.log(`🔑 Superadmin: ${prompts.length} prompts (${globalPrompts.length} GLOBAL)`);
    }

    res.json({
      prompts,
      count: prompts.length,
      isSuperuser: req.isSuperuser || false
    });

  } catch (error) {
    console.error('Error listando prompts:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * GET /api/prompts/motores-disponibles
 * Obtener lista de motores de IA disponibles para el tenant
 */
router.get('/motores-disponibles', authWithTenant, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Motores base disponibles globalmente
    const motoresGlobales = [
      {
        id: 'gemini',
        nombre: 'Google Gemini',
        descripcion: 'Gemini - Modelos de Google AI (requiere API key nueva)',
        requiresConfig: true,
        isGlobal: true
      },
      {
        id: 'anthropic',
        nombre: 'Anthropic Claude',
        descripcion: 'Claude 3 - Haiku, Sonnet y Opus',
        requiresConfig: true,
        isGlobal: true
      },
      {
        id: 'openai',
        nombre: 'OpenAI',
        descripcion: 'GPT-4 y modelos de OpenAI',
        requiresConfig: true,
        isGlobal: true
      },
      {
        id: 'ollama',
        nombre: 'Ollama (IA Local)',
        descripcion: 'Modelos locales con Ollama',
        requiresConfig: false,
        isGlobal: true
      }
    ];

    // Si el usuario tiene tenant, buscar configuraciones personalizadas
    let motoresTenant = [];
    if (req.tenantId) {
      console.log(`🔍 Buscando configuraciones de IA para tenant: ${req.tenantId}`);

      const configs = await prisma.ai_provider_configs.findMany({
        where: {
          tenantId: req.tenantId,
          activo: true
        },
        select: {
          provider: true,
          modelo: true,
          activo: true
        }
      });

      console.log(`📦 Configuraciones encontradas: ${configs.length}`);
      configs.forEach(config => {
        console.log(`   - ${config.provider}: ${config.modelo}`);
      });

      motoresTenant = configs.map(config => ({
        id: config.provider,
        nombre: motoresGlobales.find(m => m.id === config.provider)?.nombre || config.provider,
        descripcion: `Configurado para tenant - Modelo: ${config.modelo || 'default'}`,
        requiresConfig: false,
        isGlobal: false,
        hasCustomConfig: true,
        modelo: config.modelo
      }));
    } else {
      console.log('⚠️  Usuario sin tenantId asignado');
    }

    // Combinar motores, priorizando configuraciones del tenant
    const motoresDisponibles = motoresGlobales.map(global => {
      const tenantConfig = motoresTenant.find(t => t.id === global.id);
      if (tenantConfig) {
        return {
          ...global,
          ...tenantConfig,
          isConfigured: true
        };
      }
      return {
        ...global,
        isConfigured: false
      };
    });

    await prisma.$disconnect();

    console.log(`✅ Enviando ${motoresDisponibles.length} motores disponibles al cliente`);
    console.log(`   Configurados: ${motoresDisponibles.filter(m => m.isConfigured).length}`);

    res.json({
      motores: motoresDisponibles,
      tenantId: req.tenantId
    });

  } catch (error) {
    console.error('Error obteniendo motores disponibles:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * GET /api/prompts/stats/cache
 * Obtener estadísticas del cache (solo superuser)
 */
router.get('/stats/cache', authWithTenant, async (req, res) => {
  try {
    if (!req.isSuperuser) {
      return res.status(403).json({ error: 'Solo superusers pueden ver estadísticas del cache' });
    }

    const stats = promptManager.getCacheStats();

    res.json(stats);

  } catch (error) {
    console.error('Error obteniendo stats del cache:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * POST /api/prompts/test
 * Probar un prompt con variables
 */
router.post('/test', [
  authWithTenant,
  body('clave').isString().notEmpty(),
  body('variables').optional().isObject(),
  body('motor').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clave, variables, motor } = req.body;

    const promptText = await promptManager.getPromptText(
      clave,
      variables || {},
      req.tenantId,
      motor
    );

    if (!promptText) {
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    res.json({
      clave,
      variables: variables || {},
      resultado: promptText
    });

  } catch (error) {
    console.error('Error probando prompt:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * POST /api/prompts/cache/clear
 * Limpiar el cache (solo superuser)
 */
router.post('/cache/clear', authWithTenant, async (req, res) => {
  try {
    if (!req.isSuperuser) {
      return res.status(403).json({ error: 'Solo superusers pueden limpiar el cache' });
    }

    promptManager.clearCache();

    res.json({
      message: 'Cache limpiado exitosamente'
    });

  } catch (error) {
    console.error('Error limpiando cache:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * GET /api/prompts/:id
 * Obtener un prompt por ID (solo del tenant actual)
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Debe tener un tenant asignado' });
    }

    const prompt = await promptManager.listPrompts({
      id,
      tenantId: req.tenantId // Solo del tenant actual
    });

    if (!prompt || prompt.length === 0) {
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    res.json(prompt[0]);

  } catch (error) {
    console.error('Error obteniendo prompt:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * POST /api/prompts
 * Crear un nuevo prompt
 * - Usuario normal: siempre asociado al tenant del usuario
 * - Superadmin: puede crear prompts GLOBAL enviando isGlobal: true
 */
router.post('/', [
  authWithTenant,
  body('clave').isString().trim().notEmpty().withMessage('Clave es requerida'),
  body('nombre').isString().trim().notEmpty().withMessage('Nombre es requerido'),
  body('prompt').isString().trim().notEmpty().withMessage('Prompt es requerido'),
  body('descripcion').optional().isString(),
  body('variables').optional().isObject(),
  body('motor').optional().isString(),
  body('activo').optional().isBoolean(),
  body('isGlobal').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clave, nombre, prompt, descripcion, variables, motor, activo, isGlobal } = req.body;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Debe tener un tenant asignado' });
    }

    // Determinar el tenantId según el usuario y el flag isGlobal
    let tenantId = req.tenantId; // Por defecto, usar el tenant del usuario

    if (isGlobal === true) {
      // Solo superadmins pueden crear prompts GLOBAL
      if (!req.isSuperuser) {
        return res.status(403).json({ error: 'Solo superadmins pueden crear prompts GLOBAL' });
      }
      tenantId = null; // Prompt GLOBAL (sin tenant)
      console.log(`🔑 Superadmin creando prompt GLOBAL: ${clave}`);
    }

    const nuevoPrompt = await promptManager.upsertPrompt({
      clave,
      nombre,
      prompt,
      descripcion,
      variables,
      motor,
      activo: activo !== undefined ? activo : true,
      tenantId,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    res.status(201).json({
      message: `Prompt ${tenantId === null ? 'GLOBAL' : 'del tenant'} creado exitosamente`,
      prompt: nuevoPrompt
    });

  } catch (error) {
    console.error('Error creando prompt:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un prompt con esa clave para este tenant' });
    }

    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * PUT /api/prompts/:id
 * Actualizar un prompt existente
 * - Usuario normal: solo prompts de su tenant
 * - Superadmin: puede editar prompts de su tenant o GLOBAL
 */
router.put('/:id', [
  authWithTenant,
  body('nombre').optional().isString(),
  body('prompt').optional().isString(),
  body('descripcion').optional().isString(),
  body('variables').optional().isObject(),
  body('motor').optional().isString(),
  body('activo').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { nombre, prompt, descripcion, variables, motor, activo } = req.body;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Debe tener un tenant asignado' });
    }

    // Buscar el prompt por ID
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const promptExistente = await prisma.ai_prompts.findUnique({
      where: { id }
    });

    if (!promptExistente) {
      await prisma.$disconnect();
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    // Verificar permisos:
    // - Usuario normal: solo puede editar prompts de su tenant
    // - Superadmin: puede editar prompts de su tenant o GLOBAL
    const isOwnTenant = promptExistente.tenantId === req.tenantId;
    const isGlobal = promptExistente.tenantId === null;
    const canEdit = isOwnTenant || (req.isSuperuser && isGlobal);

    if (!canEdit) {
      await prisma.$disconnect();
      return res.status(403).json({
        error: 'No tienes permiso para editar este prompt'
      });
    }

    if (isGlobal && req.isSuperuser) {
      console.log(`🔑 Superadmin editando prompt GLOBAL: ${promptExistente.clave}`);
    }

    await prisma.$disconnect();

    // Actualizar usando upsert (para incrementar versión automáticamente)
    const promptActualizado = await promptManager.upsertPrompt({
      clave: promptExistente.clave,
      tenantId: promptExistente.tenantId,
      nombre: nombre || promptExistente.nombre,
      prompt: prompt || promptExistente.prompt,
      descripcion: descripcion !== undefined ? descripcion : promptExistente.descripcion,
      variables: variables !== undefined ? variables : promptExistente.variables,
      motor: motor !== undefined ? motor : promptExistente.motor,
      activo: activo !== undefined ? activo : promptExistente.activo,
      updatedBy: req.user.id
    });

    res.json({
      message: 'Prompt actualizado exitosamente',
      prompt: promptActualizado
    });

  } catch (error) {
    console.error('Error actualizando prompt:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * DELETE /api/prompts/:id
 * Eliminar un prompt
 * - Usuario normal: solo prompts de su tenant
 * - Superadmin: puede eliminar prompts de su tenant o GLOBAL
 */
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario tenga un tenant asignado
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Debe tener un tenant asignado' });
    }

    // Buscar el prompt por ID
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const promptExistente = await prisma.ai_prompts.findUnique({
      where: { id }
    });

    if (!promptExistente) {
      await prisma.$disconnect();
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    // Verificar permisos:
    // - Usuario normal: solo puede eliminar prompts de su tenant
    // - Superadmin: puede eliminar prompts de su tenant o GLOBAL
    const isOwnTenant = promptExistente.tenantId === req.tenantId;
    const isGlobal = promptExistente.tenantId === null;
    const canDelete = isOwnTenant || (req.isSuperuser && isGlobal);

    if (!canDelete) {
      await prisma.$disconnect();
      return res.status(403).json({
        error: 'No tienes permiso para eliminar este prompt'
      });
    }

    if (isGlobal && req.isSuperuser) {
      console.log(`⚠️  Superadmin eliminando prompt GLOBAL: ${promptExistente.clave}`);
    }

    await prisma.$disconnect();

    await promptManager.deletePrompt(id);

    res.json({
      message: 'Prompt eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando prompt:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
