const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSchemaGeneration() {
  try {
    const tableName = 'rendicion_tarjeta_items';

    console.log('\n=== TEST: Generación de Schema ===\n');
    console.log(`Tabla: ${tableName}\n`);

    // Obtener schema real desde information_schema
    const schemaInfo = await prisma.$queryRaw`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM
        information_schema.columns
      WHERE
        table_schema = 'public'
        AND table_name = ${tableName}
      ORDER BY
        ordinal_position
    `;

    console.log('Columnas obtenidas de information_schema:\n');

    for (const col of schemaInfo) {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}`);
    }

    console.log('\n=== Verificación de columnas específicas ===\n');

    const specificCols = ['resumenTarjetaId', 'importeTotal', 'tenantId', 'cargaManual'];

    for (const colName of specificCols) {
      const col = schemaInfo.find(c => c.column_name === colName);
      if (col) {
        console.log(`${colName}:`);
        console.log(`  data_type: ${col.data_type}`);
        console.log(`  is_nullable: ${col.is_nullable}`);
        console.log(`  numeric_precision: ${col.numeric_precision}`);
        console.log(`  numeric_scale: ${col.numeric_scale}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSchemaGeneration();
