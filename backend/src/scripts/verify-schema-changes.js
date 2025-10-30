const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyChanges() {
  console.log('🔍 Verificando cambios en el schema...\n');

  try {
    // Verificar campos en documento_lineas
    const lineasColumns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'documento_lineas'
      AND column_name LIKE '%descuento%'
      ORDER BY ordinal_position
    `;

    console.log('📋 Campos de descuento en documento_lineas:');
    if (lineasColumns.length > 0) {
      lineasColumns.forEach(col => {
        console.log(`   ✅ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ❌ No se encontraron campos de descuento');
    }

    console.log('');

    // Verificar campos en documentos_procesados
    const docsColumns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'documentos_procesados'
      AND column_name LIKE '%descuento%'
      ORDER BY ordinal_position
    `;

    console.log('📄 Campos de descuento en documentos_procesados:');
    if (docsColumns.length > 0) {
      docsColumns.forEach(col => {
        console.log(`   ✅ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ❌ No se encontraron campos de descuento');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyChanges();
