const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const tenants = await prisma.tenants.findMany();

    console.log(`Tenants encontrados: ${tenants.length}\n`);

    tenants.forEach((tenant, idx) => {
      console.log(`${idx + 1}. ${tenant.nombre}`);
      console.log(`   ID: ${tenant.id}`);
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
