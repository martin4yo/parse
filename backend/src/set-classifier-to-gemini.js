const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setClassifierToGemini() {
  console.log('🔄 Configurando clasificador para usar Gemini...\n');

  try {
    // Solo el clasificador usará Gemini
    const classifier = await prisma.ai_prompts.updateMany({
      where: {
        clave: 'CLASIFICADOR_DOCUMENTO'
      },
      data: {
        motor: 'gemini'
      }
    });

    console.log(`✅ Clasificador configurado para usar Gemini`);

    // El resto de prompts siguen con Anthropic
    const extractors = await prisma.ai_prompts.updateMany({
      where: {
        clave: {
          not: 'CLASIFICADOR_DOCUMENTO'
        }
      },
      data: {
        motor: 'anthropic'
      }
    });

    console.log(`✅ ${extractors.count} extractores configurados para usar Anthropic\n`);

    // Mostrar resumen
    const prompts = await prisma.ai_prompts.findMany({
      select: {
        clave: true,
        nombre: true,
        motor: true
      },
      orderBy: {
        motor: 'asc'
      }
    });

    console.log('📋 Configuración actual de prompts:\n');

    const geminiPrompts = prompts.filter(p => p.motor === 'gemini');
    const anthropicPrompts = prompts.filter(p => p.motor === 'anthropic');

    console.log('🟢 Gemini:');
    geminiPrompts.forEach(p => {
      console.log(`   - ${p.clave}`);
    });

    console.log('\n🔵 Anthropic:');
    anthropicPrompts.forEach(p => {
      console.log(`   - ${p.clave}`);
    });

    console.log('\n✅ Configuración completada!');
    console.log('\n💡 Pipeline de extracción:');
    console.log('   1. Gemini clasifica el documento');
    console.log('   2. Anthropic extrae los datos\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setClassifierToGemini().catch(console.error);
