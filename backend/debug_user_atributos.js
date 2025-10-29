const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugUserAtributos() {
  console.log('🔍 === DEBUGGING USER ATRIBUTOS - Natalia Arguelles ===');

  try {
    // 1. Buscar el usuario Natalia Arguelles
    console.log('\n📊 1. Buscando usuario Natalia Arguelles...');
    const natalia = await prisma.users.findMany({
      where: {
        OR: [
          { nombre: { contains: 'Natalia', mode: 'insensitive' } },
          { apellido: { contains: 'Arguelles', mode: 'insensitive' } },
          { email: { contains: 'natalia', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        tenantId: true,
        activo: true
      }
    });

    console.log(`Usuarios encontrados: ${natalia.length}`);
    natalia.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}`);
      console.log(`      Nombre: ${user.nombre} ${user.apellido}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Tenant: ${user.tenantId}`);
      console.log(`      Activo: ${user.activo}`);
    });

    if (natalia.length === 0) {
      console.log('❌ No se encontró usuario Natalia Arguelles');
      return;
    }

    const nataliaUser = natalia[0]; // Tomar el primero

    // 2. Verificar atributos asignados a Natalia
    console.log(`\n📊 2. Verificando atributos de ${nataliaUser.nombre} ${nataliaUser.apellido}...`);

    const userAtributos = await prisma.user_atributos.findMany({
      where: {
        userId: nataliaUser.id
      },
      include: {
        valores_atributo: {
          include: {
            atributos: {
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                tenantId: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total atributos asignados: ${userAtributos.length}`);

    if (userAtributos.length > 0) {
      console.log('\n📝 Atributos encontrados:');
      userAtributos.forEach((userAttr, index) => {
        console.log(`   ${index + 1}. ID: ${userAttr.id}`);
        console.log(`      Valor Atributo ID: ${userAttr.valorAtributoId}`);
        console.log(`      Valor: ${userAttr.valores_atributo.codigo} - ${userAttr.valores_atributo.descripcion}`);
        console.log(`      Atributo: ${userAttr.valores_atributo.atributos.codigo} - ${userAttr.valores_atributo.atributos.descripcion}`);
        console.log(`      Atributo Tenant: ${userAttr.valores_atributo.atributos.tenantId}`);
        console.log(`      Activo: ${userAttr.activo}`);
        console.log(`      Creado: ${userAttr.createdAt}`);
        console.log(`      Actualizado: ${userAttr.updatedAt}`);
      });
    } else {
      console.log('❌ No se encontraron atributos asignados');
    }

    // 3. Verificar atributos activos solamente
    console.log(`\n📊 3. Verificando solo atributos ACTIVOS...`);

    const userAtributosActivos = await prisma.user_atributos.findMany({
      where: {
        userId: nataliaUser.id,
        activo: true
      },
      include: {
        valores_atributo: {
          include: {
            atributos: true
          }
        }
      }
    });

    console.log(`Atributos activos: ${userAtributosActivos.length}`);

    // 4. Simular la llamada del endpoint
    console.log(`\n📊 4. Simulando endpoint GET /usuario/${nataliaUser.id}...`);

    const endpointResult = await prisma.user_atributos.findMany({
      where: {
        userId: nataliaUser.id,
        activo: true
      },
      include: {
        valores_atributo: {
          include: {
            atributos: {
              select: {
                id: true,
                codigo: true,
                descripcion: true
              }
            }
          }
        }
      },
      orderBy: [
        { valores_atributo: { atributos: { descripcion: 'asc' } } },
        { valores_atributo: { descripcion: 'asc' } }
      ]
    });

    console.log(`Resultado del endpoint: ${endpointResult.length} registros`);

  } catch (error) {
    console.error('💥 Error en debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUserAtributos();