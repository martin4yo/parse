const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugLotesTenant() {
  console.log('🔍 === DEBUGGING LOTES Y CABECERAS ===');

  try {
    // 1. Buscar todos los lotes por tenant
    console.log('\n📊 1. === LOTES POR TENANT ===');
    const lotesByTenant = await prisma.lotes.groupBy({
      by: ['tenantId'],
      _count: { id: true },
      orderBy: { tenantId: 'asc' }
    });

    lotesByTenant.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    // 2. Buscar últimos lotes
    console.log('\n📊 2. === ÚLTIMOS 10 LOTES ===');
    const ultimosLotes = await prisma.lotes.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        archivo: true,
        tenantId: true,
        createdAt: true,
        estado: true
      }
    });

    ultimosLotes.forEach((lote, index) => {
      console.log(`   ${index + 1}. ID: ${lote.id}`);
      console.log(`      Archivo: ${lote.archivo}`);
      console.log(`      Tenant: ${lote.tenantId}`);
      console.log(`      Estado: ${lote.estado}`);
      console.log(`      Creado: ${lote.createdAt}`);
    });

    // 3. Buscar cabeceras que podrían estar causando el conflicto
    console.log('\n📊 3. === CABECERAS CON POSIBLES CONFLICTOS ===');

    // Buscar cabeceras que no sean del tenant por defecto
    const cabecerasNoDefault = await prisma.rendicion_tarjeta_cabecera.findMany({
      where: {
        tenantId: {
          not: 'default-tenant-id'
        }
      },
      include: {
        lote: {
          select: {
            id: true,
            archivo: true,
            tenantId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Cabeceras de otros tenants: ${cabecerasNoDefault.length}`);
    cabecerasNoDefault.forEach((cab, index) => {
      console.log(`   ${index + 1}. Cabecera ID: ${cab.id}`);
      console.log(`      Lote ID: ${cab.loteId}`);
      console.log(`      Lote Archivo: ${cab.lote?.archivo}`);
      console.log(`      Tarjeta: ${cab.numeroTarjeta}`);
      console.log(`      Periodo: ${cab.periodo}`);
      console.log(`      Cabecera Tenant: ${cab.tenantId}`);
      console.log(`      Lote Tenant: ${cab.lote?.tenantId}`);
    });

    // 4. Verificar si hay inconsistencias de tenant entre lote y cabecera
    console.log('\n📊 4. === VERIFICANDO INCONSISTENCIAS DE TENANT ===');

    const inconsistencias = await prisma.rendicion_tarjeta_cabecera.findMany({
      where: {
        NOT: {
          tenantId: {
            equals: prisma.lotes.fields.tenantId
          }
        }
      },
      include: {
        lote: {
          select: {
            tenantId: true,
            archivo: true
          }
        }
      },
      take: 5
    });

    if (inconsistencias.length > 0) {
      console.log(`⚠️  Inconsistencias encontradas: ${inconsistencias.length}`);
      inconsistencias.forEach((inc, index) => {
        console.log(`   ${index + 1}. Cabecera tenant: ${inc.tenantId} vs Lote tenant: ${inc.lote?.tenantId}`);
      });
    } else {
      console.log('✅ No se encontraron inconsistencias de tenant');
    }

  } catch (error) {
    console.error('💥 Error en debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLotesTenant();