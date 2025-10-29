const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCuitLookupExcludeZero() {
  console.log('🔧 Modificando regla CUIT_BUSCAR_PROVEEDOR para excluir CUIT "0"...\n');

  try {
    // 1. Obtener la regla actual
    const regla = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_BUSCAR_PROVEEDOR' }
    });

    if (!regla) {
      console.log('❌ No se encontró la regla CUIT_BUSCAR_PROVEEDOR');
      return;
    }

    console.log('📋 Regla actual:');
    console.log(`   ID: ${regla.id}`);
    console.log(`   Nombre: ${regla.nombre}`);
    console.log(`   Prioridad: ${regla.prioridad}`);
    console.log(`   Condiciones actuales: ${JSON.stringify(regla.configuracion.condiciones, null, 2)}`);

    // 2. Verificar si ya tiene la condición para excluir "0"
    const condiciones = regla.configuracion.condiciones;
    const yaExcluyeCero = condiciones.some(c =>
      c.campo === 'resumen.cuit' &&
      c.valor === '0' &&
      c.operador === 'NOT_EQUALS'
    );

    if (yaExcluyeCero) {
      console.log('✅ La regla ya excluye CUIT "0"');
      return;
    }

    // 3. Agregar condición para excluir CUIT "0"
    const nuevasCondiciones = [
      ...condiciones,
      {
        campo: 'resumen.cuit',
        valor: '0',
        operador: 'NOT_EQUALS'
      }
    ];

    const nuevaConfiguracion = {
      ...regla.configuracion,
      condiciones: nuevasCondiciones
    };

    // 4. Actualizar la regla
    await prisma.reglaNegocio.update({
      where: { id: regla.id },
      data: {
        configuracion: nuevaConfiguracion,
        descripcion: 'Busca el CUIT en los proveedores y asigna el código correspondiente (excluye CUIT "0" y "0000000000000")'
      }
    });

    console.log('\n✅ Regla actualizada exitosamente');
    console.log('🔹 Nueva condición agregada:');
    console.log('   campo: resumen.cuit');
    console.log('   valor: "0"');
    console.log('   operador: NOT_EQUALS');

    console.log('\n📋 Condiciones finales:');
    nuevasCondiciones.forEach((condicion, index) => {
      console.log(`   ${index + 1}. ${condicion.campo} ${condicion.operador} ${JSON.stringify(condicion.valor)}`);
    });

    console.log('\n🎯 Resultado: La regla LOOKUP_JSON ahora NO se ejecutará para CUIT "0", permitiendo que las reglas específicas de CUIT cero (prioridades 50 y 60) se ejecuten correctamente.');

  } catch (error) {
    console.error('❌ Error modificando la regla:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la corrección
fixCuitLookupExcludeZero();