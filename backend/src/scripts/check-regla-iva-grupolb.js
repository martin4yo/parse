const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Primero buscar el tenant grupolb
    const tenant = await prisma.tenants.findFirst({
      where: {
        nombre: { contains: 'grupolb', mode: 'insensitive' }
      }
    });

    if (!tenant) {
      console.log('No se encontró el tenant grupolb');
      await prisma.$disconnect();
      return;
    }

    console.log(`Tenant encontrado: ${tenant.nombre} (${tenant.id})\n`);

    // Buscar reglas de IVA para este tenant
    const reglas = await prisma.reglas_negocio.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { nombre: { contains: 'IVA', mode: 'insensitive' } },
          { codigo: { contains: 'IVA', mode: 'insensitive' } }
        ]
      }
    });

    console.log(`Reglas de IVA para grupolb: ${reglas.length}\n`);

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
