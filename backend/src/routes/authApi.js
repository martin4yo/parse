const express = require('express');
const router = express.Router();
const oauthService = require('../services/oauthService');
const { authenticateOAuth } = require('../middleware/oauthAuth');

/**
 * POST /api/v1/auth/token
 * Obtener access token usando Client Credentials flow
 *
 * Body (JSON):
 * {
 *   "client_id": "client_abc123",
 *   "client_secret": "secret_xyz789",
 *   "grant_type": "client_credentials",
 *   "scope": "read:documents write:documents" // Opcional
 * }
 *
 * Response 200:
 * {
 *   "access_token": "eyJhbGc...",
 *   "token_type": "Bearer",
 *   "expires_in": 3600,
 *   "refresh_token": "eyJhbGc...",
 *   "scope": "read:documents write:documents"
 * }
 */
router.post('/token', async (req, res) => {
  try {
    const { client_id, client_secret, grant_type, scope } = req.body;

    // Validar grant_type
    if (grant_type !== 'client_credentials') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only client_credentials grant type is supported'
      });
    }

    // Validar client_id y client_secret
    if (!client_id || !client_secret) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id and client_secret are required'
      });
    }

    // Validar credenciales del cliente
    const client = await oauthService.validateClient(client_id, client_secret);

    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    // Parsear scopes solicitados
    const requestedScopes = scope ? scope.split(' ').filter(s => s) : [];

    // Generar tokens
    const tokens = await oauthService.generateTokens(client, requestedScopes);

    console.log(`✅ [Auth API] Token generado para cliente: ${client_id}`);

    res.json(tokens);
  } catch (error) {
    console.error('❌ [Auth API] Error generando token:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refrescar un access token usando refresh token
 *
 * Body (JSON):
 * {
 *   "grant_type": "refresh_token",
 *   "refresh_token": "eyJhbGc..."
 * }
 *
 * Response 200:
 * {
 *   "access_token": "eyJhbGc...",
 *   "token_type": "Bearer",
 *   "expires_in": 3600,
 *   "refresh_token": "eyJhbGc...",
 *   "scope": "read:documents write:documents"
 * }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { grant_type, refresh_token } = req.body;

    // Validar grant_type
    if (grant_type !== 'refresh_token') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only refresh_token grant type is supported for this endpoint'
      });
    }

    // Validar refresh_token
    if (!refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token is required'
      });
    }

    // Refrescar token
    const newTokens = await oauthService.refreshAccessToken(refresh_token);

    if (!newTokens) {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired refresh token'
      });
    }

    console.log('✅ [Auth API] Token refrescado exitosamente');

    res.json(newTokens);
  } catch (error) {
    console.error('❌ [Auth API] Error refrescando token:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/v1/auth/revoke
 * Revocar un access token o refresh token
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Body (JSON):
 * {
 *   "token": "eyJhbGc...",  // Access token o refresh token a revocar
 *   "token_type_hint": "access_token"  // Opcional: "access_token" o "refresh_token"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Token revoked successfully"
 * }
 */
router.post('/revoke', authenticateOAuth, async (req, res) => {
  try {
    const { token, token_type_hint } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'token is required'
      });
    }

    const revoked = await oauthService.revokeToken(token);

    if (!revoked) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Token not found or already revoked'
      });
    }

    console.log('✅ [Auth API] Token revocado exitosamente');

    res.json({
      success: true,
      message: 'Token revoked successfully'
    });
  } catch (error) {
    console.error('❌ [Auth API] Error revocando token:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Obtener información del cliente autenticado
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 * {
 *   "clientId": "client_abc123",
 *   "nombre": "Mi Sistema ERP",
 *   "tenantId": "tenant-id",
 *   "tenant": {
 *     "nombre": "Mi Empresa SA",
 *     "slug": "mi-empresa"
 *   },
 *   "scopes": ["read:documents", "write:documents"],
 *   "tokenExpiry": "2025-01-21T15:00:00Z"
 * }
 */
router.get('/me', authenticateOAuth, async (req, res) => {
  try {
    res.json({
      clientId: req.client.clientId,
      nombre: req.client.nombre,
      descripcion: req.client.descripcion,
      tenantId: req.tenant.id,
      tenant: {
        nombre: req.tenant.nombre,
        slug: req.tenant.slug
      },
      scopes: req.auth.scopes,
      tokenExpiry: new Date(req.auth.exp * 1000).toISOString(),
      customRateLimit: req.client.customRateLimit,
      rateLimit: req.client.customRateLimit ? {
        requestsPerMinute: req.client.requestsPerMinute,
        requestsPerHour: req.client.requestsPerHour,
        requestsPerDay: req.client.requestsPerDay
      } : null
    });
  } catch (error) {
    console.error('❌ [Auth API] Error en /me:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/auth/health
 * Health check endpoint (no requiere autenticación)
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Parse Auth API',
    version: '1.0.0'
  });
});

module.exports = router;
