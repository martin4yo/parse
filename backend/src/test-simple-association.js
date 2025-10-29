const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSimpleAssociation() {
  try {
    const userId = 'cmf5xlbtk00015x8d7i1j718f';
    const documentoId = 'cmfcn1tey0001jh3wapcnutqh';
    const resumenId = 'cmfcmg3qn00hhehgw4xjuhdm1';
    
    console.log('🧪 TESTING SIMPLE ASSOCIATION');
    
    // 1. Obtener documento
    const documento = await prisma.documentoProcesado.findUnique({
      where: { id: documentoId },
      select: {
        id: true,
        fechaExtraida: true,
        importeExtraido: true,
        cuitExtraido: true,
        datosExtraidos: true
      }
    });
    
    // 2. Obtener resumen específico
    const resumen = await prisma.resumenTarjeta.findUnique({
      where: { id: resumenId }
    });
    
    // 3. Obtener tarjetas del usuario
    const userTarjetas = await prisma.userTarjetaCredito.findMany({
      where: { userId: userId },
      select: { numeroTarjeta: true }
    });
    const numerosTarjeta = userTarjetas.map(t => t.numeroTarjeta);
    
    console.log('📋 DOCUMENTO:', {
      fecha: documento.fechaExtraida.toISOString().split('T')[0],
      importe: documento.importeExtraido,
      cuit: documento.cuitExtraido
    });
    
    console.log('🏦 RESUMEN:', {
      fecha: resumen.fechaTransaccion,
      importe: resumen.importeTransaccion,
      cuit: resumen.cuit,
      numeroTarjeta: resumen.numeroTarjeta
    });
    
    console.log('🏦 Tarjetas usuario:', numerosTarjeta);
    console.log('✅ Resumen pertenece al usuario:', numerosTarjeta.includes(resumen.numeroTarjeta));
    
    // 4. Aplicar funciones helper
    const parseFechaDDMMYY = (fechaStr) => {
      if (!fechaStr || fechaStr.length !== 6) return null;
      const dd = fechaStr.substring(0, 2);
      const mm = fechaStr.substring(2, 4);
      const yy = fechaStr.substring(4, 6);
      const year = parseInt(yy) + (parseInt(yy) > 50 ? 1900 : 2000);
      return `${year}-${mm}-${dd}`;
    };

    const parseImporteNumerico = (importe) => {
      if (importe === null || importe === undefined) return null;
      return parseFloat(importe).toFixed(6);
    };

    const normalizeCuit = (cuit) => {
      if (!cuit) return null;
      const cleanCuit = cuit.toString().replace(/[-\\s]/g, '');
      return cleanCuit === '0' || cleanCuit === '0000000000000' ? null : cleanCuit;
    };

    const esMonedaUSD = (texto) => {
      if (!texto) return false;
      const textoLower = texto.toLowerCase();
      return textoLower.includes('dolar') || textoLower.includes('usd') || textoLower.includes('dollar');
    };
    
    // 5. Datos normalizados
    const docFechaISO = documento.fechaExtraida.toISOString().split('T')[0];
    const resFechaISO = parseFechaDDMMYY(resumen.fechaTransaccion);
    const docImporteNorm = parseImporteNumerico(documento.importeExtraido);
    const resImporteNorm = parseImporteNumerico(resumen.importeTransaccion);
    const docCuitNorm = normalizeCuit(documento.cuitExtraido);
    const resCuitNorm = normalizeCuit(resumen.cuit);
    const requiereUSD = esMonedaUSD(documento.datosExtraidos?.texto || '');
    const resMonedaOk = !requiereUSD || (resumen.monedaOrigenDescripcion && resumen.monedaOrigenDescripcion.includes('USD'));

    console.log('\\n🔍 COMPARACIÓN MANUAL:');
    console.log('📅 Fecha:', docFechaISO, 'vs', resFechaISO, '→', docFechaISO === resFechaISO ? '✅ MATCH' : '❌ NO MATCH');
    console.log('💰 Importe:', docImporteNorm, 'vs', resImporteNorm, '→', docImporteNorm === resImporteNorm ? '✅ MATCH' : '❌ NO MATCH');
    console.log('🏢 CUIT:', docCuitNorm, 'vs', resCuitNorm, '→', (!docCuitNorm || !resCuitNorm || docCuitNorm === resCuitNorm) ? '✅ MATCH' : '❌ NO MATCH');
    console.log('💲 Moneda:', requiereUSD, '→', resMonedaOk ? '✅ OK' : '❌ NO MATCH');
    
    const shouldMatch = docFechaISO === resFechaISO && 
                        docImporteNorm === resImporteNorm && 
                        (!docCuitNorm || !resCuitNorm || docCuitNorm === resCuitNorm) &&
                        resMonedaOk;
                        
    console.log('\\n🎯 DEBERÍA ASOCIARSE:', shouldMatch ? '✅ SÍ' : '❌ NO');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSimpleAssociation();