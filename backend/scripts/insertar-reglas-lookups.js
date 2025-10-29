const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglasConLookups() {
  try {
    console.log('Insertando reglas de negocio con lookups dinámicos...');

    // Regla 1: Asignar código de dimensión basado en número de tarjeta
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'DIMENSION_POR_TARJETA' },
      update: {},
      create: {
        codigo: 'DIMENSION_POR_TARJETA',
        nombre: 'Asignar Dimensión por Número de Tarjeta',
        descripcion: 'Asigna automáticamente el código de dimensión basándose en el número de tarjeta del titular',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 1, // Alta prioridad para que se ejecute primero
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.numeroTarjeta',
              operador: 'IS_NOT_EMPTY',
              valor: ''
            }
          ],
          acciones: [
            {
              campo: 'codigoDimension',
              operacion: 'LOOKUP',
              tabla: 'user_tarjetas_credito',
              campoConsulta: 'numeroTarjeta',
              valorConsulta: '{resumen.numeroTarjeta}',
              campoResultado: 'user.codigoDimension',
              valorDefecto: 'DIM_DEFAULT'
            }
          ]
        }
      }
    });

    // Regla 2: Asignar proveedor por defecto basado en tipo de tarjeta
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'PROVEEDOR_POR_TIPO_TARJETA' },
      update: {},
      create: {
        codigo: 'PROVEEDOR_POR_TIPO_TARJETA',
        nombre: 'Proveedor por Tipo de Tarjeta',
        descripcion: 'Asigna proveedor por defecto según el tipo de tarjeta (Corporativa, Personal, etc.)',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 2,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.numeroTarjeta',
              operador: 'IS_NOT_EMPTY',
              valor: ''
            }
          ],
          acciones: [
            // Primero obtener el tipo de tarjeta
            {
              campo: 'tipoTarjetaTemp',
              operacion: 'LOOKUP',
              tabla: 'user_tarjetas_credito',
              campoConsulta: 'numeroTarjeta',
              valorConsulta: '{resumen.numeroTarjeta}',
              campoResultado: 'tipoTarjeta.nombre',
              valorDefecto: 'PERSONAL'
            }
          ]
        }
      }
    });

    // Regla 3: Asignar subcuenta basada en parámetro maestro por tipo de producto
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'SUBCUENTA_POR_PRODUCTO' },
      update: {},
      create: {
        codigo: 'SUBCUENTA_POR_PRODUCTO',
        nombre: 'Subcuenta por Tipo de Producto',
        descripcion: 'Asigna subcuenta desde parámetros maestros basándose en el tipo de producto',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 50, // Después de que se asigne el tipo de producto
        configuracion: {
          condiciones: [
            {
              campo: 'tipoProducto',
              operador: 'IS_NOT_EMPTY',
              valor: ''
            }
          ],
          acciones: [
            {
              campo: 'subcuenta',
              operacion: 'LOOKUP',
              tabla: 'parametros_maestros',
              campoConsulta: 'codigo',
              valorConsulta: '{tipoProducto}',
              campoResultado: 'valor_padre',
              valorDefecto: 'SUB_DEFAULT'
            }
          ]
        }
      }
    });

    // Regla 4: Asignar información del titular de la tarjeta
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'INFO_TITULAR_TARJETA' },
      update: {},
      create: {
        codigo: 'INFO_TITULAR_TARJETA',
        nombre: 'Información del Titular',
        descripcion: 'Agrega información del titular de la tarjeta en observaciones',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 60,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.numeroTarjeta',
              operador: 'IS_NOT_EMPTY',
              valor: ''
            }
          ],
          acciones: [
            // Obtener nombre del titular
            {
              campo: 'titularNombre',
              operacion: 'LOOKUP',
              tabla: 'user_tarjetas_credito',
              campoConsulta: 'numeroTarjeta',
              valorConsulta: '{resumen.numeroTarjeta}',
              campoResultado: 'user.nombre',
              valorDefecto: 'TITULAR DESCONOCIDO'
            },
            // Obtener apellido del titular
            {
              campo: 'titularApellido',
              operacion: 'LOOKUP',
              tabla: 'user_tarjetas_credito',
              campoConsulta: 'numeroTarjeta',
              valorConsulta: '{resumen.numeroTarjeta}',
              campoResultado: 'user.apellido',
              valorDefecto: ''
            },
            // Combinar en observaciones
            {
              campo: 'observaciones',
              operacion: 'APPEND',
              valor: 'TITULAR: {titularNombre} {titularApellido}'
            }
          ]
        }
      }
    });

    // Regla 5: Validación especial para importes altos según perfil de usuario
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'VALIDACION_IMPORTE_PERFIL' },
      update: {},
      create: {
        codigo: 'VALIDACION_IMPORTE_PERFIL',
        nombre: 'Validación por Perfil de Usuario',
        descripcion: 'Aplica validaciones diferentes según el perfil del titular de la tarjeta',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 3,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.importeTransaccion',
              operador: 'GREATER_THAN',
              valor: '10000'
            }
          ],
          acciones: [
            // Obtener rol del usuario
            {
              campo: 'perfilUsuario',
              operacion: 'LOOKUP',
              tabla: 'user_tarjetas_credito',
              campoConsulta: 'numeroTarjeta',
              valorConsulta: '{resumen.numeroTarjeta}',
              campoResultado: 'user.rol',
              valorDefecto: 'EMPLEADO'
            }
          ]
        }
      }
    });

    console.log('✅ Reglas con lookups dinámicos insertadas correctamente');
    
    // Mostrar reglas creadas
    const reglas = await prisma.reglaNegocio.findMany({
      where: {
        codigo: {
          in: [
            'DIMENSION_POR_TARJETA',
            'PROVEEDOR_POR_TIPO_TARJETA', 
            'SUBCUENTA_POR_PRODUCTO',
            'INFO_TITULAR_TARJETA',
            'VALIDACION_IMPORTE_PERFIL'
          ]
        }
      },
      orderBy: { prioridad: 'asc' }
    });
    
    console.log(`\n📋 Reglas con lookups creadas: ${reglas.length}`);
    reglas.forEach(regla => {
      console.log(`  - ${regla.codigo}: ${regla.nombre} (Prioridad: ${regla.prioridad})`);
    });

    console.log('\n💡 Ejemplos de uso:');
    console.log('   📌 Dimensión por Tarjeta: Busca en user_tarjetas_credito el codigoDimension del usuario');
    console.log('   📌 Subcuenta por Producto: Busca en parametros_maestros la subcuenta correspondiente');
    console.log('   📌 Info Titular: Agrega nombre del titular a las observaciones');
    console.log('   📌 Validación por Perfil: Aplica reglas diferentes según el rol del usuario');

  } catch (error) {
    console.error('❌ Error insertando reglas con lookups:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  insertarReglasConLookups();
}

module.exports = { insertarReglasConLookups };