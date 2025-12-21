const ApiConnectorService = require('./apiConnectorService');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

/**
 * Servicio para PUSH de datos desde Parse hacia APIs externas
 *
 * Maneja la exportación de:
 * - Documentos procesados
 * - Proveedores
 * - Productos
 * - Cuentas contables
 * - Centros de costo
 */
class ApiPushService extends ApiConnectorService {
  constructor() {
    super();
  }

  /**
   * Ejecuta exportación PUSH de un conector
   * @param {string} connectorId - ID del conector
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Resultado de la exportación
   */
  async executePush(connectorId, options = {}) {
    const connector = await this.getConnector(connectorId);

    if (connector.direction !== 'PUSH' && connector.direction !== 'BIDIRECTIONAL') {
      throw new Error('Este conector no está configurado para exportación PUSH');
    }

    if (!connector.pushResources || connector.pushResources.length === 0) {
      throw new Error('No hay recursos configurados para exportación');
    }

    console.log(`\n🚀 [PUSH] Iniciando exportación para conector: ${connector.nombre}`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      exportedResources: []
    };

    // Procesar cada recurso configurado
    for (const resource of connector.pushResources) {
      try {
        console.log(`\n📤 [PUSH] Exportando recurso: ${resource.resourceType}`);

        const resourceResult = await this.exportResource(
          connector,
          resource,
          options
        );

        results.success += resourceResult.success;
        results.failed += resourceResult.failed;
        results.skipped += resourceResult.skipped;
        results.exportedResources.push({
          resourceType: resource.resourceType,
          ...resourceResult
        });

      } catch (error) {
        console.error(`❌ [PUSH] Error exportando ${resource.resourceType}:`, error.message);
        results.failed++;
        results.errors.push({
          resourceType: resource.resourceType,
          error: error.message
        });
      }
    }

    // Actualizar última sincronización
    await prisma.api_connectors.update({
      where: { id: connectorId },
      data: { lastSyncAt: new Date() }
    });

    console.log(`\n✅ [PUSH] Exportación completada: ${results.success} éxitos, ${results.failed} fallos, ${results.skipped} omitidos`);

    // Disparar webhooks según el resultado
    try {
      const { triggerExportCompleted, triggerExportFailed } = require('./webhookService');

      if (results.success > 0 && results.failed === 0) {
        // Exportación completamente exitosa
        await triggerExportCompleted(connector.tenantId, connectorId, {
          success: results.success,
          failed: results.failed,
          skipped: results.skipped
        });
      } else if (results.failed > 0) {
        // Hubo fallos en la exportación
        const errorMsg = results.errors.length > 0
          ? results.errors.map(e => e.error).join('; ')
          : `${results.failed} exportaciones fallidas`;
        await triggerExportFailed(connector.tenantId, connectorId, new Error(errorMsg));
      }
    } catch (webhookError) {
      console.warn('⚠️  Error disparando webhooks export:', webhookError.message);
      // No fallar la exportación por error de webhook
    }

    return results;
  }

  /**
   * Exporta un tipo de recurso específico
   * @param {Object} connector - Configuración del conector
   * @param {Object} resource - Configuración del recurso
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Resultado de la exportación
   */
  async exportResource(connector, resource, options = {}) {
    const { resourceType, endpoint, fieldMapping, filters } = resource;

    // Obtener datos a exportar según el tipo de recurso
    const dataToExport = await this.fetchDataToExport(
      connector.tenantId,
      resourceType,
      filters,
      options
    );

    if (dataToExport.length === 0) {
      console.log(`ℹ️ [PUSH] No hay datos nuevos para exportar en ${resourceType}`);
      return { success: 0, failed: 0, skipped: 0, records: [] };
    }

    console.log(`📊 [PUSH] Encontrados ${dataToExport.length} registros para exportar`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      records: []
    };

    // Exportar cada registro
    for (const record of dataToExport) {
      try {
        // Aplicar mapeo de campos
        const transformedData = this.applyFieldMapping(record, fieldMapping);

        // Enviar a la API externa
        const response = await this.sendToExternalAPI(
          connector,
          endpoint,
          transformedData,
          options
        );

        // Marcar como exportado
        await this.markAsExported(
          resourceType,
          record.id,
          connector.id,
          response
        );

        // Log de exportación exitosa
        await this.logExport(
          connector.id,
          resourceType,
          record.id,
          'SUCCESS',
          transformedData,
          response
        );

        results.success++;
        results.records.push({
          id: record.id,
          status: 'success',
          externalId: response.data?.id
        });

        console.log(`✅ [PUSH] Exportado ${resourceType} ID: ${record.id}`);

      } catch (error) {
        console.error(`❌ [PUSH] Error exportando ${resourceType} ID ${record.id}:`, error.message);

        // Log de exportación fallida
        await this.logExport(
          connector.id,
          resourceType,
          record.id,
          'FAILED',
          null,
          { error: error.message }
        );

        results.failed++;
        results.records.push({
          id: record.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Obtiene datos a exportar según el tipo de recurso
   * @param {string} tenantId - ID del tenant
   * @param {string} resourceType - Tipo de recurso
   * @param {Object} filters - Filtros adicionales
   * @param {Object} options - Opciones
   * @returns {Promise<Array>} Datos a exportar
   */
  async fetchDataToExport(tenantId, resourceType, filters = {}, options = {}) {
    const { forceAll = false, limit = 100, documentIds } = options;

    const baseWhere = {
      tenantId,
      ...filters
    };

    // Si se proporcionan IDs específicos, usarlos (tiene prioridad)
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      baseWhere.id = { in: documentIds };
    } else if (!forceAll) {
      // Si no es forzar todo, solo exportar lo no exportado
      baseWhere.lastExportedAt = null;
    }

    switch (resourceType) {
      case 'DOCUMENTO':
        return await prisma.documentos_procesados.findMany({
          where: {
            ...baseWhere,
            estadoProcesamiento: 'completado' // Solo exportar documentos completados
          },
          take: documentIds ? undefined : limit, // Sin límite si hay IDs específicos
          orderBy: { fechaCarga: 'asc' },
          include: {
            documento_lineas: true,
            documento_impuestos: true,
            proveedor: true
          }
        });

      case 'PROVEEDOR':
        return await prisma.proveedores.findMany({
          where: baseWhere,
          take: limit,
          orderBy: { createdAt: 'asc' }
        });

      case 'PRODUCTO':
        return await prisma.parametros_maestros.findMany({
          where: {
            ...baseWhere,
            tipo_campo: 'producto'
          },
          take: limit,
          orderBy: { id: 'asc' }
        });

      case 'CUENTA_CONTABLE':
        return await prisma.parametros_maestros.findMany({
          where: {
            ...baseWhere,
            tipo_campo: 'cuenta_contable'
          },
          take: limit,
          orderBy: { id: 'asc' }
        });

      case 'CENTRO_COSTO':
        return await prisma.parametros_maestros.findMany({
          where: {
            ...baseWhere,
            tipo_campo: 'centro_costo'
          },
          take: limit,
          orderBy: { id: 'asc' }
        });

      default:
        throw new Error(`Tipo de recurso no soportado: ${resourceType}`);
    }
  }

  /**
   * Aplica mapeo de campos según configuración
   * @param {Object} sourceData - Datos originales
   * @param {Object} fieldMapping - Mapeo de campos
   * @returns {Object} Datos transformados
   */
  applyFieldMapping(sourceData, fieldMapping) {
    if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
      return sourceData;
    }

    const transformed = {};

    for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
      // Soporta dot notation para campos anidados
      const value = this.getNestedValue(sourceData, sourceField);
      this.setNestedValue(transformed, targetField, value);
    }

    return transformed;
  }

  /**
   * Obtiene valor de campo anidado con dot notation
   * @param {Object} obj - Objeto
   * @param {string} path - Ruta (ej: "proveedor.cuit")
   * @returns {*} Valor
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Establece valor en campo anidado con dot notation
   * @param {Object} obj - Objeto
   * @param {string} path - Ruta
   * @param {*} value - Valor
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Envía datos a la API externa
   * @param {Object} connector - Configuración del conector
   * @param {string} endpoint - Endpoint específico
   * @param {Object} data - Datos a enviar
   * @param {Object} options - Opciones
   * @returns {Promise<Object>} Respuesta de la API
   */
  async sendToExternalAPI(connector, endpoint, data, options = {}) {
    const url = `${connector.baseUrl}${endpoint}`;
    const headers = this.buildHeaders(connector);

    console.log(`🌐 [PUSH] POST ${url}`);

    try {
      const response = await axios.post(url, data, {
        headers,
        timeout: connector.timeout || 30000,
        validateStatus: (status) => status < 500 // Consideramos errores 4xx como respuestas válidas
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return response;

    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('Sin respuesta de la API externa');
      } else {
        throw error;
      }
    }
  }

  /**
   * Marca un registro como exportado
   * @param {string} resourceType - Tipo de recurso
   * @param {string} recordId - ID del registro
   * @param {string} connectorId - ID del conector
   * @param {Object} response - Respuesta de la API
   */
  async markAsExported(resourceType, recordId, connectorId, response) {
    const updateData = {
      lastExportedAt: new Date(),
      exportConfigId: connectorId,
      externalId: response.data?.id?.toString() || null
    };

    switch (resourceType) {
      case 'DOCUMENTO':
        await prisma.documentos_procesados.update({
          where: { id: recordId },
          data: updateData
        });
        break;

      case 'PROVEEDOR':
        await prisma.proveedores.update({
          where: { id: recordId },
          data: updateData
        });
        break;

      case 'PRODUCTO':
      case 'CUENTA_CONTABLE':
      case 'CENTRO_COSTO':
        await prisma.parametros_maestros.update({
          where: { id: recordId },
          data: updateData
        });
        break;
    }
  }

  /**
   * Registra log de exportación
   * @param {string} connectorId - ID del conector
   * @param {string} resourceType - Tipo de recurso
   * @param {string} recordId - ID del registro
   * @param {string} status - Estado (SUCCESS/FAILED)
   * @param {Object} sentData - Datos enviados
   * @param {Object} response - Respuesta de la API
   */
  async logExport(connectorId, resourceType, recordId, status, sentData, response) {
    try {
      await prisma.api_export_logs.create({
        data: {
          connectorId,
          resourceType,
          recordId,
          status,
          sentData: sentData ? JSON.stringify(sentData) : null,
          responseData: response ? JSON.stringify(response.data || response) : null,
          errorMessage: status === 'FAILED' ? response?.error : null,
          exportedAt: new Date()
        }
      });
    } catch (error) {
      console.error('❌ [PUSH] Error logging export:', error.message);
    }
  }

  /**
   * Exporta un documento específico manualmente
   * @param {string} connectorId - ID del conector
   * @param {string} documentoId - ID del documento
   * @returns {Promise<Object>} Resultado
   */
  async exportDocument(connectorId, documentoId) {
    const connector = await this.getConnector(connectorId);

    const documentResource = connector.pushResources.find(
      r => r.resourceType === 'DOCUMENTO'
    );

    if (!documentResource) {
      throw new Error('Este conector no tiene configurado la exportación de documentos');
    }

    const documento = await prisma.documentos_procesados.findFirst({
      where: {
        id: documentoId,
        tenantId: connector.tenantId
      },
      include: {
        documento_lineas: true,
        documento_impuestos: true,
        proveedor: true
      }
    });

    if (!documento) {
      throw new Error('Documento no encontrado');
    }

    // Aplicar mapeo y exportar
    const transformedData = this.applyFieldMapping(
      documento,
      documentResource.fieldMapping
    );

    const response = await this.sendToExternalAPI(
      connector,
      documentResource.endpoint,
      transformedData
    );

    // Marcar como exportado
    await this.markAsExported('DOCUMENTO', documentoId, connectorId, response);

    // Log
    await this.logExport(
      connectorId,
      'DOCUMENTO',
      documentoId,
      'SUCCESS',
      transformedData,
      response
    );

    // Disparar webhook de documento exportado
    try {
      const { triggerDocumentExported } = require('./webhookService');
      const externalId = response.data?.id || response.data?.externalId || 'unknown';
      await triggerDocumentExported(connector.tenantId, documento, externalId);
    } catch (webhookError) {
      console.warn('⚠️  Error disparando webhook document.exported:', webhookError.message);
      // No fallar la exportación por error de webhook
    }

    return {
      success: true,
      documentoId,
      externalId: response.data?.id
    };
  }

  /**
   * Obtiene historial de exportaciones de un documento
   * @param {string} documentoId - ID del documento
   * @returns {Promise<Array>} Logs de exportación
   */
  async getDocumentExportHistory(documentoId) {
    return await prisma.api_export_logs.findMany({
      where: {
        resourceType: 'DOCUMENTO',
        recordId: documentoId
      },
      orderBy: { exportedAt: 'desc' },
      include: {
        connector: {
          select: {
            nombre: true,
            baseUrl: true
          }
        }
      }
    });
  }

  /**
   * Obtiene estadísticas de exportación de un conector
   * @param {string} connectorId - ID del conector
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Object>} Estadísticas
   */
  async getExportStats(connectorId, filters = {}) {
    const { startDate, endDate, resourceType } = filters;

    const where = {
      connectorId
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (startDate || endDate) {
      where.exportedAt = {};
      if (startDate) where.exportedAt.gte = new Date(startDate);
      if (endDate) where.exportedAt.lte = new Date(endDate);
    }

    const [total, successful, failed] = await Promise.all([
      prisma.api_export_logs.count({ where }),
      prisma.api_export_logs.count({ where: { ...where, status: 'SUCCESS' } }),
      prisma.api_export_logs.count({ where: { ...where, status: 'FAILED' } })
    ]);

    const byResourceType = await prisma.api_export_logs.groupBy({
      by: ['resourceType'],
      where,
      _count: { id: true }
    });

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
      byResourceType: byResourceType.map(r => ({
        resourceType: r.resourceType,
        count: r._count.id
      }))
    };
  }
}

module.exports = new ApiPushService();
