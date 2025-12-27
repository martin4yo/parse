/**
 * Script para actualizar el prompt de extracción
 * Agrega soporte para extraer TODOS los CUITs del documento
 *
 * Ejecutar: node src/scripts/update-prompt-cuits-extraidos.js
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

const NEW_SYSTEM_PROMPT = `Analiza este texto de factura argentina y extrae en JSON:
- fecha (YYYY-MM-DD)
- importe (número - importe total de la factura)
- cuit (XX-XXXXXXXX-X del EMISOR/PROVEEDOR - quien emite la factura)
- cuitDestinatario (XX-XXXXXXXX-X del CLIENTE/DESTINATARIO - quien recibe la factura)
- cuitsExtraidos: array con TODOS los CUITs encontrados en el documento: [{valor: "XX-XXXXXXXX-X", contexto: "emisor|destinatario|otro", confianza: 0.0-1.0}]
- numeroComprobante (XXXXX-XXXXXXXX)
- cae (14 dígitos numéricos)
- tipoComprobante (FACTURA A/B/C, NOTA DE CREDITO A/B/C, NOTA DE DEBITO A/B/C - buscar en recuadro superior central)
- razonSocial (nombre de la empresa EMISORA en el ENCABEZADO)
- razonSocialDestinatario (nombre del CLIENTE/DESTINATARIO)
- netoGravado (importe neto gravado o subtotal - número) - IMPORTANTE: "Subtotal" generalmente representa el neto gravado
- exento (importe exento - número) - IMPORTANTE: Si no aparece explícito, usar EXENTO = TOTAL - GRAVADO - IMPUESTOS
- impuestos (suma total de TODOS los impuestos: IVA 21%, IVA 10.5%, IVA 27%, impuestos internos, retenciones, percepciones, etc. - número)
- cupon (número de cupón si es pago con tarjeta)
- lineItems: array de items [{numero, descripcion, cantidad, unidad, precioUnitario, subtotal, alicuotaIva, importeIva, totalLinea}] - Si no hay items, array vacío []
- impuestosDetalle: array de impuestos [{tipo: "IVA/PERCEPCION/RETENCION/IMPUESTO_INTERNO", descripcion, alicuota, baseImponible, importe}] - Extraer CADA impuesto por separado, NO sumar. Si no hay detalle, array vacío []

⚠️ IDENTIFICACIÓN DE CUITS - MUY IMPORTANTE:
En una factura típica argentina hay DOS CUITs principales:

1. **CUIT EMISOR** (campo "cuit"):
   - Aparece en el ENCABEZADO SUPERIOR del documento
   - Junto al LOGO o nombre de la empresa que EMITE la factura
   - Es quien VENDE o presta el servicio
   - Suele estar cerca de "Razón Social:", "CUIT:" en la parte superior

2. **CUIT DESTINATARIO** (campo "cuitDestinatario"):
   - Aparece en la sección "DATOS DEL CLIENTE", "Señor/es:", "Cliente:", "A:"
   - Es quien COMPRA o recibe el servicio
   - Suele estar cerca de "CUIT/CUIL:", "DNI/CUIT:" en zona de datos del cliente

3. **cuitsExtraidos** - Extraer TODOS los CUITs que encuentres con su contexto:
   - contexto "emisor": CUIT del vendedor/proveedor
   - contexto "destinatario": CUIT del cliente/comprador
   - contexto "otro": cualquier otro CUIT (transporte, agente, etc.)

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

⚠️ RECORDATORIO CRÍTICO ANTES DE RESPONDER:
1. Identificar correctamente el CUIT del EMISOR (parte superior) vs DESTINATARIO (sección cliente)
2. Llenar el array cuitsExtraidos con TODOS los CUITs encontrados y su contexto
3. NO calcular valores - EXTRAER directamente lo que está escrito
4. Si un campo no existe, usar null
5. Devolver SOLO JSON válido sin comentarios, markdown, ni comillas triples

Texto: {{text}}

JSON:`;

async function updatePrompt() {
  console.log('🔄 Actualizando prompt EXTRACCION_FACTURA_CLAUDE...\n');

  try {
    // Buscar prompt existente
    const existing = await prisma.ai_prompts.findFirst({
      where: { clave: 'EXTRACCION_FACTURA_CLAUDE' }
    });

    if (existing) {
      // Hacer backup del prompt anterior
      console.log('📋 Prompt anterior encontrado, actualizando...');
      console.log(`   Versión actual: ${existing.version}`);

      await prisma.ai_prompts.update({
        where: { id: existing.id },
        data: {
          systemPrompt: NEW_SYSTEM_PROMPT,
          version: existing.version + 1,
          updatedAt: new Date(),
          descripcion: 'Prompt de extracción con soporte para múltiples CUITs (emisor/destinatario)'
        }
      });

      console.log(`✅ Prompt actualizado a versión ${existing.version + 1}`);
    } else {
      // Crear nuevo
      console.log('📋 Creando nuevo prompt...');

      await prisma.ai_prompts.create({
        data: {
          id: uuidv4(),
          clave: 'EXTRACCION_FACTURA_CLAUDE',
          nombre: 'Extracción de Factura - Claude',
          descripcion: 'Prompt de extracción con soporte para múltiples CUITs (emisor/destinatario)',
          prompt: NEW_SYSTEM_PROMPT, // Para retrocompatibilidad
          systemPrompt: NEW_SYSTEM_PROMPT,
          userPromptTemplate: 'Analiza el documento adjunto y extrae los datos solicitados en formato JSON.',
          motor: 'anthropic',
          tipo: 'EXTRACTOR_DOCUMENTO',
          activo: true,
          version: 1,
          updatedAt: new Date()
        }
      });

      console.log('✅ Prompt creado');
    }

    // También actualizar EXTRACCION_FACTURA_GEMINI con los mismos campos
    const geminiPrompt = await prisma.ai_prompts.findFirst({
      where: { clave: 'EXTRACCION_FACTURA_GEMINI' }
    });

    if (geminiPrompt) {
      await prisma.ai_prompts.update({
        where: { id: geminiPrompt.id },
        data: {
          systemPrompt: NEW_SYSTEM_PROMPT,
          version: geminiPrompt.version + 1,
          updatedAt: new Date(),
          descripcion: 'Prompt de extracción con soporte para múltiples CUITs (emisor/destinatario)'
        }
      });
      console.log('✅ Prompt GEMINI también actualizado');
    }

    console.log('\n🎉 Actualización completada!');
    console.log('\nNuevos campos extraídos:');
    console.log('  - cuit: CUIT del emisor/proveedor');
    console.log('  - cuitDestinatario: CUIT del cliente/destinatario');
    console.log('  - cuitsExtraidos: Array con todos los CUITs [{valor, contexto, confianza}]');
    console.log('  - razonSocialDestinatario: Nombre del cliente');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePrompt();
