const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function actualizarRegla() {
  try {
    console.log('🔄 Actualizando regla ASIGNAR_CUENTA_DESDE_PRODUCTO...\n');

    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'ASIGNAR_CUENTA_DESDE_PRODUCTO' }
    });

    if (!regla) {
      console.log('❌ Regla no encontrada');
      return;
    }

    console.log('📋 Configuración anterior:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

    // Nueva configuración con campoJSON
    const nuevaConfiguracion = {
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
          campoJSON: 'cuentaContable',  // ← NUEVO: extrae este campo del JSON
          valorDefecto: null
        }
      ],
      stopOnMatch: false
    };

    const actualizada = await prisma.reglas_negocio.update({
      where: { codigo: 'ASIGNAR_CUENTA_DESDE_PRODUCTO' },
      data: {
        configuracion: nuevaConfiguracion,
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Regla actualizada!');
    console.log('\n📋 Nueva configuración:');
    console.log(JSON.stringify(actualizada.configuracion, null, 2));

    console.log('\n🎯 Cambio clave:');
    console.log('   Antes: campoResultado = "parametros_json" (devolvía objeto completo)');
    console.log('   Ahora: campoResultado = "parametros_json" + campoJSON = "cuentaContable"');
    console.log('   Resultado: extrae solo el campo "cuentaContable" del JSON');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

actualizarRegla()
  .then(() => {
    console.log('\n✨ Actualización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
