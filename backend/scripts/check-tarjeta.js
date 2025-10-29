const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NUMERO_TARJETA = '4937020004241244';
const TENANT_ID = 'b88fa541-4d93-4f16-a707-95e70f7eecdc';

async function main() {
  console.log('🔍 Buscando tarjeta:', NUMERO_TARJETA);
  console.log('🏢 En tenant:', TENANT_ID);
  console.log('');

  // Buscar todas las tarjetas con ese número (sin filtros)
  const todasLasTarjetas = await prisma.user_tarjetas_credito.findMany({
    where: {
      numeroTarjeta: NUMERO_TARJETA
    },
    include: {
      users_user_tarjetas_credito_userIdTousers: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      }
    }
  });

  console.log('📊 Total tarjetas encontradas:', todasLasTarjetas.length);
  console.log('');

  if (todasLasTarjetas.length === 0) {
    console.log('❌ No existe ninguna tarjeta con ese número');
  } else {
    todasLasTarjetas.forEach((tarjeta, index) => {
      console.log(`Tarjeta ${index + 1}:`);
      console.log('  - ID:', tarjeta.id);
      console.log('  - Número:', tarjeta.numeroTarjeta);
      console.log('  - Activa:', tarjeta.activo);
      console.log('  - TenantId:', tarjeta.tenantId);
      console.log('  - Usuario ID:', tarjeta.userId);
      console.log('  - Usuario:', tarjeta.users_user_tarjetas_credito_userIdTousers
        ? `${tarjeta.users_user_tarjetas_credito_userIdTousers.nombre} ${tarjeta.users_user_tarjetas_credito_userIdTousers.apellido}`
        : 'No encontrado');
      console.log('  - Email:', tarjeta.users_user_tarjetas_credito_userIdTousers?.email);
      console.log('');
    });
  }

  // Ahora buscar con los filtros exactos del backend
  console.log('🔍 Buscando con filtros del backend:');
  const tarjetaConFiltros = await prisma.user_tarjetas_credito.findFirst({
    where: {
      numeroTarjeta: NUMERO_TARJETA,
      activo: true,
      tenantId: TENANT_ID
    },
    include: {
      users_user_tarjetas_credito_userIdTousers: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      }
    }
  });

  if (tarjetaConFiltros) {
    console.log('✅ Tarjeta encontrada con filtros del backend');
    console.log('   Usuario:', tarjetaConFiltros.users_user_tarjetas_credito_userIdTousers?.email);
  } else {
    console.log('❌ NO se encontró con los filtros del backend');
    console.log('   (activo: true, tenantId:', TENANT_ID + ')');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
