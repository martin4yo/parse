/**
 * Script de Verificación Pre-Producción
 *
 * Verifica que todos los módulos se puedan cargar correctamente
 * y que las funciones principales existan
 */

console.log('🔍 ===== VERIFICACIÓN PRE-PRODUCCIÓN =====\n');

let errors = 0;
let warnings = 0;

// Helper para verificar módulos
function verifyModule(modulePath, moduleName) {
  try {
    console.log(`✓ Verificando: ${moduleName}...`);
    const module = require(modulePath);

    if (!module) {
      console.error(`   ❌ ERROR: ${moduleName} no se pudo cargar`);
      errors++;
      return null;
    }

    console.log(`   ✅ ${moduleName} cargado correctamente`);
    return module;
  } catch (error) {
    console.error(`   ❌ ERROR cargando ${moduleName}:`, error.message);
    errors++;
    return null;
  }
}

// Helper para verificar funciones
function verifyFunction(obj, functionName, moduleName) {
  if (typeof obj[functionName] === 'function') {
    console.log(`   ✅ Función ${functionName} existe`);
    return true;
  } else {
    console.error(`   ❌ ERROR: Función ${functionName} no existe en ${moduleName}`);
    errors++;
    return false;
  }
}

console.log('📦 1. VERIFICANDO DEPENDENCIAS CORE\n');

// Verificar Sharp
try {
  const sharp = require('sharp');
  console.log('✅ Sharp instalado correctamente');
} catch (error) {
  console.error('❌ ERROR: Sharp no está instalado:', error.message);
  errors++;
}

// Verificar pdf2pic
try {
  const pdf2pic = require('pdf2pic');
  console.log('✅ pdf2pic instalado correctamente');
} catch (error) {
  console.error('❌ ERROR: pdf2pic no está instalado:', error.message);
  errors++;
}

console.log('\n📦 2. VERIFICANDO SERVICIOS\n');

// Verificar imageOptimizationService
const imageOptService = verifyModule(
  '../services/imageOptimizationService',
  'imageOptimizationService'
);

if (imageOptService) {
  verifyFunction(imageOptService, 'analyzeImageQuality', 'imageOptimizationService');
  verifyFunction(imageOptService, 'optimizeForAI', 'imageOptimizationService');
  verifyFunction(imageOptService, 'enhanceImage', 'imageOptimizationService');
  verifyFunction(imageOptService, 'optimizeForOCR', 'imageOptimizationService');
  verifyFunction(imageOptService, 'smartProcess', 'imageOptimizationService');
  verifyFunction(imageOptService, 'cleanTempFiles', 'imageOptimizationService');
}

// Verificar classifierService
const classifierService = verifyModule(
  '../services/classifierService',
  'classifierService'
);

if (classifierService) {
  verifyFunction(classifierService, 'classify', 'classifierService');
}

// Verificar aiConfigService
const aiConfigService = verifyModule(
  '../services/aiConfigService',
  'aiConfigService'
);

// Verificar promptManager
const promptManager = verifyModule(
  '../services/promptManager',
  'promptManager'
);

console.log('\n📦 3. VERIFICANDO PROCESADORES\n');

// Verificar DocumentProcessor
const DocumentProcessor = verifyModule(
  '../lib/documentProcessor',
  'DocumentProcessor'
);

if (DocumentProcessor) {
  // Crear instancia para verificar métodos
  try {
    const processor = new DocumentProcessor();
    console.log('   ✅ DocumentProcessor se puede instanciar');

    // Verificar métodos clave
    verifyFunction(processor, 'processPDF', 'DocumentProcessor');
    verifyFunction(processor, 'processImage', 'DocumentProcessor');
    verifyFunction(processor, 'extractWithClaudeVision', 'DocumentProcessor');
    verifyFunction(processor, 'getPromptKeyForClaudeVision', 'DocumentProcessor');
    verifyFunction(processor, 'extractDataWithAI', 'DocumentProcessor');
  } catch (error) {
    console.error('   ❌ ERROR instanciando DocumentProcessor:', error.message);
    errors++;
  }
}

console.log('\n📦 4. VERIFICANDO ORQUESTADOR\n');

// Verificar DocumentExtractionOrchestrator
const orchestrator = verifyModule(
  '../services/documentExtractionOrchestrator',
  'documentExtractionOrchestrator'
);

if (orchestrator) {
  verifyFunction(orchestrator, 'extractData', 'orchestrator');
  verifyFunction(orchestrator, 'extractWithPipeline', 'orchestrator');
  verifyFunction(orchestrator, 'extractWithSimplePrompt', 'orchestrator');
  verifyFunction(orchestrator, 'getPromptKeyForType', 'orchestrator');
}

console.log('\n📦 5. VERIFICANDO CONFIGURACIÓN\n');

// Verificar variables de entorno críticas
const envVars = [
  'DATABASE_URL',
  'PORT',
  'JWT_SECRET'
];

const optionalEnvVars = [
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'USE_CLAUDE_VISION',
  'ENABLE_AI_EXTRACTION',
  'USE_DOCUMENT_AI'
];

envVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName} configurada`);
  } else {
    console.error(`❌ ERROR: ${varName} NO configurada`);
    errors++;
  }
});

console.log('\nVariables opcionales:');
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName} = ${process.env[varName] === 'true' ? 'true' : '[configurada]'}`);
  } else {
    console.log(`⚠️  ${varName} no configurada (opcional)`);
    warnings++;
  }
});

console.log('\n📦 6. VERIFICANDO ESTRUCTURA DE DIRECTORIOS\n');

const fs = require('fs');
const path = require('path');

const criticalDirs = [
  '../services',
  '../lib',
  '../routes',
  '../middleware',
  '../scripts',
  '../../uploads'
];

criticalDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ Directorio existe: ${dir}`);
  } else {
    console.error(`❌ ERROR: Directorio no existe: ${dir}`);
    errors++;
  }
});

// Verificar uploads es writable
const uploadsPath = path.join(__dirname, '../../uploads');
try {
  fs.accessSync(uploadsPath, fs.constants.W_OK);
  console.log('✅ Directorio uploads es escribible');
} catch (error) {
  console.error('❌ ERROR: Directorio uploads no es escribible');
  errors++;
}

console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE VERIFICACIÓN\n');

console.log(`Errores: ${errors}`);
console.log(`Advertencias: ${warnings}`);

if (errors === 0) {
  console.log('\n✅ ✅ ✅ TODAS LAS VERIFICACIONES PASARON ✅ ✅ ✅');
  console.log('✅ El sistema está listo para producción\n');
  process.exit(0);
} else {
  console.log('\n❌ ❌ ❌ HAY ERRORES QUE DEBEN CORREGIRSE ❌ ❌ ❌');
  console.log('❌ NO desplegar a producción hasta corregir errores\n');
  process.exit(1);
}
