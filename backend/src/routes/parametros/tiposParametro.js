/**
 * Rutas CRUD para Tipos de Parámetro (catálogo GLOBAL)
 *
 * Estos tipos definen qué campos de parámetros maestros existen.
 * Es un catálogo global: sin tenant, compartido por todos.
 *
 * Permisos:
 * - GET: Cualquier usuario autenticado
 * - POST/PUT/DELETE: Solo superusers
 */

const express = require('express');
const { authWithTenant } = require('../../middleware/authWithTenant');
const prisma = require('../../lib/prisma');

const router = express.Router();

/**
 * Middleware: Verificar si es superuser
 */
const requireSuperuser = (req, res, next) => {
  if (!req.user?.superuser) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo superusuarios pueden realizar esta acción'
    });
  }
  next();
};

/**
 * GET /api/parametros/tipos
 * Obtener todos los tipos de parámetro (con filtros opcionales)
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { grupo, activo, search } = req.query;

    const where = {};

    if (grupo) {
      where.grupo = grupo;
    }

    if (activo !== undefined && activo !== '') {
      where.activo = activo === 'true';
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } }
      ];
    }

    const tipos = await prisma.tipos_parametro.findMany({
      where,
      orderBy: [
        { grupo: 'asc' },
        { orden: 'asc' },
        { nombre: 'asc' }
      ]
    });

    res.json(tipos);

  } catch (error) {
    console.error('Error fetching tipos parametro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/parametros/tipos/grupos
 * Obtener lista de grupos únicos
 */
router.get('/grupos', authWithTenant, async (req, res) => {
  try {
    const grupos = await prisma.tipos_parametro.findMany({
      select: { grupo: true },
      distinct: ['grupo'],
      where: { activo: true },
      orderBy: { grupo: 'asc' }
    });

    res.json(grupos.map(g => g.grupo));

  } catch (error) {
    console.error('Error fetching grupos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/parametros/tipos/:id
 * Obtener un tipo por ID
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const tipo = await prisma.tipos_parametro.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tipo) {
      return res.status(404).json({
        error: 'No encontrado',
        message: 'El tipo de parámetro no existe'
      });
    }

    res.json(tipo);

  } catch (error) {
    console.error('Error fetching tipo parametro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/parametros/tipos
 * Crear nuevo tipo de parámetro (solo superusers)
 */
router.post('/', authWithTenant, requireSuperuser, async (req, res) => {
  try {
    const { codigo, nombre, descripcion, grupo, orden = 1, activo = true, icono } = req.body;

    // Validaciones
    if (!codigo || !nombre || !grupo) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Código, nombre y grupo son obligatorios'
      });
    }

    // Verificar código único
    const existing = await prisma.tipos_parametro.findUnique({
      where: { codigo: codigo.trim().toLowerCase() }
    });

    if (existing) {
      return res.status(409).json({
        error: 'Código duplicado',
        message: `Ya existe un tipo con código "${codigo}"`
      });
    }

    const nuevoTipo = await prisma.tipos_parametro.create({
      data: {
        codigo: codigo.trim().toLowerCase(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        grupo: grupo.trim(),
        orden: parseInt(orden) || 1,
        activo,
        icono: icono?.trim() || null
      }
    });

    console.log(`✅ [TiposParametro] Nuevo tipo creado: ${nuevoTipo.codigo} por ${req.user.email}`);

    res.status(201).json(nuevoTipo);

  } catch (error) {
    console.error('Error creating tipo parametro:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Código duplicado',
        message: 'Ya existe un tipo con este código'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * PUT /api/parametros/tipos/:id
 * Actualizar tipo de parámetro (solo superusers)
 */
router.put('/:id', authWithTenant, requireSuperuser, async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, grupo, orden, activo, icono } = req.body;

    // Verificar que existe
    const existing = await prisma.tipos_parametro.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'No encontrado',
        message: 'El tipo de parámetro no existe'
      });
    }

    // Si cambia el código, verificar que no esté en uso
    if (codigo && codigo.trim().toLowerCase() !== existing.codigo) {
      const duplicate = await prisma.tipos_parametro.findUnique({
        where: { codigo: codigo.trim().toLowerCase() }
      });

      if (duplicate) {
        return res.status(409).json({
          error: 'Código duplicado',
          message: `Ya existe un tipo con código "${codigo}"`
        });
      }
    }

    // Construir datos de actualización
    const updateData = {};
    if (codigo !== undefined) updateData.codigo = codigo.trim().toLowerCase();
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (grupo !== undefined) updateData.grupo = grupo.trim();
    if (orden !== undefined) updateData.orden = parseInt(orden) || existing.orden;
    if (activo !== undefined) updateData.activo = activo;
    if (icono !== undefined) updateData.icono = icono?.trim() || null;

    const tipoActualizado = await prisma.tipos_parametro.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    console.log(`✅ [TiposParametro] Tipo actualizado: ${tipoActualizado.codigo} por ${req.user.email}`);

    res.json(tipoActualizado);

  } catch (error) {
    console.error('Error updating tipo parametro:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Código duplicado',
        message: 'Ya existe un tipo con este código'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * DELETE /api/parametros/tipos/:id
 * Eliminar tipo de parámetro (solo superusers)
 */
router.delete('/:id', authWithTenant, requireSuperuser, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existing = await prisma.tipos_parametro.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'No encontrado',
        message: 'El tipo de parámetro no existe'
      });
    }

    // Verificar si hay parámetros maestros usando este tipo
    const parametrosUsando = await prisma.parametros_maestros.count({
      where: { tipo_campo: existing.codigo }
    });

    if (parametrosUsando > 0) {
      return res.status(409).json({
        error: 'Tipo en uso',
        message: `No se puede eliminar: hay ${parametrosUsando} parámetros maestros usando este tipo`,
        parametrosCount: parametrosUsando
      });
    }

    await prisma.tipos_parametro.delete({
      where: { id: parseInt(id) }
    });

    console.log(`🗑️ [TiposParametro] Tipo eliminado: ${existing.codigo} por ${req.user.email}`);

    res.json({
      message: 'Tipo de parámetro eliminado correctamente',
      id: parseInt(id),
      codigo: existing.codigo
    });

  } catch (error) {
    console.error('Error deleting tipo parametro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
