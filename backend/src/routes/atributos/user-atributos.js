const express = require('express');
const { authWithTenant } = require('../../middleware/authWithTenant');
const prisma = require('../../lib/prisma');

const router = express.Router();

// GET /api/user-atributos/usuario/:userId - Obtener atributos de un usuario
router.get('/usuario/:userId', authWithTenant, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar que el usuario existe
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }

    const userAtributos = await prisma.user_atributos.findMany({
      where: { userId },
      include: {
        valorAtributo: {
          include: {
            atributo: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(userAtributos);

  } catch (error) {
    console.error('Error fetching user atributos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/user-atributos/:id - Obtener un user-atributo por ID
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const userAtributo = await prisma.user_atributos.findUnique({
      where: { id },
      include: {
        user: true,
        valorAtributo: {
          include: {
            atributo: true
          }
        }
      }
    });

    if (!userAtributo) {
      return res.status(404).json({
        error: 'Asignación no encontrada',
        message: 'La asignación especificada no existe'
      });
    }

    res.json(userAtributo);

  } catch (error) {
    console.error('Error fetching user atributo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/user-atributos - Asignar atributo a usuario
router.post('/', authWithTenant, async (req, res) => {
  try {
    const { userId, valorAtributoId } = req.body;

    if (!userId || !valorAtributoId) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'UserId y valorAtributoId son obligatorios'
      });
    }

    // Verificar que el usuario existe
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }

    // Verificar que el valor de atributo existe
    const valorAtributo = await prisma.valores_atributo.findUnique({
      where: { id: valorAtributoId },
      include: {
        atributo: true
      }
    });

    if (!valorAtributo) {
      return res.status(404).json({
        error: 'Valor de atributo no encontrado',
        message: 'El valor de atributo especificado no existe'
      });
    }

    // Verificar si ya existe una asignación del mismo atributo (diferente valor)
    const existingAssignment = await prisma.user_atributos.findFirst({
      where: {
        userId,
        valorAtributo: {
          atributoId: valorAtributo.atributoId
        }
      }
    });

    if (existingAssignment) {
      // Eliminar la asignación anterior del mismo atributo
      await prisma.user_atributos.delete({
        where: { id: existingAssignment.id }
      });
    }

    const nuevoUserAtributo = await prisma.user_atributos.create({
      data: {
        userId,
        valorAtributoId
      },
      include: {
        user: true,
        valorAtributo: {
          include: {
            atributo: true
          }
        }
      }
    });

    res.status(201).json(nuevoUserAtributo);

  } catch (error) {
    console.error('Error creating user atributo:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Asignación duplicada',
        message: 'Esta asignación ya existe'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PUT /api/user-atributos/:id - Actualizar asignación
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { valorAtributoId } = req.body;

    if (!valorAtributoId) {
      return res.status(400).json({
        error: 'Campo requerido',
        message: 'ValorAtributoId es obligatorio'
      });
    }

    const existingUserAtributo = await prisma.user_atributos.findUnique({
      where: { id }
    });

    if (!existingUserAtributo) {
      return res.status(404).json({
        error: 'Asignación no encontrada',
        message: 'La asignación especificada no existe'
      });
    }

    // Verificar que el valor de atributo existe
    const valorAtributo = await prisma.valores_atributo.findUnique({
      where: { id: valorAtributoId }
    });

    if (!valorAtributo) {
      return res.status(404).json({
        error: 'Valor de atributo no encontrado',
        message: 'El valor de atributo especificado no existe'
      });
    }

    const userAtributoActualizado = await prisma.user_atributos.update({
      where: { id },
      data: { valorAtributoId },
      include: {
        user: true,
        valorAtributo: {
          include: {
            atributo: true
          }
        }
      }
    });

    res.json(userAtributoActualizado);

  } catch (error) {
    console.error('Error updating user atributo:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Asignación duplicada',
        message: 'Esta asignación ya existe'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Asignación no encontrada',
        message: 'La asignación especificada no existe'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// DELETE /api/user-atributos/:id - Eliminar asignación
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const existingUserAtributo = await prisma.user_atributos.findUnique({
      where: { id }
    });

    if (!existingUserAtributo) {
      return res.status(404).json({
        error: 'Asignación no encontrada',
        message: 'La asignación especificada no existe'
      });
    }

    await prisma.user_atributos.delete({
      where: { id }
    });

    res.json({
      message: 'Asignación eliminada correctamente',
      id
    });

  } catch (error) {
    console.error('Error deleting user atributo:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Asignación no encontrada',
        message: 'La asignación especificada no existe'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
