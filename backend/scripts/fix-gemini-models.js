const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixGeminiModels() {
  try {
    console.log('🔧 Corrigiendo modelos de Gemini...\n');

    // 1. Actualizar modelo "gemini-1.5-flash-latest" a "gemini-1.5-flash" y marcarlo como recomendado
    const flashLatest = await prisma.ai_models.findFirst({
      where: {
        provider: 'gemini',
        modelId: 'gemini-1.5-flash-latest'
      }
    });

    if (flashLatest) {
      // Marcar este como NO recomendado y deprecated
      await prisma.ai_models.update({
        where: { id: flashLatest.id },
        data: {
          recommended: false,
          deprecated: true,
          active: false,
          description: '⚠️ OBSOLETO: Usar gemini-1.5-flash en su lugar'
        }
      });
      console.log('✅ Marcado gemini-1.5-flash-latest como obsoleto');
    }

    // 2. Marcar gemini-1.5-flash como recomendado
    const flash = await prisma.ai_models.findFirst({
      where: {
        provider: 'gemini',
        modelId: 'gemini-1.5-flash'
      }
    });

    if (flash) {
      await prisma.ai_models.update({
        where: { id: flash.id },
        data: {
          recommended: true,
          active: true,
          description: 'Modelo rápido y económico. Ideal para clasificación. GRATIS hasta 15 req/min'
        }
      });
      console.log('✅ Marcado gemini-1.5-flash como recomendado');
    }

    // 3. Marcar pro-latest como obsoleto
    const proLatest = await prisma.ai_models.findFirst({
      where: {
        provider: 'gemini',
        modelId: 'gemini-1.5-pro-latest'
      }
    });

    if (proLatest) {
      await prisma.ai_models.update({
        where: { id: proLatest.id },
        data: {
          recommended: false,
          deprecated: true,
          active: false,
          description: '⚠️ OBSOLETO: Usar gemini-1.5-pro en su lugar'
        }
      });
      console.log('✅ Marcado gemini-1.5-pro-latest como obsoleto');
    }

    // 4. Actualizar gemini-1.5-pro
    const pro = await prisma.ai_models.findFirst({
      where: {
        provider: 'gemini',
        modelId: 'gemini-1.5-pro'
      }
    });

    if (pro) {
      await prisma.ai_models.update({
        where: { id: pro.id },
        data: {
          active: true,
          description: 'Modelo más potente. Mejor para tareas complejas. Limitado a 2 req/min gratis'
        }
      });
      console.log('✅ Actualizado gemini-1.5-pro');
    }

    // 5. Actualizar configuración activa de Gemini
    const config = await prisma.ai_provider_configs.findFirst({
      where: { provider: 'gemini' }
    });

    if (config && config.modelo.includes('-latest')) {
      const newModel = config.modelo.replace('-latest', '');
      await prisma.ai_provider_configs.update({
        where: { id: config.id },
        data: { modelo: newModel }
      });
      console.log(`✅ Configuración actualizada: ${config.modelo} → ${newModel}`);
    }

    console.log('\n✅ Corrección completada!');
    console.log('\n📋 Modelos actualizados:');

    const allModels = await prisma.ai_models.findMany({
      where: { provider: 'gemini' },
      orderBy: { orderIndex: 'asc' }
    });

    allModels.forEach(m => {
      const status = [];
      if (m.recommended) status.push('⭐ Recomendado');
      if (m.deprecated) status.push('⚠️ Obsoleto');
      if (!m.active) status.push('❌ Inactivo');

      console.log(`  ${m.modelId} - ${m.name} ${status.join(' ')}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixGeminiModels();
