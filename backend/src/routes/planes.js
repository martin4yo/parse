const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/planes
 * Obtener todos los planes con sus features y cantidad de tenants
 */
router.get('/', async (req, res) => {
  try {
    const planes = await prisma.planes.findMany({
      include: {
        plan_features: {
          orderBy: { feature: 'asc' }
        },
        tenants: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { orden: 'asc' }
    });

    // Formatear respuesta con contadores
    const planesFormateados = planes.map(plan => ({
      ...plan,
      features: plan.plan_features, // Para compatibilidad con frontend
      cantidadFeatures: plan.plan_features.length,
      cantidadTenants: plan.tenants.length,
      plan_features: undefined // Remover para limpiar respuesta
    }));

    res.json({
      success: true,
      planes: planesFormateados
    });
  } catch (error) {
    console.error('Error obteniendo planes:', error);
    res.status(500).json({
      error: 'Error al obtener planes',
      details: error.message
    });
  }
});

/**
 * GET /api/planes/:id
 * Obtener un plan específico con detalles completos
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.planes.findUnique({
      where: { id },
      include: {
        plan_features: {
          orderBy: { feature: 'asc' }
        },
        tenants: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true
          }
        }
      }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    // Transformar para compatibilidad con frontend
    const planFormateado = {
      ...plan,
      features: plan.plan_features,
      plan_features: undefined
    };

    res.json({
      success: true,
      plan: planFormateado
    });
  } catch (error) {
    console.error('Error obteniendo plan:', error);
    res.status(500).json({
      error: 'Error al obtener plan',
      details: error.message
    });
  }
});

/**
 * POST /api/planes
 * Crear un nuevo plan
 */
router.post('/', async (req, res) => {
  try {
    const { codigo, nombre, descripcion, precio, activo, orden } = req.body;

    // Validaciones
    if (!codigo || !nombre) {
      return res.status(400).json({
        error: 'Código y nombre son requeridos'
      });
    }

    // Verificar si el código ya existe
    const existente = await prisma.planes.findUnique({
      where: { codigo }
    });

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe un plan con ese código'
      });
    }

    const plan = await prisma.planes.create({
      data: {
        codigo,
        nombre,
        descripcion: descripcion || null,
        precio: precio ? parseFloat(precio) : null,
        activo: activo !== undefined ? activo : true,
        orden: orden || 0
      },
      include: {
        plan_features: true
      }
    });

    // Transformar para compatibilidad con frontend
    const planFormateado = {
      ...plan,
      features: plan.plan_features,
      plan_features: undefined
    };

    res.status(201).json({
      success: true,
      plan: planFormateado,
      message: 'Plan creado correctamente'
    });
  } catch (error) {
    console.error('Error creando plan:', error);
    res.status(500).json({
      error: 'Error al crear plan',
      details: error.message
    });
  }
});

/**
 * PUT /api/planes/:id
 * Actualizar un plan existente
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, activo, orden } = req.body;

    // Verificar que el plan existe
    const planExistente = await prisma.planes.findUnique({
      where: { id }
    });

    if (!planExistente) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const plan = await prisma.planes.update({
      where: { id },
      data: {
        nombre: nombre || planExistente.nombre,
        descripcion: descripcion !== undefined ? descripcion : planExistente.descripcion,
        precio: precio !== undefined ? (precio ? parseFloat(precio) : null) : planExistente.precio,
        activo: activo !== undefined ? activo : planExistente.activo,
        orden: orden !== undefined ? orden : planExistente.orden,
        updatedAt: new Date()
      },
      include: {
        plan_features: true,
        tenants: {
          select: { id: true, nombre: true }
        }
      }
    });

    // Transformar para compatibilidad con frontend
    const planFormateado = {
      ...plan,
      features: plan.plan_features,
      plan_features: undefined
    };

    res.json({
      success: true,
      plan: planFormateado,
      message: 'Plan actualizado correctamente'
    });
  } catch (error) {
    console.error('Error actualizando plan:', error);
    res.status(500).json({
      error: 'Error al actualizar plan',
      details: error.message
    });
  }
});

/**
 * DELETE /api/planes/:id
 * Eliminar un plan (solo si no tiene tenants asignados)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el plan existe
    const plan = await prisma.planes.findUnique({
      where: { id },
      include: {
        tenants: true
      }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    // No permitir eliminar si tiene tenants asignados
    if (plan.tenants.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el plan porque tiene tenants asignados',
        cantidadTenants: plan.tenants.length
      });
    }

    // Eliminar plan (cascade eliminará features automáticamente)
    await prisma.planes.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Plan eliminado correctamente'
    });
  } catch (error) {
    console.error('Error eliminando plan:', error);
    res.status(500).json({
      error: 'Error al eliminar plan',
      details: error.message
    });
  }
});

// ========== GESTIÓN DE FEATURES ==========

/**
 * GET /api/planes/:id/features
 * Obtener todas las features de un plan
 */
router.get('/:id/features', async (req, res) => {
  try {
    const { id } = req.params;

    const features = await prisma.plan_features.findMany({
      where: { planId: id },
      orderBy: { feature: 'asc' }
    });

    res.json({
      success: true,
      features
    });
  } catch (error) {
    console.error('Error obteniendo features:', error);
    res.status(500).json({
      error: 'Error al obtener features',
      details: error.message
    });
  }
});

/**
 * POST /api/planes/:id/features
 * Agregar una feature a un plan
 */
router.post('/:id/features', async (req, res) => {
  try {
    const { id } = req.params;
    const { feature, config } = req.body;

    if (!feature) {
      return res.status(400).json({
        error: 'El campo "feature" es requerido'
      });
    }

    // Verificar que el plan existe
    const plan = await prisma.planes.findUnique({
      where: { id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    // Verificar si la feature ya existe
    const existente = await prisma.plan_features.findUnique({
      where: {
        planId_feature: {
          planId: id,
          feature
        }
      }
    });

    if (existente) {
      return res.status(400).json({
        error: 'Esta feature ya está asignada a este plan'
      });
    }

    const nuevaFeature = await prisma.plan_features.create({
      data: {
        planId: id,
        feature,
        config: config || null
      }
    });

    res.status(201).json({
      success: true,
      feature: nuevaFeature,
      message: 'Feature agregada correctamente'
    });
  } catch (error) {
    console.error('Error agregando feature:', error);
    res.status(500).json({
      error: 'Error al agregar feature',
      details: error.message
    });
  }
});

/**
 * PUT /api/planes/:planId/features/:featureId
 * Actualizar configuración de una feature
 */
router.put('/:planId/features/:featureId', async (req, res) => {
  try {
    const { featureId } = req.params;
    const { config } = req.body;

    const feature = await prisma.plan_features.update({
      where: { id: featureId },
      data: {
        config: config || null
      }
    });

    res.json({
      success: true,
      feature,
      message: 'Feature actualizada correctamente'
    });
  } catch (error) {
    console.error('Error actualizando feature:', error);
    res.status(500).json({
      error: 'Error al actualizar feature',
      details: error.message
    });
  }
});

/**
 * DELETE /api/planes/:planId/features/:featureId
 * Eliminar una feature de un plan
 */
router.delete('/:planId/features/:featureId', async (req, res) => {
  try {
    const { featureId } = req.params;

    await prisma.plan_features.delete({
      where: { id: featureId }
    });

    res.json({
      success: true,
      message: 'Feature eliminada correctamente'
    });
  } catch (error) {
    console.error('Error eliminando feature:', error);
    res.status(500).json({
      error: 'Error al eliminar feature',
      details: error.message
    });
  }
});

// ========== ASIGNACIÓN DE TENANTS ==========

/**
 * PUT /api/planes/tenants/:tenantId/assign
 * Asignar un plan a un tenant
 */
router.put('/tenants/:tenantId/assign', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: 'El campo "planId" es requerido'
      });
    }

    // Verificar que el plan existe
    const plan = await prisma.planes.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    // Actualizar tenant
    const tenant = await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        planId
      },
      include: {
        plan_relation: {
          include: {
            plan_features: true
          }
        }
      }
    });

    res.json({
      success: true,
      tenant,
      message: `Plan "${plan.nombre}" asignado correctamente`
    });
  } catch (error) {
    console.error('Error asignando plan:', error);
    res.status(500).json({
      error: 'Error al asignar plan',
      details: error.message
    });
  }
});

/**
 * GET /api/planes/features/available
 * Listar todas las features disponibles (constantes del sistema)
 */
router.get('/features/available', async (req, res) => {
  try {
    // Features disponibles en el sistema
    const featuresDisponibles = [
      {
        feature: 'AI_SIMPLE_EXTRACTION',
        descripcion: 'Extracción simple con 1 prompt universal',
        categoria: 'IA'
      },
      {
        feature: 'AI_PIPELINE_EXTRACTION',
        descripcion: 'Pipeline de 2 pasos: clasificador + extractor especializado',
        categoria: 'IA'
      },
      {
        feature: 'AI_LINE_ITEMS_EXTRACTION',
        descripcion: 'Extracción de line items y detalles de impuestos',
        categoria: 'IA'
      },
      {
        feature: 'AI_CUSTOM_API_KEYS',
        descripcion: 'API keys de IA personalizadas por tenant',
        categoria: 'IA'
      },
      {
        feature: 'MANUAL_CORRECTION',
        descripcion: 'Corrección manual de datos extraídos',
        categoria: 'General'
      },
      {
        feature: 'BULK_UPLOAD',
        descripcion: 'Carga masiva de documentos',
        categoria: 'General'
      },
      {
        feature: 'ADVANCED_REPORTS',
        descripcion: 'Reportes avanzados y analytics',
        categoria: 'Reportes'
      },
      {
        feature: 'API_ACCESS',
        descripcion: 'Acceso a API para integraciones',
        categoria: 'Integraciones'
      },
      {
        feature: 'CUSTOM_RULES',
        descripcion: 'Reglas personalizadas de validación',
        categoria: 'General'
      },
      {
        feature: 'PRIORITY_SUPPORT',
        descripcion: 'Soporte prioritario',
        categoria: 'Soporte'
      },
      {
        feature: 'MULTI_CURRENCY',
        descripcion: 'Soporte multi-moneda',
        categoria: 'General'
      },
      {
        feature: 'ADVANCED_PERMISSIONS',
        descripcion: 'Permisos avanzados por usuario',
        categoria: 'Seguridad'
      }
    ];

    res.json({
      success: true,
      features: featuresDisponibles
    });
  } catch (error) {
    console.error('Error obteniendo features disponibles:', error);
    res.status(500).json({
      error: 'Error al obtener features disponibles',
      details: error.message
    });
  }
});

module.exports = router;
