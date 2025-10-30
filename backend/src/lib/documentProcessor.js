const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const promptManager = require('../services/promptManager');

class DocumentProcessor {
  constructor() {
    this.tesseractWorker = null;
  }

  async initTesseract() {
    if (!this.tesseractWorker) {
      this.tesseractWorker = await createWorker(['spa', 'eng']);
    }
    return this.tesseractWorker;
  }

  async processPDF(filePath) {
    try {
      console.log(`Iniciando procesamiento de PDF: ${filePath}`);
      const startTime = Date.now();

      const dataBuffer = fs.readFileSync(filePath);
      console.log(`PDF leído en memoria: ${dataBuffer.length} bytes`);

      const data = await pdfParse(dataBuffer);
      const processingTime = Date.now() - startTime;

      console.log(`PDF procesado exitosamente en ${processingTime}ms - Páginas: ${data.numpages}, Caracteres de texto: ${data.text?.length || 0}`);

      return {
        text: data.text,
        pages: data.numpages,
        success: true
      };
    } catch (error) {
      console.error('Error processing PDF:', error);
      return {
        text: '',
        success: false,
        error: error.message
      };
    }
  }

  async processImage(filePath) {
    try {
      // Optimizar imagen para OCR
      const processedImagePath = path.join(path.dirname(filePath), 'processed_' + path.basename(filePath));
      
      await sharp(filePath)
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(processedImagePath);

      const worker = await this.initTesseract();
      const { data: { text } } = await worker.recognize(processedImagePath);
      
      // Limpiar archivo temporal
      if (fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }

      return {
        text: text,
        success: true
      };
    } catch (error) {
      console.error('Error processing image:', error);
      return {
        text: '',
        success: false,
        error: error.message
      };
    }
  }

  async extractData(text) {
    let extractedData = {};
    
    try {
      // Intentar primero con métodos avanzados si están habilitados
      if (process.env.ENABLE_AI_EXTRACTION === 'true') {
        try {
          const aiResult = await this.extractDataWithAI(text);
          if (aiResult && aiResult.data) {
            console.log(`Datos extraídos exitosamente con método avanzado`);

            // Si la IA no devolvió lineItems o impuestosDetalle, intentar con regex
            const lineItems = aiResult.data.lineItems && aiResult.data.lineItems.length > 0
              ? aiResult.data.lineItems
              : this.extractLineItemsFromText(text);

            const impuestosDetalle = aiResult.data.impuestosDetalle && aiResult.data.impuestosDetalle.length > 0
              ? aiResult.data.impuestosDetalle
              : this.extractImpuestosDetalleFromText(text);

            return {
              ...aiResult.data,
              lineItems,
              impuestosDetalle
              // Nota: No exponer detalles del método al usuario
            };
          }
        } catch (aiError) {
          console.log('IA no disponible, usando extracción local:', aiError.message);
        }
      }

      // Fallback a extracción con patrones regulares (siempre ejecutar)
      console.log('Usando extracción con patrones regulares');
      
      try {
        extractedData.fecha = this.extractFecha(text);
      } catch (e) { console.log('Error extrayendo fecha:', e.message); }
      
      try {
        extractedData.importe = this.extractImporte(text);
      } catch (e) { console.log('Error extrayendo importe:', e.message); }
      
      try {
        extractedData.cuit = this.extractCUIT(text);
      } catch (e) { console.log('Error extrayendo CUIT:', e.message); }
      
      try {
        extractedData.numeroComprobante = this.extractNumeroComprobante(text);
      } catch (e) { console.log('Error extrayendo número comprobante:', e.message); }
      
      try {
        extractedData.cae = this.extractCAE(text);
      } catch (e) { console.log('Error extrayendo CAE:', e.message); }
      
      try {
        extractedData.razonSocial = this.extractRazonSocial(text);
      } catch (e) { console.log('Error extrayendo razón social:', e.message); }
      
      try {
        extractedData.netoGravado = this.extractNetoGravado(text);
        console.log('🔍 [EXTRACCIÓN] Neto Gravado extraído:', extractedData.netoGravado);
      } catch (e) { console.log('Error extrayendo neto gravado:', e.message); }

      try {
        extractedData.exento = this.extractExento(text, { checkForTaxes: true });
        console.log('🔍 [EXTRACCIÓN] Exento extraído:', extractedData.exento);
      } catch (e) { console.log('Error extrayendo exento:', e.message); }

      // DETECCIÓN TEMPRANA DEL ERROR
      if (extractedData.netoGravado && extractedData.exento &&
          parseFloat(extractedData.netoGravado) === parseFloat(extractedData.exento) &&
          parseFloat(extractedData.netoGravado) > 0) {
        console.log('🚨 [ERROR EN EXTRACCIÓN] GRAVADO = EXENTO detectado en extracción inicial!', {
          gravado: extractedData.netoGravado,
          exento: extractedData.exento
        });
        // Forzar exento a 0 para que la validación posterior lo calcule correctamente
        extractedData.exento = 0;
        console.log('🔧 [CORRECCIÓN TEMPRANA] Forzando exento a 0 para recálculo posterior');
      }
      
      try {
        extractedData.impuestos = this.extractImpuestos(text);
      } catch (e) { console.log('Error extrayendo impuestos:', e.message); }
      
      try {
        extractedData.cupon = this.extractCupon(text);
      } catch (e) { console.log('Error extrayendo cupón:', e.message); }
      
      try {
        extractedData.tipoComprobante = this.extractTipoComprobante(text);
      } catch (e) { console.log('Error extrayendo tipo comprobante:', e.message); }

      try {
        extractedData.datosEmisor = this.extractDatosEmisor(text);
      } catch (e) { console.log('Error extrayendo datos emisor:', e.message); }

      // Extraer line items y detalle de impuestos
      try {
        extractedData.lineItems = this.extractLineItemsFromText(text);
      } catch (e) { console.log('Error extrayendo line items:', e.message); extractedData.lineItems = []; }

      try {
        extractedData.impuestosDetalle = this.extractImpuestosDetalleFromText(text);
      } catch (e) { console.log('Error extrayendo impuestos detallados:', e.message); extractedData.impuestosDetalle = []; }

      // Validar y corregir valores usando la fórmula EXENTO = TOTAL - GRAVADO - IMPUESTOS
      this.validateAndCorrectAmounts(extractedData);

      console.log('Extracción local completada con los datos disponibles');
      return extractedData;
      
    } catch (error) {
      console.error('Error crítico en extractData:', error);
      // Incluso en caso de error crítico, devolver un objeto vacío en lugar de null
      console.log('Devolviendo objeto vacío debido a error crítico');
      return {};
    }
  }

  async extractDataWithAI(text, tenantId = null) {
    try {
      // Opción 1: Google Gemini (PRIORIDAD - usar primero)
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'tu-api-key-aqui') {
        try {
          console.log('Intentando extracción con Gemini...');
          // Reducir delay para evitar timeouts - solo 1 segundo
          await new Promise(resolve => setTimeout(resolve, 1000));
          const data = await this.extractWithGemini(text, tenantId, 0); // Sin reintentos para evitar timeout
          if (data) {
            console.log('Extracción exitosa con Gemini');
            // Validar y corregir valores usando la fórmula
            this.validateAndCorrectAmounts(data);
            // Post-procesar datos para mejorar número de comprobante si es necesario
            const processedData = this.postProcessExtractedData(data, text);
            return { data: processedData, modelUsed: 'Advanced' }; // Sin exponer detalles
          }
        } catch (error) {
          console.error('Error con Gemini, continuando con fallback:', error.message);
        }
      } else {
        console.log('API Key de Gemini no disponible o inválido');
      }
      
      // Opción 2: Anthropic Claude (segundo - fallback si Gemini falla)
      if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'tu-api-key-aqui') {
        try {
          console.log('Intentando extracción con Anthropic Claude (fallback)...');
          const data = await this.extractWithClaude(text, tenantId);
          if (data) {
            console.log('Extracción exitosa con Anthropic');
            // Post-procesar datos para mejorar número de comprobante si es necesario
            const processedData = this.postProcessExtractedData(data, text);
            return { data: processedData, modelUsed: 'Advanced' }; // Sin exponer detalles
          }
        } catch (error) {
          console.error('Error con Anthropic, usando fallback local:', error.message);
        }
      } else {
        console.log('API Key de Anthropic no disponible o inválido');
      }

      // Opción 3: OpenAI (tercer lugar)
      if (process.env.OPENAI_API_KEY) {
        console.log('Intentando extracción con OpenAI...');
        const data = await this.extractWithOpenAI(text, tenantId);
        if (data) {
          console.log('Extracción exitosa con OpenAI');
          return { data, modelUsed: 'Advanced' }; // Sin exponer detalles
        }
      }
      
      // Opción 4: Local (para logs internos solamente)
      if (process.env.OLLAMA_ENABLED === 'true') {
        const data = await this.extractWithOllama(text);
        if (data) {
          return { data, modelUsed: 'Advanced' }; // Sin exponer detalles
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error with AI extraction:', error);
      return null;
    }
  }

  async extractWithOpenAI(text, tenantId = null) {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Obtener prompt desde PromptManager
      const prompt = await promptManager.getPromptText(
        'EXTRACCION_FACTURA_OPENAI',
        { text },
        tenantId,
        'openai'
      );

      if (!prompt) {
        console.error('❌ Prompt EXTRACCION_FACTURA_OPENAI no encontrado');
        return null;
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Modelo más económico
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.1,
      });

      const jsonResponse = response.choices[0].message.content.trim();
      const result = JSON.parse(jsonResponse);

      // Registrar resultado exitoso
      await promptManager.registrarResultado('EXTRACCION_FACTURA_OPENAI', true, tenantId, 'openai');

      return result;
    } catch (error) {
      console.error('Error with OpenAI extraction:', error);

      // Registrar resultado fallido
      await promptManager.registrarResultado('EXTRACCION_FACTURA_OPENAI', false, tenantId, 'openai').catch(() => {});

      return null;
    }
  }

  async extractWithClaude(text, tenantId = null) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      // Obtener prompt desde PromptManager
      const prompt = await promptManager.getPromptText(
        'EXTRACCION_FACTURA_CLAUDE',
        { text },
        tenantId,
        'anthropic'
      );

      if (!prompt) {
        console.error('❌ Prompt EXTRACCION_FACTURA_CLAUDE no encontrado');
        return null;
      }

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Modelo más económico
        max_tokens: 3000, // Aumentado para permitir line items e impuestos detallados
        messages: [{ role: 'user', content: prompt }],
      });

      let jsonText = response.content[0].text;

      // Limpiar respuesta de Claude (puede incluir texto introductorio)
      console.log('Raw Claude response:', jsonText);

      // Extraer JSON del texto
      jsonText = jsonText
        .replace(/```json\n?/g, '')  // Remove markdown
        .replace(/\n?```/g, '')
        .replace(/^[^{]*{/, '{')     // Remove text before first {
        .replace(/}[^}]*$/, '}')     // Remove text after last }
        .trim();

      console.log('Cleaned Claude JSON:', jsonText);

      const result = JSON.parse(jsonText);
      // Registrar éxito
      await promptManager.registrarResultado('EXTRACCION_FACTURA_CLAUDE', true, tenantId, 'anthropic');
      return result;
    } catch (error) {
      console.error('Error with Claude extraction:', error);
      await promptManager.registrarResultado('EXTRACCION_FACTURA_CLAUDE', false, tenantId, 'anthropic').catch(() => {});
      return null;
    }
  }

  async extractWithAnthropic(text, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const prompt = `Extrae de esta factura argentina y devuelve SOLO un objeto JSON válido sin texto adicional:

REGLAS IMPORTANTES:
- importe: Si ves "145,000.00" extraer como 145000, NO como 145
- tipoComprobante: Buscar la letra EXACTA (A, B, C) en un recuadro en el CENTRO SUPERIOR de la hoja, NO asumir A por defecto
- razonSocial: Tomar la PRIMERA razón social que encuentres al leer de arriba hacia abajo. NO la segunda, tercera, etc. Solo la primera
- cuit: CUIT del emisor (formato XX-XXXXXXXX-X) - tomar el PRIMER CUIT que encuentres cerca de "Ingresos Brutos" o "Inicio de Actividades". NO tomar CUITs que aparezcan después

{
  "fecha": "YYYY-MM-DD",
  "importe": número,
  "cuit": "XX-XXXXXXXX-X",
  "numeroComprobante": "XXXXX-XXXXXXXX",
  "cae": "14 dígitos numéricos",
  "tipoComprobante": "FACTURA A/B/C o NOTA DE CREDITO A/B/C o NOTA DE DEBITO A/B/C",
  "razonSocial": "razón social del emisor",
  "netoGravado": número,
  "exento": número,
  "impuestos": número,
  "cupon": "número de cupón si es pago con tarjeta"
}

Texto del documento:
${text}`;

        const message = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307', // Modelo rápido y económico
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        const responseText = message.content[0].text;
        console.log('Raw Anthropic response:', responseText);
        
        // Extraer JSON del texto de respuesta
        let jsonText = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        console.log('Extracted JSON from Anthropic:', jsonText);
        return JSON.parse(jsonText);
        
      } catch (error) {
        console.error(`Error with Anthropic extraction (attempt ${attempt + 1}):`, error.message);
        
        if (attempt === retries) {
          return null;
        }
        
        // Esperar antes de reintentar
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return null;
  }

  async extractWithGemini(text, tenantId = null, retries = 0) { // Reducido a 1 intento para evitar rate limit
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Obtener prompt desde PromptManager
        const prompt = await promptManager.getPromptText(
          'EXTRACCION_FACTURA_GEMINI',
          { text },
          tenantId,
          'gemini'
        );

        if (!prompt) {
          console.error('❌ Prompt EXTRACCION_FACTURA_GEMINI no encontrado');
          return null;
        }

        const result = await model.generateContent(prompt);
        let jsonText = result.response.text();
        
        // Log the raw response for debugging
        console.log('Raw Gemini response:', jsonText);
        
        // Clean the response more thoroughly
        jsonText = jsonText
          .replace(/```json\n?/g, '')  // Remove opening markdown
          .replace(/\n?```/g, '')      // Remove closing markdown
          .replace(/^[^{]*{/, '{')     // Remove any text before the first {
          .replace(/}[^}]*$/, '}')     // Remove any text after the last }
          .replace(/\/\/.*$/gm, '')    // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
          .trim();
        
        // Log cleaned JSON for debugging
        console.log('Cleaned JSON text:', jsonText);
        
        try {
          const data = JSON.parse(jsonText);
          // Registrar éxito
          await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', true, tenantId, 'gemini');
          return data;
        } catch (parseError) {
          console.error('JSON parse error:', parseError.message);
          console.error('Failed JSON text:', jsonText);

          // Try additional cleaning if JSON.parse fails
          try {
            // Remove any trailing commas and additional cleanup
            const cleanedJson = jsonText
              .replace(/,(\s*[}\]])/g, '$1')        // Remove trailing commas
              .replace(/\/\/.*$/gm, '')             // Remove single-line comments again
              .replace(/\/\*[\s\S]*?\*\//g, '')     // Remove multi-line comments again
              .replace(/,\s*}/g, '}')               // Remove trailing commas before }
              .replace(/,\s*]/g, ']');              // Remove trailing commas before ]
            console.log('Re-cleaned JSON:', cleanedJson);
            const data = JSON.parse(cleanedJson);
            // Registrar éxito
            await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', true, tenantId, 'gemini');
            return data;
          } catch (secondParseError) {
            console.error('Second JSON parse also failed:', secondParseError.message);
            throw parseError; // Throw original error
          }
        }

      } catch (error) {
        console.error(`Error with Gemini extraction (attempt ${attempt + 1}):`, error);

        // Si es error 503 (Service Unavailable) y quedan intentos, esperar y reintentar
        if (error.status === 503 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Gemini service unavailable, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Si no quedan intentos o es otro tipo de error
        if (attempt === retries) {
          await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', false, tenantId, 'gemini').catch(() => {});
          return null;
        }
      }
    }
    await promptManager.registrarResultado('EXTRACCION_FACTURA_GEMINI', false, tenantId, 'gemini').catch(() => {});
    return null;
  }

  async extractWithOllama(text) {
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2', // o 'mistral', 'codellama'
          prompt: `Extrae datos de esta factura argentina en formato JSON:
- fecha (YYYY-MM-DD)
- importe (solo número)
- cuit (formato XX-XXXXXXXX-X)
- numeroComprobante (formato XXXXX-XXXXXXXX)
- cae (14 dígitos numéricos)
- tipoComprobante (FACTURA A/B/C, NOTA DE CREDITO A/B/C, NOTA DE DEBITO A/B/C - buscar en recuadro superior central)
- razonSocial (nombre de la empresa QUE EMITE/FACTURA - está en el ENCABEZADO, NO tomar "Razón Social:" que es del cliente)
- netoGravado (importe neto gravado o subtotal - solo número) - IMPORTANTE: "Subtotal" generalmente representa el neto gravado
- exento (importe exento - solo número) - IMPORTANTE: Si no aparece explícito, usar EXENTO = TOTAL - GRAVADO - IMPUESTOS
- impuestos (suma total de TODOS los impuestos: IVA 21%, IVA 10.5%, IVA 27%, impuestos internos, retenciones, percepciones, etc. - solo número)
- cupon (número de cupón si es pago con tarjeta)

Texto: ${text}

Responde solo el JSON:`,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 200
          }
        })
      });

      const data = await response.json();
      const jsonText = data.response.trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Error with Ollama extraction:', error);
      return null;
    }
  }

  extractFecha(text) {
    // Patrones de fecha con prioridad según contexto
    const patterns = [
      // Alta prioridad: Fecha de Emisión (con todas las variantes de acentos y mayúsculas)
      { pattern: /fecha\s*(?:de\s*)?emisi[oó]n[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/gi, priority: 5 },
      { pattern: /fecha\s*(?:de\s*)?emision[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/gi, priority: 5 },
      { pattern: /fecha\s*(?:de\s*)?emisi[oó]n[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/gi, priority: 5 },
      { pattern: /fecha\s*(?:de\s*)?emision[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/gi, priority: 5 },
      
      // Media-alta prioridad: Solo "fecha"
      { pattern: /fecha[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/gi, priority: 4 },
      { pattern: /fecha[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/gi, priority: 4 },
      
      // Media prioridad: Fechas cerca de palabras relacionadas
      { pattern: /(?:vencimiento|vto|vigencia|hasta)[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/gi, priority: 3 },
      { pattern: /(?:desde|inicio|apertura)[\s:]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/gi, priority: 3 },
      
      // Baja prioridad: Cualquier fecha DD/MM/YYYY o similares
      { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g, priority: 2 },
      { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/g, priority: 1 },
      { pattern: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g, priority: 1 },
    ];

    const fechas = [];

    for (const { pattern, priority } of patterns) {
      const matches = [...text.matchAll(pattern)];
      
      for (const match of matches) {
        try {
          // Intentar convertir a fecha válida
          let day, month, year;
          
          if (match[3] && match[3].length === 4) {
            // Formato DD/MM/YYYY
            day = parseInt(match[1]);
            month = parseInt(match[2]);
            year = parseInt(match[3]);
          } else if (match[1].length === 4) {
            // Formato YYYY/MM/DD
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          } else if (match[3]) {
            // Formato DD/MM/YY
            day = parseInt(match[1]);
            month = parseInt(match[2]);
            year = parseInt(match[3]);
            // Ajustar año de 2 dígitos
            if (year < 50) {
              year += 2000;
            } else if (year < 100) {
              year += 1900;
            }
          }

          // Validar fecha
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2099) {
            const fecha = new Date(year, month - 1, day);
            if (!isNaN(fecha.getTime()) && fecha.getFullYear() === year && fecha.getMonth() === month - 1 && fecha.getDate() === day) {
              fechas.push({
                fecha: fecha.toISOString().split('T')[0],
                priority,
                context: match[0]
              });
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (fechas.length === 0) return null;
    
    // Ordenar por prioridad (mayor a menor)
    fechas.sort((a, b) => b.priority - a.priority);
    
    // Filtrar fechas razonables (no muy antiguas ni muy futuras)
    const currentYear = new Date().getFullYear();
    const fechasValidas = fechas.filter(f => {
      const fechaObj = new Date(f.fecha);
      const year = fechaObj.getFullYear();
      return year >= currentYear - 5 && year <= currentYear + 2; // Rango de 5 años atrás a 2 años adelante
    });
    
    return fechasValidas.length > 0 ? fechasValidas[0].fecha : fechas[0].fecha;
  }

  extractImporte(text) {
    console.log('💰 [DEBUG] Extrayendo importe del texto...');
    const importes = [];

    // Patrones para detectar importes con contexto
    const contextPatterns = [
      { pattern: /(?:total|importe|monto|suma|valor)[\s:]+\$?\s*([\d.,]+)/gi, priority: 3 },
      { pattern: /\$\s*([\d.,]+)/g, priority: 2 },
      { pattern: /(?:^|\s)([\d.,]{4,})\s*(?:\n|$|\s)/gm, priority: 1 } // Números largos aislados
    ];
    
    for (const { pattern, priority } of contextPatterns) {
      const matches = [...text.matchAll(pattern)];
      console.log(`💰 [DEBUG] Patrón prioridad ${priority} encontró ${matches.length} matches`);
      matches.forEach((match, index) => {
        let importeStr = match[1];
        console.log(`  Match ${index + 1}: "${importeStr}" del contexto: "${match[0]}"`);
        const parsedImporte = this.parseArgentineNumber(importeStr);
        console.log(`    Parseado como: ${parsedImporte}`);

        if (parsedImporte !== null && parsedImporte > 0) {
          importes.push({ value: parsedImporte, priority, original: importeStr });
          console.log(`    ✅ AGREGADO: ${parsedImporte} (prioridad ${priority})`);
        } else {
          console.log(`    ❌ RECHAZADO: ${parsedImporte}`);
        }
      });
    }

    if (importes.length === 0) return null;
    
    // Ordenar por prioridad y luego por valor (mayor a menor)
    importes.sort((a, b) => b.priority - a.priority || b.value - a.value);
    
    return importes[0].value;
  }

  // Función para parsear números en formato argentino
  parseArgentineNumber(numberStr) {
    if (!numberStr || typeof numberStr !== 'string') return null;

    // Limpiar espacios y símbolos
    let cleanStr = numberStr.trim().replace(/[\$\s]/g, '');

    // Casos especiales: si no tiene separadores decimales, es entero
    if (!/[.,]/.test(cleanStr)) {
      const num = parseInt(cleanStr);
      return !isNaN(num) ? num : null;
    }

    // Contar puntos y comas para determinar el formato
    const dotCount = (cleanStr.match(/\./g) || []).length;
    const commaCount = (cleanStr.match(/,/g) || []).length;

    console.log(`    [PARSE] Input: "${cleanStr}", dots: ${dotCount}, commas: ${commaCount}`);

    let finalNumber;
    let method;

    if (dotCount === 0 && commaCount === 1) {
      // Formato: 1234,56 (coma como decimal)
      method = "Coma como decimal";
      finalNumber = parseFloat(cleanStr.replace(',', '.'));
    } else if (commaCount === 0 && dotCount === 1) {
      // Podría ser 1234.56 (punto como decimal) o 1.234 (punto como miles)
      const parts = cleanStr.split('.');
      if (parts[1].length <= 2) {
        // Probablemente decimal: 1234.56
        method = "Punto como decimal";
        finalNumber = parseFloat(cleanStr);
      } else {
        // Probablemente miles: 1.234 -> 1234
        method = "Punto como miles";
        finalNumber = parseInt(cleanStr.replace('.', ''));
      }
    } else if (dotCount > 0 && commaCount === 1) {
      // Formato: 1.234.567,89 (puntos para miles, coma para decimal)
      method = "Puntos=miles, Coma=decimal";
      finalNumber = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
    } else if (commaCount > 0 && dotCount === 1) {
      // Formato: 1,234,567.89 (comas para miles, punto para decimal)
      method = "Comas=miles, Punto=decimal";
      const replaced = cleanStr.replace(/,/g, '');
      console.log(`    [PARSE] Replacing commas: "${cleanStr}" -> "${replaced}"`);
      finalNumber = parseFloat(replaced);
    } else {
      // Casos complejos: intentar ambos formatos y elegir el más razonable
      method = "Caso complejo - eligiendo máximo";
      const asDecimalComma = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
      const asDecimalDot = parseFloat(cleanStr.replace(/,/g, ''));

      // Elegir el que parezca más razonable (generalmente el mayor para facturas)
      finalNumber = Math.max(asDecimalComma, asDecimalDot);
    }

    console.log(`    [PARSE] Method: ${method}, Result: ${finalNumber}`);

    return !isNaN(finalNumber) && finalNumber > 0 ? finalNumber : null;
  }

  extractCUIT(text) {
    // Patrones para extraer CUIT del EMISOR (parte superior izquierda, cerca de Ingresos Brutos y Inicio de Actividades)
    const patterns = [
      // CUIT cerca de "Ingresos Brutos" y "Inicio de Actividades" (MAYOR PRIORIDAD)
      { pattern: /(?:ingresos\s*brutos|inicio\s*de\s*actividades)[\s\S]{0,200}?(?:cuit[:\s]*)?(\d{2}[-.]?\d{8}[-.]?\d{1})/gi, priority: 9 },
      { pattern: /(\d{2}[-.]?\d{8}[-.]?\d{1})[\s\S]{0,200}?(?:ingresos\s*brutos|inicio\s*de\s*actividades)/gi, priority: 8 },

      // CUIT explícitamente etiquetado como CUIT del emisor
      { pattern: /(?:^|\n)[\s]*(?:cuit|c\.u\.i\.t\.?)[\s:]*(\d{2}[-.]?\d{8}[-.]?\d{1})/gmi, priority: 7 },

      // CUIT en las primeras líneas del documento (emisor)
      { pattern: /^.{0,500}(\d{2}[-.]?\d{8}[-.]?\d{1})/gm, priority: 6 },

      // Patrones generales (menor prioridad)
      { pattern: /(\d{2})-(\d{8})-(\d{1})/g, priority: 4 },                    // 20-12345678-9
      { pattern: /(\d{11})/g, priority: 3 },                                    // 20123456789 (solo números)
    ];

    const cuits = [];

    for (const { pattern, priority } of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        let cuit;
        if (match[3]) {
          // Formato con guiones detectado por grupos
          cuit = match[1] + match[2] + match[3];
        } else if (match[1]) {
          // Un solo grupo capturado
          const cuitStr = match[1].replace(/[-.\s]/g, '');
          if (cuitStr.length === 11 && /^\d{11}$/.test(cuitStr)) {
            cuit = cuitStr;
          }
        }

        // Validar CUIT básico (11 dígitos)
        if (cuit && /^\d{11}$/.test(cuit)) {
          // Formatear con guiones
          const formattedCuit = `${cuit.substring(0, 2)}-${cuit.substring(2, 10)}-${cuit.substring(10)}`;
          cuits.push({
            cuit: formattedCuit,
            priority,
            original: match[0]
          });
        }
      }
    }

    if (cuits.length === 0) return null;

    // Eliminar duplicados y ordenar por prioridad
    const uniqueCuits = cuits.filter((item, index, self) =>
      index === self.findIndex(c => c.cuit === item.cuit)
    );

    uniqueCuits.sort((a, b) => b.priority - a.priority);

    return uniqueCuits[0].cuit;
  }

  extractNumeroComprobante(text) {
    // Patrones específicos para números de comprobante argentinos
    const patterns = [
      // Máxima prioridad: Formato estándar argentino exacto: 00000-00000000
      { pattern: /(\d{5}-\d{8})/g, priority: 10, description: 'Formato estándar argentino exacto' },

      // Alta prioridad: Contextuales con formato argentino exacto
      { pattern: /(?:factura|comprobante|n[úu]mero|comp|nro)[\s:]+n?[°º]?\s*(\d{5}-\d{8})/gi, priority: 9, description: 'Contextual argentino exacto' },
      { pattern: /(?:punto\s*de\s*venta|pto\s*vta)[\s:]+\d{1,5}[\s\-]+(?:comp|comprobante)[\s:]+n?[°º]?\s*(\d{5}-\d{8})/gi, priority: 9, description: 'Con punto de venta' },

      // Media-alta prioridad: Formato con 4 dígitos (también válido)
      { pattern: /(\d{4}-\d{8})/g, priority: 7, description: 'Formato argentino 4 dígitos' },
      { pattern: /(?:factura|comprobante|n[úu]mero|comp|nro)[\s:]+n?[°º]?\s*(\d{4}-\d{8})/gi, priority: 6, description: 'Contextual argentino 4 dígitos' },

      // Media prioridad: Formatos con espacios o sin guión
      { pattern: /(\d{5}\s+\d{8})/g, priority: 5, description: 'Formato con espacios 5-8' },
      { pattern: /(\d{4}\s+\d{8})/g, priority: 4, description: 'Formato con espacios 4-8' },
      { pattern: /(?:factura|comprobante|n[úu]mero)[\s:]+n?[°º]?\s*(\d{13})/gi, priority: 4, description: 'Número de 13 dígitos contextual' },
      { pattern: /(?:factura|comprobante|n[úu]mero)[\s:]+n?[°º]?\s*(\d{12})/gi, priority: 3, description: 'Número de 12 dígitos contextual' },

      // Patrones para números sin guión que requieren punto de venta por separado
      { pattern: /(?:factura|comprobante|n[úu]mero|comp|nro)[\s:]+n?[°º]?\s*(\d{8})/gi, priority: 5, description: 'Número de 8 dígitos sin punto de venta' },

      // Baja prioridad: Patrones genéricos
      { pattern: /n[°º]\s*(\d{4,5}-\d{8})/gi, priority: 2, description: 'N° genérico' },
      { pattern: /(?:factura|comprobante|n[úu]mero)[\s:]+n?[°º]?\s*(\d{8,})/gi, priority: 1, description: 'Contextual genérico' },
    ];

    const comprobantes = [];

    for (const { pattern, priority, description } of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        let numero = match[1];

        // Normalizar el número (reemplazar espacios por guiones si es necesario)
        if (/^\d{4,5}\s+\d{8}$/.test(numero)) {
          numero = numero.replace(/\s+/, '-');
        }

        // Validar formatos aceptables
        const isValidFormat = /^\d{5}-\d{8}$/.test(numero) ||          // Formato estándar 5-8
                             /^\d{4}-\d{8}$/.test(numero) ||           // Formato alternativo 4-8
                             /^\d{12,13}$/.test(numero) ||             // Sin guión 12-13 dígitos
                             /^\d{8}$/.test(numero);                   // Solo 8 dígitos (necesita punto de venta)

        if (isValidFormat) {
          // Formatear números sin guión al formato estándar si tienen 12-13 dígitos
          if (/^\d{12}$/.test(numero)) {
            // 12 dígitos: XXXX-XXXXXXXX
            numero = numero.substring(0, 4) + '-' + numero.substring(4);
          } else if (/^\d{13}$/.test(numero)) {
            // 13 dígitos: XXXXX-XXXXXXXX
            numero = numero.substring(0, 5) + '-' + numero.substring(5);
          } else if (/^\d{8}$/.test(numero)) {
            // 8 dígitos: buscar punto de venta por separado
            console.log(`DEBUG: Procesando número de 8 dígitos: ${numero}`);
            const puntoVenta = this.extractPuntoDeVenta(text);
            if (puntoVenta) {
              // Formatear punto de venta con ceros a la izquierda hasta 5 dígitos
              const ptoVentaFormatted = puntoVenta.toString().padStart(5, '0');
              numero = `${ptoVentaFormatted}-${numero}`;
              console.log(`Número sin guión encontrado: ${match[1]}, Punto de venta: ${puntoVenta}, Resultado: ${numero}`);
            } else {
              console.log(`Número de 8 dígitos encontrado pero no se pudo localizar punto de venta: ${numero}`);
              console.log(`Texto disponible para buscar punto de venta: ${text.substring(0, 200)}...`);
              // Skip este número si no encontramos punto de venta
              return;
            }
          }

          comprobantes.push({
            numero,
            priority,
            description,
            original: match[0]
          });
        }
      });
    }

    if (comprobantes.length === 0) return null;

    // Eliminar duplicados
    const uniqueComprobantes = comprobantes.filter((comp, index, self) =>
      index === self.findIndex(c => c.numero === comp.numero)
    );

    // Ordenar por prioridad (mayor a menor)
    uniqueComprobantes.sort((a, b) => b.priority - a.priority);

    return uniqueComprobantes[0].numero;
  }

  postProcessExtractedData(data, originalText) {
    // Post-procesar número de comprobante si es necesario
    if (data.numeroComprobante && /^\d{8}$/.test(data.numeroComprobante)) {
      console.log(`Post-procesando número de comprobante de IA: ${data.numeroComprobante}`);

      const puntoVenta = this.extractPuntoDeVenta(originalText);
      if (puntoVenta) {
        const ptoVentaFormatted = puntoVenta.toString().padStart(5, '0');
        const numeroMejorado = `${ptoVentaFormatted}-${data.numeroComprobante}`;
        console.log(`Número mejorado de IA: ${data.numeroComprobante} → ${numeroMejorado} (punto de venta: ${puntoVenta})`);

        return {
          ...data,
          numeroComprobante: numeroMejorado
        };
      } else {
        console.log(`No se pudo encontrar punto de venta para número de IA: ${data.numeroComprobante}`);
      }
    }

    return data;
  }

  extractPuntoDeVenta(text) {
    // Patrones para encontrar punto de venta/sucursal
    const patterns = [
      // Patrones específicos para punto de venta (máxima prioridad)
      { pattern: /(?:punto\s*de\s*venta|pto\s*vta|pto\s*de\s*venta)[\s:]+(\d{1,5})/gi, priority: 10 },
      { pattern: /(?:sucursal|suc)[\s:]+(\d{1,5})/gi, priority: 9 },
      { pattern: /(?:punto|pto)[\s:]+(\d{1,5})/gi, priority: 8 },
      { pattern: /(?:pv|p\.v\.)[\s:]*(\d{1,5})/gi, priority: 7 },

      // Patrones contextuales cerca del número de comprobante
      { pattern: /(\d{1,5})[\s\-]+(?:comprobante|factura|n[úu]mero)/gi, priority: 6 },
      { pattern: /(?:comprobante|factura)[\s:]+(\d{1,5})[\s\-]+\d{8}/gi, priority: 5 },

      // Patrones más agresivos - buscar números de 4-5 dígitos seguidos de guión y 8 dígitos
      { pattern: /(\d{4,5})-\d{8}/gi, priority: 8 },

      // Patrones que buscan números pequeños en contexto de facturas
      { pattern: /(?:n[°º]|num|número)[\s:]*(\d{1,5})[\s\-]+\d{8}/gi, priority: 4 },
      { pattern: /(\d{1,5})[\s]*-[\s]*\d{8}/gi, priority: 3 },

      // Buscar números de 1-5 dígitos que aparezcan antes de palabras clave
      { pattern: /(\d{1,5})[\s]+(?:factura|comprobante|ticket|nota)/gi, priority: 2 },
    ];

    const puntosVenta = [];

    for (const { pattern, priority } of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        const punto = parseInt(match[1]);
        if (punto > 0 && punto <= 99999) { // Validar rango razonable
          puntosVenta.push({
            punto,
            priority,
            original: match[0]
          });
        }
      });
    }

    if (puntosVenta.length === 0) {
      console.log('No se encontró punto de venta con ningún patrón');
      console.log(`Texto analizado (primeros 300 chars): ${text.substring(0, 300)}...`);
      return null;
    }

    // Eliminar duplicados y ordenar por prioridad
    const uniquePuntos = puntosVenta.filter((p, index, self) =>
      index === self.findIndex(pt => pt.punto === p.punto)
    );

    uniquePuntos.sort((a, b) => b.priority - a.priority);

    console.log(`Punto de venta encontrado: ${uniquePuntos[0].punto} (patrón: ${uniquePuntos[0].original}, prioridad: ${uniquePuntos[0].priority})`);
    return uniquePuntos[0].punto;
  }

  extractCAE(text) {
    // Patrones para extraer CAE (Código de Autorización Electrónico) argentino
    const patterns = [
      // CAE con contexto específico
      { pattern: /CAE\s*N?[°º]?\s*:?\s*(\d{14})/gi, priority: 5, description: 'CAE con contexto directo' },
      { pattern: /(?:código|codigo)?\s*(?:de\s*)?(?:autorización|autorizacion)\s*(?:electrónico|electronico)?\s*:?\s*(\d{14})/gi, priority: 4, description: 'CAE expandido' },
      
      // CAE cerca de fechas de vencimiento
      { pattern: /CAE\s*:?\s*(\d{14})\s*(?:venc|vto|vencimiento)/gi, priority: 4, description: 'CAE con vencimiento' },
      { pattern: /(\d{14})\s*(?:venc|vto|vencimiento)/gi, priority: 3, description: 'CAE implícito con vencimiento' },
      
      // Patrones con fechas de CAE
      { pattern: /(?:fecha|fch)?\s*CAE\s*:?\s*(\d{14})/gi, priority: 3, description: 'CAE con fecha' },
      
      // CAE en formularios estructurados
      { pattern: /(?:^|\n)\s*CAE\s*(\d{14})/gm, priority: 3, description: 'CAE en línea nueva' },
      
      // Números de 14 dígitos cerca de la palabra CAE (en un radio de 50 caracteres)
      { pattern: /CAE.{0,50}?(\d{14})|(\d{14}).{0,50}?CAE/gi, priority: 2, description: 'CAE cercano' },
      
      // Patrones genéricos de 14 dígitos (menor prioridad)
      { pattern: /\b(\d{14})\b/g, priority: 1, description: 'Número de 14 dígitos genérico' }
    ];

    const caes = [];
    
    for (const { pattern, priority, description } of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        // Extraer el número de 14 dígitos (puede estar en grupo 1 o 2)
        let cae = match[1] || match[2];
        
        if (cae && /^\d{14}$/.test(cae)) {
          // Validación adicional: el CAE no debe ser todos ceros o todos iguales
          if (!/^0{14}$/.test(cae) && !/^(\d)\1{13}$/.test(cae)) {
            caes.push({
              cae,
              priority,
              description,
              context: match[0]
            });
          }
        }
      });
    }

    if (caes.length === 0) return null;
    
    // Eliminar duplicados
    const uniqueCaes = caes.filter((cae, index, self) => 
      index === self.findIndex(c => c.cae === cae.cae)
    );
    
    // Ordenar por prioridad (mayor a menor)
    uniqueCaes.sort((a, b) => b.priority - a.priority);
    
    return uniqueCaes[0].cae;
  }

  // Función para parsear montos de texto
  parseAmount(amountStr) {
    if (!amountStr || typeof amountStr !== 'string') return null;
    
    // Limpiar el string
    let cleanAmount = amountStr.trim();
    
    // Remover caracteres no numéricos excepto punto y coma
    cleanAmount = cleanAmount.replace(/[^\d.,]/g, '');
    
    if (!cleanAmount) return null;
    
    // Detectar formato de número
    if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
      // Formato: 1.234,56 o 1,234.56
      const lastComma = cleanAmount.lastIndexOf(',');
      const lastDot = cleanAmount.lastIndexOf('.');
      
      if (lastDot > lastComma) {
        // Formato americano: 1,234.56
        cleanAmount = cleanAmount.replace(/,/g, '');
      } else {
        // Formato europeo: 1.234,56
        cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      }
    } else if (cleanAmount.includes(',')) {
      // Solo coma - podría ser decimal o separador de miles
      const commaIndex = cleanAmount.lastIndexOf(',');
      const afterComma = cleanAmount.substring(commaIndex + 1);
      
      if (afterComma.length <= 2) {
        // Probablemente decimal: 123,45
        cleanAmount = cleanAmount.replace(',', '.');
      } else {
        // Probablemente separador de miles: 1,234
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    }
    
    const amount = parseFloat(cleanAmount);
    return isNaN(amount) ? null : amount;
  }

  extractRazonSocial(text) {
    // console.log('🔍 [DEBUG] Texto completo para extracción de razón social:');
    // console.log('─'.repeat(80));
    // console.log(text.substring(0, 600)); // Primeros 600 caracteres
    // console.log('─'.repeat(80));

    // Patrones para extraer razón social del EMISOR (parte superior izquierda de la factura)
    const patterns = [
      // MÁXIMA PRIORIDAD ESPECÍFICA: Nombre después de datos de contacto (típico de emisor individual)
      { pattern: /(?:@gmail\.com|@hotmail\.com|@yahoo\.com|\(\d{4}\)\s*\d{7})\s*\n.*?\n([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{10,50})\s*\n/gi, priority: 11 },

      // MÁXIMA PRIORIDAD: Nombre que aparece ANTES de los datos fiscales (típico layout de emisor)
      { pattern: /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{8,80})\s*\n[\s\S]{0,200}?(?:inicio\s*actividades|ing\.?\s*brutos|cuit)/gi, priority: 10 },

      // MUY ALTA PRIORIDAD: Nombres en las primeras 300 caracteres del documento (zona de emisor) - PERO filtrar códigos
      { pattern: /^(.{0,300}?)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{10,80})(?=\s*\n)/gm, priority: 9 },

      // ALTA PRIORIDAD: Nombres cerca de CUIT del emisor y datos fiscales
      { pattern: /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{8,80})[\s\n]*(?:ingresos\s*brutos|inicio\s*de\s*actividades|cuit|c\.u\.i\.t\.?)/gi, priority: 8 },
      { pattern: /(?:ingresos\s*brutos|inicio\s*de\s*actividades|cuit)[\s\S]{0,100}?([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{8,80})(?:\s|\n)/gi, priority: 7 },

      // FILTRO NEGATIVO: Excluir explícitamente nombres que vienen después de códigos numéricos (típico de clientes)
      { pattern: /(?<!^\d{6}\s)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{8,80})\s*(?:CUIT|C\.U\.I\.T\.?)/gi, priority: 6 },

      // Nombres de empresa con sufijos típicos en parte superior (solo primeras 400 chars)
      { pattern: /^(.{0,400}?)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{12,80})(?:\s*S\.A\.?|\s*S\.R\.L\.?|\s*S\.A\.S\.?|\s*LTDA\.?)/gm, priority: 5 },

      // Nombres cerca de domicilio/dirección del emisor (parte superior)
      { pattern: /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{8,80})\s*(?:domicilio|dirección|comercial|fiscal)/gi, priority: 4 },

      // BAJA PRIORIDAD: Nombres largos pero NO precedidos por códigos de cliente
      { pattern: /(?:^|\n)(?!\d{6})(?!.*razón\s*social[\s:])([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{20,80})\s*(?:\n)/gmi, priority: 3 },

      // MÍNIMA PRIORIDAD: Nombres con palabras clave empresariales - evitar cliente
      { pattern: /(?:^|\n)(?!.*cliente)(?!\d{6})([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{10,80})(?:\s*(?:CIA|COMPAÑIA|EMPRESA|COMERCIAL|INDUSTRIA))/gmi, priority: 2 }
    ];

    const razonesSociales = [];
    
    for (const { pattern, priority } of patterns) {
      const matches = [...text.matchAll(pattern)];
      // console.log(`🔍 [DEBUG] Patrón prioridad ${priority} encontró ${matches.length} matches`);

      matches.forEach((match, index) => {
        let razonSocial = match[1]?.trim();
        // console.log(`  Match ${index + 1}:`, {
        //   razonSocial: razonSocial,
        //   position: match.index,
        //   context: match[0].substring(0, 100),
        //   fullMatch: match[0]
        // });

        if (razonSocial && razonSocial.length >= 5) {
          // Limpiar caracteres no deseados
          razonSocial = razonSocial.replace(/[^\w\s&.,'-]/g, '').trim();

          // Filtros adicionales para evitar datos de clientes
          const isLikelyClient = (
            // Verificar si aparece después de un código numérico de 6 dígitos (típico de clientes)
            /^\d{6}\s+/.test(match[0]) ||
            // Verificar si ES un código numérico de 6 dígitos (como "000019")
            /^\d{6}$/.test(razonSocial) ||
            // Verificar si el contexto contiene "GRUPO LORASCHI BATALLA" (específico para este caso)
            /GRUPO\s*LORASCHI\s*BATALLA/.test(match[0]) ||
            // Verificar si contiene "S.A." y aparece en la parte media del documento (después de 500 chars)
            (razonSocial.includes('S.A.') && match.index && match.index > 500) ||
            // Verificar si aparece junto con "RESPONSABLE INSCRIPTO" (típico de clientes)
            /RESPONSABLE\s*INSCRIPTO/.test(match[0]) ||
            // Rechazar nombres obvios que no son empresas
            /^(Responsable\s*Monotributo|UnitarioCantidad|Abono\s*Sistema|CONTADO|RESPONSABLE|INSCRIPTO)/i.test(razonSocial) ||
            // Rechazar textos que son claramente headers de tabla o datos administrativos
            /^(Descripci[oó]n|Articulo|Total|Cantidad|Unitario|Sistema|Septiembre)$/i.test(razonSocial.replace(/\n.*/, ''))
          );

          // console.log(`    Filtros: isLikelyClient=${isLikelyClient}, position=${match.index}, length=${razonSocial.length}`);

          if (razonSocial.length >= 5 && !isLikelyClient) {
            // console.log(`    ✅ AGREGADO con prioridad ${priority}:`, razonSocial);
            razonesSociales.push({
              razonSocial,
              priority,
              original: match[0]
            });
          } else {
            // console.log(`    ❌ RECHAZADO:`, razonSocial);
          }
        }
      });
    }

    if (razonesSociales.length === 0) return null;
    
    // Eliminar duplicados y ordenar por prioridad
    const uniqueRazones = razonesSociales.filter((item, index, self) => 
      index === self.findIndex(r => r.razonSocial === item.razonSocial)
    );
    
    uniqueRazones.sort((a, b) => b.priority - a.priority);

    // console.log('🏆 [DEBUG] Razones sociales encontradas (ordenadas por prioridad):');
    // uniqueRazones.forEach((r, i) => {
    //   console.log(`  ${i + 1}. "${r.razonSocial}" (prioridad ${r.priority})`);
    // });
    // console.log('🎯 [DEBUG] Resultado final:', uniqueRazones[0].razonSocial);

    return uniqueRazones[0].razonSocial;
  }

  extractNetoGravado(text) {
    // Patrones para extraer neto gravado - MÁS ESPECÍFICOS para evitar conflictos
    const patterns = [
      // Patrones muy específicos de neto gravado
      { pattern: /(?:neto\s*gravado|subtotal\s*gravado|base\s*imponible)[\s:]*\$?\s*([\d.,]+)/gi, priority: 8 },

      // "Subtotal" solo - pero NO si dice "subtotal exento" o "subtotal no gravado"
      { pattern: /(?:^|\n)\s*subtotal(?!\s*(?:exento|no\s*gravado))[\s:]*\$?\s*([\d.,]+)/gmi, priority: 7 },
      { pattern: /subtotal(?!\s*(?:exento|no\s*gravado))[\s:]*\$?\s*([\d.,]+)/gi, priority: 6 },

      // Solo "gravado" pero NO "no gravado" o "exento gravado"
      { pattern: /(?<!no\s*)(?<!exento\s*)gravado[\s:]*\$?\s*([\d.,]+)/gi, priority: 4 },

      // Neto específico
      { pattern: /(?:^|\n)\s*neto(?!\s*(?:exento|no\s*gravado))[\s:]*\$?\s*([\d.,]+)/gm, priority: 3 }
    ];

    return this.extractAmountWithPatterns(text, patterns);
  }

  extractExento(text, options = {}) {
    // Patrones para extraer importe exento - MÁS ESPECÍFICOS para evitar conflictos
    const patterns = [
      // Patrones muy específicos para exento
      { pattern: /(?:importe\s*exento|total\s*exento|subtotal\s*exento)[\s:]*\$?\s*([\d.,]+)/gi, priority: 8 },
      { pattern: /(?:exento|no\s*gravado)[\s:]*\$?\s*([\d.,]+)/gi, priority: 7 },
      { pattern: /(?:^|\n)\s*exento(?!\s*gravado)[\s:]*\$?\s*([\d.,]+)/gm, priority: 6 },
      { pattern: /0%[\s:]*\$?\s*([\d.,]+)/gi, priority: 4 },
      { pattern: /(?:^|\n)\s*no\s*gravado[\s:]*\$?\s*([\d.,]+)/gm, priority: 5 }
    ];

    let exento = this.extractAmountWithPatterns(text, patterns);

    // Si se solicita verificar por impuestos y no se encontró exento directamente
    if (options.checkForTaxes && !exento) {
      // Verificar si hay información de impuestos/IVA en el texto
      const hasIvaOrTaxes = this.detectTaxInformation(text);

      if (!hasIvaOrTaxes) {
        // Si no hay impuestos detectados, el exento puede ser igual al total
        // Pero NUNCA asignar automáticamente sin verificar
        // Dejar que la validación posterior calcule usando: EXENTO = TOTAL - GRAVADO - IMPUESTOS
        // NO asignar exento aquí para evitar errores
      }
    }

    return exento;
  }

  extractImpuestos(text) {
    // Patrones para extraer TODOS los impuestos (IVA, impuestos internos, retenciones, etc.)
    const patterns = [
      // IVA específico
      { pattern: /(?:IVA|iva)[\s:]*\$?\s*([\d.,]+)/gi, priority: 8 },
      { pattern: /21%[\s:]*\$?\s*([\d.,]+)/gi, priority: 7 },
      { pattern: /10\.5%[\s:]*\$?\s*([\d.,]+)/gi, priority: 6 },
      { pattern: /27%[\s:]*\$?\s*([\d.,]+)/gi, priority: 5 },
      
      // Impuestos generales
      { pattern: /(?:impuesto|impuestos)[\s:]*\$?\s*([\d.,]+)/gi, priority: 6 },
      { pattern: /(?:^|\n)\s*impuesto[\s:]*\$?\s*([\d.,]+)/gm, priority: 5 },
      { pattern: /(?:impuestos?\s*internos?)[\s:]*\$?\s*([\d.,]+)/gi, priority: 7 },
      
      // Retenciones y percepciones
      { pattern: /(?:ret\.?\s*iva|retenci[oó]n.*iva)[\s:]*\$?\s*([\d.,]+)/gi, priority: 4 },
      { pattern: /(?:perc\.?\s*iva|percepci[oó]n.*iva)[\s:]*\$?\s*([\d.,]+)/gi, priority: 4 },
      { pattern: /(?:ret\.?\s*ganancias|retenci[oó]n.*ganancias)[\s:]*\$?\s*([\d.,]+)/gi, priority: 3 },
      
      // Otras líneas con porcentajes
      { pattern: /(?:al[ií]cuota)[\s:]*\d+\.?\d*%[\s:]*\$?\s*([\d.,]+)/gi, priority: 4 }
    ];

    // Extraer TODOS los impuestos encontrados y sumarlos
    let totalImpuestos = 0;
    const impuestosEncontrados = [];

    for (const patternObj of patterns) {
      const matches = [...text.matchAll(patternObj.pattern)];
      
      for (const match of matches) {
        const amount = this.parseAmount(match[1]);
        if (amount && amount > 0) {
          impuestosEncontrados.push({ 
            tipo: patternObj.pattern.source, 
            valor: amount 
          });
          totalImpuestos += amount;
        }
      }
    }

    console.log('Impuestos encontrados:', impuestosEncontrados);
    console.log('Total impuestos sumados:', totalImpuestos);

    return totalImpuestos > 0 ? totalImpuestos : null;
  }

  detectTaxInformation(text) {
    // Patrones para detectar información de impuestos/IVA
    const taxPatterns = [
      /IVA/gi,
      /impuesto/gi,
      /21%/g,
      /10\.5%/g,
      /27%/g,
      /2\.5%/g,
      /tributo/gi,
      /alícuota/gi,
      /alicuota/gi,
      /gravado.*21/gi,
      /21.*gravado/gi,
      /impuestos?\s*internos?/gi,
      /ret.*ganancias/gi,
      /ret.*iva/gi,
      /perc.*iva/gi,
      /perc.*iibb/gi
    ];

    // Verificar si algún patrón coincide
    return taxPatterns.some(pattern => pattern.test(text));
  }

  extractCupon(text) {
    // Patrones para extraer cupón
    const patterns = [
      { pattern: /(?:cupón|cupon|ticket)[\s:#]*(\w+)/gi, priority: 5 },
      { pattern: /(?:nro|número|numero)[\s:]*(?:cupón|cupon|ticket)[\s:#]*(\w+)/gi, priority: 4 },
      { pattern: /CUP[\s:#]*(\w+)/gi, priority: 3 }
    ];

    const cupones = [];
    
    for (const { pattern, priority } of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        let cupon = match[1]?.trim();
        
        if (cupon && cupon.length >= 3) {
          cupones.push({
            cupon,
            priority,
            original: match[0]
          });
        }
      });
    }

    if (cupones.length === 0) return null;
    
    // Eliminar duplicados y ordenar por prioridad
    const uniqueCupones = cupones.filter((item, index, self) => 
      index === self.findIndex(c => c.cupon === item.cupon)
    );
    
    uniqueCupones.sort((a, b) => b.priority - a.priority);
    
    return uniqueCupones[0].cupon;
  }

  extractAmountWithPatterns(text, patterns) {
    const amounts = [];
    
    for (const { pattern, priority } of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        let amountStr = match[1];
        
        if (amountStr) {
          // Limpiar y convertir a número
          const cleanAmount = amountStr.replace(/[^\d.,]/g, '');
          const amount = this.parseAmount(cleanAmount);
          
          if (amount !== null && amount > 0) {
            amounts.push({
              amount,
              priority,
              original: match[0]
            });
          }
        }
      });
    }

    if (amounts.length === 0) return null;
    
    // Eliminar duplicados y ordenar por prioridad
    const uniqueAmounts = amounts.filter((item, index, self) => 
      index === self.findIndex(a => a.amount === item.amount)
    );
    
    uniqueAmounts.sort((a, b) => b.priority - a.priority);
    
    return uniqueAmounts[0].amount;
  }

  extractTipoComprobante(text) {
    console.log('📄 [DEBUG] Extrayendo tipo de comprobante...');
    console.log('📄 [DEBUG] Parte del texto donde buscar:', text.substring(0, 200));

    // Patrones para extraer tipo de comprobante argentino
    const patterns = [
      // Factura con letra en recuadro (patrón más común)
      { 
        pattern: /(?:^|[\n\r])\s*(?:FACTURA|Factura)\s*([A-C])\s*(?:[\n\r]|$)/gm, 
        priority: 10, 
        type: 'FACTURA',
        description: 'Factura con letra'
      },
      
      // Nota de Crédito con letra
      { 
        pattern: /(?:^|[\n\r])\s*(?:NOTA\s*DE\s*CR[EÉ]DITO|Nota\s*de\s*Cr[eé]dito)\s*([A-C])\s*(?:[\n\r]|$)/gm, 
        priority: 10, 
        type: 'NOTA DE CREDITO',
        description: 'Nota de crédito con letra'
      },
      
      // Nota de Débito con letra
      { 
        pattern: /(?:^|[\n\r])\s*(?:NOTA\s*DE\s*D[EÉ]BITO|Nota\s*de\s*D[eé]bito)\s*([A-C])\s*(?:[\n\r]|$)/gm, 
        priority: 10, 
        type: 'NOTA DE DEBITO',
        description: 'Nota de débito con letra'
      },

      // Patrones en recuadro (texto entre espacios o símbolos)
      { 
        pattern: /[|\-=+*#]\s*(FACTURA\s*([A-C]))\s*[|\-=+*#]/gi, 
        priority: 9, 
        type: 'FACTURA',
        description: 'Factura en recuadro'
      },
      
      { 
        pattern: /[|\-=+*#]\s*((?:NOTA\s*DE\s*)?CR[EÉ]DITO\s*([A-C]))\s*[|\-=+*#]/gi, 
        priority: 9, 
        type: 'NOTA DE CREDITO',
        description: 'Nota de crédito en recuadro'
      },
      
      { 
        pattern: /[|\-=+*#]\s*((?:NOTA\s*DE\s*)?D[EÉ]BITO\s*([A-C]))\s*[|\-=+*#]/gi, 
        priority: 9, 
        type: 'NOTA DE DEBITO',
        description: 'Nota de débito en recuadro'
      },

      // Patrones cerca del centro superior (primeras líneas)
      { 
        pattern: /^.{0,200}?\b(FACTURA\s*([A-C]))\b/gim, 
        priority: 8, 
        type: 'FACTURA',
        description: 'Factura en parte superior'
      },
      
      // Patrones más generales
      { 
        pattern: /\b(?:FACTURA|Factura)\s*([A-C])\b/g, 
        priority: 7, 
        type: 'FACTURA',
        description: 'Factura genérica'
      },
      
      { 
        pattern: /\b(?:NOTA\s*DE\s*CR[EÉ]DITO|Nota\s*de\s*Cr[eé]dito)\s*([A-C])\b/g, 
        priority: 7, 
        type: 'NOTA DE CREDITO',
        description: 'Nota de crédito genérica'
      },
      
      { 
        pattern: /\b(?:NOTA\s*DE\s*D[EÉ]BITO|Nota\s*de\s*D[eé]bito)\s*([A-C])\b/g, 
        priority: 7, 
        type: 'NOTA DE DEBITO',
        description: 'Nota de débito genérica'
      },

      // Sin letra específica pero con tipo
      { 
        pattern: /\b(?:FACTURA|Factura)(?!\s*[A-C])\b/g, 
        priority: 5, 
        type: 'FACTURA',
        description: 'Factura sin letra'
      },
      
      { 
        pattern: /\b(?:NOTA\s*DE\s*CR[EÉ]DITO|Nota\s*de\s*Cr[eé]dito)(?!\s*[A-C])\b/g, 
        priority: 5, 
        type: 'NOTA DE CREDITO',
        description: 'Nota de crédito sin letra'
      }
    ];

    const comprobantes = [];
    
    for (const { pattern, priority, type, description } of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        let letra = null;
        
        // Extraer la letra si está presente
        for (let i = 1; i < match.length; i++) {
          if (match[i] && /^[A-C]$/.test(match[i])) {
            letra = match[i];
            break;
          }
        }
        
        const tipoCompleto = letra ? `${type} ${letra}` : type;
        
        comprobantes.push({
          tipo: tipoCompleto,
          letra: letra,
          tipoBase: type,
          priority,
          description,
          context: match[0]
        });
      });
    }

    if (comprobantes.length === 0) return null;
    
    // Eliminar duplicados y ordenar por prioridad
    const uniqueComprobantes = comprobantes.filter((comp, index, self) => 
      index === self.findIndex(c => c.tipo === comp.tipo)
    );
    
    uniqueComprobantes.sort((a, b) => b.priority - a.priority);
    
    return uniqueComprobantes[0].tipo;
  }

  extractDatosEmisor(text) {
    // Extraer los primeros párrafos que suelen contener datos del emisor
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Buscar en las primeras 10 líneas
    const upperSection = lines.slice(0, Math.min(lines.length, 10)).join('\n');
    
    const emisorData = {
      razonSocial: null,
      cuit: null,
      direccion: null,
      localidad: null,
      telefono: null,
      email: null
    };

    // Patrones específicos para datos del emisor
    const patterns = {
      // Razón social (líneas que parecen nombres de empresa)
      razonSocial: [
        { pattern: /^([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{8,60}(?:\s*S\.A\.?|\s*S\.R\.L\.?|\s*S\.A\.S\.?)?)$/gm, priority: 5 },
        { pattern: /(?:^|\n)\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&.,'-]{15,70})\s*(?:\n|CUIT)/gm, priority: 4 }
      ],
      
      // CUIT del emisor (diferente del ya extraído globalmente)
      cuit: [
        { pattern: /(?:CUIT|C\.U\.I\.T\.?)\s*:?\s*(\d{2}[-.]?\d{8}[-.]?\d{1})/gi, priority: 5 }
      ],
      
      // Dirección
      direccion: [
        { pattern: /(?:Direcci[óo]n|Domicilio|Dom\.)[:.]?\s*([A-Za-z0-9\s.,#-]{10,100})/gi, priority: 5 },
        { pattern: /([A-Za-záéíóúñ\s]+\s+\d+(?:\s*[A-Za-z]?\s*)?(?:\s*piso\s*\d+)?(?:\s*[A-Za-z])?)\s*(?:\d{4}|\(?\d{3,4}\)?)/gi, priority: 3 }
      ],
      
      // Localidad/Ciudad
      localidad: [
        { pattern: /(?:Ciudad|Localidad|C\.P\.)[:.]?\s*([A-Za-záéíóúñ\s]{3,40})/gi, priority: 5 },
        { pattern: /\b([A-Za-záéíóúñ\s]{3,25})\s*[-,]\s*(?:Buenos Aires|Córdoba|Mendoza|Santa Fe|Tucumán)/gi, priority: 4 }
      ],
      
      // Teléfono
      telefono: [
        { pattern: /(?:Tel[éeé]fono|Tel\.?|Móvil|Celular)[:.]?\s*([\d\s\-\(\)\+]{8,20})/gi, priority: 5 },
        { pattern: /\b(\(?\d{2,4}\)?\s*\d{3,4}[-\s]?\d{3,4})\b/g, priority: 3 }
      ],
      
      // Email
      email: [
        { pattern: /(?:E-?mail|Correo)[:.]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, priority: 5 },
        { pattern: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, priority: 4 }
      ]
    };

    // Extraer cada tipo de dato
    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      const matches = [];
      
      for (const { pattern, priority } of fieldPatterns) {
        const fieldMatches = [...upperSection.matchAll(pattern)];
        fieldMatches.forEach(match => {
          let value = match[1]?.trim();
          
          if (value && value.length > 2) {
            // Limpiar el valor según el tipo de campo
            if (field === 'cuit') {
              value = value.replace(/[^\d-]/g, '');
              if (!/^\d{2}-\d{8}-\d{1}$/.test(value) && /^\d{11}$/.test(value.replace(/\D/g, ''))) {
                const digits = value.replace(/\D/g, '');
                value = `${digits.slice(0,2)}-${digits.slice(2,10)}-${digits.slice(10)}`;
              }
            } else if (field === 'telefono') {
              value = value.replace(/[^\d\s\-\(\)\+]/g, '');
            } else if (field === 'email') {
              value = value.toLowerCase();
            } else {
              value = value.replace(/[^\w\s&.,'-]/g, '').trim();
            }
            
            if (value.length > 2) {
              matches.push({ value, priority, context: match[0] });
            }
          }
        });
      }
      
      if (matches.length > 0) {
        // Ordenar por prioridad y tomar el mejor
        matches.sort((a, b) => b.priority - a.priority);
        emisorData[field] = matches[0].value;
      }
    }

    // Verificar si encontramos al menos algunos datos
    const hasData = Object.values(emisorData).some(value => value !== null);
    
    return hasData ? emisorData : null;
  }

  // Validar y corregir importes usando la fórmula: EXENTO = TOTAL - GRAVADO - IMPUESTOS
  validateAndCorrectAmounts(extractedData) {
    const total = parseFloat(extractedData.importe || 0);
    const gravado = parseFloat(extractedData.netoGravado || 0);
    const impuestos = parseFloat(extractedData.impuestos || 0);
    const exento = parseFloat(extractedData.exento || 0);

    console.log('🧮 [VALIDACIÓN] Valores extraídos antes de corrección:', {
      total,
      gravado,
      impuestos,
      exentoExtraido: exento
    });

    // CORRECCIÓN CRÍTICA: Detectar errores comunes
    if (total > 0 && exento === total && gravado > 0) {
      console.log('🚨 [ERROR DETECTADO] EXENTO = TOTAL, esto es incorrecto!');
    }

    if (total > 0 && gravado === exento && gravado > 0) {
      console.log('🚨 [ERROR DETECTADO] GRAVADO = EXENTO, esto es incorrecto!');
    }

    // SIEMPRE aplicar la fórmula correcta si tenemos total
    if (total > 0) {
      // Calcular el exento correcto usando la fórmula
      const exentoCalculado = Math.max(0, total - gravado - impuestos);

      console.log('🧮 [VALIDACIÓN] Cálculo de exento:', {
        total,
        gravado,
        impuestos,
        exentoExtraido: exento,
        exentoCalculado,
        formula: `${total} - ${gravado} - ${impuestos} = ${exentoCalculado}`
      });

      // SIEMPRE usar el exento calculado si:
      // 1. Es diferente al extraído
      // 2. Si exento = total (error común)
      // 3. Si gravado = exento (error común)
      if (exento !== exentoCalculado || exento === total || gravado === exento) {
        console.log('🔧 [CORRECCIÓN FORZADA] Corrigiendo exento:', {
          razon: exento === total ? 'EXENTO=TOTAL' : gravado === exento ? 'GRAVADO=EXENTO' : 'DIFERENTE_CALCULADO',
          anterior: exento,
          nuevo: exentoCalculado
        });

        extractedData.exento = Math.max(0, exentoCalculado);
      }

      // Verificar que la suma sea coherente: TOTAL = GRAVADO + EXENTO + IMPUESTOS
      const sumaCalculada = gravado + parseFloat(extractedData.exento) + impuestos;
      const diferenciaTotal = Math.abs(total - sumaCalculada);
      const umbralTolerancia = total * 0.01; // 1% de tolerancia

      if (diferenciaTotal > umbralTolerancia) {
        console.log('⚠️ [ADVERTENCIA] La suma no coincide con el total:', {
          total,
          sumaCalculada: sumaCalculada.toFixed(2),
          diferencia: diferenciaTotal.toFixed(2),
          componentes: {
            gravado,
            exento: parseFloat(extractedData.exento),
            impuestos
          }
        });
      }
    }
  }

  /**
   * Extrae datos de un resumen de tarjeta de crédito (ICBC, Galicia, BBVA, etc.)
   * @param {string} text - Texto extraído del PDF
   * @returns {Object} { metadata, transacciones }
   */
  async extractResumenTarjeta(text, tenantId = null) {
    console.log('💳 [RESUMEN TARJETA] Iniciando extracción de resumen...');

    try {
      // Intentar extracción con IA
      if (process.env.ENABLE_AI_EXTRACTION === 'true') {
        const aiResult = await this.extractResumenTarjetaWithAI(text, tenantId);
        if (aiResult) {
          console.log('✅ [RESUMEN TARJETA] Extracción exitosa con IA');
          return aiResult;
        }
      }

      // Fallback a extracción local (patterns)
      console.log('🔧 [RESUMEN TARJETA] Usando extracción local con patterns...');
      return this.extractResumenTarjetaLocal(text);

    } catch (error) {
      console.error('❌ [RESUMEN TARJETA] Error en extracción:', error);
      throw error;
    }
  }

  /**
   * Extrae resumen de tarjeta usando IA (Gemini/Anthropic)
   */
  async extractResumenTarjetaWithAI(text, tenantId = null) {
    try {
      // Limitar texto a primeros 10000 caracteres para evitar timeouts
      const limitedText = text.substring(0, 10000);

      // Obtener prompt desde PromptManager
      const prompt = await promptManager.getPromptText(
        'EXTRACCION_RESUMEN_TARJETA',
        { text: limitedText },
        tenantId
      );

      if (!prompt) {
        console.error('❌ Prompt EXTRACCION_RESUMEN_TARJETA no encontrado');
        return null;
      }

      // Intentar con Gemini primero
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'tu-api-key-aqui') {
        try {
          console.log('🤖 [RESUMEN TARJETA] Intentando con Gemini...');
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

          const result = await model.generateContent(prompt);
          let jsonText = result.response.text();

          // Limpiar respuesta
          jsonText = jsonText
            .replace(/```json\n?/g, '')
            .replace(/\n?```/g, '')
            .replace(/^[^{]*{/, '{')
            .replace(/}[^}]*$/, '}')
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();

          const data = JSON.parse(jsonText);

          // Validar estructura
          if (data.metadata && data.transacciones && Array.isArray(data.transacciones)) {
            await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', true, tenantId, 'gemini');
            return data;
          }
        } catch (error) {
          console.error('⚠️ [RESUMEN TARJETA] Error con Gemini:', error.message);
        }
      }

      // Intentar con Anthropic como fallback
      if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'tu-api-key-aqui') {
        try {
          console.log('🤖 [RESUMEN TARJETA] Intentando con Anthropic...');
          const Anthropic = require('@anthropic-ai/sdk');
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          });

          const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2048,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });

          const responseText = message.content[0].text;
          let jsonText = responseText;
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          const data = JSON.parse(jsonText);

          // Validar estructura
          if (data.metadata && data.transacciones && Array.isArray(data.transacciones)) {
            await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', true, tenantId, 'anthropic');
            return data;
          }
        } catch (error) {
          console.error('⚠️ [RESUMEN TARJETA] Error con Anthropic:', error.message);
        }
      }

      // Falló con ambos motores - dejar motor=null
      await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', false, tenantId);
      return null;
    } catch (error) {
      console.error('❌ [RESUMEN TARJETA] Error en extracción con IA:', error);
      // Error general - dejar motor=null
      await promptManager.registrarResultado('EXTRACCION_RESUMEN_TARJETA', false, tenantId).catch(() => {});
      return null;
    }
  }

  /**
   * Extrae resumen de tarjeta usando patterns locales (fallback)
   */
  extractResumenTarjetaLocal(text) {
    console.log('🔍 [RESUMEN TARJETA] Extracción local con patterns...');

    const metadata = {
      periodo: this.extractPeriodoResumen(text),
      numeroTarjeta: this.extractNumeroTarjetaResumen(text),
      titularNombre: this.extractTitularNombre(text),
      fechaCierre: this.extractFechaCierre(text),
      fechaVencimiento: this.extractFechaVencimiento(text)
    };

    const transacciones = this.extractTransaccionesResumen(text);

    return { metadata, transacciones };
  }

  extractPeriodoResumen(text) {
    // Buscar "Cierre: 28 Ago 25" o "CIERRE ACTUAL 24-Abr-25"
    const patterns = [
      /CIERRE\s*(?:ACTUAL)?[\s:]*(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{2})/i,
      /cierre[\s:]*(\d{1,2})\s+([A-Za-z]+)\s+(\d{2})/i
    ];

    const meses = {
      'ene': '01', 'enero': '01', 'jan': '01',
      'feb': '02', 'febrero': '02',
      'mar': '03', 'marzo': '03',
      'abr': '04', 'abril': '04', 'apr': '04',
      'may': '05', 'mayo': '05',
      'jun': '06', 'junio': '06',
      'jul': '07', 'julio': '07',
      'ago': '08', 'agosto': '08', 'aug': '08',
      'sep': '09', 'sept': '09', 'setiembre': '09', 'septiembre': '09',
      'oct': '10', 'octubre': '10',
      'nov': '11', 'noviembre': '11',
      'dic': '12', 'diciembre': '12', 'dec': '12'
    };

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const mes = meses[match[2].toLowerCase()];
        const anio = '20' + match[3];
        return anio + mes; // YYYYMM
      }
    }

    return null;
  }

  extractNumeroTarjetaResumen(text) {
    // Buscar "Tarjeta 5643" o últimos 4 dígitos
    const patterns = [
      /Tarjeta\s*(\d{4})/i,
      /\*\*\*\*\s*(\d{4})/,
      /termina(?:da)?\s*en\s*(\d{4})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  extractTitularNombre(text) {
    // Buscar nombre del titular en el encabezado
    const lines = text.split('\n').slice(0, 20); // Primeras 20 líneas

    for (const line of lines) {
      // Buscar líneas con nombres en mayúsculas
      if (/^[A-ZÁÉÍÓÚÑ\s]{10,50}$/.test(line.trim())) {
        return line.trim();
      }
    }

    return null;
  }

  extractFechaCierre(text) {
    // Similar a extractPeriodoResumen pero retorna fecha completa
    const patterns = [
      /CIERRE\s*(?:ACTUAL)?[\s:]*(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{2})/i,
      /cierre[\s:]*(\d{1,2})\s+([A-Za-z]+)\s+(\d{2})/i
    ];

    const meses = {
      'ene': '01', 'enero': '01',
      'feb': '02', 'febrero': '02',
      'mar': '03', 'marzo': '03',
      'abr': '04', 'abril': '04',
      'may': '05', 'mayo': '05',
      'jun': '06', 'junio': '06',
      'jul': '07', 'julio': '07',
      'ago': '08', 'agosto': '08',
      'sep': '09', 'septiembre': '09',
      'oct': '10', 'octubre': '10',
      'nov': '11', 'noviembre': '11',
      'dic': '12', 'diciembre': '12'
    };

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const dia = match[1].padStart(2, '0');
        const mes = meses[match[2].toLowerCase()];
        const anio = '20' + match[3];
        return `${anio}-${mes}-${dia}`;
      }
    }

    return null;
  }

  extractFechaVencimiento(text) {
    // Buscar "VENCIMIENTO 09 Set 25"
    const pattern = /VENCIMIENTO[\s:]*(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{2})/i;
    const meses = {
      'ene': '01', 'enero': '01',
      'feb': '02', 'febrero': '02',
      'mar': '03', 'marzo': '03',
      'abr': '04', 'abril': '04',
      'may': '05', 'mayo': '05',
      'jun': '06', 'junio': '06',
      'jul': '07', 'julio': '07',
      'ago': '08', 'agosto': '08',
      'sep': '09', 'set': '09', 'septiembre': '09',
      'oct': '10', 'octubre': '10',
      'nov': '11', 'noviembre': '11',
      'dic': '12', 'diciembre': '12'
    };

    const match = text.match(pattern);
    if (match) {
      const dia = match[1].padStart(2, '0');
      const mes = meses[match[2].toLowerCase()];
      const anio = '20' + match[3];
      return `${anio}-${mes}-${dia}`;
    }

    return null;
  }

  extractTransaccionesResumen(text) {
    // Patrón para transacciones ICBC: "25 Agosto 01 304145 * VEA SM 983                    225.664,28"
    // Patrón para BBVA: "26-Mar-25 GABARAIN MATERIALES 06/12 05538 202610,50"
    const transacciones = [];
    const lines = text.split('\n');

    for (const line of lines) {
      // Patrón ICBC mejorado: permite múltiples espacios entre campos y antes del importe
      // Formato: "25 Agosto  01 304145 *  VEA SM 983                                               225.664,28"
      const icbcMatch = line.match(/(\d{2})\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{6})\s+[\*KQ]?\s+(.+?)\s{2,}([\d.,]+)\s*$/);
      if (icbcMatch) {
        const [, anio, mes, dia, cupon, desc, importe] = icbcMatch;

        transacciones.push({
          fecha: this.normalizarFechaResumen(dia, mes, '20' + anio),
          descripcion: desc.trim(),
          numeroCupon: cupon,
          importe: this.parseArgentineNumber(importe),
          cuotas: this.extractCuotasFromDesc(desc),
          moneda: 'ARS'
        });
        continue;
      }

      // Patrón BBVA: "26-Mar-25 GABARAIN MATERIALES 06/12 05538 202610,50"
      const bbvaMatch = line.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})\s+(.+?)\s+(C\.\d{2}\/\d{2})?\s*(\d{6})?\s+([\d.,]+)\s*$/);
      if (bbvaMatch) {
        const [, dia, mes, anio, desc, cuotas, cupon, importe] = bbvaMatch;

        transacciones.push({
          fecha: this.normalizarFechaResumen(dia, mes, '20' + anio),
          descripcion: desc.trim(),
          numeroCupon: cupon || null,
          importe: this.parseArgentineNumber(importe),
          cuotas: cuotas || null,
          moneda: 'ARS'
        });
      }
    }

    return transacciones;
  }

  normalizarFechaResumen(dia, mes, anio) {
    const meses = {
      'ene': '01', 'enero': '01',
      'feb': '02', 'febrero': '02',
      'mar': '03', 'marzo': '03',
      'abr': '04', 'abril': '04',
      'may': '05', 'mayo': '05',
      'jun': '06', 'junio': '06',
      'jul': '07', 'julio': '07',
      'ago': '08', 'agosto': '08',
      'sep': '09', 'septiembre': '09',
      'oct': '10', 'octubre': '10',
      'nov': '11', 'noviembre': '11',
      'dic': '12', 'diciembre': '12'
    };

    const mesNum = meses[mes.toLowerCase()] || mes.padStart(2, '0');
    const diaNum = dia.padStart(2, '0');

    return `${anio}-${mesNum}-${diaNum}`;
  }

  extractCuotasFromDesc(descripcion) {
    // Buscar "C.05/06" en descripción
    const match = descripcion.match(/C\.(\d{2})\/(\d{2})/);
    return match ? match[0] : null;
  }

  /**
   * Extrae line items (productos/servicios) del texto de la factura
   * @param {string} text - Texto de la factura
   * @returns {Array} Array de items con estructura {numero, descripcion, cantidad, unidad, precioUnitario, subtotal, alicuotaIva, importeIva, totalLinea}
   */
  extractLineItemsFromText(text) {
    const items = [];

    // Patrones comunes en facturas argentinas con tabla estructurada
    // Formato 1: "1  Producto ABC   2.00  un  $1.000,00  $2.000,00"
    // Formato 2: "Nro Descripción   Cant  Uni  P.Unit     Subtotal"

    const patterns = [
      // Patrón con número de línea explícito
      // Captura: (nro) (descripcion) (cantidad) (unidad) (p.unit) (subtotal)
      /^(\d+)\s+(.{10,100}?)\s+(\d+[.,]\d+|\d+)\s+(un|kg|m|lt|hs|u|unid)\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/gmi,

      // Patrón sin número (usar índice)
      // Captura: (descripcion) (cantidad) (unidad) (p.unit) (subtotal)
      /^([A-ZÑÁÉÍÓÚ].{10,80}?)\s+(\d+[.,]\d+|\d+)\s+(un|kg|m|lt|hs|u|unid)\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/gmi,
    ];

    let lineNumber = 1;

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex

      while ((match = pattern.exec(text)) !== null) {
        const hasLineNumber = !isNaN(parseInt(match[1]));

        const item = {
          numero: hasLineNumber ? parseInt(match[1]) : lineNumber++,
          descripcion: hasLineNumber ? match[2]?.trim() : match[1]?.trim(),
          cantidad: this.parseNumber(hasLineNumber ? match[3] : match[2]),
          unidad: hasLineNumber ? match[4] : match[3],
          precioUnitario: this.parseNumber(hasLineNumber ? match[5] : match[4]),
          subtotal: this.parseNumber(hasLineNumber ? match[6] : match[5]),
          alicuotaIva: null, // Se calcula después según tipo de factura
          importeIva: null,
          totalLinea: this.parseNumber(hasLineNumber ? match[6] : match[5])
        };

        // Validación básica
        if (item.descripcion && item.cantidad > 0 && item.subtotal > 0) {
          items.push(item);
        }
      }

      if (items.length > 0) break; // Si encontramos items, no probar otros patrones
    }

    console.log(`[LINE ITEMS] Extraídos ${items.length} items con RegEx`);
    return items;
  }

  /**
   * Extrae impuestos detallados del texto de la factura
   * @param {string} text - Texto de la factura
   * @returns {Array} Array de impuestos con estructura {tipo, descripcion, alicuota, baseImponible, importe}
   */
  extractImpuestosDetalleFromText(text) {
    const impuestos = [];

    // Patrones para diferentes tipos de impuestos argentinos

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
        const alicuota = this.parseNumber(match[1]);
        const importe = this.parseNumber(match[2]);
        const baseImponible = match[3] ? this.parseNumber(match[3]) : null;

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
    const percepcionPatterns = [
      // "Percepción IIBB: $100,00" o "Perc. IIBB  $100,00"
      /Perc(?:epci[oó]n)?\.?\s+([A-ZÑ\s]+)\s*[:.]?\s*\$?\s*([\d.,]+)/gi,
      // "IIBB  5.00%  $1000.00  $50.00"
      /IIBB\s+([\d.,]+)%\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/gi
    ];

    for (const pattern of percepcionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const descripcionMatch = match[1]?.trim();
        const alicuotaOImporte1 = this.parseNumber(match[2]);
        const importe = match[3] ? this.parseNumber(match[3]) : alicuotaOImporte1;
        const alicuota = match[3] ? alicuotaOImporte1 : null;

        if (importe > 0) {
          impuestos.push({
            tipo: 'PERCEPCION',
            descripcion: `Percepción ${descripcionMatch || 'IIBB'}`,
            alicuota: alicuota,
            baseImponible: null,
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
        const importe = this.parseNumber(match[2]);

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
        const importe = this.parseNumber(match[1]);

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

    console.log(`[IMPUESTOS DETALLE] Extraídos ${uniqueImpuestos.length} impuestos con RegEx`);
    return uniqueImpuestos;
  }

  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}

module.exports = DocumentProcessor;