const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const { sendEmailVerification } = require('../services/emailService');
const passport = require('../config/passport');

const router = express.Router();
const prisma = new PrismaClient();

// Generar JWT con soporte multitenant
const generateToken = (userId, tenantId = null) => {
  const payload = { userId };
  if (tenantId) {
    payload.tenantId = tenantId;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Verificar token (para acceso directo desde email)
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener datos del usuario con tenant
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        profiles: true,
        tenants: true
      }
    });

    console.log('🔍 [verify-token] User data:', {
      id: user?.id,
      email: user?.email,
      tenantId: user?.tenantId,
      hasTenantObject: !!user?.tenants,
      superuser: user?.superuser,
      decodedTenantId: decoded.tenantId
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    // Para superusers, usar el tenant del token (si existe), para usuarios normales usar su tenant asignado
    let currentTenant = null;
    if (user.superuser && decoded.tenantId) {
      // Superuser: usar tenant del token
      currentTenant = await prisma.tenants.findUnique({
        where: { id: decoded.tenantId }
      });
      console.log('🔍 [verify-token] Superuser tenant from token:', currentTenant?.nombre);
    } else if (user.tenantId) {
      // Usuario normal: buscar tenant por tenantId
      currentTenant = await prisma.tenants.findUnique({
        where: { id: user.tenantId }
      });
      console.log('🔍 [verify-token] Normal user tenant:', currentTenant?.nombre);
    }

    console.log('🔍 [verify-token] Final tenant:', currentTenant?.nombre || 'NULL');

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        profile: user.profiles,
        superuser: user.superuser,
        esUsuarioTesoreria: user.esUsuarioTesoreria
      },
      tenant: currentTenant ? {
        id: currentTenant.id,
        nombre: currentTenant.nombre,
        slug: currentTenant.slug,
        plan: currentTenant.plan
      } : null,
      superuser: user.superuser
    });

  } catch (error) {
    console.error('Error verifying token:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Verificar email con token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token de verificación requerido' });
    }

    // Buscar usuario por token de verificación
    const user = await prisma.users.findFirst({
      where: {
        verificationToken: token,
        verificationExpires: {
          gt: new Date() // Token no expirado
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Token de verificación inválido o expirado'
      });
    }

    // Verificar cuenta
    await prisma.users.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null
      }
    });

    res.json({
      success: true,
      message: 'Email verificado exitosamente. Ya puedes iniciar sesión.'
    });

  } catch (error) {
    console.error('Error en verificación de email:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Reenviar email de verificación
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Buscar usuario por email
    const user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Este email ya está verificado' });
    }

    // Generar nuevo token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Actualizar usuario con nuevo token
    await prisma.users.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpires
      }
    });

    // Enviar email
    const emailResult = await sendEmailVerification(email, verificationToken, user.nombre);

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Email de verificación reenviado exitosamente'
      });
    } else {
      res.status(500).json({
        error: 'Error al enviar email de verificación',
        details: emailResult.message
      });
    }

  } catch (error) {
    console.error('Error al reenviar verificación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Registro de usuario
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('nombre').isLength({ min: 2 }).trim(),
  body('apellido').isLength({ min: 2 }).trim(),
  body('profileId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, nombre, apellido, profileId } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Verificar que el perfil existe si se proporciona
    if (profileId) {
      const profile = await prisma.profiles.findUnique({
        where: { id: profileId }
      });
      
      if (!profile || !profile.activo) {
        return res.status(400).json({ error: 'Perfil inválido' });
      }
    }

    // Obtener tenant por defecto (para registro sin especificar tenant)
    const defaultTenant = await prisma.tenants.findFirst({
      where: {
        esDefault: true,
        activo: true
      }
    });

    if (!defaultTenant) {
      console.error('🚨 [AUTH] No se encontró tenant por defecto para registro');
      return res.status(500).json({
        error: 'No hay tenant disponible para registro. Contacte al administrador.'
      });
    }

    console.log('🏢 [AUTH] Usuario será asignado al tenant:', defaultTenant.nombre);

    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear usuario
    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        nombre,
        apellido,
        profileId: profileId || null,
        tenantId: defaultTenant.id,
        emailVerified: false,
        verificationToken,
        verificationExpires
      },
      include: {
        profiles: true,
        tenants: true
      }
    });

    // Enviar email de verificación
    const emailResult = await sendEmailVerification(email, verificationToken, nombre);

    if (!emailResult.success) {
      console.error('Error al enviar email de verificación:', emailResult.message);
      // No fallar el registro por error de email, solo log
    }

    // Generar token con tenantId (solo para respuesta, no para login automático)
    const token = generateToken(user.id, user.tenantId);

    // Remover password de la respuesta
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Usuario creado exitosamente. Por favor, verifica tu email antes de iniciar sesión.',
      user: userWithoutPassword,
      emailSent: emailResult.success,
      emailMessage: emailResult.message
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Login de usuario
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Buscar usuario con tenant
    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        profiles: true,
        tenants: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    if (!user.activo) {
      return res.status(400).json({ error: 'Cuenta inactiva' });
    }

    // Verificar email (solo para usuarios normales, no superusers)
    if (!user.superuser && !user.emailVerified) {
      return res.status(400).json({
        error: 'Email no verificado. Revisa tu bandeja de entrada y verifica tu email.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email
      });
    }

    // Verificar tenant (solo para usuarios normales, no superusers)
    if (!user.superuser) {
      if (!user.tenants) {
        return res.status(403).json({ error: 'Usuario sin empresa asignada' });
      }
      if (!user.tenants.activo) {
        return res.status(403).json({ error: 'Empresa inactiva. Contacte al administrador.' });
      }
    }

    // Verificar password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    // Para superusers, buscar tenant por defecto y asignarlo
    let defaultTenant = null;
    if (user.superuser) {
      // Intentar buscar tenant por defecto
      defaultTenant = await prisma.tenants.findFirst({
        where: {
          activo: true,
          OR: [
            { esDefault: true },
            { slug: 'empresa-demo' },
            { slug: 'default' }
          ]
        },
        orderBy: [
          { esDefault: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      // Si no hay tenant por defecto, usar el primero disponible
      if (!defaultTenant) {
        defaultTenant = await prisma.tenants.findFirst({
          where: { activo: true },
          orderBy: { createdAt: 'asc' }
        });
      }
    }

    // Generar token con tenantId apropiado
    const tenantId = user.superuser
      ? (defaultTenant?.id || null)
      : user.tenantId;
    const token = generateToken(user.id, tenantId);

    // Remover password de la respuesta
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        profile: user.profiles,
        superuser: user.superuser,
        esUsuarioTesoreria: user.esUsuarioTesoreria
      },
      tenant: user.superuser && defaultTenant ? {
        id: defaultTenant.id,
        nombre: defaultTenant.nombre,
        slug: defaultTenant.slug,
        planId: defaultTenant.planId,
        configuracion: defaultTenant.configuracion
      } : (user.tenants ? {
        id: user.tenants.id,
        nombre: user.tenants.nombre,
        slug: user.tenants.slug,
        planId: user.tenants.planId,
        configuracion: user.tenants.configuracion
      } : null),
      superuser: user.superuser,
      // Para superusers, incluir lista de tenants disponibles
      availableTenants: user.superuser ? await prisma.tenants.findMany({
        where: { activo: true },
        select: {
          id: true,
          slug: true,
          nombre: true,
          planId: true
        }
      }) : null
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener perfil del usuario actual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { password, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener todos los perfiles (para el dropdown de registro)
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await prisma.profiles.findMany({
      where: { activo: true },
      select: {
        id: true,
        codigo: true,
        descripcion: true
      },
      orderBy: { descripcion: 'asc' }
    });

    res.json({ profiles });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Endpoint para obtener contexto actual (tenant, usuario, etc.)
router.get('/context', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        profiles: true,
        tenants: true
      }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no autorizado' });
    }

    // Determinar tenant actual
    let currentTenant = null;
    if (user.superuser && decoded.tenantId) {
      currentTenant = await prisma.tenants.findUnique({
        where: { id: decoded.tenantId }
      });
    } else if (user.tenants) {
      currentTenant = user.tenants;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        superuser: user.superuser,
        profile: user.profiles
      },
      tenant: currentTenant,
      tokenTenantId: decoded.tenantId || null,
      userTenantId: user.tenantId || null
    });

  } catch (error) {
    console.error('Context error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Switch tenant para superusers
router.post('/switch-tenant', async (req, res) => {
  try {
    const { tenantId } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario es superuser
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        profiles: true
      }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no autorizado' });
    }

    if (!user.superuser) {
      return res.status(403).json({ error: 'Solo los superusers pueden cambiar de tenant' });
    }

    // Verificar que el tenant existe y está activo
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        planes: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    if (!tenant.activo) {
      return res.status(403).json({ error: 'Tenant inactivo' });
    }

    // Generar nuevo token con el tenant seleccionado
    const newToken = generateToken(user.id, tenantId);

    res.json({
      success: true,
      message: 'Tenant cambiado exitosamente',
      token: newToken,
      tenant: {
        id: tenant.id,
        nombre: tenant.nombre,
        slug: tenant.slug,
        planId: tenant.planId,
        plan: tenant.planes?.codigo || 'Sin Plan', // Solo el código del plan como string
        planes: tenant.planes, // Objeto completo del plan si se necesita
        configuracion: tenant.configuracion
      }
    });

  } catch (error) {
    console.error('Switch tenant error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Listar tenants disponibles para superusers
router.get('/available-tenants', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario es superuser
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.activo || !user.superuser) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Obtener todos los tenants activos
    const tenants = await prisma.tenants.findMany({
      where: { activo: true },
      select: {
        id: true,
        slug: true,
        nombre: true,
        planId: true,
        cuit: true,
        fechaCreacion: true,
        _count: {
          select: {
            users: true
          }
        },
        planes: {
          select: {
            codigo: true,
            nombre: true,
            color: true
          }
        }
      },
      orderBy: { fechaCreacion: 'desc' }
    });

    // Transformar para incluir plan como string
    const tenantsWithPlan = tenants.map(tenant => ({
      ...tenant,
      plan: tenant.planes?.codigo || 'Sin Plan'
    }));

    res.json({
      success: true,
      tenants: tenantsWithPlan
    });

  } catch (error) {
    console.error('Available tenants error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Listar tenants del usuario actual (para usuarios no-superuser)
router.get('/my-tenants', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Obtener el usuario con su tenant
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        tenants: {
          select: {
            id: true,
            slug: true,
            nombre: true,
            planId: true,
            cuit: true,
            activo: true,
            fechaCreacion: true,
            _count: {
              select: {
                users: true
              }
            },
            planes: {
              select: {
                codigo: true,
                nombre: true,
                color: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.activo) {
      return res.status(403).json({ error: 'Usuario no activo' });
    }

    // Si el usuario es superuser, devolver todos los tenants
    if (user.superuser) {
      const tenants = await prisma.tenants.findMany({
        where: { activo: true },
        select: {
          id: true,
          slug: true,
          nombre: true,
          planId: true,
          cuit: true,
          fechaCreacion: true,
          _count: {
            select: {
              users: true
            }
          },
          planes: {
            select: {
              codigo: true,
              nombre: true,
              color: true
            }
          }
        },
        orderBy: { fechaCreacion: 'desc' }
      });

      const tenantsWithPlan = tenants.map(tenant => ({
        ...tenant,
        plan: tenant.planes?.codigo || 'Sin Plan'
      }));

      return res.json({
        success: true,
        tenants: tenantsWithPlan
      });
    }

    // Para usuarios normales, devolver solo su tenant asignado
    const tenants = [];
    if (user.tenants && user.tenants.activo) {
      tenants.push({
        ...user.tenants,
        plan: user.tenants.planes?.codigo || 'Sin Plan'
      });
    }

    res.json({
      success: true,
      tenants
    });

  } catch (error) {
    console.error('My tenants error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Asignar/cambiar tenant de un usuario (solo para superusers)
router.put('/assign-tenant', [
  body('userId').isString().notEmpty(),
  body('tenantId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario actual es superuser
    const currentUser = await prisma.users.findUnique({
      where: { id: decoded.userId }
    });

    if (!currentUser || !currentUser.activo || !currentUser.superuser) {
      return res.status(403).json({ error: 'Solo los superusers pueden asignar tenants' });
    }

    const { userId, tenantId } = req.body;

    // Verificar que el usuario a modificar existe
    const userToUpdate = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        tenants: true,
        profiles: true
      }
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir cambiar el tenant de otros superusers
    if (userToUpdate.superuser) {
      return res.status(403).json({ error: 'No se puede cambiar el tenant de un superuser' });
    }

    // Verificar que el tenant existe y está activo
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || !tenant.activo) {
      return res.status(404).json({ error: 'Tenant no encontrado o inactivo' });
    }

    // Actualizar el tenant del usuario
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { tenantId: tenantId },
      include: {
        tenants: true,
        profiles: true
      }
    });

    // Remover password de la respuesta
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Tenant asignado exitosamente',
      user: userWithoutPassword,
      previousTenant: userToUpdate.tenant ? {
        id: userToUpdate.tenant.id,
        nombre: userToUpdate.tenant.nombre
      } : null,
      newTenant: {
        id: tenant.id,
        nombre: tenant.nombre
      }
    });

  } catch (error) {
    console.error('Assign tenant error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==================== GOOGLE OAUTH ROUTES ====================

// Iniciar autenticación con Google
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
);

// Callback de Google OAuth
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`
  }),
  async (req, res) => {
    try {
      // El usuario viene de passport strategy
      const user = req.user;

      console.log('✅ Google OAuth callback - Usuario autenticado:', user.email);

      // Generar JWT token
      const token = generateToken(user.id, user.tenantId);

      // Redirigir al frontend con el token
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/callback?token=${token}`;

      console.log('🔄 Redirigiendo a:', redirectUrl);

      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ Error en Google OAuth callback:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
);

module.exports = router;