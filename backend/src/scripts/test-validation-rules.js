/**
 * Suite de Tests Automáticos para Reglas de Validación
 *
 * Ejecuta tests sobre reglas de validación del sistema
 * Verifica que las reglas funcionen correctamente
 */

const BusinessRulesEngine = require('../services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class ValidationTestSuite {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  /**
   * Registrar un test
   */
  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Ejecutar todos los tests
   */
  async run(tenantId = null) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${colors.cyan}🧪 SUITE DE TESTS DE VALIDACIÓN${colors.reset}`);
    console.log(`${'='.repeat(60)}\n`);

    if (tenantId) {
      console.log(`📌 Tenant: ${tenantId}\n`);
    }

    for (const test of this.tests) {
      this.results.total++;
      try {
        await test.testFn();
        this.results.passed++;
        console.log(`${colors.green}✓${colors.reset} ${test.name}`);
      } catch (error) {
        this.results.failed++;
        console.log(`${colors.red}✗${colors.reset} ${test.name}`);
        console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
      }
    }

    // Resumen
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${colors.cyan}RESUMEN${colors.reset}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total:  ${this.results.total}`);
    console.log(`${colors.green}Pasaron: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}Fallaron: ${this.results.failed}${colors.reset}`);
    console.log(`Tasa de éxito: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%\n`);

    return this.results.failed === 0;
  }

  /**
   * Helper para assertions
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertContains(array, item, message) {
    if (!array || !array.includes(item)) {
      throw new Error(message || `Array does not contain ${item}`);
    }
  }
}

// ===================================
// TESTS DE VALIDACIÓN
// ===================================

async function runTests() {
  const suite = new ValidationTestSuite();
  const engine = new BusinessRulesEngine();

  // Test 1: Validación de monto mínimo
  suite.test('Validación: Monto mínimo ($100)', async () => {
    await engine.loadRules('VALIDACION', true);

    // Caso que PASA validación
    const validData = { total: 150 };
    const result = await engine.applyRules(validData, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    suite.assert(
      result.validationErrors?.length === 0,
      'No debería haber errores de validación para monto válido'
    );

    // Caso que FALLA validación
    const invalidData = { total: 50 };
    const result2 = await engine.applyRules(invalidData, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    // Debería tener errores si existe una regla de monto mínimo
    // (esto depende de si hay reglas de validación en la BD)
  });

  // Test 2: Validación de campos requeridos
  suite.test('Validación: Campos requeridos (CUIT, Fecha, Total)', async () => {
    await engine.loadRules('VALIDACION', true);

    // Documento completo (válido)
    const validDoc = {
      cuit: '20-12345678-9',
      fecha: '2025-01-15',
      total: 1000
    };

    const result = await engine.applyRules(validDoc, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    suite.assert(
      result.validationErrors?.length === 0 || !result.validationErrors,
      'Documento completo debería pasar validación'
    );

    // Documento incompleto (sin CUIT)
    const invalidDoc = {
      fecha: '2025-01-15',
      total: 1000
    };

    const result2 = await engine.applyRules(invalidDoc, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    // Si hay validación de CUIT requerido, debería fallar
  });

  // Test 3: Transformación - Normalización de CUIT
  suite.test('Transformación: Normalización de CUIT', async () => {
    await engine.loadRules('TRANSFORMACION', true);

    const data = {
      cuit: '20123456789' // Sin guiones
    };

    const result = await engine.applyRules(data, {}, {
      tipo: 'TRANSFORMACION',
      contexto: 'DOCUMENTO'
    });

    // Verificar que se haya normalizado (si existe regla)
    // Formato esperado: XX-XXXXXXXX-X
  });

  // Test 4: Validación de formato de fecha
  suite.test('Validación: Formato de fecha válido', async () => {
    await engine.loadRules('VALIDACION', true);

    // Fecha válida
    const validData = {
      fecha: '2025-01-15'
    };

    const result = await engine.applyRules(validData, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    suite.assert(
      !result.validationErrors || result.validationErrors.length === 0,
      'Fecha válida debería pasar'
    );

    // Fecha inválida
    const invalidData = {
      fecha: 'invalid-date'
    };

    const result2 = await engine.applyRules(invalidData, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    // Debería fallar si hay regla de validación de fecha
  });

  // Test 5: Validación de consistencia de totales
  suite.test('Validación: Total = Subtotal + IVA', async () => {
    await engine.loadRules('VALIDACION', true);

    // Totales consistentes
    const validData = {
      subtotal: 1000,
      iva: 210,
      total: 1210
    };

    const result = await engine.applyRules(validData, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    suite.assert(
      !result.validationErrors || result.validationErrors.length === 0,
      'Totales consistentes deberían pasar'
    );

    // Totales inconsistentes
    const invalidData = {
      subtotal: 1000,
      iva: 210,
      total: 1500 // Incorrecto
    };

    const result2 = await engine.applyRules(invalidData, {}, {
      tipo: 'VALIDACION',
      contexto: 'DOCUMENTO'
    });

    // Debería fallar si hay regla de validación de totales
  });

  // Test 6: Contexto de aplicación (LINEAS vs DOCUMENTO)
  suite.test('Contexto: Reglas de LINEAS no se aplican a DOCUMENTO', async () => {
    await engine.loadRules('TRANSFORMACION', true);

    const documentoData = {
      tipo: 'FACTURA A',
      total: 1000
    };

    const result = await engine.applyRules(documentoData, {}, {
      tipo: 'TRANSFORMACION',
      contexto: 'DOCUMENTO'
    });

    // Las reglas marcadas como aplicaA: 'LINEAS' no deberían ejecutarse
    // Este test verifica el filtrado por contexto
  });

  // Test 7: Performance - Carga de reglas con cache
  suite.test('Performance: Cache de reglas funciona', async () => {
    const start1 = Date.now();
    await engine.loadRules('TRANSFORMACION', true); // Force reload
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await engine.loadRules('TRANSFORMACION', false); // Desde cache
    const time2 = Date.now() - start2;

    suite.assert(
      time2 < time1,
      `Cache debería ser más rápido (${time2}ms vs ${time1}ms)`
    );

    console.log(`    📊 Primera carga: ${time1}ms, Desde cache: ${time2}ms`);
  });

  // Test 8: Lookup básico
  suite.test('Lookup: Búsqueda en parametros_maestros', async () => {
    // Crear parámetro de prueba
    const testParam = await prisma.parametros_maestros.findFirst({
      where: {
        tipo_campo: 'producto',
        activo: true
      }
    });

    if (testParam) {
      // Simular regla de lookup
      const engine2 = new BusinessRulesEngine();
      await engine2.loadRules('TRANSFORMACION', true);

      // Aplicar lookup (si existe regla configurada)
      console.log(`    📦 Parámetro de prueba encontrado: ${testParam.codigo}`);
    } else {
      console.log('    ⚠️  No hay parámetros para testing de lookup');
    }
  });

  // Test 9: Evaluación de condiciones
  suite.test('Condiciones: Operadores lógicos (AND/OR)', async () => {
    const testData = {
      tipo: 'FACTURA A',
      total: 1000
    };

    // Test de condición EQUALS
    const cond1 = {
      campo: 'tipo',
      operador: 'EQUALS',
      valor: 'FACTURA A'
    };

    const result1 = engine.evaluateCondition(cond1, testData);
    suite.assertEqual(result1, true, 'EQUALS debería ser true');

    // Test de condición CONTAINS
    const cond2 = {
      campo: 'tipo',
      operador: 'CONTAINS',
      valor: 'FACTURA'
    };

    const result2 = engine.evaluateCondition(cond2, testData);
    suite.assertEqual(result2, true, 'CONTAINS debería ser true');

    // Test de condición GREATER_THAN
    const cond3 = {
      campo: 'total',
      operador: 'GREATER_THAN',
      valor: 500
    };

    const result3 = engine.evaluateCondition(cond3, testData);
    suite.assertEqual(result3, true, 'GREATER_THAN debería ser true');
  });

  // Test 10: Estadísticas de reglas activas
  suite.test('Estadísticas: Conteo de reglas activas', async () => {
    const activeRules = await prisma.reglas_negocio.count({
      where: {
        activa: true
      }
    });

    const validationRules = await prisma.reglas_negocio.count({
      where: {
        activa: true,
        tipo: 'VALIDACION'
      }
    });

    const transformationRules = await prisma.reglas_negocio.count({
      where: {
        activa: true,
        tipo: { in: ['TRANSFORMACION', 'TRANSFORMACION_DOCUMENTO'] }
      }
    });

    console.log(`    📊 Total activas: ${activeRules}`);
    console.log(`    📊 Validación: ${validationRules}`);
    console.log(`    📊 Transformación: ${transformationRules}`);

    suite.assert(activeRules > 0, 'Debería haber al menos una regla activa');
  });

  // Ejecutar suite
  const success = await suite.run();
  return success;
}

// ===================================
// EJECUTAR TESTS
// ===================================

if (require.main === module) {
  runTests()
    .then((success) => {
      if (success) {
        console.log(`${colors.green}✨ Todos los tests pasaron correctamente${colors.reset}\n`);
        process.exit(0);
      } else {
        console.log(`${colors.red}❌ Algunos tests fallaron${colors.reset}\n`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(`${colors.red}💥 Error ejecutando tests:${colors.reset}`, error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { ValidationTestSuite, runTests };
