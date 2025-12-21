/**
 * Parse API Pública - Ejemplo de uso con JavaScript/Node.js
 *
 * Este script demuestra cómo autenticarse y consultar documentos
 * usando la API pública de Parse con OAuth 2.0
 *
 * Instalación:
 *   npm install axios
 *
 * Uso:
 *   CLIENT_ID=your_client_id CLIENT_SECRET=your_secret node javascript-example.js
 */

const axios = require('axios');

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.parsedemo.axiomacloud.com';
const CLIENT_ID = process.env.CLIENT_ID || 'your_client_id_here';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'your_client_secret_here';

// Cliente HTTP con configuración base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Variables globales para tokens
let accessToken = null;
let refreshToken = null;

/**
 * Paso 1: Obtener access token
 */
async function obtenerToken() {
  console.log('📝 Obteniendo access token...');

  try {
    const response = await apiClient.post('/api/v1/auth/token', {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'read:documents write:documents read:files'
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;

    console.log('✅ Token obtenido exitosamente');
    console.log(`   Expira en: ${response.data.expires_in} segundos`);
    console.log(`   Scopes: ${response.data.scope}`);

    return accessToken;
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 2: Configurar cliente autenticado
 */
function configurarClienteAutenticado() {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
}

/**
 * Paso 3: Consultar información del cliente
 */
async function obtenerInfoCliente() {
  console.log('\n📊 Consultando información del cliente...');

  try {
    const response = await apiClient.get('/api/v1/auth/me');
    const info = response.data;

    console.log('✅ Información del cliente:');
    console.log(`   Cliente: ${info.nombre}`);
    console.log(`   Tenant: ${info.tenant.nombre}`);
    console.log(`   Scopes: ${info.scopes.join(', ')}`);
    console.log(`   Token expira: ${info.tokenExpiry}`);

    return info;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 4: Listar documentos con filtros
 */
async function listarDocumentos(filtros = {}) {
  console.log('\n📄 Listando documentos...');

  try {
    const response = await apiClient.get('/api/v1/documents', {
      params: {
        status: filtros.status || 'completado',
        exportado: filtros.exportado || false,
        limit: filtros.limit || 10,
        offset: filtros.offset || 0,
        sort: filtros.sort || 'fechaProcesamiento',
        order: filtros.order || 'desc'
      }
    });

    const { documents, pagination } = response.data.data;

    console.log(`✅ Encontrados ${pagination.total} documentos (mostrando ${documents.length})`);

    documents.forEach((doc, index) => {
      console.log(`\n   ${index + 1}. ${doc.tipoComprobanteExtraido} ${doc.numeroExtraido}`);
      console.log(`      Proveedor: ${doc.razonSocialExtraida} (${doc.cuitExtraido})`);
      console.log(`      Fecha: ${doc.fechaExtraida}`);
      console.log(`      Total: $${doc.totalExtraido}`);
      console.log(`      Exportado: ${doc.exportado ? 'Sí' : 'No'}`);
    });

    return { documents, pagination };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 5: Obtener detalle de un documento
 */
async function obtenerDocumento(documentoId) {
  console.log(`\n🔍 Obteniendo detalle del documento ${documentoId}...`);

  try {
    const response = await apiClient.get(`/api/v1/documents/${documentoId}`);
    const doc = response.data.data;

    console.log('✅ Detalle del documento:');
    console.log(`   ID: ${doc.id}`);
    console.log(`   Tipo: ${doc.tipoComprobanteExtraido}`);
    console.log(`   Número: ${doc.numeroExtraido}`);
    console.log(`   Fecha: ${doc.fechaExtraida}`);
    console.log(`   Proveedor: ${doc.razonSocialExtraida}`);
    console.log(`   Total: $${doc.totalExtraido}`);

    return doc;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 6: Obtener líneas de un documento
 */
async function obtenerLineasDocumento(documentoId) {
  console.log(`\n📋 Obteniendo líneas del documento ${documentoId}...`);

  try {
    const response = await apiClient.get(`/api/v1/documents/${documentoId}/lineas`);
    const lineas = response.data.data;

    console.log(`✅ ${lineas.length} línea(s) encontradas:`);

    lineas.forEach((linea, index) => {
      console.log(`\n   Línea ${linea.numeroLinea}:`);
      console.log(`      ${linea.descripcion}`);
      console.log(`      Cantidad: ${linea.cantidad} x $${linea.precioUnitario} = $${linea.total}`);
      if (linea.cuentaContable) {
        console.log(`      Cuenta: ${linea.cuentaContable}`);
      }
    });

    return lineas;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 7: Marcar documento como exportado
 */
async function marcarComoExportado(documentoId, externalId) {
  console.log(`\n✏️  Marcando documento ${documentoId} como exportado...`);

  try {
    const response = await apiClient.post(`/api/v1/documents/${documentoId}/mark-exported`, {
      externalSystemId: externalId,
      exportConfigId: 'mi-sistema-erp'
    });

    console.log('✅ Documento marcado como exportado');
    console.log(`   External ID: ${externalId}`);

    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 8: Descargar archivo original
 */
async function descargarArchivo(documentoId, rutaDestino) {
  console.log(`\n💾 Descargando archivo del documento ${documentoId}...`);

  try {
    const response = await apiClient.get(`/api/v1/documents/${documentoId}/file`, {
      responseType: 'arraybuffer'
    });

    const fs = require('fs').promises;
    await fs.writeFile(rutaDestino, response.data);

    console.log(`✅ Archivo descargado: ${rutaDestino}`);
    console.log(`   Tamaño: ${(response.data.length / 1024).toFixed(2)} KB`);

    return rutaDestino;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Paso 9: Refrescar access token
 */
async function refrescarToken() {
  console.log('\n🔄 Refrescando access token...');

  try {
    const response = await apiClient.post('/api/v1/auth/refresh', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    accessToken = response.data.access_token;
    configurarClienteAutenticado();

    console.log('✅ Token refrescado exitosamente');
    console.log(`   Expira en: ${response.data.expires_in} segundos`);

    return accessToken;
  } catch (error) {
    console.error('❌ Error refrescando token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Función principal - Ejecuta todos los ejemplos
 */
async function main() {
  try {
    console.log('🚀 Parse API Pública - Ejemplo de uso con JavaScript\n');
    console.log(`API URL: ${API_BASE_URL}`);
    console.log(`Cliente: ${CLIENT_ID}\n`);
    console.log('─'.repeat(60));

    // 1. Obtener token
    await obtenerToken();
    configurarClienteAutenticado();

    // 2. Verificar autenticación
    await obtenerInfoCliente();

    // 3. Listar documentos recientes
    const { documents } = await listarDocumentos({
      status: 'completado',
      limit: 5
    });

    // 4. Si hay documentos, obtener detalle del primero
    if (documents.length > 0) {
      const primerDocumento = documents[0];

      await obtenerDocumento(primerDocumento.id);
      await obtenerLineasDocumento(primerDocumento.id);

      // Descomentar para marcar como exportado
      // await marcarComoExportado(primerDocumento.id, 'ERP-12345');

      // Descomentar para descargar archivo
      // await descargarArchivo(primerDocumento.id, './documento.pdf');
    }

    // 5. Ejemplo de refresh token
    // await new Promise(resolve => setTimeout(resolve, 2000));
    // await refrescarToken();

    console.log('\n' + '─'.repeat(60));
    console.log('✅ Todos los ejemplos ejecutados exitosamente');

  } catch (error) {
    console.error('\n❌ Error en la ejecución:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

// Exportar funciones para uso como módulo
module.exports = {
  obtenerToken,
  listarDocumentos,
  obtenerDocumento,
  obtenerLineasDocumento,
  marcarComoExportado,
  descargarArchivo,
  refrescarToken
};
