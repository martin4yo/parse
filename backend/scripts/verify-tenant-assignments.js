const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTenantAssignments() {
  try {
    console.log('🔍 Verificando asignación de tenants...\n');

    // Verificar prompts
    const prompts = await prisma.ai_prompts.findMany({
      select: {
        id: true,
        clave: true,
        nombre: true,
        tenantId: true,
        tenants: {
          select: { nombre: true, slug: true }
        }
      },
      orderBy: { clave: 'asc' }
    });

    console.log('📝 PROMPTS:');
    console.log('═══════════════════════════════════════════');
    if (prompts.length === 0) {
      console.log('   No hay prompts en la base de datos');
    } else {
      prompts.forEach(p => {
        const tenant = p.tenants ? `${p.tenants.nombre} (${p.tenants.slug})` : '⚠️  SIN TENANT';
        console.log(`   ${p.clave.padEnd(40)} → ${tenant}`);
      });
    }

    const promptsSinTenant = prompts.filter(p => !p.tenantId);
    if (promptsSinTenant.length > 0) {
      console.log(`\n⚠️  ADVERTENCIA: ${promptsSinTenant.length} prompts sin tenant asignado`);
    }

    // Verificar configuraciones de IA
    const aiConfigs = await prisma.ai_provider_configs.findMany({
      select: {
        id: true,
        provider: true,
        modelo: true,
        tenantId: true,
        tenants: {
          select: { nombre: true, slug: true }
        }
      },
      orderBy: { provider: 'asc' }
    });

    console.log('\n🤖 CONFIGURACIONES DE MOTORES IA:');
    console.log('═══════════════════════════════════════════');
    if (aiConfigs.length === 0) {
      console.log('   No hay configuraciones de motores IA');
    } else {
      aiConfigs.forEach(c => {
        const tenant = c.tenants ? `${c.tenants.nombre} (${c.tenants.slug})` : '⚠️  SIN TENANT';
        console.log(`   ${c.provider.padEnd(15)} ${(c.modelo || 'default').padEnd(20)} → ${tenant}`);
      });
    }

    const aiConfigsSinTenant = aiConfigs.filter(c => !c.tenantId);
    if (aiConfigsSinTenant.length > 0) {
      console.log(`\n⚠️  ADVERTENCIA: ${aiConfigsSinTenant.length} configs de IA sin tenant asignado`);
    }

    // Verificar configuraciones de sincronización
    const syncConfigs = await prisma.sync_configurations.findMany({
      select: {
        id: true,
        sqlServerDatabase: true,
        tenantId: true,
        tenants: {
          select: { nombre: true, slug: true }
        }
      }
    });

    console.log('\n🔄 CONFIGURACIONES DE SINCRONIZACIÓN:');
    console.log('═══════════════════════════════════════════');
    if (syncConfigs.length === 0) {
      console.log('   No hay configuraciones de sincronización');
    } else {
      syncConfigs.forEach(c => {
        console.log(`   DB: ${c.sqlServerDatabase.padEnd(30)} → ${c.tenants.nombre} (${c.tenants.slug})`);
      });
    }

    // Resumen final
    console.log('\n📊 RESUMEN FINAL:');
    console.log('═══════════════════════════════════════════');
    console.log(`Total prompts: ${prompts.length}`);
    console.log(`  - Con tenant: ${prompts.filter(p => p.tenantId).length}`);
    console.log(`  - Sin tenant: ${promptsSinTenant.length}`);
    console.log(`\nTotal configs IA: ${aiConfigs.length}`);
    console.log(`  - Con tenant: ${aiConfigs.filter(c => c.tenantId).length}`);
    console.log(`  - Sin tenant: ${aiConfigsSinTenant.length}`);
    console.log(`\nTotal configs sync: ${syncConfigs.length}`);
    console.log(`  - Todas tienen tenant (campo obligatorio)`);
    console.log('═══════════════════════════════════════════');

    const todoOk = promptsSinTenant.length === 0 && aiConfigsSinTenant.length === 0;
    if (todoOk) {
      console.log('\n✅ ¡Todo correcto! Todos los registros tienen tenant asignado');
    } else {
      console.log('\n⚠️  Hay registros sin tenant que requieren atención');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyTenantAssignments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
