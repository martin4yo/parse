const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixReglaIIBB() {
  try {
    console.log('🔧 Corrigiendo regla IMPUESTO_IIBB_PBA_CUENTA...\n');

    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'IMPUESTO_IIBB_PBA_CUENTA' }
    });

    if (!regla) {
      console.log('❌ Regla no encontrada');
      return;
    }

    console.log('📋 Configuración ANTES:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

    // Nueva configuración corregida
    const nuevaConfiguracion = {
      descripcion: 'Asigna cuenta contable y subcuenta para Ingresos Brutos provincia de Buenos Aires',
      condiciones: [
        {
          campo: 'descripcion',  // ✅ SIN prefijo documento_impuestos
          operador: 'REGEX',
          // ✅ Regex más flexible que captura variaciones
          valor: '(ingresos\\s+brutos|IIBB|perc.*buenos\\s+aires|PBA|BS[\\s\\.]?AS|buenos\\s+aires)'
        }
      ],
      logicOperator: 'OR',
      transformacionesCampo: [],
      acciones: [
        {
          operacion: 'SET',
          campo: 'cuentaContable',
          valor: '1080102'
        },
        {
          operacion: 'SET',
          campo: 'subcuenta',
          valor: 'CC003'
        }
      ],
      stopOnMatch: false
    };

    const actualizada = await prisma.reglas_negocio.update({
      where: { codigo: 'IMPUESTO_IIBB_PBA_CUENTA' },
      data: {
        configuracion: nuevaConfiguracion,
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Regla actualizada!');
    console.log('\n📋 Configuración DESPUÉS:');
    console.log(JSON.stringify(actualizada.configuracion, null, 2));

    console.log('\n🎯 Cambios aplicados:');
    console.log('   1. ✅ Campo cambiado: "documento_impuestos.descripcion" → "descripcion"');
    console.log('   2. ✅ Regex mejorado para capturar más variaciones');
    console.log('');
    console.log('🧪 Ahora detectará:');
    console.log('   ✓ "Perc. Buenos Aires"');
    console.log('   ✓ "Percepción Buenos Aires"');
    console.log('   ✓ "IIBB PBA"');
    console.log('   ✓ "IIBB BS AS"');
    console.log('   ✓ "Ingresos Brutos Buenos Aires"');
    console.log('   ✓ "Buenos Aires" (genérico)');

    // Probar la regex con casos reales
    console.log('\n🧪 Prueba de regex:');
    const regexPrueba = new RegExp('(ingresos\\s+brutos|IIBB|perc.*buenos\\s+aires|PBA|BS[\\s\\.]?AS|buenos\\s+aires)', 'i');

    const casos = [
      'Perc. Buenos Aires',
      'Percepción Buenos Aires',
      'IIBB PBA',
      'IIBB BS AS',
      'Ingresos Brutos Buenos Aires',
      'Buenos Aires',
      'IVA 21%'
    ];

    casos.forEach(caso => {
      const match = regexPrueba.test(caso);
      console.log(`   "${caso}" → ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixReglaIIBB()
  .then(() => {
    console.log('\n✨ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
