const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullVerification() {
  try {
    console.log('🔍 VERIFICACIÓN COMPLETA DE TENANTS\n');

    // Obtener tenant demo
    const tenantDemo = await prisma.tenants.findFirst({
      where: {
        OR: [
          { slug: 'demo' },
          { slug: 'default' }
        ]
      }
    });

    if (!tenantDemo) {
      console.error('❌ No se encontró el tenant demo');
      return;
    }

    console.log(`✅ Tenant: ${tenantDemo.nombre} (${tenantDemo.slug})`);
    console.log(`   ID: ${tenantDemo.id}\n`);

    // 1. Prompts
    console.log('📝 PROMPTS:');
    console.log('═══════════════════════════════════════════');
    const prompts = await prisma.ai_prompts.findMany({
      where: { tenantId: tenantDemo.id },
      select: { clave: true, nombre: true }
    });
    console.log(`   Total: ${prompts.length} prompts`);
    prompts.forEach(p => console.log(`   - ${p.clave}`));

    // 2. Motores IA
    console.log('\n🤖 MOTORES IA:');
    console.log('═══════════════════════════════════════════');
    const aiConfigs = await prisma.ai_provider_configs.findMany({
      where: { tenantId: tenantDemo.id },
      select: { provider: true, modelo: true, activo: true }
    });
    console.log(`   Total: ${aiConfigs.length} configuraciones`);
    aiConfigs.forEach(c => console.log(`   - ${c.provider} (${c.modelo}) - ${c.activo ? 'Activo' : 'Inactivo'}`));

    // 3. Configuración de Sincronización
    console.log('\n🔄 CONFIGURACIÓN DE SINCRONIZACIÓN:');
    console.log('═══════════════════════════════════════════');
    const syncConfigs = await prisma.sync_configurations.findMany({
      where: { tenantId: tenantDemo.id },
      select: {
        id: true,
        sqlServerHost: true,
        sqlServerDatabase: true,
        activo: true
      }
    });
    console.log(`   Total: ${syncConfigs.length} configuraciones`);
    syncConfigs.forEach(c => console.log(`   - ${c.sqlServerHost}/${c.sqlServerDatabase} - ${c.activo ? 'Activo' : 'Inactivo'}`));

    // 4. API Keys
    console.log('\n🔑 API KEYS DE SINCRONIZACIÓN:');
    console.log('═══════════════════════════════════════════');
    const apiKeys = await prisma.sync_api_keys.findMany({
      where: { tenantId: tenantDemo.id },
      select: {
        id: true,
        nombre: true,
        keyPreview: true,
        activo: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   Total: ${apiKeys.length} API keys`);
    apiKeys.forEach(k => console.log(`   - ${k.nombre} (${k.keyPreview}) - ${k.activo ? 'Activo' : 'Inactivo'}`));

    // 5. Usuarios del tenant
    console.log('\n👥 USUARIOS DEL TENANT:');
    console.log('═══════════════════════════════════════════');
    const users = await prisma.users.findMany({
      where: { tenantId: tenantDemo.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        superuser: true,
        activo: true
      }
    });
    console.log(`   Total: ${users.length} usuarios`);
    users.forEach(u => {
      const badges = [];
      if (u.superuser) badges.push('SUPERUSER');
      if (!u.activo) badges.push('INACTIVO');
      const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
      console.log(`   - ${u.email} (${u.nombre} ${u.apellido})${badgeStr}`);
    });

    // Resumen final
    console.log('\n📊 RESUMEN:');
    console.log('═══════════════════════════════════════════');
    console.log(`Tenant: ${tenantDemo.nombre} (${tenantDemo.slug})`);
    console.log(`  - Prompts: ${prompts.length}`);
    console.log(`  - Motores IA: ${aiConfigs.length}`);
    console.log(`  - Configs Sync: ${syncConfigs.length}`);
    console.log(`  - API Keys: ${apiKeys.length}`);
    console.log(`  - Usuarios: ${users.length}`);
    console.log('═══════════════════════════════════════════');

    if (users.length === 0) {
      console.log('\n⚠️  ADVERTENCIA: No hay usuarios asignados a este tenant');
      console.log('   Esto puede causar que no veas los datos en el frontend');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fullVerification()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
