const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function limpiarVinculo() {
  console.log('🧹 Eliminando vínculo Empresa Demo → PRODUCTO_BANDEJAS...\n');

  try {
    const resultado = await prisma.tenant_reglas_globales.delete({
      where: {
        id: 'be411acd-c5b8-4a2d-bd8e-518d527dd51a'
      }
    });

    console.log('✅ Vínculo eliminado exitosamente');
    console.log('   ID:', resultado.id);
    console.log('   tenantId:', resultado.tenantId);
    console.log('   reglaGlobalId:', resultado.reglaGlobalId);
    console.log();
    console.log('📊 RESULTADO:');
    console.log('   Ahora Empresa Demo verá la regla PRODUCTO_BANDEJAS como DESACTIVADA');
    console.log('   Y el botón mostrará "Activar" en lugar de "Desactivar"');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

limpiarVinculo();
