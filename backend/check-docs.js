const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Contar documentos por estado
  const total = await prisma.documentos_procesados.count();
  console.log('Total documentos:', total);

  const exportados = await prisma.documentos_procesados.count({
    where: { fechaExportacion: { not: null } }
  });
  console.log('Exportados:', exportados);

  const pendientes = await prisma.documentos_procesados.count({
    where: { fechaExportacion: null }
  });
  console.log('Pendientes (fechaExportacion null):', pendientes);

  // Ver estados de procesamiento
  const porEstado = await prisma.documentos_procesados.groupBy({
    by: ['estadoProcesamiento'],
    _count: true
  });
  console.log('\nPor estado de procesamiento:');
  porEstado.forEach(e => console.log(`  ${e.estadoProcesamiento}: ${e._count}`));

  // Ver algunos documentos
  const docs = await prisma.documentos_procesados.findMany({
    take: 5,
    select: {
      id: true,
      estadoProcesamiento: true,
      fechaExportacion: true,
      tenantId: true
    }
  });
  console.log('\nEjemplo de documentos:');
  docs.forEach(d => console.log(d));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
