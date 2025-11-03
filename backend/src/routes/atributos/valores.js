const express = require('express');
const { authWithTenant } = require('../../middleware/authWithTenant');
const prisma = require('../../lib/prisma');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/valores-atributo - Obtener todos los valores de atributos
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { atributoId, activo, search } = req.query;

    const where = {
      atributos: {
        tenantId: req.tenantId
      }
    };

    if (atributoId) {
      where.atributoId = atributoId;
    }

    if (activo !== undefined && activo !== '') {
      where.activo = activo === 'true';
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } }
      ];
    }

    const valores = await prisma.valores_atributo.findMany({
      where,
      orderBy: [
        { codigo: 'asc' }
      ],
      include: {
        atributos: true
      }
    });

    res.json({ valoresAtributo: valores });

  } catch (error) {
    console.error('Error fetching valores atributo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/valores-atributo/:id - Obtener un valor por ID
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const valor = await prisma.valores_atributo.findFirst({
      where: {
        id,
        atributos: {
          tenantId: req.tenantId
        }
      },
      include: {
        atributos: true
      }
    });

    if (!valor) {
      return res.status(404).json({
        error: 'Valor no encontrado',
        message: 'El valor especificado no existe'
      });
    }

    res.json(valor);

  } catch (error) {
    console.error('Error fetching valor atributo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/valores-atributo - Crear nuevo valor
router.post('/', authWithTenant, async (req, res) => {
  try {
    const { atributoId, codigo, descripcion, activo = true } = req.body;

    if (!atributoId || !codigo || !descripcion) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'AtributoId, código y descripción son obligatorios'
      });
    }

    // Verificar que el atributo existe y pertenece al tenant del usuario
    const atributo = await prisma.atributos.findFirst({
      where: {
        id: atributoId,
        tenantId: req.tenantId
      }
    });

    if (!atributo) {
      return res.status(404).json({
        error: 'Atributo no encontrado',
        message: 'El atributo especificado no existe o no pertenece a su empresa'
      });
    }

    const nuevoValor = await prisma.valores_atributo.create({
      data: {
        id: uuidv4(),
        atributoId,
        codigo: codigo.trim(),
        descripcion: descripcion.trim(),
        activo
      },
      include: {
        atributos: true
      }
    });

    res.status(201).json(nuevoValor);

  } catch (error) {
    console.error('Error creating valor atributo:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Valor duplicado',
        message: 'Ya existe un valor con este código para este atributo'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PUT /api/valores-atributo/:id - Actualizar valor
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

    const existingValor = await prisma.valores_atributo.findFirst({
      where: {
        id,
        atributos: {
          tenantId: req.tenantId
        }
      },
      include: {
        atributos: true
      }
    });

    if (!existingValor) {
      return res.status(404).json({
        error: 'Valor no encontrado',
        message: 'El valor especificado no existe'
      });
    }

    const updateData = {};

    if (codigo !== undefined) updateData.codigo = codigo.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (activo !== undefined) updateData.activo = activo;

    const valorActualizado = await prisma.valores_atributo.update({
      where: { id },
      data: updateData,
      include: {
        atributos: true
      }
    });

    res.json(valorActualizado);

  } catch (error) {
    console.error('Error updating valor atributo:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Valor duplicado',
        message: 'Ya existe un valor con este código para este atributo'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Valor no encontrado',
        message: 'El valor especificado no existe'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// DELETE /api/valores-atributo/:id - Eliminar valor
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const existingValor = await prisma.valores_atributo.findFirst({
      where: {
        id,
        atributos: {
          tenantId: req.tenantId
        }
      },
      include: {
        user_atributos: true,
        atributos: true
      }
    });

    if (!existingValor) {
      return res.status(404).json({
        error: 'Valor no encontrado',
        message: 'El valor especificado no existe'
      });
    }

    if (existingValor.user_atributos && existingValor.user_atributos.length > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar',
        message: 'Este valor está asignado a usuarios y no se puede eliminar'
      });
    }

    await prisma.valores_atributo.delete({
      where: { id }
    });

    res.json({
      message: 'Valor eliminado correctamente',
      id
    });

  } catch (error) {
    console.error('Error deleting valor atributo:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Valor no encontrado',
        message: 'El valor especificado no existe'
      });
    }

    if (error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar',
        message: 'Este valor está siendo utilizado y no se puede eliminar'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
