const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicateCabeceras() {
  console.log('🔍 === VERIFICANDO CABECERAS DUPLICADAS ===');

  try {
    // Consulta SQL directa para encontrar duplicados en la constraint
    const duplicates = await prisma.$queryRaw`
      SELECT
        "loteId",
        "numeroTarjeta",
        "periodo",
        "tenantId",
        COUNT(*) as count
      FROM "rendicion_tarjeta_cabecera"
      GROUP BY "loteId", "numeroTarjeta", "periodo", "tenantId"
      HAVING COUNT(*) > 1
      ORDER BY count DESC, "loteId", "numeroTarjeta", "periodo"
    `;

    console.log(`Grupos con duplicados encontrados: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log('\n📝 Duplicados que causan el error:');
      for (let i = 0; i < Math.min(duplicates.length, 5); i++) {
        const dup = duplicates[i];
        console.log(`${i + 1}. LoteId: ${dup.loteId}`);
        console.log(`   NumeroTarjeta: ${dup.numeroTarjeta}`);
        console.log(`   Periodo: ${dup.periodo}`);
        console.log(`   TenantId: ${dup.tenantId}`);
        console.log(`   Count: ${dup.count}`);
        console.log('');
      }
    }

    // También verificar últimos lotes por tenant
    const lotes = await prisma.$queryRaw`
      SELECT
        id,
        archivo,
        "tenantId",
        estado,
        "createdAt"
      FROM lotes
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;

    console.log('\nÚltimos 10 lotes:');
    lotes.forEach((lote, index) => {
      const fecha = new Date(lote.createdAt).toLocaleString();
      console.log(`${index + 1}. ${lote.id} - ${lote.archivo} - Tenant: ${lote.tenantId} - Estado: ${lote.estado} - ${fecha}`);
    });

  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateCabeceras();