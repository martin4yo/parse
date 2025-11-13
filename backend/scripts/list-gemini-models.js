/**
 * Script para listar modelos disponibles en Gemini con tu API key
 */
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listAvailableModels() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY no está configurado en .env');
      return;
    }

    console.log('🔍 Consultando modelos disponibles en Gemini...\n');
    console.log('API Key:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));

    const genAI = new GoogleGenerativeAI(apiKey);

    // Listar modelos disponibles
    const models = await genAI.listModels();

    console.log('\n📋 MODELOS DISPONIBLES PARA GENERATECONTENT:\n');

    const generateContentModels = models.filter(m =>
      m.supportedGenerationMethods.includes('generateContent')
    );

    if (generateContentModels.length === 0) {
      console.log('⚠️ No hay modelos disponibles para generateContent');
      console.log('\n📋 TODOS LOS MODELOS:');
      models.forEach(m => {
        console.log(`  - ${m.name}`);
        console.log(`    Métodos: ${m.supportedGenerationMethods.join(', ')}`);
      });
    } else {
      generateContentModels.forEach(m => {
        const modelName = m.name.replace('models/', '');
        console.log(`✅ ${modelName}`);
        console.log(`   Display: ${m.displayName}`);
        console.log(`   Descripción: ${m.description || 'N/A'}`);
        console.log(`   Límite input: ${m.inputTokenLimit || 'N/A'}`);
        console.log(`   Límite output: ${m.outputTokenLimit || 'N/A'}`);
        console.log('');
      });

      console.log('\n💡 RECOMENDACIONES PARA .ENV:');
      console.log('Usa uno de estos modelos en tu configuración:\n');

      const flashModels = generateContentModels.filter(m => m.name.includes('flash'));
      const proModels = generateContentModels.filter(m => m.name.includes('pro'));

      if (flashModels.length > 0) {
        console.log('🚀 Flash (rápido y gratis):');
        flashModels.forEach(m => {
          const modelName = m.name.replace('models/', '');
          console.log(`   AI_LOOKUP_MODEL=${modelName}`);
        });
      }

      if (proModels.length > 0) {
        console.log('\n⭐ Pro (más potente):');
        proModels.forEach(m => {
          const modelName = m.name.replace('models/', '');
          console.log(`   AI_LOOKUP_MODEL=${modelName}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nStack:', error.stack);
  }
}

listAvailableModels();
