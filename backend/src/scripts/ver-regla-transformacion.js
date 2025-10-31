const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verRegla() {
  const regla = await prisma.reglas_negocio.findFirst({
    where: {
      tipo: 'TRANSFORMACION',
      activa: true
    }
  });

  if (!regla) {
    console.log('❌ No hay reglas de TRANSFORMACION activas');
    await prisma.$disconnect();
    return;
  }

  console.log('\n📋 REGLA DE TRANSFORMACIÓN\n');
  console.log(`Código: ${regla.codigo}`);
  console.log(`Nombre: ${regla.nombre}`);
  console.log(`Descripción: ${regla.descripcion || '-'}`);
  console.log(`Prioridad: ${regla.prioridad}`);
  console.log(`Activa: ${regla.activa}`);
  console.log('\n📐 CONFIGURACIÓN:\n');
  console.log(JSON.stringify(regla.configuracion, null, 2));

  await prisma.$disconnect();
}

verRegla().catch(console.error);
