/**
 * API Routes para generación de reglas con IA
 */

const express = require('express');
const router = express.Router();
const aiRuleGenerator = require('../services/aiRuleGenerator');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { authWithTenant } = require('../middleware/authWithTenant');

const prisma = new PrismaClient();

/**
 * POST /api/ai-rules/generate
 *
 * Genera una regla de negocio desde lenguaje natural
 *
 * Body:
 * {
 *   "text": "Descripción en lenguaje natural de la regla"
 * }
 */
router.post('/generate', authWithTenant, async (req, res) => {
  try {
    const { text } = req.body;
    const tenantId = req.tenantId; // Del middleware authWithTenant

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El texto de la regla es requerido'
      });
    }

    console.log(`\n🤖 ===== GENERACIÓN DE REGLA CON IA =====`);
    console.log(`👤 Usuario: ${req.user?.email || 'desconocido'}`);
    console.log(`🏢 Tenant: ${tenantId || 'desconocido'}`);
    console.log(`📝 Texto: ${text.substring(0, 100)}...`);

    // Generar regla con IA
    const result = await aiRuleGenerator.generateRuleFromText(text, tenantId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ Regla generada: ${result.rule.nombre}`);

    res.json(result);

  } catch (error) {
    console.error('❌ Error en /generate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-rules/test
 *
 * Prueba una regla contra un documento de ejemplo
 *
 * Body:
 * {
 *   "rule": { ... regla generada ... },
 *   "documento": { ... documento de prueba ... }
 * }
 */
router.post('/test', authWithTenant, async (req, res) => {
  try {
    const { rule, documento } = req.body;

    if (!rule || !documento) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere regla y documento'
      });
    }

    console.log(`\n🧪 ===== PRUEBA DE REGLA =====`);
    console.log(`📋 Regla: ${rule.nombre}`);
    console.log(`📄 Documento: ${documento.numeroComprobante || 'sin número'}`);

    // Probar regla
    const result = await aiRuleGenerator.testRule(rule, documento);

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ Prueba completada`);
    console.log(`📊 Cambios: ${result.resultado.cambios.length}`);

    res.json(result);

  } catch (error) {
    console.error('❌ Error en /test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-rules/save
 *
 * Guarda una regla generada por IA en la base de datos
 *
 * Body:
 * {
 *   "rule": { ... regla generada ... }
 * }
 */
router.post('/save', authWithTenant, async (req, res) => {
  try {
    const { rule } = req.body;
    const tenantId = req.tenantId; // Del middleware authWithTenant
    const usuarioId = req.userId; // Del middleware authWithTenant

    if (!rule) {
      return res.status(400).json({
        success: false,
        error: 'La regla es requerida'
      });
    }

    console.log(`\n💾 ===== GUARDANDO REGLA =====`);
    console.log(`📋 Regla: ${rule.nombre}`);
    console.log(`🏢 Tenant ID: ${tenantId}`);
    console.log(`👤 Usuario ID: ${usuarioId}`);

    // Validar que tenemos tenant y usuario
    if (!tenantId) {
      throw new Error('TenantId no disponible. Verifica la autenticación.');
    }
    if (!usuarioId) {
      throw new Error('UsuarioId no disponible. Verifica la autenticación.');
    }

    // Validar estructura nuevamente (seguridad)
    aiRuleGenerator.validateRuleStructure(rule);

    // Guardar en BD usando la estructura existente
    const reglaNegocio = await prisma.reglas_negocio.create({
      data: {
        id: uuidv4(),
        codigo: `AI_RULE_${Date.now()}`,
        nombre: rule.nombre,
        descripcion: rule.descripcion || '',
        tipo: 'TRANSFORMACION', // Tipo correcto según validación de reglas.js
        activa: rule.activa !== false, // Por defecto true
        prioridad: rule.prioridad || 10,
        version: 1,
        configuracion: {
          condiciones: rule.condiciones,
          acciones: rule.acciones,
          generadaPorIA: true,
          metadataIA: {
            modelo: 'claude',
            timestamp: new Date().toISOString()
          }
        },
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: usuarioId,
        updatedBy: usuarioId
      }
    });

    console.log(`✅ Regla guardada exitosamente:`);
    console.log(`   ID: ${reglaNegocio.id}`);
    console.log(`   Tipo: ${reglaNegocio.tipo}`);
    console.log(`   TenantId: ${reglaNegocio.tenantId}`);
    console.log(`   CreatedBy: ${reglaNegocio.createdBy}`);
    console.log(`   UpdatedBy: ${reglaNegocio.updatedBy}`);

    res.json({
      success: true,
      regla: reglaNegocio
    });

  } catch (error) {
    console.error('❌ Error en /save:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai-rules/examples
 *
 * Retorna ejemplos de reglas que el usuario puede generar
 */
router.get('/examples', authWithTenant, async (req, res) => {
  try {
    const ejemplos = [
      {
        categoria: 'Categorización',
        ejemplos: [
          'Todas las facturas que tengan "transporte" o "taxi" en la descripción, categorizarlas como MOVILIDAD',
          'Si la razón social contiene "telecomunicaciones" o "internet", categorizar como SERVICIOS_IT',
          'Facturas con items que contengan "papelería" o "útiles", categorizar como OFICINA'
        ]
      },
      {
        categoria: 'Cálculos',
        ejemplos: [
          'Si el importe es mayor a $100,000, aplicar un descuento del 15%',
          'Agregar un recargo del 5% a todas las facturas de SERVICIOS',
          'Si el neto gravado es menor a $10,000, marcar como gasto menor'
        ]
      },
      {
        categoria: 'Asignación',
        ejemplos: [
          'Todas las facturas de ACME S.A. asignarlas al centro de costos IT-001',
          'Facturas con CUIT 30-12345678-9 van al proyecto ALPHA',
          'Si la categoría es MOVILIDAD, asignar responsable "Juan Pérez"'
        ]
      },
      {
        categoria: 'Validación',
        ejemplos: [
          'Si el importe supera $500,000, marcar para revisión manual',
          'Facturas tipo C sin CUIT completo requieren validación',
          'Si la fecha es mayor a 30 días, marcar como vencida'
        ]
      },
      {
        categoria: 'Transformación',
        ejemplos: [
          'Convertir todas las facturas B en moneda extranjera usando el tipo de cambio del día',
          'Normalizar razones sociales: quitar puntos, comas y convertir a mayúsculas',
          'Extraer el código de proyecto de la descripción si empieza con "#"'
        ]
      }
    ];

    res.json({
      success: true,
      ejemplos
    });

  } catch (error) {
    console.error('❌ Error en /examples:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
