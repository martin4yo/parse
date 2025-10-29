const express = require('express');
const { body, validationResult } = require('express-validator');
const { authWithTenant } = require('../middleware/authWithTenant');
const promptManager = require('../services/promptManager');

const router = express.Router();

/**
 * GET /api/prompts
 * Listar todos los prompts (con filtros opcionales)
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { motor, activo, clave, tenantId } = req.query;

    const filters = {};

    if (motor) filters.motor = motor;
    if (activo !== undefined) filters.activo = activo === 'true';
    if (clave) filters.clave = clave;

    // Si el usuario no es superuser, solo puede ver prompts de su tenant o globales
    if (!req.isSuperuser) {
      // Buscar prompts globales y del tenant del usuario
      const prompts = await promptManager.listPrompts({
        ...filters,
        tenantId: null // Globales
      });

      const promptsTenant = req.tenantId ? await promptManager.listPrompts({
        ...filters,
        tenantId: req.tenantId
      }) : [];

      return res.json({
        prompts: [...prompts, ...promptsTenant],
        count: prompts.length + promptsTenant.length
      });
    }

    // Superuser puede ver todos
    if (tenantId !== undefined) {
      filters.tenantId = tenantId === 'null' ? null : tenantId;
    }

    const prompts = await promptManager.listPrompts(filters);

    res.json({
      prompts,
      count: prompts.length
    });

  } catch (error) {
    console.error('Error listando prompts:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * GET /api/prompts/:id
 * Obtener un prompt por ID
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await promptManager.listPrompts({ id });

    if (!prompt || prompt.length === 0) {
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    // Verificar permisos
    const promptData = prompt[0];

    if (!req.isSuperuser && promptData.tenantId && promptData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'No tiene permisos para ver este prompt' });
    }

    res.json(promptData);

  } catch (error) {
    console.error('Error obteniendo prompt:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * POST /api/prompts
 * Crear un nuevo prompt
 */
router.post('/', [
  authWithTenant,
  body('clave').isString().trim().notEmpty().withMessage('Clave es requerida'),
  body('nombre').isString().trim().notEmpty().withMessage('Nombre es requerido'),
  body('prompt').isString().trim().notEmpty().withMessage('Prompt es requerido'),
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

    const { clave, nombre, prompt, descripcion, variables, motor, activo } = req.body;

    // Determinar tenantId
    let tenantId = null;

    // Si no es superuser, forzar tenantId del usuario
    if (!req.isSuperuser) {
      if (!req.tenantId) {
        return res.status(400).json({ error: 'Debe tener un tenant asignado' });
      }
      tenantId = req.tenantId;
    } else {
      // Superuser puede crear prompts globales o para un tenant específico
      tenantId = req.body.tenantId || null;
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
      message: 'Prompt creado exitosamente',
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

    // Verificar que el prompt existe y el usuario tiene permisos
    const promptExistente = await promptManager.listPrompts({ id });

    if (!promptExistente || promptExistente.length === 0) {
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    const promptData = promptExistente[0];

    // Verificar permisos
    if (!req.isSuperuser && promptData.tenantId && promptData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'No tiene permisos para editar este prompt' });
    }

    // Actualizar usando upsert (para incrementar versión automáticamente)
    const promptActualizado = await promptManager.upsertPrompt({
      clave: promptData.clave,
      tenantId: promptData.tenantId,
      nombre: nombre || promptData.nombre,
      prompt: prompt || promptData.prompt,
      descripcion: descripcion !== undefined ? descripcion : promptData.descripcion,
      variables: variables !== undefined ? variables : promptData.variables,
      motor: motor !== undefined ? motor : promptData.motor,
      activo: activo !== undefined ? activo : promptData.activo,
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
 */
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el prompt existe y el usuario tiene permisos
    const promptExistente = await promptManager.listPrompts({ id });

    if (!promptExistente || promptExistente.length === 0) {
      return res.status(404).json({ error: 'Prompt no encontrado' });
    }

    const promptData = promptExistente[0];

    // Verificar permisos
    if (!req.isSuperuser && promptData.tenantId && promptData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'No tiene permisos para eliminar este prompt' });
    }

    await promptManager.deletePrompt(id);

    res.json({
      message: 'Prompt eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando prompt:', error);
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

module.exports = router;
