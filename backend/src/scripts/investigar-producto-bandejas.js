const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigar() {
  console.log('🔍 Investigando regla PRODUCTO_BANDEJAS...\n');

  try {
    // 1. Buscar la regla PRODUCTO_BANDEJAS
    const regla = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (!regla) {
      console.log('❌ No se encontró la regla PRODUCTO_BANDEJAS');
      return;
    }

    console.log('📋 INFORMACIÓN DE LA REGLA:');
    console.log('  ID:', regla.id);
    console.log('  Código:', regla.codigo);
    console.log('  Nombre:', regla.nombre);
    console.log('  esGlobal:', regla.esGlobal);
    console.log('  activa:', regla.activa);
    console.log('  tenantId:', regla.tenantId || 'NULL');
    console.log('  createdAt:', regla.createdAt);
    console.log('  createdBy:', regla.createdBy || 'N/A');
    console.log();

    // 2. Buscar tenant Keysoft
    const keysoft = await prisma.tenants.findFirst({
      where: {
        OR: [
          { nombre: { contains: 'Keysoft', mode: 'insensitive' } },
          { slug: 'keysoft' }
        ]
      }
    });

    if (!keysoft) {
      console.log('❌ No se encontró el tenant Keysoft');
      return;
    }

    console.log('🏢 TENANT KEYSOFT:');
    console.log('  ID:', keysoft.id);
    console.log('  Nombre:', keysoft.nombre);
    console.log('  Slug:', keysoft.slug);
    console.log();

    // 3. Verificar si hay vínculo en tenant_reglas_globales
    const vinculo = await prisma.tenant_reglas_globales.findUnique({
      where: {
        tenantId_reglaGlobalId: {
          tenantId: keysoft.id,
          reglaGlobalId: regla.id
        }
      }
    });

    console.log('🔗 VÍNCULO EN tenant_reglas_globales:');
    if (vinculo) {
      console.log('  ✅ SÍ existe vínculo');
      console.log('  ID:', vinculo.id);
      console.log('  activa:', vinculo.activa);
      console.log('  prioridadOverride:', vinculo.prioridadOverride);
      console.log('  createdAt:', vinculo.createdAt);
      console.log('  createdBy:', vinculo.createdBy || 'N/A');
    } else {
      console.log('  ❌ NO existe vínculo');
    }
    console.log();

    // 4. Verificar todos los vínculos de esta regla
    const todosVinculos = await prisma.tenant_reglas_globales.findMany({
      where: { reglaGlobalId: regla.id },
      include: {
        tenants: {
          select: { nombre: true, slug: true }
        }
      }
    });

    console.log('🌐 TODOS LOS VÍNCULOS DE ESTA REGLA:');
    if (todosVinculos.length === 0) {
      console.log('  Ningún tenant tiene esta regla activada');
    } else {
      todosVinculos.forEach((v, i) => {
        console.log(`  ${i + 1}. Tenant: ${v.tenants.nombre} (${v.tenants.slug})`);
        console.log(`     Activa: ${v.activa}`);
        console.log(`     Creada: ${v.createdAt}`);
      });
    }
    console.log();

    // 5. Diagnóstico y recomendación
    console.log('=' .repeat(60));
    console.log('📊 DIAGNÓSTICO:');
    console.log('=' .repeat(60));

    if (regla.esGlobal === false || regla.esGlobal === null) {
      console.log('❌ PROBLEMA ENCONTRADO:');
      console.log('   La regla NO está marcada como global (esGlobal = false o null)');
      console.log('   pero aparece en Keysoft.');
      console.log();
      console.log('💡 CAUSA PROBABLE:');
      if (regla.tenantId === keysoft.id) {
        console.log('   ✓ La regla fue creada específicamente para Keysoft');
        console.log('   ✓ Es una regla PROPIA de Keysoft, NO una regla global');
      } else if (regla.tenantId) {
        console.log('   ✓ La regla pertenece a otro tenant:', regla.tenantId);
        console.log('   ⚠️  Esto no debería suceder - posible error');
      } else {
        console.log('   ✓ La regla no tiene tenant pero tampoco está marcada como global');
        console.log('   ⚠️  Estado inconsistente');
      }
      console.log();
      console.log('🔧 SOLUCIÓN:');
      console.log('   Opción 1: Convertir a global → UPDATE esGlobal=true, tenantId=NULL');
      console.log('   Opción 2: Dejar como regla específica de Keysoft');
    } else if (regla.esGlobal === true) {
      console.log('✅ La regla SÍ está marcada como global (esGlobal = true)');
      console.log();
      if (vinculo && vinculo.activa) {
        console.log('✅ Keysoft tiene la regla activada correctamente');
        console.log('   Esto es el comportamiento esperado.');
        console.log();
        console.log('💡 Si NO debería estar activa:');
        console.log('   → Desactivarla desde el modal "Reglas Globales"');
        console.log('   → O ejecutar: DELETE FROM tenant_reglas_globales WHERE id = \'' + vinculo.id + '\'');
      } else if (vinculo && !vinculo.activa) {
        console.log('⚠️  Keysoft tiene la regla pero está DESACTIVADA');
        console.log('   No debería aparecer en la lista.');
      } else {
        console.log('❌ Keysoft NO tiene vínculo pero la regla aparece activa');
        console.log('   ⚠️  Esto indica un BUG en el endpoint GET /reglas');
      }
    }

    console.log();

  } catch (error) {
    console.error('❌ Error durante la investigación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigar()
  .then(() => {
    console.log('\n✅ Investigación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
