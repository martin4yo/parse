const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanMenu() {
  console.log('🧹 Limpiando menú de Parse...\n');

  try {
    // Eliminar items de menú no necesarios para Parse
    const itemsToDelete = [
      'Rendiciones',
      'Rendición Efectivo',
      'Comprobantes',
      'Comprobantes Efectivo',
      'Autorizaciones',
      'Reportes',
      'Exportar',
      'Tarjetas',
      'Tesorería',
      'Adelantos',
      'Pagos',
      'Liquidación',
      'Estado de Cuenta',
      'Devoluciones',
      'DKT',
      'Importar DKT'
    ];

    console.log('📋 Items a eliminar:');
    itemsToDelete.forEach(item => console.log(`   - ${item}`));

    // Eliminar por título
    const result = await prisma.menu_items.deleteMany({
      where: {
        title: {
          in: itemsToDelete
        }
      }
    });

    console.log(`\n✅ ${result.count} items eliminados del menú\n`);

    // Mostrar items que quedan
    console.log('📊 Items de menú restantes:\n');
    const remainingItems = await prisma.menu_items.findMany({
      where: {
        parentId: null
      },
      include: {
        children: true
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    remainingItems.forEach(item => {
      console.log(`✅ ${item.title} (${item.icon})`);
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => {
          console.log(`   └─ ${child.title} → ${child.url || 'Sin URL'}`);
        });
      } else if (item.url) {
        console.log(`   → ${item.url}`);
      }
      console.log('');
    });

    console.log('✨ Menú limpiado exitosamente!');

  } catch (error) {
    console.error('❌ Error limpiando menú:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanMenu();
