const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const prompt = await prisma.ai_prompts.findFirst({
    where: { clave: 'CLASIFICADOR_DOCUMENTO', tenantId: null }
  });

  if (!prompt) {
    console.log('❌ Prompt CLASIFICADOR_DOCUMENTO no encontrado');
    return;
  }

  console.log('Motor:', prompt.motor);
  console.log('Última actualización:', prompt.updatedAt);

  if (prompt.prompt.includes('LEY 27743')) {
    console.log('✅ Prompt contiene "LEY 27743"');
  } else {
    console.log('❌ Prompt NO contiene "LEY 27743"');
  }

  if (prompt.prompt.includes('FACTURA B - **VERIFICAR PRIMERO**')) {
    console.log('✅ Prompt tiene prioridad para FACTURA_B');
  } else {
    console.log('❌ Prompt NO tiene prioridad para FACTURA_B');
  }

  if (prompt.prompt.includes('PASO 1 - Buscar LEY 27743')) {
    console.log('✅ Prompt tiene proceso paso a paso');
  } else {
    console.log('❌ Prompt NO tiene proceso paso a paso');
  }

  await prisma.$disconnect();
}

check();
