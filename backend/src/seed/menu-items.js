const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const menuData = [
  // 1. Dashboard (nivel 1 - con hijos)
  {
    id: 'menu_dashboard',
    parentId: null,
    title: 'Dashboard',
    icon: 'Home',
    url: null,
    description: 'Muestra información resumida de gestión',
    orderIndex: 1,
    isActive: true,
    superuserOnly: false,
    children: [
      {
        id: 'menu_dashboard_home',
        title: 'Dashboard',
        icon: 'Home',
        url: '/dashboard',
        description: 'Muestra información resumida de gestión',
        orderIndex: 1,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_dashboard_reportes',
        title: 'Reportes',
        icon: 'BarChart3',
        url: '/reportes',
        description: 'Reportes y estadísticas',
        orderIndex: 2,
        isActive: true,
        superuserOnly: false
      }
    ]
  },

  // 2. Comprobantes (nivel 1 - con hijos)
  {
    id: 'menu_comprobantes',
    parentId: null,
    title: 'Comprobantes',
    icon: 'FileCheck',
    url: null,
    description: 'Permite subir comprobantes de rendición',
    orderIndex: 2,
    isActive: true,
    superuserOnly: false,
    children: [
      {
        id: 'menu_comprobantes_efectivo',
        title: 'Efectivo',
        icon: 'Banknote',
        url: '/comprobantes-efectivo',
        description: 'Gestionar comprobantes de efectivo por cajas',
        orderIndex: 1,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_comprobantes_tarjeta',
        title: 'Tarjeta',
        icon: 'CreditCard',
        url: '/comprobantes?tipo=tarjeta',
        description: 'Enviar comprobantes para rendiciones de tarjeta',
        orderIndex: 2,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_comprobantes_parse',
        title: 'Comprobantes',
        icon: 'ScanText',
        url: '/parse',
        description: 'Procesamiento y extracción de información de comprobantes',
        orderIndex: 3,
        isActive: true,
        superuserOnly: false
      }
    ]
  },

  // 3. Rendiciones (nivel 1 - con hijos)
  {
    id: 'menu_rendiciones',
    parentId: null,
    title: 'Rendiciones',
    icon: 'FileText',
    url: null,
    description: 'Gestión de rendiciones de gastos',
    orderIndex: 3,
    isActive: true,
    superuserOnly: false,
    children: [
      {
        id: 'menu_rendiciones_efectivo',
        title: 'Efectivo',
        icon: 'Banknote',
        url: '/rendicion-efectivo',
        description: 'Gestionar rendiciones de efectivo',
        orderIndex: 1,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_rendiciones_tarjeta',
        title: 'Tarjeta',
        icon: 'CreditCard',
        url: '/rendiciones',
        description: 'Gestionar rendiciones de tarjeta',
        orderIndex: 2,
        isActive: true,
        superuserOnly: false
      }
    ]
  },

  // 4. Autorización (nivel 1 - sin hijos, con URL directa)
  {
    id: 'menu_autorizaciones',
    parentId: null,
    title: 'Autorización',
    icon: 'Shield',
    url: '/autorizaciones',
    description: 'Autorizar rendiciones de efectivo y tarjeta',
    orderIndex: 4,
    isActive: true,
    superuserOnly: false
  },

  // 5. Exportar (nivel 1 - sin hijos, con URL directa)
  {
    id: 'menu_exportar',
    parentId: null,
    title: 'Exportar',
    icon: 'Send',
    url: '/exportar',
    description: 'Control final de rendiciones y exportación a ERP externo',
    orderIndex: 5,
    isActive: true,
    superuserOnly: false
  },

  // 6. Tesorería (nivel 1 - con hijos)
  {
    id: 'menu_tesoreria',
    parentId: null,
    title: 'Tesorería',
    icon: 'DollarSign',
    url: null,
    description: 'Gestión de tesorería y movimientos financieros',
    orderIndex: 6,
    isActive: true,
    superuserOnly: false,
    children: [
      {
        id: 'menu_tesoreria_adelantos',
        title: 'Adelantos',
        icon: 'TrendingUp',
        url: '/tesoreria/adelantos',
        description: 'Solicitar y gestionar adelantos de efectivo',
        orderIndex: 1,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_tesoreria_pagos',
        title: 'Pagos',
        icon: 'ArrowUpCircle',
        url: '/tesoreria/pagos',
        description: 'Gestionar pagos de tesorería',
        orderIndex: 2,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_tesoreria_devoluciones',
        title: 'Devoluciones',
        icon: 'ArrowDownCircle',
        url: '/tesoreria/devoluciones',
        description: 'Gestionar devoluciones',
        orderIndex: 3,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_tesoreria_importar',
        title: 'Importar Resumen',
        icon: 'Download',
        url: '/dkt/importar',
        description: 'Importar resumen de tarjeta de crédito',
        orderIndex: 4,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_tesoreria_liquidacion',
        title: 'Liquidación',
        icon: 'Calculator',
        url: '/tesoreria/liquidacion',
        description: 'Liquidación de tarjetas de crédito',
        orderIndex: 5,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_tesoreria_estado',
        title: 'Estado de Cuenta',
        icon: 'FileBarChart',
        url: '/tesoreria/estado-cuenta',
        description: 'Informe de cuenta, saldos, movimientos',
        orderIndex: 6,
        isActive: true,
        superuserOnly: false
      }
    ]
  },

  // 7. Configuración (nivel 1 - con hijos)
  {
    id: 'menu_configuracion',
    parentId: null,
    title: 'Configuración',
    icon: 'Settings',
    url: null,
    description: 'Parámetros de la aplicación',
    orderIndex: 7,
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
        id: 'menu_config_parametros',
        title: 'Parámetros',
        icon: 'Settings',
        url: '/parametros',
        description: 'Definición de parámetros generales',
        orderIndex: 2,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_prompts',
        title: 'Prompts IA',
        icon: 'Sparkles',
        url: '/prompts-ia',
        description: 'Gestión de prompts de inteligencia artificial',
        orderIndex: 3,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_planes',
        title: 'Planes',
        icon: 'Package',
        url: '/configuracion/planes',
        description: 'Gestión de planes y features',
        orderIndex: 4,
        isActive: true,
        superuserOnly: false
      },
      {
        id: 'menu_config_tarjetas',
        title: 'Tarjetas',
        icon: 'CreditCard',
        url: '/tarjetas',
        description: 'Tabla de tarjetas de crédito',
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
      }
    ]
  },

  // 8. Sincronización (nivel 1 - con hijos - SOLO SUPERUSUARIOS)
  {
    id: 'menu_sincronizacion',
    parentId: null,
    title: 'Sincronización',
    icon: 'RefreshCw',
    url: null,
    description: 'Sistema de sincronización de datos',
    orderIndex: 8,
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
      const parent = await prisma.menu_items.create({
        data: parentData
      });
      console.log(`✅ Creado: ${parent.title}`);

      // Crear items hijos si existen
      if (children && children.length > 0) {
        for (const childData of children) {
          const child = await prisma.menu_items.create({
            data: {
              ...childData,
              parentId: parent.id
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
