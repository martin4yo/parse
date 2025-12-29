/**
 * Servicio de Sincronizacion Generica
 * Maneja la cola de datos entre Hub y ERPs
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

class SyncDataService {
  /**
   * Encolar datos para sincronizacion
   * @param {Object} params - Parametros del registro
   * @returns {Promise<Object>} Resultado de la operacion
   */
  static async enqueue({
    tenantId,
    entityType,
    entityId,
    erpType,
    payload,
    direction = 'OUT',
    sourceSystem = 'HUB',
    sourceUserId = null
  }) {
    // Calcular hash del payload
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    // Buscar si ya existe
    const existing = await prisma.sync_data.findUnique({
      where: {
        tenantId_entityType_entityId_erpType: {
          tenantId,
          entityType,
          entityId,
          erpType
        }
      }
    });

    if (existing) {
      // Si el payload es igual y ya esta completado, no hacer nada
      if (existing.payloadHash === payloadHash && existing.status === 'COMPLETED') {
        return { action: 'SKIP', reason: 'No changes detected', id: existing.id };
      }

      // Actualizar registro existente
      const updated = await prisma.sync_data.update({
        where: { id: existing.id },
        data: {
          payload,
          payloadHash,
          version: existing.version + 1,
          status: 'PENDING',
          errorMessage: null,
          retryCount: 0,
          updatedAt: new Date()
        }
      });

      console.log(`[SYNC-DATA] Updated ${entityType}:${entityId} for ${erpType} (v${updated.version})`);
      return { action: 'UPDATE', id: updated.id, version: updated.version };
    }

    // Crear nuevo registro
    const created = await prisma.sync_data.create({
      data: {
        tenantId,
        entityType,
        entityId,
        erpType,
        payload,
        payloadHash,
        direction,
        sourceSystem,
        sourceUserId,
        status: 'PENDING'
      }
    });

    console.log(`[SYNC-DATA] Created ${entityType}:${entityId} for ${erpType}`);
    return { action: 'CREATE', id: created.id };
  }

  /**
   * Obtener registros pendientes para procesar
   * @param {Object} params - Filtros
   * @returns {Promise<Array>} Registros pendientes
   */
  static async getPending({ tenantId, entityType, erpType, limit = 100 }) {
    const where = {
      status: 'PENDING',
      retryCount: { lt: 3 }
    };

    if (tenantId) where.tenantId = tenantId;
    if (entityType) where.entityType = entityType;
    if (erpType) where.erpType = erpType;

    return prisma.sync_data.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        config: true,
        tenants: {
          select: { id: true, nombre: true, slug: true }
        }
      }
    });
  }

  /**
   * Marcar registro como procesando
   * @param {string} id - ID del registro
   * @returns {Promise<Object>} Registro actualizado
   */
  static async markAsProcessing(id) {
    return prisma.sync_data.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        updatedAt: new Date()
      }
    });
  }

  /**
   * Marcar registro como completado
   * @param {string} id - ID del registro
   * @param {string} externalId - ID asignado por el sistema externo
   * @returns {Promise<Object>} Registro actualizado
   */
  static async markAsCompleted(id, externalId = null) {
    return prisma.sync_data.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        externalId,
        syncedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Marcar registro como fallido
   * @param {string} id - ID del registro
   * @param {string} errorMessage - Mensaje de error
   * @returns {Promise<Object>} Registro actualizado
   */
  static async markAsFailed(id, errorMessage) {
    const record = await prisma.sync_data.findUnique({ where: { id } });

    if (!record) {
      throw new Error(`Sync record not found: ${id}`);
    }

    return prisma.sync_data.update({
      where: { id },
      data: {
        status: record.retryCount >= 2 ? 'FAILED' : 'PENDING',
        errorMessage,
        retryCount: record.retryCount + 1,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Obtener estado de un registro
   * @param {string} tenantId - ID del tenant
   * @param {string} entityType - Tipo de entidad
   * @param {string} entityId - ID de la entidad
   * @param {string} erpType - Tipo de ERP (opcional)
   * @returns {Promise<Object|null>} Estado del registro
   */
  static async getStatus(tenantId, entityType, entityId, erpType = null) {
    const where = { tenantId, entityType, entityId };
    if (erpType) where.erpType = erpType;

    return prisma.sync_data.findFirst({
      where,
      select: {
        id: true,
        erpType: true,
        status: true,
        externalId: true,
        syncedAt: true,
        errorMessage: true,
        retryCount: true,
        version: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Obtener todos los estados de sincronizacion de una entidad
   * @param {string} tenantId - ID del tenant
   * @param {string} entityType - Tipo de entidad
   * @param {string} entityId - ID de la entidad
   * @returns {Promise<Array>} Estados por ERP
   */
  static async getAllStatuses(tenantId, entityType, entityId) {
    return prisma.sync_data.findMany({
      where: { tenantId, entityType, entityId },
      select: {
        id: true,
        erpType: true,
        status: true,
        externalId: true,
        syncedAt: true,
        errorMessage: true,
        retryCount: true,
        version: true,
        updatedAt: true
      },
      orderBy: { erpType: 'asc' }
    });
  }

  /**
   * Obtener estadisticas de sincronizacion
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Array>} Estadisticas agrupadas
   */
  static async getStats(tenantId) {
    const stats = await prisma.sync_data.groupBy({
      by: ['entityType', 'erpType', 'status'],
      where: { tenantId },
      _count: true
    });

    // Reorganizar para mejor lectura
    const result = {};
    for (const stat of stats) {
      const key = `${stat.entityType}-${stat.erpType}`;
      if (!result[key]) {
        result[key] = {
          entityType: stat.entityType,
          erpType: stat.erpType,
          counts: {}
        };
      }
      result[key].counts[stat.status] = stat._count;
    }

    return Object.values(result);
  }

  /**
   * Obtener historial de sincronizacion
   * @param {Object} params - Filtros
   * @returns {Promise<Array>} Registros
   */
  static async getHistory({ tenantId, entityType, erpType, status, limit = 50, offset = 0 }) {
    const where = { tenantId };
    if (entityType) where.entityType = entityType;
    if (erpType) where.erpType = erpType;
    if (status) where.status = status;

    const [records, total] = await Promise.all([
      prisma.sync_data.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          erpType: true,
          status: true,
          externalId: true,
          syncedAt: true,
          errorMessage: true,
          retryCount: true,
          version: true,
          sourceSystem: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.sync_data.count({ where })
    ]);

    return { records, total, limit, offset };
  }

  /**
   * Reintentar registros fallidos
   * @param {string} tenantId - ID del tenant
   * @param {string} entityType - Tipo de entidad (opcional)
   * @returns {Promise<Object>} Resultado
   */
  static async retryFailed(tenantId, entityType = null) {
    const where = {
      tenantId,
      status: 'FAILED'
    };
    if (entityType) where.entityType = entityType;

    const result = await prisma.sync_data.updateMany({
      where,
      data: {
        status: 'PENDING',
        retryCount: 0,
        errorMessage: null,
        updatedAt: new Date()
      }
    });

    console.log(`[SYNC-DATA] Reset ${result.count} failed records to PENDING`);
    return { updated: result.count };
  }

  /**
   * Obtener registro completo con payload
   * @param {string} id - ID del registro
   * @returns {Promise<Object|null>} Registro completo
   */
  static async getById(id) {
    return prisma.sync_data.findUnique({
      where: { id },
      include: {
        config: true,
        tenants: {
          select: { id: true, nombre: true, slug: true }
        }
      }
    });
  }

  /**
   * Eliminar registro (soft delete o hard delete)
   * @param {string} id - ID del registro
   * @returns {Promise<Object>} Registro eliminado
   */
  static async delete(id) {
    return prisma.sync_data.delete({
      where: { id }
    });
  }
}

module.exports = SyncDataService;
