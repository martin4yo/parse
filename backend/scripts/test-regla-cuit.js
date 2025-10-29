const BusinessRulesEngine = require('../src/services/businessRulesEngine');

async function testReglaCuit() {
  const engine = new BusinessRulesEngine();
  
  console.log('🧪 Iniciando pruebas de la regla CUIT a Proveedor...\n');
  
  // Casos de prueba
  const casosPrueba = [
    {
      nombre: 'CUIT válido existente',
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
      nombre: 'CUIT especial 00000000000 con ARP',
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
      nombre: 'CUIT especial 00000000000 con USD',
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
      nombre: 'CUIT no encontrado',
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
      nombre: 'CUIT nulo',
      resumenData: {
        cuit: null,
        moneda: 'ARP'
      },
      itemData: {},
      resultadoEsperado: {
        proveedorId: undefined // No debería modificarse
      }
    }
  ];

  // Cargar las reglas
  await engine.loadRules('IMPORTACION_DKT', true);
  
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
testReglaCuit()
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