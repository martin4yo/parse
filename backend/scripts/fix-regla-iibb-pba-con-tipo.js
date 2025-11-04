const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixReglaIIBBConTipo() {
  try {
    console.log('🔧 Mejorando regla IMPUESTO_IIBB_PBA_CUENTA con verificación de tipo...\n');

    // Nueva configuración con múltiples condiciones
    const nuevaConfiguracion = {
      descripcion: 'Asigna cuenta contable y subcuenta para Ingresos Brutos provincia de Buenos Aires',
      condiciones: [
        {
          campo: 'tipo',
          operador: 'IN',
          valor: 'PERCEPCION,RETENCION,IMPUESTO'  // ✅ Solo se aplica a estos tipos de registros
        },
        {
          campo: 'descripcion',
          operador: 'REGEX',
          valor: '(ingresos\\s+brutos|IIBB|perc.*buenos\\s+aires|PBA|BS[\\s\\.]?AS|buenos\\s+aires)'
        }
      ],
      logicOperator: 'AND',  // ✅ AMBAS condiciones deben cumplirse
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

    console.log('✅ Regla actualizada con verificación de tipo!');
    console.log('\n📋 Nueva configuración:');
    console.log(JSON.stringify(actualizada.configuracion, null, 2));

    console.log('\n🎯 Mejoras aplicadas:');
    console.log('   1. ✅ Condición agregada: tipo IN (PERCEPCION, RETENCION, IMPUESTO)');
    console.log('   2. ✅ Lógica AND: AMBAS condiciones deben cumplirse');
    console.log('   3. ✅ Ahora NO se aplicará a líneas de documento');
    console.log('');
    console.log('🛡️ Protección contra falsos positivos:');
    console.log('   Si una línea tiene "Buenos Aires" en descripción → ❌ NO se aplica (tipo diferente)');
    console.log('   Si un impuesto tiene "Buenos Aires" y tipo PERCEPCION → ✅ SÍ se aplica');

    // Verificar campos de líneas vs impuestos
    console.log('\n📊 Verificación de campos:');

    const doc = await prisma.documentos_procesados.findFirst({
      where: {
        documento_lineas: { some: {} },
        documento_impuestos: { some: {} }
      },
      include: {
        documento_lineas: { take: 1 },
        documento_impuestos: { take: 1 }
      }
    });

    if (doc) {
      console.log('\n   📋 Campos en documento_lineas:');
      if (doc.documento_lineas[0]) {
        Object.keys(doc.documento_lineas[0]).forEach(key => {
          console.log(`      - ${key}: ${doc.documento_lineas[0][key] ? String(doc.documento_lineas[0][key]).substring(0, 30) : 'null'}`);
        });
      }

      console.log('\n   💰 Campos en documento_impuestos:');
      if (doc.documento_impuestos[0]) {
        Object.keys(doc.documento_impuestos[0]).forEach(key => {
          console.log(`      - ${key}: ${doc.documento_impuestos[0][key] ? String(doc.documento_impuestos[0][key]).substring(0, 30) : 'null'}`);
        });
      }

      console.log('\n✨ Observación:');
      console.log('   Ambas tablas tienen campo "tipo", pero con valores diferentes:');
      console.log('   - Líneas: tipo puede ser "IN", "SE", etc. (tipo de producto)');
      console.log('   - Impuestos: tipo es "PERCEPCION", "RETENCION", "IVA", etc. (tipo de impuesto)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixReglaIIBBConTipo()
  .then(() => {
    console.log('\n✨ Mejora completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
