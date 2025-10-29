/**
 * Script de prueba para importación de PDFs de resúmenes de tarjeta
 *
 * Uso:
 *   node test-pdf-import.js <token> <bancoTipoTarjetaId> [tenantId]
 *
 * Ejemplo:
 *   node test-pdf-import.js "eyJhbGc..." "123e4567-e89b-12d3-a456-426614174000" "tenant-123"
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Configuración
const API_URL = process.env.API_URL || 'http://localhost:5050/api';
const PDF_PATH = path.join(__dirname, 'docs', 'Visa pdf RN.pdf'); // Cambiar según el PDF a probar

async function testPDFImport(token, bancoTipoTarjetaId, tenantId) {
  console.log('🚀 Iniciando prueba de importación de PDF...\n');

  // Verificar que el PDF existe
  if (!fs.existsSync(PDF_PATH)) {
    console.error('❌ Error: No se encontró el PDF en:', PDF_PATH);
    console.log('📁 PDFs disponibles:');
    const docsDir = path.join(__dirname, 'docs');
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));
      files.forEach(f => console.log('  -', f));
    }
    process.exit(1);
  }

  console.log('📄 PDF encontrado:', path.basename(PDF_PATH));
  const fileStats = fs.statSync(PDF_PATH);
  console.log('📊 Tamaño:', (fileStats.size / 1024 / 1024).toFixed(2), 'MB\n');

  // Preparar FormData
  const formData = new FormData();
  formData.append('archivo', fs.createReadStream(PDF_PATH));
  formData.append('bancoTipoTarjetaId', bancoTipoTarjetaId);

  // Configurar headers
  const headers = {
    ...formData.getHeaders(),
    'Authorization': `Bearer ${token}`
  };

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  try {
    console.log('📤 Enviando PDF al servidor...');
    console.log('🔗 Endpoint:', `${API_URL}/dkt/importar-pdf`);
    console.log('🏢 Tenant ID:', tenantId || '(ninguno)');
    console.log('💳 Banco-Tipo-Tarjeta ID:', bancoTipoTarjetaId);
    console.log('\n⏳ Esperando respuesta (puede tardar 10-60 segundos)...\n');

    const startTime = Date.now();

    const response = await axios.post(
      `${API_URL}/dkt/importar-pdf`,
      formData,
      {
        headers,
        timeout: 120000, // 2 minutos
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ ¡Importación exitosa!\n');
    console.log('⏱️  Tiempo total:', duration, 'segundos\n');
    console.log('📋 Resultado:');
    console.log('   Mensaje:', response.data.message);
    console.log('   Lote ID:', response.data.loteId);
    console.log('   Período:', response.data.periodo);
    console.log('   Total Registros:', response.data.totalRegistros);
    console.log('   Transacciones Extraídas:', response.data.transaccionesExtraidas);

    if (response.data.metadata) {
      console.log('\n📊 Metadata del PDF:');
      console.log('   Banco:', response.data.metadata.banco);
      console.log('   Tarjeta:', response.data.metadata.tarjeta);
      console.log('   Titular:', response.data.metadata.titular);
      console.log('   Número Tarjeta:', response.data.metadata.numeroTarjeta);
      console.log('   Fecha Cierre:', response.data.metadata.fechaCierre);
      console.log('   Fecha Vencimiento:', response.data.metadata.fechaVencimiento);
    }

    console.log('\n🎉 Prueba completada exitosamente!');
    console.log('\n💡 Verificar en la base de datos:');
    console.log(`   SELECT * FROM resumen_tarjeta WHERE "loteId" = '${response.data.loteId}' LIMIT 5;`);

  } catch (error) {
    console.error('\n❌ Error en la importación:\n');

    if (error.response) {
      console.error('📛 Status:', error.response.status);
      console.error('📄 Error:', error.response.data?.error || error.response.data);
      console.error('📝 Detalles:', error.response.data?.details);

      if (error.response.status === 409) {
        console.log('\nℹ️  El lote ya existe. Esto es normal si ya importaste este PDF antes.');
      } else if (error.response.status === 400) {
        console.log('\nℹ️  Error de validación. Verifica que:');
        console.log('   - El bancoTipoTarjetaId sea correcto');
        console.log('   - El tenant esté seleccionado (si es requerido)');
        console.log('   - El PDF sea un resumen de tarjeta válido');
      } else if (error.response.status === 401) {
        console.log('\nℹ️  Error de autenticación. Verifica que el token sea válido.');
      }
    } else if (error.request) {
      console.error('📡 No se recibió respuesta del servidor');
      console.error('🔌 ¿Está el backend corriendo en', API_URL, '?');
    } else {
      console.error('⚠️  Error:', error.message);
    }

    console.log('\n🔍 Debug info:');
    console.log('   API URL:', API_URL);
    console.log('   PDF Path:', PDF_PATH);
    console.log('   Token presente:', !!token);
    console.log('   Tenant ID:', tenantId || '(ninguno)');

    process.exit(1);
  }
}

// Validar argumentos
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('❌ Uso incorrecto\n');
  console.log('Uso:');
  console.log('  node test-pdf-import.js <token> <bancoTipoTarjetaId> [tenantId]\n');
  console.log('Ejemplo:');
  console.log('  node test-pdf-import.js "eyJhbGc..." "uuid-banco-tipo-tarjeta" "tenant-id"\n');
  console.log('📝 Nota: Puedes obtener el token desde las DevTools del navegador (localStorage.token)');
  console.log('📝 Nota: El bancoTipoTarjetaId lo obtienes de la tabla banco_tipo_tarjeta');
  process.exit(1);
}

const [token, bancoTipoTarjetaId, tenantId] = args;

// Ejecutar prueba
testPDFImport(token, bancoTipoTarjetaId, tenantId);
