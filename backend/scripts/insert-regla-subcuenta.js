const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglaSubcuenta() {
  try {
    console.log('🚀 Insertando regla de asignación de subcuenta por usuario...\n');

    // Definir la configuración de la regla
    const reglaConfig = {
      codigo: 'ASIGNAR_SUBCUENTA_USUARIO',
      nombre: '5. Asignar Subcuenta por Usuario',
      descripcion: 'Busca la subcuenta del usuario a través de su tarjeta de crédito',
      tipo: 'IMPORTACION_DKT',
      prioridad: 210, // Después de la regla de CODDIM (200)
      activa: true,
      configuracion: {
        descripcion: 'numeroTarjeta → userId → subcuenta del usuario',
        condiciones: [
          {
            campo: 'resumen.numeroTarjeta',
            operador: 'IS_NOT_NULL',
            valor: null
          },
          {
            campo: 'resumen.numeroTarjeta',
            operador: 'IS_NOT_EMPTY',
            valor: null
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            operacion: 'LOOKUP_CHAIN',
            campo: 'subcuenta',  // Campo destino en rendicionTarjetaItem
            valorConsulta: '{resumen.numeroTarjeta}',
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
                descripcion: 'Obtener valorAtributoId donde el atributo sea SUBCUE',
                filtroAdicional: {
                  valorAtributo: {
                    atributo: {
                      codigo: 'SUBCUE'
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
            ],
            valorDefecto: null
          }
        ],
        stopOnMatch: false  // Continuar con otras reglas
      }
    };

    // Eliminar regla existente si existe
    await prisma.reglaNegocio.deleteMany({
      where: { codigo: reglaConfig.codigo }
    });

    // Crear la nueva regla
    const regla = await prisma.reglaNegocio.create({
      data: {
        codigo: reglaConfig.codigo,
        nombre: reglaConfig.nombre,
        descripcion: reglaConfig.descripcion,
        tipo: reglaConfig.tipo,
        prioridad: reglaConfig.prioridad,
        activa: reglaConfig.activa,
        configuracion: reglaConfig.configuracion
      }
    });

    console.log('✅ Regla creada exitosamente:');
    console.log(`   ID: ${regla.id}`);
    console.log(`   Código: ${regla.codigo}`);
    console.log(`   Nombre: ${regla.nombre}`);
    console.log(`   Prioridad: ${regla.prioridad}`);
    console.log(`   Campo destino: subcuenta`);

    // Mostrar la cadena de lookup
    console.log('\n📋 Cadena de lookup configurada:');
    regla.configuracion.acciones[0].cadena.forEach((paso, index) => {
      console.log(`   Paso ${index + 1}: ${paso.tabla}`);
      console.log(`     Buscar por: ${paso.campoConsulta}`);
      console.log(`     Obtener: ${paso.campoResultado}`);
      console.log(`     Descripción: ${paso.descripcion}`);
    });

    // Verificar si existe el atributo SUBCUE
    console.log('\n🔍 Verificando atributo SUBCUE en el sistema...');

    const atributoSUBCUE = await prisma.atributo.findFirst({
      where: {
        codigo: 'SUBCUE',
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

    if (atributoSUBCUE) {
      console.log(`✅ Atributo SUBCUE encontrado: ${atributoSUBCUE.descripcion}`);
      if (atributoSUBCUE.valores.length > 0) {
        console.log(`   Valores disponibles (mostrando hasta 10):`)
        atributoSUBCUE.valores.forEach(v => {
          console.log(`     - ${v.codigo}: ${v.descripcion}`);
        });
      }
    } else {
      console.log('⚠️ No se encontró el atributo SUBCUE en el sistema');
      console.log('   Es necesario crear el atributo SUBCUE y sus valores');
    }

    // Verificar usuarios con SUBCUE asignado
    console.log('\n🔍 Verificando usuarios con atributo SUBCUE...');

    const usuariosConSUBCUE = await prisma.userAtributo.findMany({
      where: {
        valorAtributo: {
          atributo: {
            codigo: 'SUBCUE',
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
            descripcion: true
          }
        }
      },
      take: 5
    });

    if (usuariosConSUBCUE.length > 0) {
      console.log(`\n✅ Se encontraron ${usuariosConSUBCUE.length} usuarios con SUBCUE asignado:`);
      usuariosConSUBCUE.forEach(ua => {
        console.log(`\n   Usuario: ${ua.user.nombre} ${ua.user.apellido}`);
        console.log(`   Email: ${ua.user.email}`);
        console.log(`   SUBCUE: ${ua.valorAtributo.codigo} - ${ua.valorAtributo.descripcion}`);
        if (ua.user.tarjetasCredito.length > 0) {
          console.log(`   Tarjeta: ${ua.user.tarjetasCredito[0].numeroTarjeta}`);
          console.log(`   ✅ Este usuario puede usar la regla de asignación automática`);
        } else {
          console.log(`   ⚠️ Usuario sin tarjetas registradas`);
        }
      });
    } else {
      console.log('\n⚠️ No se encontraron usuarios con el atributo SUBCUE asignado');
      console.log('   Es necesario asignar el atributo SUBCUE a los usuarios para que la regla funcione');
    }

    // Verificar que no haya conflicto con otras reglas
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen de reglas de IMPORTACION_DKT:');

    const todasLasReglas = await prisma.reglaNegocio.findMany({
      where: {
        tipo: 'IMPORTACION_DKT',
        activa: true
      },
      orderBy: { prioridad: 'asc' },
      select: {
        nombre: true,
        prioridad: true,
        configuracion: true
      }
    });

    todasLasReglas.forEach((r, i) => {
      const campos = r.configuracion.acciones?.map(a => a.campo).join(', ') || 'N/A';
      console.log(`${i + 1}. [Prioridad ${r.prioridad}] ${r.nombre}`);
      console.log(`   Campos que modifica: ${campos}`);
    });

    console.log('\n✅ La nueva regla de SUBCUE se ejecutará después de la regla de CODDIM');
    console.log('   Ambas asignarán sus valores correspondientes sin conflicto');

    // Test de ejemplo con una tarjeta
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
                    codigo: 'SUBCUE'
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

    if (tarjetaEjemplo && tarjetaEjemplo.user.userAtributos.length > 0) {
      const userAtributo = tarjetaEjemplo.user.userAtributos[0];
      console.log(`\n   Tarjeta: ${tarjetaEjemplo.numeroTarjeta}`);
      console.log(`   Paso 1: numeroTarjeta → userId = ${tarjetaEjemplo.userId}`);
      console.log(`   Paso 2: userId → valorAtributoId = ${userAtributo.valorAtributoId}`);
      console.log(`   Paso 3: valorAtributoId → codigo = ${userAtributo.valorAtributo.codigo}`);
      console.log(`   ✅ Resultado final: subcuenta = "${userAtributo.valorAtributo.codigo}"`);
    } else {
      console.log('   No se encontró ninguna tarjeta con usuario que tenga SUBCUE asignado');
    }

  } catch (error) {
    console.error('❌ Error al insertar la regla:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
insertarReglaSubcuenta()
  .then(() => {
    console.log('\n✨ Regla de subcuenta insertada correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });