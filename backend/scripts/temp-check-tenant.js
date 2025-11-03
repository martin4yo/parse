const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTenant() {
  try {
    // Buscar el tenant de la regla
    const tenant = await prisma.tenants.findUnique({
      where: { id: 'b88fa541-4d93-4f16-a707-95e70f7eecdc' },
      select: { nombre: true, cuit: true, slug: true }
    });

    console.log('🏢 Tenant de la regla PRODUCTO_BANDEJAS:');
    if (tenant) {
      console.log('   Nombre:', tenant.nombre);
      console.log('   CUIT:', tenant.cuit);
      console.log('   Slug:', tenant.slug);
    } else {
      console.log('   ❌ Tenant no encontrado');
    }

    console.log('\n📄 Últimos 3 documentos procesados:');
    const docs = await prisma.documentos_procesados.findMany({
      take: 3,
      orderBy: { fechaProcesamiento: 'desc' },
      select: {
        nombreArchivo: true,
        fechaProcesamiento: true,
        tenantId: true,
        tenants: {
          select: { nombre: true, cuit: true }
        }
      }
    });

    docs.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. ${doc.nombreArchivo}`);
      console.log(`      Tenant: ${doc.tenants?.nombre || 'N/A'}`);
      console.log(`      TenantId: ${doc.tenantId}`);
      console.log(`      Fecha: ${doc.fechaProcesamiento}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenant();
