/**
 * Script para actualizar el prompt EXTRACCION_FACTURA_A
 * Agrega "INDUSTRIAS QUIMICAS Y MINERAS" a la lista de razones sociales del cliente
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

    // Actualizar la sección de razones sociales a ignorar
    const oldSection = `  1. ❌ SI encuentras CUALQUIERA de estas razones sociales, ES DEL CLIENTE - devolver null:
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO S.A."
     - "IND. QUIMICA Y MINERA TIMBO S.A."
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO SA"
     - "IND QUIMICAS Y MINERAS TIMBO"
     - Cualquier variación de "TIMBO" + "QUIMICA" / "MINERA"`;

    const newSection = `  1. ❌ SI encuentras CUALQUIERA de estas razones sociales, ES DEL CLIENTE - devolver null:
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO S.A."
     - "IND. QUIMICA Y MINERA TIMBO S.A."
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO SA"
     - "IND QUIMICAS Y MINERAS TIMBO"
     - "INDUSTRIAS QUIMICAS Y MINERAS" (sin TIMBO también)
     - Cualquier variación de "TIMBO" + "QUIMICA" / "MINERA"
     - Cualquier variación que contenga "QUIMICA" + "MINERA" (puede ser del cliente)`;

    promptText = promptText.replace(oldSection, newSection);

    // Actualizar también la regla de oro
    const oldReglaOro = `  3. ⚠️ REGLA DE ORO:
     - Si la ÚNICA razón social visible es alguna variante de "TIMBO", devolver null
     - Es MEJOR devolver null que devolver la del cliente
     - NO SUPONGAS - si no ves claramente la razón social del emisor, devolver null`;

    const newReglaOro = `  3. ⚠️ REGLA DE ORO:
     - Si la ÚNICA razón social visible es alguna variante de "TIMBO" o contiene "QUIMICA" + "MINERA", devolver null
     - Es MEJOR devolver null que devolver la del cliente
     - NO SUPONGAS - si no ves claramente la razón social del emisor, devolver null`;

    promptText = promptText.replace(oldReglaOro, newReglaOro);

    // Actualizar recordatorio crítico
    const oldRecordatorio1 = `1. 🚨 IGNORAR COMPLETAMENTE cualquier variante de "TIMBO" + "QUIMICA"/"MINERA" en razonSocial - ES DEL CLIENTE`;
    const newRecordatorio1 = `1. 🚨 IGNORAR COMPLETAMENTE cualquier razón social con "TIMBO" o "QUIMICA"+"MINERA" - ES DEL CLIENTE`;

    promptText = promptText.replace(oldRecordatorio1, newRecordatorio1);

    const oldRecordatorio2 = `2. 🚨 Si la única razón social visible contiene "TIMBO", devolver razonSocial: null`;
    const newRecordatorio2 = `2. 🚨 Si la única razón social visible contiene "TIMBO" o "QUIMICA"+"MINERA", devolver razonSocial: null`;

    promptText = promptText.replace(oldRecordatorio2, newRecordatorio2);

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
    console.log('   ✓ Agregada "INDUSTRIAS QUIMICAS Y MINERAS" (sin TIMBO) a lista de exclusión');
    console.log('   ✓ Agregada regla general para cualquier variante con "QUIMICA" + "MINERA"');
    console.log('   ✓ Actualizada REGLA DE ORO para incluir "QUIMICA"+"MINERA"');
    console.log('   ✓ Actualizados recordatorios críticos');

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
