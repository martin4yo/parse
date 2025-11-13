const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939'; // Timbo

    // Buscar documentos del tenant
    const documentos = await prisma.documentos_procesados.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        documento_impuestos: true
      }
    });

    console.log(`Documentos encontrados: ${documentos.length}\n`);

    documentos.forEach((doc, idx) => {
      console.log(`${idx + 1}. Documento: ${doc.nombreArchivo}`);
      console.log(`   Impuestos: ${doc.documento_impuestos.length}`);

      doc.documento_impuestos.forEach((imp, impIdx) => {
        console.log(`\n   Impuesto ${impIdx + 1}:`);
        console.log(`     Tipo: "${imp.tipo}" (length: ${imp.tipo.length})`);
        console.log(`     Descripción: "${imp.descripcion}"`);
        console.log(`     Cuenta actual: ${imp.cuentaContable || 'NULL'}`);
        console.log(`     ¿Coincide con "IVA"?: ${imp.tipo === 'IVA' ? 'SÍ' : 'NO'}`);
      });

      console.log('\n' + '-'.repeat(60) + '\n');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
