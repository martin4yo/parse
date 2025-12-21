/**
 * API Pull Service
 *
 * Servicio para importar datos desde APIs externas hacia Parse.
 * Extiende de ApiConnectorService para heredar funcionalidades base.
 *
 * Funcionalidades:
 * - Sincronización PULL desde recursos configurados
 * - Transformación y mapeo de datos
 * - Validación opcional con staging
 * - Logging de sincronizaciones
 * - Manejo de duplicados y errores
 */

const ApiConnectorService = require('./apiConnectorService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ApiPullService extends ApiConnectorService {
  constructor(configId) {
    super(configId);
  }

  /**
   * Ejecuta una sincronización PULL completa
   * @param {string} resourceId - ID del recurso a sincronizar (opcional, si null sincroniza todos)
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async executePull(resourceId = null) {
    console.log(`\n🔄 Iniciando PULL desde: ${this.config.nombre}`);
    const startTime = Date.now();

    // Verificar que la configuración soporte PULL
    if (this.config.direction !== 'PULL' && this.config.direction !== 'BIDIRECTIONAL') {
      throw new Error(`Conector no configurado para PULL: ${this.config.direction}`);
    }

    const { pullResources } = this.config;
    if (!pullResources || pullResources.length === 0) {
      throw new Error('No hay recursos PULL configurados');
    }

    // Filtrar recursos a sincronizar
    const resourcesToSync = resourceId
      ? pullResources.filter(r => r.id === resourceId)
      : pullResources.filter(r => r.activo !== false);

    if (resourcesToSync.length === 0) {
      throw new Error(`Recurso no encontrado o inactivo: ${resourceId}`);
    }

    // Resultados agregados
    const results = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      failedRecords: 0,
      stagedRecords: 0,
      errors: [],
      resourceResults: []
    };

    // Sincronizar cada recurso
    for (const resource of resourcesToSync) {
      try {
        console.log(`\n📥 Sincronizando recurso: ${resource.nombre}`);
        const resourceResult = await this.syncResource(resource);
        results.resourceResults.push(resourceResult);

        // Agregar a totales
        results.totalRecords += resourceResult.recordsFound;
        results.importedRecords += resourceResult.recordsImported;
        results.failedRecords += resourceResult.recordsFailed;
        results.stagedRecords += resourceResult.recordsStaged || 0;

      } catch (error) {
        console.error(`❌ Error sincronizando recurso ${resource.nombre}:`, error.message);
        results.success = false;
        results.errors.push({
          resource: resource.nombre,
          error: error.message
        });

        // Registrar error en log
        await this.logPullExecution(resource.id, 'FAILED', {
          recordsFound: 0,
          recordsImported: 0,
          recordsFailed: 0,
          errorDetails: { message: error.message, stack: error.stack }
        });
      }
    }

    const durationMs = Date.now() - startTime;

    // Actualizar estado del conector
    const finalStatus = results.success ? 'SUCCESS' : (results.importedRecords > 0 ? 'PARTIAL' : 'FAILED');
    await this.updateLastSync('PULL', finalStatus);

    console.log(`\n✅ PULL completado en ${durationMs}ms`);
    console.log(`📊 Total: ${results.totalRecords} | Importados: ${results.importedRecords} | Fallidos: ${results.failedRecords} | En staging: ${results.stagedRecords}`);

    // Disparar webhooks según el resultado
    try {
      const { triggerSyncCompleted, triggerSyncFailed } = require('./webhookService');

      if (finalStatus === 'SUCCESS' || finalStatus === 'PARTIAL') {
        // Sincronización exitosa o parcial
        await triggerSyncCompleted(this.connector.tenantId, this.connector.id, {
          success: results.importedRecords,
          failed: results.failedRecords,
          staged: results.stagedRecords
        });
      } else {
        // Sincronización fallida
        const errorMsg = results.errors.length > 0
          ? results.errors.map(e => e.message).join('; ')
          : 'Fallo en la sincronización';
        await triggerSyncFailed(this.connector.tenantId, this.connector.id, new Error(errorMsg));
      }
    } catch (webhookError) {
      console.warn('⚠️  Error disparando webhooks sync:', webhookError.message);
      // No fallar la sincronización por error de webhook
    }

    return { ...results, durationMs };
  }

  /**
   * Sincroniza un recurso específico
   * @param {Object} resource - Configuración del recurso
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncResource(resource) {
    const {
      id: resourceId,
      nombre,
      endpoint,
      method = 'GET',
      tipoRecurso,
      queryParams = {},
      paginationConfig = null,
      dataPath = null
    } = resource;

    const startTime = Date.now();
    let allRecords = [];

    // Si tiene paginación, hacer múltiples requests
    if (paginationConfig && paginationConfig.enabled) {
      allRecords = await this.fetchPaginatedData(endpoint, method, queryParams, paginationConfig, dataPath);
    } else {
      // Request único
      const response = await this.makeRequest({
        method,
        endpoint,
        queryParams
      });

      // Extraer datos según dataPath (si está configurado)
      allRecords = dataPath ? this.getNestedValue(response, dataPath) : response;

      // Asegurar que es un array
      if (!Array.isArray(allRecords)) {
        allRecords = [allRecords];
      }
    }

    console.log(`📦 Registros obtenidos: ${allRecords.length}`);

    // Procesar cada registro
    const results = {
      resourceId,
      resourceName: nombre,
      recordsFound: allRecords.length,
      recordsImported: 0,
      recordsFailed: 0,
      recordsStaged: 0,
      errors: []
    };

    for (const record of allRecords) {
      try {
        // Transformar datos según field mapping
        const transformedData = this.applyFieldMapping(
          record,
          this.config.pullFieldMapping || []
        );

        // Si requiere validación, guardar en staging
        if (this.config.requireValidation) {
          await this.saveToStaging(resourceId, record, transformedData);
          results.recordsStaged++;
        } else {
          // Importar directamente
          await this.importRecord(tipoRecurso, transformedData);
          results.recordsImported++;
        }

      } catch (error) {
        console.error(`⚠️ Error procesando registro:`, error.message);
        results.recordsFailed++;
        results.errors.push({
          record: record.id || JSON.stringify(record).substring(0, 50),
          error: error.message
        });
      }
    }

    const durationMs = Date.now() - startTime;

    // Registrar ejecución en log
    await this.logPullExecution(resourceId, results.recordsFailed === 0 ? 'SUCCESS' : 'PARTIAL', {
      recordsFound: results.recordsFound,
      recordsImported: results.recordsImported,
      recordsFailed: results.recordsFailed,
      durationMs
    });

    return results;
  }

  /**
   * Obtiene datos paginados de un endpoint
   * @param {string} endpoint - Endpoint base
   * @param {string} method - Método HTTP
   * @param {Object} queryParams - Parámetros base
   * @param {Object} paginationConfig - Configuración de paginación
   * @param {string} dataPath - Ruta donde están los datos en la respuesta
   * @returns {Promise<Array>} Todos los registros obtenidos
   */
  async fetchPaginatedData(endpoint, method, queryParams, paginationConfig, dataPath) {
    const {
      type, // 'PAGE_NUMBER', 'OFFSET_LIMIT', 'CURSOR'
      pageParam = 'page',
      pageSizeParam = 'pageSize',
      pageSize = 100,
      offsetParam = 'offset',
      limitParam = 'limit',
      cursorParam = 'cursor',
      totalPagesPath = 'totalPages',
      hasNextPagePath = 'hasNextPage',
      nextCursorPath = 'nextCursor',
      maxPages = 100 // Límite de seguridad
    } = paginationConfig;

    let allRecords = [];
    let currentPage = 1;
    let hasMore = true;
    let cursor = null;

    while (hasMore && currentPage <= maxPages) {
      const params = { ...queryParams };

      // Configurar parámetros según tipo de paginación
      if (type === 'PAGE_NUMBER') {
        params[pageParam] = currentPage;
        params[pageSizeParam] = pageSize;
      } else if (type === 'OFFSET_LIMIT') {
        params[offsetParam] = (currentPage - 1) * pageSize;
        params[limitParam] = pageSize;
      } else if (type === 'CURSOR' && cursor) {
        params[cursorParam] = cursor;
      }

      console.log(`📄 Página ${currentPage}...`);

      const response = await this.makeRequest({
        method,
        endpoint,
        queryParams: params
      });

      // Extraer datos según dataPath
      const pageData = dataPath ? this.getNestedValue(response, dataPath) : response;
      const records = Array.isArray(pageData) ? pageData : [pageData];

      allRecords = allRecords.concat(records);

      // Determinar si hay más páginas
      if (type === 'PAGE_NUMBER') {
        const totalPages = this.getNestedValue(response, totalPagesPath);
        hasMore = totalPages ? currentPage < totalPages : records.length === pageSize;
      } else if (type === 'OFFSET_LIMIT') {
        hasMore = records.length === pageSize;
      } else if (type === 'CURSOR') {
        const hasNextPage = this.getNestedValue(response, hasNextPagePath);
        cursor = this.getNestedValue(response, nextCursorPath);
        hasMore = hasNextPage && cursor;
      }

      currentPage++;

      // Pequeña pausa entre páginas para no sobrecargar
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (currentPage > maxPages) {
      console.warn(`⚠️ Se alcanzó el límite máximo de páginas (${maxPages})`);
    }

    return allRecords;
  }

  /**
   * Guarda un registro en la tabla de staging para validación manual
   * @param {string} resourceId - ID del recurso
   * @param {Object} rawData - Datos originales
   * @param {Object} transformedData - Datos transformados
   */
  async saveToStaging(resourceId, rawData, transformedData) {
    // Validar datos transformados
    const validation = this.validateData(transformedData);

    await prisma.api_sync_staging.create({
      data: {
        configId: this.configId,
        resourceId,
        tenantId: this.config.tenantId,
        rawData,
        transformedData,
        validationStatus: validation.isValid ? 'VALID' : 'INVALID',
        validationErrors: validation.errors.length > 0 ? validation.errors : null,
        syncBatchId: null // Se asignará cuando se procese el batch
      }
    });
  }

  /**
   * Importa un registro transformado a la base de datos
   * @param {string} tipoRecurso - Tipo de recurso ('DOCUMENTO', 'PROVEEDOR', 'PRODUCTO', etc.)
   * @param {Object} data - Datos transformados
   */
  async importRecord(tipoRecurso, data) {
    // Validar datos antes de importar
    const validation = this.validateData(data);
    if (!validation.isValid) {
      throw new Error(`Validación falló: ${JSON.stringify(validation.errors)}`);
    }

    switch (tipoRecurso) {
      case 'DOCUMENTO':
        await this.importDocumento(data);
        break;

      case 'PROVEEDOR':
        await this.importProveedor(data);
        break;

      case 'PRODUCTO':
        await this.importProductro(data);
        break;

      case 'CUENTA_CONTABLE':
        await this.importCuentaContable(data);
        break;

      case 'CENTRO_COSTO':
        await this.importCentroCosto(data);
        break;

      default:
        throw new Error(`Tipo de recurso no soportado: ${tipoRecurso}`);
    }
  }

  /**
   * Importa un documento procesado
   * @param {Object} data - Datos del documento
   */
  async importDocumento(data) {
    const {
      externalSystemId,
      tipoDocumento,
      numeroComprobante,
      fechaEmision,
      cuitProveedor,
      razonSocialProveedor,
      importeTotal,
      archivoUrl,
      estadoProcesamiento = 'procesado',
      lineas = [],
      impuestos = []
    } = data;

    // Verificar duplicados por externalSystemId
    if (externalSystemId) {
      const existente = await prisma.documentos_procesados.findFirst({
        where: {
          tenantId: this.config.tenantId,
          externalSystemId
        }
      });

      if (existente) {
        console.log(`⏭️ Documento duplicado (externalSystemId: ${externalSystemId}), saltando...`);
        return;
      }
    }

    // TODO: Descargar archivo desde archivoUrl si está presente
    // Por ahora solo creamos el registro sin archivo

    // Crear documento
    const documento = await prisma.documentos_procesados.create({
      data: {
        tenantId: this.config.tenantId,
        externalSystemId,
        nombreArchivo: `import_${Date.now()}.pdf`,
        rutaArchivo: archivoUrl || null,
        estadoProcesamiento,
        tipoDocumento,
        numeroComprobante,
        fechaEmision: fechaEmision ? new Date(fechaEmision) : null,
        cuitProveedor,
        razonSocialProveedor,
        importeTotal: importeTotal ? parseFloat(importeTotal) : null,
        lastExportedAt: null,
        exportConfigId: this.configId
      }
    });

    console.log(`✅ Documento importado: ${documento.id}`);

    // Importar líneas si existen
    if (lineas.length > 0) {
      for (const linea of lineas) {
        await prisma.documento_lineas.create({
          data: {
            documentoId: documento.id,
            tenantId: this.config.tenantId,
            numero: linea.numero || 1,
            descripcion: linea.descripcion,
            cantidad: linea.cantidad ? parseFloat(linea.cantidad) : null,
            precioUnitario: linea.precioUnitario ? parseFloat(linea.precioUnitario) : null,
            subtotal: linea.subtotal ? parseFloat(linea.subtotal) : null,
            totalLinea: linea.totalLinea ? parseFloat(linea.totalLinea) : null,
            cuentaContable: linea.cuentaContable || null
          }
        });
      }
      console.log(`  ↳ ${lineas.length} líneas importadas`);
    }

    // Importar impuestos si existen
    if (impuestos.length > 0) {
      for (const impuesto of impuestos) {
        await prisma.documento_impuestos.create({
          data: {
            documentoId: documento.id,
            tenantId: this.config.tenantId,
            tipoImpuesto: impuesto.tipoImpuesto,
            baseImponible: impuesto.baseImponible ? parseFloat(impuesto.baseImponible) : null,
            alicuota: impuesto.alicuota ? parseFloat(impuesto.alicuota) : null,
            importe: impuesto.importe ? parseFloat(impuesto.importe) : null,
            cuentaContable: impuesto.cuentaContable || null
          }
        });
      }
      console.log(`  ↳ ${impuestos.length} impuestos importados`);
    }
  }

  /**
   * Importa un proveedor a parámetros maestros
   * @param {Object} data - Datos del proveedor
   */
  async importProveedor(data) {
    const { codigo, nombre, cuit, descripcion } = data;

    // Verificar duplicados
    const existente = await prisma.parametros_maestros.findFirst({
      where: {
        tenantId: this.config.tenantId,
        tipoCampo: 'proveedor',
        codigo
      }
    });

    if (existente) {
      console.log(`⏭️ Proveedor duplicado (${codigo}), saltando...`);
      return;
    }

    await prisma.parametros_maestros.create({
      data: {
        tenantId: this.config.tenantId,
        tipoCampo: 'proveedor',
        codigo,
        nombre,
        descripcion: descripcion || cuit || null,
        activo: true
      }
    });

    console.log(`✅ Proveedor importado: ${codigo} - ${nombre}`);
  }

  /**
   * Importa un producto a parámetros maestros
   * @param {Object} data - Datos del producto
   */
  async importProductro(data) {
    const { codigo, nombre, descripcion } = data;

    const existente = await prisma.parametros_maestros.findFirst({
      where: {
        tenantId: this.config.tenantId,
        tipoCampo: 'producto',
        codigo
      }
    });

    if (existente) {
      console.log(`⏭️ Producto duplicado (${codigo}), saltando...`);
      return;
    }

    await prisma.parametros_maestros.create({
      data: {
        tenantId: this.config.tenantId,
        tipoCampo: 'producto',
        codigo,
        nombre,
        descripcion,
        activo: true
      }
    });

    console.log(`✅ Producto importado: ${codigo} - ${nombre}`);
  }

  /**
   * Importa una cuenta contable
   * @param {Object} data - Datos de la cuenta
   */
  async importCuentaContable(data) {
    const { codigo, nombre, descripcion } = data;

    const existente = await prisma.parametros_maestros.findFirst({
      where: {
        tenantId: this.config.tenantId,
        tipoCampo: 'cuenta_contable',
        codigo
      }
    });

    if (existente) {
      console.log(`⏭️ Cuenta contable duplicada (${codigo}), saltando...`);
      return;
    }

    await prisma.parametros_maestros.create({
      data: {
        tenantId: this.config.tenantId,
        tipoCampo: 'cuenta_contable',
        codigo,
        nombre,
        descripcion,
        activo: true
      }
    });

    console.log(`✅ Cuenta contable importada: ${codigo} - ${nombre}`);
  }

  /**
   * Importa un centro de costo
   * @param {Object} data - Datos del centro de costo
   */
  async importCentroCosto(data) {
    const { codigo, nombre, descripcion } = data;

    const existente = await prisma.parametros_maestros.findFirst({
      where: {
        tenantId: this.config.tenantId,
        tipoCampo: 'centro_costo',
        codigo
      }
    });

    if (existente) {
      console.log(`⏭️ Centro de costo duplicado (${codigo}), saltando...`);
      return;
    }

    await prisma.parametros_maestros.create({
      data: {
        tenantId: this.config.tenantId,
        tipoCampo: 'centro_costo',
        codigo,
        nombre,
        descripcion,
        activo: true
      }
    });

    console.log(`✅ Centro de costo importado: ${codigo} - ${nombre}`);
  }

  /**
   * Registra la ejecución de un PULL en el log
   * @param {string} resourceId - ID del recurso
   * @param {string} status - Estado ('SUCCESS', 'FAILED', 'PARTIAL')
   * @param {Object} details - Detalles de la ejecución
   */
  async logPullExecution(resourceId, status, details) {
    await prisma.api_pull_logs.create({
      data: {
        configId: this.configId,
        tenantId: this.config.tenantId,
        resourceId,
        status,
        recordsFound: details.recordsFound || 0,
        recordsImported: details.recordsImported || 0,
        recordsFailed: details.recordsFailed || 0,
        durationMs: details.durationMs || null,
        errorDetails: details.errorDetails || null,
        apiResponse: null // Podría guardarse para debugging
      }
    });
  }

  /**
   * Procesa registros en staging (valida y aprueba importación)
   * @param {Array<string>} stagingIds - IDs de registros en staging a procesar
   * @param {string} validatedBy - ID del usuario que valida
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processStagingBatch(stagingIds, validatedBy) {
    console.log(`\n✅ Procesando ${stagingIds.length} registros de staging...`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const stagingId of stagingIds) {
      try {
        const staging = await prisma.api_sync_staging.findUnique({
          where: { id: stagingId }
        });

        if (!staging) {
          throw new Error(`Registro de staging no encontrado: ${stagingId}`);
        }

        if (staging.validationStatus !== 'VALID') {
          throw new Error(`Registro no está validado: ${staging.validationStatus}`);
        }

        // Obtener configuración del recurso
        const config = await prisma.api_connector_configs.findUnique({
          where: { id: staging.configId }
        });

        const resource = config.pullResources.find(r => r.id === staging.resourceId);
        if (!resource) {
          throw new Error(`Recurso no encontrado: ${staging.resourceId}`);
        }

        // Importar registro
        await this.importRecord(resource.tipoRecurso, staging.transformedData);

        // Marcar como procesado
        await prisma.api_sync_staging.update({
          where: { id: stagingId },
          data: {
            validatedBy,
            validatedAt: new Date()
          }
        });

        results.success++;

      } catch (error) {
        console.error(`❌ Error procesando ${stagingId}:`, error.message);
        results.failed++;
        results.errors.push({
          stagingId,
          error: error.message
        });
      }
    }

    console.log(`✅ Procesamiento completado: ${results.success} éxitos, ${results.failed} fallos`);
    return results;
  }
}

module.exports = ApiPullService;
