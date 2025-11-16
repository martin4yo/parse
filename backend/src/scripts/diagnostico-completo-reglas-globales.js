const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnosticoCompleto() {
  console.log('🔍 DIAGNÓSTICO COMPLETO - REGLAS GLOBALES\n');
  console.log('=' .repeat(60));

  try {
    // 1. Listar todas las reglas GLOBALES
    console.log('\n📋 PASO 1: REGLAS MARCADAS COMO GLOBALES (esGlobal=true)\n');

    const reglasGlobales = await prisma.reglas_negocio.findMany({
      where: {
        esGlobal: true,
        activa: true,
        tenantId: null
      },
      orderBy: { codigo: 'asc' }
    });

    if (reglasGlobales.length === 0) {
      console.log('❌ NO HAY REGLAS GLOBALES en la base de datos');
      console.log('   Para crear una regla global, debe tener:');
      console.log('   - esGlobal = true');
      console.log('   - tenantId = NULL');
      console.log('   - activa = true');
      return;
    }

    console.log(`✅ Encontradas ${reglasGlobales.length} regla(s) global(es):\n`);
    reglasGlobales.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.codigo} (${r.nombre})`);
      console.log(`      ID: ${r.id}`);
      console.log(`      esGlobal: ${r.esGlobal}`);
      console.log(`      tenantId: ${r.tenantId || 'NULL ✅'}`);
      console.log(`      activa: ${r.activa}`);
      console.log();
    });

    // 2. Listar todos los tenants
    console.log('=' .repeat(60));
    console.log('\n🏢 PASO 2: TENANTS DISPONIBLES\n');

    const tenants = await prisma.tenants.findMany({
      orderBy: { nombre: 'asc' }
    });

    console.log(`✅ Encontrados ${tenants.length} tenant(s):\n`);
    tenants.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.nombre} (${t.slug})`);
      console.log(`      ID: ${t.id}`);
      console.log();
    });

    // 3. Simular el endpoint GET /reglas/globales/disponibles para cada tenant
    console.log('=' .repeat(60));
    console.log('\n🌐 PASO 3: SIMULANDO ENDPOINT /reglas/globales/disponibles\n');

    for (const tenant of tenants) {
      console.log(`\n📊 TENANT: ${tenant.nombre} (${tenant.id})`);
      console.log('-' .repeat(60));

      // Simular el código del endpoint
      const reglasConEstado = await Promise.all(
        reglasGlobales.map(async (regla) => {
          const vinculo = await prisma.tenant_reglas_globales.findUnique({
            where: {
              tenantId_reglaGlobalId: {
                tenantId: tenant.id,
                reglaGlobalId: regla.id
              }
            }
          });

          return {
            codigo: regla.codigo,
            nombre: regla.nombre,
            id: regla.id,
            activaEnTenant: !!vinculo,
            vinculoId: vinculo?.id || null,
            vinculoActiva: vinculo?.activa || null
          };
        })
      );

      console.log('\nReglas que vería este tenant en el modal:\n');
      reglasConEstado.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.codigo}`);
        console.log(`      activaEnTenant: ${r.activaEnTenant} ${r.activaEnTenant ? '✅' : '❌'}`);
        console.log(`      Vínculo existe: ${r.vinculoId ? 'SÍ' : 'NO'}`);
        if (r.vinculoId) {
          console.log(`      Vínculo ID: ${r.vinculoId}`);
          console.log(`      Vínculo activa: ${r.vinculoActiva}`);
        }
        console.log(`      Estado visual: ${r.activaEnTenant ? 'bg-green-50 (verde)' : 'bg-white (blanco)'}`);
        console.log(`      Botón: ${r.activaEnTenant ? 'DESACTIVAR' : 'ACTIVAR'}`);
        console.log();
      });
    }

    // 4. Verificar tabla tenant_reglas_globales
    console.log('=' .repeat(60));
    console.log('\n🔗 PASO 4: REGISTROS EN tenant_reglas_globales\n');

    const vinculos = await prisma.tenant_reglas_globales.findMany({
      include: {
        tenants: { select: { nombre: true } },
        reglas_negocio: { select: { codigo: true } }
      },
      orderBy: [
        { tenants: { nombre: 'asc' } },
        { reglas_negocio: { codigo: 'asc' } }
      ]
    });

    if (vinculos.length === 0) {
      console.log('⚠️  NO HAY VÍNCULOS EN tenant_reglas_globales');
      console.log('   Esto significa que ningún tenant tiene reglas globales activadas.');
      console.log('   Todas las reglas aparecerán con activaEnTenant=false');
    } else {
      console.log(`✅ Encontrados ${vinculos.length} vínculo(s):\n`);
      vinculos.forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.tenants.nombre} → ${v.reglas_negocio.codigo}`);
        console.log(`      ID: ${v.id}`);
        console.log(`      tenantId: ${v.tenantId}`);
        console.log(`      reglaGlobalId: ${v.reglaGlobalId}`);
        console.log(`      activa: ${v.activa}`);
        console.log(`      createdAt: ${v.createdAt}`);
        console.log();
      });
    }

    // 5. Resumen
    console.log('=' .repeat(60));
    console.log('\n📝 RESUMEN Y VERIFICACIÓN\n');
    console.log('✅ Para que una regla global se muestre ACTIVADA en el modal:');
    console.log('   1. La regla debe tener esGlobal=true y tenantId=NULL');
    console.log('   2. Debe existir un registro en tenant_reglas_globales con:');
    console.log('      - tenantId = ID del tenant actual');
    console.log('      - reglaGlobalId = ID de la regla');
    console.log();
    console.log('❌ Para que se muestre DESACTIVADA:');
    console.log('   1. La regla existe con esGlobal=true y tenantId=NULL');
    console.log('   2. NO existe registro en tenant_reglas_globales para ese tenant');
    console.log();

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosticoCompleto()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
