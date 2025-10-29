const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAllParametros() {
  console.log('🔍 === DEBUGGING ALL PARAMETROS TABLES ===');

  try {
    // 1. Verificar parametros_maestros
    console.log('\n📊 1. === PARAMETROS_MAESTROS ===');
    const parametrosMaestros = await prisma.parametros_maestros.findMany({
      orderBy: { tenantId: 'asc' }
    });

    console.log(`Total registros en parametros_maestros: ${parametrosMaestros.length}`);

    const maestrosGrouped = await prisma.parametros_maestros.groupBy({
      by: ['tenantId'],
      _count: { id: true }
    });

    maestrosGrouped.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    // 2. Verificar atributos
    console.log('\n📊 2. === ATRIBUTOS ===');
    const atributos = await prisma.atributos.findMany({
      orderBy: { tenantId: 'asc' }
    });

    console.log(`Total registros en atributos: ${atributos.length}`);

    const atributosGrouped = await prisma.atributos.groupBy({
      by: ['tenantId'],
      _count: { id: true }
    });

    atributosGrouped.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    // 3. Verificar valores_atributo
    console.log('\n📊 3. === VALORES_ATRIBUTO ===');
    const valoresAtributo = await prisma.valores_atributo.findMany({
      orderBy: { tenantId: 'asc' }
    });

    console.log(`Total registros en valores_atributo: ${valoresAtributo.length}`);

    const valoresGrouped = await prisma.valores_atributo.groupBy({
      by: ['tenantId'],
      _count: { id: true }
    });

    valoresGrouped.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    // 4. Verificar reglas_negocio (puede tener otro nombre)
    console.log('\n📊 4. === REGLAS_NEGOCIO ===');
    try {
      const reglasNegocio = await prisma.reglas_negocio.findMany({
        orderBy: { tenantId: 'asc' }
      });

      console.log(`Total registros en reglas_negocio: ${reglasNegocio.length}`);

      const reglasGrouped = await prisma.reglas_negocio.groupBy({
        by: ['tenantId'],
        _count: { id: true }
      });

      reglasGrouped.forEach((group) => {
        console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
      });
    } catch (error) {
      console.log('   Tabla reglas_negocio no existe o tiene otro nombre');
      console.log('   Error:', error.message);
    }

    // 5. Mostrar algunos ejemplos de registros con tenantId NULL
    console.log('\n📊 5. === REGISTROS CON TENANT NULL ===');

    const maestrosNull = await prisma.parametros_maestros.findMany({
      where: { tenantId: null },
      take: 3
    });
    console.log(`\nParametros maestros con tenantId NULL (primeros 3):`);
    maestrosNull.forEach((param, index) => {
      console.log(`   ${index + 1}. ${param.codigo} - ${param.nombre} (tipo: ${param.tipo_campo})`);
    });

    const atributosNull = await prisma.atributos.findMany({
      where: { tenantId: null },
      take: 3
    });
    console.log(`\nAtributos con tenantId NULL (primeros 3):`);
    atributosNull.forEach((attr, index) => {
      console.log(`   ${index + 1}. ${attr.codigo} - ${attr.descripcion}`);
    });

    const valoresNull = await prisma.valores_atributo.findMany({
      where: { tenantId: null },
      take: 3
    });
    console.log(`\nValores atributo con tenantId NULL (primeros 3):`);
    valoresNull.forEach((val, index) => {
      console.log(`   ${index + 1}. ${val.codigo} - ${val.descripcion}`);
    });

  } catch (error) {
    console.error('💥 Error en debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAllParametros();