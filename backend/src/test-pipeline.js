const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

/**
 * Script de prueba para el Pipeline de Extracción de Documentos
 *
 * Prueba el flujo completo:
 * 1. CLASIFICACIÓN del documento
 * 2. EXTRACCIÓN con prompt especializado según tipo detectado
 */

const MODELS_DIR = path.join(__dirname, '../../Modelos de Facturas de PV');
const OUTPUT_DIR = path.join(__dirname, '../../test-results');

// Prompts (copiados de seeds/prompts-pipeline.js)
const PROMPTS = {
  CLASIFICADOR: `Analiza el siguiente texto de un documento fiscal argentino y determina su tipo exacto.

TIPOS POSIBLES:
- FACTURA_A: Factura tipo A (entre empresas/responsables inscriptos)
- FACTURA_B: Factura tipo B (a responsables inscriptos/monotributistas)
- FACTURA_C: Factura tipo C (a consumidores finales)
- NOTA_CREDITO: Nota de crédito (cualquier tipo)
- DESPACHO_ADUANA: Despacho de aduana / documentación aduanera
- COMPROBANTE_IMPORTACION: Comprobante de importación
- TICKET: Ticket fiscal / comprobante de consumidor final

INSTRUCCIONES:
1. Lee el documento y busca indicadores clave:
   - Para facturas: tipo en recuadro superior (A, B, C)
   - Para despachos: palabras "DESPACHO", "ADUANA", "IMPORTACION"
   - Para tickets: "TICKET", "CONSUMIDOR FINAL", sin discriminación de IVA

2. Asigna un nivel de confianza (0.0 a 1.0):
   - 0.9-1.0: Muy seguro (tipo explícito visible)
   - 0.7-0.8: Seguro (varios indicadores coinciden)
   - 0.5-0.6: Probable (pocos indicadores)
   - <0.5: Incierto

3. Identifica subtipos si aplica (ejemplo: ["SERVICIOS"], ["PRODUCTOS"], ["IMPORTACION"])

Texto del documento:
{{DOCUMENT_TEXT}}

Responde ÚNICAMENTE con un objeto JSON válido en este formato exacto:
{
  "tipo": "FACTURA_A",
  "confianza": 0.95,
  "subtipos": ["SERVICIOS"]
}`,

  EXTRACCION_FACTURA_A: `Eres un experto en facturas argentinas TIPO A (entre responsables inscriptos).

CONTEXTO DE FACTURA A:
- Emitida por responsables inscriptos
- Destinada a responsables inscriptos
- Discrimina IVA (21%, 10.5%, 27%)
- Puede tener percepciones IIBB
- Puede tener retenciones de ganancias/IVA
- Tiene CAE obligatorio

CAMPOS A EXTRAER:
- fecha (YYYY-MM-DD)
- importe (total con IVA)
- cuit (del emisor - primer CUIT que aparezca)
- numeroComprobante (formato XXXXX-XXXXXXXX)
- cae (14 dígitos numéricos - buscar "CAE" o "C.A.E.")
- tipoComprobante ("FACTURA A")
- razonSocial (empresa emisora - en el encabezado)
- netoGravado (subtotal antes de IVA)
- exento (si existe concepto exento)
- impuestos (suma de IVA + percepciones + retenciones)
- cupon (si es pago con tarjeta)
- lineItems (array de items - EXTRAER TODOS los items de la tabla de detalle)
- impuestosDetalle (array con cada impuesto separado)

ESTRUCTURA DE lineItems:
[{
  "numero": 1,
  "codigoProducto": "COD-123",
  "descripcion": "Descripción del producto/servicio",
  "cantidad": 2.00,
  "unidad": "un",
  "precioUnitario": 1000.00,
  "subtotal": 2000.00,
  "alicuotaIva": 21.00,
  "importeIva": 420.00,
  "totalLinea": 2420.00
}]

ESTRUCTURA DE impuestosDetalle:
[{
  "tipo": "IVA",
  "descripcion": "IVA 21%",
  "alicuota": 21.00,
  "baseImponible": 10000.00,
  "importe": 2100.00
}, {
  "tipo": "PERCEPCION",
  "descripcion": "Perc. IIBB Buenos Aires",
  "alicuota": null,
  "baseImponible": null,
  "importe": 350.00
}]

IMPORTANTE:
- Extrae TODOS los line items de la tabla (no calcules, extrae lo que dice)
- Separa CADA impuesto (no sumes IVA 21% + IVA 10.5%)
- Si un campo no existe, usa null
- Sé preciso con decimales

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`,

  EXTRACCION_FACTURA_B: `Eres un experto en facturas argentinas TIPO B.

CONTEXTO DE FACTURA B:
- Emitida a monotributistas o responsables inscriptos
- IVA INCLUIDO en los precios (no discriminado)
- El total incluye IVA pero no se detalla
- Puede tener percepciones
- Tiene CAE obligatorio

CAMPOS A EXTRAER:
- fecha (YYYY-MM-DD)
- importe (total INCLUYE IVA)
- cuit (del emisor)
- numeroComprobante
- cae (14 dígitos)
- tipoComprobante ("FACTURA B")
- razonSocial
- netoGravado (calcular: total / 1.21 si aplica IVA 21%)
- exento (si existe)
- impuestos (IVA implícito + percepciones)
- cupon
- lineItems (array de items)
- impuestosDetalle (puede estar vacío si IVA no discriminado)

IMPORTANTE PARA FACTURA B:
- Los precios YA INCLUYEN IVA
- Si no hay tabla de IVA separada, el campo impuestosDetalle puede ir vacío
- El netoGravado se calcula dividiendo el total por 1.21 (o la alícuota correspondiente)

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`,

  EXTRACCION_FACTURA_C: `Eres un experto en facturas argentinas TIPO C (consumidor final).

CONTEXTO DE FACTURA C:
- Emitida a consumidores finales
- IVA INCLUIDO en precios (nunca discriminado)
- No tiene detalle de IVA
- Generalmente no tiene percepciones/retenciones
- Puede no tener CAE en algunos casos antiguos

CAMPOS A EXTRAER:
- fecha (YYYY-MM-DD)
- importe (total con IVA incluido)
- cuit (del emisor)
- numeroComprobante
- cae (si existe)
- tipoComprobante ("FACTURA C")
- razonSocial
- netoGravado (0 o null - no aplica)
- exento (generalmente 0)
- impuestos (0 - IVA incluido no discriminado)
- cupon
- lineItems (puede ser simple)
- impuestosDetalle (generalmente vacío)

IMPORTANTE:
- En Factura C el IVA está incluido pero NO se discrimina
- netoGravado, exento e impuestos pueden ser 0
- Enfócate en fecha, importe, CUIT y número de comprobante

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`,

  EXTRACCION_NOTA_CREDITO: `Eres un experto en notas de crédito argentinas.

CONTEXTO:
- Las notas de crédito anulan o modifican facturas anteriores
- Pueden ser tipo A, B o C
- Contienen similar información que las facturas

CAMPOS A EXTRAER:
- fecha (YYYY-MM-DD)
- importe (total - generalmente negativo o como ajuste)
- cuit (del emisor)
- numeroComprobante
- cae
- tipoComprobante ("NOTA_CREDITO")
- razonSocial
- netoGravado
- exento
- impuestos
- comprobanteRelacionado (número de factura que modifica)
- motivo (motivo de la nota de crédito)
- lineItems
- impuestosDetalle

Texto de la nota de crédito:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`,

  EXTRACCION_DESPACHO_ADUANA: `Eres un experto en despachos de aduana argentinos.

CONTEXTO:
- Documentos de importación
- Incluyen aranceles, tasas, impuestos aduaneros
- Pueden tener múltiples posiciones arancelarias
- FOB, CIF, fletes, seguros

CAMPOS A EXTRAER:
- fecha (fecha del despacho)
- importe (valor total CIF o equivalente)
- cuit (del despachante o importador)
- numeroComprobante (número de despacho)
- tipoComprobante ("DESPACHO_ADUANA")
- razonSocial (despachante de aduana)
- netoGravado (valor FOB o neto)
- impuestos (aranceles + IVA + percepciones)
- lineItems (posiciones arancelarias como items)
- impuestosDetalle (desglose de aranceles, IVA, tasas)

ESTRUCTURA ESPECIAL PARA DESPACHOS:
- Item puede ser una posición arancelaria
- descripcion: descripción de mercadería
- cantidad: cantidad de unidades
- precioUnitario: valor FOB unitario

Texto del despacho:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`
};

// Mapeo de tipos a prompts
const TIPO_TO_PROMPT = {
  'FACTURA_A': 'EXTRACCION_FACTURA_A',
  'FACTURA_B': 'EXTRACCION_FACTURA_B',
  'FACTURA_C': 'EXTRACCION_FACTURA_C',
  'NOTA_CREDITO': 'EXTRACCION_NOTA_CREDITO',
  'DESPACHO_ADUANA': 'EXTRACCION_DESPACHO_ADUANA',
  'TICKET': 'EXTRACCION_FACTURA_C', // Reutiliza Factura C
  'COMPROBANTE_IMPORTACION': 'EXTRACCION_DESPACHO_ADUANA' // Reutiliza Despacho
};

// Inicializar Claude (Anthropic)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Modelo de Claude a usar
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Extrae texto de un PDF
 */
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`❌ Error extrayendo texto de ${pdfPath}:`, error.message);
    return null;
  }
}

/**
 * Llama a Claude (Anthropic) con un prompt
 */
async function callClaude(prompt) {
  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('❌ Error llamando a Claude:', error.message);
    throw error;
  }
}

/**
 * Parsea respuesta JSON de IA
 */
function parseJSONResponse(text) {
  try {
    // Limpiar markdown
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```json\n?/g, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    cleaned = cleaned.trim();

    // Extraer JSON
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ Error parseando JSON:', error.message);
    console.log('Respuesta recibida:', text.substring(0, 500));
    return null;
  }
}

/**
 * PASO 1: Clasificar documento
 */
async function classify(documentText) {
  console.log('  🔍 PASO 1: Clasificando documento...');

  const prompt = PROMPTS.CLASIFICADOR.replace('{{DOCUMENT_TEXT}}', documentText);

  const response = await callClaude(prompt);
  const clasificacion = parseJSONResponse(response);

  if (!clasificacion) {
    throw new Error('No se pudo clasificar el documento');
  }

  console.log(`  ✅ Tipo detectado: ${clasificacion.tipo} (confianza: ${(clasificacion.confianza * 100).toFixed(1)}%)`);

  return clasificacion;
}

/**
 * PASO 2: Extraer con prompt especializado
 */
async function extract(documentText, tipo) {
  console.log(`  🔍 PASO 2: Extrayendo con prompt ${tipo}...`);

  const promptKey = TIPO_TO_PROMPT[tipo] || 'EXTRACCION_FACTURA_A';
  const promptTemplate = PROMPTS[promptKey];

  if (!promptTemplate) {
    throw new Error(`No hay prompt para tipo: ${tipo}`);
  }

  const prompt = promptTemplate.replace('{{DOCUMENT_TEXT}}', documentText);

  const response = await callClaude(prompt);
  const datos = parseJSONResponse(response);

  if (!datos) {
    throw new Error('No se pudo extraer datos del documento');
  }

  console.log(`  ✅ Extracción completada - ${Object.keys(datos).length} campos extraídos`);

  return datos;
}

/**
 * Procesa un documento completo (Pipeline)
 */
async function processDocument(pdfPath) {
  const fileName = path.basename(pdfPath);
  console.log(`\n📄 Procesando: ${fileName}`);

  const startTime = Date.now();

  try {
    // Extraer texto
    console.log('  📖 Extrayendo texto del PDF...');
    const documentText = await extractTextFromPDF(pdfPath);

    if (!documentText) {
      throw new Error('No se pudo extraer texto del PDF');
    }

    console.log(`  ✅ Texto extraído: ${documentText.length} caracteres`);

    // PASO 1: Clasificar
    const clasificacion = await classify(documentText);

    // PASO 2: Extraer
    const datos = await extract(documentText, clasificacion.tipo);

    const duration = Date.now() - startTime;

    return {
      fileName,
      success: true,
      duracion: duration,
      clasificacion,
      datos,
      textLength: documentText.length
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`  ❌ ERROR: ${error.message}`);

    return {
      fileName,
      success: false,
      duracion: duration,
      error: error.message
    };
  }
}

/**
 * Genera reporte HTML
 */
function generateHTMLReport(results) {
  const totalDocs = results.length;
  const successDocs = results.filter(r => r.success).length;
  const failedDocs = totalDocs - successDocs;
  const avgDuration = results.reduce((acc, r) => acc + r.duracion, 0) / totalDocs;

  const tiposDetectados = {};
  results.filter(r => r.success).forEach(r => {
    const tipo = r.clasificacion.tipo;
    tiposDetectados[tipo] = (tiposDetectados[tipo] || 0) + 1;
  });

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Pruebas - Pipeline de Extracción</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }
    .success { color: #10b981; }
    .error { color: #ef4444; }
    .document {
      background: white;
      margin: 15px 0;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .document.failed {
      border-left: 4px solid #ef4444;
    }
    .document.success {
      border-left: 4px solid #10b981;
    }
    .document h3 {
      margin-top: 0;
      color: #1f2937;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin: 0 5px 5px 0;
    }
    .badge.success { background: #d1fae5; color: #065f46; }
    .badge.error { background: #fee2e2; color: #991b1b; }
    .badge.tipo { background: #dbeafe; color: #1e40af; }
    .badge.confianza { background: #fef3c7; color: #92400e; }
    .datos {
      margin-top: 15px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-height: 400px;
      overflow-y: auto;
    }
    .tipos-chart {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin: 20px 0;
    }
    .tipo-bar {
      display: flex;
      align-items: center;
      margin: 10px 0;
    }
    .tipo-label {
      width: 180px;
      font-weight: 600;
      color: #374151;
    }
    .tipo-progress {
      flex: 1;
      height: 30px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    .tipo-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      color: white;
      font-weight: bold;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>📊 Reporte de Pruebas - Pipeline de Extracción</h1>

  <div class="stats">
    <div class="stat-card">
      <h3>Total Documentos</h3>
      <div class="value">${totalDocs}</div>
    </div>
    <div class="stat-card">
      <h3>Exitosos</h3>
      <div class="value success">${successDocs}</div>
    </div>
    <div class="stat-card">
      <h3>Fallidos</h3>
      <div class="value error">${failedDocs}</div>
    </div>
    <div class="stat-card">
      <h3>Duración Promedio</h3>
      <div class="value">${(avgDuration / 1000).toFixed(1)}s</div>
    </div>
  </div>

  <div class="tipos-chart">
    <h2>Tipos de Documentos Detectados</h2>
`;

  Object.entries(tiposDetectados).forEach(([tipo, count]) => {
    const percentage = (count / successDocs * 100).toFixed(1);
    html += `
    <div class="tipo-bar">
      <div class="tipo-label">${tipo}</div>
      <div class="tipo-progress">
        <div class="tipo-progress-fill" style="width: ${percentage}%">
          ${count} (${percentage}%)
        </div>
      </div>
    </div>`;
  });

  html += `
  </div>

  <h2>Resultados Detallados</h2>
`;

  results.forEach(result => {
    const statusClass = result.success ? 'success' : 'failed';
    const statusText = result.success ? 'EXITOSO' : 'FALLIDO';

    html += `
  <div class="document ${statusClass}">
    <h3>${result.fileName}</h3>
    <div>
      <span class="badge ${statusClass}">${statusText}</span>
      <span class="badge">⏱️ ${(result.duracion / 1000).toFixed(2)}s</span>
`;

    if (result.success) {
      html += `
      <span class="badge tipo">📋 ${result.clasificacion.tipo}</span>
      <span class="badge confianza">🎯 ${(result.clasificacion.confianza * 100).toFixed(1)}%</span>
    </div>
    <details>
      <summary style="cursor: pointer; color: #2563eb; margin-top: 10px;">Ver datos extraídos</summary>
      <div class="datos">${JSON.stringify(result.datos, null, 2)}</div>
    </details>
`;
    } else {
      html += `
    </div>
    <p style="color: #ef4444; margin-top: 10px;">❌ ${result.error}</p>
`;
    }

    html += `
  </div>`;
  });

  html += `
</body>
</html>`;

  return html;
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 ===== TEST DE PIPELINE DE EXTRACCIÓN =====\n');

  // Verificar que existe la carpeta
  if (!fs.existsSync(MODELS_DIR)) {
    console.error(`❌ No se encuentra la carpeta: ${MODELS_DIR}`);
    process.exit(1);
  }

  // Verificar API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY no configurada en .env');
    process.exit(1);
  }

  console.log('🤖 Usando Claude (Anthropic) - Modelo:', CLAUDE_MODEL);

  // Crear carpeta de resultados
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Obtener lista de PDFs
  const files = fs.readdirSync(MODELS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(MODELS_DIR, f));

  console.log(`📁 Encontrados ${files.length} documentos PDF\n`);

  // Procesar cada documento
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] ==============================`);

    const result = await processDocument(file);
    results.push(result);

    // Pequeña pausa entre llamadas (rate limiting)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Resumen final
  console.log('\n\n🎉 ===== PRUEBAS COMPLETADAS =====\n');

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;

  console.log(`✅ Exitosos: ${successCount}/${results.length}`);
  console.log(`❌ Fallidos: ${failedCount}/${results.length}`);

  if (successCount > 0) {
    const avgDuration = results
      .filter(r => r.success)
      .reduce((acc, r) => acc + r.duracion, 0) / successCount;
    console.log(`⏱️  Duración promedio: ${(avgDuration / 1000).toFixed(2)}s`);
  }

  // Guardar resultados JSON
  const jsonPath = path.join(OUTPUT_DIR, `test-results-${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Resultados guardados: ${jsonPath}`);

  // Generar reporte HTML
  const htmlReport = generateHTMLReport(results);
  const htmlPath = path.join(OUTPUT_DIR, `test-report-${Date.now()}.html`);
  fs.writeFileSync(htmlPath, htmlReport);
  console.log(`📄 Reporte HTML generado: ${htmlPath}`);

  console.log('\n✅ Proceso completado!\n');
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
