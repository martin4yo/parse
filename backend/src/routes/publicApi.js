const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateOAuth, requireScope } = require('../middleware/oauthAuth');
const { rateLimiter } = require('../middleware/rateLimiter');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Aplicar rate limiting a todas las rutas
router.use(rateLimiter);

/**
 * GET /api/v1/documents
 * Listar documentos procesados
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Query Parameters:
 *   - status: completado | error | procesando
 *   - exportado: true | false
 *   - fechaDesde: YYYY-MM-DD
 *   - fechaHasta: YYYY-MM-DD
 *   - tipoComprobante: FACTURA A | FACTURA B | etc.
 *   - cuit: CUIT del proveedor
 *   - limit: Máximo 1000 (default: 100)
 *   - offset: Para paginación (default: 0)
 *   - sort: fechaExtraida | importeExtraido | fechaProcesamiento (default: fechaProcesamiento)
 *   - order: asc | desc (default: desc)
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "documents": [...],
 *     "pagination": { "total": 150, "limit": 100, "offset": 0, "hasMore": true }
 *   }
 * }
 */
router.get('/documents', authenticateOAuth, requireScope('read:documents'), async (req, res) => {
  try {
    const {
      status,
      exportado,
      fechaDesde,
      fechaHasta,
      tipoComprobante,
      cuit,
      limit = 100,
      offset = 0,
      sort = 'fechaProcesamiento',
      order = 'desc'
    } = req.query;

    // Construir filtro WHERE
    const where = {
      tenantId: req.tenant.id
    };

    if (status) {
      where.estadoProcesamiento = status;
    }

    if (exportado !== undefined) {
      where.exportado = exportado === 'true';
    }

    if (fechaDesde || fechaHasta) {
      where.fechaExtraida = {};
      if (fechaDesde) {
        where.fechaExtraida.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        where.fechaExtraida.lte = new Date(fechaHasta);
      }
    }

    if (tipoComprobante) {
      where.tipoComprobanteExtraido = tipoComprobante;
    }

    if (cuit) {
      where.cuitExtraido = cuit;
    }

    // Validar y sanitizar limit
    const parsedLimit = Math.min(parseInt(limit) || 100, 1000);
    const parsedOffset = parseInt(offset) || 0;

    // Validar sort field
    const validSortFields = ['fechaExtraida', 'importeExtraido', 'fechaProcesamiento', 'createdAt'];
    const sortField = validSortFields.includes(sort) ? sort : 'fechaProcesamiento';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    // Ejecutar query con paginación
    const [documents, total] = await Promise.all([
      prisma.documentos_procesados.findMany({
        where,
        take: parsedLimit,
        skip: parsedOffset,
        orderBy: { [sortField]: sortOrder },
        select: {
          id: true,
          nombreArchivo: true,
          tipoArchivo: true,
          fechaProcesamiento: true,
          estadoProcesamiento: true,
          fechaExtraida: true,
          importeExtraido: true,
          cuitExtraido: true,
          numeroComprobanteExtraido: true,
          razonSocialExtraida: true,
          tipoComprobanteExtraido: true,
          netoGravadoExtraido: true,
          exentoExtraido: true,
          impuestosExtraido: true,
          caeExtraido: true,
          exportado: true,
          externalSystemId: true,
          lastExportedAt: true,
          validationErrors: true,
          createdAt: true
        }
      }),
      prisma.documentos_procesados.count({ where })
    ]);

    // Construir URLs para cada documento
    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;
    const documentsWithUrls = documents.map(doc => ({
      ...doc,
      urls: {
        self: `${baseUrl}/documents/${doc.id}`,
        file: `${baseUrl}/documents/${doc.id}/file`,
        lineas: `${baseUrl}/documents/${doc.id}/lineas`,
        impuestos: `${baseUrl}/documents/${doc.id}/impuestos`
      }
    }));

    res.json({
      success: true,
      data: {
        documents: documentsWithUrls,
        pagination: {
          total,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: total > (parsedOffset + documents.length),
          nextUrl: total > (parsedOffset + documents.length)
            ? `${baseUrl}/documents?limit=${parsedLimit}&offset=${parsedOffset + parsedLimit}`
            : null
        }
      }
    });
  } catch (error) {
    console.error('❌ [Public API] Error listando documentos:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Error fetching documents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/documents/:id
 * Obtener detalles de un documento específico
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": { ... }
 * }
 */
router.get('/documents/:id', authenticateOAuth, requireScope('read:documents'), async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        tenantId: req.tenant.id
      },
      include: {
        proveedor: {
          select: {
            razonSocial: true,
            cuit: true,
            email: true,
            telefono: true,
            direccion: true
          }
        }
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Document not found'
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;

    res.json({
      success: true,
      data: {
        ...documento,
        urls: {
          self: `${baseUrl}/documents/${documento.id}`,
          file: `${baseUrl}/documents/${documento.id}/file`,
          lineas: `${baseUrl}/documents/${documento.id}/lineas`,
          impuestos: `${baseUrl}/documents/${documento.id}/impuestos`
        }
      }
    });
  } catch (error) {
    console.error('❌ [Public API] Error obteniendo documento:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Error fetching document',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/documents/:id/lineas
 * Obtener líneas de un documento
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "lineas": [...]
 *   }
 * }
 */
router.get('/documents/:id/lineas', authenticateOAuth, requireScope('read:documents'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        tenantId: req.tenant.id
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Document not found'
      });
    }

    const lineas = await prisma.documento_lineas.findMany({
      where: { documentoId: id },
      orderBy: { numeroLinea: 'asc' }
    });

    res.json({
      success: true,
      data: {
        lineas
      }
    });
  } catch (error) {
    console.error('❌ [Public API] Error obteniendo líneas:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Error fetching document lines',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/documents/:id/impuestos
 * Obtener impuestos de un documento
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "impuestos": [...]
 *   }
 * }
 */
router.get('/documents/:id/impuestos', authenticateOAuth, requireScope('read:documents'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        tenantId: req.tenant.id
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Document not found'
      });
    }

    const impuestos = await prisma.documento_impuestos.findMany({
      where: { documentoId: id },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: {
        impuestos
      }
    });
  } catch (error) {
    console.error('❌ [Public API] Error obteniendo impuestos:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Error fetching document taxes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/v1/documents/:id/mark-exported
 * Marcar un documento como exportado
 *
 * Body (JSON):
 * {
 *   "externalSystemId": "ERP-INV-12345",
 *   "exportedAt": "2025-01-21T10:00:00Z",  // Opcional, default: now
 *   "notes": "Importado exitosamente"      // Opcional
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Document marked as exported",
 *   "data": { ... }
 * }
 */
router.post('/documents/:id/mark-exported', authenticateOAuth, requireScope('write:documents'), async (req, res) => {
  try {
    const { id } = req.params;
    const { externalSystemId, exportedAt, notes } = req.body;

    // Verificar que el documento pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        tenantId: req.tenant.id
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Document not found'
      });
    }

    // Verificar si ya está exportado
    if (documento.exportado && !req.query.force) {
      return res.status(400).json({
        error: 'already_exported',
        message: 'Document was already marked as exported. Use ?force=true to override.',
        data: {
          exportedAt: documento.lastExportedAt,
          externalSystemId: documento.externalSystemId
        }
      });
    }

    // Actualizar documento
    const updated = await prisma.documentos_procesados.update({
      where: { id },
      data: {
        exportado: true,
        externalSystemId: externalSystemId || null,
        lastExportedAt: exportedAt ? new Date(exportedAt) : new Date(),
        exportConfigId: req.client.id,
        observaciones: notes || documento.observaciones
      }
    });

    console.log(`✅ [Public API] Documento ${id} marcado como exportado por cliente ${req.client.clientId}`);

    res.json({
      success: true,
      message: 'Document marked as exported',
      data: {
        id: updated.id,
        exportado: updated.exportado,
        externalSystemId: updated.externalSystemId,
        lastExportedAt: updated.lastExportedAt,
        exportConfigId: updated.exportConfigId
      }
    });
  } catch (error) {
    console.error('❌ [Public API] Error marcando documento como exportado:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Error marking document as exported',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/documents/:id/file
 * Descargar archivo original (PDF o imagen)
 *
 * Response 200:
 *   Content-Type: application/pdf | image/jpeg | image/png
 *   Content-Disposition: attachment; filename="factura.pdf"
 *   [Binary file content]
 */
router.get('/documents/:id/file', authenticateOAuth, requireScope('read:files'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        tenantId: req.tenant.id
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Document not found'
      });
    }

    if (!documento.pathArchivo) {
      return res.status(404).json({
        error: 'file_not_found',
        message: 'Original file path not found in database'
      });
    }

    // Verificar que el archivo existe
    try {
      await fs.access(documento.pathArchivo);
    } catch (err) {
      console.error(`❌ Archivo no encontrado en disco: ${documento.pathArchivo}`);
      return res.status(404).json({
        error: 'file_not_found',
        message: 'Original file not found on server'
      });
    }

    // Determinar content-type
    const contentType = documento.tipoArchivo || 'application/octet-stream';

    // Enviar archivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${documento.nombreArchivo}"`);
    res.sendFile(path.resolve(documento.pathArchivo));

    console.log(`✅ [Public API] Archivo descargado: ${documento.nombreArchivo} por cliente ${req.client.clientId}`);
  } catch (error) {
    console.error('❌ [Public API] Error descargando archivo:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Error downloading file',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/v1/health
 * Health check endpoint (no requiere autenticación)
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Parse Public API',
    version: '1.0.0'
  });
});

module.exports = router;
