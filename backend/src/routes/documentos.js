const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const DocumentProcessor = require('../lib/documentProcessor');
const { authWithTenant } = require('../middleware/authWithTenant');
const orchestrator = require('../services/documentExtractionOrchestrator');
const BusinessRulesEngine = require('../services/businessRulesEngine');

const router = express.Router();
const prisma = new PrismaClient();
const documentProcessor = new DocumentProcessor();

// Función helper para validar y completar campos en la asociación
async function validateAndUpdateAssociation(documento, resumen_tarjeta, userId) {
  // Normalizar CUIT
  const normalizeCuit = (cuit) => {
    if (!cuit) return null;
    const cleanCuit = cuit.toString().replace(/[-\s]/g, '');
    return /^0+$/.test(cleanCuit) ? null : cleanCuit;
  };

  // 1. Validar que el importe coincida
  if (documento.importeExtraido && resumen_tarjeta.importeTransaccion) {
    const importeDoc = parseFloat(documento.importeExtraido);
    const importeResumen = parseFloat(resumen_tarjeta.importeTransaccion);
    
    if (Math.abs(importeDoc - importeResumen) > 0.01) { // tolerancia de 1 centavo
      throw new Error(`El importe del comprobante ($${importeDoc}) no coincide con el del resumen ($${importeResumen})`);
    }
  }

  // 2. Validar CUIT solo si el resumen no tiene CUIT = "0" (cadena de ceros)
  const cuitResumen = normalizeCuit(resumen_tarjeta.cuit);
  const cuitDocumento = normalizeCuit(documento.cuitExtraido);

  if (cuitResumen && cuitDocumento && cuitResumen !== cuitDocumento) {
    throw new Error(`El CUIT del comprobante (${cuitDocumento}) no coincide con el del resumen (${cuitResumen})`);
  }

  // 3. Buscar proveedor por CUIT en parametros_maestros si hay CUIT del documento
  let proveedorId = null;
  if (cuitDocumento) {
    const { PrismaClient } = require('@prisma/client');
    const prismaForParams = new PrismaClient();

    try {
      const parametroProveedor = await prismaForParams.parametros_maestros.findFirst({
        where: {
          tipo_campo: 'tipo_registro',
          parametros_json: {
            path: ['cuit'],
            equals: cuitDocumento
          }
        }
      });

      if (parametroProveedor) {
        proveedorId = parametroProveedor.codigo;
      }
    } finally {
      await prismaForParams.$disconnect();
    }
  }

  // 4. Buscar rendicion_tarjeta_item asociado al resumen y actualizarlo
  const { PrismaClient } = require('@prisma/client');
  const prismaInstance = new PrismaClient();

  try {
    const rendicion_tarjeta_items = await prismaInstance.rendicion_tarjeta_items.findFirst({
      where: {
        resumenTarjetaId: resumen_tarjeta.id
      }
    });

    if (rendicion_tarjeta_items) {
      const updateData = {};

      if (documento.fechaExtraida) {
        updateData.fechaComprobante = documento.fechaExtraida;
      }

      if (proveedorId) {
        updateData.proveedorId = proveedorId;
      }

      if (documento.numeroComprobanteExtraido) {
        updateData.numeroComprobante = documento.numeroComprobanteExtraido;
      }

      if (Object.keys(updateData).length > 0) {
        await prismaInstance.rendicion_tarjeta_items.update({
          where: { id: rendicion_tarjeta_items.id },
          data: updateData
        });
      }

      return { proveedorId, updateData, rendicionItemId: rendicion_tarjeta_items.id };
    }

    return { proveedorId, updateData: {}, rendicionItemId: null };
  } finally {
    await prismaInstance.$disconnect();
  }

  return { proveedorId, updateData: {}, rendicionItemId: null };
}

// Aplicar middleware de autenticación a todas las rutas
router.use(authWithTenant);

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/documentos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten PDF, JPG, JPEG y PNG.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// POST /api/documentos/procesar - Subir y procesar documento
router.post('/procesar', authWithTenant, upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const { rendicionItemId, tipo, cajaId } = req.body;
    const userId = req.user.id; // Asumiendo middleware de autenticación

    console.log('📝 Procesando documento:', { tipo, cajaId, userId, fileName: req.file.originalname });

    // Determinar tipo de archivo
    const tipoArchivo = path.extname(req.file.filename).toLowerCase().substring(1);
    
    // Validación de duplicados por nombre de archivo y tenant (previene subida a efectivo Y tarjeta)
    const documentoDuplicado = await prisma.documentos_procesados.findFirst({
      where: {
        tenantId: req.tenantId,
        nombreArchivo: req.file.originalname
      }
    });

    if (documentoDuplicado) {
      // Eliminar el archivo subido ya que es duplicado
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        error: `El archivo "${req.file.originalname}" ya existe en comprobantes. No se puede subir nuevamente.`
      });
    }
    
    // Crear registro inicial en la base de datos
    const createData = {
      id: crypto.randomUUID(),
      nombreArchivo: req.file.originalname,
      tipoArchivo: tipoArchivo,
      rutaArchivo: req.file.path,
      estadoProcesamiento: 'procesando',
      tipo: tipo || 'tarjeta', // Por defecto tarjeta para retrocompatibilidad
      users: {
        connect: { id: userId }
      },
      tenants: {
        connect: { id: req.tenantId || 'default-tenant-id' }
      },
      updatedAt: new Date()
    };

    // Si es documento de tarjeta y se proporciona rendicionItemId, agregarlo
    if (rendicionItemId) {
      createData.rendicion_tarjeta_items = {
        connect: { id: rendicionItemId }
      };
    }

    const documento = await prisma.documentos_procesados.create({
      data: createData
    });

    // Procesar archivo en segundo plano
    processDocumentAsync(documento.id, req.file.path, tipoArchivo);

    res.json({
      success: true,
      documentoId: documento.id,
      mensaje: 'Archivo subido correctamente. El procesamiento comenzará en breve.'
    });

  } catch (error) {
    console.error('Error en upload:', error);
    // Preservar el mensaje específico del error si está disponible
    const errorMessage = error.message || 'Error interno del servidor';
    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/documentos/:id/archivo - Obtener archivo para visualización
router.get('/:id/archivo', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('Solicitud de archivo:', { id, userId, hasToken: !!req.query.token });
    
    const documento = await prisma.documentos_procesados.findFirst({
      where: { 
        id,
        usuarioId: userId 
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(documento.rutaArchivo)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    // Determinar el tipo MIME
    let contentType = 'application/octet-stream';
    if (documento.tipoArchivo === 'pdf') {
      contentType = 'application/pdf';
    } else if (documento.tipoArchivo === 'jpg' || documento.tipoArchivo === 'jpeg') {
      contentType = 'image/jpeg';
    } else if (documento.tipoArchivo === 'png') {
      contentType = 'image/png';
    }

    // Enviar el archivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${documento.nombreArchivo}"`);
    
    const fileStream = fs.createReadStream(documento.rutaArchivo);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error sirviendo archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/documentos/view/:id - View document (PDF/image) - DEBE IR ANTES DE /:id/view-url
router.get('/view/:id', authWithTenant, async (req, res) => {
  try {
    console.log('🔍 [VIEW ROUTE] Request received for document:', req.params.id);
    const { id } = req.params;
    const userId = req.user.id;

    // Buscar por usuario directo
    let documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        usuarioId: userId
      }
    });

    if (!documento) {
      console.log('Documento no encontrado para usuario:', userId, 'documentoId:', id);
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!documento.rutaArchivo) {
      return res.status(404).json({ error: 'Archivo no disponible' });
    }

    // Check if file exists
    try {
      await fs.promises.access(documento.rutaArchivo);
    } catch {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    // Determine content type
    let contentType = 'application/octet-stream';
    const ext = path.extname(documento.rutaArchivo).toLowerCase();

    switch(ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
    }

    // Read and send file
    const fileBuffer = await fs.promises.readFile(documento.rutaArchivo);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${documento.nombreArchivo}"`);
    res.send(fileBuffer);

  } catch (error) {
    console.error('Error viewing document:', error);
    res.status(500).json({ error: 'Error al visualizar el documento' });
  }
});

// GET /api/documentos/:id/view-url - Generar URL para visualización con token
router.get('/:id/view-url', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        usuarioId: userId
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Generar token temporal (válido por 1 hora)
    const jwt = require('jsonwebtoken');
    const tempToken = jwt.sign(
      { userId: userId, documentoId: id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // La URL debe apuntar al backend donde está el endpoint de archivos
    let baseUrl;

    // Configuración específica para producción
    if (process.env.NODE_ENV === 'production') {
      // En producción, usar BASE_URL si existe, sino usar configuración hardcodeada para el servidor específico
      if (process.env.BASE_URL) {
        baseUrl = process.env.BASE_URL;
      } else {
        // Configuración por defecto para el servidor de producción
        baseUrl = 'http://149.50.148.198:8084';
      }
    } else {
      // En desarrollo, detectar automáticamente
      const protocol = req.secure ? 'https' : 'http';
      const host = req.get('host');
      baseUrl = `${protocol}://${host}`;
    }

    console.log(`[DEBUG] Generando viewUrl - NODE_ENV: ${process.env.NODE_ENV}, BASE_URL: ${process.env.BASE_URL}, baseUrl: ${baseUrl}, host: ${req.get('host')}`);

    const viewUrl = `${baseUrl}/api/documentos/${id}/archivo?token=${tempToken}`;

    res.json({
      success: true,
      viewUrl,
      nombreArchivo: documento.nombreArchivo,
      tipoArchivo: documento.tipoArchivo
    });

  } catch (error) {
    console.error('Error generando URL de visualización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/documentos/:id - Obtener estado de procesamiento
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    
    const documento = await prisma.documentos_procesados.findUnique({
      where: { id },
      include: {
        users: {
          select: { nombre: true, apellido: true }
        },
        tenants: true,
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const responseDoc = {
      ...documento
    };

    res.json(responseDoc);

  } catch (error) {
    console.error('Error obteniendo documento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/documentos/:id/lineas - Obtener line items de un documento
router.get('/:id/lineas', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    // Verificar que el documento pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id, tenantId }
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Obtener line items
    const lineas = await prisma.documento_lineas.findMany({
      where: {
        documentoId: id,
        tenantId: tenantId
      },
      orderBy: { numero: 'asc' }
    });

    // Calcular totales
    const totales = {
      cantidadItems: lineas.length,
      subtotal: lineas.reduce((sum, l) => sum + parseFloat(l.subtotal), 0),
      totalIva: lineas.reduce((sum, l) => sum + parseFloat(l.importeIva || 0), 0),
      total: lineas.reduce((sum, l) => sum + parseFloat(l.totalLinea), 0)
    };

    res.json({
      success: true,
      lineas,
      totales
    });

  } catch (error) {
    console.error('Error obteniendo line items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/documentos/:id/impuestos - Obtener impuestos detallados de un documento
router.get('/:id/impuestos', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    // Verificar que el documento pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id, tenantId }
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Obtener impuestos detallados
    const impuestos = await prisma.documento_impuestos.findMany({
      where: {
        documentoId: id,
        tenantId: tenantId
      },
      orderBy: { tipo: 'asc' }
    });

    // Calcular totales por tipo
    const totalesPorTipo = impuestos.reduce((acc, imp) => {
      const tipo = imp.tipo;
      if (!acc[tipo]) {
        acc[tipo] = {
          tipo,
          cantidad: 0,
          total: 0
        };
      }
      acc[tipo].cantidad++;
      acc[tipo].total += parseFloat(imp.importe);
      return acc;
    }, {});

    const totalGeneral = impuestos.reduce((sum, imp) => sum + parseFloat(imp.importe), 0);

    res.json({
      success: true,
      impuestos,
      resumen: {
        cantidadImpuestos: impuestos.length,
        totalGeneral,
        porTipo: Object.values(totalesPorTipo)
      }
    });

  } catch (error) {
    console.error('Error obteniendo impuestos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/documentos/lineas/:id - Actualizar un line item
router.put('/lineas/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { numero, descripcion, codigoProducto, cantidad, unidad, precioUnitario, subtotal, alicuotaIva, importeIva, totalLinea } = req.body;

    // Verificar que el line item pertenece al tenant
    const lineItem = await prisma.documento_lineas.findFirst({
      where: { id, tenantId }
    });

    if (!lineItem) {
      return res.status(404).json({
        success: false,
        error: 'Line item no encontrado'
      });
    }

    // Actualizar line item
    const updated = await prisma.documento_lineas.update({
      where: { id },
      data: {
        numero: numero !== undefined ? parseInt(numero) : undefined,
        descripcion: descripcion !== undefined ? descripcion : undefined,
        codigoProducto: codigoProducto !== undefined ? codigoProducto : undefined,
        cantidad: cantidad !== undefined ? parseFloat(cantidad) : undefined,
        unidad: unidad !== undefined ? unidad : undefined,
        precioUnitario: precioUnitario !== undefined ? parseFloat(precioUnitario) : undefined,
        subtotal: subtotal !== undefined ? parseFloat(subtotal) : undefined,
        alicuotaIva: alicuotaIva !== undefined ? (alicuotaIva ? parseFloat(alicuotaIva) : null) : undefined,
        importeIva: importeIva !== undefined ? (importeIva ? parseFloat(importeIva) : null) : undefined,
        totalLinea: totalLinea !== undefined ? parseFloat(totalLinea) : undefined
      }
    });

    res.json({
      success: true,
      lineItem: updated
    });

  } catch (error) {
    console.error('Error actualizando line item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/documentos/impuestos/:id - Actualizar un impuesto
router.put('/impuestos/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { tipo, descripcion, alicuota, baseImponible, importe } = req.body;

    // Verificar que el impuesto pertenece al tenant
    const impuesto = await prisma.documento_impuestos.findFirst({
      where: { id, tenantId }
    });

    if (!impuesto) {
      return res.status(404).json({
        success: false,
        error: 'Impuesto no encontrado'
      });
    }

    // Actualizar impuesto
    const updated = await prisma.documento_impuestos.update({
      where: { id },
      data: {
        tipo: tipo !== undefined ? tipo : undefined,
        descripcion: descripcion !== undefined ? descripcion : undefined,
        alicuota: alicuota !== undefined ? (alicuota ? parseFloat(alicuota) : null) : undefined,
        baseImponible: baseImponible !== undefined ? (baseImponible ? parseFloat(baseImponible) : null) : undefined,
        importe: importe !== undefined ? parseFloat(importe) : undefined
      }
    });

    res.json({
      success: true,
      impuesto: updated
    });

  } catch (error) {
    console.error('Error actualizando impuesto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/documentos/:id/lineas - Crear una nueva línea
router.post('/:id/lineas', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const {
      numero,
      descripcion,
      codigoProducto,
      cantidad,
      unidad,
      precioUnitario,
      subtotal,
      alicuotaIva,
      importeIva,
      totalLinea
    } = req.body;

    // Verificar que el documento existe y pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id, tenantId }
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Crear la nueva línea
    const { v4: uuidv4 } = require('uuid');
    const nuevaLinea = await prisma.documento_lineas.create({
      data: {
        id: uuidv4(),
        documentoId: id,
        numero: parseInt(numero),
        descripcion: descripcion,
        codigoProducto: codigoProducto || null,
        cantidad: parseFloat(cantidad),
        unidad: unidad || null,
        precioUnitario: parseFloat(precioUnitario),
        subtotal: parseFloat(subtotal),
        alicuotaIva: alicuotaIva ? parseFloat(alicuotaIva) : null,
        importeIva: importeIva ? parseFloat(importeIva) : null,
        totalLinea: parseFloat(totalLinea),
        tenantId: tenantId
      }
    });

    res.json({
      success: true,
      linea: nuevaLinea
    });

  } catch (error) {
    console.error('Error creando línea:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/documentos/lineas/:id - Eliminar una línea
router.delete('/lineas/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    // Verificar que la línea pertenece al tenant
    const linea = await prisma.documento_lineas.findFirst({
      where: { id, tenantId }
    });

    if (!linea) {
      return res.status(404).json({
        success: false,
        error: 'Línea no encontrada'
      });
    }

    // Eliminar la línea
    await prisma.documento_lineas.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Línea eliminada correctamente'
    });

  } catch (error) {
    console.error('Error eliminando línea:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/documentos/:id/impuestos - Crear un nuevo impuesto
router.post('/:id/impuestos', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const {
      tipo,
      descripcion,
      alicuota,
      baseImponible,
      importe
    } = req.body;

    // Verificar que el documento existe y pertenece al tenant
    const documento = await prisma.documentos_procesados.findFirst({
      where: { id, tenantId }
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Crear el nuevo impuesto
    const { v4: uuidv4 } = require('uuid');
    const nuevoImpuesto = await prisma.documento_impuestos.create({
      data: {
        id: uuidv4(),
        documentoId: id,
        tipo: tipo,
        descripcion: descripcion,
        alicuota: alicuota ? parseFloat(alicuota) : null,
        baseImponible: baseImponible ? parseFloat(baseImponible) : null,
        importe: parseFloat(importe),
        tenantId: tenantId
      }
    });

    res.json({
      success: true,
      impuesto: nuevoImpuesto
    });

  } catch (error) {
    console.error('Error creando impuesto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/documentos/impuestos/:id - Eliminar un impuesto
router.delete('/impuestos/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    // Verificar que el impuesto pertenece al tenant
    const impuesto = await prisma.documento_impuestos.findFirst({
      where: { id, tenantId }
    });

    if (!impuesto) {
      return res.status(404).json({
        success: false,
        error: 'Impuesto no encontrado'
      });
    }

    // Eliminar el impuesto
    await prisma.documento_impuestos.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Impuesto eliminado correctamente'
    });

  } catch (error) {
    console.error('Error eliminando impuesto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/documentos - Obtener documentos del usuario
router.get('/', authWithTenant, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rendicionItemId, includeMetrics, tipo } = req.query;

    const where = req.filterByTenant({
      usuarioId: userId
    });

    if (rendicionItemId) {
      where.rendicionItemId = rendicionItemId;
    }

    // Filtrar por tipo si se especifica
    if (tipo) {
      where.tipo = tipo;
    }

    const documentos = await prisma.documentos_procesados.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    // Si se solicitan métricas, calcularlas
    let metrics = null;
    if (includeMetrics === 'true') {
      const totalSubidos = documentos.length;
      const totalConError = documentos.filter(doc => doc.estadoProcesamiento === 'error').length;
      const totalCompletados = documentos.filter(doc => doc.estadoProcesamiento === 'completado').length;
      const totalPendientes = totalSubidos - totalCompletados - totalConError;

      metrics = {
        subidos: totalSubidos,
        completados: totalCompletados,
        pendientes: totalPendientes,
        conError: totalConError
      };
    }

    res.json({
      documentos,
      metrics
    });

  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/documentos/:id/aplicar - Aplicar datos extraídos al item de rendición
// RENDICIONES - Endpoint comentado (no usado en Parse)
// router.put('/:id/aplicar', authWithTenant, async (req, res) => {
//   ...
// });

// POST /api/documentos/asociar-automatico-individual - Asociar un documento individual
router.post('/asociar-automatico-individual', async (req, res) => {
  // FUNCIONALIDAD DESHABILITADA: No existe tabla resumen_tarjeta
  return res.status(501).json({
    success: false,
    error: 'Asociación automática no disponible - funcionalidad deshabilitada'
  });

  /* CÓDIGO COMENTADO - REQUIERE TABLA resumen_tarjeta QUE NO EXISTE
  try {
    const userId = req.user.id;
    const tenantId = req.tenantId;
    const { documentoId } = req.body;

    console.log('🔄 Procesando documento individual:', { documentoId, userId });
    
    // Obtener el documento específico
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id: documentoId,
        usuarioId: userId,
        estadoProcesamiento: 'completado'
      },
      select: {
        id: true,
        fechaExtraida: true,
        importeExtraido: true,
        cuitExtraido: true
      }
    });

    if (!documento) {
      return res.json({
        success: true,
        resultado: {
          documentoId,
          estado: 'no_encontrado',
          mensaje: 'Documento no encontrado o ya asociado'
        }
      });
    }

    if (!documento.fechaExtraida || !documento.importeExtraido) {
      return res.json({
        success: true,
        resultado: {
          documentoId,
          estado: 'sin_datos',
          mensaje: 'Datos insuficientes para asociación automática'
        }
      });
    }

    // Obtener las tarjetas del usuario a través de las delegaciones
    const effectiveTenantIdForDelegaciones = tenantId || req.user?.tenantId;

    console.log('🔍 [delegaciones] Buscando con:', {
      usuarioId: userId,
      tenantId: tenantId,
      userTenantId: req.user?.tenantId,
      effectiveTenantId: effectiveTenantIdForDelegaciones
    });

    const delegacionesWhereClause = {
      usuarioId: userId,
      activo: true
    };

    if (effectiveTenantIdForDelegaciones) {
      delegacionesWhereClause.tenantId = effectiveTenantIdForDelegaciones;
    }

    // Obtener delegaciones
    const delegaciones = await prisma.delegacion_tarjetas.findMany({
      where: delegacionesWhereClause,
      include: {
        user_tarjetas_credito: true
      }
    });

    console.log('🔍 [delegaciones] Encontradas:', delegaciones.length);

    // Obtener tarjetas propias del usuario
    const tarjetasPropias = await prisma.user_tarjetas_credito.findMany({
      where: {
        userId: userId,
        activo: true
      }
    });

    console.log('🔍 [tarjetas propias] Encontradas:', tarjetasPropias.length);

    // Combinar ambas fuentes de tarjetas
    const numerosTarjetaDelegadas = delegaciones.map(d => d.user_tarjetas_credito.numeroTarjeta);
    const numerosTarjetaPropias = tarjetasPropias.map(t => t.numeroTarjeta);
    const numerosTarjeta = [...new Set([...numerosTarjetaDelegadas, ...numerosTarjetaPropias])]; // Eliminar duplicados

    console.log('🏦 Tarjetas del usuario (delegadas):', numerosTarjetaDelegadas);
    console.log('🏦 Tarjetas del usuario (propias):', numerosTarjetaPropias);
    console.log('🏦 Tarjetas del usuario (total):', numerosTarjeta);

    // Funciones helper para las nuevas reglas de comparación (mismas que en /asociar-automatica)
    const parseFechaDDMMYY = (fechaStr) => {
      if (!fechaStr || fechaStr.length !== 6) return null;
      const dd = fechaStr.substring(0, 2);
      const mm = fechaStr.substring(2, 4);
      const yy = fechaStr.substring(4, 6);
      const year = parseInt(yy) + (parseInt(yy) > 50 ? 1900 : 2000);
      return `${year}-${mm}-${dd}`;
    };

    const parseImporteNumerico = (importe) => {
      if (importe === null || importe === undefined) return null;
      return parseFloat(importe).toFixed(6);
    };

    const normalizeCuit = (cuit) => {
      if (!cuit) return null;
      const cleanCuit = cuit.toString().replace(/[-\s]/g, '');
      return cleanCuit === '0' || cleanCuit === '0000000000000' ? null : cleanCuit;
    };

    const esMonedaUSD = (texto) => {
      if (!texto) return false;
      const textoLower = texto.toLowerCase();
      return textoLower.includes('dolar') || textoLower.includes('usd') || textoLower.includes('dollar');
    };

    try {
      // Obtener datos completos del documento para verificar moneda
      const docCompleto = await prisma.documentos_procesados.findUnique({
        where: { id: documento.id }
      });

      const textoDocumento = docCompleto?.datosExtraidos?.texto || '';
      const requiereUSD = esMonedaUSD(textoDocumento);

      // Preparar datos para comparación
      const docFechaISO = documento.fechaExtraida.toISOString().split('T')[0];
      const docImporteNorm = parseImporteNumerico(documento.importeExtraido);
      const docCuitNorm = normalizeCuit(documento.cuitExtraido);

      console.log('🔍 Datos documento normalizados:', {
        fecha: docFechaISO,
        importe: docImporteNorm,
        cuit: docCuitNorm,
        requiereUSD
      });

      // Buscar todos los registros potenciales de resumen_tarjeta con nuevas reglas
      const whereClause = {
        AND: [
          {
            numeroTarjeta: { in: numerosTarjeta }
          }
        ]
      };

      // Solo agregar filtro de tenant si existe
      const effectiveTenantId = tenantId || req.user?.tenantId;
      if (effectiveTenantId) {
        whereClause.AND.push({
          tenantId: effectiveTenantId
        });
      }

      const registrosResumen = await prisma.resumen_tarjeta.findMany({
        where: whereClause
      });

      let coincidencias = [];
      
      for (const resumen of registrosResumen) {
        // 1. Convertir fecha DDMMYY a ISO
        const resFechaISO = parseFechaDDMMYY(resumen.fechaTransaccion);
        
        // 2. Normalizar importe
        const resImporteNorm = parseImporteNumerico(resumen.importeTransaccion);
        
        // 3. Normalizar CUIT
        const resCuitNorm = normalizeCuit(resumen.cuit);
        
        // 4. Verificar moneda USD si es requerida
        const resMonedaOk = !requiereUSD || (resumen.monedaOrigenDescripcion && resumen.monedaOrigenDescripcion.includes('USD'));

        // Verificar coincidencias
        const fechaMatch = docFechaISO === resFechaISO;
        const importeMatch = docImporteNorm === resImporteNorm;
        const cuitMatch = !docCuitNorm || !resCuitNorm || docCuitNorm === resCuitNorm;
        
        if (fechaMatch && importeMatch && resMonedaOk && cuitMatch) {
          coincidencias.push({
            resumen,
            tieneCuit: !!(docCuitNorm && resCuitNorm)
          });
        }
      }

      console.log(`🎯 Encontradas ${coincidencias.length} coincidencias potenciales`);

      if (coincidencias.length > 0) {
        // 5. Lógica de selección (igual que en /asociar-automatica)
        const sinCuit = coincidencias.filter(c => !c.tieneCuit);
        const conCuit = coincidencias.filter(c => c.tieneCuit);

        let coincidenciaFinal = null;

        if (conCuit.length > 0) {
          console.log('🔐 Usando coincidencia con CUIT');
          coincidenciaFinal = conCuit[0].resumen;
        } else if (sinCuit.length === 1) {
          console.log('📝 Una sola coincidencia sin CUIT');
          coincidenciaFinal = sinCuit[0].resumen;
        } else if (sinCuit.length > 1) {
          const cupones = new Set(sinCuit.map(c => c.resumen.numeroCupon).filter(c => c));
          if (cupones.size === sinCuit.length) {
            console.log('🎫 Múltiples coincidencias con cupones únicos');
            coincidenciaFinal = sinCuit[0].resumen;
          } else {
            console.log('⚠️ Múltiples coincidencias ambiguas');
            return res.json({
              success: false,
              resultado: {
                documentoId,
                estado: 'multiples_coincidencias',
                mensaje: `Se encontraron ${sinCuit.length} coincidencias múltiples para el mismo importe y fecha. Se requiere asociación manual.`,
                detalles: {
                  coincidencias: sinCuit.length,
                  fecha: docFechaISO,
                  importe: docImporteNorm
                }
              }
            });
          }
        }

        if (coincidenciaFinal) {
          console.log('🔗 ASOCIANDO con:', coincidenciaFinal.id);
          
          // Obtener documento completo para validaciones
          const documentoCompleto = await prisma.documentos_procesados.findUnique({
            where: { id: documento.id }
          });

          // Aplicar validaciones y completado de campos
          let validationResult;
          try {
            validationResult = await validateAndUpdateAssociation(documentoCompleto, coincidenciaFinal, userId);
          } catch (error) {
            console.log('❌ Error en validaciones:', error.message);
            return res.json({
              success: true,
              resultado: {
                documentoId,
                estado: 'error_validacion',
                mensaje: `Error de validación: ${error.message}`
              }
            });
          }
          
          // Crear la asociación
          await prisma.documentos_asociados.create({
            data: {
              id: uuidv4(),
              documentoProcesadoId: documento.id,
              resumenTarjetaId: coincidenciaFinal.id,
              usuarioAsociacion: userId,
              observaciones: 'Asociación automática individual por coincidencia de fecha, importe y nuevas reglas',
              updatedAt: new Date()
            }
          });

          return res.json({
            success: true,
            resultado: {
              documentoId,
              estado: 'asociado',
              resumenTarjetaId: coincidenciaFinal.id,
              numeroCupon: coincidenciaFinal.numeroCupon,
              mensaje: 'Asociado automáticamente',
              datosActualizados: validationResult.updateData
            }
          });
        } else {
          return res.json({
            success: true,
            resultado: {
              documentoId,
              estado: 'ambiguo',
              mensaje: 'Múltiples coincidencias ambiguas, requiere asociación manual'
            }
          });
        }
      } else {
        return res.json({
          success: true,
          resultado: {
            documentoId,
            estado: 'sin_coincidencia',
            mensaje: 'No se encontró coincidencia automática'
          }
        });
      }
    } catch (error) {
      console.error('Error procesando documento individual:', documentoId, error);
      return res.json({
        success: true,
        resultado: {
          documentoId,
          estado: 'error',
          mensaje: `Error: ${error.message}`
        }
      });
    }
  } catch (error) {
    console.error('Error en asociación automática individual:', error);
    // Preservar el mensaje específico del error si está disponible
    const errorMessage = error.message || 'Error interno del servidor';
    res.status(500).json({ error: errorMessage });
  }
  */
});

// POST /api/documentos/asociar-automatico - Asociación automática de documentos pendientes
router.post('/asociar-automatico', async (req, res) => {
  // FUNCIONALIDAD DESHABILITADA: No existe tabla resumen_tarjeta
  return res.status(501).json({
    success: false,
    error: 'Asociación automática masiva no disponible - funcionalidad deshabilitada'
  });

  /* CÓDIGO COMENTADO - REQUIERE TABLA resumen_tarjeta QUE NO EXISTE
  try {
    const userId = req.user.id;
    
    console.log('🔄 Iniciando asociación automática para usuario:', userId);
    
    // Obtener documentos pendientes del usuario (completados pero sin asociar)
    const documentosPendientes = await prisma.documentos_procesados.findMany({
      where: req.filterByTenant({
        usuarioId: userId,
        estadoProcesamiento: 'completado',
        documentos_asociados: {
          none: {}  // No tiene asociaciones
        }
      }),
      select: {
        id: true,
        fechaExtraida: true,
        importeExtraido: true,
        cuitExtraido: true
      }
    });

    console.log('Documentos pendientes encontrados:', documentosPendientes.length);

    // Obtener las tarjetas del usuario a través de las delegaciones
    const delegaciones = await prisma.delegacion_tarjetas.findMany({
      where: {
        usuarioId: userId,
        activo: true
      },
      include: {
        tarjetaCredito: true
      }
    });

    const numerosTarjeta = delegaciones.map(d => d.tarjetaCredito.numeroTarjeta);
    console.log('Tarjetas del usuario:', numerosTarjeta);

    const resultados = [];

    // Funciones helper para las nuevas reglas de comparación
    const parseFechaDDMMYY = (fechaStr) => {
      if (!fechaStr || fechaStr.length !== 6) return null;
      const dd = fechaStr.substring(0, 2);
      const mm = fechaStr.substring(2, 4);
      const yy = fechaStr.substring(4, 6);
      const year = parseInt(yy) + (parseInt(yy) > 50 ? 1900 : 2000); // Asume siglo
      return `${year}-${mm}-${dd}`;
    };

    const parseImporteNumerico = (importe) => {
      if (importe === null || importe === undefined) return null;
      return parseFloat(importe).toFixed(6);
    };

    const normalizeCuit = (cuit) => {
      if (!cuit) return null;
      const cleanCuit = cuit.toString().replace(/[-\s]/g, '');
      return cleanCuit === '0' || cleanCuit === '0000000000000' ? null : cleanCuit;
    };

    const esMonedaUSD = (texto) => {
      if (!texto) return false;
      const textoLower = texto.toLowerCase();
      return textoLower.includes('dolar') || textoLower.includes('usd') || textoLower.includes('dollar');
    };

    for (const documento of documentosPendientes) {
      console.log('Procesando documento:', documento.id);
      
      if (!documento.fechaExtraida || !documento.importeExtraido) {
        console.log('Documento sin datos suficientes (fecha/importe):', documento.id);
        resultados.push({
          documentoId: documento.id,
          estado: 'sin_datos',
          mensaje: 'Datos insuficientes para asociación automática'
        });
        continue;
      }

      try {
        // Obtener datos del documento procesado completo para verificar moneda
        const docCompleto = await prisma.documentos_procesados.findUnique({
          where: { id: documento.id }
        });

        const textoDocumento = docCompleto?.datosExtraidos?.texto || '';
        const requiereUSD = esMonedaUSD(textoDocumento);
        
        console.log('Documento requiere USD:', requiereUSD);

        // Preparar datos para comparación
        const docFechaISO = documento.fechaExtraida.toISOString().split('T')[0];
        const docImporteNorm = parseImporteNumerico(documento.importeExtraido);
        const docCuitNorm = normalizeCuit(documento.cuitExtraido);

        console.log('Datos documento normalizados:', {
          fecha: docFechaISO,
          importe: docImporteNorm,
          cuit: docCuitNorm,
          requiereUSD
        });

        // Buscar todos los registros potenciales de resumen_tarjeta
        const registrosResumen = await prisma.resumen_tarjeta.findMany({
          where: {
            numeroTarjeta: { in: numerosTarjeta }
          }
        });

        console.log(`Encontrados ${registrosResumen.length} registros de resumen sin asociar`);

        let coincidencias = [];
        
        for (const resumen of registrosResumen) {
          // 1. Convertir fecha DDMMYY a ISO
          const resFechaISO = parseFechaDDMMYY(resumen.fechaTransaccion);
          
          // 2. Normalizar importe
          const resImporteNorm = parseImporteNumerico(resumen.importeTransaccion);
          
          // 3. Normalizar CUIT
          const resCuitNorm = normalizeCuit(resumen.cuit);
          
          // 4. Verificar moneda USD si es requerida
          const resMonedaOk = !requiereUSD || (resumen.monedaOrigenDescripcion && resumen.monedaOrigenDescripcion.includes('USD'));

          console.log('Comparando con resumen:', {
            id: resumen.id,
            fecha: resFechaISO,
            importe: resImporteNorm,
            cuit: resCuitNorm,
            moneda: resumen.monedaOrigenDescripcion,
            monedaOk: resMonedaOk
          });

          // Verificar coincidencias
          const fechaMatch = docFechaISO === resFechaISO;
          const importeMatch = docImporteNorm === resImporteNorm;
          const cuitMatch = !docCuitNorm || !resCuitNorm || docCuitNorm === resCuitNorm;
          
          if (fechaMatch && importeMatch && resMonedaOk && cuitMatch) {
            coincidencias.push({
              resumen,
              tieneCuit: !!(docCuitNorm && resCuitNorm)
            });
          }
        }

        console.log(`Encontradas ${coincidencias.length} coincidencias potenciales`);

        if (coincidencias.length > 0) {
          // 5. Verificar regla especial: si no hay CUIT, verificar que no haya duplicados
          const sinCuit = coincidencias.filter(c => !c.tieneCuit);
          const conCuit = coincidencias.filter(c => c.tieneCuit);

          let coincidenciaFinal = null;

          if (conCuit.length > 0) {
            // Preferir coincidencias con CUIT
            coincidenciaFinal = conCuit[0].resumen;
          } else if (sinCuit.length === 1) {
            // Solo una coincidencia sin CUIT
            coincidenciaFinal = sinCuit[0].resumen;
          } else if (sinCuit.length > 1) {
            // Múltiples coincidencias sin CUIT - verificar si tienen diferentes cupones
            const cupones = new Set(sinCuit.map(c => c.resumen.numeroCupon).filter(c => c));
            if (cupones.size === sinCuit.length) {
              // Todos tienen cupones diferentes, tomar el primero
              coincidenciaFinal = sinCuit[0].resumen;
            } else {
              // Hay cupones duplicados o vacíos, no asociar
              console.log('Múltiples coincidencias ambiguas sin CUIT válido');
            }
          }

          if (coincidenciaFinal) {
            console.log('Asociando con:', coincidenciaFinal.id);

            // Obtener documento completo para validaciones
            const documentoCompleto = await prisma.documentos_procesados.findUnique({
              where: { id: documento.id }
            });

            // Aplicar validaciones y completado de campos
            let validationResult;
            try {
              validationResult = await validateAndUpdateAssociation(documentoCompleto, coincidenciaFinal, userId);
              
              // Crear la asociación solo si las validaciones pasan
              await prisma.documentos_asociados.create({
                data: {
                  documentoProcesadoId: documento.id,
                  resumenTarjetaId: coincidenciaFinal.id,
                  usuarioAsociacion: userId,
                  observaciones: 'Asociación automática con nuevas reglas de comparación'
                }
              });

              resultados.push({
                documentoId: documento.id,
                estado: 'asociado',
                resumenTarjetaId: coincidenciaFinal.id,
                mensaje: 'Asociado automáticamente',
                datosActualizados: validationResult.updateData
              });
            } catch (error) {
              console.log('❌ Error en validaciones para documento:', documento.id, error.message);
              resultados.push({
                documentoId: documento.id,
                estado: 'error_validacion',
                mensaje: `Error de validación: ${error.message}`
              });
            }
          } else {
            console.log('Coincidencias ambiguas, no se puede asociar automáticamente');
            resultados.push({
              documentoId: documento.id,
              estado: 'ambiguo',
              mensaje: 'Múltiples coincidencias ambiguas'
            });
          }
        } else {
          console.log('No se encontraron coincidencias para documento:', documento.id);
          resultados.push({
            documentoId: documento.id,
            estado: 'sin_coincidencia',
            mensaje: 'No se encontró coincidencia automática'
          });
        }

      } catch (error) {
        console.error('Error procesando documento', documento.id, ':', error);
        resultados.push({
          documentoId: documento.id,
          estado: 'error',
          mensaje: `Error: ${error.message}`
        });
      }
    }

    const totalProcesados = resultados.length;
    const totalAsociados = resultados.filter(r => r.estado === 'asociado').length;
    const totalSinCoincidencia = resultados.filter(r => r.estado === 'sin_coincidencia').length;
    const totalErrores = resultados.filter(r => r.estado === 'error').length;
    const totalSinDatos = resultados.filter(r => r.estado === 'sin_datos').length;

    res.json({
      success: true,
      resumen: {
        totalProcesados,
        totalAsociados,
        totalSinCoincidencia,
        totalErrores,
        totalSinDatos
      },
      resultados
    });

  } catch (error) {
    console.error('Error en asociación automática:', error);
    // Preservar el mensaje específico del error si está disponible
    const errorMessage = error.message || 'Error interno del servidor';
    res.status(500).json({ error: errorMessage });
  }
  */
});

// PUT /api/documentos/:id/observaciones - Actualizar observaciones del documento
router.put('/:id/observaciones', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    const userId = req.user.id;

    // Verificar que el documento pertenece al usuario
    const documento = await prisma.documentos_procesados.findFirst({
      where: { 
        id,
        usuarioId: userId 
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Actualizar las observaciones
    await prisma.documentos_procesados.update({
      where: { id },
      data: {
        observaciones,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      mensaje: 'Observaciones actualizadas correctamente'
    });

  } catch (error) {
    console.error('Error actualizando observaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/documentos/:id/desasociar - Desasociar documento de resumen de tarjeta
router.post('/:id/desasociar', authWithTenant, async (req, res) => {
  // FUNCIONALIDAD DESHABILITADA: No existe tabla documentos_asociados
  return res.status(501).json({
    success: false,
    error: 'Desasociación no disponible - funcionalidad deshabilitada'
  });

  /* CÓDIGO COMENTADO - REQUIERE TABLA documentos_asociados QUE NO EXISTE
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que el documento pertenece al usuario
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        usuarioId: userId
      },
      include: {
        documentos_asociados: {
          include: {
            resumen_tarjeta: {
              select: {
                id: true,
                numeroCupon: true
              }
            }
          }
        }
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!documento.documentos_asociados || documento.documentos_asociados.length === 0) {
      return res.status(400).json({ error: 'El documento no está asociado a ningún resumen de tarjeta' });
    }

    // Eliminar todas las asociaciones del documento
    await prisma.documentos_asociados.deleteMany({
      where: {
        documentoProcesadoId: id
      }
    });

    res.json({
      success: true,
      mensaje: 'Documento desasociado correctamente',
      asociacionesEliminadas: documento.documentos_asociados.length
    });

  } catch (error) {
    console.error('Error desasociando documento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
  */
});

// PUT /api/documentos/:id/datos-extraidos - Actualizar datos extraídos del documento
router.put('/:id/datos-extraidos', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fechaExtraida, 
      importeExtraido, 
      cuitExtraido, 
      numeroComprobanteExtraido,
      razonSocialExtraida,
      caeExtraido,
      tipoComprobanteExtraido,
      netoGravadoExtraido,
      exentoExtraido,
      impuestosExtraido,
      descuentoGlobalExtraido,
      descuentoGlobalTipo,
      monedaExtraida
    } = req.body;
    const userId = req.user.id;

    // Verificar que el documento pertenece al usuario
    const documento = await prisma.documentos_procesados.findFirst({
      where: { 
        id,
        usuarioId: userId 
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Preparar datos para actualizar
    const updateData = {};

    if (fechaExtraida !== undefined) {
      updateData.fechaExtraida = fechaExtraida ? (() => {
        // Si ya viene en formato ISO (yyyy-mm-dd), usarlo directamente
        if (typeof fechaExtraida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaExtraida)) {
          return new Date(fechaExtraida + 'T00:00:00.000Z');
        }
        // Si no, intentar convertir
        const fecha = new Date(fechaExtraida);
        return isNaN(fecha.getTime()) ? null : fecha;
      })() : null;
    }

    if (importeExtraido !== undefined) {
      updateData.importeExtraido = importeExtraido || null;
    }

    if (cuitExtraido !== undefined) {
      updateData.cuitExtraido = cuitExtraido || null;
    }

    if (numeroComprobanteExtraido !== undefined) {
      updateData.numeroComprobanteExtraido = numeroComprobanteExtraido || null;
    }

    if (razonSocialExtraida !== undefined) {
      updateData.razonSocialExtraida = razonSocialExtraida || null;
    }

    if (caeExtraido !== undefined) {
      updateData.caeExtraido = caeExtraido || null;
    }

    if (tipoComprobanteExtraido !== undefined) {
      updateData.tipoComprobanteExtraido = tipoComprobanteExtraido || null;
    }

    if (netoGravadoExtraido !== undefined) {
      updateData.netoGravadoExtraido = netoGravadoExtraido || null;
    }

    if (exentoExtraido !== undefined) {
      updateData.exentoExtraido = exentoExtraido || null;
    }

    if (impuestosExtraido !== undefined) {
      updateData.impuestosExtraido = impuestosExtraido || null;
    }

    if (descuentoGlobalExtraido !== undefined) {
      updateData.descuentoGlobalExtraido = descuentoGlobalExtraido ? parseFloat(descuentoGlobalExtraido) : null;
    }

    if (descuentoGlobalTipo !== undefined) {
      updateData.descuentoGlobalTipo = descuentoGlobalTipo || null;
    }

    if (monedaExtraida !== undefined) {
      updateData.monedaExtraida = monedaExtraida || 'ARS'; // Default to ARS for Argentina
    }

    // Actualizar el documento
    await prisma.documentos_procesados.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      mensaje: 'Datos extraídos actualizados correctamente'
    });

  } catch (error) {
    console.error('Error actualizando datos extraídos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/documentos/:id - Eliminar documento
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('Intentando eliminar documento:', { id, userId });

    // Buscar documento
    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        usuarioId: userId
      }
    });

    if (!documento) {
      console.log('Documento no encontrado para eliminar:', { id, userId });
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Eliminar en una transacción (Prisma automáticamente elimina líneas e impuestos por CASCADE)
    await prisma.$transaction(async (tx) => {
      await tx.documentos_procesados.delete({
        where: { id }
      });
      console.log('✅ [ELIMINACIÓN] Documento eliminado de la base de datos');
    });

    // Eliminar archivo físico después de la transacción exitosa
    if (documento.rutaArchivo && fs.existsSync(documento.rutaArchivo)) {
      fs.unlinkSync(documento.rutaArchivo);
      console.log('Archivo físico eliminado:', documento.rutaArchivo);
    }

    res.json({
      success: true,
      mensaje: 'Documento eliminado correctamente'
    });

  } catch (error) {
    console.error('Error eliminando documento:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función para eliminar completamente un documento del sistema
async function eliminarDocumentoCompletamente(documentoId) {
  try {
    console.log('🗑️ Eliminando documento completamente:', documentoId);

    // Obtener información del documento antes de eliminarlo
    const documento = await prisma.documentos_procesados.findUnique({
      where: { id: documentoId },
      select: { rutaArchivo: true, nombreArchivo: true }
    });

    if (!documento) {
      console.log('Documento ya no existe para eliminar:', documentoId);
      return documento;
    }

    // Eliminar archivo físico si existe
    if (documento.rutaArchivo) {
      const fs = require('fs');
      try {
        if (fs.existsSync(documento.rutaArchivo)) {
          fs.unlinkSync(documento.rutaArchivo);
          console.log('📁 Archivo físico eliminado:', documento.rutaArchivo);
        }
      } catch (fsError) {
        console.error('Error eliminando archivo físico:', fsError);
      }
    }

    // Eliminar registro de la base de datos
    await prisma.documentos_procesados.delete({
      where: { id: documentoId }
    });

    console.log(`✅ Documento "${documento.nombreArchivo}" eliminado completamente del sistema`);
    return documento;
  } catch (error) {
    console.error('Error eliminando documento completamente:', error);
    return null;
  }
}

// Función helper para crear el objeto de datos de actualización
function getUpdateDataFromDatosExtraidos(datosExtraidos, textoExtraido, metodoExtraccion) {
  return {
    estadoProcesamiento: 'completado',
    datosExtraidos: {
      texto: textoExtraido,
      ...datosExtraidos
    },
    fechaExtraida: datosExtraidos?.fecha ? (() => {
      try {
        if (typeof datosExtraidos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datosExtraidos.fecha)) {
          return new Date(datosExtraidos.fecha + 'T00:00:00.000Z');
        }
        const fecha = new Date(datosExtraidos.fecha);
        return isNaN(fecha.getTime()) ? null : fecha;
      } catch (e) {
        return null;
      }
    })() : null,
    importeExtraido: datosExtraidos?.importe || null,
    cuitExtraido: datosExtraidos?.cuit || null,
    numeroComprobanteExtraido: datosExtraidos?.numeroComprobante || null,
    caeExtraido: datosExtraidos?.cae || null,
    razonSocialExtraida: datosExtraidos?.razonSocial || null,
    netoGravadoExtraido: (() => {
      const total = datosExtraidos?.importe;
      const impuestos = datosExtraidos?.impuestos;
      const netoGravado = datosExtraidos?.netoGravado;
      const tipoComprobante = datosExtraidos?.tipoComprobante;

      // Si NO hay impuestos detectados y hay total, netoGravado = total
      if ((!impuestos || impuestos === 0) && total && total > 0) {
        console.log('💡 Sin impuestos detectados - netoGravado = total:', total);
        return total;
      }

      // Si hay impuestos, calcular: netoGravado = total - impuestos
      if (impuestos && impuestos > 0 && total && total > 0) {
        const calculado = total - impuestos;
        console.log('💡 Con impuestos - netoGravado = total - impuestos:', calculado);
        return calculado;
      }

      // Fallback: usar netoGravado extraído si existe
      if (netoGravado && netoGravado > 0) {
        return netoGravado;
      }

      return null;
    })(),
    exentoExtraido: (() => {
      const total = datosExtraidos?.importe;
      const gravado = datosExtraidos?.netoGravado;
      const impuestos = datosExtraidos?.impuestos;
      const exento = datosExtraidos?.exento;
      const tipoComprobante = datosExtraidos?.tipoComprobante;

      console.log('🔍 [ROUTES - SEGUNDA INSTANCIA] Calculando exento:', { total, gravado, impuestos, exento, tipoComprobante });

      // SIEMPRE usar la fórmula correcta: EXENTO = TOTAL - GRAVADO - IMPUESTOS
      if (total && total > 0) {
        const totalNum = parseFloat(total) || 0;
        const gravadoNum = parseFloat(gravado) || 0;
        const impuestosNum = parseFloat(impuestos) || 0;

        const exentoCalculado = Math.max(0, totalNum - gravadoNum - impuestosNum);

        console.log('🧮 [ROUTES - SEGUNDA INSTANCIA] Cálculo:', {
          total: totalNum,
          gravado: gravadoNum,
          impuestos: impuestosNum,
          exentoCalculado,
          formula: `${totalNum} - ${gravadoNum} - ${impuestosNum} = ${exentoCalculado}`
        });

        if (tipoComprobante && (tipoComprobante.includes('FACTURA A') || tipoComprobante.includes('TICKET A'))) {
          return exentoCalculado;
        }
        return 0; // Para facturas B/C
      }
      return null;
    })(),
    impuestosExtraido: (() => {
      let impuestos = datosExtraidos?.impuestos;
      const tipoComprobante = datosExtraidos?.tipoComprobante;

      // Si impuestos es un objeto, convertirlo a suma total
      if (impuestos && typeof impuestos === 'object') {
        const suma = (impuestos.iva21 || 0) +
                     (impuestos.iva105 || 0) +
                     (impuestos.percepciones || 0) +
                     (impuestos.retenciones || 0);
        impuestos = suma;
      }

      if (tipoComprobante && !(tipoComprobante.includes('FACTURA A') || tipoComprobante.includes('TICKET A'))) {
        return 0;
      }
      return impuestos || 0;
    })(),
    cuponExtraido: datosExtraidos?.cupon || null,
    tipoComprobanteExtraido: datosExtraidos?.tipoComprobante || null,
    modeloIA: metodoExtraccion,
    observaciones: (!datosExtraidos?.fecha && !datosExtraidos?.importe && !datosExtraidos?.cuit)
      ? 'Documento procesado pero con datos limitados extraídos'
      : null,
    updatedAt: new Date()
  };
}

// Función para crear o buscar rendición de efectivo usando transacción de Prisma
async function crearOBuscarRendicionEfectivoEnTransaccion(tx, documento, datosExtraidos) {
  console.log('📋 Procesando rendición de efectivo EN TRANSACCIÓN para documento:', documento.id);

  const cajaId = documento.cajaId;
  const tenantId = documento.tenantId;
  const userId = documento.usuarioId;

  // Buscar si existe una rendición en estado PENDIENTE para esta caja
  let rendicionCabecera = await tx.rendicion_tarjeta_cabecera.findFirst({
    where: {
      cajaId: cajaId,
      estadoCodigo: 'PENDIENTE',
      tenantId: tenantId
    }
  });

  // Si no existe, crear una nueva rendición
  if (!rendicionCabecera) {
    // Generar número secuencial global
    const ultimaRendicion = await tx.rendicion_tarjeta_cabecera.findFirst({
      where: {
        loteId: {
          contains: cajaId + '_'
        }
      },
      orderBy: {
        loteId: 'desc'
      }
    });

    let secuencial = 1;
    if (ultimaRendicion && ultimaRendicion.loteId) {
      const partes = ultimaRendicion.loteId.split('_');
      if (partes.length > 1) {
        secuencial = parseInt(partes[1]) + 1;
      }
    }

    const loteId = `${cajaId}_${String(secuencial).padStart(5, '0')}`;
    const periodo = new Date().toISOString().substring(0, 7).replace('-', ''); // AAAAMM

    console.log('Creando nueva rendición de efectivo en transacción:', { loteId, periodo, cajaId });

    rendicionCabecera = await tx.rendicion_tarjeta_cabecera.create({
      data: {
        id: crypto.randomUUID(),
        loteId: loteId,
        numeroTarjeta: null, // NULL para efectivo
        periodo: periodo,
        estadoCodigo: 'PENDIENTE',
        cajaId: cajaId,
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Rendición de efectivo creada en transacción:', rendicionCabecera.id);
  }

  // Crear el item de rendición con los datos del comprobante
  const rendicionItem = await tx.rendicion_tarjeta_items.create({
    data: {
      id: crypto.randomUUID(),
      rendicionCabeceraId: rendicionCabecera.id,
      resumenTarjetaId: null, // NULL para efectivo
      tipoComprobante: datosExtraidos?.tipoComprobante || documento.tipoComprobanteExtraido,
      numeroComprobante: datosExtraidos?.numeroComprobante || documento.numeroComprobanteExtraido,
      fechaComprobante: documento.fechaExtraida,
      cuitProveedor: datosExtraidos?.cuit || documento.cuitExtraido,
      netoGravado: documento.netoGravadoExtraido,
      exento: documento.exentoExtraido,
      importeImpuestos: documento.impuestosExtraido,
      importeTotal: documento.importeExtraido,
      cargaManual: false,
      rechazo: false,
      tenantId: tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('Item de rendición creado en transacción:', rendicionItem.id);

  // Crear la asociación entre el documento y el item de rendición
  await tx.documentos_asociados.create({
    data: {
      id: crypto.randomUUID(),
      documentoProcesadoId: documento.id,
      resumenTarjetaId: null, // NULL para efectivo
      usuarioAsociacion: userId,
      rendicionItemId: rendicionItem.id, // Asociar directamente con el item
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('Asociación documento-rendición creada en transacción');
  return { rendicionCabecera, rendicionItem };
}

// Función para crear o buscar rendición de efectivo
async function crearOBuscarRendicionEfectivo(documento, datosExtraidos) {
  try {
    console.log('📋 Procesando rendición de efectivo para documento:', documento.id);

    const cajaId = documento.cajaId;
    const tenantId = documento.tenantId;
    const userId = documento.usuarioId;

    // Buscar si existe una rendición en estado PENDIENTE para esta caja
    let rendicionCabecera = await prisma.rendicion_tarjeta_cabecera.findFirst({
      where: {
        cajaId: cajaId,
        estadoCodigo: 'PENDIENTE',
        tenantId: tenantId
      }
    });

    // Si no existe, crear una nueva rendición
    if (!rendicionCabecera) {
      // Generar número secuencial global
      const ultimaRendicion = await prisma.rendicion_tarjeta_cabecera.findFirst({
        where: {
          loteId: {
            contains: cajaId + '_'
          }
        },
        orderBy: {
          loteId: 'desc'
        }
      });

      let secuencial = 1;
      if (ultimaRendicion && ultimaRendicion.loteId) {
        const partes = ultimaRendicion.loteId.split('_');
        if (partes.length > 1) {
          secuencial = parseInt(partes[1]) + 1;
        }
      }

      const loteId = `${cajaId}_${String(secuencial).padStart(5, '0')}`;
      const periodo = new Date().toISOString().substring(0, 7).replace('-', ''); // AAAAMM

      console.log('Creando nueva rendición de efectivo:', { loteId, periodo, cajaId });

      rendicionCabecera = await prisma.rendicion_tarjeta_cabecera.create({
        data: {
          id: crypto.randomUUID(),
          loteId: loteId,
          numeroTarjeta: null, // NULL para efectivo
          periodo: periodo,
          estadoCodigo: 'PENDIENTE',
          cajaId: cajaId,
          tenantId: tenantId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('Rendición de efectivo creada:', rendicionCabecera.id);
    }

    // Crear el item de rendición con los datos del comprobante
    const rendicionItem = await prisma.rendicion_tarjeta_items.create({
      data: {
        id: crypto.randomUUID(),
        rendicionCabeceraId: rendicionCabecera.id,
        resumenTarjetaId: null, // NULL para efectivo
        tipoComprobante: datosExtraidos?.tipoComprobante || documento.tipoComprobanteExtraido,
        numeroComprobante: datosExtraidos?.numeroComprobante || documento.numeroComprobanteExtraido,
        fechaComprobante: documento.fechaExtraida,
        cuitProveedor: datosExtraidos?.cuit || documento.cuitExtraido,
        netoGravado: documento.netoGravadoExtraido,
        exento: documento.exentoExtraido,
        importeImpuestos: documento.impuestosExtraido,
        importeTotal: documento.importeExtraido,
        cargaManual: false,
        rechazo: false,
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Item de rendición creado:', rendicionItem.id);

    // Crear la asociación entre el documento y el item de rendición
    await prisma.documentos_asociados.create({
      data: {
        id: crypto.randomUUID(),
        documentoProcesadoId: documento.id,
        resumenTarjetaId: null, // NULL para efectivo
        usuarioAsociacion: userId,
        rendicionItemId: rendicionItem.id, // Asociar directamente con el item
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Asociación documento-rendición creada');

    return { rendicionCabecera, rendicionItem };

  } catch (error) {
    console.error('Error creando/buscando rendición de efectivo:', error);
    // No lanzamos el error para no interrumpir el procesamiento del documento
    return null;
  }
}

// Función para procesar documento de forma asíncrona
async function processDocumentAsync(documentoId, filePath, tipoArchivo) {
  try {
    let processingResult;

    // Agregar timeout de 120 segundos (2 minutos) para todo el procesamiento
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: El procesamiento del documento excedió el tiempo límite de 2 minutos')), 120000);
    });

    const processingPromise = async () => {
      if (tipoArchivo === 'pdf') {
        return await documentProcessor.processPDF(filePath);
      } else {
        return await documentProcessor.processImage(filePath);
      }
    };

    processingResult = await Promise.race([processingPromise(), timeoutPromise]);

    if (!processingResult.success) {
      console.error('❌ Error procesando archivo:', processingResult.error);

      await eliminarDocumentoCompletamente(documentoId);
      throw new Error(`Error procesando el archivo: ${processingResult.error}. Verifica que el archivo no esté corrupto y sea un documento válido.`);
    }

    // Determinar método de extracción (interno, no visible al usuario)
    let metodoExtraccion = 'RegEx';
    if (process.env.ENABLE_AI_EXTRACTION === 'true') {
      if (process.env.OPENAI_API_KEY) {
        metodoExtraccion = 'OpenAI';
      } else if (process.env.ANTHROPIC_API_KEY) {
        metodoExtraccion = 'Anthropic';
      } else if (process.env.GEMINI_API_KEY) {
        metodoExtraccion = 'Gemini';
      } else if (process.env.OLLAMA_ENABLED === 'true') {
        metodoExtraccion = 'Ollama';
      }
    }

    // Obtener documento con tenant y usuario
    const documento = await prisma.documentos_procesados.findUnique({
      where: { id: documentoId },
      select: {
        tenantId: true,
        usuarioId: true
      }
    });

    // Extraer datos usando el ORQUESTADOR (sistema de pipeline)
    console.log('🚀 Usando DocumentExtractionOrchestrator...');
    const resultadoOrquestador = await orchestrator.extractData(
      processingResult.text,
      documento.tenantId,
      documento.usuarioId
    );

    const datosExtraidos = resultadoOrquestador.datos;
    const metodoUsado = resultadoOrquestador.metodo; // 'PIPELINE' o 'SIMPLE'
    const promptUtilizado = resultadoOrquestador.promptUtilizado;

    // Actualizar con el texto procesado y método usado
    await prisma.documentos_procesados.update({
      where: { id: documentoId },
      data: {
        datosExtraidos: {
          texto: processingResult.text,
          metodo: metodoUsado,
          prompt: promptUtilizado,
          clasificacion: resultadoOrquestador.clasificacion || null
        },
        modeloIA: promptUtilizado // Guardar prompt usado
      }
    });

    // La función extractData ahora nunca devuelve null, siempre devuelve un objeto
    console.log('Datos extraídos:', {
      fecha: datosExtraidos?.fecha ? 'SÍ' : 'NO',
      importe: datosExtraidos?.importe ? 'SÍ' : 'NO',
      cuit: datosExtraidos?.cuit ? 'SÍ' : 'NO',
      numeroComprobante: datosExtraidos?.numeroComprobante ? 'SÍ' : 'NO'
    });

    // Validar si se extrajeron datos mínimos suficientes para considerar exitoso
    const datosMinimos = ['fecha', 'importe', 'cuit'].filter(campo => datosExtraidos[campo]);
    const tieneTextoUtil = processingResult.text && processingResult.text.length > 50;

    // Criterio más estricto: necesitamos al menos 2 datos críticos O un texto muy largo
    const criterioExitoso = datosMinimos.length >= 2 || (datosMinimos.length >= 1 && tieneTextoUtil && processingResult.text.length > 200);

    if (!criterioExitoso) {
      console.error(`Extracción fallida - Datos insuficientes. Campos extraídos: ${datosMinimos.length}, Texto útil: ${tieneTextoUtil}, Longitud texto: ${processingResult.text?.length || 0}`);

      await eliminarDocumentoCompletamente(documentoId);
      throw new Error('No se pudieron extraer datos suficientes del documento. Verifica que el archivo sea legible y contenga información de un comprobante fiscal válido (fecha, importe, CUIT).');
    }

    console.log(`Datos extraídos suficientes: ${datosMinimos.length}/3 campos mínimos, texto: ${tieneTextoUtil ? 'SÍ' : 'NO'}`);

    // Validación de duplicados por contenido (CUIT, tipo y número de comprobante)
    if (datosExtraidos.cuit && datosExtraidos.tipoComprobante && datosExtraidos.numeroComprobante) {
      const documentoContenidoDuplicado = await prisma.documentos_procesados.findFirst({
        where: {
          usuarioId: (await prisma.documentos_procesados.findUnique({ where: { id: documentoId }, select: { usuarioId: true } }))?.usuarioId,
          cuitExtraido: datosExtraidos.cuit,
          tipoComprobanteExtraido: datosExtraidos.tipoComprobante,
          numeroComprobanteExtraido: datosExtraidos.numeroComprobante,
          estadoProcesamiento: 'completado',
          NOT: { id: documentoId } // Excluir el documento actual
        }
      });

      if (documentoContenidoDuplicado) {
        console.error('❌ Documento duplicado encontrado por contenido:', {
          cuit: datosExtraidos.cuit,
          tipo: datosExtraidos.tipoComprobante,
          numero: datosExtraidos.numeroComprobante
        });

        await eliminarDocumentoCompletamente(documentoId);
        throw new Error(`Comprobante duplicado: Ya existe un comprobante con CUIT ${datosExtraidos.cuit}, tipo ${datosExtraidos.tipoComprobante} y número ${datosExtraidos.numeroComprobante}.`);
      }
    }

    // Actualizar documento con los datos extraídos (permitir campos vacíos)
    await prisma.documentos_procesados.update({
      where: { id: documentoId },
      data: {
        estadoProcesamiento: 'completado',
        datosExtraidos: {
          texto: processingResult.text,
          ...datosExtraidos
        },
        fechaExtraida: datosExtraidos?.fecha ? (() => {
          try {
            // Si ya viene en formato ISO (yyyy-mm-dd), usarlo directamente
            if (typeof datosExtraidos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datosExtraidos.fecha)) {
              return new Date(datosExtraidos.fecha + 'T00:00:00.000Z');
            }
            // Si no, intentar convertir
            const fecha = new Date(datosExtraidos.fecha);
            return isNaN(fecha.getTime()) ? null : fecha;
          } catch (e) {
            return null;
          }
        })() : null,
        importeExtraido: datosExtraidos?.importe || null,
        cuitExtraido: datosExtraidos?.cuit || null,
        numeroComprobanteExtraido: datosExtraidos?.numeroComprobante || null,
        caeExtraido: datosExtraidos?.cae || null,
        razonSocialExtraida: datosExtraidos?.razonSocial || null,
        // EXTRAER neto gravado directamente (NO calcular)
        netoGravadoExtraido: datosExtraidos?.netoGravado ? parseFloat(datosExtraidos.netoGravado) : null,
        exentoExtraido: (() => {
          const total = datosExtraidos?.importe;
          const gravado = datosExtraidos?.netoGravado;
          const impuestos = datosExtraidos?.impuestos;
          const exento = datosExtraidos?.exento;
          const tipoComprobante = datosExtraidos?.tipoComprobante;

          console.log('Calculando exento:', { total, gravado, impuestos, exento, tipoComprobante });

          // SIEMPRE usar la fórmula correcta: EXENTO = TOTAL - GRAVADO - IMPUESTOS
          if (total && total > 0) {
            const totalNum = parseFloat(total) || 0;
            const gravadoNum = parseFloat(gravado) || 0;
            const impuestosNum = parseFloat(impuestos) || 0;

            const exentoCalculado = Math.max(0, totalNum - gravadoNum - impuestosNum);

            console.log('🧮 [CÁLCULO EXENTO EN ROUTES]:', {
              total: totalNum,
              gravado: gravadoNum,
              impuestos: impuestosNum,
              exentoCalculado,
              formula: `${totalNum} - ${gravadoNum} - ${impuestosNum} = ${exentoCalculado}`
            });

            // Solo aplicar lógica de exento para FACTURA A o TICKET A
            if (tipoComprobante && (tipoComprobante.includes('FACTURA A') || tipoComprobante.includes('TICKET A'))) {
              console.log(`Comprobante tipo A: exento calculado = ${exentoCalculado}`);
              return exentoCalculado;
            } else {
              // Para FACTURA B/C, TICKET B/C y otros: exento = 0 (todo va a gravado)
              console.log(`Comprobante tipo B/C/otro: exento = 0 (todo va a gravado)`);
              return 0;
            }
          }

          console.log('No se puede calcular exento - falta total');
          return null;
        })(),
        impuestosExtraido: (() => {
          let impuestos = datosExtraidos?.impuestos;
          const tipoComprobante = datosExtraidos?.tipoComprobante;

          // Si impuestos es un objeto, convertirlo a suma total
          if (impuestos && typeof impuestos === 'object') {
            console.log('⚠️ impuestos viene como objeto, calculando suma total...');
            const suma = (impuestos.iva21 || 0) +
                         (impuestos.iva105 || 0) +
                         (impuestos.percepciones || 0) +
                         (impuestos.retenciones || 0);
            console.log(`📊 Suma de impuestos: ${suma}`);
            impuestos = suma;
          }

          // Para FACTURA B/C, TICKET B/C y otros: impuestos = 0
          if (tipoComprobante && !(tipoComprobante.includes('FACTURA A') || tipoComprobante.includes('TICKET A'))) {
            console.log(`Comprobante tipo B/C/otro: impuestos = 0`);
            return 0;
          }

          // Para FACTURA A o TICKET A: usar impuestos extraídos
          console.log(`Comprobante tipo A: impuestos = ${impuestos || 0}`);
          return impuestos || 0;
        })(),
        descuentoGlobalExtraido: datosExtraidos?.descuentoGlobal ? parseFloat(datosExtraidos.descuentoGlobal) : null,
        descuentoGlobalTipo: datosExtraidos?.descuentoGlobalTipo || null,
        monedaExtraida: datosExtraidos?.moneda || 'ARS', // Default to ARS for Argentina
        cuponExtraido: datosExtraidos?.cupon || null,
        tipoComprobanteExtraido: datosExtraidos?.tipoComprobante || null,
        modeloIA: metodoExtraccion, // Guardar el modelo/método usado para la extracción
        // Agregar observación si no se extrajo información crítica
        observaciones: (!datosExtraidos?.fecha && !datosExtraidos?.importe && !datosExtraidos?.cuit)
          ? 'Documento procesado pero con datos limitados extraídos'
          : null,
        updatedAt: new Date()
      }
    });

    // ✨ GUARDAR LINE ITEMS E IMPUESTOS DETALLADOS
    // Usar el documento ya obtenido anteriormente (línea 2167)

    if (documento) {
      // Guardar line items si existen
      const lineItems = datosExtraidos.lineItems || [];
      if (lineItems.length > 0) {
        console.log(`📋 Guardando ${lineItems.length} line items...`);

        // Validar suma de line items vs total
        const sumaLineItems = lineItems.reduce((sum, item) =>
          sum + parseFloat(item.totalLinea || item.subtotal || 0), 0
        );
        const totalDocumento = parseFloat(datosExtraidos.importe || 0);
        const diferencia = Math.abs(sumaLineItems - totalDocumento);

        if (diferencia > 1) { // Diferencia > $1
          console.warn(`⚠️ Suma de items ($${sumaLineItems.toFixed(2)}) != Total ($${totalDocumento.toFixed(2)})`);
        }

        // Insertar line items
        await prisma.documento_lineas.createMany({
          data: lineItems.map((item, idx) => ({
            id: uuidv4(),
            documentoId: documentoId,
            numero: item.numero || (idx + 1),
            descripcion: item.descripcion || 'Sin descripción',
            codigoProducto: item.codigoProducto || null,
            cantidad: parseFloat(item.cantidad) || 1,
            unidad: item.unidad || 'un',
            precioUnitario: parseFloat(item.precioUnitario) || 0,
            subtotal: parseFloat(item.subtotal) || 0,
            alicuotaIva: item.alicuotaIva ? parseFloat(item.alicuotaIva) : null,
            importeIva: item.importeIva ? parseFloat(item.importeIva) : null,
            totalLinea: parseFloat(item.totalLinea || item.subtotal) || 0,
            descuentoTipo: item.descuentoTipo || null,
            descuentoValor: item.descuentoValor ? parseFloat(item.descuentoValor) : null,
            descuentoImporte: item.descuentoImporte ? parseFloat(item.descuentoImporte) : null,
            tenantId: documento.tenantId,
            createdAt: new Date()
          }))
        });

        console.log(`✅ ${lineItems.length} line items guardados correctamente`);
      } else {
        console.log(`ℹ️ No se encontraron line items (puede ser ticket simple)`);
      }

      // Guardar impuestos detallados si existen
      const impuestosDetalle = datosExtraidos.impuestosDetalle || [];
      if (impuestosDetalle.length > 0) {
        console.log(`💰 Guardando ${impuestosDetalle.length} impuestos detallados...`);

        // Validar suma de impuestos vs campo impuestos
        const sumaImpuestos = impuestosDetalle.reduce((sum, imp) =>
          sum + parseFloat(imp.importe || 0), 0
        );
        const totalImpuestos = parseFloat(datosExtraidos.impuestos || 0);
        const diferenciaImp = Math.abs(sumaImpuestos - totalImpuestos);

        if (diferenciaImp > 1) { // Diferencia > $1
          console.warn(`⚠️ Suma de impuestos ($${sumaImpuestos.toFixed(2)}) != Total impuestos ($${totalImpuestos.toFixed(2)})`);
        }

        // Insertar impuestos
        await prisma.documento_impuestos.createMany({
          data: impuestosDetalle.map(imp => ({
            id: uuidv4(),
            documentoId: documentoId,
            tipo: imp.tipo || 'IVA',
            descripcion: imp.descripcion || 'Sin descripción',
            alicuota: imp.alicuota ? parseFloat(imp.alicuota) : null,
            baseImponible: imp.baseImponible ? parseFloat(imp.baseImponible) : null,
            importe: parseFloat(imp.importe) || 0,
            tenantId: documento.tenantId,
            createdAt: new Date()
          }))
        });

        console.log(`✅ ${impuestosDetalle.length} impuestos detallados guardados correctamente`);
      } else {
        console.log(`ℹ️ No se encontraron impuestos detallados`);
      }
    }

    // Documento procesado correctamente
    console.log('✅ Documento procesado correctamente');

  } catch (error) {
    console.error('❌ Error procesando documento:', error.message);

    // NUEVA POLÍTICA: Cualquier error elimina completamente el documento
    // No quedan documentos con estado 'error' en el sistema
    console.error('🗑️ Eliminando documento completamente debido a error en procesamiento');

    try {
      const documentoEliminado = await eliminarDocumentoCompletamente(documentoId);
      console.log('✅ Documento eliminado completamente tras error en procesamiento');

      // Mostrar error específico al usuario
      console.error(`Error reportado al usuario: ${error.message}`);
    } catch (deleteError) {
      console.error('❌ Error eliminando documento tras falla:', deleteError);
    }

    // Re-lanzar el error para que llegue al usuario
    throw error;
  }
}

// POST /api/documentos/:id/asociar-manual - Asociar manualmente un documento con un item de rendición
router.post('/:id/asociar-manual', authWithTenant, async (req, res) => {
  // FUNCIONALIDAD DESHABILITADA: No existe tabla resumen_tarjeta ni documentos_asociados
  return res.status(501).json({
    success: false,
    error: 'Asociación manual no disponible - funcionalidad deshabilitada'
  });

  /* CÓDIGO COMENTADO - REQUIERE TABLAS resumen_tarjeta Y documentos_asociados QUE NO EXISTEN
  try {
    const { id } = req.params;
    const { rendicionItemId, resumenTarjetaId } = req.body;
    const userId = req.user.id;

    // Verificar que el documento pertenece al usuario
    const documento = await prisma.documentos_procesados.findFirst({
      where: { 
        id,
        usuarioId: userId 
      }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Verificar que el item de rendición existe y obtener datos del resumen de tarjeta
    const rendicion_tarjeta_items = await prisma.rendicionTarjetaItem.findFirst({
      where: {
        id: rendicionItemId,
        resumenTarjetaId: resumenTarjetaId
      },
      include: {
        rendicionCabecera: true,
        resumen_tarjeta: true
      }
    });

    if (!rendicion_tarjeta_items) {
      return res.status(404).json({ error: 'Item de rendición no encontrado' });
    }

    // Verificar si ya existe una asociación entre este documento y este resumen de tarjeta
    const asociacionExistente = await prisma.documentos_asociados.findFirst({
      where: {
        documentoProcesadoId: id,
        resumenTarjetaId: resumenTarjetaId
      }
    });

    if (asociacionExistente) {
      return res.status(400).json({ error: 'Este documento ya está asociado con este item de rendición' });
    }

    // VALIDACIONES Y COMPLETADO DE CAMPOS
    const resumen = rendicion_tarjeta_items.resumen_tarjeta;
    let validationResult;
    
    try {
      validationResult = await validateAndUpdateAssociation(documento, resumen, userId);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    // Crear la asociación usando upsert para manejar conflictos
    const asociacion = await prisma.documentos_asociados.upsert({
      where: {
        documentoProcesadoId_resumenTarjetaId: {
          documentoProcesadoId: id,
          resumenTarjetaId: resumenTarjetaId
        }
      },
      update: {
        usuarioAsociacion: userId
      },
      create: {
        documentoProcesadoId: id,
        resumenTarjetaId: resumenTarjetaId,
        usuarioAsociacion: userId
      },
      include: {
        resumen_tarjeta: {
          select: {
            numeroCupon: true,
            fechaTransaccion: true,
            importeTransaccion: true,
            descripcionCupon: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Documento asociado exitosamente',
      asociacion,
      datosActualizados: validationResult.updateData,
      rendicionItemId: validationResult.rendicionItemId
    });

  } catch (error) {
    console.error('Error en asociación manual:', error);
    // Preservar el mensaje específico del error si está disponible
    const errorMessage = error.message || 'Error al asociar documento';
    res.status(500).json({ error: errorMessage });
  }
  */
});

// GET /api/documentos/sin-asociar/:userId - Obtener documentos sin asociar de un usuario
router.get('/sin-asociar/:userId', authWithTenant, async (req, res) => {
  // FUNCIONALIDAD DESHABILITADA: No existe tabla documentos_asociados
  return res.status(501).json({
    success: false,
    error: 'Consulta de documentos sin asociar no disponible - funcionalidad deshabilitada'
  });

  /* CÓDIGO COMENTADO - REQUIERE TABLA documentos_asociados QUE NO EXISTE
  try {
    const { userId } = req.params;

    // Obtener documentos sin asociar del usuario específico
    const documentos = await prisma.documentos_procesados.findMany({
      where: req.filterByTenant({
        usuarioId: userId,
        documentos_asociados: {
          none: {}
        }
      }),
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limitar a 100 documentos recientes
    });

    res.json(documentos);

  } catch (error) {
    console.error('Error obteniendo documentos sin asociar:', error);
    res.status(500).json({ error: 'Error al obtener documentos sin asociar' });
  }
  */
});

// GET /api/documentos/caja/:cajaId - Obtener documentos de una caja específica
// Fixed cajaId type issue
router.get('/caja/:cajaId', authWithTenant, async (req, res) => {
  try {
    const userId = req.userId;
    const tenantId = req.tenantId;
    const { cajaId } = req.params;

    console.log('🔍 [GET /caja/:cajaId] Debug info:');
    console.log('🔍 [GET /caja/:cajaId] userId:', userId);
    console.log('🔍 [GET /caja/:cajaId] tenantId:', tenantId);
    console.log('🔍 [GET /caja/:cajaId] cajaId:', cajaId);

    // Verificar que el usuario tiene acceso a esta caja
    const userCaja = await prisma.user_cajas.findFirst({
      where: {
        userId,
        cajaId: String(cajaId),
        activo: true,
        caja: {
          tenantId,
          activo: true
        }
      }
    });

    console.log('🔍 [GET /caja/:cajaId] userCaja found:', !!userCaja);

    if (!userCaja) {
      console.log('🔍 [GET /caja/:cajaId] Access denied - no userCaja found');
      return res.status(403).json({ error: 'No tienes acceso a esta caja' });
    }

    // Los comprobantes de efectivo pertenecen a la caja únicamente
    // La seguridad ya está garantizada por la verificación de user_cajas arriba
    const filter = {
      tipo: "efectivo",
      cajaId: String(cajaId)
    };

    console.log('🔍 [GET /caja/:cajaId] Filter (solo tipo y cajaId):', filter);

    const documentos = await prisma.documentos_procesados.findMany({
      where: filter,
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('🔍 [GET /caja/:cajaId] Documents found:', documentos.length);
    console.log('🔍 [GET /caja/:cajaId] Document IDs:', documentos.map(d => d.id));
    console.log('🔍 [GET /caja/:cajaId] Document details:', documentos.map(d => ({
      id: d.id,
      nombreArchivo: d.nombreArchivo,
      importeExtraido: d.importeExtraido,
      tipoComprobanteExtraido: d.tipoComprobanteExtraido,
      estadoProcesamiento: d.estadoProcesamiento
    })));

    res.json({ documentos });

  } catch (error) {
    console.error('Error obteniendo documentos de caja:', error);
    res.status(500).json({ error: 'Error al obtener documentos de la caja' });
  }
});

// GET /api/documentos/metrics/caja/:cajaId - Obtener métricas de una caja específica
router.get('/metrics/caja/:cajaId', authWithTenant, async (req, res) => {
  try {
    const userId = req.userId;
    const tenantId = req.tenantId;
    const { cajaId } = req.params;

    // Verificar que el usuario tiene acceso a esta caja
    const userCaja = await prisma.user_cajas.findFirst({
      where: {
        userId,
        cajaId: String(cajaId),
        activo: true,
        caja: {
          tenantId,
          activo: true
        }
      }
    });

    if (!userCaja) {
      return res.status(403).json({ error: 'No tienes acceso a esta caja' });
    }

    // Los comprobantes de efectivo pertenecen a la caja únicamente
    // La seguridad ya está garantizada por la verificación de user_cajas arriba
    const documentos = await prisma.documentos_procesados.findMany({
      where: {
        tipo: "efectivo",
        cajaId: String(cajaId)
      }
    });

    const totalSubidos = documentos.length;
    const totalAsociados = documentos.filter(doc => doc.estadoProcesamiento === 'completado').length;
    const totalConError = documentos.filter(doc => doc.estadoProcesamiento === 'error').length;
    const totalPendientes = documentos.filter(doc => doc.estadoProcesamiento === 'procesando').length;

    const metrics = {
      subidos: totalSubidos,
      asociados: totalAsociados,
      pendientes: totalPendientes,
      conError: totalConError
    };

    res.json(metrics);

  } catch (error) {
    console.error('Error obteniendo métricas de caja:', error);
    res.status(500).json({ error: 'Error al obtener métricas de la caja' });
  }
});

// PUT /documentos/:id/observacion - Actualizar observación de un documento
router.put('/:id/observacion', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { observacion } = req.body;

    // Verificar que el documento existe y pertenece al tenant
    const whereClause = { id };
    if (req.tenantId) {
      whereClause.tenantId = req.tenantId;
    }

    const documento = await prisma.documentos_procesados.findFirst({
      where: whereClause
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Actualizar la observación
    const documentoActualizado = await prisma.documentos_procesados.update({
      where: { id },
      data: {
        observaciones: observacion || null,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Observación actualizada correctamente',
      documento: documentoActualizado
    });

  } catch (error) {
    console.error('Error actualizando observación:', error);
    res.status(500).json({ error: 'Error al actualizar la observación' });
  }
});

// GET /api/documentos/:id - Get document details
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Primero buscar por usuario directo
    let documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        usuarioId: userId
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellido: true
          }
        },
        caja: true
      }
    });

    // Si no se encuentra, buscar por acceso a caja (para comprobantes de efectivo)
    if (!documento) {
      documento = await prisma.documentos_procesados.findFirst({
        where: {
          id,
          caja: {
            user_cajas: {
              some: {
                userId: userId,
                activo: true
              }
            }
          }
        },
        include: {
          usuario: {
            select: {
              nombre: true,
              apellido: true
            }
          },
          caja: true
        }
      });
    }

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.json(documento);
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Error al obtener el documento' });
  }
});

// GET /api/documentos/download/:id - Download document
router.get('/download/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Primero buscar por usuario directo
    let documento = await prisma.documentos_procesados.findFirst({
      where: {
        id,
        usuarioId: userId
      },
      include: {
        caja: true
      }
    });

    // Si no se encuentra, buscar por acceso a caja (para comprobantes de efectivo)
    if (!documento) {
      documento = await prisma.documentos_procesados.findFirst({
        where: {
          id,
          caja: {
            user_cajas: {
              some: {
                userId: userId,
                activo: true
              }
            }
          }
        },
        include: {
          caja: true
        }
      });
    }

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!documento.rutaArchivo) {
      return res.status(404).json({ error: 'Archivo no disponible' });
    }

    // Check if file exists
    try {
      await fs.access(documento.rutaArchivo);
    } catch {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${documento.nombreArchivo}"`);

    // Stream file to response
    const fileStream = require('fs').createReadStream(documento.rutaArchivo);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Error al descargar el documento' });
  }
});

// POST /api/documentos/exportar - Marcar documentos como exportados
router.post('/exportar', authWithTenant, async (req, res) => {
  try {
    const { documentoIds } = req.body;
    const tenantId = req.tenantId;

    if (!documentoIds || !Array.isArray(documentoIds) || documentoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos un ID de documento'
      });
    }

    // Verificar que todos los documentos pertenecen al tenant
    const documentos = await prisma.documentos_procesados.findMany({
      where: {
        id: { in: documentoIds },
        tenantId: tenantId
      }
    });

    if (documentos.length !== documentoIds.length) {
      return res.status(404).json({
        success: false,
        error: 'Algunos documentos no fueron encontrados o no pertenecen a su organización'
      });
    }

    // Inicializar motor de reglas de negocio para transformaciones pre-exportación
    const rulesEngine = new BusinessRulesEngine();
    await rulesEngine.loadRules('TRANSFORMACION_DOCUMENTO', false, prisma);

    let documentosTransformados = 0;

    // Aplicar reglas de negocio a cada documento antes de exportar
    for (const documento of documentos) {
      try {
        // Aplicar reglas de transformación
        const ruleResult = await rulesEngine.applyRules(
          documento,
          {},
          {
            tipo: 'TRANSFORMACION_DOCUMENTO',
            contexto: 'PRE_EXPORT',
            logExecution: true
          }
        );

        // Si se aplicaron reglas y hay datos transformados, actualizar el documento
        if (ruleResult.rulesApplied > 0) {
          await prisma.documentos_procesados.update({
            where: { id: documento.id },
            data: {
              razonSocialExtraida: ruleResult.data.razonSocialExtraida,
              cuitExtraido: ruleResult.data.cuitExtraido,
              // Agregar otros campos que puedan ser transformados
            }
          });
          documentosTransformados++;
          console.log(`✅ Documento ${documento.id}: ${ruleResult.rulesApplied} regla(s) aplicada(s)`);
        }
      } catch (ruleError) {
        console.error(`Error aplicando reglas al documento ${documento.id}:`, ruleError);
        // Continuar con el siguiente documento aunque falle la regla
      }
    }

    // Marcar como exportados
    const resultado = await prisma.documentos_procesados.updateMany({
      where: {
        id: { in: documentoIds },
        tenantId: tenantId
      },
      data: {
        exportado: true,
        fechaExportacion: new Date()
      }
    });

    res.json({
      success: true,
      message: `${resultado.count} documento(s) marcado(s) como exportado(s)`,
      count: resultado.count,
      transformados: documentosTransformados
    });

  } catch (error) {
    console.error('Error marcando documentos como exportados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/documentos/aplicar-reglas - Aplicar reglas de completado a documentos pendientes
router.post('/aplicar-reglas', authWithTenant, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.tenantId;

    console.log('🔄 Iniciando aplicación de reglas de completado...');

    // Obtener documentos completados sin exportar del usuario
    const documentos = await prisma.documentos_procesados.findMany({
      where: {
        usuarioId: userId,
        tenantId: tenantId,
        estadoProcesamiento: 'completado',
        exportado: false
      },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    if (documentos.length === 0) {
      return res.json({
        success: true,
        message: 'No hay documentos pendientes para aplicar reglas',
        total: 0,
        procesados: 0,
        transformados: 0
      });
    }

    console.log(`📋 Encontrados ${documentos.length} documentos para procesar`);

    // Inicializar el motor de reglas y cargar reglas de TRANSFORMACION
    const rulesEngine = new BusinessRulesEngine(prisma);
    await rulesEngine.loadRules('TRANSFORMACION', true, prisma);

    if (rulesEngine.rules.length === 0) {
      console.log('⚠️ No hay reglas de transformación activas');
      return res.json({
        success: true,
        message: 'No hay reglas de transformación configuradas',
        total: documentos.length,
        procesados: 0,
        transformados: 0
      });
    }

    console.log(`📐 Cargadas ${rulesEngine.rules.length} reglas de transformación`);

    let documentosTransformados = 0;
    let documentosProcesados = 0;

    // Aplicar reglas de negocio a cada documento
    for (const documento of documentos) {
      try {
        documentosProcesados++;

        // Aplicar reglas de transformación/completado
        const ruleResult = await rulesEngine.applyRules(
          documento,
          {},
          {
            tipo: 'TRANSFORMACION',
            contexto: 'APLICACION_REGLAS',
            logExecution: false  // Deshabilitado por error de schema en reglas_ejecuciones
          }
        );

        // Si se aplicaron reglas y hay datos transformados, actualizar el documento
        if (ruleResult.rulesApplied > 0) {
          // Preparar datos para actualizar y detectar cambios
          const updateData = {
            razonSocialExtraida: ruleResult.data.razonSocialExtraida || documento.razonSocialExtraida,
            cuitExtraido: ruleResult.data.cuitExtraido || documento.cuitExtraido,
            numeroComprobanteExtraido: ruleResult.data.numeroComprobanteExtraido || documento.numeroComprobanteExtraido,
            fechaExtraida: ruleResult.data.fechaExtraida || documento.fechaExtraida,
            importeExtraido: ruleResult.data.importeExtraido || documento.importeExtraido,
            netoGravadoExtraido: ruleResult.data.netoGravadoExtraido || documento.netoGravadoExtraido,
            exentoExtraido: ruleResult.data.exentoExtraido || documento.exentoExtraido,
            impuestosExtraido: ruleResult.data.impuestosExtraido || documento.impuestosExtraido,
            updatedAt: new Date()
          };

          // Detectar cambios específicos
          const cambios = [];
          if (updateData.razonSocialExtraida !== documento.razonSocialExtraida) {
            cambios.push(`razonSocial: "${documento.razonSocialExtraida || 'null'}" → "${updateData.razonSocialExtraida}"`);
          }
          if (updateData.cuitExtraido !== documento.cuitExtraido) {
            cambios.push(`CUIT: "${documento.cuitExtraido || 'null'}" → "${updateData.cuitExtraido}"`);
          }
          if (updateData.numeroComprobanteExtraido !== documento.numeroComprobanteExtraido) {
            cambios.push(`nroComprobante: "${documento.numeroComprobanteExtraido || 'null'}" → "${updateData.numeroComprobanteExtraido}"`);
          }

          await prisma.documentos_procesados.update({
            where: { id: documento.id },
            data: updateData
          });

          documentosTransformados++;
          console.log(`✅ Documento ${documento.nombreArchivo} (${documento.id.substring(0, 8)}...):`);
          console.log(`   📐 ${ruleResult.rulesApplied} regla(s) aplicada(s)`);
          if (cambios.length > 0) {
            console.log(`   🔄 Cambios realizados:`);
            cambios.forEach(cambio => console.log(`      - ${cambio}`));
          }
        }
      } catch (ruleError) {
        console.error(`❌ Error aplicando reglas al documento ${documento.id}:`, ruleError);
        // Continuar con el siguiente documento aunque falle la regla
      }
    }

    console.log(`✅ Reglas aplicadas: ${documentosProcesados} documentos procesados, ${documentosTransformados} transformados`);

    res.json({
      success: true,
      message: `Reglas aplicadas correctamente`,
      total: documentos.length,
      procesados: documentosProcesados,
      transformados: documentosTransformados
    });

  } catch (error) {
    console.error('❌ Error aplicando reglas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;