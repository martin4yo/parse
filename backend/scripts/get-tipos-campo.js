/**
 * Script para obtener todos los tipos de campo únicos de parametros_maestros
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getTiposCampo() {
  try {
    console.log('🔍 Obteniendo tipos de campo únicos...\n');

    const tiposCampo = await prisma.parametros_maestros.findMany({
      where: {
        activo: true
      },
      select: {
        tipo_campo: true
      },
      distinct: ['tipo_campo'],
      orderBy: {
        tipo_campo: 'asc'
      }
    });

    console.log(`📋 Tipos de campo encontrados: ${tiposCampo.length}\n`);

    tiposCampo.forEach(t => {
      console.log(`  - ${t.tipo_campo}`);
    });

    console.log('\n💡 Estos son los valores que deberían aparecer en el dropdown de LOOKUP_JSON');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getTiposCampo();
