const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixReglaBandejas() {
  try {
    console.log('🔧 Corrigiendo regla PRODUCTO_BANDEJAS...\n');

    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (!regla) {
      console.log('❌ Regla no encontrada');
      return;
    }

    console.log('📋 Configuración actual:');
    console.log(`   stopOnMatch: ${regla.configuracion.stopOnMatch}`);

    const nuevaConfiguracion = {
      ...regla.configuracion,
      stopOnMatch: false  // ← Cambio crítico: permitir que continúen otras reglas
    };

    const actualizada = await prisma.reglas_negocio.update({
      where: { codigo: 'PRODUCTO_BANDEJAS' },
      data: {
        configuracion: nuevaConfiguracion,
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Regla actualizada!');
    console.log(`   stopOnMatch: ${actualizada.configuracion.stopOnMatch}`);

    console.log('\n🎯 Ahora el flujo funcionará así:');
    console.log('   1. Bandejas (stopOnMatch: false) → Continúa');
    console.log('   2. Cuenta desde producto → Se ejecuta');
    console.log('   3. Subcuenta → Se ejecuta');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixReglaBandejas()
  .then(() => {
    console.log('\n✨ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
