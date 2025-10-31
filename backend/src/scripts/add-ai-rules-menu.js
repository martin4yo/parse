const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function addAIRulesMenuItem() {
  try {
    console.log('🚀 Agregando ítem de menú "Reglas de IA"...\n');

    // Verificar si ya existe
    const existingItem = await prisma.menu_items.findFirst({
      where: {
        url: '/ai-rules'
      }
    });

    if (existingItem) {
      console.log('✅ El ítem de menú ya existe:');
      console.log(`   ID: ${existingItem.id}`);
      console.log(`   Título: ${existingItem.title}`);
      console.log(`   URL: ${existingItem.url}`);
      console.log(`   Activo: ${existingItem.isActive}\n`);
      return;
    }

    // Obtener el orderIndex más alto actual
    const maxOrderItem = await prisma.menu_items.findFirst({
      where: {
        parentId: null // Solo ítems de nivel superior
      },
      orderBy: {
        orderIndex: 'desc'
      }
    });

    const nextOrderIndex = (maxOrderItem?.orderIndex || 0) + 1;

    // Crear el nuevo ítem
    const newMenuItem = await prisma.menu_items.create({
      data: {
        id: uuidv4(),
        title: 'Reglas de IA',
        icon: 'Sparkles',
        url: '/ai-rules',
        description: 'Crea reglas de negocio usando lenguaje natural con inteligencia artificial',
        orderIndex: nextOrderIndex,
        isActive: true,
        requiresPermission: null,
        superuserOnly: false,
        tenantId: null, // Disponible para todos los tenants
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system'
      }
    });

    console.log('✅ Ítem de menú creado exitosamente:');
    console.log(`   ID: ${newMenuItem.id}`);
    console.log(`   Título: ${newMenuItem.title}`);
    console.log(`   Ícono: ${newMenuItem.icon}`);
    console.log(`   URL: ${newMenuItem.url}`);
    console.log(`   Orden: ${newMenuItem.orderIndex}`);
    console.log(`   Descripción: ${newMenuItem.description}`);
    console.log(`   Activo: ${newMenuItem.isActive}\n`);

    console.log('🎉 ¡Listo! El menú ahora incluye "Reglas de IA"');
    console.log('📱 Recarga la aplicación para ver el nuevo ítem en el menú.\n');

  } catch (error) {
    console.error('❌ Error agregando ítem de menú:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addAIRulesMenuItem();
