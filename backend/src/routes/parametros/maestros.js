const express = require('express');
const { authWithTenant } = require('../../middleware/authWithTenant');
const prisma = require('../../lib/prisma');

const router = express.Router();

// GET /api/parametros/maestros - Obtener parámetros maestros con filtros
router.get('/', authWithTenant, async (req, res) => {
  try {
    const {
      tipo_campo,
      codigo,
      valor_padre,
      activo,
      search,
      page = 1,
      limit = 100
    } = req.query;
    
    console.log('API /parametros/maestros called with query:', req.query);
    
    // Construir filtros dinámicamente con tenant
    const where = req.filterByTenant({});
    
    if (tipo_campo) {
      where.tipo_campo = tipo_campo;
    }

    if (codigo) {
      where.codigo = codigo;
    }

    if (valor_padre !== undefined) {
      if (valor_padre === '') {
        // Si se pasa string vacío, filtrar por registros que no tienen padre
        where.valor_padre = null;
      } else {
        // Si se pasa un valor específico, filtrar por ese valor
        where.valor_padre = valor_padre;
      }
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
    
    // Calcular offset para paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Ejecutar consulta con paginación
    const [parametros, total] = await Promise.all([
      prisma.parametros_maestros.findMany({
        where,
        orderBy: [
          { tipo_campo: 'asc' },
          { orden: 'asc' },
          { codigo: 'asc' }
        ],
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.parametros_maestros.count({ where })
    ]);
    
    // Si no se solicita paginación, devolver solo los datos
    if (limit > 1000 || !req.query.page) {
      res.json(parametros);
    } else {
      res.json({
        data: parametros,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching parametros maestros:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/parametros/maestros/campos-rendicion - Obtener campos parametrizables de rendicion_tarjeta
router.get('/campos-rendicion', authWithTenant, async (req, res) => {
  try {
    // Lista de campos parametrizables de la tabla rendicion_tarjeta (usando snake_case como en la BD)
    const camposParametrizables = [
      { codigo: 'tipo_producto', nombre: 'Tipo de Producto', grupo: 'Productos y Conceptos' },
      { codigo: 'codigo_producto', nombre: 'Código de Producto', grupo: 'Productos y Conceptos' },
      { codigo: 'concepto_modulo', nombre: 'Concepto Módulo', grupo: 'Productos y Conceptos' },
      { codigo: 'concepto_tipo', nombre: 'Concepto Tipo', grupo: 'Productos y Conceptos' },
      { codigo: 'concepto_codigo', nombre: 'Concepto Código', grupo: 'Productos y Conceptos' },
      { codigo: 'concepto_liquidacion', nombre: 'Concepto de Liquidacion', grupo: 'Productos y Conceptos' },
      { codigo: 'modulo_comprobante', nombre: 'Módulo Comprobante', grupo: 'Comercio/Proveedor' },
      { codigo: 'tipo_registro', nombre: 'Tipo de Registro', grupo: 'Comercio/Proveedor' },
      { codigo: 'comprobante_origen', nombre: 'Comprobante Origen', grupo: 'Comercio/Proveedor' },
      { codigo: 'codigo_origen', nombre: 'Código Origen', grupo: 'Comercio/Proveedor' },
      { codigo: 'proveedor', nombre: 'Proveedor', grupo: 'Comercio/Proveedor' },
      { codigo: 'tipo_orden_compra', nombre: 'Tipo Orden Compra', grupo: 'Comercio/Proveedor' },
      { codigo: 'tipo_documento', nombre: 'Tipo de Documento', grupo: 'Información Fiscal' },
      { codigo: 'codigo_pais', nombre: 'Código País', grupo: 'Información Fiscal' },
      { codigo: 'condicion_iva', nombre: 'Condición IVA', grupo: 'Información Fiscal' },
      { codigo: 'codigo_moneda', nombre: 'Código Moneda', grupo: 'Información Fiscal' },
      { codigo: 'tipo_operacion', nombre: 'Tipo de Operación', grupo: 'Contabilidad' },
      { codigo: 'tipo_comprobante', nombre: 'Tipo de Comprobante', grupo: 'Contabilidad' },
      { codigo: 'codigo_dimension', nombre: 'Código Dimensión', grupo: 'Contabilidad' },
      { codigo: 'subcuenta', nombre: 'Subcuenta', grupo: 'Contabilidad' },
      { codigo: 'cuenta_contable', nombre: 'Cuenta Contable', grupo: 'Contabilidad' }
    ];
    
    res.json(camposParametrizables);
  } catch (error) {
    console.error('Error fetching campos rendicion:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/parametros/maestros/valores-padre - Obtener valores padre únicos
router.get('/valores-padre', authWithTenant, async (req, res) => {
  try {
    const { tipo_campo } = req.query;
    
    const where = {
      valor_padre: {
        not: null
      }
    };
    
    if (tipo_campo) {
      where.tipo_campo = tipo_campo;
    }
    
    const valores = await prisma.parametros_maestros.findMany({
      select: {
        valor_padre: true
      },
      where,
      distinct: ['valor_padre'],
      orderBy: {
        valor_padre: 'asc'
      }
    });
    
    res.json(valores.map(v => v.valor_padre).filter(Boolean));
  } catch (error) {
    console.error('Error fetching valores padre:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// POST /api/parametros/maestros - Crear nuevo parámetro maestro
router.post('/', authWithTenant, async (req, res) => {
  try {
    const { 
      codigo, 
      nombre, 
      descripcion, 
      tipo_campo, 
      valor_padre,
      orden = 1,
      activo = true,
      parametros_json
    } = req.body;
    
    // Validaciones básicas
    if (!codigo || !nombre || !tipo_campo) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Código, nombre y tipo de campo son obligatorios'
      });
    }
    
    // Verificar si ya existe el código para este tipo de campo
    const existingParametro = await prisma.parametros_maestros.findUnique({
      where: {
        tipo_campo_codigo: {
          tipo_campo,
          codigo
        }
      }
    });
    
    if (existingParametro) {
      return res.status(409).json({
        error: 'Parámetro duplicado',
        message: `Ya existe un parámetro con código "${codigo}" para el tipo de campo "${tipo_campo}"`
      });
    }
    
    const createData = {
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      tipo_campo: tipo_campo.trim(),
      valor_padre: valor_padre?.trim() || null,
      orden: parseInt(orden) || 1,
      activo,
      parametros_json,
      updatedAt: new Date() // Temporal: hasta que se regenere Prisma con @updatedAt
    };

    // Solo agregar tenantId si existe (para superusers sin tenant será null)
    if (req.tenantId) {
      createData.tenantId = req.tenantId;
    }

    const nuevoParametro = await prisma.parametros_maestros.create({
      data: createData
    });
    
    res.status(201).json(nuevoParametro);
    
  } catch (error) {
    console.error('Error creating parametro maestro:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Parámetro duplicado',
        message: 'Ya existe un parámetro con este código y tipo de campo'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// PUT /api/parametros/maestros/:id - Actualizar parámetro maestro
router.put('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      codigo, 
      nombre, 
      descripcion, 
      tipo_campo, 
      valor_padre,
      orden,
      activo,
      parametros_json
    } = req.body;
    
    // Validaciones básicas solo si se están actualizando estos campos
    if ((codigo !== undefined && !codigo) || (nombre !== undefined && !nombre) || (tipo_campo !== undefined && !tipo_campo)) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Código, nombre y tipo de campo no pueden estar vacíos'
      });
    }
    
    // Verificar si existe el parámetro
    const existingParametro = await prisma.parametros_maestros.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingParametro) {
      return res.status(404).json({
        error: 'Parámetro no encontrado',
        message: 'El parámetro especificado no existe'
      });
    }
    
    // Verificar si ya existe otro parámetro con el mismo código y tipo (solo si se están actualizando)
    if ((codigo !== undefined && codigo !== existingParametro.codigo) || 
        (tipo_campo !== undefined && tipo_campo !== existingParametro.tipo_campo)) {
      const duplicateParametro = await prisma.parametros_maestros.findFirst({
        where: {
          tipo_campo: tipo_campo !== undefined ? tipo_campo.trim() : existingParametro.tipo_campo,
          codigo: codigo !== undefined ? codigo.trim() : existingParametro.codigo,
          id: {
            not: parseInt(id)
          }
        }
      });
      
      if (duplicateParametro) {
        return res.status(409).json({
          error: 'Parámetro duplicado',
          message: `Ya existe otro parámetro con código "${codigo || existingParametro.codigo}" para el tipo de campo "${tipo_campo || existingParametro.tipo_campo}"`
        });
      }
    }
    
    // Construir objeto de datos dinámicamente
    const updateData = {};
    
    if (codigo !== undefined) updateData.codigo = codigo.trim();
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (tipo_campo !== undefined) updateData.tipo_campo = tipo_campo.trim();
    if (valor_padre !== undefined) updateData.valor_padre = valor_padre?.trim() || null;
    if (orden !== undefined) updateData.orden = parseInt(orden) || existingParametro.orden;
    if (activo !== undefined) updateData.activo = activo;
    if (parametros_json !== undefined) updateData.parametros_json = parametros_json;

    const parametroActualizado = await prisma.parametros_maestros.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    res.json(parametroActualizado);
    
  } catch (error) {
    console.error('Error updating parametro maestro:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Parámetro duplicado',
        message: 'Ya existe un parámetro con este código y tipo de campo'
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Parámetro no encontrado',
        message: 'El parámetro especificado no existe'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// DELETE /api/parametros/maestros/:id - Eliminar parámetro maestro
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si existe el parámetro
    const existingParametro = await prisma.parametros_maestros.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingParametro) {
      return res.status(404).json({
        error: 'Parámetro no encontrado',
        message: 'El parámetro especificado no existe'
      });
    }
    
    // Verificar si el parámetro está siendo usado (opcional - implementar según necesidades)
    // TODO: Agregar verificaciones de uso en otras tablas si es necesario
    
    // Eliminar el parámetro
    await prisma.parametros_maestros.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ 
      message: 'Parámetro eliminado correctamente',
      id: parseInt(id)
    });
    
  } catch (error) {
    console.error('Error deleting parametro maestro:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Parámetro no encontrado',
        message: 'El parámetro especificado no existe'
      });
    }
    
    // Si hay restricción de clave foránea
    if (error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar',
        message: 'Este parámetro está siendo utilizado y no se puede eliminar'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/parametros/maestros/jerarquia/:tipo_campo - Obtener jerarquía de parámetros
router.get('/jerarquia/:tipo_campo', authWithTenant, async (req, res) => {
  try {
    const { tipo_campo } = req.params;
    const { valor_padre } = req.query;
    
    const where = {
      tipo_campo,
      activo: true
    };
    
    if (valor_padre) {
      where.valor_padre = valor_padre;
    }
    
    const parametros = await prisma.parametros_maestros.findMany({
      where,
      orderBy: [
        { orden: 'asc' },
        { codigo: 'asc' }
      ]
    });
    
    res.json(parametros);
    
  } catch (error) {
    console.error('Error fetching jerarquia:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;