const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../services/businessRulesEngine');

const prisma = new PrismaClient();

async function testReglaTimbo() {
  try {
    console.log('\n🧪 TEST: Regla TIMBO (OR logic)\n');

    // Buscar documentos que contengan TIMBO en razón social
    const documentos = await prisma.documentos_procesados.findMany({
      where: {
        razonSocialExtraida: { contains: 'TIMBO' },
        estadoProcesamiento: 'completado'
      },
      take: 3
    });

    console.log(`📋 Documentos con "TIMBO" encontrados: ${documentos.length}\n`);

    const rulesEngine = new BusinessRulesEngine();
    await rulesEngine.loadRules('TRANSFORMACION', true, prisma);

    for (const doc of documentos) {
      console.log(`📄 ${doc.nombreArchivo}`);
      console.log(`   CUIT: ${doc.cuitExtraido}`);
      console.log(`   Razón Social ANTES: "${doc.razonSocialExtraida}"`);

      const ruleResult = await rulesEngine.applyRules(
        doc,
        {},
        {
          tipo: 'TRANSFORMACION',
          contexto: 'TEST',
          logExecution: false
        }
      );

      if (ruleResult.data.razonSocialExtraida !== doc.razonSocialExtraida) {
        console.log(`   ✅ TRANSFORMADO: "${ruleResult.data.razonSocialExtraida}"`);
      } else {
        console.log(`   ℹ️  Sin cambios (no hay provider para este CUIT)`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReglaTimbo();
