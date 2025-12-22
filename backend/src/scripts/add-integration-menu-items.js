/**
 * Script para agregar items de menú de Integraciones
 *
 * Agrega:
 * - Sección "Integraciones" con subitems:
 *   - API Clients (OAuth)
 *   - API Connectors
 *
 * Ejecutar con: node src/scripts/add-integration-menu-items.js
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function addIntegrationMenuItems() {
  console.log('🚀 Iniciando creación de items de menú de Integraciones...\n');

  try {
    // 1. Verificar si ya existe la sección "Integraciones" o items individuales
    const existingItems = await prisma.menu_items.findMany({
      where: {
        OR: [
          { title: 'Integraciones' },
          { url: '/api-clients' },
          { url: '/api-connectors' }
        ],
        tenantId: null // Solo items globales
      }
    });

    if (existingItems.length > 0) {
      console.log('⚠️  Ya existen algunos items de menú:');
      existingItems.forEach(item => {
        console.log(`   - ${item.title} (${item.url || 'sin URL'})`);
      });
      console.log('\n¿Desea continuar? Los items existentes no se modificarán.');
    }

    // 2. Obtener el máximo orderIndex actual para posicionar al final
    const maxOrderResult = await prisma.menu_items.aggregate({
      _max: { orderIndex: true },
      where: { parentId: null, tenantId: null }
    });
    const baseOrderIndex = (maxOrderResult._max.orderIndex || 0) + 10;

    // 3. Crear sección padre "Integraciones" si no existe
    let integracionesSection = existingItems.find(i => i.title === 'Integraciones');

    if (!integracionesSection) {
      const sectionId = uuidv4();
      integracionesSection = await prisma.menu_items.create({
        data: {
          id: sectionId,
          parentId: null,
          title: 'Integraciones',
          icon: 'Globe',
          url: null, // Sección padre sin URL
          description: 'APIs y conectores externos',
          orderIndex: baseOrderIndex,
          isActive: true,
          superuserOnly: false,
          tenantId: null, // Global
          updatedAt: new Date()
        }
      });
      console.log('✅ Creada sección: Integraciones');
    } else {
      console.log('ℹ️  Sección "Integraciones" ya existe');
    }

    // 4. Crear sub-items
    const subItems = [
      {
        title: 'API Clients',
        icon: 'Key',
        url: '/api-clients',
        description: 'Gestión de clientes OAuth 2.0 para API pública',
        orderIndex: 1
      },
      {
        title: 'API Connectors',
        icon: 'Plug',
        url: '/api-connectors',
        description: 'Conectores bidireccionales PULL/PUSH',
        orderIndex: 2
      }
    ];

    for (const item of subItems) {
      const exists = existingItems.find(i => i.url === item.url);

      if (!exists) {
        await prisma.menu_items.create({
          data: {
            id: uuidv4(),
            parentId: integracionesSection.id,
            title: item.title,
            icon: item.icon,
            url: item.url,
            description: item.description,
            orderIndex: item.orderIndex,
            isActive: true,
            superuserOnly: false,
            tenantId: null, // Global
            updatedAt: new Date()
          }
        });
        console.log(`✅ Creado: ${item.title} → ${item.url}`);
      } else {
        console.log(`ℹ️  "${item.title}" ya existe`);
      }
    }

    console.log('\n✨ Items de menú creados exitosamente!');
    console.log('\nRecuerda recargar la página para ver los cambios en el sidebar.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
addIntegrationMenuItems()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
