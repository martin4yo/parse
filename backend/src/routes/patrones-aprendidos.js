/**
 * API Routes - Patrones Aprendidos
 *
 * Endpoints para gestionar el sistema de aprendizaje continuo
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/auth');
const patternLearningService = require('../services/patternLearningService');

/**
 * POST /api/patrones-aprendidos/aprender-manual
 *
 * Aprendizaje manual: cuando el usuario corrige un valor
 * Este es el endpoint más importante para mejorar el sistema
 */
router.post('/aprender-manual', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const {
      tipoPatron,       // Tipo de patrón (cuenta_linea, tipo_producto, etc.)
      inputPattern,     // Patrón de entrada (descripción, CUIT, etc.)
      outputValue,      // Valor correcto asignado por el usuario
      outputCampo,      // Campo destino
      documentoId       // ID del documento (opcional, para contexto)
    } = req.body;

    // Validaciones
    if (!tipoPatron || !inputPattern || !outputValue || !outputCampo) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos',
        required: ['tipoPatron', 'inputPattern', 'outputValue', 'outputCampo']
      });
    }

    console.log('📚 [API] Aprendizaje manual solicitado:', {
      tipoPatron,
      outputValue,
      usuario: req.user.email
    });

    // Aprender patrón con confianza máxima (manual = 100%)
    const patron = await patternLearningService.aprenderPatron({
      tenantId,
      tipoPatron,
      inputPattern,
      outputValue,
      outputCampo,
      origen: 'manual',
      confianzaInicial: 1.0
    });

    res.json({
      success: true,
      mensaje: 'Patrón aprendido exitosamente',
      patron: {
        id: patron.id,
        tipoPatron: patron.tipo_patron,
        outputValue: patron.output_value,
        confianza: patron.confianza,
        ocurrencias: patron.num_ocurrencias
      }
    });

  } catch (error) {
    console.error('❌ [API] Error en aprendizaje manual:', error);
    res.status(500).json({
      error: 'Error aprendiendo patrón',
      details: error.message
    });
  }
});

/**
 * POST /api/patrones-aprendidos/aprender-documento
 *
 * Aprende múltiples patrones de un documento completo ya validado
 */
router.post('/aprender-documento', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { documentoId } = req.body;

    if (!documentoId) {
      return res.status(400).json({ error: 'documentoId es requerido' });
    }

    console.log('📖 [API] Aprendiendo de documento:', documentoId);

    const patronesAprendidos = await patternLearningService.aprenderDeDocumento({
      tenantId,
      documentoId,
      origen: 'manual'
    });

    res.json({
      success: true,
      mensaje: `Se aprendieron ${patronesAprendidos.length} patrones del documento`,
      cantidadPatrones: patronesAprendidos.length,
      patrones: patronesAprendidos.map(p => ({
        tipo: p.tipo_patron,
        outputValue: p.output_value,
        confianza: p.confianza
      }))
    });

  } catch (error) {
    console.error('❌ [API] Error aprendiendo de documento:', error);
    res.status(500).json({
      error: 'Error aprendiendo de documento',
      details: error.message
    });
  }
});

/**
 * GET /api/patrones-aprendidos/estadisticas
 *
 * Obtiene estadísticas de aprendizaje del tenant
 */
router.get('/estadisticas', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;

    const stats = await patternLearningService.obtenerEstadisticas(tenantId);

    res.json({
      success: true,
      estadisticas: stats
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

/**
 * GET /api/patrones-aprendidos
 *
 * Lista todos los patrones aprendidos del tenant
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const {
      tipoPatron,     // Filtro opcional por tipo
      page = 1,
      limit = 50,
      sortBy = 'num_ocurrencias', // num_ocurrencias, confianza, ultima_fecha
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { tenantId };
    if (tipoPatron) {
      where.tipo_patron = tipoPatron;
    }

    const [patrones, total] = await Promise.all([
      prisma.patrones_aprendidos.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.patrones_aprendidos.count({ where })
    ]);

    res.json({
      success: true,
      patrones: patrones.map(p => ({
        id: p.id,
        tipoPatron: p.tipo_patron,
        inputPattern: p.input_pattern,
        outputValue: p.output_value,
        outputCampo: p.output_campo,
        confianza: p.confianza,
        ocurrencias: p.num_ocurrencias,
        ultimaFecha: p.ultima_fecha,
        origen: p.origen,
        createdAt: p.createdAt
      })),
      paginacion: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ [API] Error listando patrones:', error);
    res.status(500).json({
      error: 'Error listando patrones',
      details: error.message
    });
  }
});

/**
 * DELETE /api/patrones-aprendidos/:id
 *
 * Elimina un patrón aprendido específico
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Verificar que el patrón pertenece al tenant
    const patron = await prisma.patrones_aprendidos.findFirst({
      where: { id, tenantId }
    });

    if (!patron) {
      return res.status(404).json({ error: 'Patrón no encontrado' });
    }

    await prisma.patrones_aprendidos.delete({
      where: { id }
    });

    res.json({
      success: true,
      mensaje: 'Patrón eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error eliminando patrón:', error);
    res.status(500).json({
      error: 'Error eliminando patrón',
      details: error.message
    });
  }
});

/**
 * DELETE /api/patrones-aprendidos/tipo/:tipoPatron
 *
 * Elimina todos los patrones de un tipo específico (útil para reiniciar aprendizaje)
 */
router.delete('/tipo/:tipoPatron', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { tipoPatron } = req.params;

    const result = await prisma.patrones_aprendidos.deleteMany({
      where: {
        tenantId,
        tipo_patron: tipoPatron
      }
    });

    res.json({
      success: true,
      mensaje: `Se eliminaron ${result.count} patrones del tipo ${tipoPatron}`
    });

  } catch (error) {
    console.error('❌ [API] Error eliminando patrones por tipo:', error);
    res.status(500).json({
      error: 'Error eliminando patrones',
      details: error.message
    });
  }
});

/**
 * POST /api/patrones-aprendidos/buscar
 *
 * Busca si existe un patrón aprendido para un input específico
 * Útil para preview en el frontend antes de aplicar
 */
router.post('/buscar', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const {
      tipoPatron,
      inputPattern,
      minConfianza = 0.7
    } = req.body;

    if (!tipoPatron || !inputPattern) {
      return res.status(400).json({
        error: 'tipoPatron e inputPattern son requeridos'
      });
    }

    const patron = await patternLearningService.buscarPatron({
      tenantId,
      tipoPatron,
      inputPattern,
      minConfianza
    });

    if (patron) {
      res.json({
        encontrado: true,
        patron: {
          id: patron.id,
          outputValue: patron.output_value,
          outputCampo: patron.output_campo,
          confianza: patron.confianza,
          ocurrencias: patron.num_ocurrencias,
          origen: patron.origen,
          ultimaFecha: patron.ultima_fecha
        }
      });
    } else {
      res.json({
        encontrado: false,
        mensaje: 'No se encontró un patrón aprendido para este input'
      });
    }

  } catch (error) {
    console.error('❌ [API] Error buscando patrón:', error);
    res.status(500).json({
      error: 'Error buscando patrón',
      details: error.message
    });
  }
});

module.exports = router;
