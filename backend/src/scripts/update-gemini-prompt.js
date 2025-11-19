const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script para actualizar el prompt de Gemini con mejoras de precisión
 * Incluye:
 * - Few-shot examples
 * - Mejores instrucciones para JSON
 * - Validaciones de formato
 */
async function updateGeminiPrompt() {
  console.log('🔧 Actualizando prompt de Gemini...');

  const improvedPrompt = `Extrae datos de esta factura argentina y devuelve SOLO JSON válido.

FORMATO DE RESPUESTA - JSON PURO:
- NO incluyas markdown code blocks (\`\`\`json o \`\`\`)
- NO incluyas comentarios (// o /* */)
- NO incluyas texto explicativo
- Devuelve directamente el objeto JSON

ESTRUCTURA JSON REQUERIDA:
{
  "fecha": "YYYY-MM-DD",
  "importe": número sin símbolos ni separadores,
  "cuit": "XX-XXXXXXXX-X del EMISOR",
  "numeroComprobante": "XXXXX-XXXXXXXX",
  "cae": "14 dígitos numéricos o null",
  "tipoComprobante": "FACTURA A|B|C | NOTA DE CREDITO A|B|C | NOTA DE DEBITO A|B|C",
  "razonSocial": "razón social del EMISOR en ENCABEZADO",
  "netoGravado": número,
  "exento": número,
  "impuestos": número (suma total),
  "cupon": "número de cupón o null",
  "lineItems": [
    {
      "numero": 1,
      "codigoProducto": "código o null",
      "descripcion": "descripción del producto",
      "cantidad": número,
      "unidad": "un|kg|m|lt|hs|null",
      "precioUnitario": número,
      "subtotal": número,
      "alicuotaIva": número (21.00|10.50|27.00|5.00|0),
      "importeIva": número,
      "totalLinea": número
    }
  ],
  "impuestosDetalle": [
    {
      "tipo": "IVA|PERCEPCION|RETENCION|IMPUESTO_INTERNO",
      "descripcion": "descripción",
      "alicuota": número o null,
      "baseImponible": número o null,
      "importe": número
    }
  ]
}

EJEMPLO 1 - FACTURA SIMPLE:
Input: "FACTURA A 0001-00123456 / Fecha: 15/01/2025 / CUIT: 20-12345678-9 / Razón Social: EJEMPLO SA / Total: 12100.00 / Neto: 10000.00 / IVA 21%: 2100.00"

Output: {
  "fecha": "2025-01-15",
  "importe": 12100,
  "cuit": "20-12345678-9",
  "numeroComprobante": "0001-00123456",
  "cae": null,
  "tipoComprobante": "FACTURA A",
  "razonSocial": "EJEMPLO SA",
  "netoGravado": 10000,
  "exento": 0,
  "impuestos": 2100,
  "cupon": null,
  "lineItems": [],
  "impuestosDetalle": [
    {
      "tipo": "IVA",
      "descripcion": "IVA 21%",
      "alicuota": 21.00,
      "baseImponible": 10000,
      "importe": 2100
    }
  ]
}

EJEMPLO 2 - FACTURA CON ITEMS:
Input: "FACTURA B 0002-00000789 / Fecha: 20/01/2025 / CUIT: 30-87654321-2 / Proveedor XYZ SRL / Total: 6050.00 / Items: 1) Producto A - 2.00 un x 1000 = 2000 - IVA 21%: 420 - Total: 2420 | 2) Servicio B - 1.00 un x 3000 = 3000 - IVA 21%: 630 - Total: 3630"

Output: {
  "fecha": "2025-01-20",
  "importe": 6050,
  "cuit": "30-87654321-2",
  "numeroComprobante": "0002-00000789",
  "cae": null,
  "tipoComprobante": "FACTURA B",
  "razonSocial": "Proveedor XYZ SRL",
  "netoGravado": 5000,
  "exento": 0,
  "impuestos": 1050,
  "cupon": null,
  "lineItems": [
    {
      "numero": 1,
      "codigoProducto": null,
      "descripcion": "Producto A",
      "cantidad": 2,
      "unidad": "un",
      "precioUnitario": 1000,
      "subtotal": 2000,
      "alicuotaIva": 21.00,
      "importeIva": 420,
      "totalLinea": 2420
    },
    {
      "numero": 2,
      "codigoProducto": null,
      "descripcion": "Servicio B",
      "cantidad": 1,
      "unidad": "un",
      "precioUnitario": 3000,
      "subtotal": 3000,
      "alicuotaIva": 21.00,
      "importeIva": 630,
      "totalLinea": 3630
    }
  ],
  "impuestosDetalle": [
    {
      "tipo": "IVA",
      "descripcion": "IVA 21%",
      "alicuota": 21.00,
      "baseImponible": 5000,
      "importe": 1050
    }
  ]
}

REGLAS CRÍTICAS:

1. CUIT y RAZÓN SOCIAL DEL EMISOR:
   - ⚠️ IGNORAR CUIT 30-51596921-3 (es del cliente)
   - ⚠️ IGNORAR "Industrias Quimicas y Mineras Timbó" (es del cliente)
   - Buscar CUIT y razón social en el ENCABEZADO SUPERIOR de la factura
   - El emisor es quien GENERA la factura, NO quien la recibe

2. TIPO DE COMPROBANTE:
   - Buscar letra (A, B, C) en recuadro superior central
   - Formato: "FACTURA A", "FACTURA B", "FACTURA C"
   - Otros tipos: "NOTA DE CREDITO A/B/C", "NOTA DE DEBITO A/B/C"
   - Si no está claro, usar "FACTURA B" como default

3. IMPORTES:
   - Extraer números SIN símbolos ($, puntos, comas)
   - "145,000.00" → 145000 (NO 145)
   - "$1.234,56" → 1234.56
   - Validación: importe ≈ netoGravado + exento + impuestos

4. LINE ITEMS - EXTRAER, NO CALCULAR:
   - Buscar tabla de detalle/items
   - MAPEO DE COLUMNAS:
     * numero: Primera columna (1, 2, 3...)
     * codigoProducto: Columna "Código"/"Cód."/"SKU" o null
     * descripcion: Nombre del producto/servicio
     * cantidad: Columna "Cant"/"Cantidad"
     * unidad: Columna "Unidad" (un, kg, m, lt, hs)
     * precioUnitario: Columna "Precio"/"P.Unit" (ANTES de IVA)
     * subtotal: Columna "Subtotal"/"Importe" (sin IVA)
     * alicuotaIva: Columna "% IVA" (CON %) → 21.00, 10.50
     * importeIva: Columna "IVA" (SIN %) → importe en $
     * totalLinea: Columna "Total" (con IVA)
   - ❌ NO calcular valores, EXTRAER de las columnas
   - Si no hay items detallados → array vacío []

5. IMPUESTOS DETALLE:
   - Extraer CADA impuesto por separado (NO sumar)
   - Tipos comunes: IVA (21%, 10.5%, 27%, 5%), PERCEPCION, RETENCION, IMPUESTO_INTERNO
   - Para IVA: incluir alícuota y base imponible
   - Para percepciones/retenciones: alícuota puede ser null
   - Si no hay detalle → array vacío []

6. NÚMEROS ESPECIALES:
   - numeroComprobante: formato típico "XXXXX-XXXXXXXX" (ej: "00001-00123456")
   - CAE: 14 dígitos numéricos o null si no existe
   - CUIT: formato "XX-XXXXXXXX-X" (ej: "20-12345678-9")

7. FECHAS:
   - Buscar "Fecha de Emisión", "Fecha Emisión", "Fecha:"
   - Formato de salida: YYYY-MM-DD
   - Conversión: "15/01/2025" → "2025-01-15"

8. EXENTO:
   - Si aparece explícito, usar ese valor
   - Si NO aparece: calcular exento = total - netoGravado - impuestos
   - Si no hay operaciones exentas: usar 0

VALIDACIONES FINALES:
- total ≈ netoGravado + exento + impuestos (tolerancia ±1)
- Si lineItems no vacío: sum(lineItems.totalLinea) ≈ total
- Si impuestosDetalle no vacío: sum(impuestosDetalle.importe) ≈ impuestos
- Todos los números deben ser números, NO strings
- Todas las fechas en formato YYYY-MM-DD
- Arrays vacíos si no hay datos (NO null)

TEXTO DE LA FACTURA:
{{text}}

RECUERDA: Devuelve SOLO el JSON sin markdown, comentarios ni texto adicional.`;

  try {
    // Buscar el prompt existente
    const existing = await prisma.ai_prompts.findFirst({
      where: {
        clave: 'EXTRACCION_FACTURA_GEMINI',
        tenantId: null // GLOBAL
      }
    });

    if (existing) {
      // Actualizar
      await prisma.ai_prompts.update({
        where: { id: existing.id },
        data: {
          prompt: improvedPrompt,
          descripcion: 'Prompt optimizado para Gemini 2.5 con few-shot examples y validaciones mejoradas'
        }
      });
      console.log('✅ Prompt de Gemini actualizado exitosamente');
    } else {
      console.log('❌ Prompt EXTRACCION_FACTURA_GEMINI no encontrado en la base de datos');
      console.log('   Ejecuta primero: node prisma/seeds/prompts.js');
    }

  } catch (error) {
    console.error('❌ Error actualizando prompt:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
if (require.main === module) {
  updateGeminiPrompt()
    .then(() => {
      console.log('✨ Actualización completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { updateGeminiPrompt };
