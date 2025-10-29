/**
 * Script para ver el texto extraído del PDF y ayudar a ajustar los regex
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function debugPDFText(pdfFilename) {
  const pdfPath = path.join(__dirname, '..', 'docs', pdfFilename);

  console.log('🔍 Extrayendo texto del PDF para debug...\n');

  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);

  console.log('📄 Páginas:', pdfData.numpages);
  console.log('📊 Total caracteres:', pdfData.text.length);
  console.log('\n' + '='.repeat(80));
  console.log('TEXTO COMPLETO (primeros 5000 caracteres):');
  console.log('='.repeat(80));
  console.log(pdfData.text.substring(0, 5000));
  console.log('='.repeat(80));

  // Buscar líneas que puedan ser transacciones
  console.log('\n🔍 Buscando líneas con números (posibles transacciones):\n');
  const lines = pdfData.text.split('\n');
  const linesWithNumbers = lines.filter(line => {
    // Líneas que tienen fecha al inicio (DD Mes DD o DD-Mes-DD)
    return /^\d{1,2}\s+[A-Za-z]+\s+\d{1,2}/.test(line) || /^\d{1,2}-[A-Za-z]{3}-\d{2}/.test(line);
  });

  console.log('Líneas con patrón de fecha encontradas:', linesWithNumbers.length);
  console.log('\nPrimeras 10 líneas:');
  linesWithNumbers.slice(0, 10).forEach((line, idx) => {
    console.log(`${idx + 1}. ${line}`);
  });
}

const pdfFilename = process.argv[2] || 'Visa pdf RN.pdf';
debugPDFText(pdfFilename);
