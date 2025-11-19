/**
 * Pattern Learning Service
 *
 * Sistema de aprendizaje continuo que mejora la extracción de datos
 * mediante el análisis de patrones históricos en documentos procesados.
 *
 * Características:
 * - Búsqueda ultrarrápida de patrones previamente aprendidos
 * - Auto-aprendizaje cuando la IA clasifica correctamente
 * - Aprendizaje manual cuando el usuario corrige valores
 * - Sistema de confianza progresivo (mejora con más ocurrencias)
 * - Reducción de costos de IA (usa histórico primero)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

/**
 * Genera un hash único para un patrón de entrada
 * Permite búsqueda rápida sin comparar JSON complejos
 */
function generatePatternHash(inputPattern) {
  const normalized = JSON.stringify(inputPattern, Object.keys(inputPattern).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normaliza un patrón de entrada para matching consistente
 * - Convierte a minúsculas
 * - Elimina espacios extras
 * - Ordena claves alfabéticamente
 */
function normalizePattern(pattern) {
  const normalized = {};

  for (const [key, value] of Object.entries(pattern)) {
    if (value === null || value === undefined || value === '') continue;

    if (typeof value === 'string') {
      normalized[key] = value.toLowerCase().trim().replace(/\s+/g, ' ');
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Busca un patrón aprendido en la base de datos
 *
 * @param {Object} params
 * @param {string} params.tenantId - ID del tenant
 * @param {string} params.tipoPatron - Tipo de patrón (ej: "cuenta_linea", "dimension_doc")
 * @param {Object} params.inputPattern - Patrón de entrada a buscar
 * @param {number} params.minConfianza - Confianza mínima requerida (default: 0.7)
 * @returns {Object|null} Patrón encontrado con su valor y confianza, o null
 */
async function buscarPatron({ tenantId, tipoPatron, inputPattern, minConfianza = 0.7 }) {
  try {
    const normalized = normalizePattern(inputPattern);
    const hash = generatePatternHash(normalized);

    console.log('🔍 [PatternLearning] Buscando patrón:', {
      tipoPatron,
      hash: hash.substring(0, 12) + '...',
      inputPattern: normalized
    });

    const patron = await prisma.patrones_aprendidos.findFirst({
      where: {
        tenantId,
        tipo_patron: tipoPatron,
        hash_pattern: hash,
        confianza: { gte: minConfianza }
      },
      orderBy: {
        num_ocurrencias: 'desc' // Priorizar patrones más usados
      }
    });

    if (patron) {
      console.log('✅ [PatternLearning] Patrón encontrado:', {
        outputValue: patron.output_value,
        outputCampo: patron.output_campo,
        confianza: patron.confianza,
        ocurrencias: patron.num_ocurrencias,
        origen: patron.origen
      });
    } else {
      console.log('❌ [PatternLearning] No se encontró patrón con suficiente confianza');
    }

    return patron;
  } catch (error) {
    console.error('❌ [PatternLearning] Error buscando patrón:', error);
    return null;
  }
}

/**
 * Busca patrones similares (matching parcial)
 * Útil cuando no hay match exacto pero hay patrones parecidos
 *
 * @param {Object} params
 * @param {string} params.tenantId - ID del tenant
 * @param {string} params.tipoPatron - Tipo de patrón
 * @param {Object} params.inputPattern - Patrón de entrada
 * @param {number} params.minConfianza - Confianza mínima
 * @param {number} params.limit - Máximo de resultados (default: 5)
 * @returns {Array} Lista de patrones similares ordenados por relevancia
 */
async function buscarPatronesSimilares({ tenantId, tipoPatron, inputPattern, minConfianza = 0.6, limit = 5 }) {
  try {
    const normalized = normalizePattern(inputPattern);

    // Buscar patrones del mismo tipo con claves similares
    const patrones = await prisma.patrones_aprendidos.findMany({
      where: {
        tenantId,
        tipo_patron: tipoPatron,
        confianza: { gte: minConfianza }
      },
      orderBy: [
        { num_ocurrencias: 'desc' },
        { confianza: 'desc' }
      ],
      take: limit * 3 // Buscar más para filtrar
    });

    // Calcular similitud de cada patrón
    const patronesConScore = patrones.map(patron => {
      const storedPattern = patron.input_pattern;
      let score = 0;
      let matches = 0;

      // Comparar campos comunes
      for (const key in normalized) {
        if (storedPattern[key]) {
          matches++;
          if (typeof normalized[key] === 'string' && typeof storedPattern[key] === 'string') {
            // Similitud de strings (simple)
            const similarity = stringSimilarity(normalized[key], storedPattern[key]);
            score += similarity;
          } else if (normalized[key] === storedPattern[key]) {
            score += 1; // Match exacto
          }
        }
      }

      const avgScore = matches > 0 ? score / matches : 0;

      return {
        ...patron,
        similarityScore: avgScore,
        matchedFields: matches
      };
    });

    // Filtrar y ordenar por score
    const resultados = patronesConScore
      .filter(p => p.similarityScore > 0.5)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    if (resultados.length > 0) {
      console.log('🔍 [PatternLearning] Encontrados patrones similares:', resultados.length);
    }

    return resultados;
  } catch (error) {
    console.error('❌ [PatternLearning] Error buscando patrones similares:', error);
    return [];
  }
}

/**
 * Calcula similitud simple entre dos strings (0-1)
 */
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Distancia de Levenshtein (ediciones necesarias entre strings)
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Aprende un nuevo patrón o refuerza uno existente
 *
 * @param {Object} params
 * @param {string} params.tenantId - ID del tenant
 * @param {string} params.tipoPatron - Tipo de patrón
 * @param {Object} params.inputPattern - Patrón de entrada
 * @param {string} params.outputValue - Valor de salida
 * @param {string} params.outputCampo - Campo destino
 * @param {string} params.origen - Origen del aprendizaje ("ai", "manual", "correction")
 * @param {number} params.confianzaInicial - Confianza inicial (default según origen)
 * @returns {Object} Patrón creado/actualizado
 */
async function aprenderPatron({
  tenantId,
  tipoPatron,
  inputPattern,
  outputValue,
  outputCampo,
  origen = 'ai',
  confianzaInicial = null
}) {
  try {
    const normalized = normalizePattern(inputPattern);
    const hash = generatePatternHash(normalized);

    // Confianza inicial según origen
    const confianzaBase = confianzaInicial ?? (
      origen === 'manual' ? 1.0 :     // Usuario corrigió manualmente = 100% confianza
      origen === 'correction' ? 0.95 : // Corrección de IA = 95%
      0.8                              // IA automática = 80%
    );

    console.log('📚 [PatternLearning] Aprendiendo patrón:', {
      tipoPatron,
      hash: hash.substring(0, 12) + '...',
      outputValue,
      outputCampo,
      origen,
      confianza: confianzaBase
    });

    // Buscar si ya existe
    const existente = await prisma.patrones_aprendidos.findFirst({
      where: {
        tenantId,
        tipo_patron: tipoPatron,
        hash_pattern: hash
      }
    });

    let patron;

    if (existente) {
      // Reforzar patrón existente
      const nuevasOcurrencias = existente.num_ocurrencias + 1;

      // Mejorar confianza progresivamente (máximo 0.99)
      // Fórmula: confianza aumenta logarítmicamente con ocurrencias
      const mejora = Math.min(0.02, 0.2 / Math.log10(nuevasOcurrencias + 10));
      const nuevaConfianza = Math.min(0.99, existente.confianza + mejora);

      patron = await prisma.patrones_aprendidos.update({
        where: { id: existente.id },
        data: {
          output_value: outputValue, // Actualizar con valor más reciente
          num_ocurrencias: nuevasOcurrencias,
          confianza: nuevaConfianza,
          ultima_fecha: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('✅ [PatternLearning] Patrón reforzado:', {
        ocurrencias: `${existente.num_ocurrencias} → ${nuevasOcurrencias}`,
        confianza: `${existente.confianza.toFixed(2)} → ${nuevaConfianza.toFixed(2)}`
      });
    } else {
      // Crear nuevo patrón
      patron = await prisma.patrones_aprendidos.create({
        data: {
          tenantId,
          tipo_patron: tipoPatron,
          hash_pattern: hash,
          input_pattern: normalized,
          output_value: outputValue,
          output_campo: outputCampo,
          confianza: confianzaBase,
          num_ocurrencias: 1,
          ultima_fecha: new Date(),
          origen
        }
      });

      console.log('✅ [PatternLearning] Nuevo patrón creado con confianza:', confianzaBase);
    }

    return patron;
  } catch (error) {
    console.error('❌ [PatternLearning] Error aprendiendo patrón:', error);
    throw error;
  }
}

/**
 * Aprende múltiples patrones de un documento procesado
 * Útil para aprender de documentos ya validados
 *
 * @param {Object} params
 * @param {string} params.tenantId - ID del tenant
 * @param {string} params.documentoId - ID del documento procesado
 * @param {string} params.origen - Origen del aprendizaje
 */
async function aprenderDeDocumento({ tenantId, documentoId, origen = 'ai' }) {
  try {
    console.log('📖 [PatternLearning] Aprendiendo de documento:', documentoId);

    const documento = await prisma.documentos_procesados.findUnique({
      where: { id: documentoId },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    if (!documento) {
      throw new Error('Documento no encontrado');
    }

    const patronesAprendidos = [];

    // Aprender de líneas
    for (const linea of documento.documento_lineas) {
      // Patrón para cuenta contable
      if (linea.cuentaContable) {
        const patron = await aprenderPatron({
          tenantId,
          tipoPatron: 'cuenta_linea',
          inputPattern: {
            descripcion: linea.descripcion,
            cuitProveedor: documento.cuitExtraido
          },
          outputValue: linea.cuentaContable,
          outputCampo: 'cuentaContable',
          origen
        });
        patronesAprendidos.push(patron);
      }

      // Patrón para tipo de producto
      if (linea.tipoProducto) {
        const patron = await aprenderPatron({
          tenantId,
          tipoPatron: 'tipo_producto',
          inputPattern: {
            descripcion: linea.descripcion
          },
          outputValue: linea.tipoProducto,
          outputCampo: 'tipoProducto',
          origen
        });
        patronesAprendidos.push(patron);
      }

      // Patrón para código de producto
      if (linea.codigoProducto && linea.codigoProductoOriginal) {
        const patron = await aprenderPatron({
          tenantId,
          tipoPatron: 'codigo_producto',
          inputPattern: {
            descripcion: linea.descripcion,
            codigoOriginal: linea.codigoProductoOriginal
          },
          outputValue: linea.codigoProducto,
          outputCampo: 'codigoProducto',
          origen
        });
        patronesAprendidos.push(patron);
      }
    }

    // Aprender de impuestos
    for (const impuesto of documento.documento_impuestos) {
      if (impuesto.cuentaContable) {
        const patron = await aprenderPatron({
          tenantId,
          tipoPatron: 'cuenta_impuesto',
          inputPattern: {
            tipoImpuesto: impuesto.tipo,
            alicuota: impuesto.alicuota?.toString()
          },
          outputValue: impuesto.cuentaContable,
          outputCampo: 'cuentaContable',
          origen
        });
        patronesAprendidos.push(patron);
      }
    }

    console.log(`✅ [PatternLearning] Aprendidos ${patronesAprendidos.length} patrones del documento`);

    return patronesAprendidos;
  } catch (error) {
    console.error('❌ [PatternLearning] Error aprendiendo de documento:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de aprendizaje para un tenant
 */
async function obtenerEstadisticas(tenantId) {
  try {
    const stats = await prisma.patrones_aprendidos.groupBy({
      by: ['tipo_patron'],
      where: { tenantId },
      _count: true,
      _avg: {
        confianza: true,
        num_ocurrencias: true
      }
    });

    const total = await prisma.patrones_aprendidos.count({
      where: { tenantId }
    });

    return {
      total,
      porTipo: stats.map(s => ({
        tipo: s.tipo_patron,
        cantidad: s._count,
        confianzaPromedio: s._avg.confianza,
        ocurrenciasPromedio: s._avg.num_ocurrencias
      }))
    };
  } catch (error) {
    console.error('❌ [PatternLearning] Error obteniendo estadísticas:', error);
    return null;
  }
}

module.exports = {
  buscarPatron,
  buscarPatronesSimilares,
  aprenderPatron,
  aprenderDeDocumento,
  obtenerEstadisticas,
  generatePatternHash,
  normalizePattern
};
