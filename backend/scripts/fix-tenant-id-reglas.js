const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTenantId() {
  try {
    console.log('🔧 Corrigiendo tenantId en reglas nuevas...\n');

    // Paso 1: Obtener tenantId de una regla existente
    const reglaExistente = await prisma.reglas_negocio.findFirst({
      where: {
        tenantId: { not: null }
      },
      select: { tenantId: true, codigo: true }
    });

    if (!reglaExistente) {
      console.log('❌ No se encontró ninguna regla con tenantId');
      return;
    }

    const tenantId = reglaExistente.tenantId;
    console.log(`✅ TenantId encontrado: ${tenantId} (desde regla: ${reglaExistente.codigo})\n`);

    // Paso 2: Lista de códigos de reglas que creamos
    const reglasNuevas = [
      'PRODUCTO_BANDEJAS',
      'EXTRAER_ORDEN_COMPRA',
      'ASIGNAR_CUENTA_DESDE_PRODUCTO',
      'ASIGNAR_SUBCUENTA_CC001',
      'IMPUESTO_IVA_CUENTA',
      'IMPUESTO_IIBB_PBA_CUENTA'
    ];

    console.log('📋 Actualizando reglas:\n');

    // Paso 3: Actualizar cada regla
    for (const codigo of reglasNuevas) {
      const regla = await prisma.reglas_negocio.findUnique({
        where: { codigo }
      });

      if (!regla) {
        console.log(`   ⚠️  ${codigo}: No encontrada (puede que ya esté eliminada)`);
        continue;
      }

      if (regla.tenantId === tenantId) {
        console.log(`   ✓  ${codigo}: Ya tiene el tenantId correcto`);
        continue;
      }

      await prisma.reglas_negocio.update({
        where: { codigo },
        data: {
          tenantId: tenantId,
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ ${codigo}: TenantId actualizado`);
    }

    // Paso 4: Verificar resultado final
    console.log('\n📊 Verificando resultado:\n');

    const todasLasReglas = await prisma.reglas_negocio.findMany({
      where: {
        tenantId: tenantId,
        activa: true
      },
      orderBy: { prioridad: 'asc' },
      select: {
        prioridad: true,
        codigo: true,
        nombre: true,
        tipo: true
      }
    });

    console.log(`Total de reglas activas con tenantId ${tenantId}: ${todasLasReglas.length}\n`);

    todasLasReglas.forEach(r => {
      console.log(`   ${r.prioridad}. ${r.nombre}`);
      console.log(`      Código: ${r.codigo}, Tipo: ${r.tipo}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
fixTenantId()
  .then(() => {
    console.log('\n✨ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
