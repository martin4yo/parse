const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../services/businessRulesEngine');

const prisma = new PrismaClient();

async function testAplicarReglas() {
  try {
    console.log('\n🧪 TEST: Aplicación de Reglas de Transformación\n');

    // Buscar el documento específico con CUIT de CALZETTA HNOS
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        nombreArchivo: '30585357657_fc_0028-00045226.pdf'
      }
    });

    if (!documento) {
      console.log('❌ No se encontró el documento de prueba');
      return;
    }

    console.log('📄 Documento encontrado:');
    console.log(`   Archivo: ${documento.nombreArchivo}`);
    console.log(`   CUIT: ${documento.cuitExtraido}`);
    console.log(`   Razón Social ANTES: "${documento.razonSocialExtraida || 'null'}"`);
    console.log('');

    // Aplicar reglas
    const rulesEngine = new BusinessRulesEngine();
    await rulesEngine.loadRules('TRANSFORMACION', true, prisma);

    const ruleResult = await rulesEngine.applyRules(
      documento,
      {},
      {
        tipo: 'TRANSFORMACION',
        contexto: 'TEST',
        logExecution: false
      }
    );

    console.log('📐 Reglas aplicadas:', ruleResult.rulesApplied);
    console.log('');

    if (ruleResult.data.razonSocialExtraida !== documento.razonSocialExtraida) {
      console.log('✅ TRANSFORMACIÓN EXITOSA:');
      console.log(`   Razón Social DESPUÉS: "${ruleResult.data.razonSocialExtraida}"`);
      console.log('');
      console.log('🎉 El lookup por CUIT funcionó correctamente!');
    } else {
      console.log('⚠️  No se aplicaron cambios');
      console.log('   Razón Social sigue siendo:', documento.razonSocialExtraida);
    }

  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAplicarReglas();
