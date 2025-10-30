const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTipos() {
  const reglas = await prisma.reglas_negocio.findMany({
    select: { tipo: true, nombre: true, codigo: true },
    distinct: ['tipo']
  });

  console.log('\n📋 Tipos de reglas existentes:\n');
  const tipos = [...new Set(reglas.map(r => r.tipo))];
  tipos.forEach(tipo => {
    console.log(`  - ${tipo}`);
  });

  console.log('\n📝 Todas las reglas:\n');
  const todasReglas = await prisma.reglas_negocio.findMany({
    select: { tipo: true, nombre: true, codigo: true, activa: true }
  });

  todasReglas.forEach(r => {
    console.log(`  [${r.activa ? '✓' : '✗'}] ${r.tipo} - ${r.codigo}: ${r.nombre}`);
  });

  await prisma.$disconnect();
}

checkTipos().catch(console.error);
