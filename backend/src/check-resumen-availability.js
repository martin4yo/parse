const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkResumenAvailability() {
  try {
    const userId = 'cmf5xlbtk00015x8d7i1j718f';
    const resumenId = 'cmfcmg3qn00hhehgw4xjuhdm1';
    const documentoId = 'cmfcn1tey0001jh3wapcnutqh';
    
    console.log('🔍 Verificando disponibilidad del resumen...');
    
    // Obtener las tarjetas del usuario
    const userTarjetas = await prisma.userTarjetaCredito.findMany({
      where: { userId: userId },
      select: { numeroTarjeta: true }
    });
    const numerosTarjeta = userTarjetas.map(t => t.numeroTarjeta);
    console.log('🏦 Tarjetas del usuario:', numerosTarjeta);
    
    // Verificar si el resumen específico está disponible
    const resumenEspecifico = await prisma.resumenTarjeta.findUnique({
      where: { id: resumenId },
      include: {
        documentosAsociados: true
      }
    });
    
    if (resumenEspecifico) {
      console.log('📋 Resumen encontrado:', {
        id: resumenEspecifico.id,
        numeroTarjeta: resumenEspecifico.numeroTarjeta,
        fechaTransaccion: resumenEspecifico.fechaTransaccion,
        importeTransaccion: resumenEspecifico.importeTransaccion,
        cuit: resumenEspecifico.cuit,
        asociaciones: resumenEspecifico.documentosAsociados.length
      });
      
      // Verificar si está en la lista de tarjetas del usuario
      const perteneceAUsuario = numerosTarjeta.includes(resumenEspecifico.numeroTarjeta);
      console.log('🏦 Pertenece al usuario:', perteneceAUsuario);
      
      // Verificar si tiene asociaciones
      const tieneAsociaciones = resumenEspecifico.documentosAsociados.length > 0;
      console.log('🔗 Tiene asociaciones:', tieneAsociaciones);
      
    } else {
      console.log('❌ Resumen no encontrado');
    }
    
    // Ahora buscar con la misma query que usa el endpoint
    const registrosDisponibles = await prisma.resumenTarjeta.findMany({
      where: {
        AND: [
          { numeroTarjeta: { in: numerosTarjeta } },
          { documentosAsociados: { none: {} } }
        ]
      },
      select: {
        id: true,
        numeroTarjeta: true,
        fechaTransaccion: true,
        importeTransaccion: true,
        cuit: true
      }
    });
    
    console.log(`\n🔍 Registros disponibles encontrados: ${registrosDisponibles.length}`);
    
    // Buscar específicamente nuestro registro
    const nuestroRegistro = registrosDisponibles.find(r => r.id === resumenId);
    if (nuestroRegistro) {
      console.log('✅ Nuestro registro ESTÁ en la lista disponible:', nuestroRegistro);
    } else {
      console.log('❌ Nuestro registro NO está en la lista disponible');
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkResumenAvailability();