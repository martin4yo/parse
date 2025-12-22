/**
 * Script para agregar Sync Clients al menú de Integraciones
 *
 * Ejecutar con: node src/scripts/add-sync-clients-menu.js
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function addSyncClientsMenuItem() {
  console.log('🚀 Agregando Sync Clients al menú...\n');

  try {
    // Buscar la sección "Integraciones"
    const integracionesSection = await prisma.menu_items.findFirst({
      where: {
        title: 'Integraciones',
        tenantId: null
      }
    });

    if (!integracionesSection) {
      console.log('❌ No se encontró la sección "Integraciones"');
      console.log('   Ejecuta primero: node src/scripts/add-integration-menu-items.js');
      return;
    }

    // Verificar si ya existe
    const existing = await prisma.menu_items.findFirst({
      where: {
        url: '/sync-clients',
        tenantId: null
      }
    });

    if (existing) {
      console.log('ℹ️  El item "Sync Clients" ya existe');
      return;
    }

    // Crear el item
    await prisma.menu_items.create({
      data: {
        id: uuidv4(),
        parentId: integracionesSection.id,
        title: 'Sync Clients',
        icon: 'Monitor',
        url: '/sync-clients',
        description: 'Clientes ejecutables que suben documentos',
        orderIndex: 3,
        isActive: true,
        superuserOnly: false,
        tenantId: null,
        updatedAt: new Date()
      }
    });

    console.log('✅ Creado: Sync Clients → /sync-clients');
    console.log('\n✨ Item agregado exitosamente!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addSyncClientsMenuItem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
