const BusinessRulesEngine = require('../src/services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function crearDatosDePrueba() {
  console.log('🔧 Creando datos de prueba para LOOKUP_CHAIN...\n');

  try {
    // 1. Verificar que existe el atributo "codigo_dimension"
    let atributoCodigoDimension = await prisma.atributo.findUnique({
      where: { codigo: 'codigo_dimension' }
    });

    if (!atributoCodigoDimension) {
      console.log('📝 Creando atributo "codigo_dimension"...');
      atributoCodigoDimension = await prisma.atributo.create({
        data: {
          codigo: 'codigo_dimension',
          descripcion: 'Código de dimensión contable del usuario',
          activo: true
        }
      });
      console.log(`   ✅ Atributo creado con ID: ${atributoCodigoDimension.id}`);
    } else {
      console.log(`   ℹ️ Atributo ya existe con ID: ${atributoCodigoDimension.id}`);
    }

    // 2. Obtener algunas tarjetas para configurarles códigos de dimensión
    const tarjetas = await prisma.userTarjetaCredito.findMany({
      include: { user: true },
      take: 3
    });

    if (tarjetas.length === 0) {
      console.log('   ⚠️ No hay tarjetas en el sistema para configurar');
      return [];
    }

    console.log(`\n📊 Configurando códigos de dimensión para ${tarjetas.length} usuarios...\n`);

    const datosPrueba = [];

    for (const [index, tarjeta] of tarjetas.entries()) {
      const codigoDimension = `DIM_${String(index + 1).padStart(3, '0')}`; // DIM_001, DIM_002, etc.
      
      // Crear o actualizar el valor del atributo para este usuario
      let valorAtributo = await prisma.valorAtributo.findFirst({
        where: {
          codigo: codigoDimension,
          atributoId: atributoCodigoDimension.id
        }
      });

      if (!valorAtributo) {
        valorAtributo = await prisma.valorAtributo.create({
          data: {
            codigo: codigoDimension,
            descripcion: `Código Dimensión ${codigoDimension}`,
            atributoId: atributoCodigoDimension.id,
            activo: true
          }
        });
      }

      // Verificar si ya existe la relación user_atributo
      const userAtributoExistente = await prisma.userAtributo.findFirst({
        where: {
          userId: tarjeta.userId,
          valorAtributoId: valorAtributo.id
        }
      });

      if (!userAtributoExistente) {
        await prisma.userAtributo.create({
          data: {
            userId: tarjeta.userId,
            valorAtributoId: valorAtributo.id
          }
        });
      }

      datosPrueba.push({
        numeroTarjeta: tarjeta.numeroTarjeta,
        userId: tarjeta.userId,
        usuario: `${tarjeta.user.nombre} ${tarjeta.user.apellido}`,
        codigoDimension
      });

      console.log(`   ✅ ${tarjeta.numeroTarjeta} → ${tarjeta.user.nombre} ${tarjeta.user.apellido} → ${codigoDimension}`);
    }

    console.log(`\n🎯 Datos de prueba configurados exitosamente`);
    return datosPrueba;

  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error);
    throw error;
  }
}

async function testLookupChain() {
  console.log('🧪 Probando LOOKUP_CHAIN para código de dimensión...\n');

  try {
    // Crear datos de prueba
    const datosPrueba = await crearDatosDePrueba();
    
    if (datosPrueba.length === 0) {
      console.log('⚠️ No hay datos de prueba disponibles');
      return false;
    }

    const engine = new BusinessRulesEngine();
    
    // Cargar las reglas
    console.log('\n📚 Cargando reglas...');
    await engine.loadRules('IMPORTACION_DKT', true);
    console.log(`✅ ${engine.rules.length} reglas cargadas\n`);

    let exitosos = 0;
    let fallidos = 0;

    // Probar cada caso
    for (const caso of datosPrueba) {
      console.log(`📝 Probando: ${caso.numeroTarjeta} (${caso.usuario})`);
      console.log(`   Resultado esperado: ${caso.codigoDimension}`);

      try {
        const resultado = await engine.applyRules(
          {}, // itemData vacío
          { numeroTarjeta: caso.numeroTarjeta }, // resumenData
          { logExecution: false }
        );

        const codigoObtenido = resultado.data.codigoDimension;
        
        console.log(`   Reglas aplicadas: ${resultado.executedRules.length}`);
        if (resultado.executedRules.length > 0) {
          resultado.executedRules.forEach(r => {
            console.log(`     - ${r.nombre}`);
          });
        }

        if (codigoObtenido === caso.codigoDimension) {
          console.log(`   ✅ EXITOSO: codigoDimension="${codigoObtenido}"`);
          exitosos++;
        } else {
          console.log(`   ❌ FALLIDO: Esperado="${caso.codigoDimension}", Obtenido="${codigoObtenido}"`);
          fallidos++;
        }

      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        fallidos++;
      }

      console.log('');
    }

    // Probar caso de tarjeta inexistente
    console.log(`📝 Probando: Tarjeta inexistente (9999999999999999)`);
    try {
      const resultado = await engine.applyRules(
        {},
        { numeroTarjeta: '9999999999999999' },
        { logExecution: false }
      );

      const codigoObtenido = resultado.data.codigoDimension;
      
      if (codigoObtenido === null || codigoObtenido === undefined) {
        console.log(`   ✅ EXITOSO: codigoDimension="${codigoObtenido}" (esperado null/undefined)`);
        exitosos++;
      } else {
        console.log(`   ❌ FALLIDO: Esperado null/undefined, Obtenido="${codigoObtenido}"`);
        fallidos++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      fallidos++;
    }

    // Resumen
    console.log('\n📊 Resumen de pruebas:');
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Fallidos: ${fallidos}`);
    console.log(`   📋 Total: ${exitosos + fallidos}`);

    return fallidos === 0;

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar pruebas
testLookupChain()
  .then(exito => {
    if (exito) {
      console.log('\n✨ Todas las pruebas de LOOKUP_CHAIN pasaron exitosamente');
      process.exit(0);
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Error en las pruebas:', error);
    process.exit(1);
  });