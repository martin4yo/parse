const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const featureService = require('./featureService');
const aiConfigService = require('./aiConfigService');
const classifierService = require('./classifierService');
const promptManager = require('./promptManager');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Document Extraction Orchestrator
 *
 * Orquesta el proceso completo de extracción de datos de documentos.
 * Decide entre pipeline de 2 pasos o extracción simple según el plan del tenant.
 */
class DocumentExtractionOrchestrator {

  /**
   * Punto de entrada principal para extracción
   *
   * @param {string} documentText - Texto extraído del documento
   * @param {string} tenantId - ID del tenant
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} - Resultado de la extracción
   */
  async extractData(documentText, tenantId, userId) {
    try {
      console.log('\n🎯 ===== INICIANDO EXTRACCIÓN DE DOCUMENTO =====');
      console.log(`👤 Tenant: ${tenantId}`);
      console.log(`📄 Longitud de texto: ${documentText.length} caracteres`);

      // 1. Verificar qué tipo de extracción usar
      const hasPipeline = await featureService.canUsePipeline(tenantId);

      console.log(`🔍 Tipo de extracción: ${hasPipeline ? 'PIPELINE (2 pasos)' : 'SIMPLE (1 paso)'}`);

      let resultado;
      if (hasPipeline) {
        resultado = await this.extractWithPipeline(documentText, tenantId);
      } else {
        resultado = await this.extractWithSimplePrompt(documentText, tenantId);
      }

      console.log('✅ ===== EXTRACCIÓN COMPLETADA =====\n');

      return resultado;

    } catch (error) {
      console.error('❌ Error en orquestador de extracción:', error.message);
      throw error;
    }
  }

  /**
   * Extracción con pipeline de 2 pasos
   * Paso 1: Clasificar documento
   * Paso 2: Extraer con prompt especializado
   *
   * @param {string} documentText
   * @param {string} tenantId
   * @returns {Promise<Object>}
   */
  async extractWithPipeline(documentText, tenantId) {
    console.log('\n📊 ===== EXTRACCIÓN CON PIPELINE =====');

    try {
      // PASO 1: Clasificar documento
      console.log('\n┌─────────────────────────────────────────┐');
      console.log('│  PASO 1: CLASIFICACIÓN DE DOCUMENTO    │');
      console.log('└─────────────────────────────────────────┘');
      const clasificacion = await classifierService.classify(documentText, tenantId);
      console.log(`📋 Tipo detectado: ${clasificacion.tipoDocumento}`);
      console.log(`📊 Confianza: ${(clasificacion.confianza * 100).toFixed(1)}%`);
      console.log(`🤖 Motor usado: ${clasificacion.motorUsado || 'N/A'}`);
      console.log(`✅ Clasificación completada\n`);

      // PASO 2: Extraer con prompt especializado
      console.log('┌─────────────────────────────────────────┐');
      console.log('│  PASO 2: EXTRACCIÓN DE DATOS           │');
      console.log('└─────────────────────────────────────────┘');
      const promptKey = this.getPromptKeyForType(clasificacion.tipoDocumento);
      console.log(`📝 Prompt seleccionado: ${promptKey}`);

      const datos = await this.extractWithSpecializedPrompt(
        documentText,
        promptKey,
        tenantId
      );

      return {
        metodo: 'PIPELINE',
        clasificacion,
        datos,
        promptUtilizado: promptKey,
        success: true
      };

    } catch (error) {
      console.error('❌ Error en pipeline:', error.message);
      // Fallback a extracción simple
      console.log('⚠️  Fallback a extracción simple...');
      return await this.extractWithSimplePrompt(documentText, tenantId);
    }
  }

  /**
   * Extracción simple con 1 prompt universal
   *
   * @param {string} documentText
   * @param {string} tenantId
   * @returns {Promise<Object>}
   */
  async extractWithSimplePrompt(documentText, tenantId) {
    console.log('\n📄 ===== EXTRACCIÓN SIMPLE =====');

    try {
      const datos = await this.extractWithSpecializedPrompt(
        documentText,
        'EXTRACCION_UNIVERSAL',
        tenantId
      );

      return {
        metodo: 'SIMPLE',
        datos,
        promptUtilizado: 'EXTRACCION_UNIVERSAL',
        success: true
      };

    } catch (error) {
      console.error('❌ Error en extracción simple:', error.message);
      throw error;
    }
  }

  /**
   * Extrae datos con un prompt especializado
   *
   * @param {string} documentText
   * @param {string} promptKey
   * @param {string} tenantId
   * @returns {Promise<Object>}
   */
  async extractWithSpecializedPrompt(documentText, promptKey, tenantId) {
    try {
      // Obtener el prompt desde la BD
      const prompt = await this.getPrompt(promptKey, tenantId);

      if (!prompt) {
        throw new Error(`Prompt no encontrado: ${promptKey}`);
      }

      const motor = prompt.motor;
      console.log(`🤖 Motor de IA: ${motor}`);

      // Obtener configuración de IA
      const config = await aiConfigService.getProviderConfig(motor, tenantId);
      console.log(`📦 Modelo: ${config.modelo}`);
      console.log(`🔑 API Key: ${config.apiKey ? '✓ Configurada' : '✗ No configurada'}`);

      // Reemplazar variables en el prompt
      const fullPrompt = prompt.prompt.replace('{{DOCUMENT_TEXT}}', documentText);
      console.log(`📝 Prompt construido (${fullPrompt.length} caracteres)`);

      console.log(`\n⏳ Llamando a ${motor}...`);

      // Extraer según el motor
      let response;
      if (motor === 'gemini') {
        response = await this.extractWithGemini(fullPrompt, config);
      } else if (motor === 'anthropic') {
        response = await this.extractWithClaude(fullPrompt, config);
      } else {
        throw new Error(`Motor de IA no soportado: ${motor}`);
      }

      // Parsear respuesta
      const datos = this.parseResponse(response);

      console.log('✅ Extracción completada');
      console.log(`📊 Campos extraídos: ${Object.keys(datos).length}`);

      // Mostrar resumen de datos extraídos
      if (datos.importe) console.log(`   💰 Importe: $${datos.importe}`);
      if (datos.fecha) console.log(`   📅 Fecha: ${datos.fecha}`);
      if (datos.numeroComprobante) console.log(`   🔢 Comprobante: ${datos.numeroComprobante}`);
      if (datos.cuit) console.log(`   🏢 CUIT: ${datos.cuit}`);
      if (datos.lineItems && datos.lineItems.length > 0) {
        console.log(`   📋 Items: ${datos.lineItems.length}`);
      }

      // Registrar uso exitoso del prompt
      await promptManager.registrarResultado(promptKey, true, tenantId, motor);

      return datos;

    } catch (error) {
      console.error(`❌ Error extrayendo con ${promptKey}:`, error.message);

      // Registrar uso fallido del prompt (necesitamos obtener el motor del prompt si es posible)
      const prompt = await this.getPrompt(promptKey, tenantId);
      const motor = prompt?.motor || null;
      await promptManager.registrarResultado(promptKey, false, tenantId, motor).catch(() => {});

      throw error;
    }
  }

  /**
   * Extracción con Google Gemini
   *
   * @param {string} fullPrompt
   * @param {Object} config
   * @returns {Promise<string>}
   */
  async extractWithGemini(fullPrompt, config) {
    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.modelo });

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      console.log(`📤 Respuesta de Gemini recibida (${text.length} caracteres)`);

      return text;

    } catch (error) {
      console.error('❌ Error en Gemini:', error.message);
      throw error;
    }
  }

  /**
   * Extracción con Anthropic Claude
   *
   * @param {string} fullPrompt
   * @param {Object} config
   * @returns {Promise<string>}
   */
  async extractWithClaude(fullPrompt, config) {
    try {
      const anthropic = new Anthropic({ apiKey: config.apiKey });

      const message = await anthropic.messages.create({
        model: config.modelo,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: fullPrompt
        }]
      });

      const text = message.content[0].text;

      console.log(`📤 Respuesta de Claude recibida (${text.length} caracteres)`);

      return text;

    } catch (error) {
      console.error('❌ Error en Claude:', error.message);
      throw error;
    }
  }

  /**
   * Parsea la respuesta de la IA
   *
   * @param {string} response
   * @returns {Object}
   */
  parseResponse(response) {
    try {
      // Limpiar markdown y otros caracteres
      let cleaned = response.trim();

      // Remover bloques de código markdown
      cleaned = cleaned.replace(/```json\n?/g, '');
      cleaned = cleaned.replace(/```\n?/g, '');
      cleaned = cleaned.trim();

      // Intentar extraer JSON si viene con texto antes/después
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      // Parsear JSON
      const json = JSON.parse(cleaned);

      console.log('✅ JSON parseado correctamente');

      return json;

    } catch (error) {
      console.error('❌ Error parseando respuesta:', error.message);
      console.log('Respuesta recibida:', response.substring(0, 500));

      // Intentar limpieza adicional
      try {
        let retry = response
          .replace(/^[^{]*/, '') // Remover texto antes del {
          .replace(/[^}]*$/, '') // Remover texto después del }
          .trim();

        const json = JSON.parse(retry);
        console.log('✅ JSON parseado en segundo intento');
        return json;

      } catch (retryError) {
        throw new Error(`No se pudo parsear JSON: ${error.message}`);
      }
    }
  }

  /**
   * Mapeo de tipo de documento a clave de prompt
   *
   * @param {string} tipoDocumento
   * @returns {string}
   */
  getPromptKeyForType(tipoDocumento) {
    const mapping = {
      'FACTURA_A': 'EXTRACCION_FACTURA_A',
      'FACTURA_B': 'EXTRACCION_FACTURA_B',
      'FACTURA_C': 'EXTRACCION_FACTURA_C',
      'DESPACHO_ADUANA': 'EXTRACCION_DESPACHO_ADUANA',
      'COMPROBANTE_IMPORTACION': 'EXTRACCION_COMPROBANTE_IMPORTACION',
      'NOTA_CREDITO': 'EXTRACCION_FACTURA_A', // Usar mismo que Factura A
      'TICKET': 'EXTRACCION_FACTURA_C' // Usar mismo que Factura C
    };

    return mapping[tipoDocumento] || 'EXTRACCION_UNIVERSAL';
  }

  /**
   * Obtiene un prompt desde la BD
   *
   * @param {string} clave
   * @param {string} tenantId
   * @returns {Promise<Object|null>}
   */
  async getPrompt(clave, tenantId) {
    try {
      // Primero buscar prompt custom del tenant
      let prompt = await prisma.ai_prompts.findFirst({
        where: {
          clave,
          tenantId,
          activo: true
        }
      });

      // Si no hay custom, buscar global
      if (!prompt) {
        prompt = await prisma.ai_prompts.findFirst({
          where: {
            clave,
            tenantId: null,
            activo: true
          }
        });
      }

      return prompt;

    } catch (error) {
      console.error(`❌ Error obteniendo prompt ${clave}:`, error.message);
      return null;
    }
  }
}

module.exports = new DocumentExtractionOrchestrator();
