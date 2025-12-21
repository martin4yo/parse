const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Servicio para gestionar OAuth 2.0 - Client Credentials Flow
 *
 * Funcionalidades:
 * - Generar client_id y client_secret
 * - Validar credenciales de cliente
 * - Generar y validar tokens JWT
 * - Refresh de tokens
 * - Gestión de scopes
 */
class OAuthService {
  constructor() {
    // Configuración JWT
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    this.ACCESS_TOKEN_EXPIRY = '1h'; // 1 hora
    this.REFRESH_TOKEN_EXPIRY = '7d'; // 7 días
  }

  /**
   * Generar un nuevo cliente OAuth
   * @param {Object} data - Datos del cliente
   * @param {string} data.tenantId - ID del tenant
   * @param {string} data.nombre - Nombre descriptivo del cliente
   * @param {string} [data.descripcion] - Descripción opcional
   * @param {string[]} [data.allowedScopes] - Scopes permitidos
   * @param {boolean} [data.customRateLimit] - ¿Tiene rate limit personalizado?
   * @param {number} [data.requestsPerMinute] - Requests por minuto
   * @param {number} [data.requestsPerHour] - Requests por hora
   * @param {number} [data.requestsPerDay] - Requests por día
   * @param {string} [data.createdBy] - ID del usuario que crea el cliente
   * @returns {Promise<Object>} Cliente creado con client_id y client_secret en texto plano
   */
  async createClient(data) {
    const {
      tenantId,
      nombre,
      descripcion = null,
      allowedScopes = ['read:documents', 'write:documents', 'read:files'],
      customRateLimit = false,
      requestsPerMinute = null,
      requestsPerHour = null,
      requestsPerDay = null,
      createdBy = null
    } = data;

    // Generar client_id (formato: client_<random>)
    const clientId = `client_${crypto.randomBytes(16).toString('hex')}`;

    // Generar client_secret (formato: secret_<random>)
    const clientSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;

    // Hashear el client_secret con bcrypt
    const hashedSecret = await bcrypt.hash(clientSecret, 10);

    // Crear cliente en la base de datos
    const client = await prisma.oauth_clients.create({
      data: {
        tenantId,
        clientId,
        clientSecret: hashedSecret,
        nombre,
        descripcion,
        grantTypes: ['client_credentials'], // Por ahora solo client_credentials
        allowedScopes,
        customRateLimit,
        requestsPerMinute,
        requestsPerHour,
        requestsPerDay,
        activo: true,
        createdBy
      }
    });

    console.log(`✅ [OAuth] Cliente creado: ${clientId} para tenant ${tenantId}`);

    // IMPORTANTE: Devolvemos el secret en texto plano SOLO en la creación
    // El usuario debe guardarlo porque no se puede recuperar después
    return {
      ...client,
      clientSecret: clientSecret, // Texto plano para mostrar al usuario
      clientSecretHashed: hashedSecret // Hasheado (ya está en BD)
    };
  }

  /**
   * Validar credenciales de cliente OAuth
   * @param {string} clientId - Client ID
   * @param {string} clientSecret - Client Secret en texto plano
   * @returns {Promise<Object|null>} Cliente si es válido, null si no
   */
  async validateClient(clientId, clientSecret) {
    try {
      // Buscar cliente por clientId
      const client = await prisma.oauth_clients.findUnique({
        where: { clientId },
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

      if (!client) {
        console.log(`❌ [OAuth] Cliente no encontrado: ${clientId}`);
        return null;
      }

      if (!client.activo) {
        console.log(`❌ [OAuth] Cliente inactivo: ${clientId}`);
        return null;
      }

      if (!client.tenants.activo) {
        console.log(`❌ [OAuth] Tenant inactivo para cliente: ${clientId}`);
        return null;
      }

      // Verificar client_secret
      const isValid = await bcrypt.compare(clientSecret, client.clientSecret);

      if (!isValid) {
        console.log(`❌ [OAuth] Client secret inválido para: ${clientId}`);
        return null;
      }

      console.log(`✅ [OAuth] Cliente validado: ${clientId}`);

      // Actualizar último uso
      await prisma.oauth_clients.update({
        where: { id: client.id },
        data: {
          ultimoUso: new Date(),
          totalRequests: { increment: 1 }
        }
      });

      return client;
    } catch (error) {
      console.error(`❌ [OAuth] Error validando cliente ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Generar access token y refresh token
   * @param {Object} client - Cliente OAuth validado
   * @param {string[]} [scopes] - Scopes solicitados (se validan contra allowedScopes)
   * @returns {Promise<Object>} Tokens generados
   */
  async generateTokens(client, scopes = []) {
    // Filtrar scopes válidos (solo los que están en allowedScopes del cliente)
    const validScopes = scopes.filter(scope => client.allowedScopes.includes(scope));

    // Si no se especificaron scopes, usar todos los permitidos
    const finalScopes = validScopes.length > 0 ? validScopes : client.allowedScopes;

    // Payload del access token
    const accessTokenPayload = {
      clientId: client.id,
      tenantId: client.tenantId,
      scopes: finalScopes,
      type: 'access_token'
    };

    // Generar access token (JWT)
    const accessToken = jwt.sign(accessTokenPayload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'parse-api',
      audience: 'parse-public-api'
    });

    // Payload del refresh token
    const refreshTokenPayload = {
      clientId: client.id,
      tenantId: client.tenantId,
      type: 'refresh_token'
    };

    // Generar refresh token (JWT de larga duración)
    const refreshToken = jwt.sign(refreshTokenPayload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'parse-api',
      audience: 'parse-public-api'
    });

    // Calcular fechas de expiración
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hora
    const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000); // 7 días

    // Guardar tokens en la base de datos
    const tokenRecord = await prisma.oauth_tokens.create({
      data: {
        clientId: client.id,
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        scopes: finalScopes,
        expiresAt,
        refreshExpiresAt,
        revoked: false
      }
    });

    console.log(`✅ [OAuth] Tokens generados para cliente: ${client.clientId}`);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // segundos
      refresh_token: refreshToken,
      scope: finalScopes.join(' ')
    };
  }

  /**
   * Validar un access token
   * @param {string} token - Access token JWT
   * @returns {Promise<Object|null>} Payload del token si es válido, null si no
   */
  async validateToken(token) {
    try {
      // Verificar JWT
      const payload = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'parse-api',
        audience: 'parse-public-api'
      });

      if (payload.type !== 'access_token') {
        console.log('❌ [OAuth] Token no es un access_token');
        return null;
      }

      // Buscar token en BD (verificar si no fue revocado)
      const tokenRecord = await prisma.oauth_tokens.findUnique({
        where: { accessToken: token },
        include: {
          client: {
            include: {
              tenants: true
            }
          }
        }
      });

      if (!tokenRecord) {
        console.log('❌ [OAuth] Token no encontrado en BD');
        return null;
      }

      if (tokenRecord.revoked) {
        console.log('❌ [OAuth] Token revocado');
        return null;
      }

      if (new Date() > tokenRecord.expiresAt) {
        console.log('❌ [OAuth] Token expirado');
        return null;
      }

      if (!tokenRecord.client.activo) {
        console.log('❌ [OAuth] Cliente del token está inactivo');
        return null;
      }

      // Actualizar lastUsedAt
      await prisma.oauth_tokens.update({
        where: { id: tokenRecord.id },
        data: { lastUsedAt: new Date() }
      });

      return {
        ...payload,
        client: tokenRecord.client,
        tenant: tokenRecord.client.tenants
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log('❌ [OAuth] Token JWT expirado');
      } else if (error.name === 'JsonWebTokenError') {
        console.log('❌ [OAuth] Token JWT inválido:', error.message);
      } else {
        console.error('❌ [OAuth] Error validando token:', error);
      }
      return null;
    }
  }

  /**
   * Refrescar un access token usando refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object|null>} Nuevos tokens si es válido, null si no
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verificar refresh token JWT
      const payload = jwt.verify(refreshToken, this.JWT_SECRET, {
        issuer: 'parse-api',
        audience: 'parse-public-api'
      });

      if (payload.type !== 'refresh_token') {
        console.log('❌ [OAuth] Token no es un refresh_token');
        return null;
      }

      // Buscar token en BD
      const tokenRecord = await prisma.oauth_tokens.findUnique({
        where: { refreshToken },
        include: {
          client: true
        }
      });

      if (!tokenRecord) {
        console.log('❌ [OAuth] Refresh token no encontrado');
        return null;
      }

      if (tokenRecord.revoked) {
        console.log('❌ [OAuth] Refresh token revocado');
        return null;
      }

      if (new Date() > tokenRecord.refreshExpiresAt) {
        console.log('❌ [OAuth] Refresh token expirado');
        return null;
      }

      // Revocar tokens antiguos
      await prisma.oauth_tokens.update({
        where: { id: tokenRecord.id },
        data: { revoked: true, revokedAt: new Date() }
      });

      // Generar nuevos tokens con los mismos scopes
      const newTokens = await this.generateTokens(tokenRecord.client, tokenRecord.scopes);

      console.log(`✅ [OAuth] Access token refrescado para cliente: ${tokenRecord.client.clientId}`);

      return newTokens;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log('❌ [OAuth] Refresh token JWT expirado');
      } else {
        console.error('❌ [OAuth] Error refrescando token:', error);
      }
      return null;
    }
  }

  /**
   * Revocar un access token o refresh token
   * @param {string} token - Token a revocar
   * @returns {Promise<boolean>} true si se revocó, false si no
   */
  async revokeToken(token) {
    try {
      // Buscar por access token
      let tokenRecord = await prisma.oauth_tokens.findUnique({
        where: { accessToken: token }
      });

      // Si no es access token, buscar por refresh token
      if (!tokenRecord) {
        tokenRecord = await prisma.oauth_tokens.findUnique({
          where: { refreshToken: token }
        });
      }

      if (!tokenRecord) {
        console.log('❌ [OAuth] Token a revocar no encontrado');
        return false;
      }

      // Revocar token
      await prisma.oauth_tokens.update({
        where: { id: tokenRecord.id },
        data: {
          revoked: true,
          revokedAt: new Date()
        }
      });

      console.log(`✅ [OAuth] Token revocado exitosamente`);
      return true;
    } catch (error) {
      console.error('❌ [OAuth] Error revocando token:', error);
      return false;
    }
  }

  /**
   * Verificar si un cliente tiene un scope específico
   * @param {Object} tokenPayload - Payload del token validado
   * @param {string} requiredScope - Scope requerido
   * @returns {boolean} true si tiene el scope, false si no
   */
  hasScope(tokenPayload, requiredScope) {
    if (!tokenPayload || !tokenPayload.scopes) {
      return false;
    }
    return tokenPayload.scopes.includes(requiredScope);
  }

  /**
   * Listar todos los clientes de un tenant
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Array>} Lista de clientes
   */
  async listClients(tenantId) {
    return await prisma.oauth_clients.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clientId: true,
        nombre: true,
        descripcion: true,
        allowedScopes: true,
        activo: true,
        ultimoUso: true,
        totalRequests: true,
        customRateLimit: true,
        requestsPerMinute: true,
        requestsPerHour: true,
        requestsPerDay: true,
        createdAt: true,
        updatedAt: true
        // NO incluir clientSecret por seguridad
      }
    });
  }

  /**
   * Obtener detalles de un cliente
   * @param {string} clientId - Client ID
   * @param {string} tenantId - ID del tenant (para verificar pertenencia)
   * @returns {Promise<Object|null>} Cliente o null
   */
  async getClient(clientId, tenantId) {
    return await prisma.oauth_clients.findFirst({
      where: {
        clientId,
        tenantId
      },
      select: {
        id: true,
        clientId: true,
        nombre: true,
        descripcion: true,
        allowedScopes: true,
        activo: true,
        ultimoUso: true,
        totalRequests: true,
        customRateLimit: true,
        requestsPerMinute: true,
        requestsPerHour: true,
        requestsPerDay: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  /**
   * Actualizar un cliente
   * @param {string} clientId - Client ID
   * @param {string} tenantId - ID del tenant
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object|null>} Cliente actualizado o null
   */
  async updateClient(clientId, tenantId, data) {
    const client = await prisma.oauth_clients.findFirst({
      where: { clientId, tenantId }
    });

    if (!client) {
      return null;
    }

    return await prisma.oauth_clients.update({
      where: { id: client.id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      select: {
        id: true,
        clientId: true,
        nombre: true,
        descripcion: true,
        allowedScopes: true,
        activo: true,
        customRateLimit: true,
        requestsPerMinute: true,
        requestsPerHour: true,
        requestsPerDay: true,
        updatedAt: true
      }
    });
  }

  /**
   * Eliminar un cliente (y todos sus tokens)
   * @param {string} clientId - Client ID
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>} true si se eliminó, false si no
   */
  async deleteClient(clientId, tenantId) {
    const client = await prisma.oauth_clients.findFirst({
      where: { clientId, tenantId }
    });

    if (!client) {
      return false;
    }

    await prisma.oauth_clients.delete({
      where: { id: client.id }
      // Los tokens se eliminan en cascada automáticamente
    });

    console.log(`✅ [OAuth] Cliente eliminado: ${clientId}`);
    return true;
  }

  /**
   * Registrar log de API request
   * @param {Object} data - Datos del request
   * @returns {Promise<void>}
   */
  async logApiRequest(data) {
    const {
      clientId,
      tenantId,
      method,
      endpoint,
      ipAddress,
      userAgent,
      statusCode,
      responseTime,
      rateLimitHit = false,
      errorMessage = null
    } = data;

    try {
      await prisma.oauth_api_logs.create({
        data: {
          clientId,
          tenantId,
          method,
          endpoint,
          ipAddress,
          userAgent,
          statusCode,
          responseTime,
          rateLimitHit,
          errorMessage
        }
      });
    } catch (error) {
      // No bloqueamos la request si falla el log
      console.error('❌ [OAuth] Error registrando log de API:', error);
    }
  }

  /**
   * Obtener estadísticas de uso de un cliente
   * @param {string} clientId - Client ID
   * @param {number} [days=30] - Días hacia atrás
   * @returns {Promise<Object>} Estadísticas
   */
  async getClientStats(clientId, days = 30) {
    const client = await prisma.oauth_clients.findUnique({
      where: { clientId }
    });

    if (!client) {
      return null;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total de requests en el período
    const totalRequests = await prisma.oauth_api_logs.count({
      where: {
        clientId: client.id,
        timestamp: { gte: startDate }
      }
    });

    // Requests por status code
    const statusCodes = await prisma.oauth_api_logs.groupBy({
      by: ['statusCode'],
      where: {
        clientId: client.id,
        timestamp: { gte: startDate }
      },
      _count: {
        statusCode: true
      }
    });

    // Rate limit hits
    const rateLimitHits = await prisma.oauth_api_logs.count({
      where: {
        clientId: client.id,
        timestamp: { gte: startDate },
        rateLimitHit: true
      }
    });

    // Promedio de tiempo de respuesta
    const avgResponseTime = await prisma.oauth_api_logs.aggregate({
      where: {
        clientId: client.id,
        timestamp: { gte: startDate }
      },
      _avg: {
        responseTime: true
      }
    });

    return {
      clientId: client.clientId,
      nombre: client.nombre,
      period: { days, startDate, endDate: new Date() },
      totalRequests,
      rateLimitHits,
      avgResponseTime: avgResponseTime._avg.responseTime || 0,
      statusCodes: statusCodes.map(s => ({
        code: s.statusCode,
        count: s._count.statusCode
      }))
    };
  }
}

module.exports = new OAuthService();
