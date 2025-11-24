/**
 * Middleware de autenticación por API Key
 *
 * Valida API Keys para acceso público a endpoints
 * Actualiza estadísticas de uso (ultimoUso, vecesUtilizada, ultimoUsoIp)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware de autenticación por API Key
 * Extrae la API Key del header X-API-Key o Authorization: Bearer
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    // Extraer API Key del header
    let apiKey = req.headers['x-api-key'];

    // Alternativamente, permitir Authorization: Bearer <api-key>
    if (!apiKey && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key requerida. Proporciona la API Key en el header X-API-Key o Authorization: Bearer'
      });
    }

    // Buscar API Key en la base de datos
    const keyRecord = await prisma.sync_api_keys.findUnique({
      where: { key: apiKey },
      include: {
        tenants: {
          select: {
            id: true,
            nombre: true,
            activo: true,
            planId: true
          }
        }
      }
    });

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        error: 'API Key inválida'
      });
    }

    // Verificar que la API Key esté activa
    if (!keyRecord.activo) {
      return res.status(403).json({
        success: false,
        error: 'API Key desactivada. Contacta al administrador.'
      });
    }

    // Verificar que el tenant esté activo
    if (!keyRecord.tenants.activo) {
      return res.status(403).json({
        success: false,
        error: 'Cuenta desactivada. Contacta al administrador.'
      });
    }

    // Verificar expiración
    if (keyRecord.expiraEn && new Date() > new Date(keyRecord.expiraEn)) {
      return res.status(403).json({
        success: false,
        error: 'API Key expirada. Genera una nueva API Key.'
      });
    }

    // Actualizar estadísticas de uso (async, no bloqueante)
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    prisma.sync_api_keys.update({
      where: { id: keyRecord.id },
      data: {
        ultimoUso: new Date(),
        ultimoUsoIp: clientIp,
        vecesUtilizada: { increment: 1 }
      }
    }).catch(err => {
      console.error('Error actualizando estadísticas de API Key:', err);
    });

    // Agregar información al request
    req.apiKey = {
      id: keyRecord.id,
      nombre: keyRecord.nombre,
      permisos: keyRecord.permisos,
      tenantId: keyRecord.tenantId,
      tenant: keyRecord.tenants
    };

    // Simular estructura de req.user para compatibilidad con otros middlewares
    req.user = {
      id: `api-key-${keyRecord.id}`,
      tenantId: keyRecord.tenantId,
      role: 'api',
      apiKeyId: keyRecord.id
    };

    next();

  } catch (error) {
    console.error('Error en apiKeyAuth middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno de autenticación'
    });
  }
};

/**
 * Middleware opcional: verificar permisos específicos
 * @param {string[]} requiredPermissions - Permisos requeridos
 */
const requirePermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación requerida'
      });
    }

    const permissions = req.apiKey.permisos || {};
    const hasPermission = requiredPermissions.every(perm => permissions[perm] === true);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
        required: requiredPermissions
      });
    }

    next();
  };
};

module.exports = {
  apiKeyAuth,
  requirePermissions
};
