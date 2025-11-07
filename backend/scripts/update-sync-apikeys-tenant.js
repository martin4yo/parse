const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSyncApiKeys() {
  try {
    console.log('🔍 Verificando API keys de sincronización...\n');

    // Buscar el tenant demo
    const tenantDemo = await prisma.tenants.findFirst({
      where: {
        OR: [
          { slug: 'demo' },
          { slug: 'default' },
          { nombre: { contains: 'demo', mode: 'insensitive' } }
        ]
      }
    });

    if (!tenantDemo) {
      console.error('❌ No se encontró el tenant demo');
      return;
    }

    console.log(`✅ Tenant encontrado: ${tenantDemo.nombre} (${tenantDemo.id})\n`);

    // Verificar API keys actuales
    const apiKeys = await prisma.sync_api_keys.findMany({
      select: {
        id: true,
        nombre: true,
        keyPreview: true,
        tenantId: true,
        tenants: {
          select: { nombre: true, slug: true }
        }
      }
    });

    console.log('🔑 API KEYS ACTUALES:');
    console.log('═══════════════════════════════════════════');
    if (apiKeys.length === 0) {
      console.log('   No hay API keys en la base de datos');
    } else {
      apiKeys.forEach(key => {
        const tenant = key.tenants ? `${key.tenants.nombre} (${key.tenants.slug})` : '⚠️  SIN TENANT';
        console.log(`   ${key.nombre.padEnd(30)} ${key.keyPreview.padEnd(20)} → ${tenant}`);
      });
    }

    const apiKeysSinTenant = apiKeys.filter(k => !k.tenantId);
    console.log(`\n📊 Sin tenant: ${apiKeysSinTenant.length} de ${apiKeys.length}`);

    if (apiKeysSinTenant.length > 0) {
      console.log('\n🔄 Actualizando API keys sin tenant...');

      const updated = await prisma.sync_api_keys.updateMany({
        where: {
          tenantId: null
        },
        data: {
          tenantId: tenantDemo.id
        }
      });

      console.log(`✅ ${updated.count} API keys actualizadas con tenant: ${tenantDemo.nombre}`);

      // Verificar nuevamente
      const apiKeysAfter = await prisma.sync_api_keys.findMany({
        select: {
          id: true,
          nombre: true,
          keyPreview: true,
          tenantId: true,
          tenants: {
            select: { nombre: true, slug: true }
          }
        }
      });

      console.log('\n🔑 API KEYS DESPUÉS DE ACTUALIZACIÓN:');
      console.log('═══════════════════════════════════════════');
      apiKeysAfter.forEach(key => {
        const tenant = key.tenants ? `${key.tenants.nombre} (${key.tenants.slug})` : '⚠️  SIN TENANT';
        console.log(`   ${key.nombre.padEnd(30)} ${key.keyPreview.padEnd(20)} → ${tenant}`);
      });
    } else {
      console.log('\n✅ Todas las API keys ya tienen tenant asignado');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateSyncApiKeys()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
