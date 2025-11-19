/**
 * API Routes - Configuración de Detección de Documentos
 *
 * Endpoints para gestionar la configuración visual de detección de tipos de comprobantes
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/auth');

// Configuración por defecto
const DEFAULT_CONFIG = {
  zonaBusqueda: {
    zona1: {
      nombre: 'Superior Central Estricta',
      topY: 0.20,
      centerXMin: 0.30,
      centerXMax: 0.70,
      descripcion: 'Zona principal donde suele estar el recuadro con la letra'
    },
    zona2: {
      nombre: 'Superior Amplia',
      topY: 0.30,
      centerXMin: 0.20,
      centerXMax: 0.80,
      descripcion: 'Zona ampliada si no se encuentra en zona 1'
    }
  },
  patronesBusqueda: {
    facturaA: {
      nombre: 'FACTURA A',
      patrones: [
        'FACTURA\\s*A\\b',
        'TIPO\\s*:\\s*A\\b',
        'CLASE\\s*:\\s*A\\b',
        'COD\\.\\s*001',
        'CODIGO\\s*001',
        '\\bA\\s+ORIGINAL',
        '\\bA\\s+DUPLICADO'
      ],
      codigoAFIP: '001',
      activo: true
    },
    facturaB: {
      nombre: 'FACTURA B',
      patrones: [
        'FACTURA\\s*B\\b',
        'TIPO\\s*:\\s*B\\b',
        'CLASE\\s*:\\s*B\\b',
        'COD\\.\\s*006',
        'CODIGO\\s*006',
        '\\bB\\s+ORIGINAL',
        '\\bB\\s+DUPLICADO'
      ],
      codigoAFIP: '006',
      activo: true
    },
    facturaC: {
      nombre: 'FACTURA C',
      patrones: [
        'FACTURA\\s*C\\b',
        'TIPO\\s*:\\s*C\\b',
        'CLASE\\s*:\\s*C\\b',
        'COD\\.\\s*011',
        'CODIGO\\s*011',
        '\\bC\\s+ORIGINAL',
        '\\bC\\s+DUPLICADO'
      ],
      codigoAFIP: '011',
      activo: true
    },
    facturaE: {
      nombre: 'FACTURA E',
      patrones: [
        'FACTURA\\s*E\\b',
        'TIPO\\s*:\\s*E\\b',
        'FACTURA\\s+DE\\s+EXPORTACION',
        'COD\\.\\s*019'
      ],
      codigoAFIP: '019',
      activo: true
    },
    facturaM: {
      nombre: 'FACTURA M',
      patrones: [
        'FACTURA\\s*M\\b',
        'TIPO\\s*:\\s*M\\b',
        'COD\\.\\s*051'
      ],
      codigoAFIP: '051',
      activo: true
    },
    notaCredito: {
      nombre: 'NOTA DE CRÉDITO',
      patrones: [
        'NOTA\\s+DE\\s+CREDITO',
        'NOTA\\s+CREDITO',
        'N\\/C',
        'NC\\s+\\d'
      ],
      activo: true
    },
    notaDebito: {
      nombre: 'NOTA DE DÉBITO',
      patrones: [
        'NOTA\\s+DE\\s+DEBITO',
        'NOTA\\s+DEBITO',
        'N\\/D',
        'ND\\s+\\d'
      ],
      activo: true
    },
    ticket: {
      nombre: 'TICKET',
      patrones: [
        'TICKET\\s*FACTURA',
        '\\bTICKET\\b',
        'COMPROBANTE\\s+NO\\s+VALIDO'
      ],
      activo: true
    },
    recibo: {
      nombre: 'RECIBO',
      patrones: [
        'RECIBO\\s*\\d',
        'RECIBO\\s+OFICIAL',
        'RECIBO\\s+DE\\s+PAGO',
        '^RECIBO\\b'
      ],
      activo: true
    },
    remito: {
      nombre: 'REMITO',
      patrones: [
        '^REMITO\\b',
        '\\bREMITO\\s*\\d{4,}'
      ],
      activo: true
    }
  },
  prioridades: [
    { id: 'letra_sola_superior', nombre: 'Letra sola en zona superior (A, B, C, E, M)', orden: 1, activo: true },
    { id: 'factura_con_letra', nombre: 'FACTURA A/B/C/E/M', orden: 2, activo: true },
    { id: 'codigo_afip', nombre: 'Código AFIP (001, 006, 011, etc.)', orden: 3, activo: true },
    { id: 'notas_credito_debito', nombre: 'Notas de crédito/débito', orden: 4, activo: true },
    { id: 'ticket', nombre: 'Ticket', orden: 5, activo: true },
    { id: 'recibo', nombre: 'Recibo', orden: 6, activo: true },
    { id: 'factura_generica', nombre: 'FACTURA (sin especificar tipo)', orden: 7, activo: true },
    { id: 'remito', nombre: 'Remito', orden: 8, activo: true }
  ],
  opciones: {
    usarZonaSuperior: true,
    buscarLetraSola: true,
    logDetallado: true
  }
};

/**
 * GET /api/document-detection-config
 * Obtener configuración activa del tenant
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;

    // Buscar config activa del tenant
    let config = await prisma.document_detection_config.findFirst({
      where: {
        tenantId,
        activo: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Si no existe, buscar config global (sin tenant)
    if (!config) {
      config = await prisma.document_detection_config.findFirst({
        where: {
          tenantId: null,
          activo: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }

    // Si tampoco existe global, devolver config por defecto
    if (!config) {
      return res.json({
        success: true,
        config: {
          id: 'default',
          nombre: 'Configuración Por Defecto',
          descripcion: 'Configuración predeterminada del sistema',
          ...DEFAULT_CONFIG,
          isDefault: true
        }
      });
    }

    res.json({
      success: true,
      config: {
        id: config.id,
        nombre: config.nombre,
        descripcion: config.descripcion,
        ...config.config,
        isDefault: false,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.status(500).json({
      error: 'Error obteniendo configuración',
      details: error.message
    });
  }
});

/**
 * GET /api/document-detection-config/all
 * Listar todas las configuraciones (historial)
 */
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;

    const configs = await prisma.document_detection_config.findMany({
      where: {
        OR: [
          { tenantId },
          { tenantId: null } // Incluir globales
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true
      }
    });

    res.json({
      success: true,
      configs: configs.map(c => ({
        ...c,
        isGlobal: c.tenantId === null
      }))
    });

  } catch (error) {
    console.error('❌ Error listando configuraciones:', error);
    res.status(500).json({
      error: 'Error listando configuraciones',
      details: error.message
    });
  }
});

/**
 * POST /api/document-detection-config
 * Crear o actualizar configuración
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { tenantId, email } = req.user;
    const {
      nombre,
      descripcion,
      zonaBusqueda,
      patronesBusqueda,
      prioridades,
      opciones,
      activarInmediatamente
    } = req.body;

    // Validar datos requeridos
    if (!nombre || !zonaBusqueda || !patronesBusqueda || !prioridades) {
      return res.status(400).json({
        error: 'Faltan datos requeridos',
        required: ['nombre', 'zonaBusqueda', 'patronesBusqueda', 'prioridades']
      });
    }

    // Si se activa inmediatamente, desactivar la configuración anterior
    if (activarInmediatamente) {
      await prisma.document_detection_config.updateMany({
        where: {
          tenantId,
          activo: true
        },
        data: {
          activo: false
        }
      });
    }

    // Crear nueva configuración
    const newConfig = await prisma.document_detection_config.create({
      data: {
        tenantId,
        nombre,
        descripcion,
        activo: activarInmediatamente !== false, // Por defecto true
        config: {
          zonaBusqueda,
          patronesBusqueda,
          prioridades,
          opciones: opciones || DEFAULT_CONFIG.opciones
        },
        createdBy: email
      }
    });

    res.json({
      success: true,
      mensaje: 'Configuración guardada exitosamente',
      config: {
        id: newConfig.id,
        nombre: newConfig.nombre,
        activo: newConfig.activo
      }
    });

  } catch (error) {
    console.error('❌ Error guardando configuración:', error);
    res.status(500).json({
      error: 'Error guardando configuración',
      details: error.message
    });
  }
});

/**
 * PUT /api/document-detection-config/:id/activate
 * Activar una configuración específica
 */
router.put('/:id/activate', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Verificar que la config existe y pertenece al tenant
    const config = await prisma.document_detection_config.findFirst({
      where: {
        id,
        OR: [
          { tenantId },
          { tenantId: null } // Permitir activar configs globales
        ]
      }
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    // Desactivar todas las configs del tenant
    await prisma.document_detection_config.updateMany({
      where: { tenantId },
      data: { activo: false }
    });

    // Activar la seleccionada
    await prisma.document_detection_config.update({
      where: { id },
      data: { activo: true }
    });

    res.json({
      success: true,
      mensaje: `Configuración "${config.nombre}" activada`
    });

  } catch (error) {
    console.error('❌ Error activando configuración:', error);
    res.status(500).json({
      error: 'Error activando configuración',
      details: error.message
    });
  }
});

/**
 * DELETE /api/document-detection-config/:id
 * Eliminar configuración
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Verificar que la config existe y pertenece al tenant
    const config = await prisma.document_detection_config.findFirst({
      where: { id, tenantId }
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    // No permitir eliminar si es la única activa
    if (config.activo) {
      const otherConfigs = await prisma.document_detection_config.count({
        where: {
          tenantId,
          id: { not: id }
        }
      });

      if (otherConfigs === 0) {
        return res.status(400).json({
          error: 'No puedes eliminar la única configuración. Crea otra primero.'
        });
      }
    }

    await prisma.document_detection_config.delete({
      where: { id }
    });

    res.json({
      success: true,
      mensaje: 'Configuración eliminada'
    });

  } catch (error) {
    console.error('❌ Error eliminando configuración:', error);
    res.status(500).json({
      error: 'Error eliminando configuración',
      details: error.message
    });
  }
});

/**
 * POST /api/document-detection-config/test
 * Probar configuración contra un documento
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { config, documentId } = req.body;

    if (!config || !documentId) {
      return res.status(400).json({
        error: 'Se requiere config y documentId'
      });
    }

    // Obtener documento
    const documento = await prisma.documentos_procesados.findUnique({
      where: { id: documentId }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Simular detección con la configuración proporcionada
    const documentAIProcessor = require('../services/documentAIProcessor');
    const resultado = await documentAIProcessor.testDetectionConfig(config, documento);

    res.json({
      success: true,
      resultado
    });

  } catch (error) {
    console.error('❌ Error probando configuración:', error);
    res.status(500).json({
      error: 'Error probando configuración',
      details: error.message
    });
  }
});

/**
 * GET /api/document-detection-config/default
 * Obtener configuración por defecto del sistema
 */
router.get('/default', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    config: DEFAULT_CONFIG
  });
});

module.exports = router;
