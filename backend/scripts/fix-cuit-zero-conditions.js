const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCuitZeroConditions() {
  console.log('🔧 Corrigiendo condiciones de reglas CUIT cero para usar valor transformado...\n');

  try {
    // 1. Corregir regla CUIT_CEROS_ARP
    const reglaARP = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_CEROS_ARP' }
    });

    if (reglaARP) {
      console.log('📋 Corrigiendo regla CUIT_CEROS_ARP...');
      console.log('   Condiciones actuales:', JSON.stringify(reglaARP.configuracion.condiciones, null, 2));

      // Las reglas deben buscar solo "0" (valor transformado) no "0000000000000"
      const nuevaConfiguracionARP = {
        ...reglaARP.configuracion,
        condiciones: [
          {
            campo: 'resumen.cuit',
            valor: '0',
            operador: 'EQUALS'
          },
          {
            campo: 'resumen.moneda',
            valor: 'ARP,ARS',
            operador: 'IN'
          }
        ],
        logicOperator: 'AND',
        descripcion: 'Para CUIT transformado a "0" con moneda ARP/ARS asigna código 9994'
      };

      await prisma.reglaNegocio.update({
        where: { id: reglaARP.id },
        data: { configuracion: nuevaConfiguracionARP }
      });

      console.log('   ✅ Actualizada para buscar CUIT transformado "0"');
    }

    // 2. Corregir regla CUIT_CEROS_USD
    const reglaUSD = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_CEROS_USD' }
    });

    if (reglaUSD) {
      console.log('📋 Corrigiendo regla CUIT_CEROS_USD...');
      console.log('   Condiciones actuales:', JSON.stringify(reglaUSD.configuracion.condiciones, null, 2));

      // Las reglas deben buscar solo "0" (valor transformado) no "0000000000000"
      const nuevaConfiguracionUSD = {
        ...reglaUSD.configuracion,
        condiciones: [
          {
            campo: 'resumen.cuit',
            valor: '0',
            operador: 'EQUALS'
          },
          {
            campo: 'resumen.moneda',
            valor: 'USD',
            operador: 'EQUALS'
          }
        ],
        logicOperator: 'AND',
        descripcion: 'Para CUIT transformado a "0" con moneda USD asigna código 9995'
      };

      await prisma.reglaNegocio.update({
        where: { id: reglaUSD.id },
        data: { configuracion: nuevaConfiguracionUSD }
      });

      console.log('   ✅ Actualizada para buscar CUIT transformado "0"');
    }

    console.log('\n🎯 Flujo corregido:');
    console.log('   1. CUIT original: "0000000000000"');
    console.log('   2. Transformación REMOVE_LEADING_ZEROS: "0000000000000" → "0"');
    console.log('   3. Reglas CUIT cero buscan: "0" (valor transformado)');
    console.log('   4. Condiciones:');
    console.log('      ✅ CUIT_CEROS_ARP: cuit="0" AND moneda IN [ARP,ARS] → proveedorId="9994"');
    console.log('      ✅ CUIT_CEROS_USD: cuit="0" AND moneda="USD" → proveedorId="9995"');
    console.log('   5. Regla LOOKUP_JSON no se ejecuta porque excluye cuit="0"');

    // 3. Verificar orden de prioridades
    const todasLasReglas = await prisma.reglaNegocio.findMany({
      where: {
        tipo: 'IMPORTACION_DKT',
        activa: true,
        codigo: {
          in: ['CUIT_CEROS_ARP', 'CUIT_CEROS_USD', 'CUIT_BUSCAR_PROVEEDOR']
        }
      },
      orderBy: { prioridad: 'asc' }
    });

    console.log('\n📊 Orden de ejecución de reglas CUIT:');
    todasLasReglas.forEach(regla => {
      console.log(`   ${regla.prioridad}: ${regla.codigo} - ${regla.nombre}`);
    });

  } catch (error) {
    console.error('❌ Error corrigiendo condiciones:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar corrección
fixCuitZeroConditions();