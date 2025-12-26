/**
 * Script para agregar el item de menu "Parse API Logs"
 * Ejecutar con: node scripts/add-parse-logs-menu.js
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function addParseLogsMenuItem() {
  try {
    console.log('Buscando menu padre de sincronizacion...');

    // Buscar el menu padre que contiene sync-admin o API Keys
    const parentMenu = await prisma.menu_items.findFirst({
      where: {
        OR: [
          { url: '/sync-admin' },
          { title: { contains: 'Sincronizacion' } },
          { title: { contains: 'API' } },
          { url: '/sync-admin/api-keys' }
        ],
        isActive: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    if (!parentMenu) {
      console.log('No se encontro menu padre. Creando como item de nivel superior...');
    } else {
      console.log(`Menu padre encontrado: "${parentMenu.title}" (${parentMenu.id})`);
    }

    // Verificar si ya existe el item
    const existingItem = await prisma.menu_items.findFirst({
      where: {
        url: '/sync-admin/parse-logs'
      }
    });

    if (existingItem) {
      console.log('El item de menu ya existe:', existingItem.id);
      return;
    }

    // Obtener el mayor orderIndex del padre para agregar al final
    const lastItem = await prisma.menu_items.findFirst({
      where: {
        parentId: parentMenu?.id || null
      },
      orderBy: { orderIndex: 'desc' }
    });

    const newOrderIndex = (lastItem?.orderIndex || 0) + 1;

    // Crear el nuevo item de menu
    const newMenuItem = await prisma.menu_items.create({
      data: {
        id: uuidv4(),
        parentId: parentMenu?.id || null,
        title: 'Parse API Logs',
        icon: 'FileText',
        url: '/sync-admin/parse-logs',
        description: 'Logs de procesamiento de documentos via Parse API',
        orderIndex: newOrderIndex,
        isActive: true,
        requiresPermission: null,
        superuserOnly: false,
        tenantId: null, // Disponible para todos los tenants
        updatedAt: new Date()
      }
    });

    console.log('Item de menu creado exitosamente:');
    console.log(`  ID: ${newMenuItem.id}`);
    console.log(`  Titulo: ${newMenuItem.title}`);
    console.log(`  URL: ${newMenuItem.url}`);
    console.log(`  Parent: ${newMenuItem.parentId || 'Nivel superior'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addParseLogsMenuItem();
