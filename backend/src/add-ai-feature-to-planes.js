const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

/**
 * Script para agregar el feature AI_CUSTOM_API_KEYS a todos los planes
 */
async function addAIFeature() {
  console.log('🚀 Agregando feature AI_CUSTOM_API_KEYS a planes...\n');

  try {
    // Obtener todos los planes
    const planes = await prisma.planes.findMany({
      include: {
        plan_features: true
      }
    });

    console.log(`📋 Encontrados ${planes.length} planes\n`);

    for (const plan of planes) {
      console.log(`\n📦 Plan: ${plan.nombre} (${plan.codigo})`);

      // Verificar si ya tiene el feature
      const hasFeature = plan.plan_features.some(f => f.feature === 'AI_CUSTOM_API_KEYS');

      if (hasFeature) {
        console.log('   ✅ Ya tiene el feature AI_CUSTOM_API_KEYS');
      } else {
        // Agregar el feature
        await prisma.plan_features.create({
          data: {
            id: uuidv4(),
            planId: plan.id,
            feature: 'AI_CUSTOM_API_KEYS',
            config: {
              enabled: true,
              description: 'Permite configurar API keys personalizadas para proveedores de IA'
            },
            createdAt: new Date()
          }
        });
        console.log('   ✨ Feature AI_CUSTOM_API_KEYS agregado');
      }
    }

    console.log('\n\n🎉 Proceso completado!');
    console.log('\n📊 Resumen de features por plan:');

    // Mostrar resumen
    const planesActualizados = await prisma.planes.findMany({
      include: {
        plan_features: true
      },
      orderBy: {
        orden: 'asc'
      }
    });

    for (const plan of planesActualizados) {
      console.log(`\n${plan.nombre}:`);
      plan.plan_features.forEach(f => {
        console.log(`  - ${f.feature}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  addAIFeature()
    .then(() => {
      console.log('\n✅ Script completado!\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error('\n❌ Error fatal:', e);
      process.exit(1);
    });
}

module.exports = { addAIFeature };
