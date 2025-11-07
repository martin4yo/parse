const { PrismaClient } = require('@prisma/client');
const { hashApiKey } = require('../src/routes/syncApiKeys');
const prisma = new PrismaClient();

async function fixApiKeyTenant() {
  try {
    const apiKey = 'sk_11968f9a938040231d78f86fd84990faa881e70c0e476a0ef78e368673d37a5c';
    const targetTenantSlug = 'grupolb';

    console.log('\n=== ACTUALIZAR TENANT DE API KEY ===\n');

    // 1. Buscar el tenant objetivo
    const targetTenant = await prisma.tenants.findUnique({
      where: { slug: targetTenantSlug }
    });

    if (!targetTenant) {
      console.log(`❌ ERROR: Tenant "${targetTenantSlug}" no encontrado`);
      return;
    }

    console.log(`✅ Tenant objetivo encontrado:`);
    console.log(`   Nombre: ${targetTenant.nombre}`);
    console.log(`   Slug: ${targetTenant.slug}`);
    console.log(`   ID: ${targetTenant.id}\n`);

    // 2. Buscar la API key
    const hashedKey = hashApiKey(apiKey);
    const apiKeyRecord = await prisma.sync_api_keys.findUnique({
      where: { key: hashedKey },
      include: {
        tenants: {
          select: {
            id: true,
            slug: true,
            nombre: true
          }
        }
      }
    });

    if (!apiKeyRecord) {
      console.log(`❌ ERROR: API Key no encontrada`);
      return;
    }

    console.log(`✅ API Key encontrada:`);
    console.log(`   Nombre: ${apiKeyRecord.nombre}`);
    console.log(`   Tenant actual: ${apiKeyRecord.tenants.nombre} (${apiKeyRecord.tenants.slug})`);
    console.log(`   ID: ${apiKeyRecord.id}\n`);

    // 3. Confirmar actualización
    if (apiKeyRecord.tenantId === targetTenant.id) {
      console.log(`✅ La API key YA está asociada al tenant "${targetTenantSlug}"`);
      console.log(`   No se requiere actualización.\n`);
      return;
    }

    console.log(`🔄 Actualizando API key...`);
    console.log(`   De: ${apiKeyRecord.tenants.slug} → A: ${targetTenantSlug}\n`);

    // 4. Actualizar
    const updated = await prisma.sync_api_keys.update({
      where: { id: apiKeyRecord.id },
      data: {
        tenantId: targetTenant.id
      },
      include: {
        tenants: {
          select: {
            nombre: true,
            slug: true
          }
        }
      }
    });

    console.log(`✅ API Key actualizada exitosamente:`);
    console.log(`   Nuevo tenant: ${updated.tenants.nombre} (${updated.tenants.slug})`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ La API key ahora está asociada a "${targetTenantSlug}"`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixApiKeyTenant();
