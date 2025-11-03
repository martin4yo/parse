const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();
const engine = new BusinessRulesEngine();

async function testearReglaBandejas() {
  try {
    console.log('🧪 Testeando regla de clasificación de Bandejas...\n');

    // Cargar reglas de tipo TRANSFORMACION
    await engine.loadRules('TRANSFORMACION', true);

    console.log(`📋 Reglas cargadas: ${engine.rules.length}`);
    engine.rules.forEach(r => {
      console.log(`   - ${r.nombre} (prioridad: ${r.prioridad})`);
    });
    console.log('');

    // Datos de prueba - simular una línea de producto con bandejas
    const lineaProducto = {
      numero: 1,
      descripcion: 'Bandejas Celusal 24x250 o.c: 57679',
      cantidad: 10,
      precioUnitario: 150.00,
      subtotal: 1500.00,
      tipoProducto: null,
      codigoProducto: null
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
    if (resultado.data.tipoProducto !== lineaProducto.tipoProducto) {
      console.log(`   ✓ tipoProducto: ${lineaProducto.tipoProducto} → "${resultado.data.tipoProducto}"`);
    }
    if (resultado.data.codigoProducto !== lineaProducto.codigoProducto) {
      console.log(`   ✓ codigoProducto: ${lineaProducto.codigoProducto} → "${resultado.data.codigoProducto}"`);
    }

    // Verificar que se aplicó correctamente
    console.log('\n🎯 Validación:');
    if (resultado.data.tipoProducto === 'IN' && resultado.data.codigoProducto === 'BANDE') {
      console.log('   ✅ La regla se aplicó CORRECTAMENTE');
      console.log('   ✅ tipoProducto = "IN" ✓');
      console.log('   ✅ codigoProducto = "BANDE" ✓');
    } else {
      console.log('   ❌ La regla NO se aplicó correctamente');
      console.log(`   ❌ Esperado: tipoProducto="IN", codigoProducto="BANDE"`);
      console.log(`   ❌ Obtenido: tipoProducto="${resultado.data.tipoProducto}", codigoProducto="${resultado.data.codigoProducto}"`);
    }

    // Caso 2: Probar con otro producto (no bandejas)
    console.log('\n\n🧪 Caso 2: Producto sin "Bandeja" en descripción...\n');

    const lineaProducto2 = {
      numero: 2,
      descripcion: 'Papel A4 resma x500 hojas',
      cantidad: 5,
      precioUnitario: 2000.00,
      subtotal: 10000.00,
      tipoProducto: null,
      codigoProducto: null
    };

    console.log('📦 Línea de producto 2 ANTES:');
    console.log(JSON.stringify(lineaProducto2, null, 2));
    console.log('');

    const resultado2 = await engine.applyRules(
      lineaProducto2,
      {},
      {
        tipo: 'TRANSFORMACION',
        logExecution: false
      }
    );

    console.log('✅ Línea de producto 2 DESPUÉS:');
    console.log(JSON.stringify(resultado2.data, null, 2));
    console.log('');

    console.log('🔍 Validación caso 2:');
    if (resultado2.data.tipoProducto === 'IN' && resultado2.data.codigoProducto === 'BANDE') {
      console.log('   ⚠️ La regla de bandejas se aplicó cuando NO debía (no contiene "Bandeja")');
    } else {
      console.log('   ✅ Correcto: la regla de bandejas NO se aplicó (producto no es bandeja)');
      console.log(`   - tipoProducto final: "${resultado2.data.tipoProducto}"`);
      console.log(`   - codigoProducto final: "${resultado2.data.codigoProducto}"`);
    }

    // Caso 3: Variaciones de la palabra "Bandeja"
    console.log('\n\n🧪 Caso 3: Probando variaciones de "Bandeja"...\n');

    const variaciones = [
      'BANDEJAS DE PLASTICO',
      'bandeja de aluminio',
      'Bandeja rectangular',
      'Paquete de bandejas x100'
    ];

    for (const desc of variaciones) {
      const linea = {
        descripcion: desc,
        tipoProducto: null,
        codigoProducto: null
      };

      const res = await engine.applyRules(linea, {}, { tipo: 'TRANSFORMACION', logExecution: false });

      const aplicada = res.data.tipoProducto === 'IN' && res.data.codigoProducto === 'BANDE';
      console.log(`   "${desc}"`);
      console.log(`      → ${aplicada ? '✅ APLICADA' : '❌ NO APLICADA'} (tipo: ${res.data.tipoProducto || 'null'}, código: ${res.data.codigoProducto || 'null'})`);
    }

  } catch (error) {
    console.error('❌ Error en el test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
testearReglaBandejas()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
