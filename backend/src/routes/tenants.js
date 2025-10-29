const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * GET /api/tenants
 * Lista todos los tenants con paginación y búsqueda
 */
router.get('/', async (req, res) => {
  try {
    const { activo, search, page = '1', limit = '10' } = req.query;

    const where = {};

    // Filtrar por activo si se especifica
    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    // Búsqueda por nombre, slug o CUIT
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Contar total de registros
    const total = await prisma.tenants.count({ where });

    // Obtener tenants con paginación
    const tenants = await prisma.tenants.findMany({
      where,
      select: {
        id: true,
        slug: true,
        nombre: true,
        cuit: true,
        razonSocial: true,
        email: true,
        plan: true,
        activo: true,
        esDefault: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
      skip,
      take: limitNum,
    });

    res.json({
      success: true,
      data: tenants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error al listar tenants:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tenants/:id
 * Obtiene un tenant por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        nombre: true,
        cuit: true,
        razonSocial: true,
        direccion: true,
        telefono: true,
        email: true,
        plan: true,
        activo: true,
        esDefault: true,
        fechaCreacion: true,
        fechaVencimiento: true,
        configuracion: true,
        limites: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant no encontrado',
      });
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Error al obtener tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/tenants
 * Crea un nuevo tenant
 */
router.post('/', async (req, res) => {
  try {
    const { nombre, slug, cuit, plan = 'Common', activo = true } = req.body;

    // Validar campos requeridos
    if (!nombre || !slug || !cuit) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, slug y CUIT son requeridos',
      });
    }

    // Verificar si el slug ya existe
    const existingTenant = await prisma.tenants.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un tenant con ese slug',
      });
    }

    const tenant = await prisma.tenants.create({
      data: {
        nombre,
        slug,
        cuit,
        plan,
        activo,
      },
    });

    res.status(201).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Error al crear tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/tenants/:id
 * Actualiza un tenant
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, slug, cuit, plan, activo } = req.body;

    // Verificar que el tenant existe
    const existingTenant = await prisma.tenants.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant no encontrado',
      });
    }

    // Si se está cambiando el slug, verificar que no exista otro con ese slug
    if (slug && slug !== existingTenant.slug) {
      const slugExists = await prisma.tenants.findUnique({
        where: { slug },
      });

      if (slugExists) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un tenant con ese slug',
        });
      }
    }

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (slug !== undefined) updateData.slug = slug;
    if (cuit !== undefined) updateData.cuit = cuit;
    if (plan !== undefined) updateData.plan = plan;
    if (activo !== undefined) updateData.activo = activo;

    const tenant = await prisma.tenants.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Error al actualizar tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/tenants/:id
 * Elimina un tenant
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el tenant existe
    const existingTenant = await prisma.tenants.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!existingTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant no encontrado',
      });
    }

    // Verificar que no tenga usuarios asociados
    if (existingTenant._count.users > 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede eliminar un tenant con usuarios asociados',
      });
    }

    await prisma.tenants.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Tenant eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
