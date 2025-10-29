const BusinessRulesEngine = require('../src/services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugResumenReal() {
  console.log('🔍 Revisando datos reales del resumen_tarjeta...\n');

  try {
    // 1. Ver tipos de CUIT y moneda en la BD
    console.log('📊 Análisis de datos en resumen_tarjeta:');
    
    const resumenStats = await prisma.$queryRaw`
      SELECT 
        cuit,
        moneda,
        COUNT(*) as cantidad
      FROM resumen_tarjeta 
      WHERE cuit IS NOT NULL 
      GROUP BY cuit, moneda
      ORDER BY cantidad DESC
      LIMIT 10
    `;

    console.log('   Top 10 combinaciones CUIT + Moneda:');
    resumenStats.forEach(row => {
      console.log(`     CUIT: "${row.cuit}" | Moneda: "${row.moneda}" | Cantidad: ${row.cantidad}`);
    });

    // 2. Buscar específicamente casos con CUIT 00000000000
    console.log('\n🎯 Casos específicos con CUIT "00000000000":');
    
    const casosCeros = await prisma.$queryRaw`
      SELECT DISTINCT cuit, moneda, COUNT(*) as cantidad
      FROM resumen_tarjeta 
      WHERE cuit = '00000000000' OR cuit = '0'
      GROUP BY cuit, moneda
      ORDER BY cantidad DESC
    `;

    if (casosCeros.length > 0) {
      casosCeros.forEach(row => {
        console.log(`     CUIT: "${row.cuit}" | Moneda: "${row.moneda}" | Cantidad: ${row.cantidad}`);
      });
    } else {
      console.log('     ❌ No se encontraron registros con CUIT "00000000000" o "0"');
    }

    // 3. Ver caracteres especiales o espacios
    console.log('\n🔬 Análisis de formato de datos:');
    
    const formatAnalysis = await prisma.$queryRaw`
      SELECT 
        DISTINCT cuit,
        LENGTH(cuit) as cuit_length,
        moneda,
        LENGTH(moneda) as moneda_length
      FROM resumen_tarjeta 
      WHERE cuit IS NOT NULL 
      LIMIT 5
    `;

    formatAnalysis.forEach(row => {
      console.log(`     CUIT: "${row.cuit}" (${row.cuit_length} chars) | Moneda: "${row.moneda}" (${row.moneda_length} chars)`);
    });

    // 4. Probar con datos reales
    console.log('\n🧪 Probando reglas con una muestra real:');
    
    const muestraReal = await prisma.resumenTarjeta.findMany({
      where: {
        cuit: { not: null }
      },
      take: 3,
      select: {
        id: true,
        cuit: true,
        moneda: true
      }
    });

    const engine = new BusinessRulesEngine();
    await engine.loadRules('IMPORTACION_DKT', true);

    for (const resumen of muestraReal) {
      console.log(`\n📝 Probando con resumen ID: ${resumen.id}`);
      console.log(`   CUIT: "${resumen.cuit}" | Moneda: "${resumen.moneda}"`);
      
      try {
        const resultado = await engine.applyRules(
          {},
          {
            cuit: resumen.cuit,
            moneda: resumen.moneda
          },
          { logExecution: true }
        );

        console.log(`   Reglas ejecutadas: ${resultado.executedRules.length}`);
        resultado.executedRules.forEach(r => {
          console.log(`     - ${r.nombre}`);
        });

        const proveedorId = resultado.data.proveedorId;
        console.log(`   Resultado: proveedorId="${proveedorId}"`);

      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }

    // 5. Verificar si hay registros con rendicion_tarjeta_items sin proveedorId asignado
    console.log('\n📋 Verificando items sin proveedorId asignado:');
    
    const itemsSinProveedor = await prisma.$queryRaw`
      SELECT COUNT(*) as cantidad
      FROM rendicion_tarjeta_items 
      WHERE proveedorId IS NULL OR proveedorId = ''
    `;

    console.log(`   Items sin proveedorId: ${itemsSinProveedor[0]?.cantidad || 0}`);

  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar debug
debugResumenReal()
  .then(() => {
    console.log('\n🔍 Debug de datos reales completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });