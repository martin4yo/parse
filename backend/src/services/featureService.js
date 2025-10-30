const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * FeatureService
 *
 * Servicio para gestionar features por plan de tenant.
 * Permite verificar si un tenant tiene acceso a una funcionalidad específica
 * basándose en su plan asignado.
 */
class FeatureService {

  /**
   * Verifica si un tenant tiene un feature habilitado
   *
   * @param {string} tenantId - ID del tenant
   * @param {string} featureName - Nombre del feature a verificar
   * @returns {Promise<boolean>} - true si el tenant tiene el feature
   */
  async isEnabled(tenantId, featureName) {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        include: {
          planes: {
            include: {
              plan_features: true
            }
          }
        }
      });

      if (!tenant) {
        console.log(`⚠️  Tenant ${tenantId} no encontrado`);
        return false;
      }

      if (!tenant.planes) {
        console.log(`⚠️  Tenant ${tenantId} no tiene plan asignado`);
        return false;
      }

      const hasFeature = tenant.planes.plan_features.some(
        f => f.feature === featureName
      );

      console.log(`🔍 Tenant ${tenantId} (${tenant.planes.codigo}) - ${featureName}: ${hasFeature ? '✅' : '❌'}`);

      return hasFeature;

    } catch (error) {
      console.error(`❌ Error verificando feature ${featureName} para tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene todos los features del plan del tenant
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Array>} - Array de features con sus configuraciones
   */
  async getTenantFeatures(tenantId) {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        include: {
          planes: {
            include: {
              plan_features: true
            }
          }
        }
      });

      if (!tenant?.planes) {
        console.log(`⚠️  Tenant ${tenantId} no tiene plan asignado`);
        return [];
      }

      return tenant.planes.plan_features.map(f => ({
        feature: f.feature,
        config: f.config || {},
        planNombre: tenant.planes.nombre,
        planCodigo: tenant.planes.codigo
      }));

    } catch (error) {
      console.error(`❌ Error obteniendo features para tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Obtiene la configuración de un feature específico
   *
   * @param {string} tenantId - ID del tenant
   * @param {string} featureName - Nombre del feature
   * @returns {Promise<Object|null>} - Configuración del feature o null
   */
  async getFeatureConfig(tenantId, featureName) {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        include: {
          planes: {
            include: {
              plan_features: true
            }
          }
        }
      });

      if (!tenant?.planes) {
        return null;
      }

      const feature = tenant.planes.plan_features.find(
        f => f.feature === featureName
      );

      return feature ? feature.config : null;

    } catch (error) {
      console.error(`❌ Error obteniendo config de feature ${featureName}:`, error);
      return null;
    }
  }

  /**
   * Obtiene información del plan del tenant
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Object|null>} - Información del plan
   */
  async getTenantPlan(tenantId) {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        include: {
          planes: {
            include: {
              plan_features: true
            }
          }
        }
      });

      if (!tenant?.planes) {
        return null;
      }

      const plan = tenant.planes;

      return {
        id: plan.id,
        codigo: plan.codigo,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precio: plan.precio,
        featuresCount: plan.plan_features.length,
        features: plan.plan_features.map(f => f.feature)
      };

    } catch (error) {
      console.error(`❌ Error obteniendo plan para tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Lista todos los planes disponibles con sus features
   *
   * @returns {Promise<Array>} - Array de planes con features
   */
  async getAllPlans() {
    try {
      const planes = await prisma.planes.findMany({
        where: { activo: true },
        include: {
          plan_features: true
        },
        orderBy: { orden: 'asc' }
      });

      return planes.map(plan => ({
        id: plan.id,
        codigo: plan.codigo,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precio: plan.precio,
        orden: plan.orden,
        features: plan.plan_features.map(f => ({
          feature: f.feature,
          config: f.config
        }))
      }));

    } catch (error) {
      console.error('❌ Error obteniendo planes:', error);
      return [];
    }
  }

  /**
   * Verifica si un tenant puede usar extracción con pipeline
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>}
   */
  async canUsePipeline(tenantId) {
    return await this.isEnabled(tenantId, 'AI_PIPELINE_EXTRACTION');
  }

  /**
   * Verifica si un tenant puede configurar API keys personalizadas
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>}
   */
  async canUseCustomAPIKeys(tenantId) {
    return await this.isEnabled(tenantId, 'AI_CUSTOM_API_KEYS');
  }

  /**
   * Obtiene el límite de documentos por mes según el plan
   *
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<number>} - Límite de documentos o 0 si no aplica
   */
  async getDocumentLimit(tenantId) {
    try {
      // Intentar obtener de AI_PIPELINE_EXTRACTION
      let config = await this.getFeatureConfig(tenantId, 'AI_PIPELINE_EXTRACTION');
      if (config?.maxDocumentosPorMes) {
        return config.maxDocumentosPorMes;
      }

      // Intentar obtener de AI_SIMPLE_EXTRACTION
      config = await this.getFeatureConfig(tenantId, 'AI_SIMPLE_EXTRACTION');
      if (config?.maxDocumentosPorMes) {
        return config.maxDocumentosPorMes;
      }

      return 0; // Sin límite

    } catch (error) {
      console.error(`❌ Error obteniendo límite de documentos:`, error);
      return 0;
    }
  }
}

module.exports = new FeatureService();
