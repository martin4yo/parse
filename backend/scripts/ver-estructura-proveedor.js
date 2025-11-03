const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verProveedores() {
  try {
    console.log('🔍 Buscando proveedores de ejemplo...\n');

    const proveedores = await prisma.parametros_maestros.findMany({
      where: {
        tipo_campo: 'proveedor',
        activo: true
      },
      take: 3
    });

    if (proveedores.length === 0) {
      console.log('❌ No hay proveedores en parametros_maestros');
      return;
    }

    console.log(`📋 Encontrados ${proveedores.length} proveedores de ejemplo:\n`);

    proveedores.forEach((prov, index) => {
      console.log(`${index + 1}. PROVEEDOR:`);
      console.log(`   ID: ${prov.id}`);
      console.log(`   Código: ${prov.codigo}`);
      console.log(`   Nombre: ${prov.nombre}`);
      console.log(`   Tipo campo: ${prov.tipo_campo}`);
      console.log(`   Activo: ${prov.activo}`);
      if (prov.parametros_json) {
        console.log(`   JSON: ${JSON.stringify(prov.parametros_json, null, 2)}`);
      }
      console.log('');
    });

    console.log('\n💡 Campos disponibles en parametros_maestros:');
    console.log('   - id (Int)');
    console.log('   - codigo (String) ← Este es el que necesitamos');
    console.log('   - nombre (String)');
    console.log('   - parametros_json.CUIT (String) ← Se usa para buscar');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verProveedores();
