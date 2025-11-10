const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
  const prompts = await prisma.ai_prompts.findMany({
    where: { tenantId: null },
    select: { clave: true, tipo: true, motor: true }
  });

  console.log(`\nPrompts encontrados (${prompts.length}):\n`);
  prompts.forEach(p => {
    console.log(`  ${p.clave.padEnd(30)} | ${p.tipo?.padEnd(25) || 'N/A'.padEnd(25)} | ${p.motor || 'N/A'}`);
  });

  await prisma.$disconnect();
}

list();
