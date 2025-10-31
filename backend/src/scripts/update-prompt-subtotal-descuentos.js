/**
 * Script para actualizar el prompt EXTRACCION_FACTURA_A
 * Aclara que subtotal = neto gravado y que descuentos deben ser negativos
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

    // 1. Actualizar la línea de netoGravado para aclarar que puede aparecer como "Subtotal"
    promptText = promptText.replace(
      '- netoGravado (subtotal antes de IVA) - NÚMERO - EXTRAER del resumen de totales',
      '- netoGravado (subtotal antes de IVA) - NÚMERO - EXTRAER del resumen de totales (puede aparecer como "Subtotal" o "Neto Gravado")'
    );

    // 2. Actualizar la línea de descuentoGlobal para aclarar que debe ser NEGATIVO
    promptText = promptText.replace(
      '- descuentoGlobal (NÚMERO o null) - Descuento o recargo global que aparece en la sección de totales',
      '- descuentoGlobal (NÚMERO o null) - Descuento o recargo global que aparece en la sección de totales (DESCUENTOS en NEGATIVO, RECARGOS en POSITIVO)'
    );

    // 3. Agregar nota importante sobre descuentos negativos en la sección "DÓNDE ENCONTRAR DESCUENTOS/RECARGOS"
    const seccionDescuentos = `**DÓNDE ENCONTRAR DESCUENTOS/RECARGOS:**

Las facturas pueden tener descuentos o recargos en DOS lugares:

1. **A NIVEL GLOBAL (en la sección de totales al pie):**
   - Aparecen junto con Subtotal, IVA, Total
   - Ejemplos: "Descuento: $500.00", "Recargo: $200.00", "Bonificación: 10%"
   - ⚠️ **IMPORTANTE - FORMATO DE NÚMEROS:**
     * DESCUENTOS: guardar como NEGATIVO → descuentoGlobal: -500.00
     * RECARGOS: guardar como POSITIVO → descuentoGlobal: 200.00
   - Si encuentras esto, extraer:
     * descuentoGlobal: el importe numérico (NEGATIVO para descuentos, POSITIVO para recargos)
     * descuentoGlobalTipo: "DESCUENTO" (si resta del total) o "RECARGO" (si suma al total)`;

    promptText = promptText.replace(
      /\*\*DÓNDE ENCONTRAR DESCUENTOS\/RECARGOS:\*\*\n\nLas facturas pueden tener descuentos o recargos en DOS lugares:\n\n1\. \*\*A NIVEL GLOBAL \(en la sección de totales al pie\):\*\*\n   - Aparecen junto con Subtotal, IVA, Total\n   - Ejemplos: "Descuento: \$500\.00", "Recargo: \$200\.00", "Bonificación: 10%"\n   - Si encuentras esto, extraer:\n     \* descuentoGlobal: el importe numérico \(500\.00 o 200\.00\)\n     \* descuentoGlobalTipo: "DESCUENTO" \(si resta del total\) o "RECARGO" \(si suma al total\)/,
      seccionDescuentos
    );

    // 4. Actualizar la sección donde dice qué muestra la factura en totales
    promptText = promptText.replace(
      /Las facturas argentinas tipo A tienen una sección de "Totales" o "Resumen" \(generalmente al pie del documento\) que muestra:\n- Subtotal \/ Neto Gravado\n- Descuento \/ Recargo \(si aplica\) ← \*\*NUEVO\*\*/,
      `Las facturas argentinas tipo A tienen una sección de "Totales" o "Resumen" (generalmente al pie del documento) que muestra:
- Subtotal / Neto Gravado (son lo mismo, diferentes nombres)
- Descuento / Recargo (si aplica) ← **IMPORTANTE: Descuentos en NEGATIVO**`
    );

    // 5. Actualizar ejemplo de descuento global para mostrar valor negativo
    promptText = promptText.replace(
      /Descuento 5%:    -500\.00      \(extraer: descuentoGlobal: 500\.00, descuentoGlobalTipo: "DESCUENTO"\)/,
      'Descuento 5%:    -500.00      (extraer: descuentoGlobal: -500.00, descuentoGlobalTipo: "DESCUENTO")'
    );

    // 6. Actualizar ejemplo completo con descuento global
    promptText = promptText.replace(
      /  \* descuentoGlobal: 600\.00 \(extraído\)/,
      '  * descuentoGlobal: -600.00 (extraído como NEGATIVO)'
    );

    // 7. Actualizar recordatorio final
    promptText = promptText.replace(
      /6\. 🎁 EXTRAER descuentos\/recargos tanto globales como por item - NO calcularlos/,
      '6. 🎁 EXTRAER descuentos/recargos tanto globales como por item - NO calcularlos. DESCUENTOS = NEGATIVO'
    );

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
    console.log('   ✓ Aclarado que "Subtotal" = "Neto Gravado"');
    console.log('   ✓ Especificado que DESCUENTOS deben ser NEGATIVOS');
    console.log('   ✓ Especificado que RECARGOS deben ser POSITIVOS');
    console.log('   ✓ Actualizado ejemplo con descuento: -600.00 (negativo)');
    console.log('   ✓ Agregado recordatorio sobre descuentos negativos');

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
