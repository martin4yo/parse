const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = 'b88fa541-4d93-4f16-a707-95e70f7eecdc';

async function main() {
  console.log('🚀 Insertando marcas de tarjetas...');

  // 1. Insertar tarjetas (marcas)
  const tarjetas = [
    { id: 'clw1a0000000001', codigo: 'VISA', descripcion: 'Visa' },
    { id: 'clw1a0000000002', codigo: 'MASTER', descripcion: 'Mastercard' },
    { id: 'clw1a0000000003', codigo: 'AMEX', descripcion: 'American Express' },
    { id: 'clw1a0000000004', codigo: 'DINERS', descripcion: 'Diners Club' }
  ];

  for (const tarjeta of tarjetas) {
    await prisma.tarjetas.upsert({
      where: {
        codigo_tenantId: {
          codigo: tarjeta.codigo,
          tenantId: TENANT_ID
        }
      },
      update: {},
      create: {
        id: tarjeta.id,
        codigo: tarjeta.codigo,
        descripcion: tarjeta.descripcion,
        activo: true,
        tenantId: TENANT_ID,
        updatedAt: new Date()
      }
    });
    console.log(`✅ Tarjeta creada: ${tarjeta.descripcion}`);
  }

  console.log('\n🎯 Insertando tipos de tarjeta...');

  // 2. Insertar tipos de tarjeta
  const tiposTarjeta = [
    // VISA
    { id: 'clw1b0000000001', codigo: 'VISA_CLASICA', descripcion: 'Visa Clásica', tarjetaId: 'clw1a0000000001' },
    { id: 'clw1b0000000002', codigo: 'VISA_ORO', descripcion: 'Visa Oro', tarjetaId: 'clw1a0000000001' },
    { id: 'clw1b0000000003', codigo: 'VISA_PLATINUM', descripcion: 'Visa Platinum', tarjetaId: 'clw1a0000000001' },
    { id: 'clw1b0000000004', codigo: 'VISA_SIGNATURE', descripcion: 'Visa Signature', tarjetaId: 'clw1a0000000001' },
    { id: 'clw1b0000000005', codigo: 'VISA_INFINITE', descripcion: 'Visa Infinite', tarjetaId: 'clw1a0000000001' },

    // MASTERCARD
    { id: 'clw1b0000000006', codigo: 'MASTER_ESTANDAR', descripcion: 'Mastercard Estándar', tarjetaId: 'clw1a0000000002' },
    { id: 'clw1b0000000007', codigo: 'MASTER_GOLD', descripcion: 'Mastercard Gold', tarjetaId: 'clw1a0000000002' },
    { id: 'clw1b0000000008', codigo: 'MASTER_PLATINUM', descripcion: 'Mastercard Platinum', tarjetaId: 'clw1a0000000002' },
    { id: 'clw1b0000000009', codigo: 'MASTER_BLACK', descripcion: 'Mastercard Black', tarjetaId: 'clw1a0000000002' },
    { id: 'clw1b0000000010', codigo: 'MASTER_WORLD_ELITE', descripcion: 'Mastercard World Elite', tarjetaId: 'clw1a0000000002' },

    // AMERICAN EXPRESS
    { id: 'clw1b0000000011', codigo: 'AMEX_GREEN', descripcion: 'American Express Green', tarjetaId: 'clw1a0000000003' },
    { id: 'clw1b0000000012', codigo: 'AMEX_GOLD', descripcion: 'American Express Gold', tarjetaId: 'clw1a0000000003' },
    { id: 'clw1b0000000013', codigo: 'AMEX_PLATINUM', descripcion: 'American Express Platinum', tarjetaId: 'clw1a0000000003' },
    { id: 'clw1b0000000014', codigo: 'AMEX_CENTURION', descripcion: 'American Express Centurion', tarjetaId: 'clw1a0000000003' },

    // DINERS CLUB
    { id: 'clw1b0000000015', codigo: 'DINERS_CLASICA', descripcion: 'Diners Club Clásica', tarjetaId: 'clw1a0000000004' },
    { id: 'clw1b0000000016', codigo: 'DINERS_PREMIER', descripcion: 'Diners Club Premier', tarjetaId: 'clw1a0000000004' },
    { id: 'clw1b0000000017', codigo: 'DINERS_ELITE', descripcion: 'Diners Club Elite', tarjetaId: 'clw1a0000000004' }
  ];

  for (const tipo of tiposTarjeta) {
    await prisma.tipos_tarjeta.upsert({
      where: {
        id_tenantId: {
          id: tipo.id,
          tenantId: TENANT_ID
        }
      },
      update: {},
      create: {
        id: tipo.id,
        codigo: tipo.codigo,
        descripcion: tipo.descripcion,
        tarjetaId: tipo.tarjetaId,
        activo: true,
        tenantId: TENANT_ID,
        updatedAt: new Date()
      }
    });
    console.log(`  ✅ ${tipo.descripcion}`);
  }

  console.log('\n🎉 ¡Proceso completado!');
  console.log('\n📊 Resumen:');
  console.log(`   - 4 marcas de tarjetas`);
  console.log(`   - 5 tipos Visa`);
  console.log(`   - 5 tipos Mastercard`);
  console.log(`   - 4 tipos American Express`);
  console.log(`   - 3 tipos Diners Club`);
  console.log(`   - Total: 17 tipos de tarjeta`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
