const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglaCodigoDimension() {
  try {
    console.log('🚀 Insertando regla de asignación de código de dimensión por usuario...\n');

    // Definir la configuración de la regla
    const reglaConfig = {
      codigo: 'ASIGNAR_CODIGO_DIMENSION_USUARIO',
      nombre: '4. Asignar Código Dimensión por Usuario',
      descripcion: 'Busca el código de dimensión del usuario a través de su tarjeta de crédito',
      tipo: 'IMPORTACION_DKT',
      prioridad: 200,
      activa: true,
      configuracion: {
        descripcion: 'numeroTarjeta → userId → código de dimensión del usuario',
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
            campo: 'codigoDimension',
            valorConsulta: '{resumen.numeroTarjeta}',
            cadena: [
              {
                tabla: 'user_tarjetas_credito',
                campoConsulta: 'numeroTarjeta',
                campoResultado: 'userId',
                descripcion: 'Obtener userId de la tarjeta'
              },
              {
                tabla: 'user_atributos',
                campoConsulta: 'userId',
                campoResultado: 'atributo.codigo_dimension',
                descripcion: 'Obtener código de dimensión del usuario'
              }
            ],
            valorDefecto: null
          }
        ],
        stopOnMatch: false
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
    
    // Mostrar la cadena de lookup
    console.log('\n📋 Cadena de lookup configurada:');
    regla.configuracion.acciones[0].cadena.forEach((paso, index) => {
      console.log(`   Paso ${index + 1}: ${paso.tabla}`);
      console.log(`     Buscar por: ${paso.campoConsulta}`);
      console.log(`     Obtener: ${paso.campoResultado}`);
      console.log(`     Descripción: ${paso.descripcion}`);
    });

    // Verificar algunas tarjetas de ejemplo
    console.log('\n🔍 Verificando tarjetas de ejemplo en el sistema:');
    const tarjetasEjemplo = await prisma.userTarjetaCredito.findMany({
      include: {
        user: {
          include: {
            userAtributos: {
              include: {
                valorAtributo: {
                  include: {
                    atributo: true
                  }
                }
              }
            }
          }
        }
      },
      take: 3
    });

    if (tarjetasEjemplo.length > 0) {
      tarjetasEjemplo.forEach(tarjeta => {
        console.log(`   Tarjeta: ${tarjeta.numeroTarjeta}`);
        console.log(`     Usuario: ${tarjeta.user.nombre} ${tarjeta.user.apellido}`);
        
        const codigoDimension = tarjeta.user.userAtributos.find(ua => 
          ua.valorAtributo.atributo.codigo === 'codigo_dimension'
        );
        
        if (codigoDimension) {
          console.log(`     Código Dimensión: ${codigoDimension.valorAtributo.codigo}`);
        } else {
          console.log(`     Código Dimensión: No configurado`);
        }
        console.log('');
      });
    } else {
      console.log('   No se encontraron tarjetas en el sistema para probar');
    }

  } catch (error) {
    console.error('❌ Error al insertar la regla:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
insertarReglaCodigoDimension()
  .then(() => {
    console.log('\n✨ Regla de código de dimensión insertada correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });