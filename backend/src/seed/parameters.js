const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedParameters() {
  console.log('🌱 Seeding parameters...');

  try {
    // 1. Crear relaciones entre campos
    const relaciones = [
      {
        campo_padre: 'tipo_tarjeta',
        campo_hijo: 'producto',
        descripcion: 'Los productos se filtran por tipo de tarjeta'
      },
      {
        campo_padre: 'banco',
        campo_hijo: 'tipo_producto', 
        descripcion: 'Los tipos de producto se filtran por banco'
      },
      {
        campo_padre: 'tipo_producto',
        campo_hijo: 'codigo_producto',
        descripcion: 'Los códigos de producto se filtran por tipo de producto'
      },
      {
        campo_padre: 'modulo',
        campo_hijo: 'submodulo',
        descripcion: 'Los submódulos se filtran por módulo'
      },
      {
        campo_padre: 'dimension',
        campo_hijo: 'subdimension',
        descripcion: 'Las subdimensiones se filtran por dimensión'
      },
      {
        campo_padre: 'tipo_concepto',
        campo_hijo: 'concepto',
        descripcion: 'Los conceptos se filtran por tipo de concepto'
      }
    ];

    for (const relacion of relaciones) {
      await prisma.parametroRelacion.upsert({
        where: {
          campo_padre_campo_hijo: {
            campo_padre: relacion.campo_padre,
            campo_hijo: relacion.campo_hijo
          }
        },
        update: {},
        create: relacion
      });
    }

    // 2. Crear parámetros maestros

    // Tipos de tarjeta
    const tiposTarjeta = [
      { codigo: 'VISA_CREDITO', nombre: 'Visa Crédito', orden: 1 },
      { codigo: 'VISA_DEBITO', nombre: 'Visa Débito', orden: 2 },
      { codigo: 'MASTERCARD_CREDITO', nombre: 'MasterCard Crédito', orden: 3 },
      { codigo: 'MASTERCARD_DEBITO', nombre: 'MasterCard Débito', orden: 4 },
      { codigo: 'AMEX', nombre: 'American Express', orden: 5 }
    ];

    for (const tipo of tiposTarjeta) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'tipo_tarjeta',
            codigo: tipo.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'tipo_tarjeta',
          ...tipo,
          descripcion: `Tarjeta ${tipo.nombre}`
        }
      });
    }

    // Bancos
    const bancos = [
      { codigo: 'BANCO_NACION', nombre: 'Banco de la Nación Argentina', orden: 1 },
      { codigo: 'BANCO_PROVINCIA', nombre: 'Banco de la Provincia de Buenos Aires', orden: 2 },
      { codigo: 'BANCO_CIUDAD', nombre: 'Banco Ciudad', orden: 3 },
      { codigo: 'SANTANDER', nombre: 'Banco Santander', orden: 4 },
      { codigo: 'BBVA', nombre: 'BBVA', orden: 5 },
      { codigo: 'HSBC', nombre: 'HSBC', orden: 6 },
      { codigo: 'ICBC', nombre: 'ICBC', orden: 7 },
      { codigo: 'GALICIA', nombre: 'Banco Galicia', orden: 8 }
    ];

    for (const banco of bancos) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'banco',
            codigo: banco.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'banco',
          ...banco,
          descripcion: banco.nombre
        }
      });
    }

    // Tipos de producto
    const tiposProducto = [
      { codigo: 'TARJETA_CREDITO', nombre: 'Tarjeta de Crédito', valor_padre: 'BANCO_NACION', orden: 1 },
      { codigo: 'TARJETA_DEBITO', nombre: 'Tarjeta de Débito', valor_padre: 'BANCO_NACION', orden: 2 },
      { codigo: 'CUENTA_CORRIENTE', nombre: 'Cuenta Corriente', valor_padre: 'BANCO_NACION', orden: 3 },
      { codigo: 'CAJA_AHORRO', nombre: 'Caja de Ahorro', valor_padre: 'BANCO_NACION', orden: 4 },
      { codigo: 'CREDITO_PERSONAL', nombre: 'Crédito Personal', valor_padre: 'SANTANDER', orden: 1 },
      { codigo: 'HIPOTECARIO', nombre: 'Crédito Hipotecario', valor_padre: 'SANTANDER', orden: 2 }
    ];

    for (const tipoProducto of tiposProducto) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'tipo_producto',
            codigo: tipoProducto.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'tipo_producto',
          ...tipoProducto,
          descripcion: tipoProducto.nombre
        }
      });
    }

    // Códigos de productos específicos
    const productos = [
      { codigo: 'VISA_CLASSIC', nombre: 'Visa Classic', valor_padre: 'TARJETA_CREDITO', orden: 1 },
      { codigo: 'VISA_GOLD', nombre: 'Visa Gold', valor_padre: 'TARJETA_CREDITO', orden: 2 },
      { codigo: 'VISA_PLATINUM', nombre: 'Visa Platinum', valor_padre: 'TARJETA_CREDITO', orden: 3 },
      { codigo: 'MASTERCARD_STANDARD', nombre: 'MasterCard Standard', valor_padre: 'TARJETA_CREDITO', orden: 1 },
      { codigo: 'MASTERCARD_GOLD', nombre: 'MasterCard Gold', valor_padre: 'TARJETA_CREDITO', orden: 2 },
      { codigo: 'AMEX_GREEN', nombre: 'American Express Green', valor_padre: 'TARJETA_CREDITO', orden: 1 },
      { codigo: 'AMEX_GOLD', nombre: 'American Express Gold', valor_padre: 'TARJETA_CREDITO', orden: 2 }
    ];

    for (const producto of productos) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'codigo_producto',
            codigo: producto.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'codigo_producto',
          ...producto,
          descripcion: producto.nombre
        }
      });
    }

    // Módulos
    const modulos = [
      { codigo: 'TESORERIA', nombre: 'Tesorería', orden: 1 },
      { codigo: 'CONTABILIDAD', nombre: 'Contabilidad', orden: 2 },
      { codigo: 'COMPRAS', nombre: 'Compras', orden: 3 },
      { codigo: 'VENTAS', nombre: 'Ventas', orden: 4 },
      { codigo: 'RRHH', nombre: 'Recursos Humanos', orden: 5 }
    ];

    for (const modulo of modulos) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'modulo',
            codigo: modulo.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'modulo',
          ...modulo,
          descripcion: `Módulo de ${modulo.nombre}`
        }
      });
    }

    // Submódulos
    const submodulos = [
      { codigo: 'PAGOS', nombre: 'Pagos', valor_padre: 'TESORERIA', orden: 1 },
      { codigo: 'COBRANZAS', nombre: 'Cobranzas', valor_padre: 'TESORERIA', orden: 2 },
      { codigo: 'ASIENTOS', nombre: 'Asientos Contables', valor_padre: 'CONTABILIDAD', orden: 1 },
      { codigo: 'BALANCES', nombre: 'Balances', valor_padre: 'CONTABILIDAD', orden: 2 },
      { codigo: 'ORDENES_COMPRA', nombre: 'Órdenes de Compra', valor_padre: 'COMPRAS', orden: 1 },
      { codigo: 'FACTURAS_COMPRA', nombre: 'Facturas de Compra', valor_padre: 'COMPRAS', orden: 2 }
    ];

    for (const submodulo of submodulos) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'submodulo',
            codigo: submodulo.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'submodulo',
          ...submodulo,
          descripcion: submodulo.nombre
        }
      });
    }

    // Dimensiones
    const dimensiones = [
      { codigo: 'CENTRO_COSTOS', nombre: 'Centro de Costos', orden: 1 },
      { codigo: 'PROYECTO', nombre: 'Proyecto', orden: 2 },
      { codigo: 'SUCURSAL', nombre: 'Sucursal', orden: 3 },
      { codigo: 'AREA', nombre: 'Área', orden: 4 }
    ];

    for (const dimension of dimensiones) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'dimension',
            codigo: dimension.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'dimension',
          ...dimension,
          descripcion: dimension.nombre
        }
      });
    }

    // Subdimensiones
    const subdimensiones = [
      { codigo: 'CC_ADMINISTRACION', nombre: 'Administración', valor_padre: 'CENTRO_COSTOS', orden: 1 },
      { codigo: 'CC_VENTAS', nombre: 'Ventas', valor_padre: 'CENTRO_COSTOS', orden: 2 },
      { codigo: 'CC_PRODUCCION', nombre: 'Producción', valor_padre: 'CENTRO_COSTOS', orden: 3 },
      { codigo: 'PROY_IMPLEMENTACION', nombre: 'Implementación ERP', valor_padre: 'PROYECTO', orden: 1 },
      { codigo: 'PROY_DESARROLLO', nombre: 'Desarrollo de Software', valor_padre: 'PROYECTO', orden: 2 },
      { codigo: 'SUC_CENTRO', nombre: 'Sucursal Centro', valor_padre: 'SUCURSAL', orden: 1 },
      { codigo: 'SUC_NORTE', nombre: 'Sucursal Norte', valor_padre: 'SUCURSAL', orden: 2 }
    ];

    for (const subdimension of subdimensiones) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'subdimension',
            codigo: subdimension.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'subdimension',
          ...subdimension,
          descripcion: subdimension.nombre
        }
      });
    }

    // Tipos de concepto
    const tiposConcepto = [
      { codigo: 'INGRESOS', nombre: 'Ingresos', orden: 1 },
      { codigo: 'EGRESOS', nombre: 'Egresos', orden: 2 },
      { codigo: 'GASTOS', nombre: 'Gastos', orden: 3 },
      { codigo: 'COMISIONES', nombre: 'Comisiones', orden: 4 }
    ];

    for (const tipoConcepto of tiposConcepto) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'tipo_concepto',
            codigo: tipoConcepto.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'tipo_concepto',
          ...tipoConcepto,
          descripcion: tipoConcepto.nombre
        }
      });
    }

    // Conceptos específicos
    const conceptos = [
      { codigo: 'VENTA_PRODUCTOS', nombre: 'Venta de Productos', valor_padre: 'INGRESOS', orden: 1 },
      { codigo: 'VENTA_SERVICIOS', nombre: 'Venta de Servicios', valor_padre: 'INGRESOS', orden: 2 },
      { codigo: 'COMPRA_MERCADERIA', nombre: 'Compra de Mercadería', valor_padre: 'EGRESOS', orden: 1 },
      { codigo: 'COMPRA_INSUMOS', nombre: 'Compra de Insumos', valor_padre: 'EGRESOS', orden: 2 },
      { codigo: 'GASTO_ALQUILER', nombre: 'Gasto de Alquiler', valor_padre: 'GASTOS', orden: 1 },
      { codigo: 'GASTO_SERVICIOS', nombre: 'Gasto de Servicios', valor_padre: 'GASTOS', orden: 2 },
      { codigo: 'COMISION_VENTA', nombre: 'Comisión por Venta', valor_padre: 'COMISIONES', orden: 1 },
      { codigo: 'COMISION_BANCARIA', nombre: 'Comisión Bancaria', valor_padre: 'COMISIONES', orden: 2 }
    ];

    for (const concepto of conceptos) {
      await prisma.parametroMaestro.upsert({
        where: {
          tipo_campo_codigo: {
            tipo_campo: 'concepto',
            codigo: concepto.codigo
          }
        },
        update: {},
        create: {
          tipo_campo: 'concepto',
          ...concepto,
          descripcion: concepto.nombre
        }
      });
    }

    console.log('✅ Parameters seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding parameters:', error);
    throw error;
  }
}

module.exports = seedParameters;

if (require.main === module) {
  seedParameters()
    .then(() => {
      console.log('✅ Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}