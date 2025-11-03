const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function actualizarRegla() {
  try {
    console.log('🔄 Actualizando regla COMPLETAR_RAZON_SOCIAL_POR_CUIT...\n');

    // Obtener la regla actual
    const reglaActual = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'COMPLETAR_RAZON_SOCIAL_POR_CUIT' }
    });

    if (!reglaActual) {
      console.log('❌ No se encontró la regla COMPLETAR_RAZON_SOCIAL_POR_CUIT');
      return;
    }

    console.log('📋 Regla actual:');
    console.log(`   Nombre: ${reglaActual.nombre}`);
    console.log(`   Acciones actuales: ${reglaActual.configuracion.acciones.length}`);
    reglaActual.configuracion.acciones.forEach((accion, i) => {
      console.log(`      ${i + 1}. ${accion.operacion} → ${accion.campo}`);
    });
    console.log('');

    // Crear nueva configuración con acción adicional
    const nuevaConfiguracion = {
      ...reglaActual.configuracion,
      acciones: [
        // Mantener la acción original de razonSocialExtraida
        ...reglaActual.configuracion.acciones,
        // Agregar nueva acción para codigoProveedor
        {
          operacion: 'LOOKUP_JSON',
          campo: 'codigoProveedor',
          tipoCampo: 'proveedor',
          campoJSON: 'CUIT',
          valorConsulta: '{cuitExtraido}',
          campoResultado: 'codigo',
          valorDefecto: null
        }
      ]
    };

    // Actualizar la regla
    const reglaActualizada = await prisma.reglas_negocio.update({
      where: { codigo: 'COMPLETAR_RAZON_SOCIAL_POR_CUIT' },
      data: {
        nombre: 'Completar Razón Social y Código de Proveedor por CUIT',
        descripcion: 'Busca el CUIT en el maestro de proveedores y completa la razón social y el código de proveedor',
        configuracion: nuevaConfiguracion,
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla actualizada exitosamente!\n');
    console.log('📋 Nueva configuración:');
    console.log(`   Nombre: ${reglaActualizada.nombre}`);
    console.log(`   Acciones nuevas: ${reglaActualizada.configuracion.acciones.length}`);
    reglaActualizada.configuracion.acciones.forEach((accion, i) => {
      console.log(`      ${i + 1}. ${accion.operacion} → ${accion.campo} (desde ${accion.campoResultado})`);
    });
    console.log('');

    console.log('🎯 Resultado esperado al aplicar la regla:');
    console.log('   - Si encuentra el CUIT en proveedores:');
    console.log('     • razonSocialExtraida = nombre del proveedor');
    console.log('     • codigoProveedor = código del proveedor');
    console.log('');
    console.log('📝 Ejemplo:');
    console.log('   CUIT: 30-58535765-7');
    console.log('   → razonSocialExtraida: "CALZETTA HNOS."');
    console.log('   → codigoProveedor: "0002"');

  } catch (error) {
    console.error('❌ Error al actualizar la regla:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
actualizarRegla()
  .then(() => {
    console.log('\n✨ Actualización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
