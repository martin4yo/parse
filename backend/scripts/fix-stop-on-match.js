const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStopOnMatch() {
  try {
    console.log('🔧 Corrigiendo stopOnMatch en reglas de IMPORTACION_DKT...\n');

    // Reglas que necesitan cambiar stopOnMatch a false
    const reglasParaCorregir = [
      'CUIT_CEROS_ARP',
      'CUIT_CEROS_USD',
      'CUIT_BUSCAR_PROVEEDOR'
    ];

    for (const codigo of reglasParaCorregir) {
      const regla = await prisma.reglaNegocio.findFirst({
        where: { codigo }
      });

      if (regla) {
        // Actualizar configuración
        const nuevaConfiguracion = {
          ...regla.configuracion,
          stopOnMatch: false
        };

        await prisma.reglaNegocio.update({
          where: { id: regla.id },
          data: {
            configuracion: nuevaConfiguracion,
            version: { increment: 1 }
          }
        });

        console.log(`✅ ${regla.nombre}`);
        console.log(`   stopOnMatch cambiado de true → false`);
        console.log(`   Nueva versión: ${regla.version + 1}\n`);
      }
    }

    // Verificar el estado final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Estado final de las reglas:\n');

    const reglasActualizadas = await prisma.reglaNegocio.findMany({
      where: {
        tipo: 'IMPORTACION_DKT',
        activa: true
      },
      orderBy: { prioridad: 'asc' },
      select: {
        nombre: true,
        codigo: true,
        prioridad: true,
        configuracion: true
      }
    });

    reglasActualizadas.forEach((regla, index) => {
      console.log(`${index + 1}. ${regla.nombre}`);
      console.log(`   Prioridad: ${regla.prioridad}`);
      console.log(`   stopOnMatch: ${regla.configuracion.stopOnMatch || false}`);
    });

    console.log('\n✅ Ahora todas las reglas se ejecutarán en secuencia');
    console.log('   La regla de CODDIM (prioridad 200) se ejecutará después de las otras');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixStopOnMatch()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });