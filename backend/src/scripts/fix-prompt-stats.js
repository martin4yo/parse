/**
 * Script para corregir estadísticas corruptas de prompts
 *
 * Corrige valores de tasaExito que estén fuera del rango 0-100
 *
 * Uso: node src/scripts/fix-prompt-stats.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPromptStats() {
  console.log('🔧 Iniciando corrección de estadísticas de prompts...\n');

  try {
    // 1. Buscar prompts con tasaExito corrupta
    const promptsCorruptos = await prisma.ai_prompts.findMany({
      where: {
        OR: [
          { tasaExito: { gt: 100 } },
          { tasaExito: { lt: 0 } },
          { tasaExito: null }
        ]
      }
    });

    console.log(`📊 Encontrados ${promptsCorruptos.length} prompts con estadísticas corruptas\n`);

    if (promptsCorruptos.length === 0) {
      console.log('✅ No hay prompts con estadísticas corruptas');
      return;
    }

    // 2. Mostrar prompts a corregir
    console.log('Prompts a corregir:');
    console.log('─'.repeat(80));
    promptsCorruptos.forEach((prompt, index) => {
      console.log(`${index + 1}. ${prompt.clave}`);
      console.log(`   ID: ${prompt.id}`);
      console.log(`   Tasa éxito actual: ${prompt.tasaExito}%`);
      console.log(`   Veces usado: ${prompt.vecesUsado}`);
      console.log(`   Motor: ${prompt.motor || 'N/A'}`);
      console.log(`   Tenant: ${prompt.tenantId || 'Global'}`);
      console.log('');
    });

    // 3. Corregir cada prompt
    let corregidos = 0;
    for (const prompt of promptsCorruptos) {
      let nuevaTasaExito = 0;

      if (prompt.tasaExito === null || isNaN(prompt.tasaExito)) {
        // Si es null o NaN, usar 100% si fue usado, 0% si no
        nuevaTasaExito = (prompt.vecesUsado > 0) ? 100 : 0;
      } else if (prompt.tasaExito > 100) {
        // Si está por encima de 100, normalizar a 100%
        nuevaTasaExito = 100;
      } else if (prompt.tasaExito < 0) {
        // Si está por debajo de 0, normalizar a 0%
        nuevaTasaExito = 0;
      }

      await prisma.ai_prompts.update({
        where: { id: prompt.id },
        data: { tasaExito: nuevaTasaExito }
      });

      console.log(`✅ Corregido: ${prompt.clave}`);
      console.log(`   ${prompt.tasaExito}% → ${nuevaTasaExito}%`);
      console.log('');

      corregidos++;
    }

    console.log('─'.repeat(80));
    console.log(`\n✅ Corrección completada: ${corregidos} prompts actualizados`);

    // 4. Verificar que no queden prompts corruptos
    const promptsRestantes = await prisma.ai_prompts.findMany({
      where: {
        OR: [
          { tasaExito: { gt: 100 } },
          { tasaExito: { lt: 0 } }
        ]
      }
    });

    if (promptsRestantes.length === 0) {
      console.log('✅ Verificación exitosa: No quedan prompts con estadísticas corruptas');
    } else {
      console.log(`⚠️ Advertencia: Aún quedan ${promptsRestantes.length} prompts con estadísticas corruptas`);
    }

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
fixPromptStats()
  .then(() => {
    console.log('\n🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error ejecutando el script:', error);
    process.exit(1);
  });
