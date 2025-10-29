const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglaCuitProveedor() {
  try {
    console.log('🚀 Insertando regla de mapeo CUIT a proveedor...');

    // Definir la configuración de la regla
    const reglaConfig = {
      nombre: 'Mapeo CUIT a Código Proveedor',
      codigo: 'MAPEO_CUIT_PROVEEDOR',
      descripcion: 'Busca el CUIT del resumen en los proveedores y asigna el código. Para CUIT 00000000000 usa 9994 (ARP) o 9995 (USD)',
      tipo: 'IMPORTACION_DKT',
      prioridad: 100,
      activa: true,
      configuracion: {
        descripcion: 'Mapea el CUIT del resumen_tarjeta al código de proveedor correspondiente',
        condiciones: [
          {
            campo: 'resumen.cuit',
            operador: 'IS_NOT_NULL',
            valor: null
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            operacion: 'LOOKUP_JSON',
            campo: 'proveedorId',
            tipoCampo: 'proveedor',
            campoJSON: 'cuit',
            valorConsulta: '{resumen.cuit}',
            campoResultado: 'codigo',
            valorDefecto: null,
            condicionEspecial: {
              tipo: 'CUIT_ESPECIAL',
              campoMoneda: 'resumen.moneda',
              codigoARP: '9994',
              codigoUSD: '9995'
            }
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
    console.log('\n📋 Configuración de la regla:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

    // Verificar algunos proveedores de ejemplo
    console.log('\n🔍 Verificando proveedores de ejemplo:');
    const proveedoresEjemplo = await prisma.parametroMaestro.findMany({
      where: {
        tipo_campo: 'proveedor',
        activo: true
      },
      take: 3
    });

    proveedoresEjemplo.forEach(prov => {
      console.log(`   ${prov.codigo}: ${prov.nombre}`);
      if (prov.parametros_json && prov.parametros_json.cuit) {
        console.log(`      CUIT: ${prov.parametros_json.cuit}`);
      }
    });

    console.log('\n📌 Casos especiales configurados:');
    console.log('   CUIT 00000000000 + Moneda ARP/ARS → Código 9994');
    console.log('   CUIT 00000000000 + Moneda USD → Código 9995');

  } catch (error) {
    console.error('❌ Error al insertar la regla:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
insertarReglaCuitProveedor()
  .then(() => {
    console.log('\n✨ Regla insertada correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });