/**
 * Script para ajustar el umbral de confianza de REGLA_PRODUCTO_IA
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function adjustUmbral() {
  try {
    const regla = await prisma.reglas_negocio.findFirst({
      where: { codigo: 'REGLA_PRODUCTO_IA' }
    });

    if (!regla) {
      console.log('❌ Regla no encontrada');
      return;
    }

    const config = regla.configuracion;
    const umbralActual = config.acciones[0].umbralConfianza;

    console.log('📊 Umbral actual:', umbralActual);
    console.log('\n💡 Sugerencias:');
    console.log('  - 0.85 (actual): Muy estricto, solo coincidencias muy seguras');
    console.log('  - 0.75: Bueno para coincidencias razonables');
    console.log('  - 0.70: Más flexible, acepta coincidencias con menor certeza');
    console.log('  - 0.60: Muy permisivo, puede dar falsos positivos');

    // Cambiar a 0.75 (puedes modificar este valor)
    const nuevoUmbral = 0.75;

    config.acciones[0].umbralConfianza = nuevoUmbral;

    await prisma.reglas_negocio.update({
      where: { id: regla.id },
      data: {
        configuracion: config,
        updatedAt: new Date()
      }
    });

    console.log(`\n✅ Umbral actualizado de ${umbralActual} a ${nuevoUmbral}`);
    console.log('\n⚠️ Recuerda: Un umbral más bajo puede dar más falsos positivos');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

adjustUmbral();
