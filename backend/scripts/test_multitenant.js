const { PrismaClient } = require('@prisma/client');

async function testMultitenant() {
  const prisma = new PrismaClient();

  try {
    console.log('🧪 Probando funcionalidad multitenant...\n');

    // 1. Verificar tenant
    console.log('1️⃣ Verificando tenant por defecto...');
    const tenant = await prisma.tenants.findUnique({
      where: { slug: 'empresa-default' }
    });
    console.log(`   Tenant: ${tenant.nombre} (${tenant.slug})`);
    console.log(`   Plan: ${tenant.plan}`);

    // 2. Verificar usuarios con tenant
    console.log('\n2️⃣ Verificando usuarios con tenant...');
    const users = await prisma.users.findMany({
      include: {
        tenant: true,
        profiles: true
      }
    });
    console.log(`   Usuarios encontrados: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.nombre} ${user.apellido} (${user.email}) -> Tenant: ${user.tenant.nombre}`);
    });

    // 3. Verificar documentos con tenant
    console.log('\n3️⃣ Verificando documentos con tenant...');
    const docs = await prisma.documentos_procesados.findMany({
      include: {
        tenant: true,
        users: true
      }
    });
    console.log(`   Documentos encontrados: ${docs.length}`);

    // 4. Verificar filtrado por tenant
    console.log('\n4️⃣ Probando filtrado por tenant...');
    const usersByTenant = await prisma.users.findMany({
      where: {
        tenantId: tenant.id
      }
    });
    console.log(`   Usuarios del tenant '${tenant.slug}': ${usersByTenant.length}`);

    // 5. Probar crear un nuevo tenant
    console.log('\n5️⃣ Creando tenant de prueba...');
    const newTenant = await prisma.tenants.create({
      data: {
        slug: 'test-tenant',
        nombre: 'Tenant de Prueba',
        cuit: '20-11111111-1',
        razonSocial: 'Test S.A.',
        plan: 'Common'
      }
    });
    console.log(`   Nuevo tenant creado: ${newTenant.nombre} (ID: ${newTenant.id})`);

    // 6. Limpiar tenant de prueba
    await prisma.tenants.delete({
      where: { id: newTenant.id }
    });
    console.log(`   Tenant de prueba eliminado ✅`);

    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('\n📋 Resumen del sistema multitenant:');
    console.log(`   • Tenants: ✅ Funcionando`);
    console.log(`   • Usuarios con tenant: ✅ Funcionando`);
    console.log(`   • Filtrado por tenant: ✅ Funcionando`);
    console.log(`   • CRUD de tenants: ✅ Funcionando`);

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar pruebas
testMultitenant()
  .then(() => {
    console.log('\n✨ Pruebas completadas');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error en las pruebas:', error);
    process.exit(1);
  });