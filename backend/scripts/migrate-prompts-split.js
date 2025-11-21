/**
 * Script para migrar prompts existentes separando SYSTEM de USER
 *
 * Estrategia de split inteligente:
 * 1. Detectar secciones que son instrucciones generales → systemPrompt
 * 2. Detectar secciones que son templates/estructura → userPromptTemplate
 * 3. Si no se puede separar, copiar todo a systemPrompt
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Patrones que indican SYSTEM prompt (instrucciones generales)
const SYSTEM_INDICATORS = [
  /eres un experto/i,
  /tu tarea es/i,
  /tienes conocimiento/i,
  /importante:/i,
  /responde únicamente/i,
  /no agregues texto/i,
  /reglas:/i,
  /comportamiento:/i,
  /instrucciones generales/i
];

// Patrones que indican USER prompt template (estructura de datos)
const USER_INDICATORS = [
  /extrae los siguientes/i,
  /analiza el documento/i,
  /formato json:/i,
  /{\s*"/,  // JSON object
  /campos requeridos:/i,
  /estructura:/i,
  /ejemplo:/i
];

/**
 * Intenta separar un prompt en SYSTEM y USER
 */
function splitPrompt(prompt) {
  const lines = prompt.split('\n');

  let systemLines = [];
  let userLines = [];
  let currentSection = null; // 'system' | 'user'

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detectar si la línea es SYSTEM
    const isSystem = SYSTEM_INDICATORS.some(pattern => pattern.test(trimmed));

    // Detectar si la línea es USER
    const isUser = USER_INDICATORS.some(pattern => pattern.test(trimmed));

    if (isSystem && !currentSection) {
      currentSection = 'system';
    } else if (isUser && currentSection === 'system') {
      // Cambio de sección
      currentSection = 'user';
    }

    // Asignar línea a la sección correspondiente
    if (currentSection === 'system') {
      systemLines.push(line);
    } else if (currentSection === 'user') {
      userLines.push(line);
    } else {
      // Si no sabemos, asumimos SYSTEM por defecto
      systemLines.push(line);
    }
  }

  const systemPrompt = systemLines.join('\n').trim();
  const userPromptTemplate = userLines.join('\n').trim();

  // Si no pudimos separar, poner todo en SYSTEM
  if (!userPromptTemplate) {
    return {
      systemPrompt: prompt.trim(),
      userPromptTemplate: 'Analiza el documento adjunto y extrae los datos solicitados en formato JSON.'
    };
  }

  return { systemPrompt, userPromptTemplate };
}

/**
 * Migrar todos los prompts
 */
async function migratePrompts() {
  try {
    console.log('🔄 Iniciando migración de prompts...\n');

    // Obtener todos los prompts que no tienen systemPrompt definido
    const prompts = await prisma.ai_prompts.findMany({
      where: {
        OR: [
          { systemPrompt: null },
          { systemPrompt: '' }
        ]
      }
    });

    console.log(`📊 Encontrados ${prompts.length} prompts para migrar\n`);

    let migrated = 0;
    let failed = 0;

    for (const p of prompts) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📝 Migrando: ${p.clave} (${p.nombre})`);
        console.log(`   Motor: ${p.motor || 'N/A'} | Tipo: ${p.tipo}`);
        console.log(`${'='.repeat(60)}`);

        // Split inteligente
        const { systemPrompt, userPromptTemplate } = splitPrompt(p.prompt);

        console.log('\n✂️  RESULTADO DE LA SEPARACIÓN:\n');
        console.log('📌 SYSTEM PROMPT:');
        console.log(systemPrompt.substring(0, 200) + (systemPrompt.length > 200 ? '...' : ''));
        console.log(`   (${systemPrompt.length} caracteres)\n`);

        console.log('📌 USER PROMPT TEMPLATE:');
        console.log(userPromptTemplate.substring(0, 200) + (userPromptTemplate.length > 200 ? '...' : ''));
        console.log(`   (${userPromptTemplate.length} caracteres)\n`);

        // Actualizar en BD
        await prisma.ai_prompts.update({
          where: { id: p.id },
          data: {
            systemPrompt,
            userPromptTemplate,
            updatedAt: new Date()
          }
        });

        migrated++;
        console.log('✅ Migrado exitosamente\n');

      } catch (error) {
        console.error(`❌ Error migrando ${p.clave}:`, error.message);
        failed++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Migrados exitosamente: ${migrated}`);
    console.log(`❌ Fallos: ${failed}`);
    console.log(`📋 Total: ${prompts.length}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
migratePrompts();
