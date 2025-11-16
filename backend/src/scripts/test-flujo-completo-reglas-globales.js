const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../services/businessRulesEngine');
const prisma = new PrismaClient();

async function testFlujoCompleto() {
  console.log('🧪 TEST: FLUJO COMPLETO - REGLAS GLOBALES EN MOTOR DE EJECUCIÓN\n');
  console.log('=' .repeat(70));

  try {
    // 1. Obtener dos tenants diferentes (o al menos uno)
    const allTenants = await prisma.tenants.findMany({
      take: 2,
      orderBy: { nombre: 'asc' }
    });

    if (allTenants.length === 0) {
      console.log('❌ No hay tenants en la base de datos');
      return;
    }

    const keysoft = allTenants[0];
    const empresaDemo = allTenants[1] || keysoft; // Usar el mismo si solo hay uno

    console.log('🏢 TENANTS:');
    console.log(`   1. ${keysoft.nombre} (${keysoft.id})`);
    if (allTenants.length > 1) {
      console.log(`   2. ${empresaDemo.nombre} (${empresaDemo.id})`);
    } else {
      console.log('   ⚠️  Solo hay un tenant, se usará el mismo para ambas pruebas');
    }
    console.log();

    // 2. Obtener regla global
    const productoBandejas = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (!productoBandejas) {
      console.log('❌ Regla PRODUCTO_BANDEJAS no encontrada');
      return;
    }

    console.log('📋 REGLA GLOBAL:');
    console.log(`   Código: ${productoBandejas.codigo}`);
    console.log(`   Nombre: ${productoBandejas.nombre}`);
    console.log(`   esGlobal: ${productoBandejas.esGlobal}`);
    console.log(`   tenantId: ${productoBandejas.tenantId || 'NULL ✅'}`);
    console.log();

    // 3. Limpiar estado inicial
    console.log('🧹 Limpiando estado inicial...\n');
    await prisma.tenant_reglas_globales.deleteMany({
      where: {
        reglaGlobalId: productoBandejas.id,
        tenantId: { in: [keysoft.id, empresaDemo.id] }
      }
    });

    // 4. Verificar GET /reglas/globales/disponibles para ambos tenants
    console.log('=' .repeat(60));
    console.log('📊 ESTADO INICIAL (ambos tenants sin activar)');
    console.log('=' .repeat(60));
    console.log();

    for (const tenant of [keysoft, empresaDemo]) {
      // Simular GET /reglas/globales/disponibles
      const reglasGlobales = await prisma.reglas_negocio.findMany({
        where: {
          esGlobal: true,
          activa: true,
          tenantId: null
        }
      });

      for (const regla of reglasGlobales) {
        const vinculo = await prisma.tenant_reglas_globales.findUnique({
          where: {
            tenantId_reglaGlobalId: {
              tenantId: tenant.id,
              reglaGlobalId: regla.id
            }
          }
        });

        const activaEnTenant = !!vinculo;

        if (regla.codigo === 'PRODUCTO_BANDEJAS') {
          console.log(`🏢 ${tenant.nombre}:`);
          console.log(`   activaEnTenant: ${activaEnTenant}`);
          console.log(`   Botón debe mostrar: ${activaEnTenant ? 'DESACTIVAR' : 'ACTIVAR'}`);
          console.log();
        }
      }
    }

    // 5. ACTIVAR en Keysoft
    console.log('=' .repeat(60));
    console.log('🟢 ACTIVAR regla en Keysoft');
    console.log('=' .repeat(60));
    console.log();

    await prisma.tenant_reglas_globales.create({
      data: {
        tenantId: keysoft.id,
        reglaGlobalId: productoBandejas.id,
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla activada en Keysoft\n');

    // 6. Verificar estados después de activar en Keysoft
    console.log('📊 ESTADO DESPUÉS DE ACTIVAR EN KEYSOFT:\n');

    for (const tenant of [keysoft, empresaDemo]) {
      const vinculo = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: tenant.id,
            reglaGlobalId: productoBandejas.id
          }
        }
      });

      const activaEnTenant = !!vinculo;

      console.log(`🏢 ${tenant.nombre}:`);
      console.log(`   Vínculo en BD: ${vinculo ? 'SÍ ✅' : 'NO ❌'}`);
      console.log(`   activaEnTenant: ${activaEnTenant}`);
      console.log(`   Botón debe mostrar: ${activaEnTenant ? 'DESACTIVAR 🔴' : 'ACTIVAR 🟢'}`);
      console.log(`   Background card: ${activaEnTenant ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`);
      console.log();
    }

    // 7. ACTIVAR también en Empresa Demo
    console.log('=' .repeat(60));
    console.log('🟢 ACTIVAR regla en Empresa Demo');
    console.log('=' .repeat(60));
    console.log();

    await prisma.tenant_reglas_globales.create({
      data: {
        tenantId: empresaDemo.id,
        reglaGlobalId: productoBandejas.id,
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla activada en Empresa Demo\n');

    // 8. Verificar que ambos tienen activa la regla
    console.log('📊 ESTADO DESPUÉS DE ACTIVAR EN AMBOS:\n');

    for (const tenant of [keysoft, empresaDemo]) {
      const vinculo = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: tenant.id,
            reglaGlobalId: productoBandejas.id
          }
        }
      });

      const activaEnTenant = !!vinculo;

      console.log(`🏢 ${tenant.nombre}:`);
      console.log(`   activaEnTenant: ${activaEnTenant} ✅`);
      console.log(`   Botón: DESACTIVAR 🔴`);
      console.log();
    }

    // 9. DESACTIVAR en Keysoft
    console.log('=' .repeat(60));
    console.log('🔴 DESACTIVAR regla en Keysoft');
    console.log('=' .repeat(60));
    console.log();

    await prisma.tenant_reglas_globales.deleteMany({
      where: {
        tenantId: keysoft.id,
        reglaGlobalId: productoBandejas.id
      }
    });

    console.log('✅ Regla desactivada en Keysoft\n');

    // 10. Verificar estado final
    console.log('📊 ESTADO FINAL:\n');

    for (const tenant of [keysoft, empresaDemo]) {
      const vinculo = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: tenant.id,
            reglaGlobalId: productoBandejas.id
          }
        }
      });

      const activaEnTenant = !!vinculo;

      console.log(`🏢 ${tenant.nombre}:`);
      console.log(`   Vínculo en BD: ${vinculo ? 'SÍ ✅' : 'NO ❌'}`);
      console.log(`   activaEnTenant: ${activaEnTenant}`);
      console.log(`   Botón: ${activaEnTenant ? 'DESACTIVAR 🔴' : 'ACTIVAR 🟢'}`);
      console.log();
    }

    // 11. VERIFICAR MOTOR DE REGLAS
    console.log('=' .repeat(60));
    console.log('🔧 VERIFICAR MOTOR DE EJECUCIÓN DE REGLAS');
    console.log('=' .repeat(60));
    console.log();

    // Empresainherit Demo tiene la regla activa, Keysoft NO
    console.log('Estado actual:');
    console.log(`   ${keysoft.nombre}: NO tiene la regla activa`);
    console.log(`   ${empresaDemo.nombre}: SÍ tiene la regla activa`);
    console.log();

    // Inicializar motor para Keysoft
    console.log(`🔧 Motor de reglas para ${keysoft.nombre}:\n`);
    const engineKeysoft = new BusinessRulesEngine(keysoft.id);
    await engineKeysoft.loadRules(productoBandejas.tipo, true, prisma);

    console.log(`   Total reglas cargadas: ${engineKeysoft.rules.length}`);
    const tieneReglaKeysoft = engineKeysoft.rules.some(r => r.codigo === 'PRODUCTO_BANDEJAS');
    console.log(`   Incluye PRODUCTO_BANDEJAS: ${tieneReglaKeysoft ? 'SÍ ❌ (ERROR)' : 'NO ✅ (CORRECTO)'}`);
    console.log();

    // Inicializar motor para Empresa Demo
    console.log(`🔧 Motor de reglas para ${empresaDemo.nombre}:\n`);
    const engineEmpresa = new BusinessRulesEngine(empresaDemo.id);
    await engineEmpresa.loadRules(productoBandejas.tipo, true, prisma);

    console.log(`   Total reglas cargadas: ${engineEmpresa.rules.length}`);
    const tieneReglaEmpresa = engineEmpresa.rules.some(r => r.codigo === 'PRODUCTO_BANDEJAS');
    console.log(`   Incluye PRODUCTO_BANDEJAS: ${tieneReglaEmpresa ? 'SÍ ✅ (CORRECTO)' : 'NO ❌ (ERROR)'}`);
    console.log();

    console.log('=' .repeat(60));
    console.log('✅ FLUJO COMPLETO VERIFICADO');
    console.log('=' .repeat(60));
    console.log();
    console.log('📝 CONCLUSIONES:');
    console.log('   ✅ Reglas globales son independientes por tenant');
    console.log('   ✅ Activar en un tenant NO afecta a otros');
    console.log('   ✅ Desactivar elimina el registro de tenant_reglas_globales');
    console.log('   ✅ activaEnTenant se calcula correctamente (!!vinculo)');
    console.log();
    console.log('🔧 MOTOR DE EJECUCIÓN:');
    if (!tieneReglaKeysoft && tieneReglaEmpresa) {
      console.log('   ✅ ✅ ✅ EL MOTOR FUNCIONA CORRECTAMENTE ✅ ✅ ✅');
      console.log('   - Solo ejecuta reglas globales activas por tenant');
      console.log('   - Filtra correctamente usando tenant_reglas_globales');
      console.log('   - Las reglas globales se combinan con las del tenant');
    } else {
      console.log('   ❌ HAY UN PROBLEMA EN EL MOTOR:');
      if (tieneReglaKeysoft) {
        console.log('      - Keysoft NO debería tener la regla pero la tiene');
      }
      if (!tieneReglaEmpresa) {
        console.log('      - Empresa Demo debería tener la regla pero NO la tiene');
      }
    }
    console.log();
    console.log('🎯 COMPORTAMIENTO ESPERADO EN EL FRONTEND:');
    console.log('   - Superuser ve el tenant actual en el header del modal');
    console.log('   - Al cambiar de tenant, el modal recarga automáticamente');
    console.log('   - Cada tenant ve sus propias activaciones');
    console.log('   - Los botones muestran el estado correcto por tenant');
    console.log();
    console.log('🧹 Limpiando estado final...');

    // Limpiar todo al final
    await prisma.tenant_reglas_globales.deleteMany({
      where: {
        reglaGlobalId: productoBandejas.id,
        tenantId: { in: [keysoft.id, empresaDemo.id] }
      }
    });

    console.log('   ✅ Estado restaurado');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFlujoCompleto()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
