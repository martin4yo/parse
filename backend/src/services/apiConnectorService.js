/**
 * API Connector Service - Base Service
 *
 * Servicio base para conectores API que maneja:
 * - Autenticación (API Key, Bearer Token, OAuth 2.0, Basic Auth, Custom Headers)
 * - HTTP client con retry logic
 * - Rate limiting (token bucket algorithm)
 * - Error handling y logging
 * - Utilities para mapeo de datos
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ApiConnectorService {
  constructor(configId) {
    this.configId = configId;
    this.config = null;
    this.rateLimiter = null;
    this.oauthToken = null;
    this.oauthTokenExpiry = null;
  }

  /**
   * Inicializa el servicio cargando la configuración desde la BD
   */
  async initialize() {
    this.config = await prisma.api_connector_configs.findUnique({
      where: { id: this.configId },
      include: { tenants: true }
    });

    if (!this.config) {
      throw new Error(`Configuración de conector no encontrada: ${this.configId}`);
    }

    if (!this.config.activo) {
      throw new Error(`Conector desactivado: ${this.config.nombre}`);
    }

    // Inicializar rate limiter según el plan del tenant
    await this.initializeRateLimiter();

    console.log(`✅ ApiConnectorService inicializado: ${this.config.nombre} (${this.config.direction})`);
  }

  /**
   * Inicializa el rate limiter basado en el plan del tenant
   */
  async initializeRateLimiter() {
    const tenant = this.config.tenants;

    // Por defecto: 10 requests/min (plan básico)
    let requestsPerMinute = 10;

    // TODO: Obtener límite del plan del tenant cuando esté implementado
    // if (tenant.plan === 'premium') requestsPerMinute = 60;
    // if (tenant.plan === 'enterprise') requestsPerMinute = 300;

    this.rateLimiter = {
      tokens: requestsPerMinute,
      maxTokens: requestsPerMinute,
      refillRate: requestsPerMinute / 60, // tokens por segundo
      lastRefill: Date.now()
    };

    console.log(`🚦 Rate limiter configurado: ${requestsPerMinute} req/min`);
  }

  /**
   * Verifica y consume un token del rate limiter
   * @returns {Promise<boolean>} true si puede continuar, false si debe esperar
   */
  async checkRateLimit() {
    const now = Date.now();
    const timePassed = (now - this.rateLimiter.lastRefill) / 1000;

    // Rellenar tokens según el tiempo transcurrido
    this.rateLimiter.tokens = Math.min(
      this.rateLimiter.maxTokens,
      this.rateLimiter.tokens + (timePassed * this.rateLimiter.refillRate)
    );
    this.rateLimiter.lastRefill = now;

    if (this.rateLimiter.tokens < 1) {
      const waitTime = Math.ceil((1 - this.rateLimiter.tokens) / this.rateLimiter.refillRate);
      console.log(`⏳ Rate limit alcanzado, esperando ${waitTime}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return this.checkRateLimit(); // Reintentar después de esperar
    }

    this.rateLimiter.tokens -= 1;
    return true;
  }

  /**
   * Obtiene los headers de autenticación según el tipo configurado
   * @returns {Promise<Object>} Headers de autenticación
   */
  async getAuthHeaders() {
    const { authType, authConfig } = this.config;
    const headers = {};

    switch (authType) {
      case 'API_KEY':
        // API Key en header o query param
        if (authConfig.location === 'header') {
          headers[authConfig.headerName || 'X-API-Key'] = authConfig.apiKey;
        }
        // Si es query param, se manejará en makeRequest
        break;

      case 'BEARER_TOKEN':
        headers['Authorization'] = `Bearer ${authConfig.token}`;
        break;

      case 'OAUTH2_CLIENT_CREDENTIALS':
        // Obtener o refrescar token OAuth
        const token = await this.getOAuthToken();
        headers['Authorization'] = `Bearer ${token}`;
        break;

      case 'BASIC_AUTH':
        const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;

      case 'CUSTOM_HEADERS':
        // Agregar headers personalizados
        Object.assign(headers, authConfig.headers || {});
        break;

      case 'NONE':
        // Sin autenticación
        break;

      default:
        throw new Error(`Tipo de autenticación no soportado: ${authType}`);
    }

    return headers;
  }

  /**
   * Obtiene o refresca el token OAuth 2.0
   * @returns {Promise<string>} Access token
   */
  async getOAuthToken() {
    const { authConfig } = this.config;

    // Si tenemos un token válido, usarlo
    if (this.oauthToken && this.oauthTokenExpiry && Date.now() < this.oauthTokenExpiry) {
      return this.oauthToken;
    }

    console.log('🔑 Obteniendo nuevo token OAuth 2.0...');

    try {
      const response = await axios.post(authConfig.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: authConfig.clientId,
          client_secret: authConfig.clientSecret,
          scope: authConfig.scope || ''
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.oauthToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.oauthTokenExpiry = Date.now() + (expiresIn * 1000) - 60000; // 1 minuto antes de expirar

      console.log(`✅ Token OAuth obtenido, expira en ${expiresIn}s`);
      return this.oauthToken;

    } catch (error) {
      console.error('❌ Error obteniendo token OAuth:', error.response?.data || error.message);
      throw new Error('No se pudo obtener token OAuth 2.0');
    }
  }

  /**
   * Realiza un HTTP request con autenticación, retry y rate limiting
   * @param {Object} options - Opciones del request
   * @returns {Promise<Object>} Respuesta del API
   */
  async makeRequest(options) {
    await this.checkRateLimit();

    const {
      method = 'GET',
      endpoint,
      data = null,
      queryParams = {},
      headers = {},
      maxRetries = 3,
      retryDelay = 1000
    } = options;

    // Construir URL completa
    let url = `${this.config.baseUrl}${endpoint}`;

    // Agregar API key como query param si aplica
    if (this.config.authType === 'API_KEY' && this.config.authConfig.location === 'query') {
      queryParams[this.config.authConfig.paramName || 'apiKey'] = this.config.authConfig.apiKey;
    }

    // Agregar query params
    if (Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams).toString();
      url += `?${params}`;
    }

    // Obtener headers de autenticación
    const authHeaders = await this.getAuthHeaders();
    const finalHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...authHeaders,
      ...headers
    };

    // Configurar request
    const requestConfig = {
      method,
      url,
      headers: finalHeaders,
      timeout: 30000 // 30 segundos
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestConfig.data = data;
    }

    // Retry logic con exponential backoff
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 ${method} ${endpoint} (intento ${attempt}/${maxRetries})`);
        const response = await axios(requestConfig);
        console.log(`✅ ${method} ${endpoint} - Status: ${response.status}`);
        return response.data;

      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        // No reintentar en errores 4xx (excepto 429 - Too Many Requests)
        if (status && status >= 400 && status < 500 && status !== 429) {
          console.error(`❌ Error ${status} en ${method} ${endpoint}:`, error.response?.data);
          throw this.formatError(error);
        }

        // Reintentar en errores 5xx o network errors
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Reintentando en ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Si llegamos aquí, se agotaron los reintentos
    console.error(`❌ Falló después de ${maxRetries} intentos:`, lastError.message);
    throw this.formatError(lastError);
  }

  /**
   * Formatea un error de axios en un formato estándar
   * @param {Error} error - Error de axios
   * @returns {Error} Error formateado
   */
  formatError(error) {
    if (error.response) {
      return new Error(
        `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      return new Error('No se recibió respuesta del servidor');
    } else {
      return new Error(`Error de configuración: ${error.message}`);
    }
  }

  /**
   * Obtiene un valor anidado de un objeto usando dot notation
   * @param {Object} obj - Objeto fuente
   * @param {string} path - Ruta en formato "campo.subcampo.valor"
   * @returns {*} Valor encontrado o undefined
   */
  getNestedValue(obj, path) {
    if (!path || !obj) return undefined;

    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      if (result === null || result === undefined) return undefined;
      result = result[key];
    }

    return result;
  }

  /**
   * Establece un valor anidado en un objeto usando dot notation
   * @param {Object} obj - Objeto destino
   * @param {string} path - Ruta en formato "campo.subcampo.valor"
   * @param {*} value - Valor a establecer
   */
  setNestedValue(obj, path, value) {
    if (!path || !obj) return;

    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }

  /**
   * Aplica un field mapping a un objeto de datos
   * @param {Object} sourceData - Datos originales
   * @param {Array} fieldMapping - Array de mapeos {sourceField, targetField, transform}
   * @returns {Object} Datos transformados
   */
  applyFieldMapping(sourceData, fieldMapping) {
    const result = {};

    if (!fieldMapping || fieldMapping.length === 0) {
      return sourceData; // Sin mapeo, retornar datos originales
    }

    for (const mapping of fieldMapping) {
      const { sourceField, targetField, transform, defaultValue } = mapping;

      // Obtener valor del campo fuente
      let value = this.getNestedValue(sourceData, sourceField);

      // Aplicar valor por defecto si no existe
      if (value === undefined || value === null) {
        value = defaultValue;
      }

      // Aplicar transformaciones si existen
      if (transform && value !== undefined && value !== null) {
        try {
          value = this.applyTransform(value, transform);
        } catch (error) {
          console.error(`⚠️ Error aplicando transformación a ${sourceField}:`, error.message);
        }
      }

      // Establecer valor en campo destino
      if (value !== undefined) {
        this.setNestedValue(result, targetField, value);
      }
    }

    return result;
  }

  /**
   * Aplica una transformación a un valor
   * @param {*} value - Valor original
   * @param {Object} transform - Objeto de transformación {type, params}
   * @returns {*} Valor transformado
   */
  applyTransform(value, transform) {
    const { type, params = {} } = transform;

    switch (type) {
      case 'DATE_FORMAT':
        // Convertir fecha entre formatos
        return this.transformDate(value, params.from || 'ISO', params.to || 'DD/MM/YYYY');

      case 'UPPERCASE':
        return String(value).toUpperCase();

      case 'LOWERCASE':
        return String(value).toLowerCase();

      case 'TRIM':
        return String(value).trim();

      case 'REPLACE':
        return String(value).replace(new RegExp(params.search, 'g'), params.replace);

      case 'NUMBER':
        const num = parseFloat(value);
        return isNaN(num) ? params.default || 0 : num;

      case 'BOOLEAN':
        return Boolean(value);

      case 'CONCAT':
        return params.fields.map(f => this.getNestedValue(value, f)).join(params.separator || '');

      case 'MAPPING':
        // Mapeo de valores (ej: estado "A" → "ACTIVO")
        return params.map[value] || params.default || value;

      case 'CUSTOM':
        // Evaluar expresión JavaScript personalizada (CUIDADO: usar solo con datos confiables)
        // eslint-disable-next-line no-new-func
        const fn = new Function('value', 'params', params.expression);
        return fn(value, params);

      default:
        console.warn(`⚠️ Tipo de transformación no soportado: ${type}`);
        return value;
    }
  }

  /**
   * Transforma una fecha entre formatos
   * @param {string} dateStr - Fecha en formato original
   * @param {string} fromFormat - Formato original
   * @param {string} toFormat - Formato destino
   * @returns {string} Fecha transformada
   */
  transformDate(dateStr, fromFormat, toFormat) {
    // Parsear fecha según formato origen
    let date;

    if (fromFormat === 'ISO') {
      date = new Date(dateStr);
    } else if (fromFormat === 'DD/MM/YYYY') {
      const [day, month, year] = dateStr.split('/');
      date = new Date(year, month - 1, day);
    } else if (fromFormat === 'MM/DD/YYYY') {
      const [month, day, year] = dateStr.split('/');
      date = new Date(year, month - 1, day);
    } else if (fromFormat === 'YYYYMMDD') {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
      throw new Error(`Fecha inválida: ${dateStr}`);
    }

    // Formatear según formato destino
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (toFormat === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    } else if (toFormat === 'MM/DD/YYYY') {
      return `${month}/${day}/${year}`;
    } else if (toFormat === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    } else if (toFormat === 'YYYYMMDD') {
      return `${year}${month}${day}`;
    } else if (toFormat === 'ISO') {
      return date.toISOString();
    }

    return dateStr;
  }

  /**
   * Valida los datos según reglas de validación configuradas
   * @param {Object} data - Datos a validar
   * @returns {Object} { isValid: boolean, errors: Array }
   */
  validateData(data) {
    const errors = [];
    const { validationRules } = this.config;

    if (!validationRules || validationRules.length === 0) {
      return { isValid: true, errors: [] };
    }

    for (const rule of validationRules) {
      const { field, type, params = {}, errorMessage } = rule;
      const value = this.getNestedValue(data, field);

      let isValid = true;

      switch (type) {
        case 'REQUIRED':
          isValid = value !== undefined && value !== null && value !== '';
          break;

        case 'MIN_LENGTH':
          isValid = String(value || '').length >= params.min;
          break;

        case 'MAX_LENGTH':
          isValid = String(value || '').length <= params.max;
          break;

        case 'REGEX':
          isValid = new RegExp(params.pattern).test(String(value || ''));
          break;

        case 'MIN_VALUE':
          isValid = Number(value) >= params.min;
          break;

        case 'MAX_VALUE':
          isValid = Number(value) <= params.max;
          break;

        case 'IN_LIST':
          isValid = params.values.includes(value);
          break;

        case 'CUSTOM':
          // Evaluar expresión JavaScript personalizada
          // eslint-disable-next-line no-new-func
          const fn = new Function('value', 'data', params.expression);
          isValid = fn(value, data);
          break;

        default:
          console.warn(`⚠️ Tipo de validación no soportado: ${type}`);
      }

      if (!isValid) {
        errors.push({
          field,
          type,
          message: errorMessage || `Validación falló para campo ${field}`
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Actualiza el estado del último sync (PULL o PUSH)
   * @param {string} direction - 'PULL' o 'PUSH'
   * @param {string} status - Estado del sync ('SUCCESS', 'FAILED', 'PARTIAL')
   */
  async updateLastSync(direction, status) {
    const updateData = {};

    if (direction === 'PULL') {
      updateData.lastPullSync = new Date();
      updateData.lastPullStatus = status;
    } else if (direction === 'PUSH') {
      updateData.lastPushSync = new Date();
      updateData.lastPushStatus = status;
    }

    await prisma.api_connector_configs.update({
      where: { id: this.configId },
      data: updateData
    });

    console.log(`📊 Actualizado estado ${direction}: ${status}`);
  }
}

module.exports = ApiConnectorService;
