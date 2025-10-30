const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');
const path = require('path');

/**
 * Servicio para procesar documentos con Google Document AI
 *
 * Document AI es superior a Gemini/Claude para facturas porque:
 * - 95%+ precisión vs 70-80%
 * - OCR avanzado (lee imágenes embebidas, handwriting, rotado)
 * - Especializado en facturas con Invoice Parser
 * - Detecta automáticamente campos estructurados
 * - Sin rate limiting agresivo
 * - GRATIS primeros 1,000 páginas/mes
 */
class DocumentAIProcessor {
  constructor() {
    this.client = null;
    this.projectId = process.env.DOCUMENT_AI_PROJECT_ID;
    this.location = process.env.DOCUMENT_AI_LOCATION || 'us';
    this.processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

    // Verificar configuración
    if (!this.projectId || !this.processorId) {
      console.warn('⚠️  Document AI no configurado completamente. Faltan variables de entorno.');
    }
  }

  /**
   * Inicializar cliente de Document AI
   */
  async initClient() {
    if (this.client) {
      return this.client;
    }

    try {
      // Opción 1: Usar archivo de credenciales (recomendado)
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (!fs.existsSync(credentialsPath)) {
          throw new Error(`Archivo de credenciales no encontrado: ${credentialsPath}`);
        }

        this.client = new DocumentProcessorServiceClient({
          keyFilename: credentialsPath
        });

        console.log('✅ Document AI client inicializado con archivo de credenciales');
      }
      // Opción 2: Usar JSON directo desde variable de entorno
      else if (process.env.DOCUMENT_AI_CREDENTIALS_JSON) {
        const credentials = JSON.parse(process.env.DOCUMENT_AI_CREDENTIALS_JSON);

        this.client = new DocumentProcessorServiceClient({
          credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
          },
          projectId: credentials.project_id
        });

        console.log('✅ Document AI client inicializado con JSON credentials');
      }
      // Opción 3: Usar credenciales por defecto (Google Cloud env)
      else {
        this.client = new DocumentProcessorServiceClient();
        console.log('✅ Document AI client inicializado con default credentials');
      }

      return this.client;
    } catch (error) {
      console.error('❌ Error inicializando Document AI client:', error.message);
      throw error;
    }
  }

  /**
   * Procesar documento con Document AI Invoice Parser
   *
   * @param {string} filePath - Ruta al archivo PDF o imagen
   * @param {object} options - Opciones adicionales
   * @returns {object} Datos extraídos estructurados
   */
  async processInvoice(filePath, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`📄 [Document AI] Procesando: ${path.basename(filePath)}`);

      // Inicializar cliente si no existe
      const client = await this.initClient();

      // Leer archivo
      const fileBuffer = fs.readFileSync(filePath);
      const base64File = fileBuffer.toString('base64');

      // Detectar mime type
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypeMap = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff'
      };
      const mimeType = mimeTypeMap[ext] || 'application/pdf';

      // Construir nombre del processor
      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

      console.log(`🔧 [Document AI] Processor: ${name}`);
      console.log(`📊 [Document AI] Tamaño archivo: ${(fileBuffer.length / 1024).toFixed(2)} KB`);

      // Llamar a Document AI
      const request = {
        name: name,
        rawDocument: {
          content: base64File,
          mimeType: mimeType,
        },
      };

      const [result] = await client.processDocument(request);
      const document = result.document;

      const processingTime = Date.now() - startTime;
      console.log(`✅ [Document AI] Procesado en ${processingTime}ms`);

      // Extraer datos estructurados
      const extractedData = this.extractStructuredData(document);

      return {
        success: true,
        data: extractedData,
        rawDocument: document, // Por si necesitamos datos adicionales
        processingTime: processingTime,
        confidence: this.calculateOverallConfidence(document)
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [Document AI] Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        processingTime: processingTime
      };
    }
  }

  /**
   * Extraer datos estructurados del documento procesado
   * Mapea los campos de Document AI al formato de nuestra aplicación
   */
  extractStructuredData(document) {
    const entities = document.entities || [];
    const data = {};

    // Mapeo de tipos de entidad de Document AI a nuestros campos
    const entityMapping = {
      // Campos principales
      'invoice_date': 'fecha',
      'invoice_id': 'numeroComprobante',
      'total_amount': 'importe',
      'supplier_name': 'razonSocial',
      'supplier_tax_id': 'cuit',
      'net_amount': 'netoGravado',
      'total_tax_amount': 'impuestos',
      'currency': 'moneda',

      // Campos adicionales
      'due_date': 'fechaVencimiento',
      'purchase_order': 'ordenCompra',
      'receiver_name': 'receptorNombre',
      'receiver_tax_id': 'receptorCuit',

      // Descuentos
      'total_discount_amount': 'descuentoGlobal'
    };

    // Extraer entidades principales
    for (const entity of entities) {
      const entityType = entity.type;
      const mappedField = entityMapping[entityType];

      if (mappedField) {
        // Obtener valor
        let value = this.getEntityValue(entity);

        // Normalizar según el campo
        if (mappedField === 'fecha' || mappedField === 'fechaVencimiento') {
          value = this.normalizeDate(value);
        } else if (mappedField === 'cuit' || mappedField === 'receptorCuit') {
          value = this.normalizeCUIT(value);
        } else if (['importe', 'netoGravado', 'impuestos', 'descuentoGlobal'].includes(mappedField)) {
          value = this.normalizeAmount(value);
        } else if (mappedField === 'moneda') {
          value = this.normalizeCurrency(value);
        }

        data[mappedField] = value;

        // Log para debugging
        const confidence = entity.confidence || 0;
        console.log(`   📋 ${mappedField}: "${value}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
      }
    }

    // Extraer line items (items de la factura)
    data.lineItems = this.extractLineItems(document);
    console.log(`   📦 Line items extraídos: ${data.lineItems.length}`);

    // Calcular exento si no viene
    if (!data.exento && data.importe && data.netoGravado && data.impuestos) {
      data.exento = Math.max(0, data.importe - data.netoGravado - data.impuestos);
    }

    // Detectar tipo de comprobante (si no viene en Document AI)
    if (!data.tipoComprobante) {
      data.tipoComprobante = this.detectTipoComprobante(document.text || '');
    }

    return data;
  }

  /**
   * Extraer line items (productos/servicios) del documento
   */
  extractLineItems(document) {
    const lineItems = [];
    const entities = document.entities || [];

    // Buscar entidades tipo "line_item"
    for (const entity of entities) {
      if (entity.type === 'line_item') {
        const item = {
          numero: lineItems.length + 1,
          descripcion: '',
          cantidad: 1,
          precioUnitario: 0,
          subtotal: 0,
          totalLinea: 0
        };

        // Extraer propiedades del line item
        if (entity.properties) {
          for (const prop of entity.properties) {
            switch (prop.type) {
              case 'line_item/description':
                item.descripcion = this.getEntityValue(prop);
                break;
              case 'line_item/quantity':
                item.cantidad = parseFloat(this.getEntityValue(prop)) || 1;
                break;
              case 'line_item/unit_price':
                item.precioUnitario = this.normalizeAmount(this.getEntityValue(prop));
                break;
              case 'line_item/amount':
                item.subtotal = this.normalizeAmount(this.getEntityValue(prop));
                item.totalLinea = item.subtotal; // Por ahora igual
                break;
              case 'line_item/product_code':
                item.codigoProducto = this.getEntityValue(prop);
                break;
            }
          }
        }

        // Solo agregar si tiene descripción
        if (item.descripcion) {
          lineItems.push(item);
        }
      }
    }

    return lineItems;
  }

  /**
   * Obtener valor de una entidad
   */
  getEntityValue(entity) {
    if (entity.mentionText) {
      return entity.mentionText;
    }

    if (entity.normalizedValue) {
      // Para fechas
      if (entity.normalizedValue.dateValue) {
        const date = entity.normalizedValue.dateValue;
        return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      }

      // Para montos
      if (entity.normalizedValue.moneyValue) {
        return entity.normalizedValue.moneyValue.units || 0;
      }

      // Para texto normalizado
      if (entity.normalizedValue.text) {
        return entity.normalizedValue.text;
      }
    }

    return entity.textAnchor?.content || '';
  }

  /**
   * Normalizar fecha al formato YYYY-MM-DD
   */
  normalizeDate(value) {
    if (!value) return null;

    // Si ya está en formato ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // Intentar parsear otros formatos comunes
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn(`⚠️  No se pudo normalizar fecha: ${value}`);
    }

    return value;
  }

  /**
   * Normalizar CUIT (agregar guiones si no los tiene)
   */
  normalizeCUIT(value) {
    if (!value) return null;

    // Remover todo menos números
    const digits = value.replace(/\D/g, '');

    // Si tiene 11 dígitos, formatear con guiones
    if (digits.length === 11) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
    }

    return value;
  }

  /**
   * Normalizar monto (convertir a número decimal)
   */
  normalizeAmount(value) {
    if (!value) return 0;

    // Si ya es número
    if (typeof value === 'number') {
      return value;
    }

    // Remover símbolos de moneda y espacios
    const cleaned = String(value)
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Normalizar moneda
   */
  normalizeCurrency(value) {
    if (!value) return 'ARS';

    const normalized = String(value).toUpperCase().trim();

    // Mapeo común
    const currencyMap = {
      'ARS': 'ARS',
      'AR$': 'ARS',
      'PESOS': 'ARS',
      '$': 'ARS',
      'USD': 'USD',
      'US$': 'USD',
      'DOLARES': 'USD',
      'DÓLARES': 'USD'
    };

    return currencyMap[normalized] || 'ARS';
  }

  /**
   * Detectar tipo de comprobante del texto
   */
  detectTipoComprobante(text) {
    const textUpper = text.toUpperCase();

    if (textUpper.includes('FACTURA A')) return 'FACTURA A';
    if (textUpper.includes('FACTURA B')) return 'FACTURA B';
    if (textUpper.includes('FACTURA C')) return 'FACTURA C';
    if (textUpper.includes('FACTURA E')) return 'FACTURA E';
    if (textUpper.includes('NOTA DE CRÉDITO')) return 'NOTA DE CRÉDITO';
    if (textUpper.includes('NOTA DE DÉBITO')) return 'NOTA DE DÉBITO';
    if (textUpper.includes('TICKET')) return 'TICKET';
    if (textUpper.includes('RECIBO')) return 'RECIBO';

    return 'FACTURA';
  }

  /**
   * Calcular confianza general del documento
   */
  calculateOverallConfidence(document) {
    const entities = document.entities || [];

    if (entities.length === 0) {
      return 0;
    }

    const sum = entities.reduce((acc, entity) => acc + (entity.confidence || 0), 0);
    return (sum / entities.length) * 100;
  }

  /**
   * Verificar si Document AI está configurado
   */
  isConfigured() {
    return !!(this.projectId && this.processorId);
  }
}

module.exports = new DocumentAIProcessor();
