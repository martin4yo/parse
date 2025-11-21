/**
 * Test final de validación con los valores reales del PDF
 */

const documentAIProcessor = require('../src/services/documentAIProcessor');

console.log('='.repeat(80));
console.log('TEST FINAL: Validación con Datos Reales del PDF');
console.log('='.repeat(80));

// Valores que Document AI detectó correctamente
const valoresDocumentAI = {
  totalImpuestos: 47448,
  netoGravado: 2965500,
  total: 3012948
};

console.log('\n📊 Valores detectados por Document AI:');
console.log(`   Total Impuestos: $${valoresDocumentAI.totalImpuestos.toLocaleString('es-AR')}`);
console.log(`   Neto Gravado: $${valoresDocumentAI.netoGravado.toLocaleString('es-AR')}`);
console.log(`   Total: $${valoresDocumentAI.total.toLocaleString('es-AR')}`);

// CASO PROBLEMÁTICO: El PDF tiene el neto gravado en la columna de "Percepcion IIBB"
const textoPDFProblematico = `Subtotal :
2,965,500.00
Percepcion IIBB :
2,965,500.00
TOTAL:
3,012,948.00`;

console.log('\n📝 Texto extraído del PDF (problemático):');
console.log('─'.repeat(80));
console.log(textoPDFProblematico.replace(/\n/g, '↵\n'));

console.log('\n🔍 Procesando con validación...\n');

const impuestos = documentAIProcessor.extractImpuestosDetalleFromText(
  textoPDFProblematico,
  valoresDocumentAI
);

console.log('\n' + '='.repeat(80));
console.log('RESULTADOS');
console.log('='.repeat(80));

if (impuestos.length === 0) {
  console.log('❌ ERROR: No se extrajo ningún impuesto');
} else {
  console.log(`✅ ${impuestos.length} impuesto(s) extraído(s):\n`);
  impuestos.forEach((imp, i) => {
    console.log(`${i + 1}. ${imp.descripcion}`);
    console.log(`   Tipo: ${imp.tipo}`);
    console.log(`   Importe: $${imp.importe.toLocaleString('es-AR')}`);
    if (imp.baseImponible) {
      console.log(`   Base Imponible: $${imp.baseImponible.toLocaleString('es-AR')}`);
    }
    console.log('');
  });
}

// VALIDACIÓN FINAL
console.log('='.repeat(80));
console.log('VALIDACIÓN FINAL');
console.log('='.repeat(80));

const importeExtraido = impuestos[0]?.importe || 0;
const importeEsperado = valoresDocumentAI.totalImpuestos;

if (Math.abs(importeExtraido - importeEsperado) < 1) {
  console.log(`\n✅ ✅ ✅ ÉXITO ✅ ✅ ✅`);
  console.log(`\nImporte extraído: $${importeExtraido.toLocaleString('es-AR')}`);
  console.log(`Importe esperado: $${importeEsperado.toLocaleString('es-AR')}`);
  console.log(`\n✅ El sistema ahora funciona correctamente con PDFs reales`);
  console.log(`✅ No confunde el neto gravado con el impuesto`);
  console.log(`✅ Usa el valor correcto de Document AI como fallback`);
} else {
  console.log(`\n❌ ❌ ❌ FALLO ❌ ❌ ❌`);
  console.log(`\nImporte extraído: $${importeExtraido.toLocaleString('es-AR')}`);
  console.log(`Importe esperado: $${importeEsperado.toLocaleString('es-AR')}`);
  console.log(`Diferencia: $${Math.abs(importeExtraido - importeEsperado).toLocaleString('es-AR')}`);
}

console.log('\n' + '='.repeat(80));
