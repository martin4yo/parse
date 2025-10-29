const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedUsers() {
  console.log('🌱 Seeding users...');

  try {
    // Crear perfil admin
    const adminProfile = await prisma.profile.upsert({
      where: { codigo: 'ADMIN' },
      update: {},
      create: {
        codigo: 'ADMIN',
        descripcion: 'Administrador del Sistema',
        activo: true
      }
    });

    // Crear perfil usuario
    const userProfile = await prisma.profile.upsert({
      where: { codigo: 'USER' },
      update: {},
      create: {
        codigo: 'USER',
        descripcion: 'Usuario Estándar',
        activo: true
      }
    });

    // Crear usuario admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.upsert({
      where: { email: 'admin@rendiciones.com' },
      update: {
        password: hashedPassword
      },
      create: {
        email: 'admin@rendiciones.com',
        password: hashedPassword,
        nombre: 'Administrador',
        apellido: 'Sistema',
        activo: true,
        profileId: adminProfile.id
      }
    });

    // Crear tarjetas básicas
    const tarjetas = [
      { codigo: 'VISA', descripcion: 'Tarjetas Visa' },
      { codigo: 'MASTERCARD', descripcion: 'Tarjetas MasterCard' },
      { codigo: 'AMEX', descripcion: 'American Express' }
    ];

    for (const tarjeta of tarjetas) {
      await prisma.tarjeta.upsert({
        where: { codigo: tarjeta.codigo },
        update: {},
        create: tarjeta
      });
    }

    console.log('✅ Users seeded successfully!');
    console.log('📧 Admin user: admin@rendiciones.com');
    console.log('🔑 Admin password: admin123');

  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
}

module.exports = seedUsers;

if (require.main === module) {
  seedUsers()
    .then(() => {
      console.log('✅ User seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ User seeding failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}