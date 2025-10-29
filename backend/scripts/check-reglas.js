const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReglas() {
  try {
    console.log('🔍 Verificando reglas de IMPORTACION_DKT...\n');

    const reglas = await prisma.reglaNegocio.findMany({
      where: {
        tipo: 'IMPORTACION_DKT',
        activa: true
      },
      orderBy: { prioridad: 'asc' }
    });

    console.log(`Total de reglas activas: ${reglas.length}\n`);

    reglas.forEach((regla, index) => {
      console.log(`${index + 1}. [Prioridad ${regla.prioridad}] ${regla.nombre}`);
      console.log(`   Código: ${regla.codigo}`);

      // Mostrar condiciones
      if (regla.configuracion.condiciones && regla.configuracion.condiciones.length > 0) {
        console.log('   Condiciones:');
        regla.configuracion.condiciones.forEach(cond => {
          console.log(`     - Campo: ${cond.campo}`);
          console.log(`       Operador: ${cond.operador}`);
          console.log(`       Valor: ${cond.valor || '(ninguno)'}`);
        });
      } else {
        console.log('   Condiciones: Ninguna (siempre aplica)');
      }

      // Mostrar acciones
      if (regla.configuracion.acciones && regla.configuracion.acciones.length > 0) {
        console.log('   Acciones:');
        regla.configuracion.acciones.forEach(accion => {
          console.log(`     - Operación: ${accion.operacion}`);
          console.log(`       Campo destino: ${accion.campo}`);
          if (accion.operacion === 'LOOKUP_CHAIN' && accion.cadena) {
            console.log(`       Cadena de ${accion.cadena.length} pasos`);
          }
        });
      }

      console.log(`   stopOnMatch: ${regla.configuracion.stopOnMatch || false}`);
      console.log('');
    });

    // Verificar específicamente la regla de CODDIM
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 VERIFICACIÓN ESPECÍFICA: ASIGNAR_CODIGO_DIMENSION_USUARIO\n');

    const reglaCODDIM = reglas.find(r => r.codigo === 'ASIGNAR_CODIGO_DIMENSION_USUARIO');

    if (reglaCODDIM) {
      console.log('✅ La regla ESTÁ presente y activa');
      console.log(`   Posición en la lista: ${reglas.findIndex(r => r.codigo === 'ASIGNAR_CODIGO_DIMENSION_USUARIO') + 1} de ${reglas.length}`);
      console.log(`   Prioridad: ${reglaCODDIM.prioridad}`);

      // Verificar si alguna regla anterior tiene stopOnMatch
      const reglasAnteriores = reglas.filter(r => r.prioridad < reglaCODDIM.prioridad);
      const conStopOnMatch = reglasAnteriores.filter(r => r.configuracion.stopOnMatch === true);

      if (conStopOnMatch.length > 0) {
        console.log('\n⚠️  PROBLEMA DETECTADO: Hay reglas anteriores con stopOnMatch=true');
        conStopOnMatch.forEach(r => {
          console.log(`   - ${r.nombre} (prioridad ${r.prioridad}) tiene stopOnMatch=true`);
          console.log('     Esto puede impedir que se ejecute la regla de CODDIM');
        });
      } else {
        console.log('\n✅ Ninguna regla anterior tiene stopOnMatch=true');
      }

      // Verificar las condiciones
      console.log('\n📋 Condiciones que deben cumplirse:');
      reglaCODDIM.configuracion.condiciones.forEach(cond => {
        console.log(`   - ${cond.campo} ${cond.operador} ${cond.valor || '(verificación de existencia)'}`);
      });

      console.log('\n💡 Para que esta regla se ejecute:');
      console.log('   1. El objeto debe tener resumen.numeroTarjeta');
      console.log('   2. resumen.numeroTarjeta no debe ser null');
      console.log('   3. resumen.numeroTarjeta no debe estar vacío');

    } else {
      console.log('❌ La regla NO está presente o está inactiva');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReglas();