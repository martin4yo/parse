/**
 * Middleware para verificar permisos de usuario
 *
 * Valida que el usuario autenticado tenga el permiso requerido
 * para ejecutar la acción solicitada.
 *
 * Uso:
 *   router.post('/endpoint', authenticateToken, checkPermission('manage_integrations'), handler)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware factory que retorna un middleware de validación de permisos
 * @param {string} requiredPermission - Permiso requerido (ej: 'manage_integrations')
 * @returns {Function} Middleware de Express
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // El usuario debe estar autenticado (set por authenticateToken middleware)
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
      }

      const userId = req.user.id;

      // Obtener usuario con su rol
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        include: {
          rol: {
            include: {
              permisos: true
            }
          }
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      // Si el usuario no tiene rol, denegar
      if (!user.rol) {
        return res.status(403).json({
          success: false,
          error: 'Usuario sin rol asignado'
        });
      }

      // Verificar si el rol tiene el permiso requerido
      const hasPermission = user.rol.permisos.some(
        permiso => permiso.codigo === requiredPermission
      );

      if (!hasPermission) {
        console.log(`❌ [checkPermission] Usuario ${user.email} sin permiso: ${requiredPermission}`);
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para realizar esta acción',
          requiredPermission
        });
      }

      // Usuario tiene el permiso, continuar
      console.log(`✅ [checkPermission] Usuario ${user.email} autorizado para: ${requiredPermission}`);
      next();

    } catch (error) {
      console.error('❌ Error verificando permisos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar permisos'
      });
    }
  };
};

module.exports = { checkPermission };
