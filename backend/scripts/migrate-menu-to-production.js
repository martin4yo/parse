/**
 * Script para migrar la tabla menu_items de local a producción
 *
 * USO:
 * 1. Asegúrate de tener acceso a ambas bases de datos
 * 2. Configura las URLs de conexión abajo
 * 3. Ejecuta: node scripts/migrate-menu-to-production.js
 *
 * El script:
 * - Elimina TODOS los registros de menu_items en producción
 * - Inserta TODOS los registros de menu_items desde local
 */

const { PrismaClient } = require('@prisma/client');

// ============================================
// CONFIGURACIÓN - MODIFICAR SEGÚN TU ENTORNO
// ============================================

// Base de datos LOCAL (origen)
const LOCAL_DATABASE_URL = 'postgresql://postgres:Q27G4B98@localhost:5432/parse_db';

// Base de datos PRODUCCIÓN (destino)
const PRODUCTION_DATABASE_URL = 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/parse_db';

// ============================================

async function migrateMenuItems() {
  console.log('🚀 Iniciando migración de menu_items...\n');

  // Cliente para base local
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: LOCAL_DATABASE_URL
      }
    }
  });

  // Cliente para base de producción
  const prodPrisma = new PrismaClient({
    datasources: {
      db: {
        url: PRODUCTION_DATABASE_URL
      }
    }
  });

  try {
    // 1. Conectar a ambas bases
    console.log('📡 Conectando a base de datos LOCAL...');
    await localPrisma.$connect();
    console.log('✅ Conectado a LOCAL\n');

    console.log('📡 Conectando a base de datos PRODUCCIÓN...');
    await prodPrisma.$connect();
    console.log('✅ Conectado a PRODUCCIÓN\n');

    // 2. Obtener todos los menu_items de local
    console.log('📥 Obteniendo menu_items de LOCAL...');
    const localMenuItems = await localPrisma.menu_items.findMany({
      orderBy: [
        { parentId: 'asc' },
        { orderIndex: 'asc' }
      ]
    });
    console.log(`✅ Encontrados ${localMenuItems.length} items en LOCAL\n`);

    if (localMenuItems.length === 0) {
      console.log('⚠️  No hay items en la base local. Abortando.');
      return;
    }

    // Mostrar resumen de lo que se va a migrar
    console.log('📋 Items a migrar:');
    console.log('─'.repeat(60));
    localMenuItems.forEach(item => {
      const indent = item.parentId ? '   └─ ' : '';
      console.log(`${indent}${item.title} (${item.icon}) - ${item.url || 'sin URL'}`);
    });
    console.log('─'.repeat(60) + '\n');

    // 3. Eliminar todos los menu_items en producción
    console.log('🗑️  Eliminando menu_items en PRODUCCIÓN...');

    // Primero eliminamos hijos (los que tienen parentId)
    const deletedChildren = await prodPrisma.menu_items.deleteMany({
      where: {
        parentId: { not: null }
      }
    });
    console.log(`   Eliminados ${deletedChildren.count} items hijos`);

    // Luego eliminamos padres
    const deletedParents = await prodPrisma.menu_items.deleteMany({
      where: {
        parentId: null
      }
    });
    console.log(`   Eliminados ${deletedParents.count} items padres`);
    console.log('✅ Tabla limpiada\n');

    // 4. Insertar items en producción (primero padres, luego hijos)
    console.log('📤 Insertando menu_items en PRODUCCIÓN...');

    // Separar padres e hijos
    const parentItems = localMenuItems.filter(item => !item.parentId);
    const childItems = localMenuItems.filter(item => item.parentId);

    // Insertar padres primero
    console.log(`   Insertando ${parentItems.length} items padres...`);
    for (const item of parentItems) {
      await prodPrisma.menu_items.create({
        data: {
          id: item.id,
          parentId: item.parentId,
          title: item.title,
          icon: item.icon,
          url: item.url,
          description: item.description,
          orderIndex: item.orderIndex,
          isActive: item.isActive,
          requiresPermission: item.requiresPermission,
          superuserOnly: item.superuserOnly,
          tenantId: item.tenantId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy
        }
      });
    }

    // Insertar hijos después
    console.log(`   Insertando ${childItems.length} items hijos...`);
    for (const item of childItems) {
      await prodPrisma.menu_items.create({
        data: {
          id: item.id,
          parentId: item.parentId,
          title: item.title,
          icon: item.icon,
          url: item.url,
          description: item.description,
          orderIndex: item.orderIndex,
          isActive: item.isActive,
          requiresPermission: item.requiresPermission,
          superuserOnly: item.superuserOnly,
          tenantId: item.tenantId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy
        }
      });
    }

    console.log('✅ Todos los items insertados\n');

    // 5. Verificar
    console.log('🔍 Verificando migración...');
    const prodMenuItems = await prodPrisma.menu_items.findMany();
    console.log(`✅ PRODUCCIÓN ahora tiene ${prodMenuItems.length} items\n`);

    console.log('═'.repeat(60));
    console.log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR durante la migración:');
    console.error(error.message);

    if (error.code === 'P1001') {
      console.error('\n💡 No se puede conectar a la base de datos.');
      console.error('   Verifica que:');
      console.error('   - El servidor de base de datos esté corriendo');
      console.error('   - Las credenciales sean correctas');
      console.error('   - El firewall permita la conexión');
    }

    process.exit(1);
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Ejecutar
migrateMenuItems();
