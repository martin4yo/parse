const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PLANES_CONFIG = [
  {
    codigo: 'Common',
    nombre: 'Plan Common',
    descripcion: 'Plan básico para pequeñas empresas con extracción simple de documentos',
    precio: 0,
    orden: 1,
    features: [
      {
        feature: 'AI_SIMPLE_EXTRACTION',
        config: {
          modelo: 'gemini-flash',
          maxDocumentosPorMes: 100,
          descripcion: 'Extracción básica con un prompt universal usando Gemini Flash'
        }
      },
      {
        feature: 'MANUAL_CORRECTION',
        config: {
          descripcion: 'Corrección manual de datos extraídos'
        }
      }
    ]
  },

  {
    codigo: 'Uncommon',
    nombre: 'Plan Uncommon',
    descripcion: 'Plan intermedio con mejores capacidades de IA y extracción detallada',
    precio: 99.99,
    orden: 2,
    features: [
      {
        feature: 'AI_SIMPLE_EXTRACTION',
        config: {
          modelo: 'claude-haiku',
          maxDocumentosPorMes: 500,
          descripcion: 'Extracción con Claude Haiku (mejor precisión que Gemini)'
        }
      },
      {
        feature: 'AI_LINE_ITEMS_EXTRACTION',
        config: {
          descripcion: 'Extracción detallada de line items de facturas'
        }
      },
      {
        feature: 'MANUAL_CORRECTION',
        config: {}
      },
      {
        feature: 'AUTO_ASSOCIATION',
        config: {
          descripcion: 'Asociación automática de comprobantes con cupones de tarjeta'
        }
      }
    ]
  },

  {
    codigo: 'Rare',
    nombre: 'Plan Rare',
    descripcion: 'Plan avanzado con pipeline de IA especializado para máxima precisión',
    precio: 299.99,
    orden: 3,
    features: [
      {
        feature: 'AI_PIPELINE_EXTRACTION',
        config: {
          clasificador: 'gemini-flash',
          extractores: {
            'FACTURA_A': 'claude-sonnet',
            'FACTURA_B': 'claude-sonnet',
            'FACTURA_C': 'claude-haiku',
            'DESPACHO_ADUANA': 'claude-sonnet',
            'COMPROBANTE_IMPORTACION': 'claude-sonnet',
            'NOTA_CREDITO': 'claude-haiku',
            'TICKET': 'gemini-flash'
          },
          maxDocumentosPorMes: 2000,
          descripcion: 'Pipeline de 2 pasos: clasificador + extractor especializado'
        }
      },
      {
        feature: 'AI_LINE_ITEMS_EXTRACTION',
        config: {
          descripcion: 'Extracción detallada de line items con validación'
        }
      },
      {
        feature: 'AI_AUTO_CLASSIFICATION',
        config: {
          descripcion: 'Clasificación automática de tipo de documento'
        }
      },
      {
        feature: 'AI_VISION_OCR',
        config: {
          descripcion: 'OCR mejorado con modelos de visión (procesa imágenes directamente)'
        }
      },
      {
        feature: 'MANUAL_CORRECTION',
        config: {}
      },
      {
        feature: 'AUTO_ASSOCIATION',
        config: {}
      },
      {
        feature: 'BULK_PROCESSING',
        config: {
          maxArchivosSimultaneos: 50,
          descripcion: 'Procesamiento masivo de documentos'
        }
      }
    ]
  },

  {
    codigo: 'Mythic',
    nombre: 'Plan Mythic',
    descripcion: 'Plan empresarial con todas las funcionalidades premium y soporte prioritario',
    precio: 999.99,
    orden: 4,
    features: [
      {
        feature: 'AI_PIPELINE_EXTRACTION',
        config: {
          clasificador: 'claude-sonnet',
          extractores: {
            'FACTURA_A': 'claude-sonnet',
            'FACTURA_B': 'claude-sonnet',
            'FACTURA_C': 'claude-sonnet',
            'DESPACHO_ADUANA': 'claude-sonnet',
            'COMPROBANTE_IMPORTACION': 'claude-sonnet',
            'NOTA_CREDITO': 'claude-sonnet',
            'TICKET': 'claude-haiku'
          },
          maxDocumentosPorMes: 10000,
          descripcion: 'Pipeline premium con Claude Sonnet en todo'
        }
      },
      {
        feature: 'AI_LINE_ITEMS_EXTRACTION',
        config: {
          avanzado: true,
          descripcion: 'Extracción avanzada con validación cruzada'
        }
      },
      {
        feature: 'AI_AUTO_CLASSIFICATION',
        config: {}
      },
      {
        feature: 'AI_VISION_OCR',
        config: {
          modelo: 'claude-sonnet-vision',
          descripcion: 'OCR premium con Claude Vision'
        }
      },
      {
        feature: 'AI_CUSTOM_PROMPTS',
        config: {
          descripcion: 'Prompts personalizados por tenant'
        }
      },
      {
        feature: 'AI_CUSTOM_API_KEYS',
        config: {
          descripcion: 'Usar tus propias API keys de OpenAI, Anthropic, Google',
          providers: ['gemini', 'anthropic', 'openai']
        }
      },
      {
        feature: 'AI_ADVANCED_VALIDATION',
        config: {
          descripcion: 'Validación avanzada con múltiples modelos de IA'
        }
      },
      {
        feature: 'DOCUMENT_AI_INTEGRATION',
        config: {
          proveedor: 'google-document-ai',
          descripcion: 'Integración con Google Document AI para máxima precisión'
        }
      },
      {
        feature: 'MANUAL_CORRECTION',
        config: {}
      },
      {
        feature: 'AUTO_ASSOCIATION',
        config: {}
      },
      {
        feature: 'BULK_PROCESSING',
        config: {
          maxArchivosSimultaneos: 200,
          descripcion: 'Procesamiento masivo ilimitado'
        }
      },
      {
        feature: 'PRIORITY_SUPPORT',
        config: {
          descripcion: 'Soporte prioritario 24/7'
        }
      },
      {
        feature: 'API_ACCESS',
        config: {
          descripcion: 'Acceso completo a API REST'
        }
      },
      {
        feature: 'CUSTOM_INTEGRATIONS',
        config: {
          descripcion: 'Integraciones personalizadas con ERP/sistemas externos'
        }
      }
    ]
  }
];

async function seedPlanes() {
  console.log('🌱 Iniciando seed de planes y features...');

  try {
    // Limpiar datos existentes
    console.log('🗑️  Limpiando datos antiguos...');
    await prisma.plan_features.deleteMany({});
    await prisma.planes.deleteMany({});

    // Crear planes y features
    for (const planData of PLANES_CONFIG) {
      const { features, ...planInfo } = planData;

      console.log(`📦 Creando plan: ${planInfo.nombre}`);

      const plan = await prisma.planes.create({
        data: planInfo
      });

      console.log(`   ✅ Plan creado con ID: ${plan.id}`);

      // Crear features del plan
      for (const feature of features) {
        await prisma.plan_features.create({
          data: {
            planId: plan.id,
            ...feature
          }
        });
        console.log(`   🔧 Feature agregado: ${feature.feature}`);
      }
    }

    console.log('\n✅ Seed de planes completado exitosamente!');
    console.log(`📊 Total de planes creados: ${PLANES_CONFIG.length}`);

    // Mostrar resumen
    const planesCount = await prisma.planes.count();
    const featuresCount = await prisma.plan_features.count();
    console.log(`📊 Planes en BD: ${planesCount}`);
    console.log(`📊 Features en BD: ${featuresCount}`);

  } catch (error) {
    console.error('❌ Error en seed de planes:', error);
    throw error;
  }
}

async function migrarTenantsAPlanes() {
  console.log('\n🔄 Migrando tenants existentes a nuevos planes...');

  try {
    // Obtener mapeo de planes
    const planMap = {};
    for (const planCodigo of ['Common', 'Uncommon', 'Rare', 'Mythic']) {
      const plan = await prisma.planes.findUnique({
        where: { codigo: planCodigo }
      });
      planMap[planCodigo] = plan;
    }

    // Obtener todos los tenants
    const tenants = await prisma.tenants.findMany();

    console.log(`📋 Encontrados ${tenants.length} tenants para migrar`);

    for (const tenant of tenants) {
      const plan = planMap[tenant.plan]; // tenant.plan es string actualmente

      if (plan) {
        await prisma.tenants.update({
          where: { id: tenant.id },
          data: { planId: plan.id }
        });
        console.log(`   ✅ Tenant "${tenant.nombre}" → Plan ${tenant.plan} (ID: ${plan.id})`);
      } else {
        console.log(`   ⚠️  Tenant "${tenant.nombre}" tiene plan desconocido: ${tenant.plan}`);
      }
    }

    console.log('\n✅ Migración de tenants completada!');

  } catch (error) {
    console.error('❌ Error en migración de tenants:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedPlanes();
    await migrarTenantsAPlanes();
  } catch (error) {
    console.error('❌ Error ejecutando seeds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { seedPlanes, migrarTenantsAPlanes };
