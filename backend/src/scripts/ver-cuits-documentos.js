const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verCuits() {
  try {
    const documentos = await prisma.documentos_procesados.findMany({
      where: {
        estadoProcesamiento: 'completado',
        cuitExtraido: { not: null }
      },
      select: {
        nombreArchivo: true,
        cuitExtraido: true,
        razonSocialExtraida: true
      },
      take: 15
    });

    console.log(`\n📋 Documentos con CUIT (${documentos.length}):\n`);

    documentos.forEach(doc => {
      console.log(`  📄 ${doc.nombreArchivo}`);
      console.log(`     CUIT: ${doc.cuitExtraido}`);
      console.log(`     Razón Social: ${doc.razonSocialExtraida || '(vacío)'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verCuits();
