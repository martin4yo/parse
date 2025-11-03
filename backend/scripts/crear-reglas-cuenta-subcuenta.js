const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglasCompletas() {
  try {
    console.log('🚀 Creando reglas de cuenta contable y subcuenta...\n');

    // REGLA 1: Asignar cuenta contable desde codigo_producto
    console.log('📋 PASO 1: Crear regla para asignar cuenta contable desde código de producto\n');

    const regla1Existente = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'ASIGNAR_CUENTA_DESDE_PRODUCTO' }
    });

    if (regla1Existente) {
      await prisma.reglas_negocio.delete({
        where: { codigo: 'ASIGNAR_CUENTA_DESDE_PRODUCTO' }
      });
      console.log('⚠️ Regla anterior eliminada');
    }

    const configuracion1 = {
      descripcion: 'Busca el código de producto en parametros_maestros y obtiene su cuenta contable del JSON',
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
          operacion: 'LOOKUP',
          campo: 'cuentaContable',
          tabla: 'parametros_maestros',
          campoConsulta: 'codigo',
          valorConsulta: '{codigoProducto}',
          campoResultado: 'parametros_json',
          valorDefecto: null
        }
      ],
      stopOnMatch: false
    };

    const regla1 = await prisma.reglas_negocio.create({
      data: {
        id: uuidv4(),
        codigo: 'ASIGNAR_CUENTA_DESDE_PRODUCTO',
        nombre: 'Asignar cuenta contable desde código de producto',
        descripcion: 'Busca la configuración del producto y asigna su cuenta contable',
        tipo: 'TRANSFORMACION',
        prioridad: 45,
        activa: true,
        configuracion: configuracion1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla 1 creada:');
    console.log(`   ID: ${regla1.id}`);
    console.log(`   Código: ${regla1.codigo}`);
    console.log(`   Prioridad: ${regla1.prioridad}`);

    // REGLA 2: Asignar subcuenta si cuenta contable es 3010101
    console.log('\n📋 PASO 2: Crear regla para asignar subcuenta CC001 si cuenta = 3010101\n');

    const regla2Existente = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'ASIGNAR_SUBCUENTA_CC001' }
    });

    if (regla2Existente) {
      await prisma.reglas_negocio.delete({
        where: { codigo: 'ASIGNAR_SUBCUENTA_CC001' }
      });
      console.log('⚠️ Regla anterior eliminada');
    }

    const configuracion2 = {
      descripcion: 'Si la cuenta contable es 3010101, asigna la subcuenta CC001',
      condiciones: [
        {
          campo: 'cuentaContable',
          operador: 'EQUALS',
          valor: '3010101'
        }
      ],
      logicOperator: 'AND',
      transformacionesCampo: [],
      acciones: [
        {
          operacion: 'SET',
          campo: 'subcuenta',
          valor: 'CC001'
        }
      ],
      stopOnMatch: false
    };

    const regla2 = await prisma.reglas_negocio.create({
      data: {
        id: uuidv4(),
        codigo: 'ASIGNAR_SUBCUENTA_CC001',
        nombre: 'Asignar subcuenta CC001 para cuenta 3010101',
        descripcion: 'Si la cuenta contable es 3010101, asigna automáticamente subcuenta CC001',
        tipo: 'TRANSFORMACION',
        prioridad: 48,
        activa: true,
        configuracion: configuracion2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla 2 creada:');
    console.log(`   ID: ${regla2.id}`);
    console.log(`   Código: ${regla2.codigo}`);
    console.log(`   Prioridad: ${regla2.prioridad}`);

    console.log('\n📊 Resumen de reglas creadas:');
    console.log('\n🔄 Flujo de ejecución (por prioridad):');
    console.log('   40. Bandejas → codigoProducto = "BANDE"');
    console.log('   45. Cuenta desde producto → cuentaContable = "3010101"');
    console.log('   48. Subcuenta para 3010101 → subcuenta = "CC001"');

    console.log('\n🎯 Ejemplo completo:');
    console.log('   Entrada: { descripcion: "Bandejas Celusal 24x250" }');
    console.log('   ');
    console.log('   Paso 1 (Prioridad 40):');
    console.log('     Detecta "Bandejas" → codigoProducto = "BANDE"');
    console.log('   ');
    console.log('   Paso 2 (Prioridad 45):');
    console.log('     Busca BANDE en parametros_maestros');
    console.log('     Encuentra { cuentaContable: "3010101" }');
    console.log('     → cuentaContable = "3010101"');
    console.log('   ');
    console.log('   Paso 3 (Prioridad 48):');
    console.log('     Verifica cuentaContable = "3010101"');
    console.log('     → subcuenta = "CC001"');
    console.log('   ');
    console.log('   Resultado final:');
    console.log('     • codigoProducto = "BANDE"');
    console.log('     • cuentaContable = "3010101"');
    console.log('     • subcuenta = "CC001"');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
crearReglasCompletas()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
