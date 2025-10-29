const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed inicial de prompts de IA
 * Migra los prompts hardcodeados de documentProcessor.js a la base de datos
 */
async function seedPrompts() {
  console.log('🌱 Seeding AI prompts...');

  const prompts = [
    // ========== EXTRACCIÓN DE FACTURAS ==========
    {
      clave: 'EXTRACCION_FACTURA_OPENAI',
      nombre: 'Extracción de Factura - OpenAI',
      descripcion: 'Prompt para extraer datos de facturas argentinas usando OpenAI GPT-4',
      motor: 'openai',
      prompt: `Analiza el siguiente texto de una factura o comprobante argentino y extrae la siguiente información en formato JSON:

Información a extraer:
- fecha: fecha del comprobante (formato YYYY-MM-DD)
- importe: monto total (número sin símbolos) - IMPORTANTE: Si ves "145,000.00" extraer como 145000, NO como 145
- cuit: CUIT del emisor (formato XX-XXXXXXXX-X) - tomar el PRIMER CUIT que encuentres cerca de "Ingresos Brutos" o "Inicio de Actividades". NO tomar CUITs que aparezcan después
- numeroComprobante: número de comprobante (formato XXXXX-XXXXXXXX o similar)
- cae: CAE (Código de Autorización Electrónico) - 14 dígitos numéricos
- tipoComprobante: tipo de comprobante (FACTURA A, FACTURA B, FACTURA C, NOTA DE CREDITO A, NOTA DE DEBITO B, etc.) - buscar la letra exacta (A, B, C) en un recuadro en el CENTRO SUPERIOR de la hoja. NO asumir tipo A si no está claro
- razonSocial: Tomar la PRIMERA razón social que encuentres al leer de arriba hacia abajo. NO la segunda, tercera, etc. Solo la primera
- netoGravado: importe neto gravado o subtotal (número sin símbolos) - IMPORTANTE: "Subtotal" generalmente representa el neto gravado
- exento: importe exento (número sin símbolos) - IMPORTANTE: Si no aparece explícito, usar EXENTO = TOTAL - GRAVADO - IMPUESTOS
- impuestos: suma total de TODOS los impuestos (IVA 21%, IVA 10.5%, IVA 27%, impuestos internos, retenciones, percepciones, etc.) - número sin símbolos
- cupon: número de cupón si es pago con tarjeta
- lineItems: array de items con estructura [{numero, codigoProducto, descripcion, cantidad, unidad, precioUnitario, subtotal, alicuotaIva, importeIva, totalLinea}] - Buscar tabla de detalle. Si no hay items, devolver array vacío []
- impuestosDetalle: array de impuestos [{tipo: "IVA/PERCEPCION/RETENCION/IMPUESTO_INTERNO", descripcion: "IVA 21%/Percepción IIBB/etc", alicuota: número o null, baseImponible: número o null, importe: número}] - Extraer CADA impuesto por separado (NO sumar). Si no hay detalle, devolver array vacío []

IMPORTANTE PARA LINE ITEMS - EXTRAER DIRECTAMENTE, NO CALCULAR:
- Buscar tabla de detalle en factura. Extraer TODOS los items listados.

EJEMPLO DE TABLA TÍPICA:
Nro | Descripción          | Cant | Unidad | Precio | Subtotal | % IVA  | IVA      | Total
1   | Producto X           | 2.00 | un     | 1000   | 2000.00  | 21.00  | 420.00   | 2420.00

IMPORTANTE:
- Columna "% IVA" o "IVA %" (CON %) = alicuotaIva (porcentaje: 21.00)
- Columna "IVA" (SIN %) = importeIva (importe en $: 420.00)
- ❌ NO calcular IVA - EXTRAER directamente de la columna

MAPEO DE COLUMNAS (extraer el valor EXACTO que aparece, NO calcular):
- **numero**: Primera columna (1, 2, 3...)
- **codigoProducto**: Código/SKU del producto - buscar columna "Código", "Cód.", "SKU", "Art.", "Artículo" o formato numérico/alfanumérico tipo "COD-123", "ART-456", "12345". Si no hay código visible, dejar null
- **descripcion**: Columna nombre del producto/servicio
- **cantidad**: Columna cantidad (2.00, 1.00, etc.)
- **unidad**: Columna unidad (un, kg, m, lt, hs)
- **precioUnitario**: Columna "Precio", "P.Unit", "P.Unitario", "Unitario" (1000 en el ejemplo)
- **subtotal**: Columna "Subtotal" o "Importe" (2000.00 en el ejemplo)
- **alicuotaIva**: Columna "% IVA" o "IVA %" (CON símbolo %) - PORCENTAJE pequeño (21.00, 10.50, 27.00)
- **importeIva**: Columna "IVA" (SIN %) o "IVA $" - IMPORTE en pesos (420.00, 1500.00)
- **totalLinea**: Columna "Total" (2420.00 en el ejemplo)

⚠️ REGLAS CRÍTICAS - NO CALCULAR, SOLO EXTRAER:
1. ❌ NUNCA CALCULES - extraer valores EXACTOS como están escritos en la factura
2. precioUnitario: columna "Precio", "P.Unit", "P.Unitario", "Unitario" - NUNCA columna "IVA"
3. alicuotaIva: columna "% IVA" o "IVA %" (CON %) - número pequeño (21.00, 10.50)
4. importeIva: columna "IVA" (SIN %) o "IVA $" - número grande (420.00, 1500.00)
5. ❌ NO calcules importeIva multiplicando - EXTRAE el valor de la columna
6. Precio unitario está ANTES de columnas IVA (izquierda→derecha)

IMPORTANTE PARA IMPUESTOS DETALLE:
- Buscar sección de tributos/impuestos
- Extraer CADA impuesto como registro separado (IVA 21%, IVA 10.5%, Percepción IIBB, Retención Ganancias, etc.)
- NO sumar, mantener detallado
- Para IVA: incluir alícuota y base imponible
- Para percepciones/retenciones: pueden no tener alícuota (monto fijo)

Texto del documento:
{{text}}

Responde SOLO con un objeto JSON válido, sin texto adicional:`,
      variables: {
        text: 'Texto completo del documento a procesar'
      },
      activo: true,
      tenantId: null // Global
    },

    {
      clave: 'EXTRACCION_FACTURA_CLAUDE',
      nombre: 'Extracción de Factura - Claude',
      descripcion: 'Prompt para extraer datos de facturas argentinas usando Claude (Anthropic)',
      motor: 'anthropic',
      prompt: `Analiza este texto de factura argentina y extrae en JSON:
- fecha (YYYY-MM-DD)
- importe (número)
- cuit (XX-XXXXXXXX-X)
- numeroComprobante (XXXXX-XXXXXXXX)
- cae (14 dígitos numéricos)
- tipoComprobante (FACTURA A/B/C, NOTA DE CREDITO A/B/C, NOTA DE DEBITO A/B/C - buscar en recuadro superior central)
- razonSocial (nombre de la empresa QUE EMITE/FACTURA - está en el ENCABEZADO, NO tomar "Razón Social:" que es del cliente)
- netoGravado (importe neto gravado o subtotal - número) - IMPORTANTE: "Subtotal" generalmente representa el neto gravado
- exento (importe exento - número) - IMPORTANTE: Si no aparece explícito, usar EXENTO = TOTAL - GRAVADO - IMPUESTOS
- impuestos (suma total de TODOS los impuestos: IVA 21%, IVA 10.5%, IVA 27%, impuestos internos, retenciones, percepciones, etc. - número)
- cupon (número de cupón si es pago con tarjeta)
- lineItems: array de items [{numero, descripcion, cantidad, unidad, precioUnitario, subtotal, alicuotaIva, importeIva, totalLinea}] - Si no hay items, array vacío []
- impuestosDetalle: array de impuestos [{tipo: "IVA/PERCEPCION/RETENCION/IMPUESTO_INTERNO", descripcion, alicuota, baseImponible, importe}] - Extraer CADA impuesto por separado, NO sumar. Si no hay detalle, array vacío []

IMPORTANTE PARA LINE ITEMS - EXTRAER DIRECTAMENTE, NO CALCULAR:
- Buscar tabla de detalle en factura. Extraer TODOS los items listados.

EJEMPLO DE TABLA TÍPICA:
Nro | Descripción          | Cant | Unidad | Precio | Subtotal | % IVA  | IVA      | Total
1   | Producto X           | 2.00 | un     | 1000   | 2000.00  | 21.00  | 420.00   | 2420.00

IMPORTANTE:
- Columna "% IVA" o "IVA %" (CON %) = alicuotaIva (porcentaje: 21.00)
- Columna "IVA" (SIN %) = importeIva (importe en $: 420.00)
- ❌ NO calcular IVA - EXTRAER directamente de la columna

MAPEO DE COLUMNAS (extraer el valor EXACTO que aparece, NO calcular):
- **numero**: Primera columna (1, 2, 3...)
- **codigoProducto**: Código/SKU del producto - buscar columna "Código", "Cód.", "SKU", "Art.", "Artículo" o formato numérico/alfanumérico tipo "COD-123", "ART-456", "12345". Si no hay código visible, dejar null
- **descripcion**: Columna nombre del producto/servicio
- **cantidad**: Columna cantidad (2.00, 1.00, etc.)
- **unidad**: Columna unidad (un, kg, m, lt, hs)
- **precioUnitario**: Columna "Precio", "P.Unit", "P.Unitario", "Unitario" (1000 en el ejemplo)
- **subtotal**: Columna "Subtotal" o "Importe" (2000.00 en el ejemplo)
- **alicuotaIva**: Columna "% IVA" o "IVA %" (CON símbolo %) - PORCENTAJE pequeño (21.00, 10.50, 27.00)
- **importeIva**: Columna "IVA" (SIN %) o "IVA $" - IMPORTE en pesos (420.00, 1500.00)
- **totalLinea**: Columna "Total" (2420.00 en el ejemplo)

⚠️ REGLAS CRÍTICAS - NO CALCULAR, SOLO EXTRAER:
1. ❌ NUNCA CALCULES - extraer valores EXACTOS como están escritos en la factura
2. precioUnitario: columna "Precio", "P.Unit", "P.Unitario", "Unitario" - NUNCA columna "IVA"
3. alicuotaIva: columna "% IVA" o "IVA %" (CON %) - número pequeño (21.00, 10.50)
4. importeIva: columna "IVA" (SIN %) o "IVA $" - número grande (420.00, 1500.00)
5. ❌ NO calcules importeIva multiplicando - EXTRAE el valor de la columna
6. Precio unitario está ANTES de columnas IVA (izquierda→derecha)

IMPORTANTE PARA IMPUESTOS DETALLE:
- Buscar sección de tributos/impuestos. Extraer CADA uno (IVA 21%, IVA 10.5%, Percepción IIBB, Retención Ganancias, etc.) como registro separado.

Texto: {{text}}

JSON:`,
      variables: {
        text: 'Texto completo del documento a procesar'
      },
      activo: true,
      tenantId: null
    },

    {
      clave: 'EXTRACCION_FACTURA_GEMINI',
      nombre: 'Extracción de Factura - Gemini',
      descripcion: 'Prompt para extraer datos de facturas argentinas usando Google Gemini',
      motor: 'gemini',
      prompt: `Extrae de esta factura argentina y devuelve SOLO JSON válido sin comentarios ni markdown:
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
  "cupon": "número de cupón si es pago con tarjeta",

  "lineItems": [
    {
      "numero": 1,
      "codigoProducto": "código/SKU del producto (COD-123, ART-456, 12345, etc.) o null",
      "descripcion": "descripción del producto/servicio",
      "cantidad": número,
      "unidad": "un/kg/m/lt/hs",
      "precioUnitario": número,
      "subtotal": número,
      "alicuotaIva": número (21.00, 10.50, 27.00, 5.00, 0),
      "importeIva": número,
      "totalLinea": número
    }
  ],

  "impuestosDetalle": [
    {
      "tipo": "IVA/PERCEPCION/RETENCION/IMPUESTO_INTERNO",
      "descripcion": "IVA 21%/Percepción IIBB/Retención Ganancias/etc",
      "alicuota": número (21.00, 10.50, etc) o null,
      "baseImponible": número o null,
      "importe": número
    }
  ]
}

INSTRUCCIONES PARA LINE ITEMS - EXTRAER DIRECTAMENTE, NO CALCULAR:
- Buscar tabla de detalle en factura. Extraer TODOS los items listados.

EJEMPLO DE TABLA TÍPICA:
Nro | Descripción          | Cant | Unidad | Precio | Subtotal | % IVA  | IVA      | Total
1   | Producto X           | 2.00 | un     | 1000   | 2000.00  | 21.00  | 420.00   | 2420.00

IMPORTANTE:
- Columna "% IVA" o "IVA %" (CON %) = alicuotaIva (porcentaje: 21.00)
- Columna "IVA" (SIN %) = importeIva (importe en $: 420.00)
- ❌ NO calcular IVA - EXTRAER directamente de la columna

MAPEO DE COLUMNAS (extraer el valor EXACTO que aparece, NO calcular):
- numero: Primera columna (1, 2, 3...)
- descripcion: Segunda columna (nombre del producto/servicio)
- cantidad: Tercera columna (2.00, 1.00, etc.)
- unidad: Cuarta columna (un, kg, m, lt, hs)
- precioUnitario: Columna "Precio", "P.Unit", "P.Unitario", "Unitario" (1000 en el ejemplo)
- subtotal: Columna "Subtotal" o "Importe" (2000.00 en el ejemplo)
- alicuotaIva: Columna "% IVA" o "IVA %" (CON %) - PORCENTAJE pequeño (21.00, 10.50, 27.00)
- importeIva: Columna "IVA" (SIN %) o "IVA $" - IMPORTE en pesos (420.00, 1500.00)
- totalLinea: Columna "Total" (2420.00 en el ejemplo)

⚠️ REGLAS CRÍTICAS - NO CALCULAR, SOLO EXTRAER:
1. ❌ NUNCA CALCULES - extraer valores EXACTOS como están escritos
2. precioUnitario: columna "Precio", "P.Unit", "P.Unitario", "Unitario" - NUNCA "IVA"
3. alicuotaIva: columna "% IVA" o "IVA %" (CON %) - pequeño (21.00, 10.50)
4. importeIva: columna "IVA" (SIN %) o "IVA $" - grande (420.00, 1500.00)
5. ❌ NO calcules importeIva - EXTRAE el valor de la columna
6. Precio está ANTES de columnas IVA (izquierda→derecha)
- Si no hay items detallados, devolver array vacío []

INSTRUCCIONES PARA IMPUESTOS DETALLE:
- Extraer CADA impuesto/tributo POR SEPARADO (NO sumar)
- Tipos comunes: "IVA" (21%, 10.5%, 27%, 5%), "PERCEPCION" (IIBB, SUSS), "RETENCION" (Ganancias, IVA), "IMPUESTO_INTERNO"
- Para IVA: indicar alícuota y base imponible
- Para percepciones/retenciones: pueden no tener alícuota (monto fijo)
- Si no hay impuestos detallados, devolver array vacío []
- Validar: suma de todos los impuestos.importe debe aproximarse al campo "impuestos"

IMPORTANTE: NO incluyas comentarios ni texto extra. Solo el JSON.

Texto: {{text}}`,
      variables: {
        text: 'Texto completo del documento a procesar'
      },
      activo: true,
      tenantId: null
    },

    {
      clave: 'EXTRACCION_FACTURA_OLLAMA',
      nombre: 'Extracción de Factura - Ollama (Local)',
      descripcion: 'Prompt para extraer datos de facturas argentinas usando Ollama (IA local)',
      motor: 'ollama',
      prompt: `Extrae datos de esta factura argentina en formato JSON:
- fecha (YYYY-MM-DD)
- importe (solo número)
- cuit (XX-XXXXXXXX-X)
- numeroComprobante
- razonSocial
- tipoComprobante

Texto:
{{text}}

Responde solo JSON:`,
      variables: {
        text: 'Texto completo del documento a procesar'
      },
      activo: false, // Desactivado por defecto (requiere Ollama instalado)
      tenantId: null
    },

    // ========== EXTRACCIÓN DE RESUMEN DE TARJETA ==========
    {
      clave: 'EXTRACCION_RESUMEN_TARJETA',
      nombre: 'Extracción de Resumen de Tarjeta',
      descripcion: 'Prompt para extraer datos de resúmenes de tarjetas de crédito argentinas',
      motor: null, // Puede usar Gemini o Anthropic
      prompt: `Analiza este resumen de tarjeta de crédito argentino (puede ser ICBC, Galicia, BBVA, u otro banco) y extrae la información en formato JSON.

IMPORTANTE: Devuelve SOLO JSON válido sin comentarios ni markdown.

Estructura esperada:
{
  "metadata": {
    "periodo": "YYYYMM" (ej: "202508" para Agosto 2025),
    "numeroTarjeta": "últimos 4 dígitos" (ej: "5643"),
    "titularNombre": "nombre completo del titular",
    "fechaCierre": "YYYY-MM-DD",
    "fechaVencimiento": "YYYY-MM-DD"
  },
  "transacciones": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "nombre del comercio",
      "numeroCupon": "número de cupón (6 dígitos)",
      "importe": número (sin símbolos),
      "cuotas": "C.05/06" (si aplica, sino null),
      "moneda": "ARS" o "USD"
    }
  ]
}

REGLAS ESPECÍFICAS:
1. periodo: Extraer de "Cierre: 28 Ago 25" → "202508", o de "CIERRE ACTUAL 24-Abr-25" → "202504"
2. numeroTarjeta: Buscar "Tarjeta 5643" o últimos 4 dígitos visibles
3. titularNombre: Nombre que aparece en el encabezado
4. Transacciones: Parsear TODAS las líneas de consumos
   - Fechas en formato "25 Agosto 01" → "2025-08-01"
   - Fechas en formato "26-Mar-25" → "2025-03-26"
   - Descripción: Limpiar prefijos como "* ", "K ", "Q "
   - Cuotas: Formato "C.05/06" o null
   - Importes: Parsear números con puntos/comas
5. Ignorar: Saldos anteriores, impuestos, intereses (solo consumos)

Texto del resumen:
{{text}}

JSON:`,
      variables: {
        text: 'Texto completo del resumen de tarjeta'
      },
      activo: true,
      tenantId: null
    }
  ];

  for (const promptData of prompts) {
    try {
      // Buscar si existe un prompt con la misma clave y tenantId
      const existing = await prisma.ai_prompts.findFirst({
        where: {
          clave: promptData.clave,
          tenantId: promptData.tenantId
        }
      });

      let prompt;
      if (existing) {
        // Actualizar si existe
        prompt = await prisma.ai_prompts.update({
          where: { id: existing.id },
          data: {
            nombre: promptData.nombre,
            descripcion: promptData.descripcion,
            prompt: promptData.prompt,
            variables: promptData.variables,
            motor: promptData.motor,
            activo: promptData.activo
          }
        });
        console.log(`  ✅ ${prompt.clave} - ${prompt.nombre} (actualizado)`);
      } else {
        // Crear si no existe
        prompt = await prisma.ai_prompts.create({
          data: promptData
        });
        console.log(`  ✅ ${prompt.clave} - ${prompt.nombre} (creado)`);
      }
    } catch (error) {
      console.error(`  ❌ Error con ${promptData.clave}:`, error.message);
    }
  }

  console.log('✨ Prompts seeded successfully!');
}

// Ejecutar seed si se llama directamente
if (require.main === module) {
  seedPrompts()
    .catch((e) => {
      console.error('❌ Error seeding prompts:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedPrompts };
