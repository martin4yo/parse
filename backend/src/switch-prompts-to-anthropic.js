const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function switchPromptsToAnthropic() {
  console.log('🔄 Cambiando prompts de Gemini a Anthropic...\n');

  try {
    // Actualizar todos los prompts que usan Gemini
    const updated = await prisma.ai_prompts.updateMany({
      where: {
        motor: 'gemini'
      },
      data: {
        motor: 'anthropic'
      }
    });

    console.log(`✅ ${updated.count} prompt(s) actualizados a Anthropic\n`);

    // Mostrar prompts actualizados
    const prompts = await prisma.ai_prompts.findMany({
      where: {
        motor: 'anthropic'
      },
      select: {
        clave: true,
        nombre: true,
        motor: true
      }
    });

    console.log('📋 Prompts usando Anthropic:');
    prompts.forEach((p, index) => {
      console.log(`   ${index + 1}. ${p.clave} (${p.nombre})`);
    });

    console.log('\n✅ Ahora todos los prompts usarán Anthropic Claude');
    console.log('🔑 Modelo: claude-3-haiku-20240307');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

switchPromptsToAnthropic().catch(console.error);
