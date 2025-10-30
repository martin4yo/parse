const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateToGeminiPro() {
  console.log('🔧 Actualizando a gemini-pro...\n');

  const updated = await prisma.ai_provider_configs.updateMany({
    where: { provider: 'gemini' },
    data: { modelo: 'gemini-pro' }
  });

  console.log(`✅ ${updated.count} configuración(es) actualizadas a gemini-pro\n`);

  await prisma.$disconnect();
}

updateToGeminiPro().catch(console.error);
