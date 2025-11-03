const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTipoReglaCuit() {
  try {
    console.log('🔧 Corrigiendo tipo de regla COMPLETAR_RAZON_SOCIAL_POR_CUIT...\n');

    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'COMPLETAR_RAZON_SOCIAL_POR_CUIT' }
    });

    if (!regla) {
      console.log('❌ Regla no encontrada');
      return;
    }

    console.log('📋 Configuración actual:');
    console.log(`   Tipo: ${regla.tipo}`);
    console.log(`   Nombre: ${regla.nombre}`);

    const actualizada = await prisma.reglas_negocio.update({
      where: { codigo: 'COMPLETAR_RAZON_SOCIAL_POR_CUIT' },
      data: {
        tipo: 'TRANSFORMACION_DOCUMENTO',
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Regla actualizada!');
    console.log(`   Tipo: ${actualizada.tipo}`);

    console.log('\n🎯 Ahora la regla se aplicará correctamente al documento principal');
    console.log('   Esta regla modifica campos del documento (razónSocial, codigoProveedor)');
    console.log('   Por eso debe ser tipo TRANSFORMACION_DOCUMENTO');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixTipoReglaCuit()
  .then(() => {
    console.log('\n✨ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
