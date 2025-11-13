const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const tenantId = 'ef9d53eb-9c7c-4713-9565-0cd6f898dac6'; // Grupo Loraschi Batalla

    console.log('Tenant: Grupo Loraschi Batalla\n');

    // Buscar reglas de IVA para este tenant
    const reglas = await prisma.reglas_negocio.findMany({
      where: {
        tenantId: tenantId,
        OR: [
          { nombre: { contains: 'IVA', mode: 'insensitive' } },
          { codigo: { contains: 'IVA', mode: 'insensitive' } }
        ]
      }
    });

    console.log(`Reglas de IVA: ${reglas.length}\n`);

    reglas.forEach((regla, idx) => {
      console.log(`${idx + 1}. ${regla.nombre} (${regla.codigo})`);
      console.log(`   Activa: ${regla.activa}`);
      console.log(`   Prioridad: ${regla.prioridad}`);
      console.log(`   Aplica a: ${regla.configuracion?.aplicaA}`);
      console.log(`   Condiciones:`, JSON.stringify(regla.configuracion?.condiciones, null, 2));
      console.log(`   Acciones:`, JSON.stringify(regla.configuracion?.acciones, null, 2));
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
