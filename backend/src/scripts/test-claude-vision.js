require('dotenv').config();
const DocumentProcessor = require('../lib/documentProcessor');
const path = require('path');
const fs = require('fs');

async function testClaudeVision() {
  console.log('\n🧪 ===== TEST DE CLAUDE VISION =====\n');

  // 1. Verificar configuración
  console.log('📋 PASO 1: Verificar configuración\n');
  console.log(`   USE_CLAUDE_VISION: ${process.env.USE_CLAUDE_VISION}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Configurada ✅' : 'NO configurada ❌'}`);
  console.log('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ API Key de Anthropic no configurada en .env\n');
    process.exit(1);
  }

  // 2. Buscar un PDF de prueba
  console.log('📋 PASO 2: Buscar PDF de prueba\n');
  const uploadsDir = path.resolve(__dirname, '../../uploads');

  let testPDF = null;

  // Buscar recursivamente un PDF
  function findPDF(dir) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const found = findPDF(fullPath);
          if (found) return found;
        } else if (file.toLowerCase().endsWith('.pdf')) {
          return fullPath;
        }
      }
    } catch (e) {
      // Ignorar errores
    }
    return null;
  }

  testPDF = findPDF(uploadsDir);

  if (!testPDF) {
    console.log('   ⚠️  No se encontró ningún PDF en uploads/');
    console.log('   Sube un PDF desde el frontend primero.\n');
    process.exit(0);
  }

  console.log(`   ✅ PDF encontrado: ${path.basename(testPDF)}`);
  console.log(`   Tamaño: ${(fs.statSync(testPDF).size / 1024).toFixed(2)} KB\n`);

  // 3. Probar Claude Vision
  console.log('📋 PASO 3: Probar extracción con Claude Vision\n');
  console.log('   ⏳ Procesando (esto puede tomar 10-30 segundos)...\n');

  try {
    const processor = new DocumentProcessor();
    const startTime = Date.now();

    // Llamar directamente al método extractWithClaudeVision
    const result = await processor.extractWithClaudeVision(testPDF, null);
    const duration = Date.now() - startTime;

    if (result) {
      console.log(`   ✅ ÉXITO! Procesado en ${(duration / 1000).toFixed(1)}s\n`);
      console.log('   📋 Datos extraídos:\n');

      if (result.fecha) console.log(`      • Fecha: ${result.fecha}`);
      if (result.cuit) console.log(`      • CUIT: ${result.cuit}`);
      if (result.razonSocial) console.log(`      • Razón Social: ${result.razonSocial}`);
      if (result.numeroComprobante) console.log(`      • N° Comprobante: ${result.numeroComprobante}`);
      if (result.tipoComprobante) console.log(`      • Tipo: ${result.tipoComprobante}`);
      if (result.importe) console.log(`      • Importe: $${result.importe}`);
      if (result.netoGravado) console.log(`      • Neto Gravado: $${result.netoGravado}`);
      if (result.impuestos) console.log(`      • Impuestos: $${result.impuestos}`);
      if (result.moneda) console.log(`      • Moneda: ${result.moneda}`);
      if (result.lineItems && result.lineItems.length > 0) {
        console.log(`      • Line Items: ${result.lineItems.length} items`);
      }

      console.log('\n   🎉 ¡Claude Vision funciona perfectamente!\n');
      console.log('   📊 Claude Vision puede leer imágenes embebidas en el PDF\n');

    } else {
      console.log(`   ❌ No se pudo extraer datos\n`);
      process.exit(1);
    }

  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
    console.log('   Stack trace:\n');
    console.error(error);
    process.exit(1);
  }

  console.log('✅ ===== TEST COMPLETADO =====\n');
  console.log('💡 Ahora puedes subir PDFs con imágenes desde el frontend');
  console.log('   y Claude Vision las leerá automáticamente.\n');
  process.exit(0);
}

testClaudeVision().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
