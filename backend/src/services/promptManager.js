const prisma = require('../lib/prisma');

/**
 * PromptManager - Gestor de prompts de IA con cache en memoria
 *
 * Características:
 * - Cache en memoria para performance
 * - Soporte multi-tenant (prompts globales y por tenant)
 * - Sistema de versiones
 * - Métricas de uso
 * - Reemplazo de variables en plantillas
 */
class PromptManager {
  constructor() {
    // Cache: { "clave:tenantId": promptData }
    this.cache = new Map();

    // TTL del cache (5 minutos por defecto)
    this.cacheTTL = parseInt(process.env.PROMPT_CACHE_TTL) || 5 * 60 * 1000;

    // Timestamp de última actualización del cache
    this.cacheTimestamps = new Map();
  }

  /**
   * Obtener un prompt por su clave
   * @param {string} clave - Clave del prompt (ej: "EXTRACCION_FACTURA")
   * @param {string|null} tenantId - ID del tenant (null para prompts globales)
   * @param {string|null} motor - Motor de IA específico (opcional)
   * @returns {Promise<Object|null>} Datos del prompt o null si no existe
   */
  async getPrompt(clave, tenantId = null, motor = null) {
    const cacheKey = `${clave}:${tenantId || 'global'}:${motor || 'any'}`;

    // Verificar cache
    if (this._isCacheValid(cacheKey)) {
      console.log(`📋 [PROMPT] Cache hit: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    console.log(`🔍 [PROMPT] Buscando en BD: ${cacheKey}`);

    // Buscar en base de datos con prioridad:
    // 1. Prompt específico del tenant y motor
    // 2. Prompt específico del tenant (cualquier motor)
    // 3. Prompt global con motor específico
    // 4. Prompt global (cualquier motor)

    const whereConditions = [
      // 1. Tenant + Motor específico
      tenantId && motor ? { clave, tenantId, motor, activo: true } : null,
      // 2. Tenant + Cualquier motor
      tenantId ? { clave, tenantId, motor: null, activo: true } : null,
      // 3. Global + Motor específico
      motor ? { clave, tenantId: null, motor, activo: true } : null,
      // 4. Global + Cualquier motor
      { clave, tenantId: null, motor: null, activo: true }
    ].filter(Boolean);

    let prompt = null;

    for (const where of whereConditions) {
      prompt = await prisma.ai_prompts.findFirst({
        where,
        orderBy: { version: 'desc' } // Usar la versión más reciente
      });

      if (prompt) {
        console.log(`✅ [PROMPT] Encontrado: ${JSON.stringify(where)}`);
        break;
      }
    }

    if (!prompt) {
      console.log(`❌ [PROMPT] No encontrado: ${clave}`);
      return null;
    }

    // Guardar en cache
    this._setCache(cacheKey, prompt);

    return prompt;
  }

  /**
   * Obtener el texto del prompt con variables reemplazadas
   * @param {string} clave - Clave del prompt
   * @param {Object} variables - Variables para reemplazar {variable: valor}
   * @param {string|null} tenantId - ID del tenant
   * @param {string|null} motor - Motor de IA
   * @returns {Promise<string|null>} Texto del prompt procesado
   */
  async getPromptText(clave, variables = {}, tenantId = null, motor = null) {
    const promptData = await this.getPrompt(clave, tenantId, motor);

    if (!promptData) {
      return null;
    }

    // Reemplazar variables en el prompt
    let promptText = promptData.prompt;

    // Formato de variables: {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      promptText = promptText.replace(new RegExp(placeholder, 'g'), value);
    }

    // Actualizar métricas de uso (async, no esperamos)
    this._updateUsageMetrics(promptData.id).catch(err => {
      console.error('Error actualizando métricas:', err);
    });

    return promptText;
  }

  /**
   * Crear o actualizar un prompt
   * @param {Object} data - Datos del prompt
   * @returns {Promise<Object>} Prompt creado/actualizado
   */
  async upsertPrompt(data) {
    const { clave, tenantId, ...promptData } = data;
    const normalizedTenantId = tenantId || null;

    // Buscar si el prompt ya existe
    const existing = await prisma.ai_prompts.findFirst({
      where: {
        clave,
        tenantId: normalizedTenantId
      }
    });

    let prompt;

    if (existing) {
      // Actualizar el prompt existente
      prompt = await prisma.ai_prompts.update({
        where: { id: existing.id },
        data: {
          ...promptData,
          version: { increment: 1 },
          updatedAt: new Date()
        }
      });
    } else {
      // Crear nuevo prompt
      prompt = await prisma.ai_prompts.create({
        data: {
          clave,
          tenantId: normalizedTenantId,
          ...promptData
        }
      });
    }

    // Invalidar cache
    this._invalidateCache(clave, normalizedTenantId);

    console.log(`💾 [PROMPT] Guardado: ${clave} (tenant: ${normalizedTenantId || 'global'})`);

    return prompt;
  }

  /**
   * Registrar resultado de uso del prompt (éxito/fallo)
   * @param {string} clave - Clave del prompt
   * @param {boolean} exitoso - Si la ejecución fue exitosa
   * @param {string|null} tenantId - ID del tenant
   * @param {string|null} motor - Motor de IA usado (opcional)
   */
  async registrarResultado(clave, exitoso, tenantId = null, motor = null) {
    console.log(`📊 [PROMPT STATS] Registrando resultado para: ${clave} (tenant: ${tenantId || 'global'}, motor: ${motor || 'any'}) - Exitoso: ${exitoso}`);

    const promptData = await this.getPrompt(clave, tenantId, motor);

    if (!promptData) {
      console.log(`⚠️ [PROMPT STATS] No se encontró prompt: ${clave}`);
      return;
    }

    console.log(`📋 [PROMPT STATS] Prompt encontrado: ID=${promptData.id}, vecesUsado actual=${promptData.vecesUsado}`);

    // Calcular nueva tasa de éxito
    const vecesUsado = promptData.vecesUsado || 0;
    let tasaExitoActual = parseFloat(promptData.tasaExito || 0);

    // 🔧 CORRECCIÓN: Limpiar valores corruptos (tasaExito debe estar entre 0-100)
    if (tasaExitoActual > 100 || tasaExitoActual < 0 || isNaN(tasaExitoActual)) {
      console.log(`⚠️ [PROMPT STATS] Tasa de éxito corrupta detectada: ${tasaExitoActual}% - Normalizando...`);
      tasaExitoActual = Math.max(0, Math.min(100, tasaExitoActual));

      // Si está fuera de rango, usar heurística: si vecesUsado > 0, asumir 100% (fue usado con éxito)
      if (promptData.tasaExito > 100) {
        tasaExitoActual = vecesUsado > 0 ? 100 : 0;
      }
    }

    const nuevaTasaExito = vecesUsado === 0
      ? (exitoso ? 100 : 0)
      : ((tasaExitoActual * vecesUsado) + (exitoso ? 100 : 0)) / (vecesUsado + 1);

    // 🔒 VALIDACIÓN: Asegurar que la tasa de éxito esté entre 0-100
    const tasaExitoFinal = Math.max(0, Math.min(100, nuevaTasaExito));

    console.log(`🔢 [PROMPT STATS] Actualizando: vecesUsado ${vecesUsado} -> ${vecesUsado + 1}, tasaExito: ${tasaExitoActual.toFixed(2)}% -> ${tasaExitoFinal.toFixed(2)}%`);

    await prisma.ai_prompts.update({
      where: { id: promptData.id },
      data: {
        tasaExito: tasaExitoFinal,
        vecesUsado: { increment: 1 },
        ultimoUso: new Date()
      }
    });

    console.log(`✅ [PROMPT STATS] Estadísticas actualizadas correctamente para ${clave}`);

    // Invalidar cache para reflejar métricas actualizadas
    this._invalidateCache(clave, tenantId);
  }

  /**
   * Listar todos los prompts (para admin)
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>} Lista de prompts
   */
  async listPrompts(filters = {}) {
    const where = {};

    if (filters.tenantId !== undefined) {
      where.tenantId = filters.tenantId;
    }

    if (filters.motor) {
      where.motor = filters.motor;
    }

    if (filters.activo !== undefined) {
      where.activo = filters.activo;
    }

    if (filters.clave) {
      where.clave = { contains: filters.clave, mode: 'insensitive' };
    }

    return await prisma.ai_prompts.findMany({
      where,
      orderBy: [
        { clave: 'asc' },
        { version: 'desc' }
      ]
    });
  }

  /**
   * Eliminar un prompt
   * @param {string} id - ID del prompt
   */
  async deletePrompt(id) {
    const prompt = await prisma.ai_prompts.findUnique({
      where: { id }
    });

    if (!prompt) {
      throw new Error('Prompt no encontrado');
    }

    await prisma.ai_prompts.delete({
      where: { id }
    });

    // Invalidar cache
    this._invalidateCache(prompt.clave, prompt.tenantId);

    console.log(`🗑️ [PROMPT] Eliminado: ${prompt.clave}`);
  }

  /**
   * Limpiar todo el cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    console.log('🧹 [PROMPT] Cache limpiado');
  }

  /**
   * Obtener estadísticas del cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttl: this.cacheTTL
    };
  }

  // ========== MÉTODOS PRIVADOS ==========

  /**
   * Verificar si el cache es válido
   */
  _isCacheValid(cacheKey) {
    if (!this.cache.has(cacheKey)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) {
      return false;
    }

    const age = Date.now() - timestamp;
    return age < this.cacheTTL;
  }

  /**
   * Guardar en cache
   */
  _setCache(cacheKey, data) {
    this.cache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /**
   * Invalidar cache para una clave específica
   */
  _invalidateCache(clave, tenantId) {
    // Eliminar todas las variantes de cache para esta clave
    const pattern = `${clave}:${tenantId || 'global'}`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }

    console.log(`♻️ [PROMPT] Cache invalidado: ${pattern}`);
  }

  /**
   * Actualizar métricas de uso
   */
  async _updateUsageMetrics(promptId) {
    await prisma.ai_prompts.update({
      where: { id: promptId },
      data: {
        vecesUsado: { increment: 1 },
        ultimoUso: new Date()
      }
    });
  }
}

// Exportar instancia singleton
module.exports = new PromptManager();
