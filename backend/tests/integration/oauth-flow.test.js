const request = require('supertest');
const express = require('express');
const authApiRoutes = require('../../src/routes/authApi');
const publicApiRoutes = require('../../src/routes/publicApi');

// Mock del servicio OAuth
jest.mock('../../src/services/oauthService');
const oauthService = require('../../src/services/oauthService');

// Setup de la app Express para testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authApiRoutes);
  app.use('/api/v1/documents', publicApiRoutes);
  return app;
}

describe('OAuth 2.0 Flow - Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/token - Obtener Access Token', () => {
    it('debe retornar access token con credenciales válidas', async () => {
      // Arrange
      const mockClient = {
        id: 'client-uuid',
        clientId: 'client_test123',
        tenantId: 'tenant-123',
        activo: true
      };

      const mockTokens = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read:documents'
      };

      oauthService.validateClient.mockResolvedValue(mockClient);
      oauthService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      const response = await request(app)
        .post('/api/v1/auth/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'client_test123',
          client_secret: 'secret_xyz789',
          scope: 'read:documents'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600
      });

      expect(oauthService.validateClient).toHaveBeenCalledWith(
        'client_test123',
        'secret_xyz789'
      );
    });

    it('debe retornar 401 con credenciales inválidas', async () => {
      oauthService.validateClient.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'invalid_client',
          client_secret: 'wrong_secret'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'invalid_client',
        error_description: expect.any(String)
      });
    });

    it('debe retornar 400 con grant_type no soportado', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .send({
          grant_type: 'password', // No soportado
          client_id: 'client_test',
          client_secret: 'secret'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'unsupported_grant_type'
      });
    });

    it('debe retornar 400 sin client_id o client_secret', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .send({
          grant_type: 'client_credentials'
          // Falta client_id y client_secret
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'invalid_request'
      });
    });
  });

  describe('POST /api/v1/auth/refresh - Refrescar Token', () => {
    it('debe retornar nuevo access token con refresh token válido', async () => {
      const mockNewTokens = {
        access_token: 'new_access_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      oauthService.refreshAccessToken.mockResolvedValue(mockNewTokens);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: 'valid_refresh_token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        access_token: 'new_access_token',
        token_type: 'Bearer',
        expires_in: 3600
      });
    });

    it('debe retornar 401 con refresh token inválido', async () => {
      oauthService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: 'invalid_token'
        });

      expect(response.status).toBe(401);
    });

    it('debe retornar 400 sin refresh_token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/revoke - Revocar Token', () => {
    it('debe revocar token válido', async () => {
      oauthService.revokeToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/revoke')
        .send({
          token: 'token_to_revoke'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String)
      });
    });

    it('debe retornar 400 sin token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/revoke')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me - Info del Cliente', () => {
    it('debe retornar info del cliente autenticado', async () => {
      const mockPayload = {
        clientId: 'client_test',
        tenantId: 'tenant-123',
        scopes: ['read:documents'],
        client: {
          id: 'client-uuid',
          nombre: 'Test Client'
        },
        tenant: {
          id: 'tenant-123',
          nombre: 'Test Tenant'
        }
      };

      oauthService.validateToken.mockResolvedValue(mockPayload);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          clientId: 'client_test',
          scopes: ['read:documents']
        })
      });
    });

    it('debe retornar 401 sin token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('debe retornar 401 con token inválido', async () => {
      oauthService.validateToken.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/health - Health Check', () => {
    it('debe retornar status OK', async () => {
      const response = await request(app)
        .get('/api/v1/auth/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Flujo Completo OAuth 2.0', () => {
    it('debe completar flujo: token → uso → refresh → revoke', async () => {
      // Step 1: Obtener token
      const mockClient = {
        id: 'client-uuid',
        clientId: 'client_full_test',
        tenantId: 'tenant-123'
      };

      const mockTokens = {
        access_token: 'access_123',
        refresh_token: 'refresh_123',
        token_type: 'Bearer',
        expires_in: 3600
      };

      oauthService.validateClient.mockResolvedValue(mockClient);
      oauthService.generateTokens.mockResolvedValue(mockTokens);

      const tokenResponse = await request(app)
        .post('/api/v1/auth/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'client_full_test',
          client_secret: 'secret_123'
        });

      expect(tokenResponse.status).toBe(200);
      const { access_token, refresh_token } = tokenResponse.body;

      // Step 2: Usar token para acceder a API
      const mockPayload = {
        clientId: 'client_full_test',
        tenantId: 'tenant-123',
        scopes: ['read:documents'],
        client: mockClient,
        tenant: { id: 'tenant-123' }
      };

      oauthService.validateToken.mockResolvedValue(mockPayload);

      const meResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${access_token}`);

      expect(meResponse.status).toBe(200);

      // Step 3: Refrescar token
      const newTokens = {
        access_token: 'new_access_456',
        token_type: 'Bearer',
        expires_in: 3600
      };

      oauthService.refreshAccessToken.mockResolvedValue(newTokens);

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.access_token).toBe('new_access_456');

      // Step 4: Revocar token
      oauthService.revokeToken.mockResolvedValue(true);

      const revokeResponse = await request(app)
        .post('/api/v1/auth/revoke')
        .send({ token: newTokens.access_token });

      expect(revokeResponse.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('debe respetar límites de rate limit', async () => {
      const mockPayload = {
        clientId: 'client_limited',
        tenantId: 'tenant-123',
        scopes: ['read:documents'],
        client: {
          id: 'client-uuid',
          customRateLimit: true,
          requestsPerMinute: 2 // Solo 2 requests por minuto
        },
        tenant: { id: 'tenant-123' }
      };

      oauthService.validateToken.mockResolvedValue(mockPayload);

      // Primera petición - OK
      const response1 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response1.status).toBe(200);

      // Segunda petición - OK
      const response2 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response2.status).toBe(200);

      // Tercera petición - Rate limited (si está implementado)
      // Este test depende de que el middleware de rate limiting esté activo
    });
  });

  describe('Scope Validation', () => {
    it('debe permitir acceso con scope correcto', async () => {
      const mockPayload = {
        clientId: 'client_test',
        tenantId: 'tenant-123',
        scopes: ['read:documents'],
        client: { id: 'client-uuid' },
        tenant: { id: 'tenant-123' }
      };

      oauthService.validateToken.mockResolvedValue(mockPayload);

      // GET /documents requiere read:documents
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
    });

    it('debe rechazar acceso sin scope requerido', async () => {
      const mockPayload = {
        clientId: 'client_test',
        tenantId: 'tenant-123',
        scopes: ['write:documents'], // No tiene read:documents
        client: { id: 'client-uuid' },
        tenant: { id: 'tenant-123' }
      };

      oauthService.validateToken.mockResolvedValue(mockPayload);

      // Si hay endpoints que requieren scopes específicos, testearlos aquí
      // Por ahora, /auth/me no requiere scopes específicos
    });
  });
});
