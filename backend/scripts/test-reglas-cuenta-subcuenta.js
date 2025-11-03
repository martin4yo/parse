const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();
const engine = new BusinessRulesEngine();

async function testearReglasCompletas() {
  try {
    console.log('🧪 Testeando reglas de cuenta contable y subcuenta...\n');

    // Cargar reglas de tipo TRANSFORMACION
    await engine.loadRules('TRANSFORMACION', true);

    console.log(`📋 Reglas cargadas: ${engine.rules.length}`);
    const reglasOrdenadas = engine.rules.sort((a, b) => a.prioridad - b.prioridad);
    reglasOrdenadas.forEach(r => {
      console.log(`   ${r.prioridad}. ${r.nombre}`);
    });
    console.log('');

    // Datos de prueba - producto con bandejas
    const lineaProducto = {
      numero: 1,
      descripcion: 'Bandejas Celusal 24x250',
      cantidad: 10,
      precioUnitario: 150.00,
      subtotal: 1500.00,
      tipoProducto: null,
      codigoProducto: null,
      cuentaContable: null,
      subcuenta: null
    };

    console.log('📦 Línea de producto ANTES de aplicar reglas:');
    console.log(JSON.stringify(lineaProducto, null, 2));
    console.log('');

    // Aplicar reglas
    const resultado = await engine.applyRules(
      lineaProducto,
      {},
      {
        tipo: 'TRANSFORMACION',
        logExecution: false
      }
    );

    console.log('✅ Línea de producto DESPUÉS de aplicar reglas:');
    console.log(JSON.stringify(resultado.data, null, 2));
    console.log('');

    console.log('📊 Resumen de ejecución:');
    console.log(`   Reglas aplicadas: ${resultado.rulesApplied}`);
    console.log(`   Duración: ${resultado.duracionMs}ms`);
    console.log('');

    console.log('🔍 Cambios detectados:');
    const cambios = [];

    if (resultado.data.codigoProducto !== lineaProducto.codigoProducto) {
      console.log(`   ✓ codigoProducto: ${lineaProducto.codigoProducto} → "${resultado.data.codigoProducto}"`);
      cambios.push('codigoProducto');
    }

    if (resultado.data.cuentaContable !== lineaProducto.cuentaContable) {
      const valorMostrar = typeof resultado.data.cuentaContable === 'object'
        ? JSON.stringify(resultado.data.cuentaContable)
        : resultado.data.cuentaContable;
      console.log(`   ✓ cuentaContable: ${lineaProducto.cuentaContable} → ${valorMostrar}`);
      cambios.push('cuentaContable');
    }

    if (resultado.data.subcuenta !== lineaProducto.subcuenta) {
      console.log(`   ✓ subcuenta: ${lineaProducto.subcuenta} → "${resultado.data.subcuenta}"`);
      cambios.push('subcuenta');
    }

    console.log('\n🎯 Validación del flujo completo:');

    // Validar paso 1: código de producto
    if (resultado.data.codigoProducto === 'BANDE') {
      console.log('   ✅ PASO 1: codigoProducto = "BANDE" ✓');
    } else {
      console.log(`   ❌ PASO 1 FALLÓ: codigoProducto = "${resultado.data.codigoProducto}"`);
    }

    // Validar paso 2: cuenta contable
    // Si es un objeto, extraer el campo cuentaContable
    let cuentaFinal = resultado.data.cuentaContable;
    if (typeof cuentaFinal === 'object' && cuentaFinal !== null) {
      console.log(`   ⚠️ PASO 2: cuentaContable es un objeto: ${JSON.stringify(cuentaFinal)}`);
      console.log('   🔧 Necesita ajuste: debería extraer solo el campo "cuentaContable" del JSON');
      cuentaFinal = cuentaFinal.cuentaContable || null;
    }

    if (cuentaFinal === '3010101') {
      console.log('   ✅ PASO 2: cuentaContable = "3010101" ✓');
    } else {
      console.log(`   ❌ PASO 2 FALLÓ: cuentaContable = "${cuentaFinal}"`);
    }

    // Validar paso 3: subcuenta
    if (resultado.data.subcuenta === 'CC001') {
      console.log('   ✅ PASO 3: subcuenta = "CC001" ✓');
    } else {
      console.log(`   ❌ PASO 3 FALLÓ: subcuenta = "${resultado.data.subcuenta}"`);
      if (typeof resultado.data.cuentaContable === 'object') {
        console.log('   💡 La subcuenta no se asignó porque cuentaContable es un objeto, no un string');
      }
    }

    // Resultado esperado vs actual
    console.log('\n📋 Resultado esperado vs actual:');
    console.log('   Esperado:');
    console.log('     • codigoProducto: "BANDE"');
    console.log('     • cuentaContable: "3010101"');
    console.log('     • subcuenta: "CC001"');
    console.log('');
    console.log('   Actual:');
    console.log(`     • codigoProducto: "${resultado.data.codigoProducto}"`);
    console.log(`     • cuentaContable: ${typeof resultado.data.cuentaContable === 'object' ? JSON.stringify(resultado.data.cuentaContable) : `"${resultado.data.cuentaContable}"`}`);
    console.log(`     • subcuenta: "${resultado.data.subcuenta}"`);

  } catch (error) {
    console.error('❌ Error en el test:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
testearReglasCompletas()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
