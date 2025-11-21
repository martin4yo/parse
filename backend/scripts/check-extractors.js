const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExtractors() {
  // Ver TODOS los prompts y sus tipos
  const todos = await prisma.ai_prompts.findMany({
    select: {
      clave: true,
      nombre: true,
      tipo: true,
      tenantId: true
    },
    orderBy: [
      { tipo: 'asc' },
      { clave: 'asc' }
    ],
    take: 30
  });

  console.log('=== TODOS LOS PROMPTS (primeros 30) ===\n');

  const byTipo = {};
  todos.forEach(p => {
    const tipo = p.tipo || 'null';
    if (!byTipo[tipo]) byTipo[tipo] = [];
    byTipo[tipo].push(p);
  });

  Object.entries(byTipo).forEach(([tipo, prompts]) => {
    console.log(`\n📌 Tipo: ${tipo} (${prompts.length} prompts)`);
    prompts.forEach(p => {
      const tenant = p.tenantId ? '(tenant)' : '(GLOBAL)';
      console.log(`  - ${p.clave} ${tenant}`);
    });
  });

  // Buscar específicamente claves que empiecen con EXTRACCION_
  const extractionPrompts = await prisma.ai_prompts.findMany({
    where: {
      clave: { startsWith: 'EXTRACCION_' }
    },
    select: { clave: true, tipo: true, tenantId: true }
  });

  console.log(`\n\n=== PROMPTS DE EXTRACCION (clave EXTRACCION_*) ===`);
  console.log(`Total: ${extractionPrompts.length}`);
  extractionPrompts.forEach(p => {
    const tenant = p.tenantId || 'GLOBAL';
    console.log(`  - ${p.clave} | tipo: ${p.tipo} | tenant: ${tenant}`);
  });

  // Buscar EXTRACCION_UNIVERSAL
  const universal = extractionPrompts.find(p => p.clave === 'EXTRACCION_UNIVERSAL');
  console.log(`\n\n🎯 EXTRACCION_UNIVERSAL (fallback para "OTRO"):`);
  if (universal) {
    console.log(`  ✅ Existe - Tipo: ${universal.tipo} | Tenant: ${universal.tenantId || 'GLOBAL'}`);
  } else {
    console.log(`  ⚠️  NO EXISTE - El sistema no tiene fallback para tipo "OTRO"`);
  }

  await prisma.$disconnect();
}

checkExtractors().catch(console.error);
