const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const impuestos = await prisma.documento_impuestos.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('Últimos 10 impuestos:\n');

    impuestos.forEach((imp, idx) => {
      console.log(`${idx + 1}. Tipo: "${imp.tipo}" (length: ${imp.tipo.length})`);
      console.log(`   Descripción: "${imp.descripcion}"`);
      console.log(`   Cuenta actual: ${imp.cuentaContable || 'NULL'}`);
      console.log(`   Subcuenta: ${imp.subcuenta || 'NULL'}`);
      console.log(`   Bytes del tipo: ${Buffer.from(imp.tipo).toString('hex')}`);
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
