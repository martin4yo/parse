const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();

async function debugAplicarReglas() {
  try {
    console.log('🔍 Debugeando aplicación de reglas...\n');

    // Paso 1: Obtener el tenantId de las reglas existentes
    const reglaConTenant = await prisma.reglas_negocio.findFirst({
      where: {
        tenantId: { not: null }
      },
      select: { tenantId: true, codigo: true }
    });

    if (!reglaConTenant) {
      console.log('❌ No se encontró ninguna regla con tenantId');
      return;
    }

    const tenantId = reglaConTenant.tenantId;
    console.log(`✅ TenantId: ${tenantId}\n`);

    // Paso 2: Ver todas las reglas en la BD
    const todasReglas = await prisma.reglas_negocio.findMany({
      where: { activa: true },
      select: {
        codigo: true,
        nombre: true,
        tipo: true,
        tenantId: true,
        prioridad: true
      },
      orderBy: { prioridad: 'asc' }
    });

    console.log(`📋 Reglas activas en BD: ${todasReglas.length}\n`);
    todasReglas.forEach(r => {
      const tenantMatch = r.tenantId === tenantId ? '✅' : '❌';
      console.log(`   ${tenantMatch} [${r.prioridad}] ${r.codigo} (${r.tipo})`);
      console.log(`      tenantId: ${r.tenantId}`);
    });

    // Paso 3: Probar carga SIN tenantId
    console.log('\n\n🧪 TEST 1: Cargar reglas SIN tenantId\n');
    const engine1 = new BusinessRulesEngine();
    await engine1.loadRules('TRANSFORMACION', true, prisma);
    console.log(`   Reglas cargadas: ${engine1.rules.length}`);

    // Paso 4: Probar carga CON tenantId
    console.log('\n🧪 TEST 2: Cargar reglas CON tenantId\n');
    const engine2 = new BusinessRulesEngine(tenantId);
    await engine2.loadRules('TRANSFORMACION', true, prisma);
    console.log(`   Reglas cargadas: ${engine2.rules.length}`);

    if (engine2.rules.length > 0) {
      console.log('\n   Reglas cargadas:');
      engine2.rules.forEach(r => {
        console.log(`      ${r.prioridad}. ${r.codigo}`);
      });
    }

    // Paso 5: Buscar un documento para probar
    console.log('\n\n🧪 TEST 3: Aplicar reglas a documento real\n');

    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        tenantId: tenantId,
        estadoProcesamiento: 'completado',
        exportado: false
      },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    if (!documento) {
      console.log('   ⚠️ No hay documentos para probar');
    } else {
      console.log(`   📄 Documento encontrado: ${documento.id}`);
      console.log(`      CUIT: ${documento.cuitExtraido}`);
      console.log(`      Razón Social: ${documento.razonSocialExtraida}`);
      console.log(`      Código Proveedor: ${documento.codigoProveedor}`);
      console.log(`      Líneas: ${documento.documento_lineas.length}`);
      console.log(`      Impuestos: ${documento.documento_impuestos.length}`);

      // Aplicar reglas
      const result = await engine2.applyRulesToDocument(documento, {
        logExecution: false,
        contexto: 'DEBUG_TEST'
      });

      console.log(`\n   ✅ Resultado:`);
      console.log(`      Total reglas aplicadas: ${result.totalReglasAplicadas}`);
      console.log(`      Reglas en documento: ${result.reglasAplicadas.documento}`);
      console.log(`      Reglas en líneas: ${result.reglasAplicadas.lineas}`);
      console.log(`      Reglas en impuestos: ${result.reglasAplicadas.impuestos}`);

      if (result.totalReglasAplicadas > 0) {
        console.log('\n   📝 Cambios detectados:');
        if (result.documento.razonSocialExtraida !== documento.razonSocialExtraida) {
          console.log(`      Razón Social: "${documento.razonSocialExtraida}" → "${result.documento.razonSocialExtraida}"`);
        }
        if (result.documento.codigoProveedor !== documento.codigoProveedor) {
          console.log(`      Código Proveedor: "${documento.codigoProveedor}" → "${result.documento.codigoProveedor}"`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
debugAplicarReglas()
  .then(() => {
    console.log('\n✨ Debug completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
