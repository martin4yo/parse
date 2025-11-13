const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const tenantId = 'ef9d53eb-9c7c-4713-9565-0cd6f898dac6'; // Grupo Loraschi Batalla

    const reglas = await prisma.reglas_negocio.findMany({
      where: {
        tenantId: tenantId,
        tipo: 'TRANSFORMACION'
      },
      orderBy: { prioridad: 'desc' }
    });

    console.log(`Tenant: Grupo Loraschi Batalla`);
    console.log(`Reglas de TRANSFORMACION: ${reglas.length}\n`);

    reglas.forEach((regla, idx) => {
      console.log(`${idx + 1}. ${regla.nombre} (${regla.codigo})`);
      console.log(`   Activa: ${regla.activa}`);
      console.log(`   Prioridad: ${regla.prioridad}`);
      console.log(`   Aplica a: ${regla.configuracion?.aplicaA || 'TODOS'}`);
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
