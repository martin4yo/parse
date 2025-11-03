const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLineas() {
  try {
    // Buscar el último documento
    const doc = await prisma.documentos_procesados.findFirst({
      orderBy: { fechaProcesamiento: 'desc' },
      select: {
        id: true,
        nombreArchivo: true,
        fechaProcesamiento: true
      }
    });

    if (!doc) {
      console.log('❌ No hay documentos procesados');
      return;
    }

    console.log('📄 Documento:', doc.nombreArchivo);
    console.log('   ID:', doc.id);
    console.log('   Fecha:', doc.fechaProcesamiento);
    console.log('');

    // Buscar líneas
    const lineas = await prisma.documento_lineas.findMany({
      where: { documentoId: doc.id },
      select: {
        numero: true,
        descripcion: true,
        tipoProducto: true,
        codigoProducto: true
      },
      orderBy: { numero: 'asc' }
    });

    console.log(`📊 Total de líneas: ${lineas.length}\n`);

    lineas.forEach(linea => {
      const tieneBandeja = linea.descripcion.toLowerCase().includes('bandeja');
      console.log(`   Línea ${linea.numero}:`);
      console.log(`      Descripción: ${linea.descripcion}`);
      console.log(`      Tipo: ${linea.tipoProducto || 'N/A'}`);
      console.log(`      Código: ${linea.codigoProducto || 'N/A'}`);
      console.log(`      ${tieneBandeja ? '✅ Contiene "Bandeja"' : '❌ NO contiene "Bandeja"'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLineas();
