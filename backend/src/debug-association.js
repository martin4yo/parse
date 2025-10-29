const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAssociation() {
  try {
    // Obtener el registro de resumen_tarjeta
    const resumenTarjeta = await prisma.resumenTarjeta.findUnique({
      where: { id: 'cmfcmg3qn00hhehgw4xjuhdm1' },
      include: {
        documentosAsociados: true
      }
    });

    // Obtener el registro de documentos_procesados
    const documento = await prisma.documentoProcesado.findUnique({
      where: { id: 'cmfcn1tey0001jh3wapcnutqh' },
      include: {
        documentosAsociados: true
      }
    });

    console.log('\n=== DEBUGGING ASSOCIATION CON NUEVAS REGLAS ===');
    console.log('\n📄 DOCUMENTO PROCESADO:');
    if (documento) {
      console.log('ID:', documento.id);
      console.log('Usuario ID:', documento.usuarioId);
      console.log('Estado:', documento.estadoProcesamiento);
      console.log('Fecha Extraída:', documento.fechaExtraida);
      console.log('Importe Extraído:', documento.importeExtraido);
      console.log('CUIT Extraído:', documento.cuitExtraido);
      console.log('Texto contiene USD/Dolar:', documento.datosExtraidos?.texto?.toLowerCase().includes('dolar') || documento.datosExtraidos?.texto?.toLowerCase().includes('usd'));
      console.log('Asociaciones existentes:', documento.documentosAsociados?.length || 0);
    } else {
      console.log('❌ Documento no encontrado');
    }

    console.log('\n🏦 RESUMEN TARJETA:');
    if (resumenTarjeta) {
      console.log('ID:', resumenTarjeta.id);
      console.log('Número Tarjeta:', resumenTarjeta.numeroTarjeta);
      console.log('Fecha Transacción (original):', resumenTarjeta.fechaTransaccion);
      console.log('Importe Transacción:', resumenTarjeta.importeTransaccion);
      console.log('CUIT (original):', resumenTarjeta.cuit);
      console.log('Moneda:', resumenTarjeta.monedaOrigenDescripcion);
      console.log('Cupón:', resumenTarjeta.numeroCupon);
      console.log('Asociaciones existentes:', resumenTarjeta.documentosAsociados?.length || 0);
    } else {
      console.log('❌ Resumen tarjeta no encontrado');
    }

    // Funciones helper (mismas que en el código principal)
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
      const cleanCuit = cuit.toString().replace(/[-\s]/g, '');
      return cleanCuit === '0' || cleanCuit === '0000000000000' ? null : cleanCuit;
    };

    const esMonedaUSD = (texto) => {
      if (!texto) return false;
      const textoLower = texto.toLowerCase();
      return textoLower.includes('dolar') || textoLower.includes('usd') || textoLower.includes('dollar');
    };

    // Comparar campos con nuevas reglas
    if (documento && resumenTarjeta) {
      console.log('\n🔍 COMPARACIÓN CON NUEVAS REGLAS:');
      
      // 1. Fecha convertida
      const docFecha = documento.fechaExtraida ? documento.fechaExtraida.toISOString().split('T')[0] : 'null';
      const resFechaISO = parseFechaDDMMYY(resumenTarjeta.fechaTransaccion);
      console.log(`📅 Fecha: Doc(${docFecha}) vs Res(${resFechaISO}) [original: ${resumenTarjeta.fechaTransaccion}] - ${docFecha === resFechaISO ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      // 2. Importe normalizado
      const docImporte = parseImporteNumerico(documento.importeExtraido);
      const resImporte = parseImporteNumerico(resumenTarjeta.importeTransaccion);
      console.log(`💰 Importe: Doc(${docImporte}) vs Res(${resImporte}) - ${docImporte === resImporte ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      // 3. CUIT normalizado
      const docCuit = normalizeCuit(documento.cuitExtraido);
      const resCuit = normalizeCuit(resumenTarjeta.cuit);
      const cuitMatch = !docCuit || !resCuit || docCuit === resCuit;
      console.log(`🏢 CUIT: Doc(${docCuit || 'null'}) vs Res(${resCuit || 'null'}) - ${cuitMatch ? '✅ MATCH/SKIP' : '❌ NO MATCH'}`);
      
      // 4. Verificar moneda USD
      const textoDoc = documento.datosExtraidos?.texto || '';
      const requiereUSD = esMonedaUSD(textoDoc);
      const resMonedaOk = !requiereUSD || (resumenTarjeta.monedaOrigenDescripcion && resumenTarjeta.monedaOrigenDescripcion.includes('USD'));
      console.log(`💲 Moneda: Requiere USD(${requiereUSD}) - Res moneda(${resumenTarjeta.monedaOrigenDescripcion || 'null'}) - ${resMonedaOk ? '✅ OK' : '❌ NO MATCH'}`);
      
      // 5. Asociaciones previas
      const docAsoc = documento.documentosAsociados?.length || 0;
      const resAsoc = resumenTarjeta.documentosAsociados?.length || 0;
      console.log(`🔗 Sin Asociaciones: Doc(${docAsoc === 0 ? '✅' : '❌'}) Res(${resAsoc === 0 ? '✅' : '❌'})`);

      // 6. Tarjeta del usuario
      const userTarjetas = await prisma.userTarjetaCredito.findMany({
        where: { userId: documento.usuarioId },
        select: { numeroTarjeta: true }
      });
      const numerosTarjeta = userTarjetas.map(t => t.numeroTarjeta);
      console.log('🏦 Tarjetas del usuario:', numerosTarjeta);
      const tarjetaMatch = numerosTarjeta.includes(resumenTarjeta.numeroTarjeta);
      console.log(`🏦 Tarjeta Match: ${tarjetaMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      console.log('\n📊 RESUMEN CON NUEVAS REGLAS:');
      const allMatch = docFecha === resFechaISO && 
                       docImporte === resImporte && 
                       cuitMatch &&
                       resMonedaOk &&
                       docAsoc === 0 && 
                       resAsoc === 0 &&
                       tarjetaMatch;
      console.log(`Debería asociarse: ${allMatch ? '✅ SÍ' : '❌ NO'}`);
      
      if (allMatch) {
        console.log('🎉 ¡Debería asociarse con las nuevas reglas!');
      }
    }

  } catch (error) {
    console.error('Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAssociation();