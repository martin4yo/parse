const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRegla() {
  try {
    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (!regla) {
      console.log('❌ La regla PRODUCTO_BANDEJAS NO existe en la BD');
    } else {
      console.log('📋 Regla PRODUCTO_BANDEJAS:');
      console.log('   ID:', regla.id);
      console.log('   Tipo:', regla.tipo);
      console.log('   Activa:', regla.activa);
      console.log('   Prioridad:', regla.prioridad);
      console.log('   TenantId:', regla.tenantId || '(NULL - aplica a todos)');
      console.log('');
      console.log('📋 Configuración:');
      console.log(JSON.stringify(regla.configuracion, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRegla();
