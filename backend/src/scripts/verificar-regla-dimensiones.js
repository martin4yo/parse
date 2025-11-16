const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verificarReglaDimensiones() {
  console.log('🔍 Verificando estado de REGLA_DIMENSIONES en la tabla tenant_reglas_globales...\n');

  try {
    // 1. Buscar la regla REGLA_DIMENSIONES
    const reglaDimensiones = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'REGLA_DIMENSIONES' }
    });

    if (!reglaDimensiones) {
      console.log('❌ Regla REGLA_DIMENSIONES no encontrada');
      return;
    }

    console.log('📋 REGLA ENCONTRADA:');
    console.log(`   Código: ${reglaDimensiones.codigo}`);
    console.log(`   Nombre: ${reglaDimensiones.nombre}`);
    console.log(`   ID: ${reglaDimensiones.id}`);
    console.log(`   esGlobal: ${reglaDimensiones.esGlobal}`);
    console.log(`   tenantId: ${reglaDimensiones.tenantId || 'NULL'}`);
    console.log();

    // 2. Obtener todos los tenants
    const tenants = await prisma.tenants.findMany({
      orderBy: { nombre: 'asc' }
    });

    console.log(`🏢 TENANTS (${tenants.length} encontrados):\n`);

    // 3. Para cada tenant, verificar si tiene la regla activada
    for (const tenant of tenants) {
      console.log(`📊 ${tenant.nombre} (${tenant.slug}):`);

      // Buscar vínculo en tenant_reglas_globales
      const vinculo = await prisma.tenant_reglas_globales.findUnique({
        where: {
          tenantId_reglaGlobalId: {
            tenantId: tenant.id,
            reglaGlobalId: reglaDimensiones.id
          }
        }
      });

      const activaEnTenant = !!vinculo;

      console.log(`   Registro en tenant_reglas_globales: ${vinculo ? 'SÍ ✅' : 'NO ❌'}`);
      if (vinculo) {
        console.log(`   ID del vínculo: ${vinculo.id}`);
        console.log(`   activa (campo): ${vinculo.activa}`);
        console.log(`   createdAt: ${vinculo.createdAt}`);
      }
      console.log(`   activaEnTenant (frontend): ${activaEnTenant}`);
      console.log(`   Estado visual: ${activaEnTenant ? 'bg-green-50 border-green-200 + Badge "Activa"' : 'bg-white border-gray-200'}`);
      console.log(`   Botón muestra: ${activaEnTenant ? 'DESACTIVAR' : 'ACTIVAR'}`);
      console.log();
    }

    console.log('=' .repeat(60));
    console.log('✅ Verificación completada');
    console.log();
    console.log('💡 EXPLICACIÓN:');
    console.log('   - Si existe registro en tenant_reglas_globales → activaEnTenant = true');
    console.log('   - Si NO existe registro → activaEnTenant = false');
    console.log('   - El campo "activa" en el registro ya no se usa (siempre true)');
    console.log('   - La presencia del registro indica que está activada');
    console.log('   - La ausencia del registro indica que está desactivada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarReglaDimensiones()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
