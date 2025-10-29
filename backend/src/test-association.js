const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAssociation() {
  try {
    const userId = 'cmf5xlbtk00015x8d7i1j718f';
    console.log('🔧 TESTING ASSOCIATION LOGIC');

    // Limpiar asociaciones existentes para estos registros específicos
    await prisma.documentoAsociado.deleteMany({
      where: {
        OR: [
          { documentoProcesadoId: 'cmfcn1tey0001jh3wapcnutqh' },
          { resumenTarjetaId: 'cmfcmg3qn00hhehgw4xjuhdm1' }
        ]
      }
    });
    console.log('✅ Asociaciones limpiadas');

    // Obtener tarjetas del usuario
    const userTarjetas = await prisma.userTarjetaCredito.findMany({
      where: { userId: userId },
      select: { numeroTarjeta: true }
    });
    const numerosTarjeta = userTarjetas.map(t => t.numeroTarjeta);
    console.log('🏦 Tarjetas del usuario:', numerosTarjeta);

    // Obtener documentos pendientes específicos (solo nuestro test)
    const documentosPendientes = await prisma.documentoProcesado.findMany({
      where: {
        id: 'cmfcn1tey0001jh3wapcnutqh',
        usuarioId: userId,
        estadoProcesamiento: 'completado',
        documentosAsociados: { none: {} }
      },
      select: {
        id: true,
        fechaExtraida: true,
        importeExtraido: true,
        cuitExtraido: true,
        datosExtraidos: true
      }
    });

    console.log('📄 Documentos pendientes:', documentosPendientes.length);

    // Funciones helper (copiadas de documentos.js)
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

    let resultados = [];

    for (const documento of documentosPendientes) {
      console.log('📋 Procesando documento:', documento.id);
      
      if (!documento.fechaExtraida || !documento.importeExtraido) {
        console.log('❌ Documento sin datos suficientes');
        continue;
      }

      // Verificar moneda
      const textoDocumento = documento.datosExtraidos?.texto || '';
      const requiereUSD = esMonedaUSD(textoDocumento);
      
      console.log('💲 Documento requiere USD:', requiereUSD);

      // Preparar datos para comparación
      const docFechaISO = documento.fechaExtraida.toISOString().split('T')[0];
      const docImporteNorm = parseImporteNumerico(documento.importeExtraido);
      const docCuitNorm = normalizeCuit(documento.cuitExtraido);

      console.log('📊 Datos documento normalizados:', {
        fecha: docFechaISO,
        importe: docImporteNorm,
        cuit: docCuitNorm,
        requiereUSD
      });

      // Buscar registros de resumen
      const registrosResumen = await prisma.resumenTarjeta.findMany({
        where: {
          AND: [
            { numeroTarjeta: { in: numerosTarjeta } },
            { documentosAsociados: { none: {} } }
          ]
        }
      });

      console.log(`🔍 Encontrados ${registrosResumen.length} registros de resumen sin asociar`);

      let coincidencias = [];
      
      for (const resumen of registrosResumen) {
        console.log('🧐 Evaluando resumen:', resumen.id);
        
        // 1. Convertir fecha DDMMYY a ISO
        const resFechaISO = parseFechaDDMMYY(resumen.fechaTransaccion);
        
        // 2. Normalizar importe
        const resImporteNorm = parseImporteNumerico(resumen.importeTransaccion);
        
        // 3. Normalizar CUIT
        const resCuitNorm = normalizeCuit(resumen.cuit);
        
        // 4. Verificar moneda USD si es requerida
        const resMonedaOk = !requiereUSD || (resumen.monedaOrigenDescripcion && resumen.monedaOrigenDescripcion.includes('USD'));

        console.log('📋 Comparación detallada:', {
          resumenId: resumen.id,
          fecha: `${docFechaISO} === ${resFechaISO} → ${docFechaISO === resFechaISO}`,
          importe: `${docImporteNorm} === ${resImporteNorm} → ${docImporteNorm === resImporteNorm}`,
          cuit: `${docCuitNorm} vs ${resCuitNorm} → ${!docCuitNorm || !resCuitNorm || docCuitNorm === resCuitNorm}`,
          moneda: `RequiereUSD:${requiereUSD}, Moneda:${resumen.monedaOrigenDescripcion} → ${resMonedaOk}`
        });

        // Verificar coincidencias
        const fechaMatch = docFechaISO === resFechaISO;
        const importeMatch = docImporteNorm === resImporteNorm;
        const cuitMatch = !docCuitNorm || !resCuitNorm || docCuitNorm === resCuitNorm;
        
        if (fechaMatch && importeMatch && resMonedaOk && cuitMatch) {
          console.log('✅ COINCIDENCIA ENCONTRADA!');
          coincidencias.push({
            resumen,
            tieneCuit: !!(docCuitNorm && resCuitNorm)
          });
        } else {
          console.log('❌ No hay coincidencia');
        }
      }

      console.log(`🎯 Encontradas ${coincidencias.length} coincidencias potenciales`);

      if (coincidencias.length > 0) {
        // 5. Lógica de selección
        const sinCuit = coincidencias.filter(c => !c.tieneCuit);
        const conCuit = coincidencias.filter(c => c.tieneCuit);

        let coincidenciaFinal = null;

        if (conCuit.length > 0) {
          console.log('🔐 Usando coincidencia con CUIT');
          coincidenciaFinal = conCuit[0].resumen;
        } else if (sinCuit.length === 1) {
          console.log('📝 Una sola coincidencia sin CUIT');
          coincidenciaFinal = sinCuit[0].resumen;
        } else if (sinCuit.length > 1) {
          const cupones = new Set(sinCuit.map(c => c.resumen.numeroCupon).filter(c => c));
          if (cupones.size === sinCuit.length) {
            console.log('🎫 Múltiples coincidencias con cupones únicos');
            coincidenciaFinal = sinCuit[0].resumen;
          } else {
            console.log('⚠️ Múltiples coincidencias ambiguas');
          }
        }

        if (coincidenciaFinal) {
          console.log('🔗 ASOCIANDO con:', coincidenciaFinal.id);

          // Crear la asociación
          await prisma.documentoAsociado.create({
            data: {
              documentoProcesadoId: documento.id,
              resumenTarjetaId: coincidenciaFinal.id,
              usuarioAsociacion: userId,
              observaciones: 'Asociación de prueba con nuevas reglas'
            }
          });

          resultados.push({
            documentoId: documento.id,
            estado: 'asociado',
            resumenTarjetaId: coincidenciaFinal.id
          });

          console.log('🎉 ASOCIACIÓN EXITOSA!');
        } else {
          console.log('💔 No se pudo realizar la asociación');
          resultados.push({
            documentoId: documento.id,
            estado: 'ambiguo'
          });
        }
      } else {
        console.log('🚫 No se encontraron coincidencias');
        resultados.push({
          documentoId: documento.id,
          estado: 'sin_coincidencia'
        });
      }
    }

    console.log('📊 RESULTADO FINAL:', resultados);

  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAssociation();