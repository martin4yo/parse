const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function corregirReglaCodigoDimension() {
  try {
    console.log('🔧 Corrigiendo regla ASIGNAR_CODIGO_DIMENSION_USUARIO...\n');

    // Buscar la regla actual
    const reglaActual = await prisma.reglaNegocio.findFirst({
      where: { codigo: 'ASIGNAR_CODIGO_DIMENSION_USUARIO' }
    });

    if (!reglaActual) {
      console.error('❌ No se encontró la regla ASIGNAR_CODIGO_DIMENSION_USUARIO');
      return;
    }

    console.log('📋 Configuración actual del segundo paso:');
    console.log(`   campoResultado: ${reglaActual.configuracion.acciones[0].cadena[1].campoResultado}`);

    // Actualizar la configuración
    const nuevaConfiguracion = {
      ...reglaActual.configuracion,
      acciones: [
        {
          ...reglaActual.configuracion.acciones[0],
          cadena: [
            reglaActual.configuracion.acciones[0].cadena[0], // Mantener el primer paso igual
            {
              tabla: 'user_atributos',
              campoConsulta: 'userId',
              campoResultado: 'atributo.CODDIM', // Cambiar a CODDIM
              descripcion: 'Obtener código de dimensión (CODDIM) del usuario'
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
    console.log('\n📋 Nueva configuración del segundo paso:');
    console.log(`   campoResultado: ${reglaActualizada.configuracion.acciones[0].cadena[1].campoResultado}`);

    // Verificar si existen usuarios con atributo CODDIM
    console.log('\n🔍 Verificando usuarios con atributo CODDIM...');

    const usuariosConCODDIM = await prisma.userAtributo.findMany({
      where: {
        valorAtributo: {
          atributo: {
            codigo: 'CODDIM',
            activo: true
          }
        }
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true
          }
        },
        valorAtributo: {
          select: {
            codigo: true,
            descripcion: true,
            atributo: {
              select: {
                codigo: true,
                nombre: true
              }
            }
          }
        }
      },
      take: 5
    });

    if (usuariosConCODDIM.length > 0) {
      console.log(`\n✅ Se encontraron ${usuariosConCODDIM.length} usuarios con CODDIM asignado:`);
      usuariosConCODDIM.forEach(ua => {
        console.log(`   - ${ua.user.nombre} ${ua.user.apellido}: CODDIM = ${ua.valorAtributo.codigo}`);
      });
    } else {
      console.log('\n⚠️ No se encontraron usuarios con el atributo CODDIM asignado');
      console.log('   Es necesario asignar el atributo CODDIM a los usuarios para que la regla funcione');
    }

    // Verificar si existe el atributo CODDIM
    const atributoCODDIM = await prisma.atributo.findFirst({
      where: {
        codigo: 'CODDIM',
        activo: true
      },
      include: {
        valores: {
          where: { activo: true },
          take: 5
        }
      }
    });

    if (atributoCODDIM) {
      console.log(`\n📊 Atributo CODDIM encontrado: ${atributoCODDIM.nombre}`);
      if (atributoCODDIM.valores.length > 0) {
        console.log(`   Valores disponibles: ${atributoCODDIM.valores.map(v => v.codigo).join(', ')}`);
      }
    } else {
      console.log('\n⚠️ No se encontró el atributo CODDIM en el sistema');
      console.log('   Es necesario crear el atributo CODDIM y sus valores antes de usar esta regla');
    }

  } catch (error) {
    console.error('❌ Error al corregir la regla:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
corregirReglaCodigoDimension()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });