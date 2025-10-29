const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function resetPasswords() {
  const prisma = new PrismaClient();

  try {
    console.log('🔐 Reseteando contraseñas y configurando superuser...\n');

    // 1. Hashear la nueva contraseña
    const newPassword = '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 2. Obtener todos los usuarios
    console.log('1️⃣ Obteniendo usuarios...');
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        superuser: true
      }
    });

    console.log(`   Usuarios encontrados: ${users.length}`);

    // 3. Actualizar contraseñas de todos los usuarios
    console.log('\n2️⃣ Actualizando contraseñas...');
    await prisma.users.updateMany({
      data: {
        password: hashedPassword
      }
    });

    // 4. Marcar admin como superuser (si no lo es ya)
    console.log('\n3️⃣ Configurando admin como superuser...');
    await prisma.users.updateMany({
      where: {
        email: 'admin@rendiciones.com'
      },
      data: {
        superuser: true
      }
    });

    // 5. Verificación final
    console.log('\n✅ Verificando cambios...');
    const updatedUsers = await prisma.users.findMany({
      select: {
        email: true,
        nombre: true,
        apellido: true,
        superuser: true
      }
    });

    updatedUsers.forEach(user => {
      const superuserIcon = user.superuser ? '👑' : '👤';
      console.log(`   ${superuserIcon} ${user.nombre} ${user.apellido} (${user.email}) ${user.superuser ? '- SUPERUSER' : ''}`);
    });

    console.log('\n🎉 ¡Contraseñas reseteadas exitosamente!');
    console.log('\n📋 Credenciales actualizadas:');
    console.log(`   🔑 Nueva contraseña para TODOS los usuarios: ${newPassword}`);
    console.log(`   👑 admin@rendiciones.com es SUPERUSER`);

  } catch (error) {
    console.error('❌ Error durante el reseteo:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar reseteo
resetPasswords()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });