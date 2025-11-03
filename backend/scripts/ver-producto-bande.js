const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verProductoBANDE() {
  try {
    console.log('🔍 Buscando producto BANDE en parametros_maestros...\n');

    const producto = await prisma.parametros_maestros.findFirst({
      where: {
        codigo: 'BANDE',
        tipo_campo: 'tipo_producto'
      }
    });

    if (producto) {
      console.log('✅ Producto BANDE encontrado:');
      console.log(`   ID: ${producto.id}`);
      console.log(`   Código: ${producto.codigo}`);
      console.log(`   Nombre: ${producto.nombre}`);
      console.log(`   Tipo campo: ${producto.tipo_campo}`);
      console.log(`   Activo: ${producto.activo}`);
      console.log(`   JSON actual: ${JSON.stringify(producto.parametros_json, null, 2)}`);
    } else {
      console.log('❌ Producto BANDE NO encontrado');
      console.log('\n💡 Buscando todos los tipos de producto...');

      const todosProductos = await prisma.parametros_maestros.findMany({
        where: {
          tipo_campo: 'tipo_producto',
          activo: true
        }
      });

      console.log(`\n📋 Tipos de producto existentes: ${todosProductos.length}`);
      todosProductos.forEach(p => {
        console.log(`   - ${p.codigo}: ${p.nombre}`);
        if (p.parametros_json) {
          console.log(`     JSON: ${JSON.stringify(p.parametros_json)}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verProductoBANDE();
