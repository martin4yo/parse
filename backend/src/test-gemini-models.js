const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
  console.log('🔍 Verificando API key y modelos disponibles...\n');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY no configurada en .env');
    process.exit(1);
  }

  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);

  const genAI = new GoogleGenerativeAI(apiKey);

  // Intentar llamada simple
  console.log('\n📝 Probando modelo gemini-pro...');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Responde solo con "OK"');
    const response = result.response;
    const text = response.text();

    console.log('✅ gemini-pro funciona!');
    console.log(`Respuesta: ${text}\n`);
  } catch (error) {
    console.error('❌ gemini-pro falló:');
    console.error(`   ${error.message}\n`);
  }

  // Intentar con modelos 1.5
  const modelsToTest = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest',
    'models/gemini-pro',
    'models/gemini-1.5-pro',
    'models/gemini-1.5-flash'
  ];

  for (const modelName of modelsToTest) {
    console.log(`📝 Probando ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Responde solo con "OK"');
      const response = result.response;
      const text = response.text();

      console.log(`✅ ${modelName} funciona!`);
      console.log(`   Respuesta: ${text}\n`);
      break; // Si uno funciona, salir
    } catch (error) {
      console.error(`❌ ${modelName} falló: ${error.message.substring(0, 100)}...\n`);
    }
  }
}

listModels().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
