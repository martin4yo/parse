const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authWithTenant } = require('../middleware/authWithTenant');
const aiClassificationService = require('../services/aiClassificationService');

/**
 * GET /api/sugerencias-ia
 * Lista sugerencias de IA con filtros
 */
router.get('/', authWithTenant, async (req, res) => {
  try {
    const {
      estado,
      reglaId,
      entidadTipo,
      confianzaMin,
      confianzaMax,
      page = '1',
      limit = '50'
    } = req.query;

    const where = req.filterByTenant({});

    if (estado) {
      where.estado = estado;
    }

    if (reglaId) {
      where.reglaId = reglaId;
    }

    if (entidadTipo) {
      where.entidadTipo = entidadTipo;
    }

    if (confianzaMin) {
      where.confianza = { ...where.confianza, gte: parseFloat(confianzaMin) };
    }

    if (confianzaMax) {
      where.confianza = { ...where.confianza, lte: parseFloat(confianzaMax) };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [sugerencias, total] = await Promise.all([
      prisma.sugerencias_ia.findMany({
        where,
        include: {
          reglas_negocio: {
            select: {
              id: true,
              codigo: true,
              nombre: true
            }
          },
          users: {
            select: {
              id: true,
              nombre: true,
              apellido: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limitNum
      }),
      prisma.sugerencias_ia.count({ where })
    ]);

    res.json({
      success: true,
      data: sugerencias,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error al listar sugerencias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sugerencias-ia/stats
 * Obtiene estadísticas de sugerencias
 */
router.get('/stats', authWithTenant, async (req, res) => {
  try {
    const where = req.filterByTenant({});

    const [
      totalPendientes,
      totalAprobadas,
      totalRechazadas,
      totalAplicadas,
      promedioConfianza
    ] = await Promise.all([
      prisma.sugerencias_ia.count({ where: { ...where, estado: 'pendiente' } }),
      prisma.sugerencias_ia.count({ where: { ...where, estado: 'aprobada' } }),
      prisma.sugerencias_ia.count({ where: { ...where, estado: 'rechazada' } }),
      prisma.sugerencias_ia.count({ where: { ...where, estado: 'aplicada' } }),
      prisma.sugerencias_ia.aggregate({
        where,
        _avg: {
          confianza: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        pendientes: totalPendientes,
        aprobadas: totalAprobadas,
        rechazadas: totalRechazadas,
        aplicadas: totalAplicadas,
        total: totalPendientes + totalAprobadas + totalRechazadas + totalAplicadas,
        promedioConfianza: promedioConfianza._avg.confianza || 0
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sugerencias-ia/:id
 * Obtiene una sugerencia específica
 */
router.get('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const sugerencia = await prisma.sugerencias_ia.findFirst({
      where: req.filterByTenant({ id }),
      include: {
        reglas_negocio: true,
        users: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true
          }
        }
      }
    });

    if (!sugerencia) {
      return res.status(404).json({
        success: false,
        error: 'Sugerencia no encontrada'
      });
    }

    res.json({
      success: true,
      data: sugerencia
    });

  } catch (error) {
    console.error('Error al obtener sugerencia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sugerencias-ia/:id/aprobar
 * Aprueba y aplica una sugerencia
 */
router.post('/:id/aprobar', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { valorFinal } = req.body; // Opcional: valor diferente al sugerido

    const sugerencia = await prisma.sugerencias_ia.findFirst({
      where: req.filterByTenant({ id })
    });

    if (!sugerencia) {
      return res.status(404).json({
        success: false,
        error: 'Sugerencia no encontrada'
      });
    }

    if (sugerencia.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        error: `La sugerencia ya fue ${sugerencia.estado}`
      });
    }

    // Extraer el valor del objeto JSON si es necesario
    let valorAAplicar = valorFinal || sugerencia.valorSugerido;
    if (typeof valorAAplicar === 'object' && valorAAplicar !== null) {
      valorAAplicar = valorAAplicar.valor;
    }

    // Aplicar el valor a la entidad correspondiente
    let entidadActualizada;
    try {
      switch (sugerencia.entidadTipo) {
        case 'documento_lineas':
          entidadActualizada = await prisma.documento_lineas.update({
            where: { id: sugerencia.entidadId },
            data: {
              [sugerencia.campoDestino]: valorAAplicar
            }
          });
          console.log(`✅ Aplicado ${sugerencia.campoDestino} = "${valorAAplicar}" en documento_lineas:${sugerencia.entidadId}`);
          break;

        case 'documento_impuestos':
          entidadActualizada = await prisma.documento_impuestos.update({
            where: { id: sugerencia.entidadId },
            data: {
              [sugerencia.campoDestino]: valorAAplicar
            }
          });
          console.log(`✅ Aplicado ${sugerencia.campoDestino} = "${valorAAplicar}" en documento_impuestos:${sugerencia.entidadId}`);
          break;

        case 'documentos_procesados':
          entidadActualizada = await prisma.documentos_procesados.update({
            where: { id: sugerencia.entidadId },
            data: {
              [sugerencia.campoDestino]: valorAAplicar
            }
          });
          console.log(`✅ Aplicado ${sugerencia.campoDestino} = "${valorAAplicar}" en documentos_procesados:${sugerencia.entidadId}`);
          break;

        default:
          throw new Error(`Tipo de entidad no soportado: ${sugerencia.entidadTipo}`);
      }
    } catch (error) {
      console.error('❌ Error al aplicar sugerencia a la entidad:', error);
      throw new Error(`No se pudo aplicar el valor: ${error.message}`);
    }

    // Actualizar sugerencia a estado "aplicada"
    const sugerenciaActualizada = await prisma.sugerencias_ia.update({
      where: { id },
      data: {
        estado: 'aplicada',
        valorFinal: valorAAplicar,
        revisadoPor: req.userId,
        revisadoAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        sugerencia: sugerenciaActualizada,
        entidadActualizada
      },
      message: 'Sugerencia aprobada y aplicada exitosamente'
    });

  } catch (error) {
    console.error('Error al aprobar sugerencia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sugerencias-ia/:id/rechazar
 * Rechaza una sugerencia
 */
router.post('/:id/rechazar', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { razonRechazo } = req.body;

    const sugerencia = await prisma.sugerencias_ia.findFirst({
      where: req.filterByTenant({ id })
    });

    if (!sugerencia) {
      return res.status(404).json({
        success: false,
        error: 'Sugerencia no encontrada'
      });
    }

    if (sugerencia.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        error: `La sugerencia ya fue ${sugerencia.estado}`
      });
    }

    const sugerenciaActualizada = await prisma.sugerencias_ia.update({
      where: { id },
      data: {
        estado: 'rechazada',
        razon: razonRechazo || sugerencia.razon,
        revisadoPor: req.userId,
        revisadoAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: sugerenciaActualizada,
      message: 'Sugerencia rechazada'
    });

  } catch (error) {
    console.error('Error al rechazar sugerencia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sugerencias-ia/aprobar-batch
 * Aprueba y aplica múltiples sugerencias en lote
 */
router.post('/aprobar-batch', authWithTenant, async (req, res) => {
  try {
    const { ids, confianzaMinima } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs'
      });
    }

    const where = req.filterByTenant({
      id: { in: ids },
      estado: 'pendiente'
    });

    if (confianzaMinima) {
      where.confianza = { gte: parseFloat(confianzaMinima) };
    }

    // Obtener todas las sugerencias a aprobar
    const sugerencias = await prisma.sugerencias_ia.findMany({
      where
    });

    if (sugerencias.length === 0) {
      return res.json({
        success: true,
        data: {
          aprobadas: 0,
          aplicadas: 0,
          errores: []
        },
        message: 'No hay sugerencias pendientes que cumplan los criterios'
      });
    }

    console.log(`🔄 Aplicando ${sugerencias.length} sugerencias en lote...`);

    const resultados = {
      aprobadas: 0,
      aplicadas: 0,
      errores: []
    };

    // Aplicar cada sugerencia individualmente
    for (const sugerencia of sugerencias) {
      try {
        // Extraer el valor del objeto JSON si es necesario
        let valorAAplicar = sugerencia.valorSugerido;
        if (typeof valorAAplicar === 'object' && valorAAplicar !== null) {
          valorAAplicar = valorAAplicar.valor;
        }

        // Aplicar el valor a la entidad correspondiente
        switch (sugerencia.entidadTipo) {
          case 'documento_lineas':
            await prisma.documento_lineas.update({
              where: { id: sugerencia.entidadId },
              data: {
                [sugerencia.campoDestino]: valorAAplicar
              }
            });
            break;

          case 'documento_impuestos':
            await prisma.documento_impuestos.update({
              where: { id: sugerencia.entidadId },
              data: {
                [sugerencia.campoDestino]: valorAAplicar
              }
            });
            break;

          case 'documentos_procesados':
            await prisma.documentos_procesados.update({
              where: { id: sugerencia.entidadId },
              data: {
                [sugerencia.campoDestino]: valorAAplicar
              }
            });
            break;

          default:
            throw new Error(`Tipo de entidad no soportado: ${sugerencia.entidadTipo}`);
        }

        // Marcar sugerencia como aplicada
        await prisma.sugerencias_ia.update({
          where: { id: sugerencia.id },
          data: {
            estado: 'aplicada',
            valorFinal: valorAAplicar,
            revisadoPor: req.userId,
            revisadoAt: new Date()
          }
        });

        resultados.aplicadas++;
        console.log(`✅ Sugerencia ${sugerencia.id} aplicada: ${sugerencia.campoDestino} = "${valorAAplicar}"`);

      } catch (error) {
        console.error(`❌ Error al aplicar sugerencia ${sugerencia.id}:`, error);
        resultados.errores.push({
          sugerenciaId: sugerencia.id,
          error: error.message
        });
      }
    }

    resultados.aprobadas = resultados.aplicadas;

    res.json({
      success: true,
      data: resultados,
      message: `${resultados.aplicadas} sugerencias aprobadas y aplicadas exitosamente${resultados.errores.length > 0 ? ` (${resultados.errores.length} errores)` : ''}`
    });

  } catch (error) {
    console.error('Error al aprobar sugerencias en lote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sugerencias-ia/:id
 * Elimina una sugerencia
 */
router.delete('/:id', authWithTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const sugerencia = await prisma.sugerencias_ia.findFirst({
      where: req.filterByTenant({ id })
    });

    if (!sugerencia) {
      return res.status(404).json({
        success: false,
        error: 'Sugerencia no encontrada'
      });
    }

    await prisma.sugerencias_ia.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Sugerencia eliminada'
    });

  } catch (error) {
    console.error('Error al eliminar sugerencia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
