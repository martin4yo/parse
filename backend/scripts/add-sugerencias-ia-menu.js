/**
 * Script para agregar item de menú "Sugerencias IA"
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function addMenuItems() {
  try {
    console.log('📋 Agregando ítem de menú "Sugerencias IA"...\n');

    // Obtener todos los tenants
    const tenants = await prisma.tenants.findMany({
      where: { activo: true }
    });

    console.log(`Encontrados ${tenants.length} tenants activos\n`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Procesando tenant: ${tenant.nombre} (${tenant.slug})`);

      // Verificar si ya existe el ítem
      const existingItem = await prisma.menu_items.findFirst({
        where: {
          tenantId: tenant.id,
          url: '/sugerencias-ia'
        }
      });

      if (existingItem) {
        console.log('   ⏭️  El ítem de menú ya existe');
        continue;
      }

      // Buscar el grupo "Configuración" o el orden máximo
      const configuracionItem = await prisma.menu_items.findFirst({
        where: {
          tenantId: tenant.id,
          title: 'Configuración'
        }
      });

      let parentId = null;
      let orderIndex = 100;

      if (configuracionItem) {
        parentId = configuracionItem.id;
        // Obtener el orden máximo de los hijos de Configuración
        const maxOrder = await prisma.menu_items.aggregate({
          where: {
            tenantId: tenant.id,
            parentId: configuracionItem.id
          },
          _max: {
            orderIndex: true
          }
        });
        orderIndex = (maxOrder._max.orderIndex || 0) + 10;
      }

      // Crear el ítem de menú
      await prisma.menu_items.create({
        data: {
          id: crypto.randomUUID(),
          title: 'Sugerencias IA',
          url: '/sugerencias-ia',
          icon: 'Sparkles',
          description: 'Clasificaciones automáticas pendientes de revisión',
          parentId,
          orderIndex,
          isActive: true,
          tenantId: tenant.id,
          requiresPermission: null,
          superuserOnly: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null
        }
      });

      console.log('   ✅ Ítem de menú creado');
    }

    console.log('\n✅ Proceso completado!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
addMenuItems();
