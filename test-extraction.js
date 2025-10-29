/**
 * Script de prueba para verificar la extracción de datos de PDFs
 * NO requiere servidor corriendo - prueba solo la extracción
 *
 * Uso: node test-extraction.js [pdf-filename]
 * Ejemplo: node test-extraction.js "Visa pdf RN.pdf"
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Importar el procesador de documentos
const DocumentProcessor = require('./backend/src/lib/documentProcessor');

async function testExtraction(pdfFilename) {
  const pdfPath = path.join(__dirname, 'docs', pdfFilename);

  console.log('🔍 Testing extracción de PDF...\n');
  console.log('📄 PDF:', pdfFilename);
  console.log('📁 Ruta:', pdfPath);

  // Verificar que existe
  if (!fs.existsSync(pdfPath)) {
    console.error('\n❌ Error: PDF no encontrado\n');
    console.log('📁 PDFs disponibles en docs/:');
    const docsDir = path.join(__dirname, 'docs');
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));
      files.forEach(f => console.log('  -', f));
    }
    process.exit(1);
  }

  const fileStats = fs.statSync(pdfPath);
  console.log('📊 Tamaño:', (fileStats.size / 1024).toFixed(2), 'KB');
  console.log('\n⏳ Procesando PDF...\n');

  try {
    // 1. Extraer texto del PDF
    console.log('1️⃣  Extrayendo texto del PDF...');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);

    console.log('   ✅ Páginas:', pdfData.numpages);
    console.log('   ✅ Caracteres:', pdfData.text.length);
    console.log('   ✅ Primeros 200 caracteres:');
    console.log('   ', pdfData.text.substring(0, 200).replace(/\n/g, ' '));

    // 2. Extraer datos estructurados
    console.log('\n2️⃣  Extrayendo datos estructurados...');
    const processor = new DocumentProcessor();
    const extractedData = await processor.extractResumenTarjeta(pdfData.text);

    if (!extractedData) {
      console.error('\n❌ No se pudieron extraer datos del PDF');
      process.exit(1);
    }

    console.log('   ✅ Extracción completada!\n');

    // 3. Mostrar metadata
    console.log('📊 METADATA EXTRAÍDA:');
    console.log('   Período:', extractedData.metadata?.periodo || '(no detectado)');
    console.log('   Número Tarjeta:', extractedData.metadata?.numeroTarjeta || '(no detectado)');
    console.log('   Titular:', extractedData.metadata?.titularNombre || '(no detectado)');
    console.log('   Fecha Cierre:', extractedData.metadata?.fechaCierre || '(no detectado)');
    console.log('   Fecha Vencimiento:', extractedData.metadata?.fechaVencimiento || '(no detectado)');

    // 4. Mostrar transacciones
    console.log('\n💳 TRANSACCIONES EXTRAÍDAS:');
    console.log('   Total:', extractedData.transacciones?.length || 0);

    if (extractedData.transacciones && extractedData.transacciones.length > 0) {
      console.log('\n   Primeras 5 transacciones:');
      extractedData.transacciones.slice(0, 5).forEach((tx, idx) => {
        console.log(`\n   ${idx + 1}. Fecha: ${tx.fecha || 'N/A'}`);
        console.log(`      Descripción: ${tx.descripcion || 'N/A'}`);
        console.log(`      Importe: ${tx.importe || 'N/A'} ${tx.moneda || 'ARS'}`);
        console.log(`      Cupón: ${tx.numeroCupon || 'N/A'}`);
        if (tx.cuotas) console.log(`      Cuotas: ${tx.cuotas}`);
      });

      if (extractedData.transacciones.length > 5) {
        console.log(`\n   ... y ${extractedData.transacciones.length - 5} transacciones más`);
      }
    }

    // 5. Validaciones
    console.log('\n✅ VALIDACIONES:');
    const validations = {
      'Período detectado': !!extractedData.metadata?.periodo,
      'Número de tarjeta detectado': !!extractedData.metadata?.numeroTarjeta,
      'Al menos 1 transacción': extractedData.transacciones?.length > 0,
      'Transacciones con fecha': extractedData.transacciones?.some(t => t.fecha),
      'Transacciones con importe': extractedData.transacciones?.some(t => t.importe),
      'Transacciones con descripción': extractedData.transacciones?.some(t => t.descripcion)
    };

    let allValid = true;
    Object.entries(validations).forEach(([name, valid]) => {
      console.log(`   ${valid ? '✅' : '❌'} ${name}`);
      if (!valid) allValid = false;
    });

    // 6. Resumen final
    console.log('\n' + '='.repeat(50));
    if (allValid) {
      console.log('🎉 PRUEBA EXITOSA - Extracción completada correctamente');
      console.log('✅ El PDF está listo para ser importado al sistema');
    } else {
      console.log('⚠️  ADVERTENCIA - Algunos datos no se pudieron extraer');
      console.log('ℹ️  El PDF puede importarse pero algunos campos estarán vacíos');
    }
    console.log('='.repeat(50));

    // 7. Datos para mapeo a DKT
    console.log('\n📋 MAPEO A SCHEMA DKT:');
    console.log('   periodo →', extractedData.metadata?.periodo || 'NULL');
    console.log('   numeroTarjeta →', extractedData.metadata?.numeroTarjeta || 'NULL');
    console.log('   apellidoNombreUsuario →', extractedData.metadata?.titularNombre || 'NULL');
    console.log('   transacciones →', extractedData.transacciones?.length || 0, 'registros');

    console.log('\n💡 Para importar este PDF al sistema:');
    console.log('   1. Iniciar backend: cd backend && npm start');
    console.log('   2. Iniciar frontend: cd packages/web && npm run dev');
    console.log('   3. Ir a: http://localhost:3000/dkt/importar');
    console.log('   4. Seleccionar banco-tarjeta y subir:', pdfFilename);

  } catch (error) {
    console.error('\n❌ ERROR durante la extracción:\n');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Argumentos
const pdfFilename = process.argv[2] || 'Visa pdf RN.pdf';

testExtraction(pdfFilename);
