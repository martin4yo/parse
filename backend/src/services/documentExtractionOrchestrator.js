const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const featureService = require('./featureService');
const aiConfigService = require('./aiConfigService');
const classifierService = require('./classifierService');
const promptManager = require('./promptManager');
const documentAIProcessor = require('./documentAIProcessor');
const DocumentProcessor = require('../lib/documentProcessor');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Crear instancia del procesador de documentos
const documentProcessor = new DocumentProcessor();

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
   * @param {string} filePath - Ruta al archivo original (opcional, para Document AI)
   * @param {boolean} forceAI - Si es true, fuerza uso de IA sin cache de patrones
   * @returns {Promise<Object>} - Resultado de la extracción
   */
  async extractData(documentText, tenantId, userId, filePath = null, forceAI = false) {
    try {
      console.log('\n🎯 ===== INICIANDO EXTRACCIÓN DE DOCUMENTO =====');
      console.log(`👤 Tenant: ${tenantId}`);
      console.log(`📄 Longitud de texto: ${documentText.length} caracteres`);

      // 0. PRIORIDAD MÁXIMA: Intentar con Document AI si está configurado Y activo en BD
      if (filePath && documentAIProcessor.isConfigured()) {
        // Verificar si Document AI está activo en la configuración del tenant
        const documentAIActivo = await this.isDocumentAIActive(tenantId);

        if (documentAIActivo) {
          try {
            console.log('\n🎯 ===== USANDO DOCUMENT AI (PRIORIDAD) =====');
            const result = await documentAIProcessor.processInvoice(filePath, { tenantId });

            if (result.success && result.data) {
              console.log(`✅ Document AI exitoso (confianza: ${result.confidence.toFixed(1)}%)`);
              console.log('✅ ===== EXTRACCIÓN COMPLETADA CON DOCUMENT AI =====\n');

              return {
                metodo: 'DOCUMENT_AI',
                datos: result.data,
                promptUtilizado: 'Document AI Invoice Parser',
                confidence: result.confidence,
                processingTime: result.processingTime,
                success: true
              };
            } else {
              console.warn(`⚠️  Document AI falló: ${result.error}`);
              console.log('🔄 Continuando con métodos alternativos...\n');
            }
          } catch (error) {
            console.error('❌ Error con Document AI:', error.message);
            console.log('🔄 Continuando con métodos alternativos...\n');
          }
        } else {
          console.log('ℹ️  Document AI está INACTIVO (switch desactivado en configuración)');
        }
      } else if (filePath && !documentAIProcessor.isConfigured()) {
        console.log('ℹ️  Document AI no configurado (faltan credenciales), probando otros métodos');
      } else if (!filePath) {
        console.log('ℹ️  No hay archivo original disponible, usando extracción de texto');
      }

      // 1. Si tenemos filePath, intentar con el pipeline completo de IA
      // (incluye Claude Vision, Gemini, Claude texto, etc.)
      if (filePath && process.env.USE_CLAUDE_VISION === 'true') {
        try {
          console.log('\n🎯 ===== USANDO PIPELINE DE IA CON VISIÓN =====');
          console.log('🔄 Intentará: Claude Vision → Gemini → Claude Texto → Regex');

          const aiResult = await documentProcessor.extractDataWithAI(documentText, tenantId, filePath, forceAI);

          if (aiResult && aiResult.data) {
            console.log(`✅ Extracción exitosa con: ${aiResult.modelUsed}`);
            console.log('✅ ===== EXTRACCIÓN COMPLETADA CON IA =====\n');

            return {
              metodo: aiResult.modelUsed || 'AI',
              datos: aiResult.data,
              promptUtilizado: `${aiResult.modelUsed} Pipeline`,
              success: true
            };
          } else {
            console.warn('⚠️  Pipeline de IA no retornó datos, probando métodos tradicionales...\n');
          }
        } catch (error) {
          console.error('❌ Error con pipeline de IA:', error.message);
          console.log('🔄 Continuando con métodos tradicionales...\n');
        }
      }

      // 2. Verificar qué tipo de extracción usar (pipeline tradicional o simple)
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

  /**
   * Verificar si Document AI está activo para el tenant
   * Consulta la tabla ai_provider_configs para verificar el switch
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>} - true si está activo, false si no
   */
  async isDocumentAIActive(tenantId) {
    try {
      // Buscar configuración de Document AI para el tenant
      const config = await prisma.ai_provider_configs.findUnique({
        where: {
          tenantId_provider: {
            tenantId: tenantId,
            provider: 'document_ai'
          }
        },
        select: {
          activo: true
        }
      });

      // Si no existe configuración, usar la variable de entorno como fallback
      if (!config) {
        console.log('   ℹ️  No hay configuración de Document AI en BD, usando .env');
        return process.env.USE_DOCUMENT_AI === 'true';
      }

      console.log(`   ℹ️  Document AI ${config.activo ? 'ACTIVO' : 'INACTIVO'} (configuración BD)`);
      return config.activo;

    } catch (error) {
      console.error('❌ Error verificando estado de Document AI:', error.message);
      // En caso de error, usar .env como fallback
      return process.env.USE_DOCUMENT_AI === 'true';
    }
  }

  /**
   * Verificar si un proveedor de IA tiene habilitado el pre-procesamiento con Document AI
   *
   * @param {string} provider - Nombre del proveedor (claude, gemini, etc.)
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>} - true si debe pre-procesar con Document AI
   */
  async shouldPreprocessWithDocumentAI(provider, tenantId) {
    try {
      const config = await prisma.ai_provider_configs.findUnique({
        where: {
          tenantId_provider: {
            tenantId: tenantId,
            provider: provider
          }
        },
        select: {
          preprocessWithDocumentAI: true
        }
      });

      return config?.preprocessWithDocumentAI || false;

    } catch (error) {
      console.error(`❌ Error verificando pre-procesamiento para ${provider}:`, error.message);
      return false;
    }
  }

  /**
   * Pre-procesar documento con Document AI (solo OCR + estructura)
   * y devolver texto limpio + tablas estructuradas para el modelo de IA
   *
   * @param {string} filePath - Ruta al archivo
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Object>} - { text, tables, metadata }
   */
  async preprocessWithDocumentAI(filePath, tenantId) {
    try {
      console.log('📄 [PRE-PROCESAMIENTO] Usando Document AI como OCR...');

      const result = await documentAIProcessor.processInvoice(filePath, { tenantId });

      if (!result.success) {
        console.warn(`⚠️  Document AI pre-procesamiento falló: ${result.error}`);
        return null;
      }

      const doc = result.rawDocument;

      // Extraer texto limpio
      const cleanText = doc.text || '';

      // Extraer tablas estructuradas
      const tables = this.extractTablesFromDocumentAI(doc);

      // Extraer metadatos útiles
      const metadata = {
        confidence: result.confidence,
        pageCount: doc.pages?.length || 1,
        hasTablesDetected: tables.length > 0,
        // Campos de alta confianza que puede usar la IA como referencia
        detectedValues: {
          fecha: result.data.fecha,
          total: result.data.importe,
          cuit: result.data.cuit,
          netoGravado: result.data.netoGravado
        }
      };

      console.log(`✅ [PRE-PROCESAMIENTO] Document AI extrajo:`);
      console.log(`   - Texto: ${cleanText.length} caracteres`);
      console.log(`   - Tablas: ${tables.length}`);
      console.log(`   - Confianza: ${result.confidence.toFixed(1)}%`);

      return {
        text: cleanText,
        tables: tables,
        metadata: metadata
      };

    } catch (error) {
      console.error('❌ Error en pre-procesamiento con Document AI:', error.message);
      return null;
    }
  }

  /**
   * Extraer tablas del resultado de Document AI en formato legible
   *
   * @param {Object} document - Documento de Document AI
   * @returns {Array} - Array de tablas estructuradas
   */
  extractTablesFromDocumentAI(document) {
    const tables = [];

    // Document AI detecta tablas en pages[].tables
    if (document.pages) {
      for (const page of document.pages) {
        if (page.tables) {
          for (const table of page.tables) {
            const rows = [];

            // Agrupar celdas por filas
            const cellsByRow = {};

            for (const cell of table.bodyRows || []) {
              const rowIndex = cell.rowIndex || 0;
              if (!cellsByRow[rowIndex]) {
                cellsByRow[rowIndex] = [];
              }
              cellsByRow[rowIndex].push({
                column: cell.columnIndex || 0,
                text: cell.textAnchor?.content || ''
              });
            }

            // Convertir a array ordenado
            for (const rowIndex in cellsByRow) {
              const cells = cellsByRow[rowIndex].sort((a, b) => a.column - b.column);
              rows.push(cells.map(c => c.text));
            }

            if (rows.length > 0) {
              tables.push({
                rows: rows,
                columns: rows[0]?.length || 0
              });
            }
          }
        }
      }
    }

    return tables;
  }
}

module.exports = new DocumentExtractionOrchestrator();
