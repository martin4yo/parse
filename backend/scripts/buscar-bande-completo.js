const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function buscarBANDE() {
  try {
    console.log('🔍 Buscando BANDE en parametros_maestros (todos los tipos)...\n');

    const resultados = await prisma.parametros_maestros.findMany({
      where: {
        codigo: 'BANDE'
      }
    });

    if (resultados.length > 0) {
      console.log(`✅ Encontrados ${resultados.length} registro(s) con código BANDE:`);
      resultados.forEach((r, i) => {
        console.log(`\n${i + 1}. Registro:`);
        console.log(`   ID: ${r.id}`);
        console.log(`   Código: ${r.codigo}`);
        console.log(`   Nombre: ${r.nombre}`);
        console.log(`   Tipo campo: ${r.tipo_campo}`);
        console.log(`   Activo: ${r.activo}`);
        console.log(`   JSON: ${JSON.stringify(r.parametros_json, null, 2)}`);
      });
    } else {
      console.log('❌ No se encontró ningún registro con código BANDE');
      console.log('\n💡 Necesitamos crear el registro BANDE');
      console.log('\n📋 Tipos de campo existentes en parametros_maestros:');

      const tipos = await prisma.parametros_maestros.groupBy({
        by: ['tipo_campo']
      });

      tipos.forEach(t => {
        console.log(`   - ${t.tipo_campo}`);
      });

      console.log('\n🤔 ¿Qué tipo_campo debería tener BANDE?');
      console.log('   Opciones comunes:');
      console.log('   - "producto" (para productos específicos)');
      console.log('   - "codigo_producto" (para códigos de producto)');
      console.log('   - "tipo_producto" (ya existe IN para insumos)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

buscarBANDE();
