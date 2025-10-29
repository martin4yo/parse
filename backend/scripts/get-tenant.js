const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenants.findMany({
    select: {
      id: true,
      nombre: true
    }
  });

  console.log('📋 Tenants disponibles:');
  tenants.forEach(t => {
    console.log(`  - ${t.nombre}: ${t.id}`);
  });

  return tenants;
}

main()
  .then(tenants => {
    if (tenants.length > 0) {
      console.log(`\n💡 Usar tenantId: ${tenants[0].id}`);
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
