const { PrismaClient } = require('@prisma/client');
const { hashApiKey } = require('../routes/syncApiKeys');
const prisma = new PrismaClient();

/**
 * Middleware de autenticación para endpoints de sync
 * Valida la API key del cliente de sincronización
 */
async function authenticateSyncClient(req, res, next) {
  try {
    // Obtener API key del header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key requerida',
        message: 'Incluye la API key en el header X-API-Key o Authorization',
      });
    }

    // Hashear la key para buscar en BD
    const hashedKey = hashApiKey(apiKey);

    // Buscar la API key en la base de datos
    const apiKeyRecord = await prisma.sync_api_keys.findUnique({
      where: {
        key: hashedKey,
      },
      include: {
        tenants: {
          select: {
            id: true,
            slug: true,
            nombre: true,
            activo: true,
          },
        },
      },
    });

    // Validar que existe
    if (!apiKeyRecord) {
      return res.status(401).json({
        success: false,
        error: 'API key inválida',
      });
    }

    // Validar que está activa
    if (!apiKeyRecord.activo) {
      return res.status(401).json({
        success: false,
        error: 'API key deshabilitada',
      });
    }

    // Validar que no ha expirado
    if (apiKeyRecord.expiraEn && apiKeyRecord.expiraEn < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'API key expirada',
      });
    }

    // Validar que el tenant está activo
    if (!apiKeyRecord.tenants.activo) {
      return res.status(403).json({
        success: false,
        error: 'Tenant deshabilitado',
      });
    }

    // Validar permisos si se especificaron en el request
    const requiredPermission = req.syncPermission;
    if (requiredPermission) {
      const permisos = apiKeyRecord.permisos || {};
      if (!permisos[requiredPermission]) {
        return res.status(403).json({
          success: false,
          error: `Permiso '${requiredPermission}' requerido`,
        });
      }
    }

    // Actualizar estadísticas de uso (async, no esperamos)
    prisma.sync_api_keys
      .update({
        where: { id: apiKeyRecord.id },
        data: {
          ultimoUso: new Date(),
          ultimoUsoIp:
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.ip,
          vecesUtilizada: { increment: 1 },
        },
      })
      .catch((err) => {
        console.error('Error actualizando estadísticas de API key:', err);
      });

    // Agregar información al request
    req.syncClient = {
      apiKeyId: apiKeyRecord.id,
      tenantId: apiKeyRecord.tenants.id,
      tenant: apiKeyRecord.tenants,
      permisos: apiKeyRecord.permisos || {},
    };

    next();
  } catch (error) {
    console.error('Error en autenticación de sync:', error);
    return res.status(500).json({
      success: false,
      error: 'Error de autenticación',
    });
  }
}

/**
 * Middleware helper para especificar permisos requeridos
 */
function requireSyncPermission(permission) {
  return (req, res, next) => {
    req.syncPermission = permission;
    authenticateSyncClient(req, res, next);
  };
}

module.exports = {
  authenticateSyncClient,
  requireSyncPermission,
};
