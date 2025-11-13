const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const reglas = await prisma.reglas_negocio.findMany({
      where: { codigo: 'REGLA_IVA' },
      include: { tenants: true }
    });

    console.log(`Reglas con código REGLA_IVA: ${reglas.length}\n`);

    for (const regla of reglas) {
      console.log(`Tenant: ${regla.tenants.nombre}`);
      console.log(`Activa: ${regla.activa}`);
      console.log(`Prioridad: ${regla.prioridad}`);
      console.log(`Aplica a: ${regla.configuracion?.aplicaA}`);
      console.log(`Condiciones:`, JSON.stringify(regla.configuracion?.condiciones, null, 2));
      console.log(`Acciones:`, JSON.stringify(regla.configuracion?.acciones, null, 2));
      console.log('');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
