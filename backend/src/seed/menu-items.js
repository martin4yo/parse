const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const menuData = [
  // 1. Dashboard (nivel 1 - sin hijos, directo)
  {
    id: 'menu_dashboard',
    parentId: null,
    title: 'Dashboard',
    icon: 'Home',
    url: '/dashboard',
    description: 'Vista principal con información resumida',
    orderIndex: 1,
    isActive: true,
    superuserOnly: false
  },

  // 2. Parse - Extracción de Documentos (nivel 1 - sin hijos, directo)
  {
    id: 'menu_parse',
    parentId: null,
    title: 'Parse',
    icon: 'ScanText',
    url: '/parse',
    description: 'Procesamiento y extracción de información de documentos',
    orderIndex: 2,
    isActive: true,
    superuserOnly: false
  },

  // 3. Exportar (nivel 1 - sin hijos, directo)
  {
    id: 'menu_exportar',
    parentId: null,
    title: 'Exportar',
    icon: 'Send',
    url: '/exportar',
    description: 'Exportación de documentos procesados a sistemas externos',
    orderIndex: 3,
    isActive: true,
    superuserOnly: false
  },

  // 4. Configuración (nivel 1 - con hijos)
  {
    id: 'menu_configuracion',
    parentId: null,
    title: 'Configuración',
    icon: 'Settings',
    url: null,
    description: 'Parámetros de la aplicación',
    orderIndex: 4,
    isActive: true,
    superuserOnly: false,
    children: [
      {
        id: 'menu_config_usuarios',
        title: 'Usuarios',
        icon: 'Users',
        url: '/usuarios',
        description: 'Gestión de usuarios',
        orderIndex: 1,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_menu',
        title: 'Menú',
        icon: 'Menu',
        url: '/admin/menu',
        description: 'Gestión del menú de navegación',
        orderIndex: 2,
        isActive: true,
        superuserOnly: true
      },
      {
        id: 'menu_config_parametros',
        title: 'Parámetros',
        icon: 'Settings',
        url: '/parametros',
        description: 'Definición de parámetros generales',
        orderIndex: 3,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_prompts',
        title: 'Prompts IA',
        icon: 'Sparkles',
        url: '/prompts-ia',
        description: 'Gestión de prompts de inteligencia artificial',
        orderIndex: 4,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_planes',
        title: 'Planes',
        icon: 'Package',
        url: '/configuracion/planes',
        description: 'Gestión de planes y features',
        orderIndex: 5,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_tenants',
        title: 'Tenants',
        icon: 'Building2',
        url: '/admin/tenants',
        description: 'Gestión de tenants',
        orderIndex: 6,
        isActive: true,
        superuserOnly: true
      },
      {
        id: 'menu_config_ia',
        title: 'Configuración IA',
        icon: 'Brain',
        url: '/ia-config',
        description: 'Configuración de proveedores de inteligencia artificial',
        orderIndex: 7,
        isActive: true,
        superuserOnly: false
      }
    ]
  },

  // 5. Sincronización (nivel 1 - con hijos - SOLO SUPERUSUARIOS)
  {
    id: 'menu_sincronizacion',
    parentId: null,
    title: 'Sincronización',
    icon: 'RefreshCw',
    url: null,
    description: 'Sistema de sincronización de datos',
    orderIndex: 5,
    isActive: true,
    superuserOnly: true,
    children: [
      {
        id: 'menu_sync_config',
        title: 'Configuraciones',
        icon: 'Settings',
        url: '/sync-admin',
        description: 'Configurar sincronizaciones',
        orderIndex: 1,
        isActive: true,
        superuserOnly: true
      },
      {
        id: 'menu_sync_apikeys',
        title: 'API Keys',
        icon: 'Key',
        url: '/sync-admin/api-keys',
        description: 'Gestionar claves de API',
        orderIndex: 2,
        isActive: true,
        superuserOnly: true
      }
    ]
  }
];

async function seedMenuItems() {
  console.log('🌱 Seeding menu items...');

  try {
    // Borrar todos los items de menú existentes
    await prisma.menu_items.deleteMany({});
    console.log('✅ Limpieza de items de menú existentes');

    // Insertar items en orden
    for (const item of menuData) {
      const { children, ...parentData } = item;

      // Crear item padre
      const now = new Date();
      const parent = await prisma.menu_items.create({
        data: {
          ...parentData,
          createdAt: now,
          updatedAt: now
        }
      });
      console.log(`✅ Creado: ${parent.title}`);

      // Crear items hijos si existen
      if (children && children.length > 0) {
        for (const childData of children) {
          const child = await prisma.menu_items.create({
            data: {
              ...childData,
              parentId: parent.id,
              createdAt: now,
              updatedAt: now
            }
          });
          console.log(`   ✅ Creado hijo: ${child.title}`);
        }
      }
    }

    console.log('✅ Seeding completado exitosamente');
  } catch (error) {
    console.error('❌ Error durante seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedMenuItems()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { seedMenuItems };
