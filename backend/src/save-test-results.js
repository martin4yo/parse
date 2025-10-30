const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

/**
 * Script para guardar los resultados del test de pipeline en la BD
 */

async function saveTestResults() {
  console.log('💾 ===== GUARDANDO RESULTADOS EN BASE DE DATOS =====\n');

  // Leer archivo de resultados
  const resultsDir = path.join(__dirname, '../../test-results');
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('test-results-') && f.endsWith('.json'))
    .sort()
    .reverse(); // Más reciente primero

  if (files.length === 0) {
    console.error('❌ No se encontraron archivos de resultados');
    process.exit(1);
  }

  const latestFile = files[0];
  const resultsPath = path.join(resultsDir, latestFile);

  console.log(`📄 Leyendo: ${latestFile}\n`);

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Obtener tenant por defecto (el primero que encuentre)
  const tenant = await prisma.tenants.findFirst({
    select: { id: true, nombre: true }
  });

  if (!tenant) {
    console.error('❌ No hay tenants en la base de datos');
    console.log('   Crea un tenant primero o ejecuta los seeds');
    process.exit(1);
  }

  // Obtener usuario por defecto
  const user = await prisma.users.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true, email: true }
  });

  if (!user) {
    console.error('❌ No hay usuarios para el tenant');
    process.exit(1);
  }

  console.log(`🏢 Tenant: ${tenant.nombre} (${tenant.id})`);
  console.log(`👤 Usuario: ${user.email} (${user.id})\n`);

  // Filtrar solo resultados exitosos
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  console.log(`✅ Documentos exitosos: ${successResults.length}`);
  console.log(`❌ Documentos fallidos: ${failedResults.length}\n`);

  let savedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const result of successResults) {
    try {
      console.log(`📄 Procesando: ${result.fileName}`);

      // Verificar si ya existe el documento
      const existing = await prisma.documentos_procesados.findFirst({
        where: {
          tenantId: tenant.id,
          nombreArchivo: result.fileName
        }
      });

      if (existing) {
        console.log(`   ⚠️  Ya existe en BD, saltando...`);
        skippedCount++;
        continue;
      }

      const datos = result.datos;
      const clasificacion = result.clasificacion;

      // Preparar ruta de archivo (simular que está en la carpeta de uploads)
      const rutaArchivo = path.join('uploads/test-documents', result.fileName);

      // Crear documento procesado
      const now = new Date();
      const documento = await prisma.documentos_procesados.create({
        data: {
          id: uuidv4(),
          tenantId: tenant.id,
          usuarioId: user.id,
          nombreArchivo: result.fileName,
          tipoArchivo: 'pdf',
          rutaArchivo: rutaArchivo,
          tipo: 'tarjeta', // Asumimos tarjeta por defecto
          estadoProcesamiento: 'completado',

          // Datos extraídos
          datosExtraidos: datos,
          fechaExtraida: datos.fecha ? new Date(datos.fecha) : null,
          importeExtraido: datos.importe ? parseFloat(datos.importe) : null,
          cuitExtraido: datos.cuit || null,
          numeroComprobanteExtraido: datos.numeroComprobante || null,
          razonSocialExtraida: datos.razonSocial || null,
          tipoComprobanteExtraido: datos.tipoComprobante || clasificacion.tipo,
          caeExtraido: datos.cae || null,
          netoGravadoExtraido: datos.netoGravado ? parseFloat(datos.netoGravado) : null,
          exentoExtraido: datos.exento ? parseFloat(datos.exento) : null,
          impuestosExtraido: datos.impuestos ? parseFloat(datos.impuestos) : null,
          cuponExtraido: datos.cupon || null,
          modeloIA: 'claude-3-haiku-20240307',

          observaciones: `Pipeline Test - Clasificación: ${clasificacion.tipo} (${(clasificacion.confianza * 100).toFixed(1)}%) - Duración: ${(result.duracion / 1000).toFixed(2)}s`,

          createdAt: now,
          updatedAt: now
        }
      });

      console.log(`   ✅ Documento guardado: ${documento.id}`);

      // Guardar line items
      if (datos.lineItems && Array.isArray(datos.lineItems)) {
        for (const item of datos.lineItems) {
          await prisma.documento_lineas.create({
            data: {
              documentoId: documento.id,
              tenantId: tenant.id,
              numero: item.numero || 1,
              descripcion: item.descripcion || 'Sin descripción',
              codigoProducto: item.codigoProducto,
              cantidad: item.cantidad ? parseFloat(item.cantidad) : 1,
              unidad: item.unidad || 'UN',
              precioUnitario: item.precioUnitario ? parseFloat(item.precioUnitario) : 0,
              subtotal: item.subtotal ? parseFloat(item.subtotal) : 0,
              alicuotaIva: item.alicuotaIva ? parseFloat(item.alicuotaIva) : null,
              importeIva: item.importeIva ? parseFloat(item.importeIva) : null,
              totalLinea: item.totalLinea ? parseFloat(item.totalLinea) : 0
            }
          });
        }
        console.log(`   ✅ ${datos.lineItems.length} líneas guardadas`);
      }

      // Guardar impuestos detallados
      if (datos.impuestosDetalle && Array.isArray(datos.impuestosDetalle)) {
        for (const impuesto of datos.impuestosDetalle) {
          await prisma.documento_impuestos.create({
            data: {
              documentoId: documento.id,
              tenantId: tenant.id,
              tipo: impuesto.tipo || 'IVA',
              descripcion: impuesto.descripcion || 'Impuesto',
              alicuota: impuesto.alicuota ? parseFloat(impuesto.alicuota) : null,
              baseImponible: impuesto.baseImponible ? parseFloat(impuesto.baseImponible) : null,
              importe: impuesto.importe ? parseFloat(impuesto.importe) : 0
            }
          });
        }
        console.log(`   ✅ ${datos.impuestosDetalle.length} impuestos guardados`);
      }

      savedCount++;
      console.log('');

    } catch (error) {
      console.error(`   ❌ Error guardando ${result.fileName}:`, error.message);
      errorCount++;
      console.log('');
    }
  }

  console.log('\n🎉 ===== PROCESO COMPLETADO =====\n');
  console.log(`✅ Guardados: ${savedCount}`);
  console.log(`⚠️  Saltados (ya existían): ${skippedCount}`);
  console.log(`❌ Errores: ${errorCount}`);

  // Mostrar resumen de BD
  const totalDocs = await prisma.documentos_procesados.count({
    where: { tenantId: tenant.id }
  });

  const totalLineas = await prisma.documento_lineas.count({
    where: { tenantId: tenant.id }
  });

  const totalImpuestos = await prisma.documento_impuestos.count({
    where: { tenantId: tenant.id }
  });

  console.log(`\n📊 Estado actual de la BD (tenant: ${tenant.nombre}):`);
  console.log(`   📄 Documentos procesados: ${totalDocs}`);
  console.log(`   📋 Líneas de items: ${totalLineas}`);
  console.log(`   💰 Impuestos: ${totalImpuestos}`);

  console.log('\n✅ Datos guardados exitosamente!\n');
}

async function main() {
  try {
    await saveTestResults();
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
