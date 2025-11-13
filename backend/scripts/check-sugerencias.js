/**
 * Script para revisar las sugerencias IA en detalle
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSugerencias() {
  try {
    const sugs = await prisma.sugerencias_ia.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`📋 Total sugerencias: ${sugs.length}\n`);

    for (const [i, s] of sugs.entries()) {
      console.log(`\n=== Sugerencia ${i + 1} ===`);
      console.log('ID:', s.id);
      console.log('Entidad ID:', s.entidadId);
      console.log('Entidad Tipo:', s.entidadTipo);

      // Buscar el item asociado
      if (s.entidadTipo === 'documento_lineas') {
        const item = await prisma.documento_lineas.findUnique({
          where: { id: s.entidadId },
          select: { descripcion: true }
        });
        console.log('Item:', item?.descripcion || 'N/A');
      }

      console.log('Campo afectado:', s.campoAfectado);
      console.log('Valor sugerido:', s.valorSugerido);
      console.log('Valor original:', s.valorOriginal);
      console.log('Confianza IA:', s.confianzaIA);
      console.log('Estado:', s.estado);
      console.log('Justificación:', s.justificacionIA ? s.justificacionIA.substring(0, 200) : 'N/A');

      if (s.estado === 'pendiente') {
        console.log('⚠️ PENDIENTE DE APLICAR');
      } else if (s.estado === 'aplicada') {
        console.log('✅ APLICADA');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSugerencias();
