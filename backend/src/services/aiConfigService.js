const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const featureService = require('./featureService');

const prisma = new PrismaClient();

/**
 * AIConfigService
 *
 * Servicio para gestionar configuraciones de IA de forma híbrida:
 * - Configuración global desde .env
 * - Configuración personalizada por tenant (cifrada en BD)
 *
 * Cascada de resolución: Custom tenant → Global (.env) → Error
 */
class AIConfigService {

  constructor() {
    // Verificar que exista ENCRYPTION_KEY
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('⚠️  ENCRYPTION_KEY no configurada. Genera una con: openssl rand -hex 32');
    }
  }

  /**
   * Obtiene la API key para un tenant y proveedor
   * Cascada: Custom tenant → Global (.env) → Error
   *
   * @param {string} provider - "gemini" | "anthropic" | "openai" | "google-document-ai"
   * @param {string|null} tenantId - ID del tenant (null = usar global)
   * @returns {Promise<string>} - API key
   */
  async getApiKey(provider, tenantId = null) {
    try {
      // 1. Intentar configuración custom del tenant
      if (tenantId) {
        const tenantConfig = await prisma.ai_provider_configs.findUnique({
          where: {
            tenantId_provider: { tenantId, provider }
          }
        });

        if (tenantConfig?.apiKeyEncrypted && tenantConfig.activo) {
          console.log(`🔑 Usando API key custom del tenant ${tenantId} para ${provider}`);
          return this.decrypt(tenantConfig.apiKeyEncrypted);
        }
      }

      // 2. Fallback a configuración global (.env)
      const envKey = this.getEnvKeyForProvider(provider);
      if (envKey) {
        console.log(`🔑 Usando API key global (.env) para ${provider}`);
        return envKey;
      }

      // 3. No hay configuración disponible
      throw new Error(`No hay API key configurada para ${provider}`);

    } catch (error) {
      console.error(`❌ Error obteniendo API key para ${provider}:`, error.message);
      throw error;
    }
  }

  /**
   * Obtiene configuración completa de un proveedor
   *
   * @param {string} provider - Proveedor de IA
   * @param {string|null} tenantId - ID del tenant
   * @returns {Promise<Object>} - Config completa { apiKey, modelo, maxRequestsPerDay, config }
   */
  async getProviderConfig(provider, tenantId = null) {
    try {
      const apiKey = await this.getApiKey(provider, tenantId);

      // Obtener configuración específica del tenant si existe
      const tenantConfig = tenantId ? await prisma.ai_provider_configs.findUnique({
        where: { tenantId_provider: { tenantId, provider } }
      }) : null;

      return {
        apiKey,
        modelo: tenantConfig?.modelo || this.getDefaultModel(provider),
        maxRequestsPerDay: tenantConfig?.maxRequestsPerDay || 1000,
        config: tenantConfig?.config || {}
      };

    } catch (error) {
      console.error(`❌ Error obteniendo config de ${provider}:`, error.message);
      throw error;
    }
  }

  /**
   * Permite a un tenant configurar su propia API key (feature premium)
   *
   * @param {string} tenantId - ID del tenant
   * @param {string} provider - Proveedor de IA
   * @param {string} apiKey - API key del tenant
   * @param {Object} config - Configuración adicional
   * @returns {Promise<Object>} - Config creada/actualizada
   */
  async setCustomApiKey(tenantId, provider, apiKey, config = {}) {
    try {
      // Verificar que el tenant tiene el feature habilitado
      const hasFeature = await featureService.isEnabled(tenantId, 'AI_CUSTOM_API_KEYS');

      if (!hasFeature) {
        throw new Error('El plan del tenant no permite configurar API keys personalizadas');
      }

      // Validar que la API key no esté vacía
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('La API key no puede estar vacía');
      }

      // Cifrar la API key
      const encrypted = this.encrypt(apiKey);

      // Guardar en BD
      const saved = await prisma.ai_provider_configs.upsert({
        where: {
          tenantId_provider: { tenantId, provider }
        },
        create: {
          id: uuidv4(),
          tenantId,
          provider,
          apiKeyEncrypted: encrypted,
          modelo: config.modelo,
          maxRequestsPerDay: config.maxRequestsPerDay,
          config: config.additionalConfig || {},
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        update: {
          apiKeyEncrypted: encrypted,
          modelo: config.modelo,
          maxRequestsPerDay: config.maxRequestsPerDay,
          config: config.additionalConfig || {},
          activo: true,
          updatedAt: new Date()
        }
      });

      console.log(`✅ API key custom configurada para tenant ${tenantId} - ${provider}`);

      return {
        id: saved.id,
        provider: saved.provider,
        modelo: saved.modelo,
        success: true
      };

    } catch (error) {
      console.error(`❌ Error configurando API key custom:`, error.message);
      throw error;
    }
  }

  /**
   * Elimina la configuración personalizada de un tenant
   *
   * @param {string} tenantId - ID del tenant
   * @param {string} provider - Proveedor de IA
   * @returns {Promise<boolean>}
   */
  async removeCustomApiKey(tenantId, provider) {
    try {
      await prisma.ai_provider_configs.delete({
        where: {
          tenantId_provider: { tenantId, provider }
        }
      });

      console.log(`✅ API key custom eliminada para tenant ${tenantId} - ${provider}`);
      return true;

    } catch (error) {
      if (error.code === 'P2025') {
        // No existe, no es un error
        return true;
      }
      console.error(`❌ Error eliminando API key custom:`, error.message);
      throw error;
    }
  }

  /**
   * Obtiene todas las configuraciones personalizadas de un tenant
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Array>}
   */
  async getTenantConfigs(tenantId) {
    try {
      const configs = await prisma.ai_provider_configs.findMany({
        where: { tenantId },
        select: {
          id: true,
          provider: true,
          modelo: true,
          maxRequestsPerDay: true,
          config: true,
          activo: true,
          createdAt: true,
          updatedAt: true
          // NO devolver apiKeyEncrypted por seguridad
        }
      });

      return configs;

    } catch (error) {
      console.error(`❌ Error obteniendo configs del tenant:`, error.message);
      return [];
    }
  }

  /**
   * Cifrado AES-256-GCM
   *
   * @param {string} text - Texto a cifrar
   * @returns {string} - Texto cifrado en formato: iv:authTag:encrypted
   */
  encrypt(text) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY no configurada');
    }

    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Retornar: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Descifrado AES-256-GCM
   *
   * @param {string} encryptedText - Texto cifrado en formato: iv:authTag:encrypted
   * @returns {string} - Texto descifrado
   */
  decrypt(encryptedText) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY no configurada');
    }

    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Mapeo de providers a variables de entorno
   *
   * @param {string} provider
   * @returns {string|undefined}
   */
  getEnvKeyForProvider(provider) {
    const mapping = {
      'gemini': process.env.GEMINI_API_KEY,
      'anthropic': process.env.ANTHROPIC_API_KEY,
      'openai': process.env.OPENAI_API_KEY,
      'google-document-ai': process.env.GOOGLE_APPLICATION_CREDENTIALS
    };

    return mapping[provider];
  }

  /**
   * Modelos por defecto según provider
   *
   * @param {string} provider
   * @returns {string}
   */
  getDefaultModel(provider) {
    const defaults = {
      'gemini': 'gemini-1.5-flash-latest',
      'anthropic': 'claude-3-7-sonnet-20250219', // Claude Sonnet con visión
      'openai': 'gpt-4o'
    };

    return defaults[provider] || 'default';
  }

  /**
   * Test de conexión con una API
   *
   * @param {string} provider
   * @param {string|null} tenantId
   * @returns {Promise<boolean>}
   */
  async testConnection(provider, tenantId = null) {
    try {
      const apiKey = await this.getApiKey(provider, tenantId);

      // Aquí se puede implementar un test real según el provider
      // Por ahora solo verificamos que la key exista y tenga formato válido

      if (!apiKey || apiKey.length < 10) {
        return false;
      }

      console.log(`✅ Test de conexión OK para ${provider}`);
      return true;

    } catch (error) {
      console.error(`❌ Test de conexión FAILED para ${provider}:`, error.message);
      return false;
    }
  }
}

module.exports = new AIConfigService();
