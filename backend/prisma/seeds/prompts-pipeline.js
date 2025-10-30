const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seeds de prompts para el sistema de pipeline de extracción
 * - Clasificador de documentos
 * - Extractores especializados por tipo
 */
async function seedPipelinePrompts() {
  console.log('🌱 Seeding pipeline AI prompts...');

  const prompts = [
    // ========== CLASIFICADOR DE DOCUMENTOS ==========
    {
      clave: 'CLASIFICADOR_DOCUMENTO',
      nombre: 'Clasificador de Documentos',
      descripcion: 'Clasifica el tipo de documento fiscal argentino',
      motor: 'gemini',
      tipo: 'CLASIFICADOR',
      prompt: `Analiza el siguiente texto de un documento fiscal argentino y determina su tipo exacto.

TIPOS POSIBLES:
- FACTURA_A: Factura tipo A (entre empresas/responsables inscriptos)
- FACTURA_B: Factura tipo B (a responsables inscriptos/monotributistas)
- FACTURA_C: Factura tipo C (a consumidores finales)
- NOTA_CREDITO: Nota de crédito (cualquier tipo)
- DESPACHO_ADUANA: Despacho de aduana / documentación aduanera
- COMPROBANTE_IMPORTACION: Comprobante de importación
- TICKET: Ticket fiscal / comprobante de consumidor final

INSTRUCCIONES DE CLASIFICACIÓN:

1. INDICADORES PRINCIPALES (orden de prioridad):

   a) Letra en recuadro superior del documento: A, B o C

   b) FACTURA A - Busca TODOS estos indicadores:
      ✓ IVA DISCRIMINADO (separado del subtotal)
      ✓ Frases: "IVA 21%", "Subtotal", "Neto Gravado", "Impuesto Liquidado"
      ✓ Tabla de IVA con alícuotas (21%, 10.5%, 27%)
      ✓ Estructura: Subtotal + IVA = Total
      ✓ Destinatario: "RESPONSABLE INSCRIPTO", "CUIT"
      ✓ Puede tener percepciones/retenciones

   c) FACTURA B - Busca TODOS estos indicadores:
      ✓ IVA INCLUIDO (NO discriminado)
      ✓ Frases: "IVA INCLUIDO", "Precio Final", "Total con IVA"
      ✓ NO hay tabla de IVA separada
      ✓ Estructura: Solo muestra Total (sin desglose de IVA)
      ✓ Destinatario: "MONOTRIBUTISTA", "RESPONSABLE INSCRIPTO"
      ✓ Puede decir "IVA incluido en el precio"
      ✓ **REGLA CRÍTICA**: Si contiene "LEY 27743" → ES FACTURA B (confianza 0.99)

   d) FACTURA C - Busca estos indicadores:
      ✓ IVA INCLUIDO (nunca discriminado)
      ✓ Frases: "CONSUMIDOR FINAL", "CF", "IVA Incluido"
      ✓ NO discrimina IVA
      ✓ NO tiene tabla de impuestos
      ✓ Destinatario: sin CUIT, "Consumidor Final"

   e) Para DESPACHOS ADUANA:
      ✓ Palabras: "DESPACHO", "ADUANA", "IMPORTACION", "DI", "SIM"
      ✓ Términos: "FOB", "CIF", "Arancel", "Posición Arancelaria"

   f) Para TICKETS:
      ✓ Palabras: "TICKET", "TIQUE", "CF"
      ✓ Sin CUIT del cliente
      ✓ Sin discriminación de IVA

2. DIFERENCIACIÓN CRÍTICA ENTRE A y B:
   - **PRIORIDAD 1**: Si contiene "LEY 27743" → FACTURA_B (confianza 0.99)
   - Si ves una TABLA con "IVA 21%" y montos separados → FACTURA_A
   - Si solo dice "Total: $X (IVA incluido)" → FACTURA_B
   - Si hay columnas "Neto", "IVA", "Total" → FACTURA_A
   - Si solo hay columna "Total" → FACTURA_B

3. Asigna nivel de confianza (0.0 a 1.0):
   - 0.95-1.0: Letra visible + 3+ indicadores coinciden
   - 0.85-0.94: Letra visible + 2 indicadores
   - 0.75-0.84: Solo indicadores (sin letra visible)
   - 0.60-0.74: Pocos indicadores
   - <0.60: Dudoso

4. Identifica subtipos si aplica: ["SERVICIOS"], ["PRODUCTOS"], ["IMPORTACION"]

Texto del documento:
{{DOCUMENT_TEXT}}

IMPORTANTE - REGLAS DE ORO:
1. **Si contiene "LEY 27743" → ES FACTURA B** (confianza 0.99) - REGLA ABSOLUTA
2. Si encuentras palabras como "IVA DISCRIMINADO" o una tabla de IVA → es FACTURA_A
3. Si dice "IVA INCLUIDO" sin tabla → es FACTURA_B

Responde ÚNICAMENTE con un objeto JSON válido en este formato exacto:
{
  "tipo": "FACTURA_A",
  "confianza": 0.95,
  "subtipos": ["SERVICIOS"]
}`,
      variables: {
        DOCUMENT_TEXT: 'Texto completo del documento a clasificar'
      },
      activo: true,
      tenantId: null
    },

    // ========== EXTRACCIÓN UNIVERSAL (Para planes Common/Uncommon) ==========
    {
      clave: 'EXTRACCION_UNIVERSAL',
      nombre: 'Extracción Universal de Documentos',
      descripcion: 'Prompt universal para extraer datos de cualquier tipo de documento fiscal (planes Common/Uncommon)',
      motor: 'anthropic',
      tipo: 'EXTRACTOR_SIMPLE',
      prompt: `Extrae los datos de este documento fiscal argentino en formato JSON.

CAMPOS A EXTRAER:
- fecha: fecha del comprobante (YYYY-MM-DD)
- importe: monto total (número sin símbolos)
- cuit: CUIT del emisor (XX-XXXXXXXX-X)
- numeroComprobante: número de comprobante
- cae: CAE si está disponible (14 dígitos)
- tipoComprobante: FACTURA A/B/C, NOTA DE CREDITO, TICKET, etc.
- razonSocial: nombre de la empresa que emite
- netoGravado: importe neto gravado
- exento: importe exento (si no aparece: TOTAL - GRAVADO - IMPUESTOS)
- impuestos: suma total de impuestos (IVA + percepciones + retenciones)
- cupon: número de cupón si es pago con tarjeta

Texto del documento:
{{DOCUMENT_TEXT}}

IMPORTANTE:
- Devuelve JSON válido
- Si un campo no está presente, usa null
- Para importes usa números sin símbolos de moneda
- Sé preciso con los cálculos

Responde SOLO con JSON:`,
      variables: {
        DOCUMENT_TEXT: 'Texto del documento'
      },
      activo: true,
      tenantId: null
    },

    // ========== EXTRACTOR ESPECIALIZADO: FACTURA A ==========
    {
      clave: 'EXTRACCION_FACTURA_A',
      nombre: 'Extractor Especializado - Factura A',
      descripcion: 'Extractor optimizado para facturas tipo A argentinas',
      motor: 'anthropic',
      tipo: 'EXTRACTOR_ESPECIALIZADO',
      prompt: `Eres un experto en facturas argentinas TIPO A (entre responsables inscriptos).

CONTEXTO DE FACTURA A:
- Emitida por responsables inscriptos
- Destinada a responsables inscriptos
- Discrimina IVA (21%, 10.5%, 27%)
- Puede tener percepciones IIBB
- Puede tener retenciones de ganancias/IVA
- Tiene CAE obligatorio

CAMPOS A EXTRAER:
- fecha (YYYY-MM-DD)
- importe (total con IVA) - NÚMERO
- cuit (del emisor - primer CUIT que aparezca) - STRING
- numeroComprobante (formato XXXXX-XXXXXXXX) - STRING
- cae (14 dígitos numéricos - buscar "CAE" o "C.A.E.") - STRING
- tipoComprobante ("FACTURA A") - STRING
- razonSocial (empresa emisora - en el encabezado) - STRING
- netoGravado (subtotal antes de IVA) - NÚMERO
- exento (si existe concepto exento) - NÚMERO
- impuestos (NÚMERO: suma total de IVA + percepciones + retenciones) - NO es un objeto, es UN SOLO NÚMERO
- cupon (si es pago con tarjeta) - STRING
- lineItems (array de items - EXTRAER TODOS los items de la tabla de detalle) - ARRAY
- impuestosDetalle (array con cada impuesto separado - aquí va el desglose) - ARRAY

**IMPORTANTE SOBRE IMPUESTOS:**
- El campo "impuestos" debe ser UN NÚMERO (la suma total): 9423.22
- El desglose de impuestos va en "impuestosDetalle" (array de objetos)
- NO pongas un objeto en "impuestos", solo el número total

FORMATO TÍPICO DE LA TABLA DE ITEMS EN FACTURAS ARGENTINAS:
Las tablas de items generalmente tienen columnas en este ORDEN:
1. CANTIDAD (primera columna - izquierda) - Números como 1, 2.5, 10
2. UNIDAD (un, kg, m, hs, etc.)
3. CÓDIGO o CÓDIGO PRODUCTO (opcional)
4. DESCRIPCIÓN o DETALLE (texto descriptivo)
5. PRECIO UNITARIO o P. UNIT
6. SUBTOTAL o IMPORTE
7. IVA % o ALÍCUOTA (21%, 10.5%, etc.)
8. IMPORTE IVA
9. TOTAL o IMPORTE TOTAL

**CRÍTICO PARA CANTIDAD:**
- La CANTIDAD siempre está al INICIO de cada línea de item (primera columna)
- Busca números al PRINCIPIO de cada fila de la tabla de items
- La CANTIDAD aparece ANTES de la descripción del producto
- Ejemplo de línea: "2.00 | un | Servicio de consultoría | 1000.00 | 2000.00"
  → CANTIDAD = 2.00 (primer número de la línea)

ESTRUCTURA DE lineItems:
[{
  "numero": 1,
  "codigoProducto": "COD-123",
  "descripcion": "Descripción del producto/servicio",
  "cantidad": 2.00,  // ← PRIMER NÚMERO de la línea del item
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
- **La CANTIDAD es la PRIMERA COLUMNA** - busca el primer número de cada fila
- Separa CADA impuesto (no sumes IVA 21% + IVA 10.5%)
- Si un campo no existe, usa null
- Sé preciso con decimales
- NO confundas CANTIDAD con precio unitario o subtotal

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`,
      variables: {
        DOCUMENT_TEXT: 'Texto de la factura A'
      },
      activo: true,
      tenantId: null
    },

    // ========== EXTRACTOR ESPECIALIZADO: FACTURA B ==========
    {
      clave: 'EXTRACCION_FACTURA_B',
      nombre: 'Extractor Especializado - Factura B',
      descripcion: 'Extractor optimizado para facturas tipo B argentinas',
      motor: 'anthropic',
      tipo: 'EXTRACTOR_ESPECIALIZADO',
      prompt: `Eres un experto en facturas argentinas TIPO B.

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
- lineItems (array de items - EXTRAER TODOS)
- impuestosDetalle (puede estar vacío si IVA no discriminado)

FORMATO DE LA TABLA DE ITEMS:
Las columnas típicamente aparecen en este ORDEN:
1. CANTIDAD (primera columna - números como 1, 2.5, 10)
2. UNIDAD (un, kg, m, etc.)
3. CÓDIGO (opcional)
4. DESCRIPCIÓN
5. PRECIO UNITARIO (YA incluye IVA en Factura B)
6. TOTAL LÍNEA (YA incluye IVA)

**CRÍTICO:** La CANTIDAD es la PRIMERA COLUMNA, busca el primer número de cada fila.
Ejemplo: "2.00 | un | Servicio | 1210.00 | 2420.00"
→ CANTIDAD = 2.00 (primer número)

ESTRUCTURA DE lineItems:
[{
  "numero": 1,
  "codigoProducto": "COD-123",
  "descripcion": "Descripción del producto/servicio",
  "cantidad": 2.00,  // ← PRIMER NÚMERO de la línea del item
  "unidad": "un",
  "precioUnitario": 1210.00,  // YA incluye IVA
  "subtotal": 2420.00,  // YA incluye IVA
  "totalLinea": 2420.00
}]

IMPORTANTE PARA FACTURA B:
- Los precios YA INCLUYEN IVA
- La CANTIDAD es la PRIMERA COLUMNA - busca el primer número de cada fila
- Si no hay tabla de IVA separada, el campo impuestosDetalle puede ir vacío
- El netoGravado se calcula dividiendo el total por 1.21 (o la alícuota correspondiente)
- NO confundas CANTIDAD con precio o total

Texto de la factura:
{{DOCUMENT_TEXT}}

Responde SOLO con JSON válido:`,
      variables: {
        DOCUMENT_TEXT: 'Texto de la factura B'
      },
      activo: true,
      tenantId: null
    },

    // ========== EXTRACTOR ESPECIALIZADO: FACTURA C ==========
    {
      clave: 'EXTRACCION_FACTURA_C',
      nombre: 'Extractor Especializado - Factura C',
      descripcion: 'Extractor optimizado para facturas tipo C argentinas (consumidor final)',
      motor: 'gemini',
      tipo: 'EXTRACTOR_ESPECIALIZADO',
      prompt: `Eres un experto en facturas argentinas TIPO C (consumidor final).

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
      variables: {
        DOCUMENT_TEXT: 'Texto de la factura C'
      },
      activo: true,
      tenantId: null
    },

    // ========== EXTRACTOR ESPECIALIZADO: DESPACHO DE ADUANA ==========
    {
      clave: 'EXTRACCION_DESPACHO_ADUANA',
      nombre: 'Extractor Especializado - Despacho de Aduana',
      descripcion: 'Extractor para despachos de aduana e importación',
      motor: 'anthropic',
      tipo: 'EXTRACTOR_ESPECIALIZADO',
      prompt: `Eres un experto en despachos de aduana argentinos.

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

Responde SOLO con JSON válido:`,
      variables: {
        DOCUMENT_TEXT: 'Texto del despacho'
      },
      activo: true,
      tenantId: null
    }
  ];

  try {
    console.log(`📝 Insertando ${prompts.length} prompts de pipeline...`);

    for (const prompt of prompts) {
      // Buscar si existe
      const existing = await prisma.ai_prompts.findFirst({
        where: {
          clave: prompt.clave,
          tenantId: null
        }
      });

      if (existing) {
        // Actualizar
        await prisma.ai_prompts.update({
          where: { id: existing.id },
          data: {
            ...prompt,
            updatedAt: new Date()
          }
        });
        console.log(`   ✅ Prompt actualizado: ${prompt.clave}`);
      } else {
        // Crear
        await prisma.ai_prompts.create({
          data: prompt
        });
        console.log(`   ✅ Prompt creado: ${prompt.clave}`);
      }
    }

    console.log('\n✅ Seed de prompts de pipeline completado!');

    // Mostrar resumen
    const totalPrompts = await prisma.ai_prompts.count();
    const clasificadores = await prisma.ai_prompts.count({ where: { tipo: 'CLASIFICADOR' } });
    const especializados = await prisma.ai_prompts.count({ where: { tipo: 'EXTRACTOR_ESPECIALIZADO' } });
    const simples = await prisma.ai_prompts.count({ where: { tipo: 'EXTRACTOR_SIMPLE' } });

    console.log(`\n📊 Resumen de prompts en BD:`);
    console.log(`   Total: ${totalPrompts}`);
    console.log(`   Clasificadores: ${clasificadores}`);
    console.log(`   Extractores Especializados: ${especializados}`);
    console.log(`   Extractores Simples: ${simples}`);

  } catch (error) {
    console.error('❌ Error en seed de prompts de pipeline:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedPipelinePrompts();
  } catch (error) {
    console.error('❌ Error ejecutando seeds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { seedPipelinePrompts };
