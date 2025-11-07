const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { authWithTenant } = require('../middleware/authWithTenant');

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todos los usuarios
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, activo } = req.query;
    const skip = (page - 1) * limit;
    
    const where = req.filterByTenant({});
    
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        include: {
          profiles: {
            select: {
              id: true,
              codigo: true,
              descripcion: true
            }
          },
          tenants: {
            select: {
              id: true,
              nombre: true,
              slug: true
            }
          }
        },
        orderBy: [
          { apellido: 'asc' },
          { nombre: 'asc' }
        ],
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.users.count({ where })
    ]);

    res.json({
      users: users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener usuario por ID
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findUnique({
      where: req.filterByTenant({ id }),
      include: {
        profiles: {
          select: {
            id: true,
            codigo: true,
            descripcion: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear nuevo usuario
router.post('/', [
  authWithTenant,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('nombre').isLength({ min: 1 }).trim(),
  body('apellido').isLength({ min: 1 }).trim(),
  body('profileId').optional().isString(),
  body('recibeNotificacionesEmail').optional().isBoolean(),
  body('superuser').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, nombre, apellido, profileId, recibeNotificacionesEmail, superuser } = req.body;

    // Solo superusers pueden crear otros superusers
    if (superuser && !req.isSuperuser) {
      return res.status(403).json({ error: 'Solo los super administradores pueden crear otros super administradores' });
    }

    // Verificar que el email no esté en uso dentro del tenant
    const existingUser = await prisma.users.findUnique({
      where: req.filterByTenant({ email })
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario con este email' });
    }

    // Verificar que el perfil existe si se proporciona y no es vacío
    if (profileId && profileId !== '') {
      const profile = await prisma.profiles.findUnique({
        where: { id: profileId }
      });

      if (!profile || !profile.activo) {
        return res.status(400).json({ error: 'El perfil no existe o no está activo' });
      }
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generar ID único para el usuario
    const userId = crypto.randomUUID();
    const now = new Date();

    const createData = {
      id: userId,
      email,
      password: hashedPassword,
      nombre,
      apellido,
      recibeNotificacionesEmail: recibeNotificacionesEmail || false,
      superuser: superuser || false,
      updatedAt: now
    };

    // Conectar profile si se proporciona
    if (profileId && profileId !== '') {
      createData.profiles = {
        connect: { id: profileId }
      };
    }

    // Conectar tenant si se proporciona
    if (req.tenantId) {
      createData.tenants = {
        connect: { id: req.tenantId }
      };
    }

    const user = await prisma.users.create({
      data: createData,
      include: {
        profiles: {
          select: {
            id: true,
            codigo: true,
            descripcion: true
          }
        }
      }
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Usuario creado correctamente',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Create user error:', error);

    // Manejar error de email duplicado (Prisma unique constraint)
    // target es un array: ['email'] o ['googleId']
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      console.log('CREATE - P2002 detectado. Target:', target);
      console.log('CREATE - Es array?', Array.isArray(target));
      console.log('CREATE - Incluye email?', Array.isArray(target) && target.includes('email'));

      if (Array.isArray(target) && target.includes('email')) {
        const errorResponse = {
          error: 'El email ya está siendo utilizado por otro usuario. Por favor, usa un email diferente.'
        };
        console.log('CREATE - Enviando respuesta de error:', errorResponse);
        return res.status(400).json(errorResponse);
      }

      if (Array.isArray(target) && target.includes('googleId')) {
        return res.status(400).json({
          error: 'Esta cuenta de Google ya está vinculada a otro usuario.'
        });
      }
    }

    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// Actualizar usuario
router.put('/:id', [
  authWithTenant,
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('nombre').optional().isLength({ min: 1 }).trim(),
  body('apellido').optional().isLength({ min: 1 }).trim(),
  body('profileId').optional().isString(),
  body('recibeNotificacionesEmail').optional().isBoolean(),
  body('superuser').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { email, password, nombre, apellido, profileId, activo, recibeNotificacionesEmail, superuser } = req.body;

    // Verificar que el usuario existe en el tenant
    const existingUser = await prisma.users.findUnique({
      where: req.filterByTenant({ id })
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Solo superusers pueden modificar el estado de superuser
    if (superuser !== undefined && !req.isSuperuser) {
      return res.status(403).json({ error: 'Solo los super administradores pueden modificar el estado de super administrador' });
    }

    // Si se cambia el email, verificar que no esté en uso dentro del tenant
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.users.findUnique({
        where: req.filterByTenant({ email })
      });

      if (emailInUse) {
        return res.status(400).json({ error: 'Ya existe un usuario con este email' });
      }
    }

    // Verificar que el perfil existe si se proporciona y no es vacío
    if (profileId && profileId !== '') {
      const profile = await prisma.profiles.findUnique({
        where: { id: profileId }
      });

      if (!profile || !profile.activo) {
        return res.status(400).json({ error: 'El perfil no existe o no está activo' });
      }
    }

    // Preparar datos para actualizar
    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (nombre !== undefined) updateData.nombre = nombre;
    if (apellido !== undefined) updateData.apellido = apellido;

    // Manejar perfil con sintaxis de relación
    if (profileId !== undefined) {
      if (profileId === '' || profileId === null) {
        // Desconectar perfil
        updateData.profiles = {
          disconnect: true
        };
      } else {
        // Conectar nuevo perfil
        updateData.profiles = {
          connect: { id: profileId }
        };
      }
    }

    if (activo !== undefined) updateData.activo = activo;
    if (recibeNotificacionesEmail !== undefined) updateData.recibeNotificacionesEmail = recibeNotificacionesEmail;
    if (superuser !== undefined) updateData.superuser = superuser;

    // Hashear la nueva contraseña si se proporciona
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Actualizar timestamp
    updateData.updatedAt = new Date();

    const user = await prisma.users.update({
      where: req.filterByTenant({ id }),
      data: updateData,
      include: {
        profiles: {
          select: {
            id: true,
            codigo: true,
            descripcion: true
          }
        }
      }
    });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Usuario actualizado correctamente',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Update user error:', error);

    // Manejar error de email duplicado (Prisma unique constraint)
    // target es un array: ['email'] o ['googleId']
    if (error.code === 'P2002') {
      const target = error.meta?.target;

      if (Array.isArray(target) && target.includes('email')) {
        return res.status(400).json({
          error: 'El email ya está siendo utilizado por otro usuario. Por favor, usa un email diferente.'
        });
      }

      if (Array.isArray(target) && target.includes('googleId')) {
        return res.status(400).json({
          error: 'Esta cuenta de Google ya está vinculada a otro usuario.'
        });
      }
    }

    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// Activar/Desactivar usuario
router.patch('/:id/toggle-status', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findUnique({
      where: req.filterByTenant({ id })
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updatedUser = await prisma.users.update({
      where: req.filterByTenant({ id }),
      data: {
        activo: !user.activo,
        updatedAt: new Date()
      }
    });

    res.json({ 
      message: updatedUser.activo ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente',
      user: {
        id: updatedUser.id,
        activo: updatedUser.activo
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Verificar email de usuario manualmente (solo para admins)
router.patch('/:id/verify-email', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findUnique({
      where: req.filterByTenant({ id })
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updatedUser = await prisma.users.update({
      where: req.filterByTenant({ id }),
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Email verificado correctamente',
      user: {
        id: updatedUser.id,
        emailVerified: updatedUser.emailVerified
      }
    });

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar usuario (eliminación real)
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findUnique({
      where: req.filterByTenant({ id })
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Eliminar registros relacionados en orden de dependencias
    await prisma.$transaction(async (tx) => {
      // Primero obtener las tarjetas del usuario para eliminar sus delegaciones
      const userTarjetas = await tx.user_tarjetas_credito.findMany({
        where: { userId: id },
        select: { id: true }
      });

      // Eliminar documentos procesados
      await tx.documentos_procesados.deleteMany({
        where: { usuarioId: id }
      });

      // Eliminar delegaciones de tarjetas (propias del usuario)
      await tx.delegacion_tarjetas.deleteMany({
        where: { usuarioId: id }
      });

      // Eliminar delegaciones de las tarjetas del usuario (que otros usuarios puedan tener)
      if (userTarjetas.length > 0) {
        await tx.delegacion_tarjetas.deleteMany({
          where: { 
            tarjetaCreditoId: {
              in: userTarjetas.map(t => t.id)
            }
          }
        });
      }

      // Eliminar relaciones de autorizantes (como usuario autorizado)
      await tx.usuario_autorizantes.deleteMany({
        where: { usuarioId: id }
      });

      // Eliminar relaciones de autorizantes (como autorizante)
      await tx.usuario_autorizantes.deleteMany({
        where: { autorizanteId: id }
      });

      // Eliminar tarjetas de crédito del usuario
      await tx.user_tarjetas_credito.deleteMany({
        where: { userId: id }
      });

      // Eliminar atributos del usuario
      await tx.user_atributos.deleteMany({
        where: { userId: id }
      });

      // Finalmente eliminar el usuario
      await tx.users.delete({
        where: req.filterByTenant({ id })
      });
    });

    res.json({ message: 'Usuario eliminado correctamente' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;