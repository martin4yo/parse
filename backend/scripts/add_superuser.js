const { PrismaClient } = require('@prisma/client');

async function addSuperuserSupport() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Agregando soporte para superuser...\n');

    // 1. Agregar campo superuser a la tabla users
    console.log('1️⃣ Agregando campo superuser...');
    await prisma.$executeRaw`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "superuser" BOOLEAN DEFAULT false
    `;

    // 2. Hacer tenantId opcional (permitir NULL para superusers sin tenant por defecto)
    console.log('2️⃣ Haciendo tenantId opcional...');
    await prisma.$executeRaw`
      ALTER TABLE "users"
      ALTER COLUMN "tenantId" DROP NOT NULL
    `;

    // 3. Marcar el admin como superuser
    console.log('3️⃣ Marcando admin como superuser...');
    await prisma.$executeRaw`
      UPDATE "users"
      SET "superuser" = true
      WHERE "email" = 'admin@rendiciones.com'
    `;

    // 4. Verificación
    console.log('\n✅ Verificando cambios...');

    const superusers = await prisma.$queryRaw`
      SELECT "email", "nombre", "apellido", "superuser", "tenantId"
      FROM "users"
      WHERE "superuser" = true
    `;

    console.log('👑 Superusers encontrados:');
    superusers.forEach(user => {
      console.log(`   - ${user.nombre} ${user.apellido} (${user.email}) - Tenant: ${user.tenantId || 'Sin tenant'}`);
    });

    const totalUsers = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "users"`;
    console.log(`\n📊 Total usuarios: ${totalUsers[0].count}`);

    console.log('\n🎉 ¡Soporte para superuser agregado exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la actualización:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar actualización
addSuperuserSupport()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });