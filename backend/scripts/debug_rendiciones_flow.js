const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugRendicionesFlow() {
  console.log('🔍 === DEBUGGING RENDICIONES DATA FLOW ===');

  const tarjeta = '4937028000411984';
  const periodo = '2507';
  const tenantId = 'default-tenant-id'; // IDEA tenant

  console.log(`\n📋 Parámetros de búsqueda:`);
  console.log(`- Tarjeta: ${tarjeta}`);
  console.log(`- Período: ${periodo}`);
  console.log(`- Tenant: ${tenantId}`);

  try {
    // 1. Verificar registros en resumen_tarjeta
    console.log('\n🔍 === PASO 1: Verificar resumen_tarjeta ===');
    const resumenRecords = await prisma.resumen_tarjeta.findMany({
      where: {
        numeroTarjeta: tarjeta,
        periodo: periodo,
        tenantId: tenantId
      },
      select: {
        id: true,
        numeroTarjeta: true,
        periodo: true,
        tenantId: true,
        codigoTarjeta: true,
        loteId: true,
        _count: {
          select: {
            rendicion_tarjeta_items: true
          }
        }
      }
    });

    console.log(`📊 Registros en resumen_tarjeta: ${resumenRecords.length}`);
    resumenRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}`);
      console.log(`      Tarjeta: ${record.numeroTarjeta}`);
      console.log(`      Período: ${record.periodo}`);
      console.log(`      Tenant: ${record.tenantId}`);
      console.log(`      Código Tarjeta: ${record.codigoTarjeta}`);
      console.log(`      Lote ID: ${record.loteId}`);
      console.log(`      _count items: ${record._count.rendicion_tarjeta_items}`);
    });

    // 2. Verificar cabeceras relacionadas
    console.log('\n🔍 === PASO 2: Verificar cabeceras relacionadas ===');
    for (const resumen of resumenRecords) {
      const cabeceras = await prisma.rendicion_tarjeta_cabecera.findMany({
        where: {
          numeroTarjeta: tarjeta,
          periodo: periodo,
          tenantId: tenantId
        },
        select: {
          id: true,
          numeroTarjeta: true,
          periodo: true,
          tenantId: true,
          _count: {
            select: {
              rendicion_tarjeta_items: true
            }
          }
        }
      });

      console.log(`📊 Cabeceras para resumen ${resumen.id}: ${cabeceras.length}`);
      cabeceras.forEach((cabecera, index) => {
        console.log(`   ${index + 1}. Cabecera ID: ${cabecera.id}`);
        console.log(`      Tarjeta: ${cabecera.numeroTarjeta}`);
        console.log(`      Período: ${cabecera.periodo}`);
        console.log(`      Tenant: ${cabecera.tenantId}`);
        console.log(`      _count items: ${cabecera._count.rendicion_tarjeta_items}`);
      });
    }

    // 3. Verificar items directamente
    console.log('\n🔍 === PASO 3: Verificar items directamente ===');

    // Contar todos los items para esta tarjeta y período (usando la relación)
    const allItemsCount = await prisma.rendicion_tarjeta_items.count({
      where: {
        resumen_tarjeta: {
          numeroTarjeta: tarjeta,
          periodo: periodo
        }
      }
    });
    console.log(`📊 Total items (sin filtro tenant): ${allItemsCount}`);

    // Contar items con filtro de tenant
    const tenantItemsCount = await prisma.rendicion_tarjeta_items.count({
      where: {
        resumen_tarjeta: {
          numeroTarjeta: tarjeta,
          periodo: periodo
        },
        tenantId: tenantId
      }
    });
    console.log(`📊 Total items (con filtro tenant ${tenantId}): ${tenantItemsCount}`);

    // Ver distribución por tenant
    const itemsByTenant = await prisma.rendicion_tarjeta_items.groupBy({
      by: ['tenantId'],
      where: {
        resumen_tarjeta: {
          numeroTarjeta: tarjeta,
          periodo: periodo
        }
      },
      _count: {
        id: true
      }
    });

    console.log(`📊 Distribución de items por tenant:`);
    itemsByTenant.forEach((group) => {
      console.log(`   Tenant: ${group.tenantId || 'NULL'} - Count: ${group._count.id}`);
    });

    // 4. Verificar la query exacta del endpoint
    console.log('\n🔍 === PASO 4: Simular query del endpoint ===');

    // Esta es la query que hace el endpoint /rendiciones/:id/items
    const endpointQuery = await prisma.rendicion_tarjeta_items.findMany({
      where: {
        resumenTarjetaId: {
          in: resumenRecords.map(r => r.id)
        },
        tenantId: tenantId
      },
      select: {
        id: true,
        tenantId: true,
        resumenTarjetaId: true,
        rendicionCabeceraId: true,
        resumen_tarjeta: {
          select: {
            numeroTarjeta: true,
            periodo: true
          }
        },
        rendicion_tarjeta_cabecera: {
          select: {
            id: true,
            numeroTarjeta: true,
            tenantId: true
          }
        }
      }
    });

    console.log(`📊 Items que devolvería el endpoint: ${endpointQuery.length}`);

    // Mostrar algunos ejemplos
    console.log(`📝 Primeros 3 items del endpoint:`);
    endpointQuery.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. Item ID: ${item.id}`);
      console.log(`      Tarjeta: ${item.resumen_tarjeta?.numeroTarjeta}`);
      console.log(`      Período: ${item.resumen_tarjeta?.periodo}`);
      console.log(`      Tenant: ${item.tenantId}`);
      console.log(`      Resumen ID: ${item.resumenTarjetaId}`);
      console.log(`      Cabecera ID: ${item.rendicion_tarjeta_cabecera?.id}`);
      console.log(`      Cabecera Tarjeta: ${item.rendicion_tarjeta_cabecera?.numeroTarjeta}`);
      console.log(`      Cabecera Tenant: ${item.rendicion_tarjeta_cabecera?.tenantId}`);
    });

    // 5. Verificar inconsistencias
    console.log('\n🔍 === PASO 5: Verificar inconsistencias ===');

    const inconsistentItems = await prisma.rendicion_tarjeta_items.findMany({
      where: {
        resumen_tarjeta: {
          numeroTarjeta: tarjeta,
          periodo: periodo
        },
        OR: [
          {
            AND: [
              { tenantId: { not: tenantId } },
              { tenantId: { not: null } }
            ]
          },
          {
            rendicion_tarjeta_cabecera: {
              tenantId: { not: tenantId }
            }
          }
        ]
      },
      select: {
        id: true,
        tenantId: true,
        resumenTarjetaId: true,
        rendicionCabeceraId: true,
        resumen_tarjeta: {
          select: {
            numeroTarjeta: true
          }
        },
        rendicion_tarjeta_cabecera: {
          select: {
            id: true,
            numeroTarjeta: true,
            tenantId: true
          }
        }
      }
    });

    console.log(`📊 Items con inconsistencias de tenant: ${inconsistentItems.length}`);
    inconsistentItems.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. Item ID: ${item.id}`);
      console.log(`      Item Tenant: ${item.tenantId}`);
      console.log(`      Cabecera Tenant: ${item.rendicion_tarjeta_cabecera?.tenantId}`);
      console.log(`      Cabecera Tarjeta: ${item.rendicion_tarjeta_cabecera?.numeroTarjeta}`);
      console.log(`      Resumen Tarjeta: ${item.resumen_tarjeta?.numeroTarjeta}`);
    });

  } catch (error) {
    console.error('💥 Error en debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRendicionesFlow();