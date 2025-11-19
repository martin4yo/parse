/**
 * Test de debugging para entender el formato real del PDF
 *
 * Según los logs, Document AI está capturando:
 * "Percepcion IIBB :\n2,965,500.00"
 *
 * Pero el importe correcto es 47,448.00 (no 2,965,500.00)
 */

const documentAIProcessor = require('./src/services/documentAIProcessor');

console.log('='.repeat(80));
console.log('DEBUG: Formato Real del PDF según Document AI');
console.log('='.repeat(80));

// CASO 1: Texto del test (que funciona)
const textoTest = `
Subtotal :           2,965,500.00
Percepcion IIBB :       47,448.00
TOTAL:               3,012,948.00
`;

console.log('\n📋 CASO 1: Texto de Test (funciona)');
console.log('─'.repeat(80));
console.log(textoTest);

const impuestos1 = documentAIProcessor.extractImpuestosDetalleFromText(textoTest);
console.log(`\n✅ Impuestos extraídos: ${impuestos1.length}`);
if (impuestos1.length > 0) {
  console.log(`   Importe: $${impuestos1[0].importe.toLocaleString('es-AR')}`);
  console.log(`   Esperado: $47,448.00`);
  console.log(`   ${impuestos1[0].importe === 47448 ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
}

// CASO 2: Texto como parece venir del PDF (salto de línea después de ":")
const textoPDFReal = `Subtotal :
2,965,500.00
Percepcion IIBB :
47,448.00
TOTAL:
3,012,948.00`;

console.log('\n\n📋 CASO 2: Texto con saltos de línea (como viene del PDF)');
console.log('─'.repeat(80));
console.log(textoPDFReal.replace(/\n/g, '↵\n'));

const impuestos2 = documentAIProcessor.extractImpuestosDetalleFromText(textoPDFReal);
console.log(`\n${impuestos2.length > 0 ? '✅' : '❌'} Impuestos extraídos: ${impuestos2.length}`);
if (impuestos2.length > 0) {
  console.log(`   Importe: $${impuestos2[0].importe.toLocaleString('es-AR')}`);
  console.log(`   Esperado: $47,448.00`);
  console.log(`   ${impuestos2[0].importe === 47448 ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
}

// CASO 3: Texto como REALMENTE viene según los logs
// Según el log: match encontrado "Percepcion IIBB :\n2,965,500.00"
// Esto significa que el número 2,965,500.00 está en la SIGUIENTE línea
const textoPDFRealConfuso = `Subtotal :
2,965,500.00
Percepcion IIBB :
2,965,500.00
47,448.00
TOTAL:
3,012,948.00`;

console.log('\n\n📋 CASO 3: PDF con línea extra (neto gravado repetido)');
console.log('─'.repeat(80));
console.log(textoPDFRealConfuso.replace(/\n/g, '↵\n'));

const impuestos3 = documentAIProcessor.extractImpuestosDetalleFromText(textoPDFRealConfuso);
console.log(`\n${impuestos3.length > 0 ? '✅' : '❌'} Impuestos extraídos: ${impuestos3.length}`);
if (impuestos3.length > 0) {
  console.log(`   Importe: $${impuestos3[0].importe.toLocaleString('es-AR')}`);
  console.log(`   Esperado: $47,448.00`);
  console.log(`   ${impuestos3[0].importe === 47448 ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
}

// ANÁLISIS
console.log('\n\n' + '='.repeat(80));
console.log('📊 ANÁLISIS');
console.log('='.repeat(80));

console.log(`
El problema es que el PDF tiene una estructura de tabla, y Document AI lee:

┌─────────────────┬───────────────┐
│ Subtotal :      │ 2,965,500.00  │
├─────────────────┼───────────────┤
│ Percepcion IIBB:│    47,448.00  │  ← Este es el valor correcto
├─────────────────┼───────────────┤
│ TOTAL:          │ 3,012,948.00  │
└─────────────────┴───────────────┘

Pero al extraer el texto, puede venir como:
- Opción A: "Percepcion IIBB : 47,448.00" (mismo renglón) ✅
- Opción B: "Percepcion IIBB :\\n47,448.00" (siguiente línea) ✅ si el regex lo maneja
- Opción C: "Percepcion IIBB :\\n2,965,500.00" (agarra número equivocado) ❌

SOLUCIÓN NECESARIA:
1. Usar el valor que Document AI ya detectó: data.impuestos = 47448
2. Buscar si hay múltiples impuestos detallados (IVA, IIBB, etc.)
3. Si solo hay 1 impuesto y coincide con el total, usar ese valor directamente
`);

console.log('='.repeat(80));
