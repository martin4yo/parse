/**
 * Script de Testing: Image Optimization Service
 *
 * Prueba las funcionalidades del servicio de optimización de imágenes:
 * - Análisis de calidad
 * - Optimización para IA
 * - Mejora de imágenes de baja calidad
 * - Optimización para OCR
 * - Conversión de PDF a imagen
 */

const imageOptimizationService = require('../services/imageOptimizationService');
const path = require('path');
const fs = require('fs');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator(title = '') {
  console.log('\n' + '='.repeat(70));
  if (title) {
    log(`  ${title}`, 'bright');
    console.log('='.repeat(70));
  }
}

async function testAnalyzeQuality(imagePath) {
  separator('TEST 1: Análisis de Calidad de Imagen');

  try {
    log(`\nAnalizando: ${path.basename(imagePath)}`, 'cyan');

    const analysis = await imageOptimizationService.analyzeImageQuality(imagePath);

    if (analysis.error) {
      log(`❌ Error: ${analysis.error}`, 'red');
      return false;
    }

    log('\n✅ Análisis completado:', 'green');
    log(`   Resolución: ${analysis.width}x${analysis.height}`);
    log(`   Formato: ${analysis.format}`);
    log(`   Orientación: ${analysis.orientation || 'N/A'}`);
    log(`   Tiene alpha: ${analysis.hasAlpha ? 'Sí' : 'No'}`);
    log(`   Necesita mejora: ${analysis.needsEnhancement ? 'SÍ' : 'NO'}`, analysis.needsEnhancement ? 'yellow' : 'green');

    if (analysis.isDark) log('   ⚠️  Imagen oscura detectada', 'yellow');
    if (analysis.isLowContrast) log('   ⚠️  Bajo contraste detectado', 'yellow');
    if (analysis.isLowResolution) log('   ⚠️  Baja resolución detectada', 'yellow');

    return true;
  } catch (error) {
    log(`❌ Error en test: ${error.message}`, 'red');
    return false;
  }
}

async function testOptimizeForAI(imagePath) {
  separator('TEST 2: Optimización para IA');

  try {
    log(`\nOptimizando: ${path.basename(imagePath)}`, 'cyan');

    const outputDir = path.dirname(imagePath);
    const outputPath = path.join(outputDir, 'test_ai_optimized.jpg');

    const result = await imageOptimizationService.optimizeForAI(imagePath, outputPath);

    if (!result.success) {
      log(`❌ Error: ${result.error}`, 'red');
      return false;
    }

    log('\n✅ Optimización completada:', 'green');
    log(`   Tamaño original: ${(result.originalSize / 1024).toFixed(2)} KB`);
    log(`   Tamaño optimizado: ${(result.optimizedSize / 1024).toFixed(2)} KB`);
    log(`   Reducción: ${result.reduction}%`, 'green');
    log(`   Tiempo: ${result.duration}ms`);
    log(`   Archivo guardado en: ${outputPath}`, 'blue');

    return true;
  } catch (error) {
    log(`❌ Error en test: ${error.message}`, 'red');
    return false;
  }
}

async function testEnhanceImage(imagePath) {
  separator('TEST 3: Mejora de Calidad de Imagen');

  try {
    log(`\nMejorando: ${path.basename(imagePath)}`, 'cyan');

    const outputDir = path.dirname(imagePath);
    const outputPath = path.join(outputDir, 'test_enhanced.png');

    const result = await imageOptimizationService.enhanceImage(imagePath, outputPath);

    if (!result.success) {
      log(`❌ Error: ${result.error}`, 'red');
      return false;
    }

    log('\n✅ Mejora completada:', 'green');
    log(`   Tiempo: ${result.duration}ms`);
    log(`   Mejoras aplicadas:`, 'blue');
    if (result.enhancements.brightnessCorrected) log('     ✓ Corrección de brillo');
    if (result.enhancements.contrastEnhanced) log('     ✓ Mejora de contraste');
    if (result.enhancements.sharpened) log('     ✓ Afilado');
    if (result.enhancements.noiseReduced) log('     ✓ Reducción de ruido');
    log(`   Archivo guardado en: ${outputPath}`, 'blue');

    return true;
  } catch (error) {
    log(`❌ Error en test: ${error.message}`, 'red');
    return false;
  }
}

async function testOptimizeForOCR(imagePath) {
  separator('TEST 4: Optimización para OCR');

  try {
    log(`\nOptimizando para OCR: ${path.basename(imagePath)}`, 'cyan');

    const outputDir = path.dirname(imagePath);
    const outputPath = path.join(outputDir, 'test_ocr_optimized.png');

    const result = await imageOptimizationService.optimizeForOCR(imagePath, outputPath);

    if (!result.success) {
      log(`❌ Error: ${result.error}`, 'red');
      return false;
    }

    log('\n✅ Optimización para OCR completada:', 'green');
    log(`   Tiempo: ${result.duration}ms`);
    log(`   Archivo guardado en: ${outputPath}`, 'blue');

    return true;
  } catch (error) {
    log(`❌ Error en test: ${error.message}`, 'red');
    return false;
  }
}

async function testSmartProcess(imagePath) {
  separator('TEST 5: Procesamiento Inteligente');

  try {
    log(`\nProcesando inteligentemente: ${path.basename(imagePath)}`, 'cyan');

    // Probar los 3 modos
    const modes = ['ai', 'ocr', 'enhance'];

    for (const mode of modes) {
      log(`\n  Modo: ${mode.toUpperCase()}`, 'yellow');

      const result = await imageOptimizationService.smartProcess(imagePath, mode);

      if (!result.success) {
        log(`  ❌ Error: ${result.error}`, 'red');
        continue;
      }

      log(`  ✅ Procesado exitosamente`, 'green');
      log(`     Tiempo: ${result.duration}ms`);
      if (result.reduction) {
        log(`     Reducción: ${result.reduction}%`, 'green');
      }
      if (result.quality) {
        log(`     Calidad detectada: ${result.quality.needsEnhancement ? 'Baja (mejorada)' : 'Buena'}`);
      }

      // Limpiar archivo de prueba
      if (result.path && fs.existsSync(result.path)) {
        fs.unlinkSync(result.path);
      }
    }

    log('\n✅ Procesamiento inteligente completado', 'green');
    return true;
  } catch (error) {
    log(`❌ Error en test: ${error.message}`, 'red');
    return false;
  }
}

async function testCleanup() {
  separator('TEST 6: Limpieza de Archivos Temporales');

  try {
    log(`\nProbando limpieza de archivos temporales...`, 'cyan');

    const testDir = path.join(__dirname, '../../uploads');

    // Crear algunos archivos de prueba
    const testFiles = [
      'test_optimized_old.jpg',
      'test_enhanced_old.png',
      'processed_test.jpg'
    ];

    for (const file of testFiles) {
      const filePath = path.join(testDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'test content');
      }
    }

    log(`   Archivos de prueba creados`, 'blue');

    // Ejecutar limpieza (archivos más viejos de 0 minutos - limpiará todos)
    imageOptimizationService.cleanTempFiles(testDir, 0);

    log('\n✅ Limpieza completada', 'green');
    return true;
  } catch (error) {
    log(`❌ Error en test: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  separator('SUITE DE TESTS: Image Optimization Service');
  log('\nIniciando tests...', 'cyan');

  // Buscar una imagen de prueba
  const uploadsDir = path.join(__dirname, '../../uploads');
  let testImagePath = null;

  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png'].includes(ext);
    });

    if (imageFiles.length > 0) {
      testImagePath = path.join(uploadsDir, imageFiles[0]);
      log(`\nUsando imagen de prueba: ${imageFiles[0]}`, 'yellow');
    }
  }

  // Si no hay imagen, crear una de prueba simple
  if (!testImagePath) {
    log(`\n⚠️  No se encontraron imágenes en ${uploadsDir}`, 'yellow');
    log(`   Por favor, coloca una imagen de prueba en ese directorio y vuelve a ejecutar.`, 'yellow');
    log(`   Puedes usar cualquier factura o documento para probar.`, 'yellow');
    return;
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  const tests = [
    { name: 'Análisis de Calidad', fn: () => testAnalyzeQuality(testImagePath) },
    { name: 'Optimización para IA', fn: () => testOptimizeForAI(testImagePath) },
    { name: 'Mejora de Calidad', fn: () => testEnhanceImage(testImagePath) },
    { name: 'Optimización para OCR', fn: () => testOptimizeForOCR(testImagePath) },
    { name: 'Procesamiento Inteligente', fn: () => testSmartProcess(testImagePath) },
    { name: 'Limpieza de Temporales', fn: testCleanup }
  ];

  for (const test of tests) {
    results.total++;
    const passed = await test.fn();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  // Resumen final
  separator('RESUMEN DE TESTS');
  log(`\nTotal: ${results.total}`, 'cyan');
  log(`Exitosos: ${results.passed}`, 'green');
  log(`Fallidos: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  log(`\nTasa de éxito: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');

  separator();
}

// Ejecutar tests
runAllTests().catch(error => {
  console.error('Error ejecutando tests:', error);
  process.exit(1);
});
