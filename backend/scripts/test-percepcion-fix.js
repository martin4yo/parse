/**
 * Test de validación para fix de extracción de percepciones
 *
 * Problema: Document AI estaba capturando "Subtotal" como si fuera un impuesto
 * Solución: Validación explícita para excluir Subtotal, Total, Neto
 */

// Simular el texto del comprobante real
const textoComprobante = `
Subtotal :           2,965,500.00
Percepcion IIBB :       47,448.00
TOTAL:               3,012,948.00
CAE:                 75467757407997
Fecha Vto. CAE:      29/11/2025
`;

console.log('='.repeat(60));
console.log('TEST: Extracción de Percepciones IIBB');
console.log('='.repeat(60));

// Función normalizeAmount simplificada
function normalizeAmount(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  let cleaned = String(value).trim().replace(/[$€£¥₹₱\s]/g, '');

  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');

  if (hasComma && hasPeriod) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');

    if (lastComma > lastPeriod) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma && !hasPeriod) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  return Math.round(parsed * 100) / 100;
}

// Patrones de percepción (NUEVO - con exclusión de Subtotal)
const percepcionPatterns = [
  // "Percepción IIBB : 47,448.00" o "Percepcion IIBB : 47,448.00" (sin tilde)
  /Perc(?:epci[oó]n)?\s+IIBB\s*[:]\s*\$?\s*([\d.,]+)/gi,
  // "IIBB  5.00%  $1000.00  $50.00" (con alicuota, base e importe en tabla)
  /IIBB\s+([\d.,]+)%\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/gi,
  // Patrón genérico CON exclusión de Subtotal/Total/Neto
  /Perc(?:epci[oó]n)?\.?\s+(?!(?:Sub)?Total|Neto)([A-ZÑ\s]+?)\s*[:]\s*\$?\s*([\d.,]+)/gi
];

const impuestos = [];

console.log('\n📝 Texto del comprobante:');
console.log(textoComprobante);

console.log('\n🔍 Procesando patrones...\n');

for (const pattern of percepcionPatterns) {
  let match;
  while ((match = pattern.exec(textoComprobante)) !== null) {
    let descripcion, alicuota, baseImponible, importe;

    console.log(`🔍 [Percepción] Match encontrado: "${match[0]}"`);
    console.log(`   match[1]: "${match[1]}", match[2]: "${match[2]}", match[3]: "${match[3]}"`);

    // ⚠️ VALIDACIÓN: Excluir falsos positivos (Subtotal, Total, Neto)
    const matchText = match[0].toUpperCase();
    if (matchText.includes('SUBTOTAL') || matchText.includes('TOTAL') || matchText.includes('NETO')) {
      console.log(`   ⚠️ Descartado: "${match[0]}" (no es un impuesto, es un total)\n`);
      continue;
    }

    // Detectar qué patrón hizo match
    if (match[3]) {
      // Patrón con 3 grupos: alícuota, base e importe
      alicuota = normalizeAmount(match[1]);
      baseImponible = normalizeAmount(match[2]);
      importe = normalizeAmount(match[3]);
      descripcion = 'Percepción IIBB';
      console.log(`   ✅ Patrón tabla con %: alícuota=${alicuota}%, base=${baseImponible}, importe=${importe}`);
    } else if (match[0].match(/Perc(?:epci[oó]n)?\s+IIBB/i)) {
      // Patrón IIBB directo
      importe = normalizeAmount(match[1]);
      descripcion = 'Percepción IIBB';
      alicuota = null;
      baseImponible = null;
      console.log(`   ✅ Patrón IIBB directo: importe=${importe}`);
    } else {
      // Patrón genérico
      descripcion = `Percepción ${match[1]?.trim() || 'IIBB'}`;
      importe = normalizeAmount(match[2]);
      alicuota = null;
      baseImponible = null;
      console.log(`   ✅ Patrón genérico: descripción="${descripcion}", importe=${importe}`);
    }

    if (importe > 0) {
      impuestos.push({
        tipo: 'PERCEPCION',
        descripcion: descripcion,
        alicuota: alicuota,
        baseImponible: baseImponible,
        importe: importe
      });
      console.log(`   💾 Guardado como PERCEPCION\n`);
    }
  }
}

console.log('='.repeat(60));
console.log('RESULTADOS FINALES');
console.log('='.repeat(60));

if (impuestos.length === 0) {
  console.log('❌ ERROR: No se extrajo ningún impuesto');
} else {
  console.log(`✅ ${impuestos.length} impuesto(s) extraído(s):\n`);
  impuestos.forEach((imp, i) => {
    console.log(`${i + 1}. ${imp.descripcion}`);
    console.log(`   Tipo: ${imp.tipo}`);
    console.log(`   Importe: $${imp.importe.toLocaleString('es-AR')}`);
    if (imp.alicuota) {
      console.log(`   Alícuota: ${imp.alicuota}%`);
    }
    if (imp.baseImponible) {
      console.log(`   Base Imponible: $${imp.baseImponible.toLocaleString('es-AR')}`);
    }
    console.log('');
  });
}

console.log('='.repeat(60));
console.log('VALIDACIÓN');
console.log('='.repeat(60));

const expectedImporte = 47448.00;
const extractedImporte = impuestos[0]?.importe || 0;

if (Math.abs(extractedImporte - expectedImporte) < 0.01) {
  console.log(`✅ CORRECTO: Importe extraído (${extractedImporte}) = Esperado (${expectedImporte})`);
  console.log('✅ El fix funciona correctamente');
} else {
  console.log(`❌ ERROR: Importe extraído (${extractedImporte}) ≠ Esperado (${expectedImporte})`);
  console.log('❌ El fix NO está funcionando');
}

console.log('='.repeat(60));
