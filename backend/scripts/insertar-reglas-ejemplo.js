const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglasEjemplo() {
  try {
    console.log('Insertando reglas de negocio de ejemplo...');

    // Regla 1: Combustibles YPF
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'COMBUSTIBLE_YPF' },
      update: {},
      create: {
        codigo: 'COMBUSTIBLE_YPF',
        nombre: 'Clasificación de Combustibles YPF',
        descripcion: 'Asigna automáticamente tipo de producto y cuenta contable para compras de combustible YPF',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 10,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.descripcionCupon',
              operador: 'CONTAINS',
              valor: 'YPF'
            },
            {
              campo: 'resumen.descripcionCupon',
              operador: 'CONTAINS',
              valor: 'COMBUSTIBLE'
            }
          ],
          logicOperator: 'AND',
          acciones: [
            {
              campo: 'tipoProducto',
              operacion: 'SET',
              valor: 'COM'
            },
            {
              campo: 'codigoProducto',
              operacion: 'SET',
              valor: '001'
            },
            {
              campo: 'cuentaContable',
              operacion: 'SET',
              valor: '5.1.01.02'
            },
            {
              campo: 'proveedorId',
              operacion: 'SET',
              valor: 'YPF001'
            }
          ]
        }
      }
    });

    // Regla 2: Peajes
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'PEAJES_AUTOPISTA' },
      update: {},
      create: {
        codigo: 'PEAJES_AUTOPISTA',
        nombre: 'Clasificación de Peajes',
        descripcion: 'Asigna automáticamente tipo de producto para pagos de peajes',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 20,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.descripcionCupon',
              operador: 'CONTAINS',
              valor: 'PEAJE'
            }
          ],
          acciones: [
            {
              campo: 'tipoProducto',
              operacion: 'SET',
              valor: 'PEA'
            },
            {
              campo: 'codigoProducto',
              operacion: 'SET',
              valor: '002'
            },
            {
              campo: 'cuentaContable',
              operacion: 'SET',
              valor: '5.1.02.01'
            }
          ]
        }
      }
    });

    // Regla 3: Estacionamientos
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'ESTACIONAMIENTO' },
      update: {},
      create: {
        codigo: 'ESTACIONAMIENTO',
        nombre: 'Clasificación de Estacionamientos',
        descripcion: 'Asigna automáticamente tipo de producto para pagos de estacionamiento',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 30,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.descripcionCupon',
              operador: 'REGEX',
              valor: '(ESTACION|PARKING|COCHERA)'
            }
          ],
          acciones: [
            {
              campo: 'tipoProducto',
              operacion: 'SET',
              valor: 'EST'
            },
            {
              campo: 'codigoProducto',
              operacion: 'SET',
              valor: '003'
            },
            {
              campo: 'cuentaContable',
              operacion: 'SET',
              valor: '5.1.03.01'
            }
          ]
        }
      }
    });

    // Regla 4: Supermercados (importes altos)
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'SUPERMERCADO_ALTO' },
      update: {},
      create: {
        codigo: 'SUPERMERCADO_ALTO',
        nombre: 'Supermercados - Importes Altos',
        descripcion: 'Requiere validación adicional para compras en supermercados con importe mayor a $50000',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 5,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.descripcionCupon',
              operador: 'REGEX',
              valor: '(COTO|CARREFOUR|JUMBO|DIA)'
            },
            {
              campo: 'resumen.importeTransaccion',
              operador: 'GREATER_THAN',
              valor: '50000'
            }
          ],
          logicOperator: 'AND',
          acciones: [
            {
              campo: 'tipoProducto',
              operacion: 'SET',
              valor: 'ALI'
            },
            {
              campo: 'codigoProducto',
              operacion: 'SET',
              valor: '004'
            },
            {
              campo: 'cuentaContable',
              operacion: 'SET',
              valor: '5.1.04.01'
            },
            {
              campo: 'observaciones',
              operacion: 'SET',
              valor: 'REQUIERE VALIDACION - IMPORTE ALTO'
            }
          ]
        }
      }
    });

    // Regla 5: Restaurantes
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'RESTAURANTES' },
      update: {},
      create: {
        codigo: 'RESTAURANTES',
        nombre: 'Clasificación de Restaurantes',
        descripcion: 'Asigna automáticamente tipo de producto para gastos en restaurantes',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 40,
        configuracion: {
          condiciones: [
            {
              campo: 'resumen.descripcionCupon',
              operador: 'REGEX',
              valor: '(RESTAURANT|REST\\.|PARRILLA|PIZZA|CAFE|BAR)'
            }
          ],
          acciones: [
            {
              campo: 'tipoProducto',
              operacion: 'SET',
              valor: 'GAS'
            },
            {
              campo: 'codigoProducto',
              operacion: 'SET',
              valor: '005'
            },
            {
              campo: 'cuentaContable',
              operacion: 'SET',
              valor: '5.1.05.01'
            }
          ]
        }
      }
    });

    console.log('✅ Reglas de negocio de ejemplo insertadas correctamente');
    
    // Mostrar reglas creadas
    const reglas = await prisma.reglaNegocio.findMany({
      orderBy: { prioridad: 'asc' }
    });
    
    console.log(`\n📋 Total de reglas: ${reglas.length}`);
    reglas.forEach(regla => {
      console.log(`  - ${regla.codigo}: ${regla.nombre} (Prioridad: ${regla.prioridad})`);
    });

  } catch (error) {
    console.error('❌ Error insertando reglas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  insertarReglasEjemplo();
}

module.exports = { insertarReglasEjemplo };