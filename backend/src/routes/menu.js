const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authWithTenant } = require('../middleware/authWithTenant');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

/**
 * GET /api/menu
 * Obtiene el menú completo en estructura jerárquica
 * Filtra por permisos de usuario (superuser) y tenant
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const userId = req.user?.id;
    const isSuperuser = req.user?.superuser === true;
    const tenantId = req.user?.tenantId;

    console.log('📋 [MENU] Request:', { userId, isSuperuser, tenantId });

    // Filtros base
    const where = {
      isActive: true,
      parentId: null, // Solo items de nivel 1
      OR: [
        { tenantId: null }, // Menú global
        { tenantId: tenantId } // Menú específico del tenant
      ]
    };

    // Si no es superusuario, filtrar items de superuser only
    if (!isSuperuser) {
      where.superuserOnly = false;
    }

    // Obtener items de nivel 1 con sus hijos
    const menuItems = await prisma.menu_items.findMany({
      where,
      include: {
        other_menu_items: {
          where: {
            isActive: true,
            ...(isSuperuser ? {} : { superuserOnly: false })
          },
          orderBy: {
            orderIndex: 'asc'
          }
        }
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    console.log(`✅ [MENU] Encontrados ${menuItems.length} items de nivel 1`);

    // Transformar para compatibilidad con el frontend (renombrar other_menu_items a children)
    const transformedItems = menuItems.map(item => ({
      ...item,
      children: item.other_menu_items,
      other_menu_items: undefined
    }));

    res.json(transformedItems);
  } catch (error) {
    console.error('❌ [MENU] Error al obtener menú:', error);
    res.status(500).json({
      error: 'Error al obtener el menú',
      message: error.message
    });
  }
});

/**
 * GET /api/menu/:id
 * Obtiene un item de menú específico
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await prisma.menu_items.findUnique({
      where: { id },
      include: {
        other_menu_items: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' }
        },
        menu_items: true
      }
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Item de menú no encontrado' });
    }

    // Transformar para compatibilidad con el frontend
    const transformedItem = {
      ...menuItem,
      children: menuItem.other_menu_items,
      parent: menuItem.menu_items,
      other_menu_items: undefined,
      menu_items: undefined
    };

    res.json(transformedItem);
  } catch (error) {
    console.error('❌ [MENU] Error al obtener item:', error);
    res.status(500).json({
      error: 'Error al obtener item de menú',
      message: error.message
    });
  }
});

/**
 * POST /api/menu
 * Crea un nuevo item de menú
 * Requiere permisos de administrador
 */
router.post('/', authWithTenant, async (req, res) => {
  try {
    // Validar que el usuario sea superusuario
    if (!req.user?.superuser) {
      return res.status(403).json({
        error: 'No autorizado',
        message: 'Solo superusuarios pueden crear items de menú'
      });
    }

    const {
      parentId,
      title,
      icon,
      url,
      description,
      orderIndex,
      isActive,
      requiresPermission,
      superuserOnly,
      tenantId
    } = req.body;

    // Validaciones
    if (!title || !icon) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'El título y el ícono son obligatorios'
      });
    }

    const menuItem = await prisma.menu_items.create({
      data: {
        id: uuidv4(),
        parentId,
        title,
        icon,
        url,
        description,
        orderIndex: orderIndex || 0,
        isActive: isActive !== undefined ? isActive : true,
        requiresPermission,
        superuserOnly: superuserOnly || false,
        tenantId,
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: req.user.id
      },
      include: {
        other_menu_items: true,
        menu_items: true
      }
    });

    console.log(`✅ [MENU] Item creado: ${menuItem.title} (${menuItem.id})`);

    res.status(201).json(menuItem);
  } catch (error) {
    console.error('❌ [MENU] Error al crear item:', error);
    res.status(500).json({
      error: 'Error al crear item de menú',
      message: error.message
    });
  }
});

/**
 * PUT /api/menu/:id
 * Actualiza un item de menú existente
 * Requiere permisos de administrador
 */
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    // Validar que el usuario sea superusuario
    if (!req.user?.superuser) {
      return res.status(403).json({
        error: 'No autorizado',
        message: 'Solo superusuarios pueden editar items de menú'
      });
    }

    const { id } = req.params;
    const {
      parentId,
      title,
      icon,
      url,
      description,
      orderIndex,
      isActive,
      requiresPermission,
      superuserOnly,
      tenantId
    } = req.body;

    // Verificar que el item existe
    const existingItem = await prisma.menu_items.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item de menú no encontrado' });
    }

    const menuItem = await prisma.menu_items.update({
      where: { id },
      data: {
        ...(parentId !== undefined && { parentId }),
        ...(title && { title }),
        ...(icon && { icon }),
        ...(url !== undefined && { url }),
        ...(description !== undefined && { description }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(isActive !== undefined && { isActive }),
        ...(requiresPermission !== undefined && { requiresPermission }),
        ...(superuserOnly !== undefined && { superuserOnly }),
        ...(tenantId !== undefined && { tenantId }),
        updatedBy: req.user.id
      },
      include: {
        other_menu_items: true,
        menu_items: true
      }
    });

    console.log(`✅ [MENU] Item actualizado: ${menuItem.title} (${menuItem.id})`);

    res.json(menuItem);
  } catch (error) {
    console.error('❌ [MENU] Error al actualizar item:', error);
    res.status(500).json({
      error: 'Error al actualizar item de menú',
      message: error.message
    });
  }
});

/**
 * DELETE /api/menu/:id
 * Elimina un item de menú
 * Requiere permisos de administrador
 * Elimina también todos los hijos en cascada
 */
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    // Validar que el usuario sea superusuario
    if (!req.user?.superuser) {
      return res.status(403).json({
        error: 'No autorizado',
        message: 'Solo superusuarios pueden eliminar items de menú'
      });
    }

    const { id } = req.params;

    // Verificar que el item existe
    const existingItem = await prisma.menu_items.findUnique({
      where: { id },
      include: {
        other_menu_items: true
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item de menú no encontrado' });
    }

    // Eliminar (en cascada por la configuración de Prisma)
    await prisma.menu_items.delete({
      where: { id }
    });

    console.log(`✅ [MENU] Item eliminado: ${existingItem.title} (${id})`);
    if (existingItem.other_menu_items.length > 0) {
      console.log(`   ⚠️  Se eliminaron también ${existingItem.other_menu_items.length} items hijos`);
    }

    res.json({
      success: true,
      message: 'Item de menú eliminado exitosamente',
      deletedChildren: existingItem.other_menu_items.length
    });
  } catch (error) {
    console.error('❌ [MENU] Error al eliminar item:', error);
    res.status(500).json({
      error: 'Error al eliminar item de menú',
      message: error.message
    });
  }
});

/**
 * PATCH /api/menu/:id/reorder
 * Reordena un item de menú cambiando su orderIndex
 */
router.patch('/:id/reorder', authWithTenant, async (req, res) => {
  try {
    // Validar que el usuario sea superusuario
    if (!req.user?.superuser) {
      return res.status(403).json({
        error: 'No autorizado',
        message: 'Solo superusuarios pueden reordenar items de menú'
      });
    }

    const { id } = req.params;
    const { orderIndex } = req.body;

    if (orderIndex === undefined || orderIndex === null) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'El orderIndex es obligatorio'
      });
    }

    const menuItem = await prisma.menu_items.update({
      where: { id },
      data: {
        orderIndex: parseInt(orderIndex),
        updatedBy: req.user.id
      }
    });

    console.log(`✅ [MENU] Item reordenado: ${menuItem.title} -> posición ${orderIndex}`);

    res.json(menuItem);
  } catch (error) {
    console.error('❌ [MENU] Error al reordenar item:', error);
    res.status(500).json({
      error: 'Error al reordenar item de menú',
      message: error.message
    });
  }
});

/**
 * GET /api/menu/icons/available
 * Lista de íconos disponibles de lucide-react
 */
router.get('/icons/available', (req, res) => {
  const availableIcons = [
    'Home', 'Upload', 'CreditCard', 'Settings', 'LogOut', 'User', 'Users',
    'FileText', 'PieChart', 'Receipt', 'Shield', 'Send', 'Building2',
    'BarChart3', 'FileCheck', 'Banknote', 'CheckCircle', 'Folder',
    'ChevronDown', 'ChevronRight', 'TrendingUp', 'Calculator', 'DollarSign',
    'Download', 'FileBarChart', 'ArrowLeftRight', 'ArrowUpCircle',
    'ArrowDownCircle', 'RefreshCw', 'Key', 'Sparkles', 'ScanText', 'Package'
  ];

  res.json(availableIcons);
});

module.exports = router;
