const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateAllParametros() {
  console.log('🔄 === MIGRANDO TODAS LAS TABLAS DE PARAMETROS ===');

  const defaultTenantId = 'default-tenant-id'; // IDEA tenant

  try {
    // 1. Migrar parametros_maestros
    console.log('\n📊 1. === PARAMETROS_MAESTROS ===');

    const maestrosNull = await prisma.parametros_maestros.findMany({
      where: { tenantId: null },
      select: { id: true, codigo: true, nombre: true }
    });

    console.log(`Encontrados ${maestrosNull.length} registros con tenantId NULL en parametros_maestros:`);
    maestrosNull.slice(0, 5).forEach((param, index) => {
      console.log(`   ${index + 1}. ${param.codigo} - ${param.nombre}`);
    });

    if (maestrosNull.length > 0) {
      const updateMaestros = await prisma.parametros_maestros.updateMany({
        where: { tenantId: null },
        data: { tenantId: defaultTenantId }
      });
      console.log(`✅ Migrados ${updateMaestros.count} registros de parametros_maestros al tenant: ${defaultTenantId}`);
    }

    // 2. Migrar atributos
    console.log('\n📊 2. === ATRIBUTOS ===');

    const atributosNull = await prisma.atributos.findMany({
      where: { tenantId: null },
      select: { id: true, codigo: true, descripcion: true }
    });

    console.log(`Encontrados ${atributosNull.length} registros con tenantId NULL en atributos:`);
    atributosNull.forEach((attr, index) => {
      console.log(`   ${index + 1}. ${attr.codigo} - ${attr.descripcion}`);
    });

    if (atributosNull.length > 0) {
      const updateAtributos = await prisma.atributos.updateMany({
        where: { tenantId: null },
        data: { tenantId: defaultTenantId }
      });
      console.log(`✅ Migrados ${updateAtributos.count} registros de atributos al tenant: ${defaultTenantId}`);
    }

    // 3. Verificar valores_atributo (no tiene tenantId en schema)
    console.log('\n📊 3. === VALORES_ATRIBUTO ===');
    console.log('ℹ️  valores_atributo no tiene campo tenantId en el schema, se filtra por atributo parent.');

    // 4. Verificar si existe tabla de reglas de negocio
    console.log('\n📊 4. === REGLAS_NEGOCIO ===');
    try {
      // Buscar posibles nombres de tabla para reglas
      const tableNames = ['reglas_negocio', 'business_rules', 'reglas', 'rules'];
      let reglasTable = null;

      for (const tableName of tableNames) {
        try {
          // Intentar hacer una consulta simple para ver si la tabla existe
          const testQuery = await prisma.$queryRaw`SELECT COUNT(*) FROM ${tableName} LIMIT 1`;
          reglasTable = tableName;
          console.log(`✅ Encontrada tabla: ${tableName}`);
          break;
        } catch (error) {
          // Tabla no existe, continuar
        }
      }

      if (!reglasTable) {
        console.log('ℹ️  No se encontró tabla de reglas de negocio en la base de datos');
      }

    } catch (error) {
      console.log('ℹ️  Error verificando reglas de negocio:', error.message);
    }

    // 5. Verificar estado final
    console.log('\n📊 5. === VERIFICACIÓN FINAL ===');

    const maestrosFinal = await prisma.parametros_maestros.groupBy({
      by: ['tenantId'],
      _count: { id: true }
    });

    console.log('Distribución final de parametros_maestros:');
    maestrosFinal.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    const atributosFinal = await prisma.atributos.groupBy({
      by: ['tenantId'],
      _count: { id: true }
    });

    console.log('Distribución final de atributos:');
    atributosFinal.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    console.log('\n🎉 Migración completada!');

  } catch (error) {
    console.error('💥 Error en migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAllParametros();