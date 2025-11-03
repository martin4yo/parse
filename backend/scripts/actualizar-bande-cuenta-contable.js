const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function actualizarBANDE() {
  try {
    console.log('🚀 Actualizando producto BANDE con cuenta contable...\n');

    // Buscar el registro actual
    const actual = await prisma.parametros_maestros.findFirst({
      where: {
        codigo: 'BANDE',
        tipo_campo: 'codigo_producto'
      }
    });

    if (!actual) {
      console.log('❌ No se encontró BANDE');
      return;
    }

    console.log('📋 Estado actual:');
    console.log(`   ID: ${actual.id}`);
    console.log(`   Código: ${actual.codigo}`);
    console.log(`   Nombre: ${actual.nombre}`);
    console.log(`   JSON actual: ${JSON.stringify(actual.parametros_json)}`);

    // Actualizar con la configuración completa
    const actualizado = await prisma.parametros_maestros.update({
      where: {
        id: actual.id
      },
      data: {
        parametros_json: {
          cuentaContable: '3010101',
          descripcion: 'Bandejas - Cuenta contable de insumos'
        },
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Producto BANDE actualizado exitosamente!');
    console.log('\n📋 Nuevo estado:');
    console.log(`   ID: ${actualizado.id}`);
    console.log(`   Código: ${actualizado.codigo}`);
    console.log(`   Nombre: ${actualizado.nombre}`);
    console.log(`   JSON actualizado:`);
    console.log(JSON.stringify(actualizado.parametros_json, null, 2));

    console.log('\n🎯 Configuración JSON completa:');
    console.log('   {');
    console.log(`     "cuentaContable": "3010101",`);
    console.log(`     "descripcion": "Bandejas - Cuenta contable de insumos"`);
    console.log('   }');

    console.log('\n💡 Ahora las reglas de negocio pueden usar:');
    console.log('   - LOOKUP_JSON para obtener la cuenta contable');
    console.log('   - Campo a buscar: codigoProducto = "BANDE"');
    console.log('   - Campo a extraer: parametros_json.cuentaContable = "3010101"');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
actualizarBANDE()
  .then(() => {
    console.log('\n✨ Actualización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
