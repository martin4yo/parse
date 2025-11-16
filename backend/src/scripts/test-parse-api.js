const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script de prueba para Parse API
 *
 * Funciones:
 * - Crea una API key de prueba
 * - Prueba los 3 endpoints principales
 * - Valida respuestas
 * - Limpia datos al finalizar
 */

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5100/api/v1/parse';
let TEST_API_KEY = null;
let TEST_TENANT_ID = null;

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Crear API key de prueba
 */
async function crearAPIKeyPrueba() {
  try {
    log('\n🔑 PASO 1: Crear API key de prueba', 'cyan');
    log('=' .repeat(60), 'cyan');

    // Obtener primer tenant activo
    const tenant = await prisma.tenants.findFirst({
      where: { activo: true }
    });

    if (!tenant) {
      throw new Error('No hay tenants activos en la base de datos');
    }

    TEST_TENANT_ID = tenant.id;
    log(`   Tenant: ${tenant.nombre}`, 'blue');

    // Generar API key única
    const crypto = require('crypto');
    const apiKey = `sk_test_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Crear registro en BD
    const apiKeyRecord = await prisma.sync_api_keys.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        nombre: 'Test Parse API - Auto-generated',
        key: hashedKey,
        keyPreview: `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`,
        permisos: {
          parse: true,
          applyRules: true,
          sync: false
        },
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    TEST_API_KEY = apiKey;

    log(`   ✅ API key creada: ${apiKeyRecord.keyPreview}`, 'green');
    log(`   ID: ${apiKeyRecord.id}`, 'blue');
    log(`   Permisos: parse ✓, applyRules ✓`, 'blue');

    return apiKeyRecord.id;

  } catch (error) {
    log(`   ❌ Error creando API key: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Test 1: GET /health
 */
async function testHealthCheck() {
  try {
    log('\n📊 TEST 1: GET /health (sin autenticación)', 'cyan');
    log('=' .repeat(60), 'cyan');

    const response = await axios.get(`${API_BASE_URL}/health`);

    if (response.status === 200 && response.data.success) {
      log(`   ✅ Status: ${response.status}`, 'green');
      log(`   ✅ Service: ${response.data.service}`, 'green');
      log(`   ✅ Version: ${response.data.version}`, 'green');
      return true;
    } else {
      log(`   ❌ Respuesta inesperada`, 'red');
      return false;
    }

  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 2: POST /document
 */
async function testParseDocument() {
  try {
    log('\n📄 TEST 2: POST /document (parsear documento)', 'cyan');
    log('=' .repeat(60), 'cyan');

    // Crear un documento de prueba simple
    const testFilePath = path.join(__dirname, '../../../test-files/sample-invoice.txt');

    // Crear directorio si no existe
    const testDir = path.dirname(testFilePath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Crear archivo de prueba con datos de factura
    const invoiceContent = `
FACTURA A
Punto de Venta: 0003
Número: 00012345
Fecha: 15/01/2025

CUIT: 20-12345678-9
Razón Social: Proveedor de Prueba SA

ITEMS:
1 x Producto Test - $10,000.00

Subtotal: $10,000.00
IVA 21%: $2,100.00
TOTAL: $12,100.00

CAE: 72345678901234
    `.trim();

    fs.writeFileSync(testFilePath, invoiceContent, 'utf-8');
    log(`   Archivo de prueba creado: ${testFilePath}`, 'blue');

    // Crear form-data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('tipoDocumento', 'AUTO');

    const response = await axios.post(`${API_BASE_URL}/document`, form, {
      headers: {
        'X-API-Key': TEST_API_KEY,
        ...form.getHeaders()
      }
    });

    // Limpiar archivo de prueba
    fs.unlinkSync(testFilePath);

    if (response.status === 200 && response.data.success) {
      log(`   ✅ Status: ${response.status}`, 'green');
      log(`   ✅ Documento parseado correctamente`, 'green');
      log(`   ✅ Cabecera presente: ${!!response.data.documento.cabecera}`, 'green');
      log(`   ✅ Items: ${response.data.documento.items?.length || 0}`, 'green');
      log(`   ✅ Impuestos: ${response.data.documento.impuestos?.length || 0}`, 'green');
      log(`   ✅ Modelo IA: ${response.data.metadata?.modeloIA}`, 'green');
      log(`   ✅ Tiempo: ${response.data.metadata?.processingTimeMs}ms`, 'green');
      return response.data.documento;
    } else {
      log(`   ❌ Respuesta inesperada`, 'red');
      return null;
    }

  } catch (error) {
    log(`   ❌ Error: ${error.response?.data?.error || error.message}`, 'red');
    if (error.response?.data?.details) {
      log(`   Detalles: ${error.response.data.details}`, 'yellow');
    }
    return null;
  }
}

/**
 * Test 3: POST /apply-rules
 */
async function testApplyRules(documento) {
  try {
    log('\n🔧 TEST 3: POST /apply-rules (aplicar reglas)', 'cyan');
    log('=' .repeat(60), 'cyan');

    if (!documento) {
      log(`   ⚠️  Saltando test (no hay documento del test anterior)`, 'yellow');
      return null;
    }

    const response = await axios.post(`${API_BASE_URL}/apply-rules`, {
      documento,
      tipoReglas: 'TRANSFORMACION'
    }, {
      headers: {
        'X-API-Key': TEST_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200 && response.data.success) {
      log(`   ✅ Status: ${response.status}`, 'green');
      log(`   ✅ Reglas aplicadas correctamente`, 'green');
      log(`   ✅ Reglas cargadas: ${response.data.estadisticas?.totalReglasCargadas}`, 'green');
      log(`   ✅ Reglas ejecutadas: ${response.data.estadisticas?.reglasEjecutadas}`, 'green');
      log(`   ✅ Items procesados: ${response.data.estadisticas?.itemsProcesados}`, 'green');
      log(`   ✅ Tiempo: ${response.data.estadisticas?.processingTimeMs}ms`, 'green');

      if (response.data.reglasAplicadas?.length > 0) {
        log(`\n   📋 Reglas aplicadas:`, 'blue');
        response.data.reglasAplicadas.forEach((regla, i) => {
          log(`      ${i + 1}. ${regla.codigo} - ${regla.nombre}`, 'blue');
        });
      }

      return response.data;
    } else {
      log(`   ❌ Respuesta inesperada`, 'red');
      return null;
    }

  } catch (error) {
    log(`   ❌ Error: ${error.response?.data?.error || error.message}`, 'red');
    return null;
  }
}

/**
 * Test 4: POST /full
 */
async function testFullProcessing() {
  try {
    log('\n🚀 TEST 4: POST /full (procesamiento completo)', 'cyan');
    log('=' .repeat(60), 'cyan');

    // Crear documento de prueba
    const testFilePath = path.join(__dirname, '../../../test-files/sample-full.txt');
    const testDir = path.dirname(testFilePath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const invoiceContent = `
FACTURA B
PV: 0005 - Nro: 00067890
Fecha: 16/01/2025

CUIT: 20-98765432-1
Razón Social: Otro Proveedor SRL

DETALLE:
Bandeja acero inoxidable - 3 unidades - $15,000.00
Subtotal: $15,000.00
IVA 21%: $3,150.00
TOTAL: $18,150.00
    `.trim();

    fs.writeFileSync(testFilePath, invoiceContent, 'utf-8');

    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('tipoDocumento', 'AUTO');
    form.append('aplicarReglas', 'true');

    const response = await axios.post(`${API_BASE_URL}/full`, form, {
      headers: {
        'X-API-Key': TEST_API_KEY,
        ...form.getHeaders()
      }
    });

    fs.unlinkSync(testFilePath);

    if (response.status === 200 && response.data.success) {
      log(`   ✅ Status: ${response.status}`, 'green');
      log(`   ✅ Procesamiento completo exitoso`, 'green');
      log(`   ✅ Documento parseado: ${!!response.data.documentoParsed}`, 'green');
      log(`   ✅ Documento transformado: ${!!response.data.documentoTransformado}`, 'green');
      log(`   ✅ Reglas aplicadas: ${response.data.reglasAplicadas?.length || 0}`, 'green');
      log(`   ✅ Tiempo parse: ${response.data.metadata?.parseTimeMs}ms`, 'green');
      log(`   ✅ Tiempo reglas: ${response.data.metadata?.rulesTimeMs}ms`, 'green');
      log(`   ✅ Tiempo total: ${response.data.metadata?.totalTimeMs}ms`, 'green');
      return true;
    } else {
      log(`   ❌ Respuesta inesperada`, 'red');
      return false;
    }

  } catch (error) {
    log(`   ❌ Error: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
}

/**
 * Test 5: Validar permisos
 */
async function testPermissions() {
  try {
    log('\n🔐 TEST 5: Validar permisos (API key sin permisos)', 'cyan');
    log('=' .repeat(60), 'cyan');

    // Crear API key sin permisos
    const crypto = require('crypto');
    const apiKeyNoPerms = `sk_test_noperms_${crypto.randomBytes(16).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(apiKeyNoPerms).digest('hex');

    const apiKeyRecord = await prisma.sync_api_keys.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: TEST_TENANT_ID,
        nombre: 'Test No Permissions',
        key: hashedKey,
        keyPreview: `${apiKeyNoPerms.substring(0, 12)}...`,
        permisos: {
          parse: false,
          applyRules: false
        },
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Intentar parsear sin permiso
    const testFilePath = path.join(__dirname, '../../../test-files/test-perm.txt');
    fs.writeFileSync(testFilePath, 'test', 'utf-8');

    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));

    try {
      await axios.post(`${API_BASE_URL}/document`, form, {
        headers: {
          'X-API-Key': apiKeyNoPerms,
          ...form.getHeaders()
        }
      });
      log(`   ❌ Debería haber fallado por falta de permisos`, 'red');
      return false;
    } catch (error) {
      if (error.response?.status === 403) {
        log(`   ✅ Rechazado correctamente (403 Forbidden)`, 'green');
        log(`   ✅ Mensaje: ${error.response.data.error}`, 'green');
      } else {
        log(`   ❌ Error inesperado: ${error.message}`, 'red');
        return false;
      }
    }

    // Limpiar
    fs.unlinkSync(testFilePath);
    await prisma.sync_api_keys.delete({ where: { id: apiKeyRecord.id } });

    return true;

  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Limpiar datos de prueba
 */
async function limpiar(apiKeyId) {
  try {
    log('\n🧹 LIMPIEZA: Eliminar datos de prueba', 'cyan');
    log('=' .repeat(60), 'cyan');

    if (apiKeyId) {
      await prisma.sync_api_keys.delete({
        where: { id: apiKeyId }
      });
      log(`   ✅ API key de prueba eliminada`, 'green');
    }

    // Limpiar directorio de archivos de prueba
    const testDir = path.join(__dirname, '../../../test-files');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
      log(`   ✅ Archivos de prueba eliminados`, 'green');
    }

    log(`   ✅ Limpieza completada`, 'green');

  } catch (error) {
    log(`   ⚠️  Error en limpieza: ${error.message}`, 'yellow');
  }
}

/**
 * Ejecutar todos los tests
 */
async function runTests() {
  log('\n🧪 PARSE API - TEST SUITE', 'bright');
  log('=' .repeat(60), 'bright');
  log(`   Base URL: ${API_BASE_URL}`, 'blue');
  log(`   Fecha: ${new Date().toLocaleString()}`, 'blue');

  let apiKeyId = null;
  const results = {
    health: false,
    parse: false,
    rules: false,
    full: false,
    permissions: false
  };

  try {
    // Crear API key
    apiKeyId = await crearAPIKeyPrueba();

    // Ejecutar tests
    results.health = await testHealthCheck();
    const documento = await testParseDocument();
    results.parse = !!documento;
    results.rules = !!(await testApplyRules(documento));
    results.full = await testFullProcessing();
    results.permissions = await testPermissions();

  } catch (error) {
    log(`\n❌ Error fatal: ${error.message}`, 'red');
  } finally {
    // Limpiar
    await limpiar(apiKeyId);
    await prisma.$disconnect();
  }

  // Resumen
  log('\n📊 RESUMEN DE TESTS', 'bright');
  log('=' .repeat(60), 'bright');

  const tests = [
    { name: 'Health Check', result: results.health },
    { name: 'Parse Document', result: results.parse },
    { name: 'Apply Rules', result: results.rules },
    { name: 'Full Processing', result: results.full },
    { name: 'Permissions', result: results.permissions }
  ];

  tests.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    const color = test.result ? 'green' : 'red';
    log(`   ${status} - ${test.name}`, color);
  });

  const passed = tests.filter(t => t.result).length;
  const total = tests.length;
  const percentage = ((passed / total) * 100).toFixed(0);

  log(`\n   Total: ${passed}/${total} tests pasaron (${percentage}%)`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🎉 ¡TODOS LOS TESTS PASARON!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Algunos tests fallaron', 'yellow');
    process.exit(1);
  }
}

// Ejecutar
runTests().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
