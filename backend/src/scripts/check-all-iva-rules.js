const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const reglas = await prisma.reglas_negocio.findMany({
      where: {
        OR: [
          { nombre: { contains: 'IVA', mode: 'insensitive' } },
          { codigo: { contains: 'IVA', mode: 'insensitive' } },
          { descripcion: { contains: 'IVA', mode: 'insensitive' } }
        ]
      }
    });

    console.log(`Encontradas ${reglas.length} reglas relacionadas con IVA:\n`);

    reglas.forEach((regla, idx) => {
      console.log(`${idx + 1}. ${regla.nombre} (${regla.codigo})`);
      console.log(`   ID: ${regla.id}`);
      console.log(`   Activa: ${regla.activa}`);
      console.log(`   Updated: ${regla.updatedAt}`);
      console.log(`   Condiciones:`, JSON.stringify(regla.configuracion?.condiciones, null, 4));
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
