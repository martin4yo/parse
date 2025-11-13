/**
 * Script para listar modelos disponibles en Gemini usando HTTP directo
 */
require('dotenv').config();

async function listAvailableModels() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY no está configurado en .env');
      return;
    }

    console.log('🔍 Consultando modelos disponibles en Gemini...\n');
    console.log('API Key:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));

    // Hacer request HTTP directo a la API de Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('\n📋 MODELOS DISPONIBLES PARA GENERATECONTENT:\n');

    const generateContentModels = data.models.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent')
    );

    if (generateContentModels.length === 0) {
      console.log('⚠️ No hay modelos disponibles para generateContent');
    } else {
      generateContentModels.forEach(m => {
        const modelName = m.name.replace('models/', '');
        console.log(`✅ ${modelName}`);
        console.log(`   Display: ${m.displayName}`);
        console.log(`   Descripción: ${m.description || 'N/A'}`);
        console.log('');
      });

      console.log('\n💡 MODELOS RECOMENDADOS PARA AI_LOOKUP:\n');

      // Buscar modelos flash
      const flashModels = generateContentModels.filter(m =>
        m.name.toLowerCase().includes('flash')
      );

      if (flashModels.length > 0) {
        console.log('🚀 Modelos Flash (rápidos y gratis):');
        flashModels.forEach(m => {
          const modelName = m.name.replace('models/', '');
          console.log(`   ${modelName}`);
        });
      }

      // Buscar modelos pro
      const proModels = generateContentModels.filter(m =>
        m.name.toLowerCase().includes('pro') && !m.name.toLowerCase().includes('flash')
      );

      if (proModels.length > 0) {
        console.log('\n⭐ Modelos Pro (más potentes):');
        proModels.forEach(m => {
          const modelName = m.name.replace('models/', '');
          console.log(`   ${modelName}`);
        });
      }

      // Recomendar el primero
      if (flashModels.length > 0) {
        const recommended = flashModels[0].name.replace('models/', '');
        console.log('\n✅ RECOMENDACIÓN:');
        console.log(`   Usa: AI_LOOKUP_MODEL=${recommended}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error('\nStack:', error.stack);
  }
}

listAvailableModels();
