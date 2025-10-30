const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authWithTenant } = require('../middleware/authWithTenant');
const BusinessRulesEngine = require('../services/businessRulesEngine');

const router = express.Router();
const prisma = new PrismaClient();

// GET /reglas - Obtener todas las reglas de negocio
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { tipo, activa, search } = req.query;
    
    const where = {};
    if (tipo) where.tipo = tipo;
    if (activa !== undefined) where.activa = activa === 'true';
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } }
      ];
    }

    const reglas = await prisma.reglas_negocio.findMany({
      where: req.filterByTenant(where),
      orderBy: [
        { prioridad: 'asc' },
        { nombre: 'asc' }
      ],
      include: {
        _count: {
          select: { reglas_ejecuciones: true }
        }
      }
    });

    res.json(reglas);
  } catch (error) {
    console.error('Error obteniendo reglas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /reglas/:id - Obtener una regla específica
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const regla = await prisma.reglas_negocio.findFirst({
      where: req.filterByTenant({ id: req.params.id }),
      include: {
        reglas_ejecuciones: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!regla) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    res.json(regla);
  } catch (error) {
    console.error('Error obteniendo regla:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /reglas - Crear nueva regla
router.post('/', 
  authWithTenant,
  [
    body('codigo').notEmpty().withMessage('Código es requerido'),
    body('nombre').notEmpty().withMessage('Nombre es requerido'),
    body('tipo').isIn(['IMPORTACION_DKT', 'VALIDACION', 'TRANSFORMACION', 'TRANSFORMACION_DOCUMENTO', 'GRID_AUTOCOMPLETE']).withMessage('Tipo inválido'),
    body('configuracion').isObject().withMessage('Configuración debe ser un objeto válido'),
    body('prioridad').optional().isInt({ min: 1 }).withMessage('Prioridad debe ser un número entero positivo')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { codigo, nombre, descripcion, tipo, configuracion, prioridad, fechaVigencia, activa } = req.body;
      const userId = req.user?.id;

      // Verificar que el código no exista
      const existingRule = await prisma.reglas_negocio.findFirst({
        where: req.filterByTenant({ codigo })
      });

      if (existingRule) {
        return res.status(400).json({ error: 'Ya existe una regla con ese código' });
      }

      // Validar configuración básica
      if (!configuracion.condiciones && !configuracion.acciones) {
        return res.status(400).json({ 
          error: 'La configuración debe tener al menos condiciones o acciones' 
        });
      }

      const regla = await prisma.reglas_negocio.create({
        data: {
          id: require('crypto').randomUUID(),
          codigo,
          nombre,
          descripcion,
          tipo,
          configuracion,
          prioridad: prioridad || 100,
          fechaVigencia: fechaVigencia ? new Date(fechaVigencia) : null,
          activa: activa !== undefined ? activa : true,
          createdBy: userId,
          tenantId: req.tenantId
        }
      });

      // Limpiar cache del motor de reglas
      const rulesEngine = new BusinessRulesEngine();
      rulesEngine.clearCache();

      res.status(201).json(regla);
    } catch (error) {
      console.error('Error creando regla:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
);

// PUT /reglas/:id - Actualizar regla
router.put('/:id',
  authWithTenant,
  [
    param('id').isLength({ min: 1 }).withMessage('ID inválido'),
    body('codigo').optional().notEmpty().withMessage('Código no puede estar vacío'),
    body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
    body('tipo').optional().isIn(['IMPORTACION_DKT', 'VALIDACION', 'TRANSFORMACION', 'TRANSFORMACION_DOCUMENTO', 'GRID_AUTOCOMPLETE']).withMessage('Tipo inválido'),
    body('configuracion').optional().isObject().withMessage('Configuración debe ser un objeto válido'),
    body('prioridad').optional().isInt({ min: 1 }).withMessage('Prioridad debe ser un número entero positivo')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { codigo, nombre, descripcion, tipo, configuracion, prioridad, fechaVigencia, activa } = req.body;
      const userId = req.user?.id;

      // Verificar que la regla existe
      const existingRule = await prisma.reglas_negocio.findFirst({
        where: req.filterByTenant({ id })
      });

      if (!existingRule) {
        return res.status(404).json({ error: 'Regla no encontrada' });
      }

      // Si se cambia el código, verificar que no exista otro con ese código
      if (codigo && codigo !== existingRule.codigo) {
        const duplicateRule = await prisma.reglas_negocio.findFirst({
          where: req.filterByTenant({ codigo })
        });

        if (duplicateRule) {
          return res.status(400).json({ error: 'Ya existe una regla con ese código' });
        }
      }

      const updateData = {
        updatedBy: userId,
        version: existingRule.version + 1
      };

      if (codigo !== undefined) updateData.codigo = codigo;
      if (nombre !== undefined) updateData.nombre = nombre;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (tipo !== undefined) updateData.tipo = tipo;
      if (configuracion !== undefined) updateData.configuracion = configuracion;
      if (prioridad !== undefined) updateData.prioridad = prioridad;
      if (fechaVigencia !== undefined) updateData.fechaVigencia = fechaVigencia ? new Date(fechaVigencia) : null;
      if (activa !== undefined) updateData.activa = activa;

      const regla = await prisma.reglas_negocio.update({
        where: req.filterByTenant({ id }),
        data: updateData
      });

      // Limpiar cache del motor de reglas
      const rulesEngine = new BusinessRulesEngine();
      rulesEngine.clearCache();

      res.json(regla);
    } catch (error) {
      console.error('Error actualizando regla:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
);

// DELETE /reglas/:id - Eliminar regla
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const regla = await prisma.reglas_negocio.findFirst({
      where: req.filterByTenant({ id })
    });

    if (!regla) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    await prisma.reglas_negocio.delete({
      where: { id }
    });

    // Limpiar cache del motor de reglas
    const rulesEngine = new BusinessRulesEngine();
    rulesEngine.clearCache();

    res.json({ message: 'Regla eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando regla:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /reglas/:id/test - Probar una regla con datos de ejemplo
router.post('/:id/test', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { itemData, resumenData } = req.body;

    const regla = await prisma.reglas_negocio.findFirst({
      where: req.filterByTenant({ id })
    });

    if (!regla) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    // Crear una instancia temporal del motor de reglas con solo esta regla
    const rulesEngine = new BusinessRulesEngine();
    rulesEngine.rules = [regla];

    const result = await rulesEngine.applyRules(
      itemData || {},
      resumenData || {},
      { logExecution: false, contexto: 'TEST' }
    );

    res.json({
      regla: {
        id: regla.id,
        codigo: regla.codigo,
        nombre: regla.nombre
      },
      entrada: {
        itemData: itemData || {},
        resumenData: resumenData || {}
      },
      resultado: result
    });
  } catch (error) {
    console.error('Error probando regla:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /reglas/:id/ejecuciones - Obtener historial de ejecuciones
router.get('/:id/ejecuciones', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [ejecuciones, total] = await Promise.all([
      prisma.reglas_ejecuciones.findMany({
        where: req.filterByTenant({ reglaId: id }),
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.reglas_ejecuciones.count({
        where: req.filterByTenant({ reglaId: id })
      })
    ]);

    res.json({
      ejecuciones,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo ejecuciones:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /reglas/tipos - Obtener tipos de reglas disponibles
router.get('/meta/tipos', authWithTenant, async (req, res) => {
  res.json([
    { codigo: 'IMPORTACION_DKT', nombre: 'Importación de DKT', descripcion: 'Reglas aplicadas durante la importación de archivos DKT' },
    { codigo: 'VALIDACION', nombre: 'Validación', descripcion: 'Reglas de validación de datos' },
    { codigo: 'TRANSFORMACION', nombre: 'Transformación', descripcion: 'Reglas de transformación de datos' },
    { codigo: 'TRANSFORMACION_DOCUMENTO', nombre: 'Transformación Pre-Exportación', descripcion: 'Reglas aplicadas a documentos antes de exportarlos' },
    { codigo: 'GRID_AUTOCOMPLETE', nombre: 'Auto-completado de Grilla', descripcion: 'Reglas de auto-completado para campos de grillas' }
  ]);
});

// GET /reglas/meta/operadores - Obtener operadores disponibles
router.get('/meta/operadores', authWithTenant, async (req, res) => {
  res.json([
    { codigo: 'EQUALS', nombre: 'Igual a', descripcion: 'Valor exactamente igual' },
    { codigo: 'NOT_EQUALS', nombre: 'Distinto de', descripcion: 'Valor diferente' },
    { codigo: 'CONTAINS', nombre: 'Contiene', descripcion: 'Contiene el texto especificado' },
    { codigo: 'NOT_CONTAINS', nombre: 'No contiene', descripcion: 'No contiene el texto especificado' },
    { codigo: 'STARTS_WITH', nombre: 'Comienza con', descripcion: 'Comienza con el texto especificado' },
    { codigo: 'ENDS_WITH', nombre: 'Termina con', descripcion: 'Termina con el texto especificado' },
    { codigo: 'REGEX', nombre: 'Expresión regular', descripcion: 'Coincide con la expresión regular' },
    { codigo: 'IN', nombre: 'En lista', descripcion: 'Valor está en la lista (separado por comas)' },
    { codigo: 'NOT_IN', nombre: 'No en lista', descripcion: 'Valor no está en la lista' },
    { codigo: 'IS_NULL', nombre: 'Es nulo', descripcion: 'Valor es nulo o indefinido' },
    { codigo: 'IS_NOT_NULL', nombre: 'No es nulo', descripcion: 'Valor no es nulo' },
    { codigo: 'IS_EMPTY', nombre: 'Está vacío', descripcion: 'Valor está vacío' },
    { codigo: 'IS_NOT_EMPTY', nombre: 'No está vacío', descripcion: 'Valor no está vacío' },
    { codigo: 'GREATER_THAN', nombre: 'Mayor que', descripcion: 'Valor numérico mayor' },
    { codigo: 'LESS_THAN', nombre: 'Menor que', descripcion: 'Valor numérico menor' },
    { codigo: 'GREATER_OR_EQUAL', nombre: 'Mayor o igual', descripcion: 'Valor numérico mayor o igual' },
    { codigo: 'LESS_OR_EQUAL', nombre: 'Menor o igual', descripcion: 'Valor numérico menor o igual' }
  ]);
});

// GET /reglas/meta/acciones - Obtener tipos de acciones disponibles
router.get('/meta/acciones', authWithTenant, async (req, res) => {
  res.json([
    { 
      codigo: 'SET', 
      nombre: 'Establecer Valor', 
      descripcion: 'Asigna un valor fijo al campo',
      parametros: ['campo', 'valor']
    },
    { 
      codigo: 'APPEND', 
      nombre: 'Agregar Texto', 
      descripcion: 'Agrega texto al valor existente',
      parametros: ['campo', 'valor']
    },
    { 
      codigo: 'CALCULATE', 
      nombre: 'Calcular', 
      descripcion: 'Realiza un cálculo matemático',
      parametros: ['campo', 'formula']
    },
    { 
      codigo: 'LOOKUP', 
      nombre: 'Consultar Tabla', 
      descripcion: 'Busca un valor en otra tabla de la base de datos',
      parametros: ['campo', 'tabla', 'campoConsulta', 'valorConsulta', 'campoResultado', 'valorDefecto']
    },
    { 
      codigo: 'LOOKUP_JSON', 
      nombre: 'Consultar Campo JSON', 
      descripcion: 'Busca un valor dentro de campos JSON de parámetros maestros',
      parametros: ['campo', 'tipoCampo', 'campoJSON', 'valorConsulta', 'campoResultado', 'valorDefecto']
    },
    { 
      codigo: 'LOOKUP_CHAIN', 
      nombre: 'Consulta Encadenada', 
      descripcion: 'Realiza múltiples lookups encadenados entre tablas relacionadas',
      parametros: ['campo', 'valorConsulta', 'cadena', 'valorDefecto']
    }
  ]);
});

// GET /reglas/meta/tablas-lookup - Obtener tablas disponibles para lookup
router.get('/meta/tablas-lookup', authWithTenant, async (req, res) => {
  res.json([
    { 
      codigo: 'parametros_maestros', 
      nombre: 'Parámetros Maestros',
      descripcion: 'Tabla de parámetros de configuración',
      campos: ['codigo', 'nombre', 'tipo_campo', 'valor_padre', 'orden']
    },
    { 
      codigo: 'user_tarjetas_credito', 
      nombre: 'Tarjetas de Crédito',
      descripcion: 'Información de tarjetas y sus titulares',
      campos: ['numeroTarjeta', 'user.nombre', 'user.apellido', 'user.email', 'banco.nombre', 'tipoTarjeta.nombre']
    },
    { 
      codigo: 'usuarios', 
      nombre: 'Usuarios',
      descripcion: 'Datos de usuarios del sistema',
      campos: ['id', 'nombre', 'apellido', 'email', 'rol', 'activo']
    },
    { 
      codigo: 'banco_tipo_tarjeta', 
      nombre: 'Bancos y Tipos de Tarjeta',
      descripcion: 'Configuración de bancos y tipos de tarjetas',
      campos: ['codigo', 'banco.nombre', 'tipoTarjeta.nombre', 'activo']
    }
  ]);
});

// GET /reglas/meta/estados - Obtener estados disponibles para validaciones
router.get('/meta/estados', authWithTenant, async (req, res) => {
  try {
    const estados = await prisma.estados.findMany({
      where: req.filterByTenant({ activo: true }),
      select: {
        codigo: true,
        descripcion: true,
        color: true
      },
      orderBy: { descripcion: 'asc' }
    });

    res.json(estados);
  } catch (error) {
    console.error('Error fetching estados:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;