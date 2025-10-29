const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setDefaultTenant() {
  try {
    console.log('🔧 Configurando tenant por defecto...');

    // Buscar el tenant con slug 'default'
    const tenant = await prisma.tenants.findFirst({
      where: { slug: 'default' }
    });

    if (!tenant) {
      console.log('❌ No se encontró tenant con slug "default"');
      return;
    }

    // Actualizar para marcarlo como default
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: { esDefault: true }
    });

    console.log('✅ Tenant por defecto configurado:', tenant.nombre);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setDefaultTenant();