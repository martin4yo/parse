/**
 * Script para verificar el estado de Document AI en la BD
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  try {
    console.log('='.repeat(60));
    console.log('VERIFICACIÓN DE CONFIGURACIÓN DOCUMENT AI');
    console.log('='.repeat(60));

    // Obtener todas las configuraciones de document_ai
    const configs = await prisma.ai_provider_configs.findMany({
      where: {
        provider: 'document_ai'
      },
      select: {
        id: true,
        tenantId: true,
        provider: true,
        activo: true,
        modelo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`\n📊 Configuraciones encontradas: ${configs.length}\n`);

    if (configs.length === 0) {
      console.log('❌ No hay configuración de Document AI en la BD');
      console.log('ℹ️  El sistema usará la variable de entorno USE_DOCUMENT_AI');
      console.log(`   USE_DOCUMENT_AI=${process.env.USE_DOCUMENT_AI}\n`);
    } else {
      configs.forEach((config, i) => {
        console.log(`${i + 1}. Configuración:`);
        console.log(`   ID: ${config.id}`);
        console.log(`   Tenant: ${config.tenantId || 'GLOBAL'}`);
        console.log(`   Provider: ${config.provider}`);
        console.log(`   Estado: ${config.activo ? '✅ ACTIVO' : '❌ INACTIVO'}`);
        console.log(`   Modelo: ${config.modelo || 'N/A'}`);
        console.log(`   Creado: ${config.createdAt}`);
        console.log(`   Actualizado: ${config.updatedAt}`);
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('VARIABLES DE ENTORNO');
    console.log('='.repeat(60));
    console.log(`USE_DOCUMENT_AI: ${process.env.USE_DOCUMENT_AI || 'no configurado'}`);
    console.log(`DOCUMENT_AI_PROJECT_ID: ${process.env.DOCUMENT_AI_PROJECT_ID ? 'configurado ✅' : 'no configurado ❌'}`);
    console.log(`DOCUMENT_AI_PROCESSOR_ID: ${process.env.DOCUMENT_AI_PROCESSOR_ID ? 'configurado ✅' : 'no configurado ❌'}`);
    console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configurado ✅' : 'no configurado ❌'}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
