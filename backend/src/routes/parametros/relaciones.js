const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authWithTenant } = require('../../middleware/authWithTenant');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/parametros/relaciones - Obtener todas las relaciones o filtrar por campo_hijo
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { campo_hijo } = req.query;

    const whereClause = campo_hijo ? req.filterByTenant({ campo_hijo }) : req.filterByTenant({});

    console.log('🔍 [relaciones] Query with whereClause:', JSON.stringify(whereClause, null, 2));

    const relaciones = await prisma.parametros_relaciones.findMany({
      where: whereClause,
      orderBy: [
        { campo_padre: 'asc' },
        { campo_hijo: 'asc' }
      ]
    });

    console.log('✅ [relaciones] Found', relaciones.length, 'relations for tenant:', req.tenantId);

    res.json(relaciones);
  } catch (error) {
    console.error('Error fetching relaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/parametros/relaciones - Crear nueva relación
router.post('/', authWithTenant, async (req, res) => {
  try {
    const { campo_padre, campo_hijo, descripcion, activo = true } = req.body;
    
    // Validaciones básicas
    if (!campo_padre || !campo_hijo) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Los campos padre e hijo son obligatorios'
      });
    }
    
    if (campo_padre === campo_hijo) {
      return res.status(400).json({
        error: 'Validación fallida',
        message: 'El campo padre no puede ser igual al campo hijo'
      });
    }
    
    // Verificar si ya existe la relación
    const existingRelacion = await prisma.parametros_relaciones.findFirst({
      where: req.filterByTenant({
        campo_padre,
        campo_hijo
      })
    });
    
    if (existingRelacion) {
      return res.status(409).json({
        error: 'Relación duplicada',
        message: 'Ya existe una relación entre estos campos'
      });
    }
    
    // Verificar relación circular (inversa)
    const relacionInversa = await prisma.parametros_relaciones.findFirst({
      where: req.filterByTenant({
        campo_padre: campo_hijo,
        campo_hijo: campo_padre
      })
    });
    
    if (relacionInversa) {
      return res.status(400).json({
        error: 'Relación circular detectada',
        message: `Ya existe una relación inversa (${campo_hijo} -> ${campo_padre}). Esto crearía una relación circular no permitida.`
      });
    }
    
    const createData = {
      campo_padre,
      campo_hijo,
      descripcion: descripcion || null,
      activo
    };

    // Solo agregar tenantId si existe (para superusers sin tenant será null)
    if (req.tenantId) {
      createData.tenantId = req.tenantId;
    }

    const nuevaRelacion = await prisma.parametros_relaciones.create({
      data: createData
    });
    
    res.status(201).json(nuevaRelacion);
    
  } catch (error) {
    console.error('Error creating relacion:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Relación duplicada',
        message: 'Ya existe una relación entre estos campos'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// PUT /api/parametros/relaciones/:id - Actualizar relación
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { campo_padre, campo_hijo, descripcion, activo } = req.body;
    
    // Validaciones básicas
    if (!campo_padre || !campo_hijo) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Los campos padre e hijo son obligatorios'
      });
    }
    
    if (campo_padre === campo_hijo) {
      return res.status(400).json({
        error: 'Validación fallida',
        message: 'El campo padre no puede ser igual al campo hijo'
      });
    }
    
    // Verificar si existe la relación
    const existingRelacion = await prisma.parametros_relaciones.findFirst({
      where: req.filterByTenant({ id: parseInt(id) })
    });
    
    if (!existingRelacion) {
      return res.status(404).json({
        error: 'Relación no encontrada',
        message: 'La relación especificada no existe'
      });
    }
    
    // Verificar si ya existe otra relación con los mismos campos
    const duplicateRelacion = await prisma.parametros_relaciones.findFirst({
      where: req.filterByTenant({
        campo_padre,
        campo_hijo,
        id: {
          not: parseInt(id)
        }
      })
    });
    
    if (duplicateRelacion) {
      return res.status(409).json({
        error: 'Relación duplicada',
        message: 'Ya existe otra relación entre estos campos'
      });
    }
    
    // Verificar relación circular (inversa) al actualizar
    const relacionInversa = await prisma.parametros_relaciones.findFirst({
      where: req.filterByTenant({
        campo_padre: campo_hijo,
        campo_hijo: campo_padre,
        id: {
          not: parseInt(id)
        }
      })
    });
    
    if (relacionInversa) {
      return res.status(400).json({
        error: 'Relación circular detectada',
        message: `Ya existe una relación inversa (${campo_hijo} -> ${campo_padre}). Esto crearía una relación circular no permitida.`
      });
    }
    
    const relacionActualizada = await prisma.parametros_relaciones.update({
      where: { id: parseInt(id) },
      data: {
        campo_padre,
        campo_hijo,
        descripcion: descripcion || null,
        activo
      }
    });
    
    res.json(relacionActualizada);
    
  } catch (error) {
    console.error('Error updating relacion:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Relación duplicada',
        message: 'Ya existe una relación entre estos campos'
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Relación no encontrada',
        message: 'La relación especificada no existe'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// DELETE /api/parametros/relaciones/:id - Eliminar relación
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si existe la relación
    const existingRelacion = await prisma.parametros_relaciones.findFirst({
      where: req.filterByTenant({ id: parseInt(id) })
    });
    
    if (!existingRelacion) {
      return res.status(404).json({
        error: 'Relación no encontrada',
        message: 'La relación especificada no existe'
      });
    }
    
    // Eliminar la relación
    await prisma.parametros_relaciones.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ 
      message: 'Relación eliminada correctamente',
      id: parseInt(id)
    });
    
  } catch (error) {
    console.error('Error deleting relacion:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Relación no encontrada',
        message: 'La relación especificada no existe'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

module.exports = router;