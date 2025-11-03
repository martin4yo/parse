const express = require('express');
const { authWithTenant } = require('../../middleware/authWithTenant');
const prisma = require('../../lib/prisma');

const router = express.Router();

// GET /api/atributos - Obtener todos los atributos
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { activo, search } = req.query;

    const where = req.filterByTenant({});

    if (activo !== undefined && activo !== '') {
      where.activo = activo === 'true';
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } }
      ];
    }

    const atributos = await prisma.atributos.findMany({
      where,
      orderBy: [
        { codigo: 'asc' }
      ],
      include: {
        valores_atributo: {
          where: { activo: true },
          orderBy: { codigo: 'asc' }
        }
      }
    });

    res.json({ atributos });

  } catch (error) {
    console.error('Error fetching atributos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/atributos/:id - Obtener un atributo por ID
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const atributo = await prisma.atributos.findUnique({
      where: { id },
      include: {
        valores_atributo: {
          orderBy: { codigo: 'asc' }
        }
      }
    });

    if (!atributo) {
      return res.status(404).json({
        error: 'Atributo no encontrado',
        message: 'El atributo especificado no existe'
      });
    }

    res.json(atributo);

  } catch (error) {
    console.error('Error fetching atributo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/atributos - Crear nuevo atributo
router.post('/', authWithTenant, async (req, res) => {
  try {
    const { codigo, descripcion, activo = true } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Código y descripción son obligatorios'
      });
    }

    const createData = {
      codigo: codigo.trim(),
      descripcion: descripcion.trim(),
      activo
    };

    if (req.tenantId) {
      createData.tenantId = req.tenantId;
    }

    const nuevoAtributo = await prisma.atributos.create({
      data: createData,
      include: {
        valores_atributo: true
      }
    });

    res.status(201).json(nuevoAtributo);

  } catch (error) {
    console.error('Error creating atributo:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Atributo duplicado',
        message: 'Ya existe un atributo con este código'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PUT /api/atributos/:id - Actualizar atributo
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion, activo } = req.body;

    if ((codigo !== undefined && !codigo) || (descripcion !== undefined && !descripcion)) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Código y descripción no pueden estar vacíos'
      });
    }

    const existingAtributo = await prisma.atributos.findUnique({
      where: { id }
    });

    if (!existingAtributo) {
      return res.status(404).json({
        error: 'Atributo no encontrado',
        message: 'El atributo especificado no existe'
      });
    }

    const updateData = {};

    if (codigo !== undefined) updateData.codigo = codigo.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (activo !== undefined) updateData.activo = activo;

    const atributoActualizado = await prisma.atributos.update({
      where: { id },
      data: updateData,
      include: {
        valores_atributo: true
      }
    });

    res.json(atributoActualizado);

  } catch (error) {
    console.error('Error updating atributo:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Atributo duplicado',
        message: 'Ya existe un atributo con este código'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Atributo no encontrado',
        message: 'El atributo especificado no existe'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// DELETE /api/atributos/:id - Eliminar atributo
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const existingAtributo = await prisma.atributos.findUnique({
      where: { id },
      include: {
        valores_atributo: true
      }
    });

    if (!existingAtributo) {
      return res.status(404).json({
        error: 'Atributo no encontrado',
        message: 'El atributo especificado no existe'
      });
    }

    if (existingAtributo.valores && existingAtributo.valores.length > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar',
        message: 'Este atributo tiene valores asociados y no se puede eliminar'
      });
    }

    await prisma.atributos.delete({
      where: { id }
    });

    res.json({
      message: 'Atributo eliminado correctamente',
      id
    });

  } catch (error) {
    console.error('Error deleting atributo:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Atributo no encontrado',
        message: 'El atributo especificado no existe'
      });
    }

    if (error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar',
        message: 'Este atributo está siendo utilizado y no se puede eliminar'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
