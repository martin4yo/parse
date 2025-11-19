const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
    this.configCache = null; // Cache para evitar consultas repetidas
    this.configCacheTime = null;
    this.configCacheTTL = 5 * 60 * 1000; // 5 minutos

    // Verificar configuración
    if (!this.projectId || !this.processorId) {
      console.warn('⚠️  Document AI no configurado completamente. Faltan variables de entorno.');
    }
  }

  /**
   * Cargar configuración activa de detección
   * Con cache de 5 minutos para evitar consultas repetidas
   */
  async loadDetectionConfig(tenantId) {
    // Verificar cache
    const now = Date.now();
    if (this.configCache && this.configCacheTime && (now - this.configCacheTime < this.configCacheTTL)) {
      return this.configCache;
    }

    try {
      // Buscar config activa del tenant
      let config = await prisma.document_detection_config.findFirst({
        where: {
          tenantId,
          activo: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Si no existe, buscar config global (sin tenant)
      if (!config) {
        config = await prisma.document_detection_config.findFirst({
          where: {
            tenantId: null,
            activo: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
      }

      // Si tampoco existe global, usar config por defecto
      if (!config) {
        this.configCache = this.getDefaultConfig();
        this.configCacheTime = now;
        console.log('📋 Usando configuración de detección por defecto');
        return this.configCache;
      }

      this.configCache = config.config;
      this.configCacheTime = now;
      console.log(`📋 Configuración de detección cargada: "${config.nombre}"`);
      return this.configCache;

    } catch (error) {
      console.error('❌ Error cargando configuración de detección:', error);
      // Fallback a config por defecto
      return this.getDefaultConfig();
    }
  }

  /**
   * Obtener configuración por defecto
   */
  getDefaultConfig() {
    return {
      zonaBusqueda: {
        zona1: {
          nombre: 'Superior Central Estricta',
          topY: 0.20,
          centerXMin: 0.30,
          centerXMax: 0.70,
          descripcion: 'Zona principal donde suele estar el recuadro con la letra'
        },
        zona2: {
          nombre: 'Superior Amplia',
          topY: 0.30,
          centerXMin: 0.20,
          centerXMax: 0.80,
          descripcion: 'Zona ampliada si no se encuentra en zona 1'
        }
      },
      patronesBusqueda: {
        facturaA: {
          nombre: 'FACTURA A',
          patrones: [
            'FACTURA\\s*A\\b',
            'TIPO\\s*:\\s*A\\b',
            'CLASE\\s*:\\s*A\\b',
            'COD\\.\\s*001',
            'CODIGO\\s*001',
            '\\bA\\s+ORIGINAL',
            '\\bA\\s+DUPLICADO'
          ],
          codigoAFIP: '001',
          activo: true
        },
        facturaB: {
          nombre: 'FACTURA B',
          patrones: [
            'FACTURA\\s*B\\b',
            'TIPO\\s*:\\s*B\\b',
            'CLASE\\s*:\\s*B\\b',
            'COD\\.\\s*006',
            'CODIGO\\s*006',
            '\\bB\\s+ORIGINAL',
            '\\bB\\s+DUPLICADO'
          ],
          codigoAFIP: '006',
          activo: true
        },
        facturaC: {
          nombre: 'FACTURA C',
          patrones: [
            'FACTURA\\s*C\\b',
            'TIPO\\s*:\\s*C\\b',
            'CLASE\\s*:\\s*C\\b',
            'COD\\.\\s*011',
            'CODIGO\\s*011',
            '\\bC\\s+ORIGINAL',
            '\\bC\\s+DUPLICADO'
          ],
          codigoAFIP: '011',
          activo: true
        },
        facturaE: {
          nombre: 'FACTURA E',
          patrones: [
            'FACTURA\\s*E\\b',
            'TIPO\\s*:\\s*E\\b',
            'FACTURA\\s+DE\\s+EXPORTACION',
            'COD\\.\\s*019'
          ],
          codigoAFIP: '019',
          activo: true
        },
        facturaM: {
          nombre: 'FACTURA M',
          patrones: [
            'FACTURA\\s*M\\b',
            'TIPO\\s*:\\s*M\\b',
            'COD\\.\\s*051'
          ],
          codigoAFIP: '051',
          activo: true
        },
        notaCredito: {
          nombre: 'NOTA DE CRÉDITO',
          patrones: [
            'NOTA\\s+DE\\s+CREDITO',
            'NOTA\\s+CREDITO',
            'N\\/C',
            'NC\\s+\\d'
          ],
          activo: true
        },
        notaDebito: {
          nombre: 'NOTA DE DÉBITO',
          patrones: [
            'NOTA\\s+DE\\s+DEBITO',
            'NOTA\\s+DEBITO',
            'N\\/D',
            'ND\\s+\\d'
          ],
          activo: true
        },
        ticket: {
          nombre: 'TICKET',
          patrones: [
            'TICKET\\s*FACTURA',
            '\\bTICKET\\b',
            'COMPROBANTE\\s+NO\\s+VALIDO'
          ],
          activo: true
        },
        recibo: {
          nombre: 'RECIBO',
          patrones: [
            'RECIBO\\s*\\d',
            'RECIBO\\s+OFICIAL',
            'RECIBO\\s+DE\\s+PAGO',
            '^RECIBO\\b'
          ],
          activo: true
        },
        remito: {
          nombre: 'REMITO',
          patrones: [
            '^REMITO\\b',
            '\\bREMITO\\s*\\d{4,}'
          ],
          activo: true
        }
      },
      prioridades: [
        { id: 'letra_sola_superior', nombre: 'Letra sola en zona superior (A, B, C, E, M)', orden: 1, activo: true },
        { id: 'factura_con_letra', nombre: 'FACTURA A/B/C/E/M', orden: 2, activo: true },
        { id: 'codigo_afip', nombre: 'Código AFIP (001, 006, 011, etc.)', orden: 3, activo: true },
        { id: 'notas_credito_debito', nombre: 'Notas de crédito/débito', orden: 4, activo: true },
        { id: 'ticket', nombre: 'Ticket', orden: 5, activo: true },
        { id: 'recibo', nombre: 'Recibo', orden: 6, activo: true },
        { id: 'factura_generica', nombre: 'FACTURA (sin especificar tipo)', orden: 7, activo: true },
        { id: 'remito', nombre: 'Remito', orden: 8, activo: true }
      ],
      opciones: {
        usarZonaSuperior: true,
        buscarLetraSola: true,
        logDetallado: true
      }
    };
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

      // Cargar configuración de detección
      const tenantId = options.tenantId || null;
      const config = await this.loadDetectionConfig(tenantId);

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

      // Extraer datos estructurados (pasar configuración)
      const extractedData = this.extractStructuredData(document, config);

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
  extractStructuredData(document, config = null) {
    const entities = document.entities || [];
    const data = {};

    // Usar configuración por defecto si no se provee
    if (!config) {
      config = this.getDefaultConfig();
    }

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
      'total_discount_amount': 'descuentoGlobal',

      // Campos específicos de Argentina (AFIP)
      'cae': 'caeExtraido',
      'cae_expiration': 'fechaVencimientoCAE'
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
        if (config.opciones?.logDetallado) {
          console.log(`   📋 ${mappedField}: "${value}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
        }
      }
    }

    // Extraer line items (items de la factura)
    data.lineItems = this.extractLineItems(document);
    if (config.opciones?.logDetallado) {
      console.log(`   📦 Line items extraídos: ${data.lineItems.length}`);
    }

    // Extraer impuestos detallados del texto (IVA, percepciones, retenciones)
    // Pasar el total de impuestos para validación (evitar capturar neto gravado)
    data.impuestosDetalle = this.extractImpuestosDetalleFromText(document.text || '', {
      totalImpuestos: data.impuestos,
      netoGravado: data.netoGravado,
      total: data.importe
    });
    if (config.opciones?.logDetallado) {
      console.log(`   💰 Impuestos detallados: ${data.impuestosDetalle.length}`);
    }

    // Extraer CAE y Fecha Vencimiento CAE del texto si no fueron detectados por entidades
    if (!data.caeExtraido) {
      const caeExtractado = this.extractCAEFromText(document.text || '');
      if (caeExtractado.cae) {
        data.caeExtraido = caeExtractado.cae;
        if (config.opciones?.logDetallado) {
          console.log(`   🔐 CAE extraído del texto: ${data.caeExtraido}`);
        }
      }
      if (caeExtractado.fechaVencimiento) {
        data.fechaVencimientoCAE = caeExtractado.fechaVencimiento;
        if (config.opciones?.logDetallado) {
          console.log(`   📅 Fecha Vto. CAE: ${data.fechaVencimientoCAE}`);
        }
      }
    }

    // Extraer observaciones del documento
    const observaciones = this.extractObservacionesFromText(document.text || '');
    if (observaciones) {
      data.observaciones = observaciones;
      if (config.opciones?.logDetallado) {
        console.log(`   📝 Observaciones: ${observaciones.substring(0, 100)}...`);
      }
    }

    // Validar y corregir totales si son inconsistentes
    this.validateAndFixTotals(data);

    // Calcular exento si no viene
    if (!data.exento && data.importe && data.netoGravado && data.impuestos) {
      data.exento = Math.max(0, data.importe - data.netoGravado - data.impuestos);
    }

    // Detectar tipo de comprobante (si no viene en Document AI) - pasar config
    if (!data.tipoComprobante) {
      data.tipoComprobante = this.detectTipoComprobante(document.text || '', document, config);
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
              case 'line_item/notes':
              case 'line_item/comments':
              case 'line_item/remarks':
                // Observaciones/notas a nivel de línea
                item.observaciones = this.getEntityValue(prop);
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
   * Soporta formatos argentinos e internacionales
   */
  normalizeDate(value) {
    if (!value) return null;

    // Si ya está en formato ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // Formato argentino: DD/MM/YYYY o DD-MM-YYYY
    const argentineMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (argentineMatch) {
      const [_, day, month, year] = argentineMatch;
      const d = day.padStart(2, '0');
      const m = month.padStart(2, '0');

      // Validar que sea una fecha válida
      const dateObj = new Date(`${year}-${m}-${d}`);
      if (!isNaN(dateObj.getTime())) {
        return `${year}-${m}-${d}`;
      }
    }

    // Formato USA: MM/DD/YYYY
    const usaMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (usaMatch) {
      // Ambiguo: podría ser DD/MM o MM/DD
      // Intentar adivinar basado en valores
      const [_, first, second, year] = usaMatch;

      // Si first > 12, debe ser día (formato argentino)
      if (parseInt(first) > 12) {
        const d = first.padStart(2, '0');
        const m = second.padStart(2, '0');
        return `${year}-${m}-${d}`;
      }

      // Si second > 12, debe ser día (formato USA)
      if (parseInt(second) > 12) {
        const m = first.padStart(2, '0');
        const d = second.padStart(2, '0');
        return `${year}-${m}-${d}`;
      }

      // Ambos <= 12: asumir formato argentino (DD/MM/YYYY)
      const d = first.padStart(2, '0');
      const m = second.padStart(2, '0');
      return `${year}-${m}-${d}`;
    }

    // Intentar parsear con Date() (último recurso)
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
   * Soporta formatos argentinos e internacionales:
   * - Argentina: 1.234,56 o 1234,56
   * - USA: 1,234.56 or 1234.56
   */
  normalizeAmount(value) {
    if (!value) return 0;

    // Si ya es número
    if (typeof value === 'number') {
      return value;
    }

    // Convertir a string y limpiar símbolos de moneda
    let cleaned = String(value).trim()
      .replace(/[$€£¥₹₱\s]/g, ''); // Remover símbolos de moneda y espacios

    // Detectar formato argentino vs USA
    const hasComma = cleaned.includes(',');
    const hasPeriod = cleaned.includes('.');

    // Determinar formato basado en posición de separadores
    if (hasComma && hasPeriod) {
      // Tiene ambos: 1.234,56 (argentino) o 1,234.56 (USA)
      const lastComma = cleaned.lastIndexOf(',');
      const lastPeriod = cleaned.lastIndexOf('.');

      if (lastComma > lastPeriod) {
        // Formato argentino: 1.234,56 → remover puntos, reemplazar coma
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato USA: 1,234.56 → solo remover comas
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma && !hasPeriod) {
      // Solo coma: puede ser 1234,56 (argentino) o 1,234 (USA miles)
      const parts = cleaned.split(',');

      if (parts.length === 2 && parts[1].length <= 2) {
        // Decimal argentino: 1234,56
        cleaned = cleaned.replace(',', '.');
      } else {
        // Separador de miles USA: 1,234 → remover coma
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    // Si solo tiene punto, asumir formato USA (ya está correcto)

    // Parsear el número limpio
    const parsed = parseFloat(cleaned);

    // Validar que sea un número razonable para una factura
    if (isNaN(parsed)) {
      console.warn(`⚠️  No se pudo parsear monto: "${value}" → cleaned: "${cleaned}"`);
      return 0;
    }

    // Redondear a 2 decimales
    return Math.round(parsed * 100) / 100;
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
   * Mejorado para facturas argentinas con múltiples patrones
   * Prioriza texto en la parte superior central (donde suele estar el tipo)
   */
  detectTipoComprobante(text, document = null, config = null) {
    if (!text) return 'FACTURA';

    // Usar configuración por defecto si no se provee
    if (!config) {
      config = this.getDefaultConfig();
    }

    // Si tenemos el documento completo, buscar primero en la zona superior central
    if (document && document.entities && config.opciones?.usarZonaSuperior) {
      const tipoFromLocation = this.detectTipoFromTopCenter(document, config);
      if (tipoFromLocation && tipoFromLocation !== 'FACTURA') {
        if (config.opciones?.logDetallado) {
          console.log(`   🎯 Tipo detectado en zona superior central: ${tipoFromLocation}`);
        }
        return tipoFromLocation;
      }
    }

    const textUpper = text.toUpperCase();
    const normalized = textUpper.replace(/\s+/g, ' ');

    // FACTURA A - Múltiples patrones
    if (
      /FACTURA\s*A\b/.test(normalized) ||
      /TIPO\s*:\s*A\b/.test(normalized) ||
      /CLASE\s*:\s*A\b/.test(normalized) ||
      /COD\.\s*001/.test(normalized) ||
      /CODIGO\s*001/.test(normalized) ||
      /\bA\s+ORIGINAL/.test(normalized) ||
      /\bA\s+DUPLICADO/.test(normalized)
    ) {
      console.log('   ✅ Detectado: FACTURA A');
      return 'FACTURA A';
    }

    // FACTURA B
    if (
      /FACTURA\s*B\b/.test(normalized) ||
      /TIPO\s*:\s*B\b/.test(normalized) ||
      /CLASE\s*:\s*B\b/.test(normalized) ||
      /COD\.\s*006/.test(normalized) ||
      /CODIGO\s*006/.test(normalized) ||
      /\bB\s+ORIGINAL/.test(normalized) ||
      /\bB\s+DUPLICADO/.test(normalized)
    ) {
      console.log('   ✅ Detectado: FACTURA B');
      return 'FACTURA B';
    }

    // FACTURA C
    if (
      /FACTURA\s*C\b/.test(normalized) ||
      /TIPO\s*:\s*C\b/.test(normalized) ||
      /CLASE\s*:\s*C\b/.test(normalized) ||
      /COD\.\s*011/.test(normalized) ||
      /CODIGO\s*011/.test(normalized) ||
      /\bC\s+ORIGINAL/.test(normalized) ||
      /\bC\s+DUPLICADO/.test(normalized)
    ) {
      console.log('   ✅ Detectado: FACTURA C');
      return 'FACTURA C';
    }

    // FACTURA E (Exportación)
    if (
      /FACTURA\s*E\b/.test(normalized) ||
      /TIPO\s*:\s*E\b/.test(normalized) ||
      /FACTURA\s+DE\s+EXPORTACION/.test(normalized) ||
      /COD\.\s*019/.test(normalized)
    ) {
      console.log('   ✅ Detectado: FACTURA E');
      return 'FACTURA E';
    }

    // FACTURA M (Monotributista)
    if (
      /FACTURA\s*M\b/.test(normalized) ||
      /TIPO\s*:\s*M\b/.test(normalized) ||
      /COD\.\s*051/.test(normalized)
    ) {
      console.log('   ✅ Detectado: FACTURA M');
      return 'FACTURA M';
    }

    // NOTA DE CRÉDITO
    if (
      /NOTA\s+DE\s+CREDITO/.test(normalized) ||
      /NOTA\s+CREDITO/.test(normalized) ||
      /N\/C/.test(normalized) ||
      /NC\s+\d/.test(normalized)
    ) {
      console.log('   ✅ Detectado: NOTA DE CRÉDITO');
      return 'NOTA DE CRÉDITO';
    }

    // NOTA DE DÉBITO
    if (
      /NOTA\s+DE\s+DEBITO/.test(normalized) ||
      /NOTA\s+DEBITO/.test(normalized) ||
      /N\/D/.test(normalized) ||
      /ND\s+\d/.test(normalized)
    ) {
      console.log('   ✅ Detectado: NOTA DE DÉBITO');
      return 'NOTA DE DÉBITO';
    }

    // TICKET
    if (
      /TICKET\s*FACTURA/.test(normalized) ||
      /\bTICKET\b/.test(normalized) ||
      /COMPROBANTE\s+NO\s+VALIDO/.test(normalized)
    ) {
      console.log('   ✅ Detectado: TICKET');
      return 'TICKET';
    }

    // RECIBO - Solo si dice "RECIBO" seguido de número o palabras clave
    if (
      /RECIBO\s*\d/.test(normalized) ||
      /RECIBO\s+OFICIAL/.test(normalized) ||
      /RECIBO\s+DE\s+PAGO/.test(normalized) ||
      /^RECIBO\b/.test(normalized)  // RECIBO al inicio
    ) {
      console.log('   ✅ Detectado: RECIBO');
      return 'RECIBO';
    }

    // Fallback: buscar "FACTURA" genérica (ANTES de REMITO)
    if (/FACTURA/.test(normalized)) {
      console.log('   ⚠️  Detectado: FACTURA (tipo no especificado)');
      return 'FACTURA';
    }

    // REMITO - Solo si no encontramos "FACTURA" (última prioridad)
    // Evita detectar "REMITO: 12345" dentro de una factura
    if (/^REMITO\b/.test(normalized) || /\bREMITO\s*\d{4,}/.test(normalized)) {
      console.log('   ✅ Detectado: REMITO');
      return 'REMITO';
    }

    console.log('   ⚠️  No se pudo detectar tipo de comprobante');
    return 'FACTURA';
  }

  /**
   * Detectar tipo de comprobante buscando específicamente en la zona superior central
   * En facturas argentinas, la letra (A, B, C) suele estar en un recuadro arriba al centro
   */
  detectTipoFromTopCenter(document, config = null) {
    const entities = document.entities || [];

    // Usar configuración por defecto si no se provee
    if (!config) {
      config = this.getDefaultConfig();
    }

    const zona1 = config.zonaBusqueda.zona1;
    const zona2 = config.zonaBusqueda.zona2;

    // ZONA 1: Configuración personalizada
    let topCenterEntities = entities.filter(entity => {
      if (!entity.pageAnchor || !entity.pageAnchor.pageRefs) {
        return false;
      }

      const pageRef = entity.pageAnchor.pageRefs[0];
      if (!pageRef || !pageRef.boundingPoly || !pageRef.boundingPoly.normalizedVertices) {
        return false;
      }

      const vertices = pageRef.boundingPoly.normalizedVertices;
      if (vertices.length < 2) return false;

      const topY = vertices[0].y || 0;
      const leftX = vertices[0].x || 0;
      const rightX = vertices[1]?.x || leftX;
      const centerX = (leftX + rightX) / 2;

      const isTopArea = topY < zona1.topY;
      const isCenterArea = centerX > zona1.centerXMin && centerX < zona1.centerXMax;

      return isTopArea && isCenterArea;
    });

    if (config.opciones?.logDetallado) {
      console.log(`   🔍 ${zona1.nombre}: ${topCenterEntities.length} elementos`);
    }

    // Si no encontró nada, expandir búsqueda a ZONA 2
    if (topCenterEntities.length === 0) {
      topCenterEntities = entities.filter(entity => {
        if (!entity.pageAnchor || !entity.pageAnchor.pageRefs) {
          return false;
        }

        const pageRef = entity.pageAnchor.pageRefs[0];
        if (!pageRef || !pageRef.boundingPoly || !pageRef.boundingPoly.normalizedVertices) {
          return false;
        }

        const vertices = pageRef.boundingPoly.normalizedVertices;
        if (vertices.length < 2) return false;

        const topY = vertices[0].y || 0;
        const leftX = vertices[0].x || 0;
        const rightX = vertices[1]?.x || leftX;
        const centerX = (leftX + rightX) / 2;

        const isTopArea = topY < zona2.topY;
        const isCenterArea = centerX > zona2.centerXMin && centerX < zona2.centerXMax;

        return isTopArea && isCenterArea;
      });

      if (config.opciones?.logDetallado) {
        console.log(`   🔍 ${zona2.nombre}: ${topCenterEntities.length} elementos`);
      }
    }

    // PRIMERA PASADA: Buscar letra sola en recuadro (máxima prioridad)
    for (const entity of topCenterEntities) {
      const text = (entity.mentionText || '').toUpperCase().trim();

      // Buscar letra sola: A, B, C, E, M
      if (/^[ABCEM]$/.test(text)) {
        console.log(`   🎯 Letra encontrada en recuadro superior: "${text}"`);
        return `FACTURA ${text}`;
      }
    }

    // SEGUNDA PASADA: Buscar "FACTURA X" o códigos AFIP
    for (const entity of topCenterEntities) {
      const text = (entity.mentionText || '').toUpperCase();

      // Buscar "FACTURA X"
      if (/FACTURA\s*[ABCEM]\b/.test(text)) {
        const match = text.match(/FACTURA\s*([ABCEM])\b/);
        if (match) {
          console.log(`   🎯 "FACTURA ${match[1]}" encontrada en zona superior`);
          return `FACTURA ${match[1]}`;
        }
      }

      // Buscar códigos AFIP
      if (/COD(?:IGO)?\s*\.?\s*001/.test(text)) {
        console.log(`   🎯 Código AFIP 001 (FACTURA A) encontrado`);
        return 'FACTURA A';
      }
      if (/COD(?:IGO)?\s*\.?\s*006/.test(text)) {
        console.log(`   🎯 Código AFIP 006 (FACTURA B) encontrado`);
        return 'FACTURA B';
      }
      if (/COD(?:IGO)?\s*\.?\s*011/.test(text)) {
        console.log(`   🎯 Código AFIP 011 (FACTURA C) encontrado`);
        return 'FACTURA C';
      }
      if (/COD(?:IGO)?\s*\.?\s*019/.test(text)) {
        console.log(`   🎯 Código AFIP 019 (FACTURA E) encontrado`);
        return 'FACTURA E';
      }
      if (/COD(?:IGO)?\s*\.?\s*051/.test(text)) {
        console.log(`   🎯 Código AFIP 051 (FACTURA M) encontrado`);
        return 'FACTURA M';
      }
    }

    // No encontrado en zona superior central
    console.log(`   ⚠️  No se encontró tipo específico en zona superior central`);
    return null;
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
   * Validar y corregir totales inconsistentes
   * Document AI a veces confunde decimales argentinos con números grandes
   */
  validateAndFixTotals(data) {
    const { importe, netoGravado, impuestos } = data;

    // Si los impuestos son mayores que el total, algo está mal
    if (impuestos && importe && impuestos > importe) {
      console.warn(`⚠️  Impuestos (${impuestos}) > Total (${importe}). Probable error de formato.`);

      // Intentar corregir: probablemente Document AI leyó mal los decimales
      // Si impuestos es ~1000x el total, dividir por 1000
      if (impuestos > importe * 10) {
        const correctedImpuestos = Math.round(impuestos / 100) / 100;
        console.log(`   🔧 Corrigiendo impuestos: ${impuestos} → ${correctedImpuestos}`);
        data.impuestos = correctedImpuestos;
      }
    }

    // Si neto gravado es mayor que el total, algo está mal
    if (netoGravado && importe && netoGravado > importe) {
      console.warn(`⚠️  Neto Gravado (${netoGravado}) > Total (${importe}). Probable error de formato.`);

      if (netoGravado > importe * 10) {
        const correctedNeto = Math.round(netoGravado / 100) / 100;
        console.log(`   🔧 Corrigiendo neto gravado: ${netoGravado} → ${correctedNeto}`);
        data.netoGravado = correctedNeto;
      }
    }

    // Validar que la suma tenga sentido: Total ≈ Neto + Impuestos
    if (importe && netoGravado && impuestos) {
      const expectedTotal = netoGravado + impuestos + (data.exento || 0);
      const difference = Math.abs(expectedTotal - importe);

      // Si la diferencia es > 10% del total, algo está mal
      if (difference > importe * 0.1) {
        console.warn(`⚠️  Total no coincide con suma de componentes:`);
        console.warn(`   Total: ${importe}`);
        console.warn(`   Neto + Impuestos: ${expectedTotal}`);
        console.warn(`   Diferencia: ${difference}`);
      }
    }
  }

  /**
   * Extraer impuestos detallados del texto del documento
   * Similar a extractImpuestosDetalleFromText de documentProcessor.js
   *
   * @param {string} text - Texto del documento
   * @param {object} validacion - Valores de referencia para validar (opcional)
   * @param {number} validacion.totalImpuestos - Total de impuestos detectado por Document AI
   * @param {number} validacion.netoGravado - Neto gravado detectado
   * @param {number} validacion.total - Total del documento
   */
  extractImpuestosDetalleFromText(text, validacion = {}) {
    const impuestos = [];

    if (!text) return impuestos;

    // DEBUG MEJORADO: Mostrar fragmento de texto alrededor de "Percepcion" o "IIBB" CON CONTEXTO
    const debugMatch = text.match(/(Subtotal|Percepci[oó]n|IIBB).{0,200}/gi);
    if (debugMatch) {
      console.log('📝 [DEBUG] Texto encontrado con Percepcion/IIBB/Subtotal:');
      debugMatch.forEach((snippet, i) => {
        // Mostrar con saltos de línea visibles y caracteres especiales
        const visible = snippet
          .replace(/\n/g, '↵\n')  // Marcar saltos de línea
          .replace(/\r/g, '⏎')     // Marcar carriage return
          .replace(/\t/g, '→');    // Marcar tabs
        console.log(`   ${i + 1}. "${visible}"`);
      });

      // DEBUG EXTRA: Mostrar código de caracteres después de "Percepcion IIBB :"
      const percMatch = text.match(/Perc(?:epci[oó]n)?\s+IIBB\s*[:].{0,50}/i);
      if (percMatch) {
        console.log('\n🔍 [DEBUG DETALLADO] Caracteres después de "Percepcion IIBB :":');
        const chars = percMatch[0].split('');
        chars.slice(0, 30).forEach((char, i) => {
          const code = char.charCodeAt(0);
          const display = char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : char === ' ' ? '·' : char;
          console.log(`      [${i}] '${display}' (code: ${code})`);
        });
      }
    }

    // 1. IVA con alícuotas específicas
    const ivaPatterns = [
      // "IVA 21%: $1.000,00" o "IVA 21.00%  $1.000,00"
      /IVA\s+([\d.,]+)%?\s*[:.]?\s*\$?\s*([\d.,]+)/gi,
      // "21.00%  $1.000,00  $1.000,00" (alicuota, base, importe)
      /([\d.,]+)%\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/g
    ];

    for (const pattern of ivaPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const alicuota = this.normalizeAmount(match[1]);
        const importe = this.normalizeAmount(match[2]);
        const baseImponible = match[3] ? this.normalizeAmount(match[3]) : null;

        if (alicuota > 0 && importe > 0) {
          impuestos.push({
            tipo: 'IVA',
            descripcion: `IVA ${alicuota}%`,
            alicuota: alicuota,
            baseImponible: baseImponible,
            importe: importe
          });
        }
      }
    }

    // 2. Percepciones
    // ESTRATEGIA: Buscar "Percepcion IIBB" y luego buscar el número MÁS CERCANO que sea menor al subtotal
    // Esto evita capturar el Subtotal como si fuera el impuesto
    const percepcionPatterns = [
      // "IIBB  5.00%  $1000.00  $50.00" (formato tabla con alícuota)
      /IIBB\s+([\d.,]+)%\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/gi,
      // "Percepción IIBB : 47,448.00" (en la misma línea o máximo 50 caracteres adelante)
      // Captura hasta 50 caracteres después de ":" para encontrar el número
      /Perc(?:epci[oó]n)?\s+IIBB\s*[:]\s*([^\n]{0,50}?)([\d.,]+)/gi,
      // "Perc. IIBB: $100,00" o "Percepción Ingresos Brutos: $100,00"
      /Perc(?:epci[oó]n)?\.?\s+(?!(?:Sub)?Total|Neto)([A-ZÑ\s]+?)\s*[:]\s*([^\n]{0,50}?)([\d.,]+)/gi
    ];

    for (const pattern of percepcionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let descripcion, alicuota, baseImponible, importe;

        console.log(`🔍 [Percepción] Match encontrado: "${match[0]}"`);
        console.log(`   match[1]: "${match[1]}", match[2]: "${match[2]}", match[3]: "${match[3]}", match[4]: "${match[4]}"`);

        // ⚠️ VALIDACIÓN: Excluir falsos positivos (Subtotal, Total, Neto)
        const matchText = match[0].toUpperCase();
        if (matchText.includes('SUBTOTAL') || matchText.includes('TOTAL') || matchText.includes('NETO')) {
          console.log(`   ⚠️ Descartado: "${match[0]}" (no es un impuesto, es un total)`);
          continue;
        }

        // Detectar qué patrón hizo match basado en la estructura y número de grupos
        if (match[3] && !match[4]) {
          // Patrón 1: "IIBB 5.00% $1000.00 $50.00" (3 grupos: alícuota, base, importe)
          alicuota = this.normalizeAmount(match[1]);
          baseImponible = this.normalizeAmount(match[2]);
          importe = this.normalizeAmount(match[3]);
          descripcion = 'Percepción IIBB';
          console.log(`   ✅ Patrón tabla con %: alícuota=${alicuota}%, base=${baseImponible}, importe=${importe}`);
        } else if (match[0].match(/Perc(?:epci[oó]n)?\s+IIBB/i) && match[2]) {
          // Patrón 2: "Percepcion IIBB : [basura] 47,448.00" (2 grupos: basura + importe)
          // El grupo 1 es basura (espacios, saltos de línea), el grupo 2 es el importe
          importe = this.normalizeAmount(match[2]);
          descripcion = 'Percepción IIBB';
          alicuota = null;
          baseImponible = null;
          console.log(`   ✅ Patrón IIBB con ventana: importe=${importe}`);
        } else if (match[4]) {
          // Patrón 3: "Percepción XXX : [basura] $100,00" (3 grupos: descripción, basura, importe)
          descripcion = `Percepción ${match[1]?.trim() || 'IIBB'}`;
          importe = this.normalizeAmount(match[3]);
          alicuota = null;
          baseImponible = null;
          console.log(`   ✅ Patrón genérico con ventana: descripción="${descripcion}", importe=${importe}`);
        } else {
          console.log(`   ⚠️ Patrón no reconocido, descartando`);
          continue;
        }

        if (importe > 0) {
          // ⚠️ VALIDACIÓN CRÍTICA: Evitar guardar el neto gravado como impuesto
          // Si el importe capturado coincide con el neto gravado, es un error de parsing
          if (validacion.netoGravado && Math.abs(importe - validacion.netoGravado) < 1) {
            console.log(`   ⚠️ Descartado: importe ${importe} coincide con neto gravado (error de parsing)`);
            continue;
          }

          // Si tenemos el total de impuestos de Document AI y es muy diferente, advertir
          if (validacion.totalImpuestos && Math.abs(importe - validacion.totalImpuestos) > validacion.totalImpuestos * 0.5) {
            console.log(`   ⚠️ Advertencia: importe ${importe} muy diferente del total de impuestos ${validacion.totalImpuestos}`);
            // No lo descartamos completamente porque podría ser un impuesto individual
          }

          impuestos.push({
            tipo: 'PERCEPCION',
            descripcion: descripcion,
            alicuota: alicuota,
            baseImponible: baseImponible,
            importe: importe
          });
        }
      }
    }

    // 3. Retenciones
    const retencionPatterns = [
      // "Retención Ganancias: $50,00" o "Ret. Ganancias  $50,00"
      /Ret(?:enci[oó]n)?\.?\s+([A-ZÑ\s]+)\s*[:.]?\s*\$?\s*([\d.,]+)/gi
    ];

    for (const pattern of retencionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const descripcionMatch = match[1]?.trim();
        const importe = this.normalizeAmount(match[2]);

        if (importe > 0) {
          impuestos.push({
            tipo: 'RETENCION',
            descripcion: `Retención ${descripcionMatch}`,
            alicuota: null,
            baseImponible: null,
            importe: importe
          });
        }
      }
    }

    // 4. Impuestos Internos
    const impInternosPatterns = [
      // "Impuestos Internos: $100,00"
      /Imp(?:uestos?)?\s+Internos?\s*[:.]?\s*\$?\s*([\d.,]+)/gi
    ];

    for (const pattern of impInternosPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const importe = this.normalizeAmount(match[1]);

        if (importe > 0) {
          impuestos.push({
            tipo: 'IMPUESTO_INTERNO',
            descripcion: 'Impuestos Internos',
            alicuota: null,
            baseImponible: null,
            importe: importe
          });
        }
      }
    }

    // Si NO se encontraron impuestos detallados PERO Document AI detectó un total de impuestos,
    // crear un impuesto genérico con el valor correcto
    if (impuestos.length === 0 && validacion.totalImpuestos && validacion.totalImpuestos > 0) {
      console.log(`   ℹ️  No se encontraron impuestos detallados en texto, usando total de Document AI: ${validacion.totalImpuestos}`);
      impuestos.push({
        tipo: 'PERCEPCION',
        descripcion: 'Percepción IIBB',
        alicuota: null,
        baseImponible: validacion.netoGravado || null,
        importe: validacion.totalImpuestos
      });
    }

    // Eliminar duplicados (mismo tipo, descripción e importe)
    const uniqueImpuestos = [];
    const seen = new Set();

    for (const imp of impuestos) {
      const key = `${imp.tipo}_${imp.descripcion}_${imp.importe}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueImpuestos.push(imp);
      }
    }

    return uniqueImpuestos;
  }

  /**
   * Extraer CAE (Código de Autorización Electrónico) del texto
   * Formato típico: "CAE: 75467757407997" o "CAE 75467757407997"
   */
  extractCAEFromText(text) {
    const result = { cae: null, fechaVencimiento: null };

    if (!text) return result;

    // Patrón para CAE: 14 dígitos
    const caePattern = /CAE\s*:?\s*(\d{14})/i;
    const caeMatch = text.match(caePattern);

    if (caeMatch) {
      result.cae = caeMatch[1];
    }

    // Patrón para Fecha Vencimiento CAE
    // "Fecha Vto. CAE: 29/11/2025" o "Vencimiento CAE: 29/11/2025"
    const fechaVtoPattern = /(?:Fecha\s+)?Vto\.?\s*(?:CAE|del\s+CAE)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i;
    const fechaMatch = text.match(fechaVtoPattern);

    if (fechaMatch) {
      result.fechaVencimiento = this.normalizeDate(fechaMatch[1]);
    }

    return result;
  }

  /**
   * Extraer observaciones del texto del documento
   * Busca secciones típicas como "Observaciones:", "Notas:", "Comentarios:", etc.
   */
  extractObservacionesFromText(text) {
    if (!text) return null;

    // Patrones para detectar sección de observaciones
    const patterns = [
      // "Observaciones: texto hasta fin de línea o siguiente sección"
      /Observaciones?\s*:?\s*\n?(.*?)(?:\n(?:[A-Z]{2,}|CAE|TOTAL|Subtotal)|$)/is,
      // "Notas: ..."
      /Notas?\s*:?\s*\n?(.*?)(?:\n(?:[A-Z]{2,}|CAE|TOTAL|Subtotal)|$)/is,
      // "Comentarios: ..."
      /Comentarios?\s*:?\s*\n?(.*?)(?:\n(?:[A-Z]{2,}|CAE|TOTAL|Subtotal)|$)/is,
      // "Observación: ..."
      /Observaci[oó]n\s*:?\s*\n?(.*?)(?:\n(?:[A-Z]{2,}|CAE|TOTAL|Subtotal)|$)/is
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const observacion = match[1].trim();
        // Solo retornar si tiene contenido significativo (más de 3 caracteres)
        if (observacion.length > 3) {
          return observacion;
        }
      }
    }

    return null;
  }

  /**
   * Verificar si Document AI está configurado
   */
  isConfigured() {
    return !!(this.projectId && this.processorId);
  }
}

module.exports = new DocumentAIProcessor();
