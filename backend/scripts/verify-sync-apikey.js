const { PrismaClient } = require('@prisma/client');
const { hashApiKey } = require('../src/routes/syncApiKeys');
const prisma = new PrismaClient();

async function verifySyncApiKey() {
  try {
    const apiKey = 'sk_adf60bfb3113143a553c3ea9ae6fadbd6aceceba37a87020095724f0cc00f647';
    const tenantSlug = 'grupolb';

    console.log('\n=== VERIFICACIÓN DE API KEY PARA SYNC ===\n');
    console.log(`API Key (plain): ${apiKey.substring(0, 10)}...`);
    console.log(`Tenant Slug: ${tenantSlug}\n`);

    // 1. Hashear la API key
    const hashedKey = hashApiKey(apiKey);
    console.log(`API Key (hash): ${hashedKey.substring(0, 20)}...\n`);

    // 2. Buscar el tenant por slug
    console.log('--- Buscando Tenant ---');
    const tenant = await prisma.tenants.findUnique({
      where: { slug: tenantSlug }
    });

    if (!tenant) {
      console.log(`❌ ERROR: Tenant con slug "${tenantSlug}" NO ENCONTRADO`);
      return;
    }

    console.log(`✅ Tenant encontrado:`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Nombre: ${tenant.nombre}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   Activo: ${tenant.activo}\n`);

    // 3. Buscar la API key
    console.log('--- Buscando API Key ---');
    const apiKeyRecord = await prisma.sync_api_keys.findUnique({
      where: { key: hashedKey },
      include: {
        tenants: {
          select: {
            id: true,
            slug: true,
            nombre: true,
            activo: true
          }
        }
      }
    });

    if (!apiKeyRecord) {
      console.log(`❌ ERROR: API Key NO ENCONTRADA en la base de datos`);
      console.log(`\nPosibles causas:`);
      console.log(`1. La API key no existe en sync_api_keys`);
      console.log(`2. La API key fue creada con un hash diferente`);
      console.log(`\nSolución: Crear la API key desde el frontend o con el endpoint POST /api/sync/api-keys`);
      return;
    }

    console.log(`✅ API Key encontrada:`);
    console.log(`   ID: ${apiKeyRecord.id}`);
    console.log(`   Nombre: ${apiKeyRecord.nombre}`);
    console.log(`   Tenant ID: ${apiKeyRecord.tenantId}`);
    console.log(`   Tenant Slug: ${apiKeyRecord.tenants.slug}`);
    console.log(`   Tenant Nombre: ${apiKeyRecord.tenants.nombre}`);
    console.log(`   Activo: ${apiKeyRecord.activo}`);
    console.log(`   Permisos:`, apiKeyRecord.permisos);
    console.log(`   Último uso: ${apiKeyRecord.ultimoUso || 'Nunca'}`);
    console.log(`   Veces utilizada: ${apiKeyRecord.vecesUtilizada}\n`);

    // 4. Verificar que la API key está asociada al tenant correcto
    if (apiKeyRecord.tenantId !== tenant.id) {
      console.log(`❌ ERROR: La API key está asociada a un tenant DIFERENTE`);
      console.log(`   API Key Tenant ID: ${apiKeyRecord.tenantId} (${apiKeyRecord.tenants.slug})`);
      console.log(`   Tenant solicitado ID: ${tenant.id} (${tenant.slug})`);
      console.log(`\nSolución: Crear una nueva API key para el tenant "${tenantSlug}"`);
      return;
    }

    console.log(`✅ La API key está correctamente asociada al tenant "${tenantSlug}"\n`);

    // 5. Verificar permisos
    if (!apiKeyRecord.permisos.sync) {
      console.log(`❌ ADVERTENCIA: La API key NO tiene permiso de "sync"`);
      console.log(`   Permisos actuales:`, apiKeyRecord.permisos);
      console.log(`\nSolución: Actualizar los permisos de la API key para incluir { "sync": true }`);
      return;
    }

    console.log(`✅ La API key tiene permiso de "sync"\n`);

    // 6. Verificar configuración de sincronización
    console.log('--- Verificando Configuración de Sync ---');
    const syncConfig = await prisma.sync_configurations.findUnique({
      where: { tenantId: tenant.id }
    });

    if (!syncConfig) {
      console.log(`❌ ERROR: NO existe configuración de sincronización para el tenant "${tenantSlug}"`);
      console.log(`\nSolución: Crear configuración desde el frontend o con POST /api/sync/configurations`);
      return;
    }

    console.log(`✅ Configuración de sincronización encontrada:`);
    console.log(`   SQL Server: ${syncConfig.sqlServerHost}:${syncConfig.sqlServerPort}`);
    console.log(`   Database: ${syncConfig.sqlServerDatabase}`);
    console.log(`   User: ${syncConfig.sqlServerUser}`);
    console.log(`   Activo: ${syncConfig.activo}`);
    console.log(`   Tablas Subida: ${syncConfig.configuracionTablas?.tablasSubida?.length || 0}`);
    console.log(`   Tablas Bajada: ${syncConfig.configuracionTablas?.tablasBajada?.length || 0}\n`);

    if (!syncConfig.activo) {
      console.log(`❌ ADVERTENCIA: La configuración de sync está DESACTIVADA`);
      return;
    }

    // 7. Resumen final
    console.log('='.repeat(60));
    console.log('✅✅✅ TODO CONFIGURADO CORRECTAMENTE ✅✅✅');
    console.log('='.repeat(60));
    console.log('\nPuedes ejecutar el sync client con:');
    console.log(`  ax-sync-client.exe sync\n`);

  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySyncApiKey();
