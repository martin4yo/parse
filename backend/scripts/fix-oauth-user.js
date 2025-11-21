const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixOAuthUser() {
  try {
    // Buscar usuarios con googleId pero sin tenantId
    const usersWithoutTenant = await prisma.users.findMany({
      where: {
        googleId: { not: null },
        tenantId: null
      }
    });

    console.log(`Found ${usersWithoutTenant.length} OAuth users without tenant`);

    if (usersWithoutTenant.length === 0) {
      console.log('No users to fix');
      return;
    }

    // Buscar el primer tenant activo
    const defaultTenant = await prisma.tenants.findFirst({
      where: { activo: true }
    });

    if (!defaultTenant) {
      console.error('No active tenant found!');
      return;
    }

    console.log(`Default tenant: ${defaultTenant.nombre} (${defaultTenant.id})`);

    // Actualizar cada usuario
    for (const user of usersWithoutTenant) {
      await prisma.users.update({
        where: { id: user.id },
        data: { tenantId: defaultTenant.id }
      });
      console.log(`✅ Updated user: ${user.email} - assigned tenant: ${defaultTenant.nombre}`);
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOAuthUser();
