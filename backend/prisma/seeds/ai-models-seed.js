const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const aiModels = [
  // Anthropic Models
  {
    id: uuidv4(),
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    description: 'Más reciente, balanceado en velocidad y calidad',
    recommended: true,
    active: true,
    deprecated: false,
    orderIndex: 1
  },
  {
    id: uuidv4(),
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Oct 2024)',
    description: 'Versión anterior del modelo balanceado',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 2
  },
  {
    id: uuidv4(),
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet (Jun 2024)',
    description: 'Versión anterior - puede estar descontinuada',
    recommended: false,
    active: false,
    deprecated: true,
    orderIndex: 3
  },
  {
    id: uuidv4(),
    provider: 'anthropic',
    modelId: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Más potente pero más lento y costoso',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 4
  },
  {
    id: uuidv4(),
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: 'Más rápido y económico, menor calidad',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 5
  },

  // Gemini Models
  {
    id: uuidv4(),
    provider: 'gemini',
    modelId: 'gemini-1.5-flash-latest',
    name: 'Gemini 1.5 Flash (Latest)',
    description: 'Versión más reciente, rápida y económica',
    recommended: true,
    active: true,
    deprecated: false,
    orderIndex: 1
  },
  {
    id: uuidv4(),
    provider: 'gemini',
    modelId: 'gemini-1.5-pro-latest',
    name: 'Gemini 1.5 Pro (Latest)',
    description: 'Más potente, mejor para tareas complejas',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 2
  },
  {
    id: uuidv4(),
    provider: 'gemini',
    modelId: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Versión estable',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 3
  },
  {
    id: uuidv4(),
    provider: 'gemini',
    modelId: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Versión estable del modelo Pro',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 4
  },

  // OpenAI Models
  {
    id: uuidv4(),
    provider: 'openai',
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Más reciente, optimizado y económico',
    recommended: true,
    active: true,
    deprecated: false,
    orderIndex: 1
  },
  {
    id: uuidv4(),
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Versión mini, más rápida y económica',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 2
  },
  {
    id: uuidv4(),
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Versión anterior, aún disponible',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 3
  },
  {
    id: uuidv4(),
    provider: 'openai',
    modelId: 'gpt-4',
    name: 'GPT-4',
    description: 'Modelo original GPT-4',
    recommended: false,
    active: true,
    deprecated: false,
    orderIndex: 4
  }
];

async function seedAIModels() {
  console.log('🌱 Seeding AI models...');

  try {
    // Verificar si ya existen modelos
    const existingCount = await prisma.ai_models.count();

    if (existingCount > 0) {
      console.log(`⚠️  Ya existen ${existingCount} modelos en la base de datos.`);
      console.log('   Para reemplazarlos, primero elimina los existentes.');
      return;
    }

    // Insertar todos los modelos
    for (const model of aiModels) {
      await prisma.ai_models.create({
        data: {
          ...model,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Creado: ${model.name} (${model.provider})`);
    }

    console.log(`\n✅ ${aiModels.length} modelos creados exitosamente!`);

  } catch (error) {
    console.error('❌ Error seeding AI models:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedAIModels()
    .then(() => {
      console.log('✅ Seed completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed falló:', error);
      process.exit(1);
    });
}

module.exports = { seedAIModels };
