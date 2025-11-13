/**
 * Script para analizar los valores de confianza de las sugerencias IA
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analizarConfianza() {
  try {
    // Obtener último documento
    const doc = await prisma.documentos_procesados.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!doc) {
      console.log('❌ No se encontró documento');
      return;
    }

    // Obtener items del documento
    const items = await prisma.documento_lineas.findMany({
      where: { documentoId: doc.id },
      orderBy: { numero: 'asc' }
    });

    console.log('📋 Análisis de Confianza - Sugerencias IA\n');
    console.log('='.repeat(80));

    for (const item of items) {
      console.log(`\n🔹 Item ${item.numero}: ${item.descripcion}`);
      console.log(`   Código actual: ${item.codigoProducto || 'NULL'}`);

      // Buscar sugerencias para este item
      const sugerencias = await prisma.sugerencias_ia.findMany({
        where: { entidadId: item.id },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      if (sugerencias.length > 0) {
        const sug = sugerencias[0];
        const confianza = parseFloat(sug.confianza);
        const valorSugerido = typeof sug.valorSugerido === 'string'
          ? JSON.parse(sug.valorSugerido)
          : sug.valorSugerido;

        console.log(`   📊 Confianza IA: ${(confianza * 100).toFixed(1)}%`);
        console.log(`   💡 Valor sugerido: ${valorSugerido.codigo} - ${valorSugerido.nombre}`);
        console.log(`   📝 Razón: ${sug.razon || 'N/A'}`);
        console.log(`   ⚡ Estado: ${sug.estado}`);

        // Análisis
        if (confianza >= 0.85) {
          console.log(`   ✅ APLICADO (>= 85%)`);
        } else if (confianza >= 0.75) {
          console.log(`   ⚠️ RECHAZADO pero confianza buena (75-85%)`);
        } else if (confianza >= 0.60) {
          console.log(`   ⚠️ RECHAZADO - confianza media (60-75%)`);
        } else {
          console.log(`   ❌ RECHAZADO - confianza baja (< 60%)`);
        }
      } else {
        console.log(`   ❓ No hay sugerencias IA para este item`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 Recomendaciones:');
    console.log('   • Si ves valores entre 70-85%: Reduce el umbral a 0.75');
    console.log('   • Si ves valores entre 60-70%: Reduce el umbral a 0.65');
    console.log('   • Si ves valores < 60%: Agrega más productos a parametros_maestros');
    console.log('   • Si los productos sugeridos son correctos: Apruébalos manualmente');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

analizarConfianza();
