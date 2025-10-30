const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Script para corregir el nombre del modelo de Gemini
 */
async function fixGeminiModel() {
  console.log('🔧 Corrigiendo modelo de Gemini...\n');

  try {
    const tenantId = 'b88fa541-4d93-4f16-a707-95e70f7eecdc';

    // Actualizar el modelo de Gemini
    const updated = await prisma.ai_provider_configs.updateMany({
      where: {
        provider: 'gemini'
      },
      data: {
        modelo: 'gemini-1.5-flash' // Nombre correcto sin "-latest"
      }
    });

    console.log(`✅ ${updated.count} configuración(es) de Gemini actualizadas`);
    console.log('📦 Nuevo modelo: gemini-1.5-flash');

    console.log('\n📋 Modelos válidos de Gemini:');
    console.log('   - gemini-1.5-flash (recomendado)');
    console.log('   - gemini-1.5-pro');
    console.log('   - gemini-pro');
    console.log('   - gemini-pro-vision');

    console.log('\n⚠️  NO usar nombres con "-latest" ya que no funcionan con v1beta');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
if (require.main === module) {
  fixGeminiModel()
    .then(() => {
      console.log('\n✅ Corrección completada!\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error('\n❌ Error fatal:', e);
      process.exit(1);
    });
}

module.exports = { fixGeminiModel };
