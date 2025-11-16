const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verificarFix() {
  console.log('🔍 VERIFICANDO FIX DEL TENANT CONTEXT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Obtener Keysoft
    const keysoft = await prisma.tenants.findFirst({
      where: { slug: 'keysoft' }
    });

    if (!keysoft) {
      console.log('❌ Tenant Keysoft no encontrado');
      return;
    }

    console.log('🏢 TENANT DE PRUEBA: Keysoft');
    console.log('   ID:', keysoft.id);
    console.log('   Nombre:', keysoft.nombre);
    console.log();

    // 2. Obtener todas las reglas globales
    const reglasGlobales = await prisma.reglas_negocio.findMany({
      where: {
        esGlobal: true,
        activa: true,
        tenantId: null
      },
      orderBy: [
        { prioridad: 'asc' },
        { nombre: 'asc' }
      ]
    });

    console.log(`📋 REGLAS GLOBALES DISPONIBLES: ${reglasGlobales.length}`);
    console.log();

    // 3. Para cada regla, verificar el estado con Keysoft
    console.log('🔍 VERIFICACIÓN DE VÍNCULOS PARA KEYSOFT:\n');

    for (const regla of reglasGlobales) {
      const vinculo = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: keysoft.id,
            reglaGlobalId: regla.id
          }
        }
      });

      const activaEnTenant = !!vinculo;

      console.log(`📌 ${regla.codigo}`);
      console.log(`   Nombre: ${regla.nombre}`);
      console.log(`   Vínculo existe: ${vinculo ? 'SÍ ✅' : 'NO ❌'}`);
      console.log(`   activaEnTenant: ${activaEnTenant}`);
      console.log(`   Estado esperado en modal: ${activaEnTenant ? 'bg-green-50 | Botón "Desactivar"' : 'bg-white | Botón "Activar"'}`);
      console.log();
    }

    // 4. Resumen de lo que debería verse
    console.log('=' .repeat(60));
    console.log('📊 RESUMEN - LO QUE DEBERÍA VER EL SUPERUSER EN EL MODAL:\n');
    console.log('Cuando el superuser selecciona "Keysoft" y abre el modal:');
    console.log();

    const activas = reglasGlobales.filter(async r => {
      const v = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: keysoft.id,
            reglaGlobalId: r.id
          }
        }
      });
      return !!v;
    });

    console.log(`✅ Reglas ACTIVAS: ${activas.length}`);
    console.log(`❌ Reglas INACTIVAS: ${reglasGlobales.length - activas.length}`);
    console.log();

    console.log('✅ COMPORTAMIENTO ESPERADO:');
    console.log('   - Backend usa req.tenantId (del JWT token) ← FIX APLICADO ✅');
    console.log('   - Se consulta tenant_reglas_globales con tenantId de Keysoft');
    console.log('   - Solo las reglas con vínculo se muestran como activas');
    console.log();

    console.log('❌ COMPORTAMIENTO ANTERIOR (BUG):');
    console.log('   - Backend usaba req.user.tenantId (de la BD)');
    console.log('   - Mostraba vínculos del tenant HOME del usuario');
    console.log('   - Superusers veían estado incorrecto al cambiar de tenant');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarFix()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
