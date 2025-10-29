const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function corregirTablaPaso3() {
  try {
    console.log('🔧 Corrigiendo tabla del paso 3 en regla ASIGNAR_CODIGO_DIMENSION_USUARIO...\n');

    // Buscar la regla actual
    const reglaActual = await prisma.reglaNegocio.findFirst({
      where: { codigo: 'ASIGNAR_CODIGO_DIMENSION_USUARIO' }
    });

    if (!reglaActual) {
      console.error('❌ No se encontró la regla ASIGNAR_CODIGO_DIMENSION_USUARIO');
      return;
    }

    console.log('📋 Configuración actual del paso 3:');
    const paso3Actual = reglaActual.configuracion.acciones[0].cadena[2];
    console.log(`   Tabla: ${paso3Actual.tabla}`);
    console.log(`   Campo consulta: ${paso3Actual.campoConsulta}`);
    console.log(`   Campo resultado: ${paso3Actual.campoResultado}`);

    // Actualizar la configuración - corregir el nombre de la tabla del paso 3
    const nuevaConfiguracion = {
      ...reglaActual.configuracion,
      acciones: [
        {
          ...reglaActual.configuracion.acciones[0],
          cadena: [
            reglaActual.configuracion.acciones[0].cadena[0], // Paso 1 sin cambios
            reglaActual.configuracion.acciones[0].cadena[1], // Paso 2 sin cambios
            {
              tabla: 'valorAtributo',  // Cambiar de 'parametros_maestros' a 'valorAtributo'
              campoConsulta: 'id',
              campoResultado: 'codigo',
              descripcion: 'Obtener el código del valor del atributo'
            }
          ]
        }
      ]
    };

    // Actualizar la regla
    const reglaActualizada = await prisma.reglaNegocio.update({
      where: { id: reglaActual.id },
      data: {
        configuracion: nuevaConfiguracion,
        version: { increment: 1 }
      }
    });

    console.log('\n✅ Regla actualizada exitosamente:');
    console.log(`   ID: ${reglaActualizada.id}`);
    console.log(`   Versión: ${reglaActualizada.version}`);

    console.log('\n📋 Nueva configuración del paso 3:');
    const paso3Nuevo = reglaActualizada.configuracion.acciones[0].cadena[2];
    console.log(`   Tabla: ${paso3Nuevo.tabla} ✅`);
    console.log(`   Campo consulta: ${paso3Nuevo.campoConsulta}`);
    console.log(`   Campo resultado: ${paso3Nuevo.campoResultado}`);

    // Verificar con una prueba rápida
    console.log('\n🧪 Verificación rápida con el ID de ejemplo...');
    const valorAtributo = await prisma.valorAtributo.findUnique({
      where: { id: 'cmflegxtz0002f0fi8ubv8hc5' },
      select: {
        codigo: true,
        descripcion: true,
        atributo: {
          select: {
            codigo: true,
            descripcion: true
          }
        }
      }
    });

    if (valorAtributo) {
      console.log(`✅ ValorAtributo encontrado:`);
      console.log(`   Código: ${valorAtributo.codigo}`);
      console.log(`   Descripción: ${valorAtributo.descripcion}`);
      console.log(`   Atributo: ${valorAtributo.atributo.codigo} - ${valorAtributo.atributo.descripcion}`);
      console.log(`\n✅ La regla ahora debería devolver: "${valorAtributo.codigo}"`);
    } else {
      console.log('⚠️ No se encontró el ValorAtributo con ese ID');
    }

  } catch (error) {
    console.error('❌ Error al corregir la regla:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

corregirTablaPaso3()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });