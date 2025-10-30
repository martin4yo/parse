const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Script para probar la conexión con Gemini
 */
async function testGeminiConnection() {
  console.log('🔍 Probando conexión con Gemini...\n');

  try {
    // Buscar configuración de Gemini del tenant
    const tenantId = 'b88fa541-4d93-4f16-a707-95e70f7eecdc'; // Empresa Demo

    console.log(`📋 Buscando configuración de Gemini para tenant: ${tenantId}`);

    const config = await prisma.ai_provider_configs.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'gemini'
        }
      }
    });

    if (!config) {
      console.error('❌ No se encontró configuración de Gemini para este tenant');
      console.log('\n💡 Solución: Configura una API key en /ia-config');
      return;
    }

    console.log(`✅ Configuración encontrada`);
    console.log(`   Modelo: ${config.modelo}`);
    console.log(`   Activo: ${config.activo}`);

    // Desencriptar API key (necesitarás el método decrypt del servicio)
    const crypto = require('crypto');
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

    if (!ENCRYPTION_KEY) {
      console.error('❌ ENCRYPTION_KEY no está configurada en .env');
      return;
    }

    const [ivHex, authTagHex, encryptedData] = config.apiKeyEncrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedData, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);

    let apiKey = decipher.update(encrypted, null, 'utf8');
    apiKey += decipher.final('utf8');

    console.log(`🔑 API Key (primeros 15 chars): ${apiKey.substring(0, 15)}...`);
    console.log(`🔑 API Key (últimos 10 chars): ...${apiKey.substring(apiKey.length - 10)}`);

    // Intentar llamada simple a Gemini
    console.log('\n🌐 Intentando llamar a Gemini API...');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: config.modelo || 'gemini-1.5-flash-latest' });

    const result = await model.generateContent('Di "Hola" en JSON con formato: {"mensaje": "Hola"}');
    const response = result.response;
    const text = response.text();

    console.log('✅ ¡Respuesta recibida de Gemini!');
    console.log(`📥 Respuesta: ${text}`);

    console.log('\n✅ ¡La API key de Gemini funciona correctamente!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n📋 Detalles del error:');
    console.error(error);

    if (error.message.includes('fetch failed')) {
      console.error('\n🌐 Posibles causas del error "fetch failed":');
      console.error('   1. Sin conexión a Internet desde el servidor');
      console.error('   2. API Key inválida o expirada');
      console.error('   3. Firewall/Proxy bloqueando salida a generativelanguage.googleapis.com');
      console.error('   4. Gemini no disponible en tu región/país');
      console.error('   5. Problema temporal del servicio de Google');
      console.error('\n💡 Prueba verificar:');
      console.error('   - ¿El servidor tiene acceso a Internet?');
      console.error('   - ¿La API key es válida? Verifica en https://aistudio.google.com/app/apikey');
      console.error('   - ¿Estás en un país donde Gemini está disponible?');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testGeminiConnection()
    .then(() => {
      console.log('\n✅ Test completado\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error('\n❌ Error fatal:', e);
      process.exit(1);
    });
}

module.exports = { testGeminiConnection };
