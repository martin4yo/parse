/**
 * Script para copiar configuración de IA y prompts entre tenants
 *
 * Copia:
 * - ai_prompts
 * - ai_provider_configs
 *
 * Del tenant origen al tenant destino
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function copyAIConfig(tenantOrigenSlug, tenantDestinoSlug) {
  try {
    console.log('🔍 Buscando tenants...');

    // Obtener tenants
    const tenantOrigen = await prisma.tenants.findUnique({
      where: { slug: tenantOrigenSlug }
    });

    const tenantDestino = await prisma.tenants.findUnique({
      where: { slug: tenantDestinoSlug }
    });

    if (!tenantOrigen) {
      throw new Error(`Tenant origen "${tenantOrigenSlug}" no encontrado`);
    }

    if (!tenantDestino) {
      throw new Error(`Tenant destino "${tenantDestinoSlug}" no encontrado`);
    }

    console.log(`✅ Tenant origen: ${tenantOrigen.nombre} (${tenantOrigen.id})`);
    console.log(`✅ Tenant destino: ${tenantDestino.nombre} (${tenantDestino.id})`);

    // ====================
    // 1. COPIAR AI_PROMPTS
    // ====================
    console.log('\n📋 Copiando prompts de IA...');

    const promptsOrigen = await prisma.ai_prompts.findMany({
      where: { tenantId: tenantOrigen.id }
    });

    console.log(`   Encontrados ${promptsOrigen.length} prompts en origen`);

    // Verificar si ya existen prompts en destino
    const promptsDestinoExistentes = await prisma.ai_prompts.findMany({
      where: { tenantId: tenantDestino.id }
    });

    if (promptsDestinoExistentes.length > 0) {
      console.log(`   ⚠️  El tenant destino ya tiene ${promptsDestinoExistentes.length} prompts`);
      console.log('   ¿Deseas eliminarlos y reemplazarlos? (Sí/No)');
      console.log('   Eliminando prompts existentes...');

      await prisma.ai_prompts.deleteMany({
        where: { tenantId: tenantDestino.id }
      });

      console.log(`   ✅ Eliminados ${promptsDestinoExistentes.length} prompts existentes`);
    }

    let promptsCopiados = 0;

    for (const prompt of promptsOrigen) {
      const nuevoPrompt = {
        id: uuidv4(),
        clave: prompt.clave,
        nombre: prompt.nombre,
        descripcion: prompt.descripcion,
        prompt: prompt.prompt,
        variables: prompt.variables,
        activo: prompt.activo,
        version: prompt.version,
        motor: prompt.motor,
        tipo: prompt.tipo,
        vecesUsado: 0, // Resetear contador
        ultimoUso: null,
        tasaExito: null,
        tenantId: tenantDestino.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: prompt.createdBy,
        updatedBy: prompt.updatedBy
      };

      await prisma.ai_prompts.create({
        data: nuevoPrompt
      });

      promptsCopiados++;
      console.log(`   ✅ Copiado: ${prompt.nombre} (${prompt.clave})`);
    }

    console.log(`\n✅ Total prompts copiados: ${promptsCopiados}`);

    // ================================
    // 2. COPIAR AI_PROVIDER_CONFIGS
    // ================================
    console.log('\n🔧 Copiando configuración de proveedores de IA...');

    const configsOrigen = await prisma.ai_provider_configs.findMany({
      where: { tenantId: tenantOrigen.id }
    });

    console.log(`   Encontradas ${configsOrigen.length} configuraciones en origen`);

    // Verificar si ya existen configs en destino
    const configsDestinoExistentes = await prisma.ai_provider_configs.findMany({
      where: { tenantId: tenantDestino.id }
    });

    if (configsDestinoExistentes.length > 0) {
      console.log(`   ⚠️  El tenant destino ya tiene ${configsDestinoExistentes.length} configuraciones`);
      console.log('   Eliminando configuraciones existentes...');

      await prisma.ai_provider_configs.deleteMany({
        where: { tenantId: tenantDestino.id }
      });

      console.log(`   ✅ Eliminadas ${configsDestinoExistentes.length} configuraciones existentes`);
    }

    let configsCopiadas = 0;

    for (const config of configsOrigen) {
      const nuevaConfig = {
        id: uuidv4(),
        tenantId: tenantDestino.id,
        provider: config.provider,
        apiKeyEncrypted: config.apiKeyEncrypted,
        modelo: config.modelo,
        maxRequestsPerDay: config.maxRequestsPerDay,
        config: config.config,
        activo: config.activo,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await prisma.ai_provider_configs.create({
        data: nuevaConfig
      });

      configsCopiadas++;
      console.log(`   ✅ Copiado: ${config.provider} - ${config.modelo || 'default'}`);
    }

    console.log(`\n✅ Total configuraciones copiadas: ${configsCopiadas}`);

    // ====================
    // RESUMEN FINAL
    // ====================
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE COPIA');
    console.log('='.repeat(50));
    console.log(`Origen: ${tenantOrigen.nombre} (${tenantOrigenSlug})`);
    console.log(`Destino: ${tenantDestino.nombre} (${tenantDestinoSlug})`);
    console.log(`\n✅ Prompts copiados: ${promptsCopiados}`);
    console.log(`✅ Configuraciones copiadas: ${configsCopiadas}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
const tenantOrigen = process.argv[2] || 'demo';
const tenantDestino = process.argv[3] || 'grupo-loraschi';

console.log('🚀 Iniciando copia de configuración de IA...\n');
console.log(`Origen: ${tenantOrigen}`);
console.log(`Destino: ${tenantDestino}\n`);

copyAIConfig(tenantOrigen, tenantDestino)
  .then(() => {
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
