const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

// Cliente para Parse (base de datos destino)
const prismaParse = new PrismaClient();

// Cliente para Rendiciones (base de datos origen)
const prismaRendiciones = new PrismaClient({
  datasources: {
    db: {
      url: process.env.RENDICIONES_DATABASE_URL || 'postgresql://postgres:Axioma2024@localhost:5432/rendiciones_db'
    }
  }
});

/**
 * Script para copiar planes y features desde rendiciones_db a parse_db
 */
async function migratePlanes() {
  console.log('🚀 ===== MIGRANDO PLANES DE RENDICIONES A PARSE =====\n');

  try {
    // 1. Leer planes desde Rendiciones
    console.log('📖 Leyendo planes desde rendiciones_db...');
    const planesRendiciones = await prismaRendiciones.planes.findMany({
      include: {
        plan_features: true
      },
      orderBy: {
        orden: 'asc'
      }
    });

    console.log(`✅ Encontrados ${planesRendiciones.length} planes en Rendiciones\n`);

    if (planesRendiciones.length === 0) {
      console.log('⚠️  No hay planes para migrar');
      return;
    }

    // 2. Migrar cada plan
    let planesCreados = 0;
    let planesActualizados = 0;
    let featuresCreados = 0;

    for (const planRendiciones of planesRendiciones) {
      console.log(`\n📋 Procesando plan: ${planRendiciones.nombre} (${planRendiciones.codigo})`);

      // Verificar si el plan ya existe en Parse
      const planExistente = await prismaParse.planes.findUnique({
        where: { codigo: planRendiciones.codigo }
      });

      let planParse;

      if (planExistente) {
        console.log('   ⚠️  Plan ya existe, actualizando...');

        // Actualizar plan existente
        planParse = await prismaParse.planes.update({
          where: { id: planExistente.id },
          data: {
            nombre: planRendiciones.nombre,
            descripcion: planRendiciones.descripcion,
            precio: planRendiciones.precio,
            activo: planRendiciones.activo,
            orden: planRendiciones.orden,
            updatedAt: new Date()
          }
        });

        planesActualizados++;

        // Eliminar features antiguos para reemplazarlos
        await prismaParse.plan_features.deleteMany({
          where: { planId: planParse.id }
        });
        console.log('   🗑️  Features antiguos eliminados');

      } else {
        console.log('   ✨ Creando nuevo plan...');

        // Crear nuevo plan
        planParse = await prismaParse.planes.create({
          data: {
            id: planRendiciones.id, // Mantener mismo ID
            codigo: planRendiciones.codigo,
            nombre: planRendiciones.nombre,
            descripcion: planRendiciones.descripcion,
            precio: planRendiciones.precio,
            activo: planRendiciones.activo,
            orden: planRendiciones.orden,
            createdAt: planRendiciones.createdAt,
            updatedAt: new Date()
          }
        });

        planesCreados++;
      }

      // 3. Migrar features del plan
      if (planRendiciones.plan_features && planRendiciones.plan_features.length > 0) {
        console.log(`   📌 Migrando ${planRendiciones.plan_features.length} features...`);

        for (const feature of planRendiciones.plan_features) {
          await prismaParse.plan_features.create({
            data: {
              id: uuidv4(), // Nuevo ID para features
              planId: planParse.id,
              feature: feature.feature,
              config: feature.config || null,
              createdAt: new Date()
            }
          });
          featuresCreados++;
        }

        console.log(`   ✅ ${planRendiciones.plan_features.length} features migrados`);
      } else {
        console.log('   ℹ️  Sin features para migrar');
      }
    }

    console.log('\n\n🎉 ===== MIGRACIÓN COMPLETADA =====');
    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Planes creados: ${planesCreados}`);
    console.log(`   🔄 Planes actualizados: ${planesActualizados}`);
    console.log(`   📌 Features creados: ${featuresCreados}`);
    console.log(`   📋 Total planes en Parse: ${planesCreados + planesActualizados}`);

    // 4. Mostrar planes migrados
    console.log('\n📋 Planes en Parse:');
    const planesParse = await prismaParse.planes.findMany({
      include: {
        plan_features: true
      },
      orderBy: {
        orden: 'asc'
      }
    });

    for (const plan of planesParse) {
      console.log(`   - ${plan.nombre} (${plan.codigo}): ${plan.plan_features.length} features`);
    }

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prismaParse.$disconnect();
    await prismaRendiciones.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  migratePlanes()
    .then(() => {
      console.log('\n✅ Script completado exitosamente!\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error('\n❌ Error fatal:', e);
      process.exit(1);
    });
}

module.exports = { migratePlanes };
