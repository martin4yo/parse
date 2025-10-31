const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const prompt = await prisma.ai_prompts.findFirst({
    where: { clave: 'EXTRACCION_FACTURA_A' }
  });

  const lines = prompt.prompt.split('\n');
  const startIdx = lines.findIndex(l => l.includes('🚨 REGLAS ABSOLUTAS'));
  const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('netoGravado'));

  console.log('='.repeat(80));
  console.log('SECCIÓN DE RAZÓN SOCIAL ACTUALIZADA:');
  console.log('='.repeat(80));
  console.log(lines.slice(startIdx, endIdx).join('\n'));
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

verify();
