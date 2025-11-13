/**
 * Ejemplos de cómo extraer valores de JSON complejos en parametros_maestros
 */

// EJEMPLO 1: JSON simple
const jsonSimple = {
  "cuenta_contable": "1105020101",
  "categoria": "materiales"
};
// campoJSON: "cuenta_contable" → Retorna: "1105020101"
// campoJSON: "categoria" → Retorna: "materiales"


// EJEMPLO 2: JSON con objeto anidado
const jsonAnidado = {
  "cuentas": {
    "compra": "1105020101",
    "venta": "4105010101",
    "inventario": "1105010101"
  },
  "categoria": "materiales"
};
// campoJSON: "cuentas.compra" → Retorna: "1105020101"
// campoJSON: "cuentas.venta" → Retorna: "4105010101"
// campoJSON: "cuentas.inventario" → Retorna: "1105010101"


// EJEMPLO 3: JSON con arrays
const jsonConArray = {
  "cuentas_contables": [
    {
      "tipo": "compra",
      "cuenta": "1105020101"
    },
    {
      "tipo": "venta",
      "cuenta": "4105010101"
    }
  ],
  "categoria": "materiales"
};
// campoJSON: "cuentas_contables[0].cuenta" → Retorna: "1105020101" (primera cuenta)
// campoJSON: "cuentas_contables[1].cuenta" → Retorna: "4105010101" (segunda cuenta)


// EJEMPLO 4: JSON complejo (caso real)
const jsonComplejo = {
  "cuenta_contable": "1105020101",
  "contabilidad": {
    "cuenta_compra": "1105020101",
    "cuenta_venta": "4105010101",
    "centro_costo": "CC001",
    "subcuenta": {
      "codigo": "SUB001",
      "nombre": "Materiales Directos"
    }
  },
  "fiscal": {
    "alicuota_iva": 21,
    "exento": false
  },
  "categoria": "materiales"
};
// Ejemplos de extracción:
// campoJSON: "cuenta_contable" → "1105020101"
// campoJSON: "contabilidad.cuenta_compra" → "1105020101"
// campoJSON: "contabilidad.cuenta_venta" → "4105010101"
// campoJSON: "contabilidad.centro_costo" → "CC001"
// campoJSON: "contabilidad.subcuenta.codigo" → "SUB001"
// campoJSON: "contabilidad.subcuenta.nombre" → "Materiales Directos"
// campoJSON: "fiscal.alicuota_iva" → 21
// campoJSON: "fiscal.exento" → false

console.log('📋 Ejemplos de extracción de JSON');
console.log('\n=== EJEMPLO 1: JSON Simple ===');
console.log('JSON:', JSON.stringify(jsonSimple, null, 2));
console.log('\nExtracción:');
console.log('  campoJSON: "cuenta_contable" → "1105020101"');
console.log('  campoJSON: "categoria" → "materiales"');

console.log('\n=== EJEMPLO 2: JSON Anidado ===');
console.log('JSON:', JSON.stringify(jsonAnidado, null, 2));
console.log('\nExtracción:');
console.log('  campoJSON: "cuentas.compra" → "1105020101"');
console.log('  campoJSON: "cuentas.venta" → "4105010101"');
console.log('  campoJSON: "cuentas.inventario" → "1105010101"');

console.log('\n=== EJEMPLO 3: JSON con Arrays ===');
console.log('JSON:', JSON.stringify(jsonConArray, null, 2));
console.log('\nExtracción:');
console.log('  campoJSON: "cuentas_contables[0].cuenta" → "1105020101"');
console.log('  campoJSON: "cuentas_contables[1].cuenta" → "4105010101"');

console.log('\n=== EJEMPLO 4: JSON Complejo ===');
console.log('JSON:', JSON.stringify(jsonComplejo, null, 2));
console.log('\nExtracción:');
console.log('  campoJSON: "contabilidad.cuenta_compra" → "1105020101"');
console.log('  campoJSON: "contabilidad.subcuenta.codigo" → "SUB001"');
console.log('  campoJSON: "fiscal.alicuota_iva" → 21');

console.log('\n💡 REGLA DE SINTAXIS:');
console.log('  - Usar punto (.) para objetos anidados: "objeto.campo"');
console.log('  - Usar corchetes [0] para arrays: "array[0].campo"');
console.log('  - Combinar ambos: "objeto.array[0].campo.subcampo"');
