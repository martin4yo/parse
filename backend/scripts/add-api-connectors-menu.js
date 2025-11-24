const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addApiConnectorsMenu() {
  try {
    console.log('🔧 Agregando entrada de menú para API Connectors...');

    // Obtener todos los tenants
    const tenants = await prisma.tenants.findMany();

    for (const tenant of tenants) {
      console.log(`\n📋 Procesando tenant: ${tenant.nombre}`);

      // Verificar si ya existe la entrada
      const existing = await prisma.menu_items.findFirst({
        where: {
          tenantId: tenant.id,
          url: '/api-connectors'
        }
      });

      if (existing) {
        console.log(`  ℹ️  Entrada de menú ya existe para ${tenant.nombre}`);
        continue;
      }

      // Obtener el orden máximo actual
      const maxOrder = await prisma.menu_items.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true }
      });

      const nextOrder = (maxOrder?.orderIndex || 0) + 1;

      // Generar ID único
      const menuId = `menu-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Crear entrada de menú
      await prisma.menu_items.create({
        data: {
          id: menuId,
          tenantId: tenant.id,
          title: 'API Connectors',
          url: '/api-connectors',
          icon: 'ArrowLeftRight',
          description: 'Sincronización bidireccional con sistemas externos',
          orderIndex: nextOrder,
          isActive: true,
          superuserOnly: false,
          updatedAt: new Date()
        }
      });

      console.log(`  ✅ Entrada de menú creada: API Connectors (orden: ${nextOrder})`);
    }

    console.log('\n✅ Proceso completado exitosamente');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addApiConnectorsMenu();
