const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();
const engine = new BusinessRulesEngine();

async function testearReglasDebug() {
  try {
    console.log('🧪 Testeando reglas con DEBUG activado...\n');

    // Forzar recarga de reglas
    engine.clearCache();
    await engine.loadRules('TRANSFORMACION', true);

    console.log(`📋 Reglas cargadas: ${engine.rules.length}`);
    const reglasOrdenadas = engine.rules.sort((a, b) => a.prioridad - b.prioridad);
    reglasOrdenadas.forEach(r => {
      console.log(`   ${r.prioridad}. ${r.nombre}`);
      const condiciones = r.configuracion?.condiciones || [];
      const acciones = r.configuracion?.acciones || [];
      console.log(`      Condiciones: ${condiciones.length}, Acciones: ${acciones.length}`);
    });
    console.log('');

    // Ver configuración específica de las reglas relevantes
    const reglaBandejas = engine.rules.find(r => r.codigo === 'PRODUCTO_BANDEJAS');
    const reglaCuenta = engine.rules.find(r => r.codigo === 'ASIGNAR_CUENTA_DESDE_PRODUCTO');
    const reglaSubcuenta = engine.rules.find(r => r.codigo === 'ASIGNAR_SUBCUENTA_CC001');

    if (reglaBandejas) {
      console.log('🔍 REGLA 1 - BANDEJAS:');
      console.log(JSON.stringify(reglaBandejas.configuracion, null, 2));
      console.log('');
    }

    if (reglaCuenta) {
      console.log('🔍 REGLA 2 - CUENTA CONTABLE:');
      console.log(JSON.stringify(reglaCuenta.configuracion, null, 2));
      console.log('');
    }

    if (reglaSubcuenta) {
      console.log('🔍 REGLA 3 - SUBCUENTA:');
      console.log(JSON.stringify(reglaSubcuenta.configuracion, null, 2));
      console.log('');
    }

    // Datos de prueba
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

    console.log('📦 INPUT:');
    console.log(JSON.stringify(lineaProducto, null, 2));
    console.log('');

    // Aplicar reglas CON logging
    const resultado = await engine.applyRules(
      lineaProducto,
      {},
      {
        tipo: 'TRANSFORMACION',
        logExecution: false
      }
    );

    console.log('✅ OUTPUT:');
    console.log(JSON.stringify(resultado.data, null, 2));
    console.log('');

    console.log('📊 Reglas ejecutadas:');
    resultado.executedRules.forEach(r => {
      console.log(`   - ${r.nombre}: ${r.aplicada ? '✅ APLICADA' : '❌ NO APLICADA'}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testearReglasDebug()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
