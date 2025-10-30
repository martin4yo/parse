/**
 * Script para revisar estadísticas de todos los prompts
 *
 * Muestra todos los prompts y sus estadísticas, incluyendo los que están fuera de rango
 *
 * Uso: node src/scripts/check-prompt-stats.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPromptStats() {
  console.log('📊 Revisando estadísticas de prompts...\n');

  try {
    // Obtener todos los prompts
    const prompts = await prisma.ai_prompts.findMany({
      orderBy: [
        { tenantId: 'asc' },
        { clave: 'asc' }
      ]
    });

    console.log(`Total de prompts: ${prompts.length}\n`);

    // Agrupar por tenant
    const promptsPorTenant = {};
    for (const prompt of prompts) {
      const tenant = prompt.tenantId || 'Global';
      if (!promptsPorTenant[tenant]) {
        promptsPorTenant[tenant] = [];
      }
      promptsPorTenant[tenant].push(prompt);
    }

    // Mostrar por tenant
    for (const [tenant, promptsList] of Object.entries(promptsPorTenant)) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`TENANT: ${tenant}`);
      console.log('='.repeat(80));

      for (const prompt of promptsList) {
        const tasaOk = prompt.tasaExito >= 0 && prompt.tasaExito <= 100;
        const symbol = tasaOk ? '✅' : '❌';

        console.log(`\n${symbol} ${prompt.clave}`);
        console.log(`   ID: ${prompt.id}`);
        console.log(`   Motor: ${prompt.motor || 'N/A'}`);
        console.log(`   Tasa éxito: ${prompt.tasaExito}%`);
        console.log(`   Veces usado: ${prompt.vecesUsado}`);
        console.log(`   Último uso: ${prompt.ultimoUso || 'Nunca'}`);
        console.log(`   Activo: ${prompt.activo}`);

        if (!tasaOk) {
          console.log(`   ⚠️ FUERA DE RANGO (debe estar entre 0-100)`);
        }
      }
    }

    // Estadísticas generales
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('RESUMEN');
    console.log('='.repeat(80));

    const conProblemas = prompts.filter(p => p.tasaExito < 0 || p.tasaExito > 100);
    const sinUso = prompts.filter(p => p.vecesUsado === 0);
    const conUso = prompts.filter(p => p.vecesUsado > 0);

    console.log(`Total prompts: ${prompts.length}`);
    console.log(`Con problemas en tasaExito: ${conProblemas.length}`);
    console.log(`Sin uso: ${sinUso.length}`);
    console.log(`Con uso: ${conUso.length}`);

    if (conProblemas.length > 0) {
      console.log(`\n⚠️ Prompts con problemas:`);
      conProblemas.forEach(p => {
        console.log(`   - ${p.clave} (${p.tenantId || 'Global'}): ${p.tasaExito}%`);
      });
    }

    // Prompts más usados
    const masUsados = [...prompts].sort((a, b) => b.vecesUsado - a.vecesUsado).slice(0, 5);
    if (masUsados.length > 0) {
      console.log(`\n📈 Top 5 prompts más usados:`);
      masUsados.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.clave} (${p.tenantId || 'Global'}): ${p.vecesUsado} usos, ${p.tasaExito.toFixed(2)}% éxito`);
      });
    }

  } catch (error) {
    console.error('❌ Error durante la revisión:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
checkPromptStats()
  .then(() => {
    console.log('\n✅ Revisión completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error ejecutando el script:', error);
    process.exit(1);
  });
