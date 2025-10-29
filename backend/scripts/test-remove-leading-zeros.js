// Test para verificar qué devuelve REMOVE_LEADING_ZEROS

function testRemoveLeadingZeros() {
  console.log('🧪 Probando transformación REMOVE_LEADING_ZEROS...\n');

  // Esta es la función exacta del businessRulesEngine.js
  function removeLeadingZeros(value) {
    return String(value).replace(/^0+/, '') || '0';
  }

  const testCases = [
    '0000000000000',
    '0000000000001',
    '0',
    '00',
    '000',
    '0123456789',
    '1234567890',
    '',
    null,
    undefined
  ];

  console.log('📋 Resultados de transformación:');
  testCases.forEach(testCase => {
    try {
      const result = removeLeadingZeros(testCase);
      console.log(`   "${testCase}" → "${result}"`);
    } catch (error) {
      console.log(`   "${testCase}" → ERROR: ${error.message}`);
    }
  });

  console.log('\n🎯 Casos específicos importantes:');
  console.log(`   "0000000000000" → "${removeLeadingZeros('0000000000000')}"`);
  console.log(`   "0" → "${removeLeadingZeros('0')}"`);
  console.log(`   "00000" → "${removeLeadingZeros('00000')}"`);

  console.log('\n💡 Explicación:');
  console.log('   - replace(/^0+/, "") quita todos los ceros al inicio');
  console.log('   - Si queda vacío "", el || "0" devuelve "0"');
  console.log('   - Por tanto: cualquier cadena de solo ceros → "0"');
}

testRemoveLeadingZeros();