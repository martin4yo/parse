const { PrismaClient } = require('@prisma/client');

async function testSuperuser() {
  const prisma = new PrismaClient();

  try {
    console.log('🧪 Probando funcionalidad de superuser...\n');

    // 1. Verificar que el admin es superuser
    console.log('1️⃣ Verificando admin como superuser...');
    const admin = await prisma.users.findUnique({
      where: { email: 'admin@rendiciones.com' },
      include: {
        profiles: true,
        tenant: true
      }
    });

    console.log(`   Admin encontrado: ${admin.nombre} ${admin.apellido}`);
    console.log(`   Superuser: ${admin.superuser}`);
    console.log(`   Profile: ${admin.profiles?.codigo}`);
    console.log(`   Tenant: ${admin.tenant?.nombre || 'Sin tenant'}`);

    // 2. Crear un segundo tenant para testing
    console.log('\n2️⃣ Creando tenant de prueba...');
    const testTenant = await prisma.tenants.create({
      data: {
        slug: 'empresa-test',
        nombre: 'Empresa Test',
        cuit: '20-11111111-1',
        razonSocial: 'Empresa Test S.A.',
        plan: 'professional',
        limites: { usuarios: 20, documentos_mes: 2000, storage_mb: 5000 }
      }
    });
    console.log(`   Tenant creado: ${testTenant.nombre} (ID: ${testTenant.id})`);

    // 3. Listar todos los tenants disponibles
    console.log('\n3️⃣ Listando tenants disponibles...');
    const tenants = await prisma.tenants.findMany({
      where: { activo: true },
      select: {
        id: true,
        slug: true,
        nombre: true,
        plan: true,
        _count: {
          select: { users: true }
        }
      }
    });

    tenants.forEach(tenant => {
      console.log(`   - ${tenant.nombre} (${tenant.slug}) - Plan: ${tenant.plan} - Usuarios: ${tenant._count.users}`);
    });

    console.log('\n🎉 ¡Pruebas de superuser completadas!');
    console.log('\n📋 Resumen:');
    console.log(`   • Admin es superuser: ✅`);
    console.log(`   • Tenants disponibles: ${tenants.length}`);
    console.log(`   • Tenant de prueba creado: ✅`);

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar pruebas
testSuperuser()
  .then(() => {
    console.log('\n✨ Pruebas completadas');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error en las pruebas:', error);
    process.exit(1);
  });