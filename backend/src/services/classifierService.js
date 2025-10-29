const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const aiConfigService = require('./aiConfigService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * ClassifierService
 *
 * Servicio para clasificar documentos según su tipo.
 * Usa IA (Gemini o Claude) con un prompt especializado.
 */
class ClassifierService {

  /**
   * Clasifica un documento según su tipo
   *
   * @param {string} documentText - Texto extraído del documento
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Object>} - { tipoDocumento, confianza, subtipos, modelo }
   */
  async classify(documentText, tenantId) {
    try {
      console.log('🔍 Iniciando clasificación de documento...');

      // Obtener el prompt clasificador
      const prompt = await this.getClassifierPrompt(tenantId);

      if (!prompt) {
        console.log('⚠️  No hay prompt clasificador, usando clasificación por defecto');
        return this.defaultClassification(documentText);
      }

      // Obtener configuración de IA
      const config = await aiConfigService.getProviderConfig(prompt.motor, tenantId);

      // Clasificar según el motor
      let resultado;
      if (prompt.motor === 'gemini') {
        resultado = await this.classifyWithGemini(documentText, prompt.prompt, config);
      } else if (prompt.motor === 'anthropic') {
        resultado = await this.classifyWithClaude(documentText, prompt.prompt, config);
      } else {
        throw new Error(`Motor de IA no soportado: ${prompt.motor}`);
      }

      console.log(`✅ Documento clasificado como: ${resultado.tipoDocumento} (${resultado.confianza * 100}%)`);

      return resultado;

    } catch (error) {
      console.error('❌ Error clasificando documento:', error.message);
      // Fallback a clasificación por defecto
      return this.defaultClassification(documentText);
    }
  }

  /**
   * Clasificación con Google Gemini
   *
   * @param {string} documentText
   * @param {string} promptTemplate
   * @param {Object} config
   * @returns {Promise<Object>}
   */
  async classifyWithGemini(documentText, promptTemplate, config) {
    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.modelo });

      const fullPrompt = promptTemplate.replace('{{DOCUMENT_TEXT}}', documentText);

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Parsear respuesta JSON
      const clasificacion = this.parseClassificationResponse(text);

      return {
        ...clasificacion,
        modelo: config.modelo
      };

    } catch (error) {
      console.error('❌ Error en clasificación con Gemini:', error.message);
      throw error;
    }
  }

  /**
   * Clasificación con Anthropic Claude
   *
   * @param {string} documentText
   * @param {string} promptTemplate
   * @param {Object} config
   * @returns {Promise<Object>}
   */
  async classifyWithClaude(documentText, promptTemplate, config) {
    try {
      const anthropic = new Anthropic({ apiKey: config.apiKey });

      const fullPrompt = promptTemplate.replace('{{DOCUMENT_TEXT}}', documentText);

      const message = await anthropic.messages.create({
        model: config.modelo,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: fullPrompt
        }]
      });

      const text = message.content[0].text;

      // Parsear respuesta JSON
      const clasificacion = this.parseClassificationResponse(text);

      return {
        ...clasificacion,
        modelo: config.modelo
      };

    } catch (error) {
      console.error('❌ Error en clasificación con Claude:', error.message);
      throw error;
    }
  }

  /**
   * Parsea la respuesta de la IA
   *
   * @param {string} text
   * @returns {Object}
   */
  parseClassificationResponse(text) {
    try {
      // Limpiar markdown y otros caracteres
      let cleaned = text.trim();

      // Remover bloques de código markdown
      cleaned = cleaned.replace(/```json\n?/g, '');
      cleaned = cleaned.replace(/```\n?/g, '');
      cleaned = cleaned.trim();

      // Parsear JSON
      const json = JSON.parse(cleaned);

      return {
        tipoDocumento: json.tipo || json.tipoDocumento || 'FACTURA_A',
        confianza: json.confianza || json.confidence || 0.9,
        subtipos: json.subtipos || json.subtypes || []
      };

    } catch (error) {
      console.error('❌ Error parseando respuesta de clasificación:', error.message);
      console.log('Respuesta recibida:', text);

      // Fallback: intentar detectar el tipo por regex
      return this.defaultClassification(text);
    }
  }

  /**
   * Clasificación por defecto usando regex
   *
   * @param {string} documentText
   * @returns {Object}
   */
  defaultClassification(documentText) {
    const textUpper = documentText.toUpperCase();

    // Detectar tipo de factura
    if (textUpper.includes('FACTURA A') || textUpper.includes('TIPO A')) {
      return { tipoDocumento: 'FACTURA_A', confianza: 0.8, subtipos: [], modelo: 'regex' };
    }
    if (textUpper.includes('FACTURA B') || textUpper.includes('TIPO B')) {
      return { tipoDocumento: 'FACTURA_B', confianza: 0.8, subtipos: [], modelo: 'regex' };
    }
    if (textUpper.includes('FACTURA C') || textUpper.includes('TIPO C')) {
      return { tipoDocumento: 'FACTURA_C', confianza: 0.8, subtipos: [], modelo: 'regex' };
    }

    // Detectar otros tipos
    if (textUpper.includes('DESPACHO') && textUpper.includes('ADUANA')) {
      return { tipoDocumento: 'DESPACHO_ADUANA', confianza: 0.7, subtipos: [], modelo: 'regex' };
    }
    if (textUpper.includes('TICKET') || textUpper.includes('CONSUMIDOR FINAL')) {
      return { tipoDocumento: 'TICKET', confianza: 0.7, subtipos: [], modelo: 'regex' };
    }
    if (textUpper.includes('NOTA DE CREDITO') || textUpper.includes('NOTA CREDITO')) {
      return { tipoDocumento: 'NOTA_CREDITO', confianza: 0.7, subtipos: [], modelo: 'regex' };
    }

    // Por defecto: FACTURA_A
    return { tipoDocumento: 'FACTURA_A', confianza: 0.5, subtipos: [], modelo: 'regex' };
  }

  /**
   * Obtiene el prompt clasificador desde la BD
   *
   * @param {string} tenantId
   * @returns {Promise<Object|null>}
   */
  async getClassifierPrompt(tenantId) {
    try {
      // Primero buscar prompt custom del tenant
      let prompt = await prisma.ai_prompts.findFirst({
        where: {
          clave: 'CLASIFICADOR_DOCUMENTO',
          tipo: 'CLASIFICADOR',
          tenantId: tenantId,
          activo: true
        }
      });

      // Si no hay custom, buscar global
      if (!prompt) {
        prompt = await prisma.ai_prompts.findFirst({
          where: {
            clave: 'CLASIFICADOR_DOCUMENTO',
            tipo: 'CLASIFICADOR',
            tenantId: null,
            activo: true
          }
        });
      }

      return prompt;

    } catch (error) {
      console.error('❌ Error obteniendo prompt clasificador:', error.message);
      return null;
    }
  }
}

module.exports = new ClassifierService();
