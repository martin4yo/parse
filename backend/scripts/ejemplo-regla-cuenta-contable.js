const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function ejemploReglaCuentaContable() {
  try {
    console.log('📖 EJEMPLO: Regla para asignar cuenta contable automáticamente\n');

    console.log('Este es un EJEMPLO de cómo crear una regla que:');
    console.log('1. Detecte cuando codigoProducto = "BANDE"');
    console.log('2. Busque en parametros_maestros la configuración del producto');
    console.log('3. Extraiga la cuenta contable del JSON');
    console.log('4. Asigne automáticamente cuentaContable = "3010101"\n');

    console.log('📋 Configuración de ejemplo:\n');

    const ejemploConfiguracion = {
      descripcion: 'Asigna cuenta contable según código de producto',
      condiciones: [
        {
          campo: 'codigoProducto',
          operador: 'IS_NOT_EMPTY'
        }
      ],
      logicOperator: 'AND',
      transformacionesCampo: [],
      acciones: [
        {
          operacion: 'LOOKUP_JSON',
          campo: 'cuentaContable',
          tipoCampo: 'codigo_producto',
          campoJSON: 'codigo',  // Buscar por el código
          valorConsulta: '{codigoProducto}',  // Usar el valor de codigoProducto
          campoResultado: 'parametros_json',  // Obtener el objeto JSON completo
          valorDefecto: null
        }
      ],
      stopOnMatch: false
    };

    console.log(JSON.stringify(ejemploConfiguracion, null, 2));

    console.log('\n⚠️ NOTA: Este es solo un EJEMPLO.');
    console.log('   No se ha creado la regla en la base de datos.');
    console.log('\n🎯 Cómo funcionaría:');
    console.log('   Entrada: { codigoProducto: "BANDE" }');
    console.log('   Busca: parametros_maestros donde codigo = "BANDE"');
    console.log('   Encuentra: { "cuentaContable": "3010101", "descripcion": "..." }');
    console.log('   Asigna: cuentaContable = "3010101"');

    console.log('\n💡 Alternativa más directa:');
    console.log('   Puedes buscar directamente en el campo parametros_json.cuentaContable');
    console.log('   usando el valor del campo "codigo" como filtro.');

    console.log('\n🔧 Para crear esta regla ejecutarías:');
    console.log('   const regla = await prisma.reglas_negocio.create({');
    console.log('     data: {');
    console.log('       id: uuidv4(),');
    console.log('       codigo: "ASIGNAR_CUENTA_CONTABLE_POR_PRODUCTO",');
    console.log('       nombre: "Asignar cuenta contable según código de producto",');
    console.log('       tipo: "TRANSFORMACION",');
    console.log('       prioridad: 45,');
    console.log('       activa: true,');
    console.log('       configuracion: { ... },');
    console.log('       createdAt: new Date(),');
    console.log('       updatedAt: new Date()');
    console.log('     }');
    console.log('   });');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ejemploReglaCuentaContable();
