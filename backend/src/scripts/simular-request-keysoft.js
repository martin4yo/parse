const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simularRequestKeysoft() {
  console.log('🔍 SIMULANDO GET /reglas/globales/disponibles para KEYSOFT\n');
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

    console.log('🏢 TENANT: Keysoft');
    console.log('   ID:', keysoft.id);
    console.log('   Nombre:', keysoft.nombre);
    console.log();

    // 2. Simular el código exacto del endpoint
    const tenantId = keysoft.id; // Este es el que viene en req.user.tenantId

    console.log('📋 PASO 1: Buscar reglas globales\n');

    const reglasGlobales = await prisma.reglas_negocio.findMany({
      where: {
        esGlobal: true,
        activa: true,
        tenantId: null
      },
      orderBy: [
        { prioridad: 'asc' },
        { nombre: 'asc' }
      ],
      include: {
        _count: {
          select: {
            reglas_ejecuciones: true,
            tenant_reglas_globales: true
          }
        }
      }
    });

    console.log(`   Reglas globales encontradas: ${reglasGlobales.length}`);
    reglasGlobales.forEach(r => {
      console.log(`   - ${r.codigo} (${r.nombre})`);
    });
    console.log();

    // 3. Para cada regla, verificar si Keysoft la tiene activa
    console.log('📋 PASO 2: Verificar vínculos en tenant_reglas_globales\n');

    const reglasConEstado = await Promise.all(
      reglasGlobales.map(async (regla) => {
        console.log(`   📌 Verificando: ${regla.codigo}`);
        console.log(`      reglaId: ${regla.id}`);
        console.log(`      Buscando vínculo con tenantId=${tenantId}`);

        const vinculo = await prisma.tenant_reglas_globales.findUnique({
          where: {
            tenantId_reglaGlobalId: {
              tenantId,
              reglaGlobalId: regla.id
            }
          }
        });

        const activaEnTenant = !!vinculo;

        console.log(`      Vínculo encontrado: ${vinculo ? 'SÍ ✅' : 'NO ❌'}`);
        if (vinculo) {
          console.log(`      Vínculo ID: ${vinculo.id}`);
          console.log(`      Vínculo activa: ${vinculo.activa}`);
        }
        console.log(`      activaEnTenant calculado: ${activaEnTenant}`);
        console.log();

        return {
          id: regla.id,
          codigo: regla.codigo,
          nombre: regla.nombre,
          tipo: regla.tipo,
          activa: regla.activa,
          prioridad: regla.prioridad,
          activaEnTenant: activaEnTenant,
          prioridadOverride: vinculo?.prioridadOverride,
          configuracionOverride: vinculo?.configuracionOverride,
          _count: regla._count
        };
      })
    );

    // 4. Mostrar resultado final
    console.log('=' .repeat(60));
    console.log('📤 RESPUESTA QUE RECIBIRÍA EL FRONTEND:\n');

    console.log(JSON.stringify(reglasConEstado, null, 2));

    console.log();
    console.log('=' .repeat(60));
    console.log('📊 RESUMEN PARA KEYSOFT:\n');

    reglasConEstado.forEach(regla => {
      console.log(`   ${regla.codigo}:`);
      console.log(`      activaEnTenant: ${regla.activaEnTenant}`);
      console.log(`      Background: ${regla.activaEnTenant ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`);
      console.log(`      Badge "Activa": ${regla.activaEnTenant ? 'Visible ✅' : 'Oculto ❌'}`);
      console.log(`      Botón: ${regla.activaEnTenant ? 'DESACTIVAR 🔴' : 'ACTIVAR 🟢'}`);
      console.log();
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simularRequestKeysoft()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
