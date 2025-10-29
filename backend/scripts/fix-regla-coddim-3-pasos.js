const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function corregirReglaCodigoDimension() {
  try {
    console.log('🔧 Corrigiendo regla ASIGNAR_CODIGO_DIMENSION_USUARIO con 3 pasos...\n');

    // Buscar la regla actual
    const reglaActual = await prisma.reglaNegocio.findFirst({
      where: { codigo: 'ASIGNAR_CODIGO_DIMENSION_USUARIO' }
    });

    if (!reglaActual) {
      console.error('❌ No se encontró la regla ASIGNAR_CODIGO_DIMENSION_USUARIO');
      return;
    }

    console.log('📋 Configuración actual de la cadena:');
    reglaActual.configuracion.acciones[0].cadena.forEach((paso, index) => {
      console.log(`   Paso ${index + 1}: ${paso.tabla} - ${paso.campoConsulta} → ${paso.campoResultado}`);
    });

    // Actualizar la configuración con 3 pasos
    const nuevaConfiguracion = {
      ...reglaActual.configuracion,
      descripcion: 'numeroTarjeta → userId → valorAtributoId (CODDIM) → codigo',
      acciones: [
        {
          ...reglaActual.configuracion.acciones[0],
          cadena: [
            {
              tabla: 'userTarjetaCredito',
              campoConsulta: 'numeroTarjeta',
              campoResultado: 'userId',
              descripcion: 'Obtener userId de la tarjeta'
            },
            {
              tabla: 'userAtributo',
              campoConsulta: 'userId',
              campoResultado: 'valorAtributoId',
              descripcion: 'Obtener valorAtributoId donde el atributo sea CODDIM',
              filtroAdicional: {
                valorAtributo: {
                  atributo: {
                    codigo: 'CODDIM'
                  }
                }
              }
            },
            {
              tabla: 'valorAtributo',
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
    console.log('\n📋 Nueva configuración de la cadena (3 pasos):');
    reglaActualizada.configuracion.acciones[0].cadena.forEach((paso, index) => {
      console.log(`   Paso ${index + 1}: ${paso.tabla}`);
      console.log(`     Buscar por: ${paso.campoConsulta}`);
      console.log(`     Obtener: ${paso.campoResultado}`);
      console.log(`     Descripción: ${paso.descripcion}`);
    });

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
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            tarjetasCredito: {
              where: { activo: true },
              select: {
                numeroTarjeta: true,
                marcaTarjeta: true
              },
              take: 1
            }
          }
        },
        valorAtributo: {
          select: {
            id: true,
            codigo: true,
            descripcion: true,
            atributo: {
              select: {
                codigo: true,
                descripcion: true
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
        console.log(`\n   Usuario: ${ua.user.nombre} ${ua.user.apellido}`);
        console.log(`   Email: ${ua.user.email}`);
        console.log(`   CODDIM: ${ua.valorAtributo.codigo} - ${ua.valorAtributo.descripcion}`);
        if (ua.user.tarjetasCredito.length > 0) {
          console.log(`   Tarjeta: ${ua.user.tarjetasCredito[0].numeroTarjeta} (${ua.user.tarjetasCredito[0].marcaTarjeta})`);
          console.log(`   ✅ Este usuario puede usar la regla de asignación automática`);
        } else {
          console.log(`   ⚠️ Usuario sin tarjetas registradas`);
        }
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
          select: {
            codigo: true,
            descripcion: true
          },
          take: 10
        }
      }
    });

    if (atributoCODDIM) {
      console.log(`\n📊 Atributo CODDIM encontrado: ${atributoCODDIM.descripcion}`);
      if (atributoCODDIM.valores.length > 0) {
        console.log(`   Valores disponibles (${atributoCODDIM.valores.length}):`);
        atributoCODDIM.valores.forEach(v => {
          console.log(`     - ${v.codigo}: ${v.descripcion}`);
        });
      }
    } else {
      console.log('\n⚠️ No se encontró el atributo CODDIM en el sistema');
      console.log('   Es necesario crear el atributo CODDIM y sus valores antes de usar esta regla');
    }

    // Test de la cadena con una tarjeta de ejemplo
    console.log('\n🧪 Probando la cadena de lookup con una tarjeta de ejemplo...');

    const tarjetaEjemplo = await prisma.userTarjetaCredito.findFirst({
      where: { activo: true },
      include: {
        user: {
          include: {
            userAtributos: {
              where: {
                valorAtributo: {
                  atributo: {
                    codigo: 'CODDIM'
                  }
                }
              },
              include: {
                valorAtributo: true
              }
            }
          }
        }
      }
    });

    if (tarjetaEjemplo) {
      console.log(`\n   Tarjeta: ${tarjetaEjemplo.numeroTarjeta}`);
      console.log(`   Paso 1: numeroTarjeta → userId = ${tarjetaEjemplo.userId}`);

      if (tarjetaEjemplo.user.userAtributos.length > 0) {
        const userAtributo = tarjetaEjemplo.user.userAtributos[0];
        console.log(`   Paso 2: userId → valorAtributoId = ${userAtributo.valorAtributoId}`);
        console.log(`   Paso 3: valorAtributoId → codigo = ${userAtributo.valorAtributo.codigo}`);
        console.log(`   ✅ Resultado final: codigoDimension = "${userAtributo.valorAtributo.codigo}"`);
      } else {
        console.log(`   ⚠️ Usuario sin CODDIM asignado`);
      }
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