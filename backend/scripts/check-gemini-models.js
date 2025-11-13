const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkModels() {
  try {
    // Ver modelos de Gemini en la BD
    const geminiModels = await prisma.ai_models.findMany({
      where: { provider: 'gemini' },
      orderBy: { orderIndex: 'asc' }
    });

    console.log('=== MODELOS DE GEMINI EN BD ===');
    if (geminiModels.length === 0) {
      console.log('⚠️ No hay modelos de Gemini configurados');
    } else {
      geminiModels.forEach(m => {
        console.log(`- ${m.modelId} | ${m.name} | Recomendado: ${m.recommended} | Activo: ${m.active}`);
      });
    }

    // Ver configuración actual
    const config = await prisma.ai_provider_configs.findFirst({
      where: { provider: 'gemini' }
    });

    if (config) {
      console.log('\n=== CONFIGURACIÓN ACTIVA ===');
      console.log('Modelo configurado:', config.modelo);
    } else {
      console.log('\n⚠️ No hay configuración de Gemini');
    }

    // Ver variables de entorno
    console.log('\n=== VARIABLES DE ENTORNO ===');
    console.log('AI_LOOKUP_PROVIDER:', process.env.AI_LOOKUP_PROVIDER || 'no definido');
    console.log('AI_LOOKUP_MODEL:', process.env.AI_LOOKUP_MODEL || 'no definido');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkModels();
