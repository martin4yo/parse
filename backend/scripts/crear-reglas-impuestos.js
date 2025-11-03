const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglasImpuestos() {
  try {
    console.log('🚀 Creando reglas para impuestos...\n');

    // REGLA 1: IVA
    console.log('📋 PASO 1: Crear regla para IVA\n');

    const regla1Existente = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'IMPUESTO_IVA_CUENTA' }
    });

    if (regla1Existente) {
      await prisma.reglas_negocio.delete({
        where: { codigo: 'IMPUESTO_IVA_CUENTA' }
      });
      console.log('⚠️ Regla anterior IVA eliminada');
    }

    const configuracion1 = {
      descripcion: 'Asigna cuenta contable y subcuenta para impuesto IVA',
      condiciones: [
        {
          campo: 'tipo',
          operador: 'REGEX',
          valor: '(?:^|\\s)(IVA|I\\.V\\.A\\.)(?:\\s|$)'
        }
      ],
      logicOperator: 'OR',
      transformacionesCampo: [],
      acciones: [
        {
          operacion: 'SET',
          campo: 'cuentaContable',
          valor: '1080101'
        },
        {
          operacion: 'SET',
          campo: 'subcuenta',
          valor: 'CC003'
        }
      ],
      stopOnMatch: false
    };

    const regla1 = await prisma.reglas_negocio.create({
      data: {
        id: uuidv4(),
        codigo: 'IMPUESTO_IVA_CUENTA',
        nombre: 'Asignar cuenta contable para IVA',
        descripcion: 'Detecta impuesto IVA o I.V.A. y asigna cuenta 1080101 y subcuenta CC003',
        tipo: 'TRANSFORMACION',
        prioridad: 60,
        activa: true,
        configuracion: configuracion1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla 1 - IVA creada:');
    console.log(`   ID: ${regla1.id}`);
    console.log(`   Código: ${regla1.codigo}`);
    console.log(`   Prioridad: ${regla1.prioridad}`);
    console.log(`   Detecta: "IVA" o "I.V.A."`);
    console.log(`   Asigna: cuentaContable = "1080101", subcuenta = "CC003"`);

    // REGLA 2: Ingresos Brutos PBA
    console.log('\n📋 PASO 2: Crear regla para Ingresos Brutos PBA\n');

    const regla2Existente = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'IMPUESTO_IIBB_PBA_CUENTA' }
    });

    if (regla2Existente) {
      await prisma.reglas_negocio.delete({
        where: { codigo: 'IMPUESTO_IIBB_PBA_CUENTA' }
      });
      console.log('⚠️ Regla anterior IIBB eliminada');
    }

    const configuracion2 = {
      descripcion: 'Asigna cuenta contable y subcuenta para Ingresos Brutos provincia de Buenos Aires',
      condiciones: [
        {
          campo: 'tipo',
          operador: 'REGEX',
          valor: 'ingresos\\s+brutos.*buenos\\s+aires|PBA|BS\\s*AS'
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

    const regla2 = await prisma.reglas_negocio.create({
      data: {
        id: uuidv4(),
        codigo: 'IMPUESTO_IIBB_PBA_CUENTA',
        nombre: 'Asignar cuenta contable para IIBB PBA',
        descripcion: 'Detecta Ingresos Brutos Buenos Aires (PBA, BS AS) y asigna cuenta 1080102 y subcuenta CC003',
        tipo: 'TRANSFORMACION',
        prioridad: 61,
        activa: true,
        configuracion: configuracion2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla 2 - IIBB PBA creada:');
    console.log(`   ID: ${regla2.id}`);
    console.log(`   Código: ${regla2.codigo}`);
    console.log(`   Prioridad: ${regla2.prioridad}`);
    console.log(`   Detecta: "ingresos brutos...buenos aires", "PBA", "BS AS"`);
    console.log(`   Asigna: cuentaContable = "1080102", subcuenta = "CC003"`);

    console.log('\n📊 Resumen de reglas creadas:');
    console.log('\n🔄 Aplicación de reglas en impuestos:');
    console.log('   60. IVA → cuenta 1080101, subcuenta CC003');
    console.log('   61. IIBB PBA → cuenta 1080102, subcuenta CC003');

    console.log('\n🎯 Ejemplos de detección:');
    console.log('\n   IVA:');
    console.log('     • tipo: "IVA 21%" ✓');
    console.log('     • tipo: "I.V.A." ✓');
    console.log('     • tipo: "IVA" ✓');
    console.log('\n   Ingresos Brutos PBA:');
    console.log('     • tipo: "ingresos brutos provincia de buenos aires" ✓');
    console.log('     • tipo: "IIBB PBA" ✓');
    console.log('     • tipo: "IIBB BS AS" ✓');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
crearReglasImpuestos()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
