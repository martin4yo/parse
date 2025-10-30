/**
 * Script para actualizar el prompt EXTRACCION_FACTURA_A
 * Instruir a buscar OTRA razón social antes de devolver null
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

    // Actualizar la sección de reglas absolutas
    const oldSection = `  🚨 REGLAS ABSOLUTAS PARA RAZÓN SOCIAL:

  1. ❌ SI encuentras CUALQUIERA de estas razones sociales, ES DEL CLIENTE - devolver null:
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO S.A."
     - "IND. QUIMICA Y MINERA TIMBO S.A."
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO SA"
     - "IND QUIMICAS Y MINERAS TIMBO"
     - "INDUSTRIAS QUIMICAS Y MINERAS" (sin TIMBO también)
     - Cualquier variación de "TIMBO" + "QUIMICA" / "MINERA"
     - Cualquier variación que contenga "QUIMICA" + "MINERA" (puede ser del cliente)

  2. ✅ DÓNDE buscar la razón social del EMISOR:
     - En la parte SUPERIOR del documento (primeros 5-10 renglones)
     - Junto al LOGO o membrete de la empresa
     - Inmediatamente ARRIBA o AL LADO del CUIT del emisor
     - En letra GRANDE o destacada
     - NUNCA en secciones: "Señor/es:", "Cliente:", "Datos del Cliente", "Receptor"

  3. ⚠️ REGLA DE ORO:
     - Si la ÚNICA razón social visible es alguna variante de "TIMBO" o contiene "QUIMICA" + "MINERA", devolver null
     - Es MEJOR devolver null que devolver la del cliente
     - NO SUPONGAS - si no ves claramente la razón social del emisor, devolver null`;

    const newSection = `  🚨 REGLAS ABSOLUTAS PARA RAZÓN SOCIAL:

  1. ❌ SI encuentras CUALQUIERA de estas razones sociales, ES DEL CLIENTE - IGNORARLA y BUSCAR OTRA:
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO S.A."
     - "IND. QUIMICA Y MINERA TIMBO S.A."
     - "INDUSTRIAS QUIMICAS Y MINERAS TIMBO SA"
     - "IND QUIMICAS Y MINERAS TIMBO"
     - "INDUSTRIAS QUIMICAS Y MINERAS" (sin TIMBO también)
     - Cualquier variación de "TIMBO" + "QUIMICA" / "MINERA"
     - Cualquier variación que contenga "QUIMICA" + "MINERA" (puede ser del cliente)

  2. ✅ DÓNDE buscar la razón social del EMISOR:
     - En la parte SUPERIOR del documento (primeros 5-10 renglones)
     - Junto al LOGO o membrete de la empresa
     - Inmediatamente ARRIBA o AL LADO del CUIT del emisor
     - En letra GRANDE o destacada
     - NUNCA en secciones: "Señor/es:", "Cliente:", "Datos del Cliente", "Receptor"

  3. 🔍 FLUJO DE BÚSQUEDA:
     a) Lee TODO el encabezado del documento (primeros 10-15 renglones)
     b) Identifica TODAS las razones sociales presentes
     c) DESCARTA las que coincidan con la lista del punto 1 (cliente)
     d) De las razones sociales restantes, selecciona la que esté:
        - En la posición más prominente (arriba, grande, junto al logo)
        - Junto al CUIT del emisor
        - En el membrete o encabezado principal
     e) SOLO si después de buscar exhaustivamente NO encuentras NINGUNA otra razón social válida, devolver null

  4. ⚠️ REGLA DE ORO:
     - SIEMPRE buscar OTRA razón social antes de devolver null
     - Si hay 2 razones sociales y una es del cliente, usar la OTRA
     - Es MEJOR devolver null que devolver la del cliente
     - NO SUPONGAS - si no ves claramente la razón social del emisor después de buscar, devolver null`;

    promptText = promptText.replace(oldSection, newSection);

    // Actualizar recordatorios
    const oldRecordatorio1 = `1. 🚨 IGNORAR COMPLETAMENTE cualquier razón social con "TIMBO" o "QUIMICA"+"MINERA" - ES DEL CLIENTE`;
    const newRecordatorio1 = `1. 🚨 IGNORAR razón social del cliente ("TIMBO" o "QUIMICA"+"MINERA") - BUSCAR OTRA razón social del emisor`;

    promptText = promptText.replace(oldRecordatorio1, newRecordatorio1);

    const oldRecordatorio2 = `2. 🚨 Si la única razón social visible contiene "TIMBO" o "QUIMICA"+"MINERA", devolver razonSocial: null`;
    const newRecordatorio2 = `2. 🚨 Si después de BUSCAR EXHAUSTIVAMENTE solo encuentras razón social del cliente, devolver razonSocial: null`;

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
    console.log('   ✓ Cambiado "devolver null" por "IGNORARLA y BUSCAR OTRA"');
    console.log('   ✓ Agregado FLUJO DE BÚSQUEDA paso a paso');
    console.log('   ✓ Instrucción explícita: leer TODO el encabezado primero');
    console.log('   ✓ Instrucción: identificar TODAS las razones sociales');
    console.log('   ✓ Instrucción: DESCARTAR las del cliente y usar las restantes');
    console.log('   ✓ SOLO devolver null si NO hay ninguna otra después de buscar');

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
