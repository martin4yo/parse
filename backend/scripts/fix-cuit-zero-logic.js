const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCuitZeroLogic() {
  console.log('🔧 Corrigiendo lógica de reglas CUIT cero...\n');

  try {
    // 1. Corregir regla CUIT_CEROS_ARP
    const reglaARP = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_CEROS_ARP' }
    });

    if (reglaARP) {
      console.log('📋 Corrigiendo regla CUIT_CEROS_ARP...');
      console.log(`   Lógica actual: ${reglaARP.configuracion.logicOperator}`);

      // Nueva configuración con lógica OR para las condiciones de CUIT
      const nuevaConfiguracionARP = {
        ...reglaARP.configuracion,
        condiciones: [
          {
            campo: 'resumen.moneda',
            valor: 'ARP,ARS',
            operador: 'IN'
          }
        ],
        condicionesOr: [
          {
            campo: 'resumen.cuit',
            valor: '0000000000000',
            operador: 'EQUALS'
          },
          {
            campo: 'resumen.cuit',
            valor: '0',
            operador: 'EQUALS'
          }
        ],
        logicOperator: 'AND',
        descripcion: 'Para CUIT 0000000000000 o 0 con moneda ARP/ARS asigna código 9994'
      };

      await prisma.reglaNegocio.update({
        where: { id: reglaARP.id },
        data: { configuracion: nuevaConfiguracionARP }
      });

      console.log('   ✅ Actualizada con condicionesOr para CUIT');
    }

    // 2. Corregir regla CUIT_CEROS_USD
    const reglaUSD = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_CEROS_USD' }
    });

    if (reglaUSD) {
      console.log('📋 Corrigiendo regla CUIT_CEROS_USD...');
      console.log(`   Lógica actual: ${reglaUSD.configuracion.logicOperator}`);

      // Nueva configuración con lógica OR para las condiciones de CUIT
      const nuevaConfiguracionUSD = {
        ...reglaUSD.configuracion,
        condiciones: [
          {
            campo: 'resumen.moneda',
            valor: 'USD',
            operador: 'EQUALS'
          }
        ],
        condicionesOr: [
          {
            campo: 'resumen.cuit',
            valor: '0000000000000',
            operador: 'EQUALS'
          },
          {
            campo: 'resumen.cuit',
            valor: '0',
            operador: 'EQUALS'
          }
        ],
        logicOperator: 'AND',
        descripcion: 'Para CUIT 0000000000000 o 0 con moneda USD asigna código 9995'
      };

      await prisma.reglaNegocio.update({
        where: { id: reglaUSD.id },
        data: { configuracion: nuevaConfiguracionUSD }
      });

      console.log('   ✅ Actualizada con condicionesOr para CUIT');
    }

    console.log('\n🎯 Lógica corregida:');
    console.log('   ✅ CUIT_CEROS_ARP: (moneda IN [ARP,ARS]) AND (cuit = "0000000000000" OR cuit = "0")');
    console.log('   ✅ CUIT_CEROS_USD: (moneda = "USD") AND (cuit = "0000000000000" OR cuit = "0")');

  } catch (error) {
    console.error('❌ Error corrigiendo lógica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar corrección
fixCuitZeroLogic();