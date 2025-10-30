require('dotenv').config();
const documentAIProcessor = require('../services/documentAIProcessor');
const path = require('path');
const fs = require('fs');

async function testDocumentAI() {
  console.log('\n🧪 ===== TEST DE DOCUMENT AI =====\n');

  // 1. Verificar configuración
  console.log('📋 PASO 1: Verificar configuración\n');
  console.log(`   USE_DOCUMENT_AI: ${process.env.USE_DOCUMENT_AI}`);
  console.log(`   PROJECT_ID: ${process.env.DOCUMENT_AI_PROJECT_ID}`);
  console.log(`   PROCESSOR_ID: ${process.env.DOCUMENT_AI_PROCESSOR_ID}`);
  console.log(`   LOCATION: ${process.env.DOCUMENT_AI_LOCATION}`);
  console.log(`   CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  console.log('');

  const isConfigured = documentAIProcessor.isConfigured();
  console.log(`   ✅ Document AI está ${isConfigured ? 'CONFIGURADO' : 'NO CONFIGURADO'}\n`);

  if (!isConfigured) {
    console.log('❌ Document AI no está configurado correctamente.');
    console.log('   Verifica las variables de entorno en .env\n');
    process.exit(1);
  }

  // 2. Verificar archivo de credenciales
  console.log('📋 PASO 2: Verificar archivo de credenciales\n');
  const credentialsPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log(`   Ruta: ${credentialsPath}`);

  if (fs.existsSync(credentialsPath)) {
    const stats = fs.statSync(credentialsPath);
    console.log(`   ✅ Archivo existe (${(stats.size / 1024).toFixed(2)} KB)\n`);
  } else {
    console.log(`   ❌ Archivo NO existe en esa ruta\n`);
    process.exit(1);
  }

  // 3. Buscar un PDF de prueba en uploads
  console.log('📋 PASO 3: Buscar PDF de prueba\n');
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
      // Ignorar errores de permisos
    }
    return null;
  }

  testPDF = findPDF(uploadsDir);

  if (!testPDF) {
    console.log('   ⚠️  No se encontró ningún PDF en uploads/');
    console.log('   Para probar completamente, sube un PDF desde el frontend primero.\n');
    console.log('   Pero la configuración está correcta ✅\n');
    process.exit(0);
  }

  console.log(`   ✅ PDF encontrado: ${path.basename(testPDF)}`);
  console.log(`   Tamaño: ${(fs.statSync(testPDF).size / 1024).toFixed(2)} KB\n`);

  // 4. Probar extracción con Document AI
  console.log('📋 PASO 4: Probar extracción con Document AI\n');
  console.log('   ⏳ Procesando...\n');

  try {
    const startTime = Date.now();
    const result = await documentAIProcessor.processInvoice(testPDF);
    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`   ✅ ÉXITO! Procesado en ${duration}ms\n`);
      console.log(`   📊 Confianza general: ${result.confidence.toFixed(1)}%\n`);
      console.log('   📋 Datos extraídos:\n');

      const data = result.data;
      if (data.fecha) console.log(`      • Fecha: ${data.fecha}`);
      if (data.cuit) console.log(`      • CUIT: ${data.cuit}`);
      if (data.razonSocial) console.log(`      • Razón Social: ${data.razonSocial}`);
      if (data.numeroComprobante) console.log(`      • N° Comprobante: ${data.numeroComprobante}`);
      if (data.tipoComprobante) console.log(`      • Tipo: ${data.tipoComprobante}`);
      if (data.importe) console.log(`      • Importe: $${data.importe}`);
      if (data.netoGravado) console.log(`      • Neto Gravado: $${data.netoGravado}`);
      if (data.impuestos) console.log(`      • Impuestos: $${data.impuestos}`);
      if (data.moneda) console.log(`      • Moneda: ${data.moneda}`);
      if (data.lineItems && data.lineItems.length > 0) {
        console.log(`      • Line Items: ${data.lineItems.length} items`);
      }

      console.log('\n   🎉 ¡Document AI funciona perfectamente!\n');

    } else {
      console.log(`   ❌ ERROR: ${result.error}\n`);
      console.log('   Detalles completos:\n');
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.log(`   ❌ EXCEPCIÓN: ${error.message}\n`);
    console.log('   Stack trace:\n');
    console.error(error);
    process.exit(1);
  }

  console.log('✅ ===== TEST COMPLETADO =====\n');
  process.exit(0);
}

testDocumentAI().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
