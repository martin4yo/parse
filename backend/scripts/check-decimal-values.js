const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDecimalValues() {
  try {
    console.log('\n=== VERIFICANDO VALORES DECIMAL EN rendicion_tarjeta_items ===\n');

    // Obtener registros con valores extremos
    const items = await prisma.$queryRaw`
      SELECT
        id,
        "netoGravado",
        exento,
        "importeImpuestos",
        "importeTotal"
      FROM
        rendicion_tarjeta_items
      ORDER BY
        "importeTotal" DESC NULLS LAST
      LIMIT 20
    `;

    console.log('Top 20 registros por importeTotal:\n');

    for (const item of items) {
      console.log(`ID: ${item.id}`);
      console.log(`  netoGravado: ${item.netoGravado}`);
      console.log(`  exento: ${item.exento}`);
      console.log(`  importeImpuestos: ${item.importeImpuestos}`);
      console.log(`  importeTotal: ${item.importeTotal}`);
      console.log('');
    }

    // Verificar si hay valores extremadamente grandes
    const extremeValues = await prisma.$queryRaw`
      SELECT
        COUNT(*) as count,
        MAX("importeTotal") as max_total,
        MIN("importeTotal") as min_total,
        AVG("importeTotal") as avg_total
      FROM
        rendicion_tarjeta_items
      WHERE
        "importeTotal" IS NOT NULL
    `;

    console.log('Estadísticas de importeTotal:');
    console.log(extremeValues[0]);
    console.log('');

    // Buscar valores fuera de rango de DECIMAL(18,2) estándar
    const outOfRange = await prisma.$queryRaw`
      SELECT
        COUNT(*) as count
      FROM
        rendicion_tarjeta_items
      WHERE
        ABS("importeTotal") > 999999999999999.99
        OR ABS("netoGravado") > 999999999999999.99
        OR ABS(exento) > 999999999999999.99
        OR ABS("importeImpuestos") > 999999999999999.99
    `;

    console.log('Registros con valores fuera de rango DECIMAL(18,2):');
    console.log(outOfRange[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDecimalValues();
