const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function consultarReglas() {
  try {
    console.log('🔍 Buscando reglas que manejan razón social...\n');

    // Buscar todas las reglas activas de tipo TRANSFORMACION_DOCUMENTO
    const reglas = await prisma.reglas_negocio.findMany({
      where: {
        OR: [
          { tipo: 'TRANSFORMACION_DOCUMENTO' },
          { tipo: 'IMPORTACION_DKT' }
        ],
        activa: true
      },
      orderBy: { prioridad: 'asc' }
    });

    console.log(`📋 Total de reglas encontradas: ${reglas.length}\n`);

    // Buscar específicamente la que maneja razonSocialExtraida
    for (const regla of reglas) {
      const config = regla.configuracion;

      // Verificar si alguna acción establece razonSocialExtraida
      if (config.acciones) {
        const accionRazonSocial = config.acciones.find(a =>
          a.campo === 'razonSocialExtraida' && a.operacion === 'LOOKUP_JSON'
        );

        if (accionRazonSocial) {
          console.log('✅ REGLA ENCONTRADA:');
          console.log(`ID: ${regla.id}`);
          console.log(`Código: ${regla.codigo}`);
          console.log(`Nombre: ${regla.nombre}`);
          console.log(`Tipo: ${regla.tipo}`);
          console.log(`Prioridad: ${regla.prioridad}\n`);

          console.log('📋 Configuración completa:');
          console.log(JSON.stringify(regla.configuracion, null, 2));
          console.log('\n');
        }
      }
    }

    // También buscar reglas que manejan proveedorId por CUIT
    console.log('\n🔍 Buscando reglas de CUIT a proveedor...\n');

    for (const regla of reglas) {
      const config = regla.configuracion;

      if (config.acciones) {
        const accionProveedor = config.acciones.find(a =>
          a.campo === 'proveedorId' &&
          (a.campoJSON === 'cuit' || a.campoJSON === 'CUIT')
        );

        if (accionProveedor) {
          console.log('✅ REGLA CUIT -> PROVEEDOR:');
          console.log(`ID: ${regla.id}`);
          console.log(`Código: ${regla.codigo}`);
          console.log(`Nombre: ${regla.nombre}`);
          console.log(`Prioridad: ${regla.prioridad}\n`);
          console.log('Acción específica:');
          console.log(JSON.stringify(accionProveedor, null, 2));
          console.log('\n');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

consultarReglas();
