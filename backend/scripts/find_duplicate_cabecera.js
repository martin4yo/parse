const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findDuplicateCabecera() {
  console.log('🔍 === BUSCANDO CABECERAS DUPLICADAS ===');

  try {
    // Buscar todas las cabeceras del tenant "San Andres" (que no sea default-tenant-id)
    const cabeceras = await prisma.rendicion_tarjeta_cabecera.findMany({
      where: {
        tenantId: {
          not: 'default-tenant-id'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    console.log(`Total cabeceras de otros tenants: ${cabeceras.length}`);

    if (cabeceras.length > 0) {
      console.log('\n📝 Cabeceras existentes que podrían causar conflicto:');
      cabeceras.forEach((cab, index) => {
        const fecha = new Date(cab.createdAt).toLocaleString();
        console.log(`${index + 1}. ID: ${cab.id}`);
        console.log(`   LoteId: ${cab.loteId}`);
        console.log(`   NumeroTarjeta: ${cab.numeroTarjeta}`);
        console.log(`   Periodo: ${cab.periodo}`);
        console.log(`   TenantId: ${cab.tenantId}`);
        console.log(`   Creado: ${fecha}`);
        console.log('');
      });

      // Agrupar por la constraint única para encontrar duplicados
      const agrupadas = {};
      cabeceras.forEach(cab => {
        const key = `${cab.loteId}_${cab.numeroTarjeta}_${cab.periodo}_${cab.tenantId}`;
        if (!agrupadas[key]) {
          agrupadas[key] = [];
        }
        agrupadas[key].push(cab);
      });

      const duplicados = Object.entries(agrupadas).filter(([key, items]) => items.length > 1);

      if (duplicados.length > 0) {
        console.log('⚠️  DUPLICADOS ENCONTRADOS:');
        duplicados.forEach(([key, items]) => {
          console.log(`\nClave: ${key} (${items.length} registros)`);
          items.forEach((item, idx) => {
            console.log(`   ${idx + 1}. ID: ${item.id} - Creado: ${new Date(item.createdAt).toLocaleString()}`);
          });
        });
      } else {
        console.log('✅ No hay duplicados en las cabeceras existentes');
      }
    }

    // También buscar trabajos pendientes
    const jobs = await prisma.processing_jobs.findMany({
      where: {
        estado: {
          in: ['PENDING', 'PROCESSING']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\nTrabajos pendientes: ${jobs.length}`);
    jobs.forEach((job, index) => {
      console.log(`${index + 1}. ID: ${job.id} - Tipo: ${job.tipo} - Estado: ${job.estado}`);
    });

  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDuplicateCabecera();