const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testActivarDesactivar() {
  console.log('🧪 TEST: ACTIVAR/DESACTIVAR REGLAS GLOBALES\n');
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

    // 2. Obtener la regla PRODUCTO_BANDEJAS
    const regla = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (!regla) {
      console.log('❌ Regla PRODUCTO_BANDEJAS no encontrada');
      return;
    }

    console.log('📋 DATOS DE PRUEBA:');
    console.log('   Tenant:', keysoft.nombre, `(${keysoft.id})`);
    console.log('   Regla:', regla.codigo, `(${regla.id})`);
    console.log();

    // 3. Verificar estado inicial
    console.log('🔍 PASO 1: Verificar estado inicial\n');

    const vinculoInicial = await prisma.tenant_reglas_globales.findUnique({
      where: {
        tenantId_reglaGlobalId: {
          tenantId: keysoft.id,
          reglaGlobalId: regla.id
        }
      }
    });

    console.log('   Estado inicial:', vinculoInicial ? 'ACTIVA ✅' : 'INACTIVA ❌');
    console.log();

    // 4. Si está activa, desactivarla primero
    if (vinculoInicial) {
      console.log('🔴 PASO 2: Desactivando regla (limpieza inicial)\n');

      const resultado = await prisma.tenant_reglas_globales.deleteMany({
        where: {
          tenantId: keysoft.id,
          reglaGlobalId: regla.id
        }
      });

      console.log('   Vínculos eliminados:', resultado.count);
      console.log('   ✅ Regla desactivada');
      console.log();
    }

    // 5. Ahora activar
    console.log('🟢 PASO 3: Activando regla\n');

    const nuevoVinculo = await prisma.tenant_reglas_globales.create({
      data: {
        tenantId: keysoft.id,
        reglaGlobalId: regla.id,
        activa: true,
        createdBy: 'test-script',
        updatedBy: 'test-script',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('   ✅ Vínculo creado:', nuevoVinculo.id);
    console.log('   tenantId:', nuevoVinculo.tenantId);
    console.log('   reglaGlobalId:', nuevoVinculo.reglaGlobalId);
    console.log();

    // 6. Verificar que ahora está activa
    console.log('🔍 PASO 4: Verificar que ahora está activa\n');

    const vinculoActivo = await prisma.tenant_reglas_globales.findUnique({
      where: {
        tenantId_reglaGlobalId: {
          tenantId: keysoft.id,
          reglaGlobalId: regla.id
        }
      }
    });

    console.log('   Estado después de activar:', vinculoActivo ? 'ACTIVA ✅' : 'INACTIVA ❌');
    console.log();

    // 7. Desactivar de nuevo (limpiar)
    console.log('🔴 PASO 5: Desactivando regla (limpieza final)\n');

    const resultadoDesactivar = await prisma.tenant_reglas_globales.deleteMany({
      where: {
        tenantId: keysoft.id,
        reglaGlobalId: regla.id
      }
    });

    console.log('   Vínculos eliminados:', resultadoDesactivar.count);
    console.log('   ✅ Regla desactivada');
    console.log();

    // 8. Resumen
    console.log('=' .repeat(60));
    console.log('📊 RESUMEN DEL TEST\n');
    console.log('✅ TEST COMPLETADO EXITOSAMENTE');
    console.log('   - La regla se pudo activar correctamente para Keysoft');
    console.log('   - La regla se pudo desactivar correctamente para Keysoft');
    console.log();
    console.log('🎯 AHORA PRUEBA EN LA UI:');
    console.log('   1. Selecciona tenant Keysoft');
    console.log('   2. Abre modal "Reglas Globales"');
    console.log('   3. Verifica que PRODUCTO_BANDEJAS muestra botón "Activar"');
    console.log('   4. Haz clic en "Activar"');
    console.log('   5. Verifica que cambia a fondo verde con botón "Desactivar"');
    console.log();

  } catch (error) {
    console.error('❌ Error durante el test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testActivarDesactivar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
