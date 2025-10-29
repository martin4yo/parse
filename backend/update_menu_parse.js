const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateMenuParse() {
  console.log('🔧 Actualizando menú para Parse...\n');

  try {
    // 1. Eliminar item "Autorización" que ya no existe
    console.log('❌ Eliminando "Autorización"...');
    await prisma.menu_items.deleteMany({
      where: {
        title: 'Autorización'
      }
    });

    // 2. Crear/actualizar item de Parse (funcionalidad principal)
    console.log('✅ Creando/actualizando item "Parse"...');

    const parseItem = await prisma.menu_items.upsert({
      where: {
        id: 'parse-main-item' // ID fijo para poder hacer upsert
      },
      update: {
        title: 'Parse',
        icon: 'ScanText',
        url: '/parse',
        description: 'Procesamiento y extracción de comprobantes',
        orderIndex: 10,
        isActive: true
      },
      create: {
        id: 'parse-main-item',
        title: 'Parse',
        icon: 'ScanText',
        url: '/parse',
        description: 'Procesamiento y extracción de comprobantes',
        orderIndex: 10,
        isActive: true,
        superuserOnly: false
      }
    });

    console.log('✅ Item Parse creado/actualizado');

    // 3. Verificar y actualizar orden de los items
    console.log('\n📊 Reordenando items...');

    const updates = [
      { title: 'Dashboard', orderIndex: 0 },
      { title: 'Parse', orderIndex: 10 },
      { title: 'Configuración', orderIndex: 20 },
      { title: 'Sincronización', orderIndex: 30 }
    ];

    for (const update of updates) {
      await prisma.menu_items.updateMany({
        where: { title: update.title, parentId: null },
        data: { orderIndex: update.orderIndex }
      });
    }

    // 4. Mostrar menú final
    console.log('\n✨ Menú actualizado:\n');
    const menuItems = await prisma.menu_items.findMany({
      where: {
        parentId: null
      },
      include: {
        children: {
          orderBy: {
            orderIndex: 'asc'
          }
        }
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    menuItems.forEach(item => {
      console.log(`📌 ${item.title} (${item.icon}) - Orden: ${item.orderIndex}`);
      if (item.url) {
        console.log(`   → ${item.url}`);
      }
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => {
          console.log(`   └─ ${child.title} → ${child.url || 'Sin URL'}`);
        });
      }
      console.log('');
    });

    console.log('✅ Menú de Parse configurado exitosamente!');

  } catch (error) {
    console.error('❌ Error actualizando menú:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMenuParse();
