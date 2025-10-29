const BusinessRulesEngine = require('../src/services/businessRulesEngine');

async function demoLookups() {
  console.log('🔍 Demostración de Lookups Dinámicos en Reglas de Negocio\n');
  
  const rulesEngine = new BusinessRulesEngine();
  
  // Simular reglas con lookups
  rulesEngine.rules = [
    {
      id: 'lookup1',
      codigo: 'DIMENSION_POR_TARJETA',
      nombre: 'Asignar Dimensión por Número de Tarjeta',
      configuracion: {
        condiciones: [
          {
            campo: 'resumen.numeroTarjeta',
            operador: 'IS_NOT_EMPTY',
            valor: ''
          }
        ],
        acciones: [
          {
            campo: 'codigoDimension',
            operacion: 'LOOKUP',
            tabla: 'user_tarjetas_credito',
            campoConsulta: 'numeroTarjeta',
            valorConsulta: '{resumen.numeroTarjeta}',
            campoResultado: 'user.codigoDimension',
            valorDefecto: 'DIM_DEFAULT'
          },
          {
            campo: 'titularNombre',
            operacion: 'LOOKUP',
            tabla: 'user_tarjetas_credito',
            campoConsulta: 'numeroTarjeta',
            valorConsulta: '{resumen.numeroTarjeta}',
            campoResultado: 'user.nombre',
            valorDefecto: 'TITULAR DESCONOCIDO'
          }
        ]
      }
    },
    {
      id: 'lookup2',
      codigo: 'SUBCUENTA_POR_PRODUCTO',
      nombre: 'Subcuenta por Tipo de Producto',
      configuracion: {
        condiciones: [
          {
            campo: 'tipoProducto',
            operador: 'IS_NOT_EMPTY',
            valor: ''
          }
        ],
        acciones: [
          {
            campo: 'subcuenta',
            operacion: 'LOOKUP',
            tabla: 'parametros_maestros',
            campoConsulta: 'codigo',
            valorConsulta: '{tipoProducto}',
            campoResultado: 'valor_padre',
            valorDefecto: 'SUB_DEFAULT'
          }
        ]
      }
    }
  ];

  // Casos de prueba con diferentes escenarios
  const casosPrueba = [
    {
      nombre: 'Lookup por Número de Tarjeta',
      descripcion: 'Busca información del titular basándose en el número de tarjeta',
      item: {
        rendicionCabeceraId: 'test1',
        resumenTarjetaId: 'test1',
        codigoDimension: null,
        titularNombre: null
      },
      resumen: {
        numeroTarjeta: '1234567890123456', // Número de tarjeta existente
        descripcionCupon: 'COMPRA EN COMERCIO',
        importeTransaccion: 5000
      }
    },
    {
      nombre: 'Lookup de Parámetros Maestros',
      descripcion: 'Busca subcuenta basándose en tipo de producto',
      item: {
        rendicionCabeceraId: 'test2',
        resumenTarjetaId: 'test2',
        tipoProducto: 'COM', // Código que debería existir en parámetros
        subcuenta: null
      },
      resumen: {
        descripcionCupon: 'YPF COMBUSTIBLE',
        importeTransaccion: 15000
      }
    },
    {
      nombre: 'Lookup con Valores por Defecto',
      descripcion: 'Demuestra el uso de valores por defecto cuando no encuentra datos',
      item: {
        rendicionCabeceraId: 'test3',
        resumenTarjetaId: 'test3',
        codigoDimension: null
      },
      resumen: {
        numeroTarjeta: '9999999999999999', // Número que no existe
        descripcionCupon: 'COMERCIO DESCONOCIDO',
        importeTransaccion: 2500
      }
    }
  ];

  // Probar cada caso
  for (const caso of casosPrueba) {
    console.log(`📄 Caso: ${caso.nombre}`);
    console.log(`   📝 ${caso.descripcion}`);
    console.log(`   📊 Datos: ${JSON.stringify(caso.resumen).substring(0, 100)}...`);
    
    try {
      const resultado = await rulesEngine.applyRules(
        caso.item,
        caso.resumen,
        { logExecution: false, contexto: 'DEMO_LOOKUP' }
      );

      console.log(`   ✅ Reglas aplicadas: ${resultado.rulesApplied}`);
      console.log(`   🎯 Resultado:`);
      
      // Mostrar cambios en el resultado
      const changes = [];
      Object.keys(resultado.data).forEach(key => {
        if (resultado.data[key] !== caso.item[key] && resultado.data[key] !== null) {
          changes.push(`${key}: ${resultado.data[key]}`);
        }
      });
      
      if (changes.length > 0) {
        changes.forEach(change => {
          console.log(`      - ${change}`);
        });
      } else {
        console.log(`      - Sin cambios aplicados`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎯 Demostración de Lookups completada\n');
  
  console.log('📚 Tipos de Lookup Soportados:');
  console.log('   🔹 user_tarjetas_credito: Información de tarjetas y usuarios');
  console.log('   🔹 parametros_maestros: Parámetros de configuración');
  console.log('   🔹 usuarios: Datos de usuarios');
  console.log('   🔹 banco_tipo_tarjeta: Información de bancos y tipos');
  console.log('   🔹 [tabla_custom]: Lookup genérico para cualquier tabla');

  console.log('\n🔧 Sintaxis de Lookup:');
  console.log(`   {
     "campo": "codigoDimension",
     "operacion": "LOOKUP",
     "tabla": "user_tarjetas_credito",
     "campoConsulta": "numeroTarjeta",
     "valorConsulta": "{resumen.numeroTarjeta}",
     "campoResultado": "user.codigoDimension",
     "valorDefecto": "DIM_DEFAULT"
   }`);

  console.log('\n💡 Ejemplos de Uso Real:');
  console.log('   📌 Asignar código de dimensión según el usuario titular');
  console.log('   📌 Determinar límites de gasto según perfil de usuario');
  console.log('   📌 Asignar subcuentas basándose en tipo de producto');
  console.log('   📌 Agregar información del titular en observaciones');
  console.log('   📌 Validaciones específicas por tipo de tarjeta');
}

// Ejecutar demostración
demoLookups().catch(console.error);