const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateRelaciones() {
  console.log('🔄 === MIGRANDO RELACIONES CON TENANT NULL ===');

  try {
    // 1. Verificar registros con tenantId null
    console.log('\n📊 1. Verificando registros con tenantId NULL:');
    const nullTenantRecords = await prisma.parametros_relaciones.findMany({
      where: { tenantId: null }
    });

    console.log(`Encontrados ${nullTenantRecords.length} registros con tenantId NULL:`);
    nullTenantRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id} - ${record.campo_padre} -> ${record.campo_hijo}`);
    });

    if (nullTenantRecords.length === 0) {
      console.log('✅ No hay registros que migrar.');
      return;
    }

    // 2. Migrar a tenant por defecto
    const defaultTenantId = 'default-tenant-id'; // IDEA tenant
    console.log(`\n🔄 2. Migrando ${nullTenantRecords.length} registros al tenant: ${defaultTenantId}`);

    const updateResult = await prisma.parametros_relaciones.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenantId }
    });

    console.log(`✅ Migrados ${updateResult.count} registros exitosamente.`);

    // 3. Verificar migración
    console.log('\n📊 3. Verificando migración:');
    const remainingNullRecords = await prisma.parametros_relaciones.findMany({
      where: { tenantId: null }
    });

    const migratedRecords = await prisma.parametros_relaciones.findMany({
      where: { tenantId: defaultTenantId }
    });

    console.log(`Registros con tenantId NULL restantes: ${remainingNullRecords.length}`);
    console.log(`Registros en tenant ${defaultTenantId}: ${migratedRecords.length}`);

    if (remainingNullRecords.length === 0) {
      console.log('🎉 Migración completada exitosamente!');

      console.log('\n📝 Registros migrados:');
      migratedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id} - ${record.campo_padre} -> ${record.campo_hijo} (tenant: ${record.tenantId})`);
      });
    } else {
      console.log('⚠️  Algunos registros no fueron migrados.');
    }

  } catch (error) {
    console.error('💥 Error en migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRelaciones();