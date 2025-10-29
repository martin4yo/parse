const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixReglasCuitFormato() {
  try {
    console.log('🔧 Corrigiendo formato de CUIT en las reglas...\n');

    // 1. Actualizar regla CUIT_BUSCAR_PROVEEDOR
    console.log('📝 Actualizando CUIT_BUSCAR_PROVEEDOR...');
    const regla1 = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_BUSCAR_PROVEEDOR' }
    });

    if (regla1) {
      const newConfig1 = { ...regla1.configuracion };
      // Cambiar condición de NOT_EQUALS "00000000000" a "0000000000000"
      newConfig1.condiciones[1].valor = '0000000000000';

      await prisma.reglaNegocio.update({
        where: { id: regla1.id },
        data: { configuracion: newConfig1 }
      });
      console.log('   ✅ Actualizada: NOT_EQUALS "0000000000000"');
    }

    // 2. Actualizar regla CUIT_CEROS_ARP
    console.log('📝 Actualizando CUIT_CEROS_ARP...');
    const regla2 = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_CEROS_ARP' }
    });

    if (regla2) {
      const newConfig2 = { ...regla2.configuracion };
      // Cambiar condición de EQUALS "00000000000" a "0000000000000"
      newConfig2.condiciones[0].valor = '0000000000000';

      await prisma.reglaNegocio.update({
        where: { id: regla2.id },
        data: { configuracion: newConfig2 }
      });
      console.log('   ✅ Actualizada: EQUALS "0000000000000"');
    }

    // 3. Actualizar regla CUIT_CEROS_USD
    console.log('📝 Actualizando CUIT_CEROS_USD...');
    const regla3 = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'CUIT_CEROS_USD' }
    });

    if (regla3) {
      const newConfig3 = { ...regla3.configuracion };
      // Cambiar condición de EQUALS "00000000000" a "0000000000000"
      newConfig3.condiciones[0].valor = '0000000000000';

      await prisma.reglaNegocio.update({
        where: { id: regla3.id },
        data: { configuracion: newConfig3 }
      });
      console.log('   ✅ Actualizada: EQUALS "0000000000000"');
    }

    // 4. Verificar las reglas actualizadas
    console.log('\n🔍 Verificando reglas actualizadas:');
    const reglasVerificacion = await prisma.reglaNegocio.findMany({
      where: {
        codigo: {
          in: ['CUIT_BUSCAR_PROVEEDOR', 'CUIT_CEROS_ARP', 'CUIT_CEROS_USD']
        }
      },
      orderBy: { prioridad: 'asc' }
    });

    reglasVerificacion.forEach(regla => {
      console.log(`\n📄 ${regla.nombre}:`);
      regla.configuracion.condiciones?.forEach((cond, i) => {
        console.log(`   Condición ${i + 1}: ${cond.campo} ${cond.operador} "${cond.valor}"`);
      });
    });

    // 5. Probar con el formato real
    console.log('\n🧪 Probando con formato real de CUIT:');
    const BusinessRulesEngine = require('../src/services/businessRulesEngine');
    const engine = new BusinessRulesEngine();
    await engine.loadRules('IMPORTACION_DKT', true);

    const casosPrueba = [
      {
        nombre: 'CUIT 0000000000000 + ARP',
        resumen: { cuit: '0000000000000', moneda: 'ARP' },
        esperado: '9994'
      },
      {
        nombre: 'CUIT 0000000000000 + USD',
        resumen: { cuit: '0000000000000', moneda: 'USD' },
        esperado: '9995'
      }
    ];

    for (const caso of casosPrueba) {
      console.log(`\n📝 ${caso.nombre}:`);
      try {
        const resultado = await engine.applyRules({}, caso.resumen, { logExecution: false });
        const proveedorId = resultado.data.proveedorId;
        
        console.log(`   Reglas aplicadas: ${resultado.executedRules.length}`);
        resultado.executedRules.forEach(r => {
          console.log(`     - ${r.nombre}`);
        });
        
        console.log(`   Resultado: proveedorId="${proveedorId}"`);
        console.log(`   Esperado: "${caso.esperado}"`);
        
        if (proveedorId === caso.esperado) {
          console.log(`   ✅ CORRECTO`);
        } else {
          console.log(`   ❌ INCORRECTO`);
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error actualizando reglas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar corrección
fixReglasCuitFormato()
  .then(() => {
    console.log('\n✨ Reglas CUIT corregidas exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });