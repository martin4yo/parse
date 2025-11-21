const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n=== CUENTA CONTABLE ===');
    const cuentas = await prisma.parametros_maestros.findMany({
      where: { tipo_campo: 'cuenta_contable' }
    });
    console.log(`Total registros: ${cuentas.length}`);
    console.log(JSON.stringify(cuentas, null, 2));

    console.log('\n=== SUBCUENTA ===');
    const subcuentas = await prisma.parametros_maestros.findMany({
      where: { tipo_campo: 'subcuenta' }
    });
    console.log(`Total registros: ${subcuentas.length}`);
    console.log(JSON.stringify(subcuentas, null, 2));

    console.log('\n=== CODIGO DIMENSION ===');
    const dimensiones = await prisma.parametros_maestros.findMany({
      where: { tipo_campo: 'codigo_dimension' }
    });
    console.log(`Total registros: ${dimensiones.length}`);
    console.log(JSON.stringify(dimensiones, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
