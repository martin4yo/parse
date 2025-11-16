const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function corregirReglasGlobales() {
  console.log('🔧 Corrigiendo reglas globales con tenantId asignado...\n');

  try {
    // 1. Buscar todas las reglas con esGlobal=true pero con tenantId
    const reglasInconsistentes = await prisma.reglas_negocio.findMany({
      where: {
        esGlobal: true,
        tenantId: { not: null }
      }
    });

    if (reglasInconsistentes.length === 0) {
      console.log('✅ No se encontraron reglas inconsistentes');
      return;
    }

    console.log(`⚠️  Encontradas ${reglasInconsistentes.length} regla(s) global(es) con tenantId asignado:\n`);

    for (const regla of reglasInconsistentes) {
      // Buscar el tenant
      const tenant = await prisma.tenants.findUnique({
        where: { id: regla.tenantId }
      });

      console.log(`📋 Regla: ${regla.codigo} (${regla.nombre})`);
      console.log(`   ID: ${regla.id}`);
      console.log(`   tenantId actual: ${regla.tenantId} (${tenant?.nombre || 'DESCONOCIDO'})`);
      console.log(`   esGlobal: ${regla.esGlobal}`);

      // Verificar si hay vínculos
      const vinculos = await prisma.tenant_reglas_globales.findMany({
        where: { reglaGlobalId: regla.id },
        include: {
          tenants: { select: { nombre: true } }
        }
      });

      if (vinculos.length > 0) {
        console.log(`   Vínculos existentes: ${vinculos.length}`);
        vinculos.forEach(v => {
          console.log(`     - ${v.tenants.nombre} (activa: ${v.activa})`);
        });
      } else {
        console.log(`   ⚠️  Sin vínculos en tenant_reglas_globales`);
      }

      console.log();
    }

    // 2. Preguntar qué hacer (en este caso, solo mostrar qué se haría)
    console.log('=' .repeat(60));
    console.log('🔧 ACCIÓN RECOMENDADA:');
    console.log('=' .repeat(60));
    console.log('Para cada regla, hay 2 opciones:\n');
    console.log('Opción A: Convertir a regla ESPECÍFICA del tenant');
    console.log('  - Cambiar esGlobal = false');
    console.log('  - Mantener tenantId');
    console.log('  - Eliminar cualquier vínculo en tenant_reglas_globales\n');
    console.log('Opción B: Convertir a regla verdaderamente GLOBAL');
    console.log('  - Cambiar tenantId = NULL');
    console.log('  - Mantener esGlobal = true');
    console.log('  - Crear vínculo en tenant_reglas_globales si debe estar activa\n');
    console.log('=' .repeat(60));
    console.log();

    // 3. Aplicar corrección automática (Opción B por defecto)
    console.log('🔄 Aplicando corrección (Opción B: Convertir a global puro)...\n');

    for (const regla of reglasInconsistentes) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: regla.tenantId }
      });

      console.log(`Procesando: ${regla.codigo}...`);

      // Paso 1: Verificar si ya tiene vínculo con el tenant original
      const vinculoExistente = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: regla.tenantId,
            reglaGlobalId: regla.id
          }
        }
      });

      if (!vinculoExistente) {
        // Crear vínculo para que el tenant original siga teniendo la regla activa
        await prisma.tenant_reglas_globales.create({
          data: {
            tenantId: regla.tenantId,
            reglaGlobalId: regla.id,
            activa: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`  ✅ Creado vínculo para ${tenant?.nombre || regla.tenantId}`);
      } else {
        console.log(`  ℹ️  Ya existe vínculo para ${tenant?.nombre || regla.tenantId} (activa: ${vinculoExistente.activa})`);
      }

      // Paso 2: Quitar el tenantId de la regla
      await prisma.reglas_negocio.update({
        where: { id: regla.id },
        data: {
          tenantId: null,
          updatedAt: new Date()
        }
      });
      console.log(`  ✅ Removido tenantId de la regla`);
      console.log();
    }

    console.log('✅ Corrección completada\n');
    console.log('📊 RESULTADO:');
    console.log(`   - ${reglasInconsistentes.length} regla(s) corregida(s)`);
    console.log(`   - Todas ahora son globales puras (tenantId = NULL)`);
    console.log(`   - Se crearon vínculos para mantener la activación en los tenants originales`);

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  } finally {
    await prisma.$disconnect();
  }
}

corregirReglasGlobales()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
