const BusinessRulesEngine = require('../src/services/businessRulesEngine');

async function testReglasCuitSeparadas() {
  const engine = new BusinessRulesEngine();
  
  console.log('🧪 Probando las 3 reglas CUIT separadas...\n');
  
  // Casos de prueba
  const casosPrueba = [
    {
      nombre: 'Regla 1: CUIT válido existente (30707586938)',
      resumenData: {
        cuit: '30707586938',
        moneda: 'ARP'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: '0001' // A.E.D.R.O.S
      }
    },
    {
      nombre: 'Regla 2: CUIT 00000000000 con ARP',
      resumenData: {
        cuit: '00000000000',
        moneda: 'ARP'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: '9994'
      }
    },
    {
      nombre: 'Regla 2: CUIT 00000000000 con ARS',
      resumenData: {
        cuit: '00000000000',
        moneda: 'ARS'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: '9994'
      }
    },
    {
      nombre: 'Regla 3: CUIT 00000000000 con USD',
      resumenData: {
        cuit: '00000000000',
        moneda: 'USD'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: '9995'
      }
    },
    {
      nombre: 'Sin regla: CUIT no encontrado (99999999999)',
      resumenData: {
        cuit: '99999999999',
        moneda: 'ARP'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: null
      }
    },
    {
      nombre: 'Sin regla: CUIT nulo',
      resumenData: {
        cuit: null,
        moneda: 'ARP'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: undefined // No debería modificarse
      }
    },
    {
      nombre: 'Sin regla: CUIT 00000000000 con moneda EUR',
      resumenData: {
        cuit: '00000000000',
        moneda: 'EUR'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: undefined // No hay regla para EUR
      }
    }
  ];

  // Cargar las reglas
  console.log('📚 Cargando reglas...');
  await engine.loadRules('IMPORTACION_DKT', true);
  console.log(`✅ ${engine.rules.length} reglas cargadas\n`);
  
  // Mostrar las reglas cargadas
  console.log('📋 Reglas activas:');
  engine.rules.forEach(r => {
    console.log(`   ${r.prioridad}. ${r.nombre} (${r.codigo})`);
  });
  console.log('');
  
  let exitosos = 0;
  let fallidos = 0;
  
  for (const caso of casosPrueba) {
    console.log(`📝 Probando: ${caso.nombre}`);
    console.log(`   Input: CUIT=${caso.resumenData.cuit}, Moneda=${caso.resumenData.moneda}`);
    
    try {
      // Aplicar las reglas
      const resultado = await engine.applyRules(
        caso.itemData,
        caso.resumenData,
        { logExecution: false }
      );
      
      // Verificar resultado
      const proveedorIdObtenido = resultado.data.proveedorId;
      const proveedorIdEsperado = caso.resultadoEsperado.proveedorId;
      
      // Mostrar qué reglas se aplicaron
      if (resultado.executedRules && resultado.executedRules.length > 0) {
        console.log(`   Reglas aplicadas: ${resultado.executedRules.map(r => r.nombre).join(', ')}`);
      } else {
        console.log(`   Reglas aplicadas: Ninguna`);
      }
      
      if (proveedorIdObtenido === proveedorIdEsperado) {
        console.log(`   ✅ EXITOSO: proveedorId="${proveedorIdObtenido}"`);
        exitosos++;
      } else {
        console.log(`   ❌ FALLIDO: Esperado="${proveedorIdEsperado}", Obtenido="${proveedorIdObtenido}"`);
        fallidos++;
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      fallidos++;
    }
    
    console.log('');
  }
  
  // Resumen
  console.log('📊 Resumen de pruebas:');
  console.log(`   ✅ Exitosos: ${exitosos}`);
  console.log(`   ❌ Fallidos: ${fallidos}`);
  console.log(`   📋 Total: ${casosPrueba.length}`);
  
  return fallidos === 0;
}

// Ejecutar pruebas
testReglasCuitSeparadas()
  .then(exito => {
    if (exito) {
      console.log('\n✨ Todas las pruebas pasaron exitosamente');
      process.exit(0);
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Error en las pruebas:', error);
    process.exit(1);
  });