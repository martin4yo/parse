const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listTenants() {
  try {
    const tenants = await prisma.tenants.findMany({
      select: {
        slug: true,
        nombre: true,
        id: true,
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    });

    console.log('\n📋 TENANTS DISPONIBLES:\n');
    console.log('='.repeat(60));

    tenants.forEach(tenant => {
      console.log(`Slug: ${tenant.slug}`);
      console.log(`Nombre: ${tenant.nombre}`);
      console.log(`ID: ${tenant.id}`);
      console.log(`Activo: ${tenant.activo ? '✅' : '❌'}`);
      console.log('-'.repeat(60));
    });

    console.log(`\nTotal: ${tenants.length} tenants`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listTenants();
