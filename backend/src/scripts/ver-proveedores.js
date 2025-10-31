const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verProveedores() {
  const proveedores = await prisma.parametros_maestros.findMany({
    where: {
      tipo_campo: 'proveedor',
      activo: true
    },
    take: 10
  });

  console.log(`\n📦 Proveedores encontrados: ${proveedores.length}\n`);

  if (proveedores.length === 0) {
    console.log('⚠️  No hay proveedores registrados en parametros_maestros');
    console.log('💡 La regla de transformación necesita proveedores para funcionar\n');
  } else {
    proveedores.forEach(p => {
      console.log(`  📋 ${p.codigo} - ${p.nombre}`);
      if (p.parametros_json) {
        console.log(`     JSON:`, p.parametros_json);
      }
      console.log('');
    });
  }

  await prisma.$disconnect();
}

verProveedores().catch(console.error);
