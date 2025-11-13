const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const regla = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'REGLA_IVA' }
    });

    if (regla) {
      console.log('=== REGLA_IVA ===\n');
      console.log('Nombre:', regla.nombre);
      console.log('Código:', regla.codigo);
      console.log('Activa:', regla.activa);
      console.log('Prioridad:', regla.prioridad);
      console.log('Aplica a:', regla.configuracion?.aplicaA);
      console.log('\nCondiciones:', JSON.stringify(regla.configuracion?.condiciones, null, 2));
      console.log('\nAcciones:', JSON.stringify(regla.configuracion?.acciones, null, 2));
    } else {
      console.log('No se encontró REGLA_IVA');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
