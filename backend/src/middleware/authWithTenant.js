const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware de autenticación con soporte multitenant
 * Este middleware:
 * 1. Verifica el token JWT
 * 2. Carga el usuario y su tenant
 * 3. Verifica que el tenant esté activo
 * 4. Establece el contexto del tenant para todas las operaciones
 */
const authWithTenant = async (req, res, next) => {
  try {
    // 1. Obtener token del header o query string
    let token = null;

    // Primero intentar obtener el token del header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Si no hay token en header, buscar en query params
    if (!token && req.query.token) {
      token = req.query.token;
      console.log('Token obtenido de query params para:', req.url);
    }

    if (!token) {
      console.log('No se encontró token en:', req.url);
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    // 2. Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Token inválido'
      });
    }

    // 3. Cargar usuario con tenant
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        tenants: true,
        profiles: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        success: false,
        error: 'Usuario desactivado'
      });
    }

    // 4. Verificar tenant (no requerido para superusers)
    if (!user.superuser) {
      if (!user.tenants) {
        return res.status(403).json({
          success: false,
          error: 'Usuario sin empresa asignada'
        });
      }

      if (!user.tenants.activo) {
        return res.status(403).json({
          success: false,
          error: 'Empresa inactiva. Contacte al administrador.'
        });
      }
    }

    // Para superusers sin tenant en el token, permitir acceso pero sin tenant context
    let currentTenant = null;
    if (decoded.tenantId && decoded.tenantId !== 'null') {
      currentTenant = await prisma.tenants.findUnique({
        where: { id: decoded.tenantId }
      });

      if (!currentTenant || !currentTenant.activo) {
        return res.status(403).json({
          success: false,
          error: 'Tenant del token inválido o inactivo'
        });
      }
    } else if (user.superuser) {
      // Para superusers sin tenant en token, asignar tenant por defecto
      currentTenant = await prisma.tenants.findFirst({
        where: {
          activo: true,
          OR: [
            { esDefault: true },
            { slug: 'default' }
          ]
        },
        orderBy: [
          { esDefault: 'desc' },
          { createdAt: 'asc' }
        ]
      });
    } else {
      // Para usuarios normales, el tenant es obligatorio
      currentTenant = user.tenants;
    }

    // 5. Verificar vencimiento del plan (si aplica)
    if (currentTenant && currentTenant.fechaVencimiento) {
      const now = new Date();
      const vencimiento = new Date(currentTenant.fechaVencimiento);

      if (vencimiento < now) {
        return res.status(403).json({
          success: false,
          error: 'El plan de la empresa ha vencido',
          code: 'PLAN_EXPIRED'
        });
      }
    }

    // 6. Establecer contexto en request
    req.userId = user.id;
    req.user = user;
    req.tenantId = currentTenant ? currentTenant.id : null;
    req.tenant = currentTenant;
    req.userProfile = user.profiles;
    req.isSuperuser = user.superuser;

    // 7. Log de auditoría (opcional)
    if (process.env.ENABLE_AUDIT_LOG === 'true') {
      // Registrar acceso para auditoría
      setImmediate(async () => {
        try {
          await prisma.tenantsAuditLog.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              action: `${req.method} ${req.originalUrl}`,
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.headers['user-agent'],
              success: true
            }
          });
        } catch (error) {
          console.error('Error registrando auditoría:', error);
        }
      });
    }

    // 8. Agregar helper functions al request
    req.filterByTenant = (query = {}) => {
      // Para superusers sin tenant seleccionado, no filtrar
      if (req.isSuperuser && !req.tenantId) {
        return query;
      }
      return {
        ...query,
        tenantId: req.tenantId
      };
    };

    req.belongsToTenant = async (model, id) => {
      // Para superusers sin tenant, permitir acceso a todos los recursos
      if (req.isSuperuser && !req.tenantId) {
        const record = await prisma[model].findFirst({
          where: { id: id }
        });
        return !!record;
      }

      const record = await prisma[model].findFirst({
        where: {
          id: id,
          tenantId: req.tenantId
        }
      });
      return !!record;
    };

    req.requireTenant = () => {
      if (!req.tenantId) {
        throw new Error('Esta operación requiere seleccionar un tenant');
      }
    };

    next();

  } catch (error) {
    console.error('Error en middleware authWithTenant:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware opcional para verificar roles específicos
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userProfile) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const userRole = req.userProfile.codigo;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para realizar esta acción',
        requiredRoles: allowedRoles,
        userRole: userRole
      });
    }

    next();
  };
};

/**
 * Middleware para verificar límites del plan
 */
const checkPlanLimits = (resource) => {
  return async (req, res, next) => {
    try {
      const tenant = req.tenant;
      const limites = tenant.limites || {};

      // Verificar límite de usuarios
      if (resource === 'users') {
        const userCount = await prisma.users.count({
          where: { tenantId: req.tenantId }
        });

        if (limites.usuarios && userCount >= limites.usuarios) {
          return res.status(403).json({
            success: false,
            error: `Límite de usuarios alcanzado (${limites.usuarios})`,
            code: 'LIMIT_REACHED'
          });
        }
      }

      // Verificar límite de documentos por mes
      if (resource === 'documents') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const docCount = await prisma.documentos_procesados.count({
          where: {
            tenantId: req.tenantId,
            fechaProcesamiento: {
              gte: startOfMonth
            }
          }
        });

        if (limites.documentos_mes && docCount >= limites.documentos_mes) {
          return res.status(403).json({
            success: false,
            error: `Límite mensual de documentos alcanzado (${limites.documentos_mes})`,
            code: 'MONTHLY_LIMIT_REACHED',
            resetDate: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
          });
        }
      }

      next();
    } catch (error) {
      console.error('Error verificando límites:', error);
      next(); // Continuar en caso de error
    }
  };
};

module.exports = {
  authWithTenant,
  requireRole,
  checkPlanLimits
};