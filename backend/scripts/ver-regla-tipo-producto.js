const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verRegla() {
  try {
    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'REEMPLAZA_TIPO_PRODUCTO' }
    });

    if (!regla) {
      console.log('❌ No se encontró la regla REEMPLAZA_TIPO_PRODUCTO');
      return;
    }

    console.log('✅ Regla encontrada:\n');
    console.log(`ID: ${regla.id}`);
    console.log(`Código: ${regla.codigo}`);
    console.log(`Nombre: ${regla.nombre}`);
    console.log(`Tipo: ${regla.tipo}`);
    console.log(`Prioridad: ${regla.prioridad}`);
    console.log(`Activa: ${regla.activa}\n`);

    console.log('📋 Configuración completa:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verRegla();
