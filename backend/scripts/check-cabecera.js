const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CABECERA_ID = '025018e0-e003-4f05-8373-d263dabaab5c';

async function main() {
  console.log('🔍 Investigando cabecera:', CABECERA_ID);
  console.log('');

  // Obtener la cabecera
  const cabecera = await prisma.rendicion_tarjeta_cabecera.findUnique({
    where: { id: CABECERA_ID }
  });

  console.log('📋 Cabecera:');
  console.log('  - ID:', cabecera.id);
  console.log('  - Número Tarjeta:', cabecera.numeroTarjeta);
  console.log('  - Periodo:', cabecera.periodo);
  console.log('  - Lote ID:', cabecera.loteId);
  console.log('  - Estado:', cabecera.estadoCodigo);
  console.log('');

  // Obtener los items de esta cabecera
  const items = await prisma.rendicion_tarjeta_items.findMany({
    where: {
      rendicionCabeceraId: CABECERA_ID
    },
    include: {
      resumen_tarjeta: {
        select: {
          id: true,
          numeroTarjeta: true,
          apellidoNombreUsuario: true
        }
      }
    }
  });

  console.log('📝 Items de rendición:', items.length);
  console.log('');

  // Obtener números de tarjeta únicos de los resúmenes
  const numerosTarjeta = new Set();
  items.forEach(item => {
    if (item.resumen_tarjeta?.numeroTarjeta) {
      numerosTarjeta.add(item.resumen_tarjeta.numeroTarjeta);
    }
  });

  console.log('💳 Números de tarjeta en los resúmenes:');
  Array.from(numerosTarjeta).forEach(num => {
    console.log('  -', num, '(termina en', num.slice(-4) + ')');
  });
  console.log('');

  // Verificar si alguno de esos números está asociado a usuarios
  for (const numeroTarjeta of numerosTarjeta) {
    const userTarjeta = await prisma.user_tarjetas_credito.findFirst({
      where: {
        numeroTarjeta,
        activo: true
      },
      include: {
        users_user_tarjetas_credito_userIdTousers: {
          select: {
            nombre: true,
            apellido: true,
            email: true
          }
        }
      }
    });

    if (userTarjeta) {
      console.log('✅ Tarjeta', numeroTarjeta, 'SÍ está asociada a usuario:');
      console.log('   ', userTarjeta.users_user_tarjetas_credito_userIdTousers?.email);
    } else {
      console.log('❌ Tarjeta', numeroTarjeta, 'NO está asociada a ningún usuario');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
