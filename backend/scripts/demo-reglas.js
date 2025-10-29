const BusinessRulesEngine = require('../src/services/businessRulesEngine');

async function demoReglas() {
  console.log('🔧 Demostración del Motor de Reglas de Negocio\n');
  
  const rulesEngine = new BusinessRulesEngine();
  
  // Cargar reglas (simularemos que ya están en BD)
  rulesEngine.rules = [
    {
      id: '1',
      codigo: 'COMBUSTIBLE_YPF',
      nombre: 'Clasificación de Combustibles YPF',
      configuracion: {
        condiciones: [
          {
            campo: 'resumen.descripcionCupon',
            operador: 'CONTAINS',
            valor: 'YPF'
          },
          {
            campo: 'resumen.descripcionCupon',
            operador: 'CONTAINS',
            valor: 'COMBUSTIBLE'
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            campo: 'tipoProducto',
            operacion: 'SET',
            valor: 'COM'
          },
          {
            campo: 'codigoProducto',
            operacion: 'SET',
            valor: '001'
          },
          {
            campo: 'cuentaContable',
            operacion: 'SET',
            valor: '5.1.01.02'
          },
          {
            campo: 'proveedorId',
            operacion: 'SET',
            valor: 'YPF001'
          }
        ]
      }
    },
    {
      id: '2',
      codigo: 'PEAJES_AUTOPISTA',
      nombre: 'Clasificación de Peajes',
      configuracion: {
        condiciones: [
          {
            campo: 'resumen.descripcionCupon',
            operador: 'CONTAINS',
            valor: 'PEAJE'
          }
        ],
        acciones: [
          {
            campo: 'tipoProducto',
            operacion: 'SET',
            valor: 'PEA'
          },
          {
            campo: 'codigoProducto',
            operacion: 'SET',
            valor: '002'
          },
          {
            campo: 'cuentaContable',
            operacion: 'SET',
            valor: '5.1.02.01'
          }
        ]
      }
    }
  ];

  // Casos de prueba
  const casosPrueba = [
    {
      nombre: 'Combustible YPF',
      item: {
        rendicionCabeceraId: 'test1',
        resumenTarjetaId: 'test1',
        tipoProducto: null,
        codigoProducto: null,
        cuentaContable: null,
        proveedorId: null
      },
      resumen: {
        descripcionCupon: 'YPF COMBUSTIBLE - AV. CORRIENTES 1234',
        importeTransaccion: 15000
      }
    },
    {
      nombre: 'Peaje Autopista',
      item: {
        rendicionCabeceraId: 'test2',
        resumenTarjetaId: 'test2',
        tipoProducto: null,
        codigoProducto: null,
        cuentaContable: null
      },
      resumen: {
        descripcionCupon: 'PEAJE AUTOPISTA OESTE',
        importeTransaccion: 850
      }
    },
    {
      nombre: 'Sin coincidencias',
      item: {
        rendicionCabeceraId: 'test3',
        resumenTarjetaId: 'test3',
        tipoProducto: null,
        codigoProducto: null,
        cuentaContable: null
      },
      resumen: {
        descripcionCupon: 'FARMACIA CENTRAL',
        importeTransaccion: 2500
      }
    }
  ];

  // Probar cada caso
  for (const caso of casosPrueba) {
    console.log(`📄 Caso: ${caso.nombre}`);
    console.log(`   Entrada: ${caso.resumen.descripcionCupon}`);
    
    try {
      const resultado = await rulesEngine.applyRules(
        caso.item,
        caso.resumen,
        { logExecution: false, contexto: 'DEMO' }
      );

      console.log(`   ✅ Reglas aplicadas: ${resultado.rulesApplied}`);
      console.log(`   📊 Resultado:`);
      
      if (resultado.data.tipoProducto) {
        console.log(`      - Tipo Producto: ${resultado.data.tipoProducto}`);
      }
      if (resultado.data.codigoProducto) {
        console.log(`      - Código Producto: ${resultado.data.codigoProducto}`);
      }
      if (resultado.data.cuentaContable) {
        console.log(`      - Cuenta Contable: ${resultado.data.cuentaContable}`);
      }
      if (resultado.data.proveedorId) {
        console.log(`      - Proveedor ID: ${resultado.data.proveedorId}`);
      }
      
      if (resultado.rulesApplied === 0) {
        console.log(`      - Sin cambios (ninguna regla aplicó)`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎯 Demostración completada');
  console.log('\n💡 Para usar en producción:');
  console.log('   1. Ejecutar: node scripts/insertar-reglas-ejemplo.js');
  console.log('   2. Importar archivo DKT');
  console.log('   3. Las reglas se aplicarán automáticamente');
}

// Ejecutar demostración
demoReglas().catch(console.error);