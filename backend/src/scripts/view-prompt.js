const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function viewPrompt() {
  const prompt = await prisma.ai_prompts.findFirst({
    where: { clave: 'EXTRACCION_FACTURA_A' }
  });

  if (prompt) {
    console.log('='.repeat(80));
    console.log('PROMPT:', prompt.clave);
    console.log('Motor:', prompt.motor);
    console.log('Tenant:', prompt.tenantId || 'Global');
    console.log('='.repeat(80));
    console.log('\n');
    console.log(prompt.prompt);
    console.log('\n');
    console.log('='.repeat(80));
  } else {
    console.log('Prompt no encontrado');
  }

  await prisma.$disconnect();
}

viewPrompt();
