const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();
const engine = new BusinessRulesEngine();

async function testearRegla() {
  try {
    console.log('🧪 Testeando regla de código de proveedor...\n');

    // Cargar reglas de tipo TRANSFORMACION
    await engine.loadRules('TRANSFORMACION', true);

    console.log(`📋 Reglas cargadas: ${engine.rules.length}\n`);

    // Datos de prueba - simular un documento extraído
    const documentoPrueba = {
      cuitExtraido: '30-58535765-7',
      razonSocialExtraida: 'IND. QUIMICA Y MINERA TIMBO S.A.',
      importeExtraido: 1000.00,
      fechaExtraida: new Date(),
      codigoProveedor: null  // Este campo debería llenarse
    };

    console.log('📄 Documento de prueba ANTES de aplicar reglas:');
    console.log(JSON.stringify(documentoPrueba, null, 2));
    console.log('');

    // Aplicar reglas
    const resultado = await engine.applyRules(
      documentoPrueba,
      {},
      {
        tipo: 'TRANSFORMACION',
        logExecution: false
      }
    );

    console.log('✅ Documento DESPUÉS de aplicar reglas:');
    console.log(JSON.stringify(resultado.data, null, 2));
    console.log('');

    console.log('📊 Resumen de ejecución:');
    console.log(`   Reglas aplicadas: ${resultado.rulesApplied}`);
    console.log(`   Duración: ${resultado.duracionMs}ms`);
    console.log('');

    console.log('🔍 Cambios detectados:');
    if (resultado.data.razonSocialExtraida !== documentoPrueba.razonSocialExtraida) {
      console.log(`   ✓ razonSocialExtraida: "${documentoPrueba.razonSocialExtraida}" → "${resultado.data.razonSocialExtraida}"`);
    }
    if (resultado.data.codigoProveedor !== documentoPrueba.codigoProveedor) {
      console.log(`   ✓ codigoProveedor: ${documentoPrueba.codigoProveedor} → "${resultado.data.codigoProveedor}"`);
    }

    // Verificar que el proveedor existe
    console.log('\n🔍 Verificando proveedor en base de datos:');
    const proveedor = await prisma.parametros_maestros.findFirst({
      where: {
        tipo_campo: 'proveedor',
        parametros_json: {
          path: ['CUIT'],
          equals: '30-58535765-7'
        }
      }
    });

    if (proveedor) {
      console.log(`   ✓ Proveedor encontrado:`);
      console.log(`     - Código: ${proveedor.codigo}`);
      console.log(`     - Nombre: ${proveedor.nombre}`);
      console.log(`     - CUIT: ${proveedor.parametros_json.CUIT}`);
    } else {
      console.log('   ⚠️ Proveedor no encontrado en base de datos');
    }

    // Caso 2: Probar con otro CUIT
    console.log('\n\n🧪 Caso 2: Probando con otro CUIT...\n');

    const documentoPrueba2 = {
      cuitExtraido: '30-70717404-4',
      razonSocialExtraida: 'NOMBRE GENÉRICO',
      importeExtraido: 500.00,
      fechaExtraida: new Date(),
      codigoProveedor: null
    };

    console.log('📄 Documento de prueba 2 ANTES:');
    console.log(JSON.stringify(documentoPrueba2, null, 2));
    console.log('');

    const resultado2 = await engine.applyRules(
      documentoPrueba2,
      {},
      {
        tipo: 'TRANSFORMACION',
        logExecution: false
      }
    );

    console.log('✅ Documento 2 DESPUÉS:');
    console.log(JSON.stringify(resultado2.data, null, 2));
    console.log('');

    console.log('🔍 Cambios detectados:');
    if (resultado2.data.razonSocialExtraida !== documentoPrueba2.razonSocialExtraida) {
      console.log(`   ✓ razonSocialExtraida: "${documentoPrueba2.razonSocialExtraida}" → "${resultado2.data.razonSocialExtraida}"`);
    }
    if (resultado2.data.codigoProveedor !== documentoPrueba2.codigoProveedor) {
      console.log(`   ✓ codigoProveedor: ${documentoPrueba2.codigoProveedor} → "${resultado2.data.codigoProveedor}"`);
    }

  } catch (error) {
    console.error('❌ Error en el test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
testearRegla()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
