/**
 * Script para actualizar el prompt EXTRACCION_FACTURA_A
 * Agrega detección de moneda (ARS/USD)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePrompt() {
  console.log('🔄 Actualizando prompt EXTRACCION_FACTURA_A...\n');

  try {
    const prompt = await prisma.ai_prompts.findFirst({
      where: { clave: 'EXTRACCION_FACTURA_A' }
    });

    if (!prompt) {
      console.log('❌ Prompt no encontrado');
      return;
    }

    let promptText = prompt.prompt;

    // Agregar campo moneda después de tipoComprobante
    const oldCampos = `- tipoComprobante ("FACTURA A") - STRING
- razonSocial (empresa EMISORA en el ENCABEZADO - STRING o null)`;

    const newCampos = `- tipoComprobante ("FACTURA A") - STRING
- moneda (STRING: "ARS" o "USD") - Moneda del comprobante
- razonSocial (empresa EMISORA en el ENCABEZADO - STRING o null)`;

    promptText = promptText.replace(oldCampos, newCampos);

    // Agregar sección de detección de moneda después de la sección de descuentos
    const insertAfter = `2. **A NIVEL DE ITEM (en cada línea de la tabla):**
   - Pueden aparecer como columna en la tabla de items
   - Ejemplos: "Dto. 10%", "Desc. $50.00", "Bonif. 5%"
   - Si encuentras esto en un item, extraer en ese lineItem:
     * descuentoTipo: "PORCENTAJE" (si es %) o "IMPORTE" (si es $)
     * descuentoValor: el valor numérico (10 para 10%, o 50.00 para $50)
     * descuentoImporte: el importe del descuento en pesos (si no está visible, null)`;

    const newSection = `2. **A NIVEL DE ITEM (en cada línea de la tabla):**
   - Pueden aparecer como columna en la tabla de items
   - Ejemplos: "Dto. 10%", "Desc. $50.00", "Bonif. 5%"
   - Si encuentras esto en un item, extraer en ese lineItem:
     * descuentoTipo: "PORCENTAJE" (si es %) o "IMPORTE" (si es $)
     * descuentoValor: el valor numérico (10 para 10%, o 50.00 para $50)
     * descuentoImporte: el importe del descuento en pesos (si no está visible, null)

**DETECCIÓN DE MONEDA:**

Las facturas argentinas pueden estar emitidas en **Pesos Argentinos (ARS)** o **Dólares Estadounidenses (USD)**.

**Indicadores de PESOS (ARS):**
- Símbolo: $ (sin otra aclaración)
- Texto: "PESOS", "PESOS ARGENTINOS", "ARS", "$"
- Es la moneda por defecto si NO hay indicación de otra moneda

**Indicadores de DÓLARES (USD):**
- Símbolos: USD, US$, U$S, U$$, U.S.$
- Texto: "DOLARES", "DÓLARES", "DOLAR", "DÓLAR", "DOLARES ESTADOUNIDENSES", "USD"
- Prefijos: "USD $", "U$S $", "US$ "

**DÓNDE BUSCAR LA MONEDA:**
1. En el encabezado de la factura (puede decir "Factura en DÓLARES")
2. En la sección de totales (ej: "Total USD $1,000.00")
3. Junto a los importes (ej: "Neto Gravado: USD 500.00")
4. En el cuerpo de la factura (puede haber una leyenda)

**REGLA DE DETECCIÓN:**
- Si encuentras CUALQUIER indicador de USD → moneda: "USD"
- Si NO encuentras indicadores de USD → moneda: "ARS" (por defecto en Argentina)
- Si hay duda, usar "ARS" (es más común)

**Ejemplos:**
- "Total: $ 1,000.00" → moneda: "ARS"
- "Total: USD 1,000.00" → moneda: "USD"
- "Total: U$S 1,000.00" → moneda: "USD"
- "Neto Gravado USD $ 500.00" → moneda: "USD"
- Sin indicación específica → moneda: "ARS"`;

    promptText = promptText.replace(insertAfter, newSection);

    // Agregar en recordatorio crítico
    const oldRecordatorio = `7. ⚠️ Si un campo no existe o no estás seguro, usar null - NO SUPONGAS
8. 📋 Devolver SOLO JSON válido sin comentarios, markdown, ni comillas triples`;

    const newRecordatorio = `7. 💱 DETECTAR moneda: buscar USD/US$/U$S/DÓLARES → "USD", sino → "ARS"
8. ⚠️ Si un campo no existe o no estás seguro, usar null - NO SUPONGAS
9. 📋 Devolver SOLO JSON válido sin comentarios, markdown, ni comillas triples`;

    promptText = promptText.replace(oldRecordatorio, newRecordatorio);

    console.log('📋 Prompt encontrado:');
    console.log(`   ID: ${prompt.id}`);
    console.log(`   Clave: ${prompt.clave}`);
    console.log(`   Motor: ${prompt.motor}`);
    console.log(`   Versión actual: ${prompt.version}`);
    console.log('');

    // Actualizar el prompt
    const updated = await prisma.ai_prompts.update({
      where: { id: prompt.id },
      data: {
        prompt: promptText,
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });

    console.log('✅ Prompt actualizado exitosamente');
    console.log(`   Nueva versión: ${updated.version}`);
    console.log('');
    console.log('📝 Cambios realizados:');
    console.log('   ✓ Agregado campo "moneda" (STRING: "ARS" o "USD")');
    console.log('   ✓ Agregada sección "DETECCIÓN DE MONEDA"');
    console.log('   ✓ Definidos indicadores de PESOS (ARS)');
    console.log('   ✓ Definidos indicadores de DÓLARES (USD)');
    console.log('   ✓ Especificado dónde buscar la moneda');
    console.log('   ✓ Agregada regla de detección');
    console.log('   ✓ Agregados ejemplos');
    console.log('   ✓ Actualizado recordatorio crítico');

  } catch (error) {
    console.error('❌ Error actualizando prompt:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updatePrompt()
  .then(() => {
    console.log('\n🎉 Actualización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
