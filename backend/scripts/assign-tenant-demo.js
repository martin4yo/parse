const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignTenantDemo() {
  try {
    console.log('🔍 Buscando tenant "demo"...');

    // Buscar el tenant demo
    const tenantDemo = await prisma.tenants.findFirst({
      where: {
        OR: [
          { slug: 'demo' },
          { nombre: { contains: 'demo', mode: 'insensitive' } }
        ]
      }
    });

    if (!tenantDemo) {
      console.error('❌ No se encontró el tenant demo');
      console.log('📋 Tenants disponibles:');
      const allTenants = await prisma.tenants.findMany({
        select: { id: true, nombre: true, slug: true }
      });
      console.table(allTenants);
      return;
    }

    console.log(`✅ Tenant encontrado: ${tenantDemo.nombre} (${tenantDemo.id})`);

    // Actualizar prompts sin tenant
    console.log('\n📝 Actualizando prompts...');
    const promptsUpdated = await prisma.ai_prompts.updateMany({
      where: {
        tenantId: null
      },
      data: {
        tenantId: tenantDemo.id
      }
    });
    console.log(`✅ ${promptsUpdated.count} prompts actualizados`);

    // Actualizar configuraciones de AI providers sin tenant
    console.log('\n🤖 Actualizando configuraciones de motores de IA...');
    const aiConfigsUpdated = await prisma.ai_provider_configs.updateMany({
      where: {
        tenantId: null
      },
      data: {
        tenantId: tenantDemo.id
      }
    });
    console.log(`✅ ${aiConfigsUpdated.count} configuraciones de IA actualizadas`);

    // Verificar configuraciones de sincronización (tenantId es requerido, no puede ser null)
    console.log('\n🔄 Verificando configuraciones de sincronización...');
    const syncConfigs = await prisma.sync_configurations.findMany({
      select: {
        id: true,
        tenantId: true,
        tenants: {
          select: { nombre: true }
        }
      }
    });
    console.log(`ℹ️  ${syncConfigs.length} configuraciones de sincronización encontradas (tenantId es obligatorio)`);
    syncConfigs.forEach(config => {
      console.log(`   - Tenant: ${config.tenants.nombre}`);
    });

    // Mostrar resumen
    console.log('\n📊 RESUMEN:');
    console.log('═══════════════════════════════════════════');
    console.log(`Tenant: ${tenantDemo.nombre} (${tenantDemo.slug})`);
    console.log(`  - Prompts actualizados: ${promptsUpdated.count}`);
    console.log(`  - Motores IA actualizados: ${aiConfigsUpdated.count}`);
    console.log(`  - Configs sync verificadas: ${syncConfigs.length}`);
    console.log('═══════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

assignTenantDemo()
  .then(() => {
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
