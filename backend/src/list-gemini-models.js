const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function listAvailableModels() {
  console.log('🔍 Listando modelos disponibles con tu API key...\n');

  try {
    const tenantId = 'b88fa541-4d93-4f16-a707-95e70f7eecdc';

    const config = await prisma.ai_provider_configs.findUnique({
      where: {
        tenantId_provider: { tenantId, provider: 'gemini' }
      }
    });

    if (!config) {
      console.error('❌ No se encontró configuración de Gemini');
      return;
    }

    // Desencriptar API key
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    const [ivHex, authTagHex, encryptedData] = config.apiKeyEncrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedData, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);

    let apiKey = decipher.update(encrypted, null, 'utf8');
    apiKey += decipher.final('utf8');

    console.log(`🔑 API Key: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 10)}\n`);

    // Intentar listar modelos
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log('🌐 Consultando modelos disponibles...\n');

    try {
      // Intentar con diferentes versiones de API
      const models = await genAI.listModels();

      if (models && models.length > 0) {
        console.log(`✅ Modelos disponibles (${models.length}):\n`);
        models.forEach((model, index) => {
          console.log(`${index + 1}. ${model.name}`);
          if (model.displayName) console.log(`   Nombre: ${model.displayName}`);
          if (model.description) console.log(`   Descripción: ${model.description}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No se pudieron listar modelos');
      }
    } catch (listError) {
      console.error('❌ Error listando modelos:', listError.message);
      console.log('\n💡 Esto indica que:');
      console.log('   1. La API key no es válida o está expirada');
      console.log('   2. La API key no tiene permisos para acceder a Gemini');
      console.log('   3. Estás usando una API key antigua de Google AI Studio');
      console.log('\n🔧 Soluciones:');
      console.log('   1. Genera una nueva API key en: https://aistudio.google.com/app/apikey');
      console.log('   2. Verifica que Gemini esté habilitado en tu proyecto');
      console.log('   3. Prueba con Anthropic Claude en su lugar');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

listAvailableModels().catch(console.error);
