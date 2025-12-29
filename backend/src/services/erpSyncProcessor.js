/**
 * Procesador de Sincronizacion ERP
 * Toma registros pendientes de sync_data y los envia al ERP via SQL Server
 */

const { PrismaClient } = require('@prisma/client');
const sql = require('mssql');
const SyncDataService = require('./syncDataService');

const prisma = new PrismaClient();

class ERPSyncProcessor {
  constructor() {
    this.connections = new Map(); // Cache de conexiones por tenant
  }

  /**
   * Obtiene o crea conexion a SQL Server para un tenant
   */
  async getConnection(tenantId) {
    // Verificar cache
    if (this.connections.has(tenantId)) {
      const cached = this.connections.get(tenantId);
      if (cached.connected) {
        return cached;
      }
    }

    // Buscar configuracion de sync para el tenant
    const config = await prisma.sync_configurations.findUnique({
      where: { tenantId },
    });

    if (!config || !config.activo) {
      throw new Error(`No hay configuracion de sync activa para tenant ${tenantId}`);
    }

    // Crear conexion
    const sqlConfig = {
      user: config.sqlServerUser,
      password: config.sqlServerPassword,
      server: config.sqlServerHost,
      port: config.sqlServerPort || 1433,
      database: config.sqlServerDatabase,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 60000,
    };

    try {
      const pool = await sql.connect(sqlConfig);
      this.connections.set(tenantId, pool);
      console.log(`[ERP-SYNC] Conexion establecida para tenant ${tenantId}`);
      return pool;
    } catch (error) {
      console.error(`[ERP-SYNC] Error conectando a SQL Server para tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Procesa registros pendientes
   */
  async processPending(options = {}) {
    const { tenantId, entityType, erpType, limit = 10 } = options;

    console.log(`[ERP-SYNC] Iniciando procesamiento de registros pendientes...`);

    // Obtener registros pendientes
    const pending = await SyncDataService.getPending({
      tenantId,
      entityType,
      erpType,
      limit,
    });

    if (pending.length === 0) {
      console.log(`[ERP-SYNC] No hay registros pendientes`);
      return { processed: 0, success: 0, failed: 0 };
    }

    console.log(`[ERP-SYNC] Encontrados ${pending.length} registros pendientes`);

    let success = 0;
    let failed = 0;

    for (const record of pending) {
      try {
        await this.processRecord(record);
        success++;
      } catch (error) {
        console.error(`[ERP-SYNC] Error procesando ${record.entityType}:${record.entityId}:`, error);
        await SyncDataService.markAsFailed(record.id, error.message);
        failed++;
      }
    }

    console.log(`[ERP-SYNC] Procesamiento completado: ${success} exitos, ${failed} fallos`);

    return { processed: pending.length, success, failed };
  }

  /**
   * Procesa un registro individual
   */
  async processRecord(record) {
    console.log(`[ERP-SYNC] Procesando ${record.entityType}:${record.entityId} para ${record.erpType}`);

    // Marcar como procesando
    await SyncDataService.markAsProcessing(record.id);

    // Obtener configuracion de la entidad si existe
    const entityConfig = await prisma.sync_entity_config.findUnique({
      where: {
        tenantId_entityType_erpType: {
          tenantId: record.tenantId,
          entityType: record.entityType,
          erpType: record.erpType,
        },
      },
    });

    // Procesar segun el tipo de entidad
    let externalId = null;

    switch (record.entityType) {
      case 'PURCHASE_ORDER':
        externalId = await this.processPurchaseOrder(record, entityConfig);
        break;
      case 'RECEPTION':
        externalId = await this.processReception(record, entityConfig);
        break;
      default:
        // Sin handler especifico, usar config generico si existe
        if (entityConfig) {
          externalId = await this.processGeneric(record, entityConfig);
        } else {
          throw new Error(`No hay handler para entityType: ${record.entityType}`);
        }
    }

    // Marcar como completado
    await SyncDataService.markAsCompleted(record.id, externalId);
    console.log(`[ERP-SYNC] Completado ${record.entityType}:${record.entityId} -> ${externalId || 'OK'}`);
  }

  /**
   * Procesa una Orden de Compra
   */
  async processPurchaseOrder(record, entityConfig) {
    const payload = record.payload;
    const tenantId = record.tenantId;
    const erpType = record.erpType;

    // Si hay config, usar las queries definidas
    if (entityConfig && entityConfig.queries?.insert) {
      return await this.executeConfiguredInsert(record, entityConfig);
    }

    // Sin config, usar logica por defecto segun el ERP
    if (erpType === 'AXIOMA') {
      return await this.insertPurchaseOrderAxioma(tenantId, payload);
    } else if (erpType === 'SOFTLAND') {
      return await this.insertPurchaseOrderSoftland(tenantId, payload);
    }

    throw new Error(`No hay handler de PurchaseOrder para ERP: ${erpType}`);
  }

  /**
   * Inserta OC en Axioma (estructura por defecto)
   */
  async insertPurchaseOrderAxioma(tenantId, payload) {
    const pool = await this.getConnection(tenantId);

    // Estructura generica para Axioma
    // Esto debe ser configurado segun la estructura real del cliente
    const query = `
      INSERT INTO dbo.OrdenesCom (
        NumeroOC,
        FechaOC,
        ProveedorCUIT,
        ProveedorNombre,
        Total,
        Estado,
        FechaImportacion
      ) OUTPUT INSERTED.ID VALUES (
        @numero,
        @fecha,
        @proveedorCuit,
        @proveedorNombre,
        @total,
        'PENDIENTE',
        GETDATE()
      )
    `;

    try {
      const result = await pool.request()
        .input('numero', sql.VarChar(50), payload.numero)
        .input('fecha', sql.DateTime, new Date(payload.fecha))
        .input('proveedorCuit', sql.VarChar(20), payload.proveedor?.cuit || '')
        .input('proveedorNombre', sql.VarChar(200), payload.proveedor?.razonSocial || '')
        .input('total', sql.Decimal(18, 2), payload.total || 0)
        .query(query);

      const insertedId = result.recordset?.[0]?.ID;
      console.log(`[ERP-SYNC] OC insertada en Axioma con ID: ${insertedId}`);

      // Insertar items si existen
      if (payload.items && payload.items.length > 0 && insertedId) {
        await this.insertPurchaseOrderItemsAxioma(pool, insertedId, payload.items);
      }

      return insertedId ? String(insertedId) : null;
    } catch (error) {
      console.error(`[ERP-SYNC] Error insertando OC en Axioma:`, error);
      throw error;
    }
  }

  /**
   * Inserta items de OC en Axioma
   */
  async insertPurchaseOrderItemsAxioma(pool, ordenComId, items) {
    const query = `
      INSERT INTO dbo.OrdenesComItems (
        OrdenComID,
        NumeroItem,
        Descripcion,
        CodigoProducto,
        Cantidad,
        PrecioUnitario,
        Subtotal
      ) VALUES (
        @ordenComId,
        @numero,
        @descripcion,
        @codigoProducto,
        @cantidad,
        @precioUnitario,
        @subtotal
      )
    `;

    for (const item of items) {
      try {
        await pool.request()
          .input('ordenComId', sql.Int, ordenComId)
          .input('numero', sql.Int, item.numero || 0)
          .input('descripcion', sql.VarChar(500), item.descripcion || '')
          .input('codigoProducto', sql.VarChar(50), item.codigoProducto || '')
          .input('cantidad', sql.Decimal(18, 3), item.cantidad || 0)
          .input('precioUnitario', sql.Decimal(18, 4), item.precioUnitario || 0)
          .input('subtotal', sql.Decimal(18, 2), item.subtotal || 0)
          .query(query);
      } catch (error) {
        console.error(`[ERP-SYNC] Error insertando item de OC:`, error);
        // Continuar con los demas items
      }
    }
  }

  /**
   * Inserta OC en Softland (estructura por defecto)
   */
  async insertPurchaseOrderSoftland(tenantId, payload) {
    // Softland tiene estructura diferente
    // Implementar segun estructura del cliente
    console.log(`[ERP-SYNC] Softland sync not yet implemented`);
    return null;
  }

  /**
   * Procesa una Recepcion
   */
  async processReception(record, entityConfig) {
    // Implementar segun necesidad
    console.log(`[ERP-SYNC] Reception sync not yet implemented`);
    return null;
  }

  /**
   * Procesa un registro usando la configuracion generica
   */
  async processGeneric(record, entityConfig) {
    if (!entityConfig.queries?.insert) {
      throw new Error('No hay query INSERT configurada');
    }

    return await this.executeConfiguredInsert(record, entityConfig);
  }

  /**
   * Ejecuta un INSERT usando la query configurada
   */
  async executeConfiguredInsert(record, entityConfig) {
    const pool = await this.getConnection(record.tenantId);
    const payload = record.payload;
    const fieldMapping = entityConfig.fieldMapping?.hub_to_erp || {};
    const insertQuery = entityConfig.queries.insert;

    // Construir parametros segun mapping
    const request = pool.request();

    for (const [hubField, erpField] of Object.entries(fieldMapping)) {
      const value = this.getNestedValue(payload, hubField);
      request.input(erpField, value);
    }

    try {
      const result = await request.query(insertQuery);
      const insertedId = result.recordset?.[0]?.ID || result.recordset?.[0]?.id;
      return insertedId ? String(insertedId) : null;
    } catch (error) {
      console.error(`[ERP-SYNC] Error ejecutando query configurada:`, error);
      throw error;
    }
  }

  /**
   * Obtiene valor anidado de un objeto
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Cierra todas las conexiones
   */
  async closeConnections() {
    for (const [tenantId, pool] of this.connections) {
      try {
        await pool.close();
        console.log(`[ERP-SYNC] Conexion cerrada para tenant ${tenantId}`);
      } catch (error) {
        console.error(`[ERP-SYNC] Error cerrando conexion para tenant ${tenantId}:`, error);
      }
    }
    this.connections.clear();
  }
}

// Singleton
const erpSyncProcessor = new ERPSyncProcessor();

module.exports = erpSyncProcessor;
