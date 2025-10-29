const BusinessRulesEngine = require('../src/services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugReglasCuit() {
  console.log('🔍 Depurando reglas CUIT...\n');

  try {
    // 1. Verificar reglas en la base de datos
    console.log('📋 Reglas IMPORTACION_DKT en la base de datos:');
    const reglas = await prisma.reglaNegocio.findMany({
      where: {
        tipo: 'IMPORTACION_DKT',
        activa: true
      },
      orderBy: { prioridad: 'asc' }
    });

    reglas.forEach(regla => {
      console.log(`   ${regla.prioridad}. ${regla.nombre} (${regla.codigo})`);
      console.log(`      Activa: ${regla.activa}`);
      console.log(`      Condiciones: ${regla.configuracion.condiciones?.length || 0}`);
      console.log(`      Acciones: ${regla.configuracion.acciones?.length || 0}`);
      if (regla.configuracion.stopOnMatch) {
        console.log(`      ⚠️ DETIENE EJECUCIÓN al aplicarse`);
      }
      console.log('');
    });

    // 2. Probar casos específicos
    const engine = new BusinessRulesEngine();
    await engine.loadRules('IMPORTACION_DKT', true);

    const casosPrueba = [
      {
        nombre: 'CUIT 00000000000 + ARP',
        resumen: { cuit: '00000000000', moneda: 'ARP' },
        esperado: '9994'
      },
      {
        nombre: 'CUIT 00000000000 + ARS', 
        resumen: { cuit: '00000000000', moneda: 'ARS' },
        esperado: '9994'
      },
      {
        nombre: 'CUIT 00000000000 + USD',
        resumen: { cuit: '00000000000', moneda: 'USD' },
        esperado: '9995'
      },
      {
        nombre: 'CUIT válido (30707586938)',
        resumen: { cuit: '30707586938', moneda: 'ARP' },
        esperado: '0001' // o el código que corresponda
      }
    ];

    console.log('🧪 Probando casos específicos:\n');

    for (const caso of casosPrueba) {
      console.log(`📝 ${caso.nombre}:`);
      console.log(`   Input: CUIT="${caso.resumen.cuit}", Moneda="${caso.resumen.moneda}"`);
      
      try {
        const resultado = await engine.applyRules(
          {}, // itemData vacío
          caso.resumen, // resumenData
          { logExecution: true }
        );

        console.log(`   Reglas ejecutadas: ${resultado.executedRules.length}`);
        resultado.executedRules.forEach(r => {
          console.log(`     - ${r.nombre} (aplicada: ${r.aplicada})`);
        });

        const proveedorId = resultado.data.proveedorId;
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
      
      console.log('');
    }

    // 3. Revisar configuración detallada de las reglas CUIT
    console.log('🔧 Configuración detallada de reglas CUIT:\n');
    
    const reglasCuit = reglas.filter(r => r.codigo.includes('CUIT'));
    for (const regla of reglasCuit) {
      console.log(`📄 ${regla.nombre} (${regla.codigo}):`);
      console.log(`   Prioridad: ${regla.prioridad}`);
      console.log(`   Condiciones (${regla.configuracion.logicOperator || 'AND'}):`);
      
      regla.configuracion.condiciones?.forEach((cond, i) => {
        console.log(`     ${i + 1}. ${cond.campo} ${cond.operador} "${cond.valor}"`);
      });
      
      console.log(`   Acciones:`);
      regla.configuracion.acciones?.forEach((acc, i) => {
        console.log(`     ${i + 1}. ${acc.operacion}: ${acc.campo} = "${acc.valor || acc.valorConsulta}"`);
      });
      
      console.log(`   Stop on match: ${regla.configuracion.stopOnMatch}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar debug
debugReglasCuit()
  .then(() => {
    console.log('🔍 Debug completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });