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
- lineItems (array de items)
- impuestosDetalle (puede estar vacío si IVA no discriminado)

IMPORTANTE PARA FACTURA B:
- Los precios YA INCLUYEN IVA
- Si no hay tabla de IVA separada, el campo impuestosDetalle puede ir vacío
- El netoGravado se calcula dividiendo el total por 1.21 (o la alícuota correspondiente)

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
