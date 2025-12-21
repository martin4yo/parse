const oauthService = require('../services/oauthService');

/**
 * Middleware para autenticar requests usando OAuth 2.0 Bearer tokens
 *
 * Uso:
 *   router.get('/protected', authenticateOAuth, (req, res) => { ... });
 *   router.get('/admin', authenticateOAuth, requireScope('admin'), (req, res) => { ... });
 */

/**
 * Middleware principal de autenticación OAuth
 * Valida el Bearer token en el header Authorization
 *
 * Agrega a req los siguientes objetos:
 * - req.auth: Payload del token (clientId, tenantId, scopes, etc.)
 * - req.client: Datos del cliente OAuth
 * - req.tenant: Datos del tenant
 */
async function authenticateOAuth(req, res, next) {
  const startTime = Date.now();

  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authorization header is required'
      });
    }

    // Verificar formato: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'invalid_request',
        message: 'Authorization header must be "Bearer <token>"'
      });
    }

    const token = parts[1];

    // Validar token
    const payload = await oauthService.validateToken(token);

    if (!payload) {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Invalid or expired access token'
      });
    }

    // Agregar datos a req para usar en los endpoints
    req.auth = payload;
    req.client = payload.client;
    req.tenant = payload.tenant;

    // Log del request (se ejecuta después de la respuesta)
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;

      oauthService.logApiRequest({
        clientId: req.client.id,
        tenantId: req.tenant.id,
        method: req.method,
        endpoint: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        statusCode: res.statusCode,
        responseTime,
        rateLimitHit: false,
        errorMessage: null
      }).catch(err => {
        console.error('Error logging API request:', err);
      });
    });

    next();
  } catch (error) {
    console.error('❌ [OAuth Auth] Error en middleware:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error during authentication'
    });
  }
}

/**
 * Middleware para requerir un scope específico
 * Debe usarse DESPUÉS de authenticateOAuth
 *
 * Ejemplo:
 *   router.post('/documents', authenticateOAuth, requireScope('write:documents'), handler);
 *
 * @param {string} requiredScope - Scope requerido
 * @returns {Function} Middleware function
 */
function requireScope(requiredScope) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    if (!oauthService.hasScope(req.auth, requiredScope)) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `This operation requires the scope: ${requiredScope}`,
        required_scope: requiredScope,
        available_scopes: req.auth.scopes
      });
    }

    next();
  };
}

/**
 * Middleware para requerir CUALQUIERA de varios scopes
 * Debe usarse DESPUÉS de authenticateOAuth
 *
 * Ejemplo:
 *   router.get('/data', authenticateOAuth, requireAnyScope(['read:data', 'admin']), handler);
 *
 * @param {string[]} requiredScopes - Array de scopes, con tener uno es suficiente
 * @returns {Function} Middleware function
 */
function requireAnyScope(requiredScopes) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const hasAnyScope = requiredScopes.some(scope =>
      oauthService.hasScope(req.auth, scope)
    );

    if (!hasAnyScope) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `This operation requires one of: ${requiredScopes.join(', ')}`,
        required_scopes: requiredScopes,
        available_scopes: req.auth.scopes
      });
    }

    next();
  };
}

/**
 * Middleware para requerir TODOS los scopes especificados
 * Debe usarse DESPUÉS de authenticateOAuth
 *
 * Ejemplo:
 *   router.post('/admin/action', authenticateOAuth, requireAllScopes(['admin', 'write:all']), handler);
 *
 * @param {string[]} requiredScopes - Array de scopes, debe tener todos
 * @returns {Function} Middleware function
 */
function requireAllScopes(requiredScopes) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const hasAllScopes = requiredScopes.every(scope =>
      oauthService.hasScope(req.auth, scope)
    );

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `This operation requires all of: ${requiredScopes.join(', ')}`,
        required_scopes: requiredScopes,
        available_scopes: req.auth.scopes
      });
    }

    next();
  };
}

/**
 * Middleware opcional de autenticación
 * Intenta autenticar pero no falla si no hay token
 * Útil para endpoints que pueden funcionar con/sin autenticación
 *
 * Ejemplo:
 *   router.get('/public', optionalAuth, (req, res) => {
 *     if (req.auth) {
 *       // Usuario autenticado
 *     } else {
 *       // Usuario anónimo
 *     }
 *   });
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No hay token, continuar sin autenticar
    return next();
  }

  try {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const payload = await oauthService.validateToken(token);

      if (payload) {
        req.auth = payload;
        req.client = payload.client;
        req.tenant = payload.tenant;
      }
    }
  } catch (error) {
    // Ignorar errores en auth opcional
    console.warn('⚠️  [OAuth Optional Auth] Error validando token:', error.message);
  }

  next();
}

module.exports = {
  authenticateOAuth,
  requireScope,
  requireAnyScope,
  requireAllScopes,
  optionalAuth
};
