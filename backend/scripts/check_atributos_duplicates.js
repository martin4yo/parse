const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('🔍 === VERIFICANDO DUPLICADOS EN ATRIBUTOS ===');

  try {
    // Buscar duplicados en combinación codigo + tenantId
    const allAtributos = await prisma.atributos.findMany({
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        tenantId: true
      },
      orderBy: [
        { codigo: 'asc' },
        { tenantId: 'asc' }
      ]
    });

    console.log(`Total registros en atributos: ${allAtributos.length}`);

    // Agrupar por codigo + tenantId
    const groups = {};
    allAtributos.forEach(attr => {
      const key = `${attr.codigo}:${attr.tenantId || 'NULL'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(attr);
    });

    // Encontrar duplicados
    const duplicates = Object.entries(groups).filter(([key, items]) => items.length > 1);

    console.log(`\nGrupos con duplicados: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log('\n📝 Duplicados encontrados:');
      duplicates.forEach(([key, items], index) => {
        console.log(`\n${index + 1}. Clave: ${key} (${items.length} registros)`);
        items.forEach((item, idx) => {
          console.log(`   ${idx + 1}. ID: ${item.id} - Descripcion: ${item.descripcion}`);
        });
      });
    } else {
      console.log('✅ No se encontraron duplicados. La migración es segura.');
    }

  } catch (error) {
    console.error('💥 Error verificando duplicados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();