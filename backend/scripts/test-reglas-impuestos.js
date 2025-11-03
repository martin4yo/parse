const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();
const engine = new BusinessRulesEngine();

async function testearReglasImpuestos() {
  try {
    console.log('🧪 Testeando reglas de impuestos...\n');

    // Cargar reglas de tipo TRANSFORMACION
    engine.clearCache();
    await engine.loadRules('TRANSFORMACION', true);

    const reglasImpuestos = engine.rules.filter(r =>
      r.codigo === 'IMPUESTO_IVA_CUENTA' || r.codigo === 'IMPUESTO_IIBB_PBA_CUENTA'
    );

    console.log(`📋 Reglas de impuestos cargadas: ${reglasImpuestos.length}`);
    reglasImpuestos.forEach(r => {
      console.log(`   ${r.prioridad}. ${r.nombre}`);
    });
    console.log('');

    // CASO 1: Impuesto IVA
    console.log('🧪 CASO 1: Impuesto IVA 21%\n');

    const impuestoIVA = {
      tipo: 'IVA 21%',
      descripcion: 'Impuesto al valor agregado',
      alicuota: 21.00,
      baseImponible: 1000.00,
      importe: 210.00,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 INPUT:');
    console.log(JSON.stringify(impuestoIVA, null, 2));

    const resultadoIVA = await engine.applyRules(
      impuestoIVA,
      {},
      { tipo: 'TRANSFORMACION', logExecution: false }
    );

    console.log('\n✅ OUTPUT:');
    console.log(JSON.stringify(resultadoIVA.data, null, 2));

    console.log('\n🎯 Validación:');
    if (resultadoIVA.data.cuentaContable === '1080101' && resultadoIVA.data.subcuenta === 'CC003') {
      console.log('   ✅ IVA: cuenta 1080101 ✓, subcuenta CC003 ✓');
    } else {
      console.log(`   ❌ FALLÓ: cuenta="${resultadoIVA.data.cuentaContable}", subcuenta="${resultadoIVA.data.subcuenta}"`);
    }

    // CASO 2: Impuesto I.V.A. (con puntos)
    console.log('\n\n🧪 CASO 2: Impuesto I.V.A. 10.5%\n');

    const impuestoIVA2 = {
      tipo: 'I.V.A. 10.5%',
      descripcion: 'Impuesto reducido',
      alicuota: 10.5,
      importe: 105.00,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 INPUT:');
    console.log(JSON.stringify(impuestoIVA2, null, 2));

    const resultadoIVA2 = await engine.applyRules(
      impuestoIVA2,
      {},
      { tipo: 'TRANSFORMACION', logExecution: false }
    );

    console.log('\n✅ OUTPUT:');
    console.log(JSON.stringify(resultadoIVA2.data, null, 2));

    console.log('\n🎯 Validación:');
    if (resultadoIVA2.data.cuentaContable === '1080101' && resultadoIVA2.data.subcuenta === 'CC003') {
      console.log('   ✅ I.V.A.: cuenta 1080101 ✓, subcuenta CC003 ✓');
    } else {
      console.log(`   ❌ FALLÓ: cuenta="${resultadoIVA2.data.cuentaContable}", subcuenta="${resultadoIVA2.data.subcuenta}"`);
    }

    // CASO 3: Ingresos Brutos PBA
    console.log('\n\n🧪 CASO 3: Ingresos Brutos Buenos Aires\n');

    const impuestoIIBB = {
      tipo: 'ingresos brutos provincia de buenos aires',
      descripcion: 'Retención provincial',
      alicuota: 3.00,
      importe: 30.00,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 INPUT:');
    console.log(JSON.stringify(impuestoIIBB, null, 2));

    const resultadoIIBB = await engine.applyRules(
      impuestoIIBB,
      {},
      { tipo: 'TRANSFORMACION', logExecution: false }
    );

    console.log('\n✅ OUTPUT:');
    console.log(JSON.stringify(resultadoIIBB.data, null, 2));

    console.log('\n🎯 Validación:');
    if (resultadoIIBB.data.cuentaContable === '1080102' && resultadoIIBB.data.subcuenta === 'CC003') {
      console.log('   ✅ IIBB PBA: cuenta 1080102 ✓, subcuenta CC003 ✓');
    } else {
      console.log(`   ❌ FALLÓ: cuenta="${resultadoIIBB.data.cuentaContable}", subcuenta="${resultadoIIBB.data.subcuenta}"`);
    }

    // CASO 4: IIBB PBA (abreviado)
    console.log('\n\n🧪 CASO 4: IIBB PBA (abreviado)\n');

    const impuestoIIBB2 = {
      tipo: 'IIBB PBA',
      descripcion: 'Retención provincial',
      alicuota: 3.00,
      importe: 30.00,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 INPUT:');
    console.log(JSON.stringify(impuestoIIBB2, null, 2));

    const resultadoIIBB2 = await engine.applyRules(
      impuestoIIBB2,
      {},
      { tipo: 'TRANSFORMACION', logExecution: false }
    );

    console.log('\n✅ OUTPUT:');
    console.log(JSON.stringify(resultadoIIBB2.data, null, 2));

    console.log('\n🎯 Validación:');
    if (resultadoIIBB2.data.cuentaContable === '1080102' && resultadoIIBB2.data.subcuenta === 'CC003') {
      console.log('   ✅ IIBB PBA: cuenta 1080102 ✓, subcuenta CC003 ✓');
    } else {
      console.log(`   ❌ FALLÓ: cuenta="${resultadoIIBB2.data.cuentaContable}", subcuenta="${resultadoIIBB2.data.subcuenta}"`);
    }

    // CASO 5: BS AS
    console.log('\n\n🧪 CASO 5: IIBB BS AS\n');

    const impuestoIIBB3 = {
      tipo: 'IIBB BS AS',
      descripcion: 'Retención provincial',
      alicuota: 3.00,
      importe: 30.00,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 INPUT:');
    console.log(JSON.stringify(impuestoIIBB3, null, 2));

    const resultadoIIBB3 = await engine.applyRules(
      impuestoIIBB3,
      {},
      { tipo: 'TRANSFORMACION', logExecution: false }
    );

    console.log('\n✅ OUTPUT:');
    console.log(JSON.stringify(resultadoIIBB3.data, null, 2));

    console.log('\n🎯 Validación:');
    if (resultadoIIBB3.data.cuentaContable === '1080102' && resultadoIIBB3.data.subcuenta === 'CC003') {
      console.log('   ✅ IIBB BS AS: cuenta 1080102 ✓, subcuenta CC003 ✓');
    } else {
      console.log(`   ❌ FALLÓ: cuenta="${resultadoIIBB3.data.cuentaContable}", subcuenta="${resultadoIIBB3.data.subcuenta}"`);
    }

    // CASO 6: Otro impuesto (no debe aplicar)
    console.log('\n\n🧪 CASO 6: Otro impuesto (no debe aplicar reglas)\n');

    const impuestoOtro = {
      tipo: 'Percepciones SUSS',
      descripcion: 'Seguridad Social',
      alicuota: 2.00,
      importe: 20.00,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 INPUT:');
    console.log(JSON.stringify(impuestoOtro, null, 2));

    const resultadoOtro = await engine.applyRules(
      impuestoOtro,
      {},
      { tipo: 'TRANSFORMACION', logExecution: false }
    );

    console.log('\n✅ OUTPUT:');
    console.log(JSON.stringify(resultadoOtro.data, null, 2));

    console.log('\n🎯 Validación:');
    if (resultadoOtro.data.cuentaContable === null && resultadoOtro.data.subcuenta === null) {
      console.log('   ✅ Correcto: no se aplicaron reglas (impuesto no reconocido)');
    } else {
      console.log(`   ⚠️ Se aplicó alguna regla: cuenta="${resultadoOtro.data.cuentaContable}", subcuenta="${resultadoOtro.data.subcuenta}"`);
    }

    // Resumen final
    console.log('\n\n📊 RESUMEN FINAL:');
    const casos = [
      { nombre: 'IVA 21%', esperado: '1080101/CC003', resultado: resultadoIVA.data },
      { nombre: 'I.V.A. 10.5%', esperado: '1080101/CC003', resultado: resultadoIVA2.data },
      { nombre: 'IIBB Buenos Aires', esperado: '1080102/CC003', resultado: resultadoIIBB.data },
      { nombre: 'IIBB PBA', esperado: '1080102/CC003', resultado: resultadoIIBB2.data },
      { nombre: 'IIBB BS AS', esperado: '1080102/CC003', resultado: resultadoIIBB3.data },
      { nombre: 'Otro impuesto', esperado: 'null/null', resultado: resultadoOtro.data }
    ];

    casos.forEach(caso => {
      const actual = `${caso.resultado.cuentaContable || 'null'}/${caso.resultado.subcuenta || 'null'}`;
      const ok = actual === caso.esperado;
      console.log(`   ${ok ? '✅' : '❌'} ${caso.nombre}: ${actual} ${ok ? '✓' : `(esperado: ${caso.esperado})`}`);
    });

  } catch (error) {
    console.error('❌ Error en el test:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
testearReglasImpuestos()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
