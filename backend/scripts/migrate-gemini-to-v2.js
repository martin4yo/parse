/**
 * Migrar modelos de Gemini 1.5 a 2.x/2.5
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateToGemini2() {
  try {
    console.log('🔄 Migrando modelos de Gemini 1.5 → 2.x/2.5...\n');

    // 1. Desactivar todos los modelos de Gemini 1.x
    await prisma.ai_models.updateMany({
      where: {
        provider: 'gemini',
        modelId: {
          startsWith: 'gemini-1'
        }
      },
      data: {
        active: false,
        deprecated: true,
        description: '⚠️ OBSOLETO: Gemini 1.5 fue reemplazado por Gemini 2.x/2.5'
      }
    });
    console.log('✅ Modelos Gemini 1.x marcados como obsoletos');

    // 2. Verificar si existen los nuevos modelos, si no crearlos
    const newModels = [
      {
        modelId: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Modelo estable 2.5 Flash. Rápido y económico. Ideal para clasificación. GRATIS hasta 15 req/min',
        recommended: true,
        orderIndex: 1
      },
      {
        modelId: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Modelo estable 2.0 Flash. Versión anterior estable. GRATIS hasta 15 req/min',
        recommended: false,
        orderIndex: 2
      },
      {
        modelId: 'gemini-flash-latest',
        name: 'Gemini Flash (Latest)',
        description: 'Apunta automáticamente al modelo Flash más reciente. Recomendado para producción',
        recommended: false,
        orderIndex: 3
      },
      {
        modelId: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Modelo estable 2.5 Pro. Más potente para tareas complejas. Limitado a 2 req/min gratis',
        recommended: false,
        orderIndex: 10
      },
      {
        modelId: 'gemini-pro-latest',
        name: 'Gemini Pro (Latest)',
        description: 'Apunta automáticamente al modelo Pro más reciente',
        recommended: false,
        orderIndex: 11
      }
    ];

    for (const model of newModels) {
      const existing = await prisma.ai_models.findUnique({
        where: {
          provider_modelId: {
            provider: 'gemini',
            modelId: model.modelId
          }
        }
      });

      if (existing) {
        // Actualizar
        await prisma.ai_models.update({
          where: { id: existing.id },
          data: {
            name: model.name,
            description: model.description,
            recommended: model.recommended,
            active: true,
            deprecated: false,
            orderIndex: model.orderIndex
          }
        });
        console.log(`✅ Actualizado: ${model.modelId}`);
      } else {
        // Crear
        await prisma.ai_models.create({
          data: {
            id: require('crypto').randomUUID(),
            provider: 'gemini',
            modelId: model.modelId,
            name: model.name,
            description: model.description,
            recommended: model.recommended,
            active: true,
            deprecated: false,
            orderIndex: model.orderIndex,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`✅ Creado: ${model.modelId}`);
      }
    }

    // 3. Actualizar configuraciones activas que usen modelos 1.x
    const configs = await prisma.ai_provider_configs.findMany({
      where: {
        provider: 'gemini',
        modelo: {
          startsWith: 'gemini-1'
        }
      }
    });

    for (const config of configs) {
      await prisma.ai_provider_configs.update({
        where: { id: config.id },
        data: { modelo: 'gemini-2.5-flash' }
      });
      console.log(`✅ Config actualizada: ${config.modelo} → gemini-2.5-flash`);
    }

    // 4. Actualizar reglas de negocio que usen modelos 1.x
    const reglas = await prisma.reglas_negocio.findMany({
      where: { tipo: 'TRANSFORMACION' }
    });

    let reglasActualizadas = 0;

    for (const regla of reglas) {
      const config = regla.configuracion;
      let modified = false;

      if (config.acciones) {
        config.acciones.forEach(accion => {
          if (accion.operacion === 'AI_LOOKUP' && accion.aiModel) {
            if (accion.aiModel.startsWith('gemini-1')) {
              console.log(`  Regla ${regla.codigo}: ${accion.aiModel} → gemini-2.5-flash`);
              accion.aiModel = 'gemini-2.5-flash';
              modified = true;
            }
          }
        });
      }

      if (modified) {
        await prisma.reglas_negocio.update({
          where: { id: regla.id },
          data: {
            configuracion: config,
            updatedAt: new Date()
          }
        });
        reglasActualizadas++;
      }
    }

    console.log(`\n✅ ${reglasActualizadas} regla(s) actualizada(s)`);

    console.log('\n📋 RESUMEN DE MODELOS ACTIVOS:\n');
    const activeModels = await prisma.ai_models.findMany({
      where: {
        provider: 'gemini',
        active: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    activeModels.forEach(m => {
      const badges = [];
      if (m.recommended) badges.push('⭐ Recomendado');
      console.log(`  ${m.modelId} - ${m.name} ${badges.join(' ')}`);
    });

    console.log('\n💡 ACTUALIZA TU .ENV:');
    console.log('AI_LOOKUP_MODEL=gemini-2.5-flash');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

migrateToGemini2();
