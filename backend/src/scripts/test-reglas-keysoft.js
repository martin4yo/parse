const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReglasKeysoft() {
  console.log('🧪 Probando endpoints de reglas para Keysoft...\n');

  try {
    // 1. Obtener tenant Keysoft
    const keysoft = await prisma.tenants.findFirst({
      where: { slug: 'keysoft' }
    });

    if (!keysoft) {
      console.log('❌ Tenant Keysoft no encontrado');
      return;
    }

    console.log('🏢 Tenant: Keysoft');
    console.log('   ID:', keysoft.id);
    console.log();

    // 2. Simular GET /reglas (reglas propias + globales activas)
    console.log('📋 SIMULANDO GET /reglas (lo que ve el usuario en la lista):\n');

    // Reglas propias
    const reglasPropias = await prisma.reglas_negocio.findMany({
      where: {
        esGlobal: false,
        tenantId: keysoft.id
      },
      orderBy: [{ prioridad: 'asc' }, { nombre: 'asc' }]
    });

    console.log(`   Reglas propias: ${reglasPropias.length}`);
    reglasPropias.forEach(r => {
      console.log(`     - ${r.codigo} (${r.nombre})`);
    });
    console.log();

    // Reglas globales activas
    const reglasGlobalesActivas = await prisma.tenant_reglas_globales.findMany({
      where: {
        tenantId: keysoft.id,
        activa: true
      },
      include: {
        reglas_negocio: true
      }
    });

    console.log(`   Reglas globales activas: ${reglasGlobalesActivas.length}`);
    reglasGlobalesActivas.forEach(trg => {
      console.log(`     - ${trg.reglas_negocio.codigo} (${trg.reglas_negocio.nombre})`);
    });
    console.log();

    const totalReglas = reglasPropias.length + reglasGlobalesActivas.length;
    console.log(`   TOTAL que debería ver: ${totalReglas} reglas`);
    console.log();

    // 3. Simular GET /reglas/globales/disponibles
    console.log('🌐 SIMULANDO GET /reglas/globales/disponibles:\n');

    const reglasGlobalesDisponibles = await prisma.reglas_negocio.findMany({
      where: {
        esGlobal: true,
        activa: true,
        tenantId: null
      },
      orderBy: [{ prioridad: 'asc' }, { nombre: 'asc' }]
    });

    console.log(`   Reglas globales disponibles: ${reglasGlobalesDisponibles.length}`);

    for (const regla of reglasGlobalesDisponibles) {
      // Verificar si Keysoft la tiene activa
      const vinculo = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: keysoft.id,
            reglaGlobalId: regla.id
          }
        }
      });

      const activaEnKeysoft = vinculo?.activa || false;
      const icono = activaEnKeysoft ? '✅' : '⭕';

      console.log(`     ${icono} ${regla.codigo} (${regla.nombre})`);
      console.log(`        activaEnTenant: ${activaEnKeysoft}`);
    }
    console.log();

    // 4. Verificar específicamente PRODUCTO_BANDEJAS
    console.log('🔍 VERIFICACIÓN ESPECÍFICA: PRODUCTO_BANDEJAS\n');

    const productoBandejas = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (productoBandejas) {
      console.log('   Regla encontrada:');
      console.log('     esGlobal:', productoBandejas.esGlobal);
      console.log('     tenantId:', productoBandejas.tenantId || 'NULL ✅');
      console.log('     activa:', productoBandejas.activa);
      console.log();

      const vinculoKeysoft = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: keysoft.id,
            reglaGlobalId: productoBandejas.id
          }
        }
      });

      console.log('   Vínculo en Keysoft:', vinculoKeysoft ? 'SÍ' : 'NO');
      if (vinculoKeysoft) {
        console.log('     Activa:', vinculoKeysoft.activa);
      }
      console.log();

      console.log('   ¿Debería aparecer en GET /reglas?', vinculoKeysoft?.activa ? 'SÍ ✅' : 'NO ❌');
      console.log('   ¿Debería aparecer en GET /reglas/globales/disponibles?', 'SÍ ✅');
      console.log('   ¿Debe mostrar activaEnTenant=true?', vinculoKeysoft?.activa ? 'SÍ' : 'NO');
    } else {
      console.log('   ❌ Regla PRODUCTO_BANDEJAS no encontrada');
    }

    console.log();
    console.log('=' .repeat(60));
    console.log('✅ Prueba completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReglasKeysoft()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
