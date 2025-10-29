const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugRelaciones() {
  console.log('🔍 === DEBUGGING RELACIONES ===');

  try {
    // 1. Verificar la tabla parametros_relaciones
    console.log('\n📊 1. Verificar todos los registros en parametros_relaciones:');
    const allRelaciones = await prisma.parametros_relaciones.findMany({
      orderBy: { tenantId: 'asc' }
    });

    console.log(`Total registros en parametros_relaciones: ${allRelaciones.length}`);

    if (allRelaciones.length > 0) {
      console.log('\n📝 Primeros 5 registros:');
      allRelaciones.slice(0, 5).forEach((rel, index) => {
        console.log(`   ${index + 1}. ID: ${rel.id}`);
        console.log(`      Padre: ${rel.campo_padre} -> Hijo: ${rel.campo_hijo}`);
        console.log(`      Tenant: ${rel.tenantId || 'NULL'}`);
        console.log(`      Activo: ${rel.activo}`);
        console.log(`      Descripción: ${rel.descripcion || 'N/A'}`);
      });
    }

    // 2. Agrupar por tenant
    console.log('\n📊 2. Distribución por tenant:');
    const groupedByTenant = await prisma.parametros_relaciones.groupBy({
      by: ['tenantId'],
      _count: {
        id: true
      }
    });

    groupedByTenant.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    // 3. Verificar para tenants específicos
    console.log('\n📊 3. Verificar para tenants específicos:');

    const ideaRelaciones = await prisma.parametros_relaciones.findMany({
      where: { tenantId: 'default-tenant-id' }
    });
    console.log(`   IDEA (default-tenant-id): ${ideaRelaciones.length} relaciones`);

    const sanAndresRelaciones = await prisma.parametros_relaciones.findMany({
      where: { tenantId: 'f24efec0-b92e-4a5e-b060-27665e4663f2' }
    });
    console.log(`   San Andres (f24efec0-b92e-4a5e-b060-27665e4663f2): ${sanAndresRelaciones.length} relaciones`);

    // 4. Verificar la estructura de la tabla
    console.log('\n📊 4. Verificar estructura de tabla (schema):');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'parametros_relaciones'
      ORDER BY ordinal_position;
    `;

    console.log('Estructura de parametros_relaciones:');
    tableInfo.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

  } catch (error) {
    console.error('💥 Error en debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRelaciones();