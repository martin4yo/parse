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

      console.log(`📝 Prompt: ${prompt.clave}`);
      console.log(`🤖 Motor de IA: ${prompt.motor}`);

      // Mostrar el prompt completo que se está usando
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📋 PROMPT DE CLASIFICACIÓN COMPLETO:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(prompt.prompt);
      console.log('═══════════════════════════════════════════════════════════\n');

      // Obtener configuración de IA
      const config = await aiConfigService.getProviderConfig(prompt.motor, tenantId);
      console.log(`📦 Modelo: ${config.modelo}`);
      console.log(`⏳ Llamando a ${prompt.motor} para clasificar...`);

      // Clasificar según el motor
      let resultado;
      if (prompt.motor === 'gemini') {
        resultado = await this.classifyWithGemini(documentText, prompt.prompt, config);
      } else if (prompt.motor === 'anthropic') {
        resultado = await this.classifyWithClaude(documentText, prompt.prompt, config);
      } else {
        throw new Error(`Motor de IA no soportado: ${prompt.motor}`);
      }

      resultado.motorUsado = prompt.motor;
      resultado.modeloUsado = config.modelo;

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
      console.log(`🔑 API Key (primeros 10 chars): ${config.apiKey.substring(0, 10)}...`);
      console.log(`📦 Modelo a usar: ${config.modelo}`);

      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.modelo });

      // Mostrar vista previa del texto del documento
      console.log('\n───────────────────────────────────────────────────────────');
      console.log('📄 TEXTO DEL DOCUMENTO (primeros 500 caracteres):');
      console.log('───────────────────────────────────────────────────────────');
      console.log(documentText.substring(0, 500) + (documentText.length > 500 ? '...' : ''));
      console.log('───────────────────────────────────────────────────────────');

      // Verificar si contiene LEY 27743
      if (documentText.toUpperCase().includes('LEY 27743')) {
        console.log('⚠️  DETECTADO: Documento contiene "LEY 27743" → Debe ser FACTURA B');
      }
      console.log('');

      const fullPrompt = promptTemplate.replace('{{DOCUMENT_TEXT}}', documentText);
      console.log(`📝 Longitud del prompt completo: ${fullPrompt.length} caracteres`);
      console.log(`📝 Longitud del texto del documento: ${documentText.length} caracteres`);

      console.log('🌐 Llamando a Gemini API...');
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      console.log(`📥 Respuesta recibida (${text.length} caracteres)`);
      console.log('\n───────────────────────────────────────────────────────────');
      console.log('🤖 RESPUESTA DE GEMINI:');
      console.log('───────────────────────────────────────────────────────────');
      console.log(text);
      console.log('───────────────────────────────────────────────────────────\n');

      // Parsear respuesta JSON
      const clasificacion = this.parseClassificationResponse(text);

      console.log('\n🔍 DEBUG PARSEADO:');
      console.log('   Clasificación parseada:', JSON.stringify(clasificacion, null, 2));

      return {
        ...clasificacion,
        modelo: config.modelo
      };

    } catch (error) {
      console.error('❌ Error en clasificación con Gemini:', error.message);
      console.error('❌ Error completo:', error);

      // Información adicional para debugging
      if (error.message.includes('fetch failed')) {
        console.error('🌐 Posibles causas:');
        console.error('   1. Sin conexión a Internet');
        console.error('   2. API Key inválida o expirada');
        console.error('   3. Firewall bloqueando salida HTTPS');
        console.error('   4. Gemini no disponible en tu región');
        console.error('   5. Problema temporal del servicio de Google');
      }

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

      console.log('\n🔍 DEBUG PARSEADO:');
      console.log('   Clasificación parseada:', JSON.stringify(clasificacion, null, 2));

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

      console.log('\n🔍 DEBUG PARSEO JSON:');
      console.log('   JSON original de IA:', JSON.stringify(json, null, 2));
      console.log('   json.tipo:', json.tipo);
      console.log('   json.tipoDocumento:', json.tipoDocumento);
      console.log('   json.tipoComprobante:', json.tipoComprobante);

      // Extraer tipo de documento (probar múltiples variantes)
      let tipoDetectado = json.tipo || json.tipoDocumento || json.tipoComprobante;

      // Si tipoComprobante tiene formato "FACTURA A/B/C", convertir a formato esperado
      if (tipoDetectado && tipoDetectado.includes('FACTURA')) {
        tipoDetectado = tipoDetectado.replace(/\s+/g, '_').toUpperCase();
      }

      console.log('   Seleccionado:', tipoDetectado || 'FACTURA_A');

      return {
        tipoDocumento: tipoDetectado || 'FACTURA_A',
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

    // REGLA CRÍTICA: LEY 27743 = FACTURA B
    if (textUpper.includes('LEY 27743')) {
      return { tipoDocumento: 'FACTURA_B', confianza: 0.99, subtipos: [], modelo: 'regex-ley27743' };
    }

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
