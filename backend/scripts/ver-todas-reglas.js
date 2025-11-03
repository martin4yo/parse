const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verReglas() {
  try {
    const reglas = await prisma.reglas_negocio.findMany({
      orderBy: { prioridad: 'asc' }
    });

    console.log(`📋 Total de reglas: ${reglas.length}\n`);

    if (reglas.length === 0) {
      console.log('❌ No hay reglas en la base de datos.');
      console.log('\n💡 Sugerencia: Ejecuta uno de los scripts de seeds:');
      console.log('   - backend/scripts/insert-regla-cuit-proveedor.js');
      console.log('   - backend/scripts/insert-reglas-cuit-separadas.js');
      console.log('   - backend/scripts/insertar-reglas-lookups.js');
    } else {
      reglas.forEach((regla, index) => {
        console.log(`${index + 1}. ${regla.nombre}`);
        console.log(`   Código: ${regla.codigo}`);
        console.log(`   Tipo: ${regla.tipo}`);
        console.log(`   Activa: ${regla.activa}`);
        console.log(`   Prioridad: ${regla.prioridad}`);

        const config = regla.configuracion;
        if (config.acciones) {
          console.log(`   Acciones:`);
          config.acciones.forEach(accion => {
            console.log(`      - ${accion.operacion} en campo "${accion.campo}"`);
          });
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verReglas();
