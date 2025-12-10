require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939';

  // Ver varios documentos para entender el patrón
  const docs = await prisma.documentos_procesados.findMany({
    where: { tenantId },
    take: 5,
    select: {
      id: true,
      cuitExtraido: true,
      cuitProveedor: true
    }
  });

  console.log('=== DOCUMENTOS ===');
  docs.forEach((d, i) => {
    console.log((i + 1) + '. cuitExtraido:', d.cuitExtraido, '| cuitProveedor:', d.cuitProveedor);
  });

  await prisma.$disconnect();
}
test();
