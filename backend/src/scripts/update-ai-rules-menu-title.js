const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAIRulesMenuTitle() {
  try {
    console.log('🔄 Actualizando título del menú "Reglas de IA"...\n');

    // Buscar el ítem del menú por URL
    const menuItem = await prisma.menu_items.findFirst({
      where: {
        url: '/ai-rules'
      }
    });

    if (!menuItem) {
      console.log('⚠️  No se encontró el ítem del menú con URL /ai-rules');
      console.log('💡 Ejecuta primero: node src/scripts/add-ai-rules-menu.js\n');
      return;
    }

    console.log('📋 Ítem encontrado:');
    console.log(`   ID: ${menuItem.id}`);
    console.log(`   Título actual: ${menuItem.title}\n`);

    // Actualizar el título
    const updatedMenuItem = await prisma.menu_items.update({
      where: {
        id: menuItem.id
      },
      data: {
        title: 'Reglas de IA',
        updatedAt: new Date(),
        updatedBy: 'system'
      }
    });

    console.log('✅ Título actualizado exitosamente:');
    console.log(`   Título nuevo: ${updatedMenuItem.title}`);
    console.log(`   Actualizado: ${updatedMenuItem.updatedAt}\n`);

    console.log('🎉 ¡Listo! Recarga la aplicación para ver el cambio.\n');

  } catch (error) {
    console.error('❌ Error actualizando título del menú:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateAIRulesMenuTitle();
