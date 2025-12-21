const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// Mock de las dependencias
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('crypto');

const prisma = new PrismaClient();
const oauthService = require('../../src/services/oauthService');

describe('OAuthService - Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClient', () => {
    it('debe crear un cliente OAuth con credenciales generadas', async () => {
      // Arrange
      const mockClientData = {
        tenantId: 'tenant-123',
        nombre: 'Test Client',
        descripcion: 'Cliente de prueba',
        allowedScopes: ['read:documents', 'write:documents'],
        customRateLimit: false,
        createdBy: 'user-123'
      };

      const mockClientId = 'client_abc123';
      const mockClientSecret = 'secret_xyz789';
      const mockHashedSecret = 'hashed_secret_xyz789';

      crypto.randomBytes = jest.fn()
        .mockReturnValueOnce({ toString: () => 'abc123' }) // Para clientId
        .mockReturnValueOnce({ toString: () => 'xyz789' }); // Para clientSecret

      bcrypt.hash = jest.fn().mockResolvedValue(mockHashedSecret);

      const mockCreatedClient = {
        id: 'oauth-client-uuid',
        ...mockClientData,
        clientId: mockClientId,
        clientSecret: mockHashedSecret,
        grantTypes: ['client_credentials'],
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.oauth_clients.create = jest.fn().mockResolvedValue(mockCreatedClient);

      // Act
      const result = await oauthService.createClient(mockClientData);

      // Assert
      expect(prisma.oauth_clients.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-123',
          nombre: 'Test Client',
          clientId: expect.stringContaining('client_'),
          clientSecret: mockHashedSecret,
          allowedScopes: ['read:documents', 'write:documents'],
          activo: true
        })
      });

      expect(result).toHaveProperty('clientSecret');
      expect(result.clientSecret).not.toBe(mockHashedSecret); // Debe ser plain text
      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
    });

    it('debe generar clientId y clientSecret únicos', async () => {
      const mockData = {
        tenantId: 'tenant-123',
        nombre: 'Test',
        createdBy: 'user-123'
      };

      crypto.randomBytes = jest.fn()
        .mockReturnValueOnce({ toString: () => 'unique1' })
        .mockReturnValueOnce({ toString: () => 'unique2' });

      bcrypt.hash = jest.fn().mockResolvedValue('hashed');

      prisma.oauth_clients.create = jest.fn().mockResolvedValue({
        id: 'uuid',
        ...mockData,
        clientId: 'client_unique1',
        clientSecret: 'hashed'
      });

      await oauthService.createClient(mockData);

      expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
      expect(crypto.randomBytes).toHaveBeenNthCalledWith(1, 16); // clientId
      expect(crypto.randomBytes).toHaveBeenNthCalledWith(2, 32); // clientSecret
    });
  });

  describe('validateClient', () => {
    it('debe validar credenciales correctas', async () => {
      // Arrange
      const clientId = 'client_test123';
      const plainSecret = 'secret_plain';
      const hashedSecret = 'hashed_secret';

      const mockClient = {
        id: 'client-uuid',
        clientId,
        clientSecret: hashedSecret,
        activo: true,
        tenantId: 'tenant-123',
        allowedScopes: ['read:documents']
      };

      prisma.oauth_clients.findUnique = jest.fn().mockResolvedValue(mockClient);
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      // Act
      const result = await oauthService.validateClient(clientId, plainSecret);

      // Assert
      expect(prisma.oauth_clients.findUnique).toHaveBeenCalledWith({
        where: { clientId },
        include: { tenants: true }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(plainSecret, hashedSecret);
      expect(result).toEqual(mockClient);
    });

    it('debe rechazar credenciales incorrectas', async () => {
      const clientId = 'client_test123';
      const wrongSecret = 'wrong_secret';

      const mockClient = {
        id: 'client-uuid',
        clientId,
        clientSecret: 'hashed_secret',
        activo: true
      };

      prisma.oauth_clients.findUnique = jest.fn().mockResolvedValue(mockClient);
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const result = await oauthService.validateClient(clientId, wrongSecret);

      expect(result).toBeNull();
    });

    it('debe rechazar cliente inactivo', async () => {
      const clientId = 'client_inactive';
      const secret = 'secret_123';

      const mockClient = {
        id: 'client-uuid',
        clientId,
        clientSecret: 'hashed',
        activo: false // Cliente desactivado
      };

      prisma.oauth_clients.findUnique = jest.fn().mockResolvedValue(mockClient);

      const result = await oauthService.validateClient(clientId, secret);

      expect(result).toBeNull();
    });

    it('debe rechazar cliente no existente', async () => {
      prisma.oauth_clients.findUnique = jest.fn().mockResolvedValue(null);

      const result = await oauthService.validateClient('non_existent', 'secret');

      expect(result).toBeNull();
    });
  });

  describe('generateTokens', () => {
    it('debe generar access token y refresh token', async () => {
      // Arrange
      const mockClient = {
        id: 'client-uuid',
        clientId: 'client_test',
        tenantId: 'tenant-123',
        allowedScopes: ['read:documents', 'write:documents'],
        tenants: { id: 'tenant-123', nombre: 'Test Tenant' }
      };

      const requestedScopes = ['read:documents'];
      const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access';
      const mockRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh';

      jwt.sign = jest.fn()
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const mockCreatedToken = {
        id: 'token-uuid',
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: new Date(Date.now() + 3600000),
        refreshExpiresAt: new Date(Date.now() + 604800000)
      };

      prisma.oauth_tokens.create = jest.fn().mockResolvedValue(mockCreatedToken);

      // Act
      const result = await oauthService.generateTokens(mockClient, requestedScopes);

      // Assert
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'access',
          clientId: 'client_test',
          tenantId: 'tenant-123',
          scopes: ['read:documents']
        }),
        expect.any(String),
        { expiresIn: '1h' }
      );

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read:documents'
      });
    });

    it('debe validar que los scopes solicitados estén permitidos', async () => {
      const mockClient = {
        id: 'client-uuid',
        clientId: 'client_test',
        allowedScopes: ['read:documents'],
        tenants: { id: 'tenant-123' }
      };

      const invalidScopes = ['write:documents', 'delete:everything'];

      jwt.sign = jest.fn().mockReturnValue('token');
      prisma.oauth_tokens.create = jest.fn().mockResolvedValue({
        accessToken: 'token',
        expiresAt: new Date()
      });

      const result = await oauthService.generateTokens(mockClient, invalidScopes);

      // Los scopes finales deben ser solo los permitidos
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: ['read:documents'] // Solo el scope permitido
        }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('validateToken', () => {
    it('debe validar token válido no revocado', async () => {
      const mockToken = 'valid_token';
      const mockPayload = {
        jti: 'token-uuid',
        clientId: 'client_test',
        tenantId: 'tenant-123',
        scopes: ['read:documents'],
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      jwt.verify = jest.fn().mockReturnValue(mockPayload);

      prisma.oauth_tokens.findUnique = jest.fn().mockResolvedValue({
        id: 'token-uuid',
        revoked: false,
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result = await oauthService.validateToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
      expect(result).toEqual(mockPayload);
    });

    it('debe rechazar token revocado', async () => {
      const mockToken = 'revoked_token';
      const mockPayload = { jti: 'token-uuid' };

      jwt.verify = jest.fn().mockReturnValue(mockPayload);

      prisma.oauth_tokens.findUnique = jest.fn().mockResolvedValue({
        id: 'token-uuid',
        revoked: true // Token revocado
      });

      const result = await oauthService.validateToken(mockToken);

      expect(result).toBeNull();
    });

    it('debe rechazar token expirado', async () => {
      const mockToken = 'expired_token';

      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = await oauthService.validateToken(mockToken);

      expect(result).toBeNull();
    });

    it('debe rechazar token inválido', async () => {
      const mockToken = 'invalid_token';

      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('invalid signature');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const result = await oauthService.validateToken(mockToken);

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('debe generar nuevo access token con refresh token válido', async () => {
      const refreshToken = 'valid_refresh_token';
      const mockPayload = {
        jti: 'token-uuid',
        clientId: 'client_test',
        type: 'refresh'
      };

      const mockTokenRecord = {
        id: 'token-uuid',
        clientId: 'client-uuid',
        refreshToken,
        revoked: false,
        refreshExpiresAt: new Date(Date.now() + 86400000),
        client: {
          id: 'client-uuid',
          clientId: 'client_test',
          tenantId: 'tenant-123',
          allowedScopes: ['read:documents'],
          activo: true,
          tenants: { id: 'tenant-123' }
        }
      };

      jwt.verify = jest.fn().mockReturnValue(mockPayload);
      prisma.oauth_tokens.findUnique = jest.fn().mockResolvedValue(mockTokenRecord);

      const newAccessToken = 'new_access_token';
      jwt.sign = jest.fn().mockReturnValue(newAccessToken);

      prisma.oauth_tokens.update = jest.fn().mockResolvedValue({
        ...mockTokenRecord,
        accessToken: newAccessToken
      });

      const result = await oauthService.refreshAccessToken(refreshToken);

      expect(result).toEqual({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 3600
      });
    });

    it('debe rechazar refresh token revocado', async () => {
      const refreshToken = 'revoked_refresh';
      const mockPayload = { jti: 'token-uuid' };

      jwt.verify = jest.fn().mockReturnValue(mockPayload);
      prisma.oauth_tokens.findUnique = jest.fn().mockResolvedValue({
        id: 'token-uuid',
        revoked: true
      });

      await expect(oauthService.refreshAccessToken(refreshToken))
        .rejects
        .toThrow('Refresh token revoked');
    });
  });

  describe('revokeToken', () => {
    it('debe revocar un token válido', async () => {
      const token = 'token_to_revoke';
      const mockPayload = { jti: 'token-uuid' };

      jwt.verify = jest.fn().mockReturnValue(mockPayload);

      prisma.oauth_tokens.update = jest.fn().mockResolvedValue({
        id: 'token-uuid',
        revoked: true,
        revokedAt: new Date()
      });

      const result = await oauthService.revokeToken(token);

      expect(prisma.oauth_tokens.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid' },
        data: {
          revoked: true,
          revokedAt: expect.any(Date)
        }
      });

      expect(result).toBe(true);
    });
  });

  describe('logApiRequest', () => {
    it('debe registrar una petición API', async () => {
      const requestData = {
        clientId: 'client-uuid',
        tenantId: 'tenant-123',
        method: 'GET',
        endpoint: '/api/v1/documents',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        statusCode: 200,
        responseTime: 150
      };

      prisma.oauth_api_logs.create = jest.fn().mockResolvedValue({
        id: 'log-uuid',
        ...requestData,
        timestamp: new Date()
      });

      const result = await oauthService.logApiRequest(requestData);

      expect(prisma.oauth_api_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'GET',
          endpoint: '/api/v1/documents',
          statusCode: 200,
          responseTime: 150
        })
      });

      expect(result).toHaveProperty('id', 'log-uuid');
    });
  });

  describe('getClientStats', () => {
    it('debe retornar estadísticas de uso del cliente', async () => {
      const clientId = 'client-uuid';
      const mockLogs = [
        { statusCode: 200, responseTime: 100 },
        { statusCode: 200, responseTime: 150 },
        { statusCode: 404, responseTime: 50 },
        { statusCode: 500, responseTime: 200 }
      ];

      prisma.oauth_api_logs.findMany = jest.fn().mockResolvedValue(mockLogs);
      prisma.oauth_api_logs.count = jest.fn().mockResolvedValue(4);

      const result = await oauthService.getClientStats(clientId, 30);

      expect(result).toMatchObject({
        totalRequests: 4,
        successRate: expect.any(Number),
        avgResponseTime: expect.any(Number)
      });

      expect(result.successRate).toBeGreaterThan(0);
      expect(result.avgResponseTime).toBeGreaterThan(0);
    });
  });
});
