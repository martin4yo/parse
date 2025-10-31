#!/usr/bin/env node

/**
 * Script de prueba para Claude Vision
 *
 * Prueba el flujo completo de extracción usando Claude Sonnet 3.7 con visión
 * para leer PDFs que contienen imágenes embebidas.
 *
 * Uso:
 *   node src/scripts/test-claude-vision-flow.js [ruta-al-pdf]
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const orchestrator = require('../services/documentExtractionOrchestrator');
const DocumentProcessor = require('../lib/documentProcessor');

// Crear instancia del procesador
const documentProcessor = new DocumentProcessor();

async function testClaudeVisionFlow() {
  try {
    // Obtener ruta del PDF desde argumentos o usar uno de prueba
    const pdfPath = process.argv[2] || path.join(__dirname, '../../uploads/test.pdf');

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🧪 TEST: Claude Vision - Flujo Completo de Extracción       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Verificar que el archivo existe
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ Error: Archivo no encontrado: ${pdfPath}`);
      console.log('\n💡 Uso: node src/scripts/test-claude-vision-flow.js [ruta-al-pdf]');
      process.exit(1);
    }

    console.log(`📄 Archivo: ${path.basename(pdfPath)}`);
    console.log(`📂 Ruta completa: ${pdfPath}`);

    const fileSizeKB = (fs.statSync(pdfPath).size / 1024).toFixed(2);
    console.log(`📊 Tamaño: ${fileSizeKB} KB`);

    // Verificar configuración
    console.log('\n🔧 Verificando configuración...');
    console.log(`   USE_CLAUDE_VISION: ${process.env.USE_CLAUDE_VISION}`);
    console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Configurada' : '✗ NO configurada'}`);
    console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Configurada' : '✗ NO configurada'}`);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('\n❌ Error: ANTHROPIC_API_KEY no configurada en .env');
      process.exit(1);
    }

    if (process.env.USE_CLAUDE_VISION !== 'true') {
      console.warn('\n⚠️  Advertencia: USE_CLAUDE_VISION no está en "true"');
      console.log('   Claude Vision no será utilizado como prioridad');
    }

    // Paso 1: Extraer texto del PDF
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  PASO 1: Extrayendo texto del PDF                          │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    const startExtract = Date.now();
    const pdfResult = await documentProcessor.processPDF(pdfPath);
    const extractTime = ((Date.now() - startExtract) / 1000).toFixed(2);

    if (!pdfResult.success) {
      console.error(`❌ Error extrayendo texto: ${pdfResult.error}`);
      process.exit(1);
    }

    console.log(`✅ Texto extraído: ${pdfResult.text.length} caracteres`);
    console.log(`⏱️  Tiempo: ${extractTime}s`);
    console.log(`\n📝 Primeros 200 caracteres:\n${pdfResult.text.substring(0, 200)}...`);

    // Paso 2: Extraer datos con Claude Vision (usando el orquestador)
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  PASO 2: Extrayendo datos con Claude Vision                │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    const tenantId = 'b88fa541-4d93-4f16-a707-95e70f7eecdc'; // Tenant de prueba
    const userId = 'test-user-id';

    const startVision = Date.now();
    const result = await orchestrator.extractData(
      pdfResult.text,
      tenantId,
      userId,
      pdfPath // ← Importante: pasar filePath para que use Claude Vision
    );
    const visionTime = ((Date.now() - startVision) / 1000).toFixed(2);

    // Mostrar resultados
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📊 RESULTADOS DE LA EXTRACCIÓN                               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`🤖 Método usado: ${result.metodo || 'Desconocido'}`);
    console.log(`⏱️  Tiempo de extracción: ${visionTime}s`);

    if (result.confidence) {
      console.log(`📈 Confianza: ${result.confidence.toFixed(1)}%`);
    }

    if (result.datos) {
      console.log('\n📋 Datos extraídos:');

      const datos = result.datos;

      if (datos.fecha) console.log(`   📅 Fecha: ${datos.fecha}`);
      if (datos.cuit) console.log(`   🏢 CUIT: ${datos.cuit}`);
      if (datos.razonSocial) console.log(`   🏷️  Razón Social: ${datos.razonSocial}`);
      if (datos.numeroComprobante) console.log(`   🔢 N° Comprobante: ${datos.numeroComprobante}`);
      if (datos.tipoComprobante) console.log(`   📄 Tipo: ${datos.tipoComprobante}`);
      if (datos.importe) console.log(`   💰 Importe: $${datos.importe}`);
      if (datos.netoGravado) console.log(`   💵 Neto Gravado: $${datos.netoGravado}`);
      if (datos.impuestos) console.log(`   📊 Impuestos: $${datos.impuestos}`);
      if (datos.moneda) console.log(`   💱 Moneda: ${datos.moneda}`);

      if (datos.lineItems && datos.lineItems.length > 0) {
        console.log(`\n   📦 Line Items: ${datos.lineItems.length} items`);
        datos.lineItems.forEach((item, i) => {
          console.log(`      ${i + 1}. ${item.descripcion || 'Sin descripción'}`);
          console.log(`         Cantidad: ${item.cantidad || '?'} | Precio: $${item.precioUnitario || '?'} | Total: $${item.totalLinea || '?'}`);
        });
      }

      if (datos.impuestosDetalle && datos.impuestosDetalle.length > 0) {
        console.log(`\n   💸 Impuestos Detalle:`);
        datos.impuestosDetalle.forEach((imp, i) => {
          console.log(`      ${i + 1}. ${imp.tipo || 'Impuesto'}: $${imp.importe || '?'} (${imp.alicuota || '?'}%)`);
        });
      }
    } else {
      console.log('⚠️  No se extrajeron datos');
    }

    // Estadísticas finales
    const totalTime = ((Date.now() - startExtract) / 1000).toFixed(2);
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ TEST COMPLETADO                                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`⏱️  Tiempo total: ${totalTime}s`);
    console.log(`   • Extracción de texto: ${extractTime}s (${((extractTime / totalTime) * 100).toFixed(1)}%)`);
    console.log(`   • Extracción de datos: ${visionTime}s (${((visionTime / totalTime) * 100).toFixed(1)}%)`);

    // Validación de éxito
    const camposExtraidos = result.datos ? Object.keys(result.datos).filter(k => result.datos[k] !== null && result.datos[k] !== undefined).length : 0;

    if (camposExtraidos >= 5) {
      console.log(`\n✅ ÉXITO: ${camposExtraidos} campos extraídos correctamente`);
    } else if (camposExtraidos >= 3) {
      console.log(`\n⚠️  PARCIAL: Solo ${camposExtraidos} campos extraídos`);
    } else {
      console.log(`\n❌ FALLO: Insuficientes datos extraídos (${camposExtraidos} campos)`);
    }

  } catch (error) {
    console.error('\n❌ Error en el test:', error.message);
    console.error('\n🔍 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Ejecutar test
testClaudeVisionFlow();
