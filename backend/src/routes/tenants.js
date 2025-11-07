const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
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
      include: {
        planes: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            precio: true,
            color: true
          }
        },
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
      include: {
        planes: true
      }
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

    // Convertir código de plan a ID si es necesario
    let planId = null;
    if (plan) {
      // Verificar si el valor es un ID (UUID con guiones o CUID sin guiones) o un código
      // UUID: 8-4-4-4-12 caracteres hexadecimales con guiones
      // CUID: 25 caracteres alfanuméricos sin guiones (ejemplo: cmgwu8nlb000tr8hons6m0nxw)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan);
      const isCUID = /^c[a-z0-9]{24}$/i.test(plan);

      if (isUUID || isCUID) {
        // Es un ID, usarlo directamente
        planId = plan;
      } else {
        // Es un código (Common, Uncommon, etc.), buscar el plan por código
        const planRecord = await prisma.planes.findUnique({
          where: { codigo: plan }
        });

        if (!planRecord) {
          return res.status(400).json({
            success: false,
            error: `Plan con código "${plan}" no encontrado`
          });
        }

        planId = planRecord.id;
      }
    }

    // Generar ID único para el tenant
    const tenantId = crypto.randomUUID();
    const now = new Date();

    const tenant = await prisma.tenants.create({
      data: {
        id: tenantId,
        nombre,
        slug,
        cuit,
        planId,
        activo,
        updatedAt: now,
      },
    });

    res.status(201).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Error al crear tenant:', error);

    // Manejar error de slug/cuit duplicado (Prisma unique constraint)
    // target es un array: ['slug'] o ['cuit']
    if (error.code === 'P2002') {
      const target = error.meta?.target;

      if (Array.isArray(target) && target.includes('slug')) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un tenant con ese slug. Por favor, elige un slug diferente.'
        });
      }

      if (Array.isArray(target) && target.includes('cuit')) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un tenant con ese CUIT. Por favor, verifica los datos.'
        });
      }
    }

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

    // Convertir código de plan a ID si es necesario
    if (plan !== undefined) {
      if (plan === null || plan === '') {
        updateData.planId = null;
      } else {
        // Verificar si el valor es un ID (UUID con guiones o CUID sin guiones) o un código
        // UUID: 8-4-4-4-12 caracteres hexadecimales con guiones
        // CUID: 25 caracteres alfanuméricos sin guiones (ejemplo: cmgwu8nlb000tr8hons6m0nxw)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan);
        const isCUID = /^c[a-z0-9]{24}$/i.test(plan);

        if (isUUID || isCUID) {
          // Es un ID, usarlo directamente
          updateData.planId = plan;
        } else {
          // Es un código (Common, Uncommon, etc.), buscar el plan por código
          const planRecord = await prisma.planes.findUnique({
            where: { codigo: plan }
          });

          if (!planRecord) {
            return res.status(400).json({
              success: false,
              error: `Plan con código "${plan}" no encontrado`
            });
          }

          updateData.planId = planRecord.id;
        }
      }
    }

    if (activo !== undefined) updateData.activo = activo;

    // Actualizar timestamp
    updateData.updatedAt = new Date();

    const tenant = await prisma.tenants.update({
      where: { id },
      data: updateData,
      include: {
        planes: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            precio: true,
            color: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Error al actualizar tenant:', error);

    // Manejar error de slug/cuit duplicado (Prisma unique constraint)
    // target es un array: ['slug'] o ['cuit']
    if (error.code === 'P2002') {
      const target = error.meta?.target;

      if (Array.isArray(target) && target.includes('slug')) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un tenant con ese slug. Por favor, elige un slug diferente.'
        });
      }

      if (Array.isArray(target) && target.includes('cuit')) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un tenant con ese CUIT. Por favor, verifica los datos.'
        });
      }
    }

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
