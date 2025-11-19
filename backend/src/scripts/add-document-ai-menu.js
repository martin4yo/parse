/**
 * Script para agregar opción de menú "Configuración Document AI"
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function addDocumentAIMenuItem() {
  try {
    console.log('🔧 Agregando opción de menú "Configuración Document AI"...\n');

    // Buscar el menú padre "IA" o crear si no existe
    let iaParent = await prisma.menu_items.findFirst({
      where: {
        title: 'IA',
        parentId: null
      }
    });

    if (!iaParent) {
      console.log('📋 Creando menú padre "IA"...');
      iaParent = await prisma.menu_items.create({
        data: {
          id: uuidv4(),
          parentId: null,
          title: 'IA',
          icon: 'Brain',
          orderIndex: 50,
          isActive: true,
          superuserOnly: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`✅ Menú padre "IA" creado: ${iaParent.id}\n`);
    } else {
      console.log(`✅ Menú padre "IA" encontrado: ${iaParent.id}\n`);
    }

    // Verificar si ya existe el item de Document AI
    const existingItem = await prisma.menu_items.findFirst({
      where: {
        title: 'Configuración Document AI',
        parentId: iaParent.id
      }
    });

    if (existingItem) {
      console.log(`⚠️  El item "Configuración Document AI" ya existe (${existingItem.id})`);
      console.log(`   URL: ${existingItem.url}`);
      return;
    }

    // Obtener el máximo orderIndex de los items hijos del menú IA
    const siblings = await prisma.menu_items.findMany({
      where: {
        parentId: iaParent.id
      },
      orderBy: {
        orderIndex: 'desc'
      },
      take: 1
    });

    const nextOrderIndex = siblings.length > 0 ? siblings[0].orderIndex + 1 : 1;

    // Crear el nuevo item de menú
    const newMenuItem = await prisma.menu_items.create({
      data: {
        id: uuidv4(),
        parentId: iaParent.id,
        title: 'Configuración Document AI',
        icon: 'FileSearch',
        url: '/document-ai-config',
        description: 'Configurar detección de tipos de comprobantes con Document AI',
        orderIndex: nextOrderIndex,
        isActive: true,
        superuserOnly: false,
        requiresPermission: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ Item de menú creado exitosamente:`);
    console.log(`   ID: ${newMenuItem.id}`);
    console.log(`   Título: ${newMenuItem.title}`);
    console.log(`   URL: ${newMenuItem.url}`);
    console.log(`   Orden: ${newMenuItem.orderIndex}`);
    console.log(`   Padre: ${iaParent.title} (${iaParent.id})`);

  } catch (error) {
    console.error('❌ Error agregando item de menú:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
addDocumentAIMenuItem()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });
