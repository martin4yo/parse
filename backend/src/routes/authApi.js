const express = require('express');
const router = express.Router();
const oauthService = require('../services/oauthService');
const { authenticateOAuth } = require('../middleware/oauthAuth');

/**
 * @swagger
 * /api/v1/auth/token:
 *   post:
 *     summary: Obtener access token
 *     description: Obtiene un access token usando OAuth 2.0 Client Credentials flow
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OAuthTokenRequest'
 *     responses:
 *       200:
 *         description: Token generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OAuthTokenResponse'
 *       400:
 *         description: Parámetros inválidos o grant_type no soportado
 *       401:
 *         description: Credenciales de cliente inválidas
 */
router.post('/token', async (req, res) => {
  try {
    const { client_id, client_secret, grant_type, scope } = req.body;

    if (grant_type !== 'client_credentials') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only client_credentials grant type is supported'
      });
    }

    if (!client_id || !client_secret) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id and client_secret are required'
      });
    }

    const client = await oauthService.validateClient(client_id, client_secret);

    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    const requestedScopes = scope ? scope.split(' ').filter(s => s) : [];
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
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refrescar access token
 *     description: Obtiene un nuevo access token usando un refresh token válido
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - grant_type
 *               - refresh_token
 *             properties:
 *               grant_type:
 *                 type: string
 *                 enum: [refresh_token]
 *                 example: refresh_token
 *               refresh_token:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Nuevo access token generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 token_type:
 *                   type: string
 *                   example: Bearer
 *                 expires_in:
 *                   type: integer
 *                   example: 3600
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', async (req, res) => {
  try {
    const { grant_type, refresh_token } = req.body;

    if (grant_type !== 'refresh_token') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only refresh_token grant type is supported for this endpoint'
      });
    }

    if (!refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token is required'
      });
    }

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
 * @swagger
 * /api/v1/auth/revoke:
 *   post:
 *     summary: Revocar un token
 *     description: Revoca un access token o refresh token para invalidarlo permanentemente
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Access token o refresh token a revocar
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               token_type_hint:
 *                 type: string
 *                 enum: [access_token, refresh_token]
 *                 example: access_token
 *                 description: Hint opcional sobre el tipo de token
 *     responses:
 *       200:
 *         description: Token revocado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token revoked successfully
 *       400:
 *         description: Token no encontrado o ya revocado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Información del cliente autenticado
 *     description: Obtiene información sobre el cliente OAuth actualmente autenticado
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Información del cliente obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   example: client_abc123xyz
 *                 nombre:
 *                   type: string
 *                   example: Mi Sistema ERP
 *                 descripcion:
 *                   type: string
 *                   example: Integración con ERP principal
 *                 tenantId:
 *                   type: string
 *                   format: uuid
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                       example: Mi Empresa SA
 *                     slug:
 *                       type: string
 *                       example: mi-empresa
 *                 scopes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [read:documents, write:documents]
 *                 tokenExpiry:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-01-21T15:00:00.000Z
 *                 customRateLimit:
 *                   type: boolean
 *                   example: false
 *                 rateLimit:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     requestsPerMinute:
 *                       type: integer
 *                       example: 120
 *                     requestsPerHour:
 *                       type: integer
 *                       example: 5000
 *                     requestsPerDay:
 *                       type: integer
 *                       example: 50000
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 * @swagger
 * /api/v1/auth/health:
 *   get:
 *     summary: Health check
 *     description: Verifica el estado del servicio de autenticación
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Servicio funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: Parse Auth API
 *                 version:
 *                   type: string
 *                   example: 1.0.0
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
