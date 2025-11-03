const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();
const engine = new BusinessRulesEngine();

async function testearReglaOrdenCompra() {
  try {
    console.log('🧪 Testeando regla de extracción de Orden de Compra...\n');

    // Cargar reglas de tipo TRANSFORMACION
    await engine.loadRules('TRANSFORMACION', true);

    console.log(`📋 Reglas cargadas: ${engine.rules.length}`);
    engine.rules.forEach(r => {
      console.log(`   - ${r.nombre} (prioridad: ${r.prioridad})`);
    });
    console.log('');

    // Datos de prueba - EXACTAMENTE la frase que proporcionaste
    const lineaProducto = {
      numero: 1,
      descripcion: 'Bandejas Celusal 24x250 o.c: 57679',
      cantidad: 10,
      precioUnitario: 150.00,
      subtotal: 1500.00,
      tipoProducto: null,
      codigoProducto: null,
      tipoOrdenCompra: null,
      ordenCompra: null
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

    if (resultado.data.tipoProducto !== lineaProducto.tipoProducto) {
      console.log(`   ✓ tipoProducto: ${lineaProducto.tipoProducto} → "${resultado.data.tipoProducto}"`);
      cambios.push('tipoProducto');
    }
    if (resultado.data.codigoProducto !== lineaProducto.codigoProducto) {
      console.log(`   ✓ codigoProducto: ${lineaProducto.codigoProducto} → "${resultado.data.codigoProducto}"`);
      cambios.push('codigoProducto');
    }
    if (resultado.data.tipoOrdenCompra !== lineaProducto.tipoOrdenCompra) {
      console.log(`   ✓ tipoOrdenCompra: ${lineaProducto.tipoOrdenCompra} → "${resultado.data.tipoOrdenCompra}"`);
      cambios.push('tipoOrdenCompra');
    }
    if (resultado.data.ordenCompra !== lineaProducto.ordenCompra) {
      console.log(`   ✓ ordenCompra: ${lineaProducto.ordenCompra} → "${resultado.data.ordenCompra}"`);
      cambios.push('ordenCompra');
    }

    // Validación final
    console.log('\n🎯 Validación de reglas aplicadas:');

    // Validar regla de Bandejas
    if (resultado.data.tipoProducto === 'IN' && resultado.data.codigoProducto === 'BANDE') {
      console.log('   ✅ Regla BANDEJAS aplicada correctamente');
      console.log('      - tipoProducto = "IN" ✓');
      console.log('      - codigoProducto = "BANDE" ✓');
    } else {
      console.log('   ❌ Regla BANDEJAS NO aplicada o incorrecta');
    }

    // Validar regla de Orden de Compra
    if (resultado.data.tipoOrdenCompra === 'OC' && resultado.data.ordenCompra === '57679') {
      console.log('   ✅ Regla ORDEN DE COMPRA aplicada correctamente');
      console.log('      - tipoOrdenCompra = "OC" ✓');
      console.log('      - ordenCompra = "57679" ✓');
    } else {
      console.log('   ❌ Regla ORDEN DE COMPRA NO aplicada o incorrecta');
      console.log(`      - Esperado: tipoOrdenCompra="OC", ordenCompra="57679"`);
      console.log(`      - Obtenido: tipoOrdenCompra="${resultado.data.tipoOrdenCompra}", ordenCompra="${resultado.data.ordenCompra}"`);
    }

    // Casos adicionales
    console.log('\n\n🧪 Casos adicionales de prueba...\n');

    const casosPrueba = [
      {
        desc: 'Papel A4 O.C: 12345',
        esperado: { tipo: 'OC', numero: '12345' }
      },
      {
        desc: 'Combustible oc: 99999',
        esperado: { tipo: 'OC', numero: '99999' }
      },
      {
        desc: 'Material sin orden de compra',
        esperado: { tipo: null, numero: null }
      },
      {
        desc: 'Producto o.c.: 88888',
        esperado: { tipo: 'OC', numero: '88888' }
      }
    ];

    for (const caso of casosPrueba) {
      const linea = {
        descripcion: caso.desc,
        tipoOrdenCompra: null,
        ordenCompra: null
      };

      const res = await engine.applyRules(linea, {}, { tipo: 'TRANSFORMACION', logExecution: false });

      const aplicada = res.data.tipoOrdenCompra === caso.esperado.tipo &&
                       res.data.ordenCompra === caso.esperado.numero;

      console.log(`   "${caso.desc}"`);
      console.log(`      → ${aplicada ? '✅' : '❌'} tipo: ${res.data.tipoOrdenCompra || 'null'}, orden: ${res.data.ordenCompra || 'null'}`);
      if (!aplicada) {
        console.log(`         (Esperado: tipo: ${caso.esperado.tipo || 'null'}, orden: ${caso.esperado.numero || 'null'})`);
      }
    }

  } catch (error) {
    console.error('❌ Error en el test:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
testearReglaOrdenCompra()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
