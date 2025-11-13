/**
 * Script para revisar los items del último documento procesado
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkItems() {
  try {
    const doc = await prisma.documentos_procesados.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        documento_lineas: {
          orderBy: { numero: 'asc' }
        }
      }
    });

    if (!doc) {
      console.log('No se encontró ningún documento');
      return;
    }

    console.log('📄 Documento:', doc.numeroDocumento);
    console.log('🔢 Total items:', doc.documento_lineas.length);
    console.log('\n📋 Items:\n');

    doc.documento_lineas.forEach((item, i) => {
      console.log(`Item ${i + 1} (línea ${item.numero}):`);
      console.log(`  Descripción: ${item.descripcion}`);
      console.log(`  Código Producto: ${item.codigoProducto || 'NULL'}`);
      console.log(`  Tipo Producto: ${item.tipoProducto || 'NULL'}`);

      if (item.codigoProducto === 'ND' || !item.codigoProducto) {
        console.log('  ⚠️ NO SE RESOLVIÓ EL CÓDIGO');
      } else {
        console.log('  ✅ CÓDIGO RESUELTO');
      }
      console.log('');
    });

    // Buscar sugerencias IA para estos items
    console.log('\n🤖 Sugerencias IA para este documento:\n');
    const sugerencias = await prisma.sugerencias_ia.findMany({
      where: {
        entidadId: {
          in: doc.documento_lineas.map(l => l.id)
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (sugerencias.length > 0) {
      sugerencias.forEach(sug => {
        const item = doc.documento_lineas.find(l => l.id === sug.entidadId);
        console.log(`Sugerencia para item: ${item?.descripcion}`);
        console.log(`  Campo: ${sug.campoAfectado}`);
        console.log(`  Valor sugerido: ${sug.valorSugerido}`);
        console.log(`  Valor original: ${sug.valorOriginal}`);
        console.log(`  Confianza: ${sug.confianzaIA}`);
        console.log(`  Estado: ${sug.estado}`);
        console.log('');
      });
    } else {
      console.log('No hay sugerencias IA para este documento');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkItems();
