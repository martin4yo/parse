/**
 * Script para agregar el campo aplicaA a las reglas existentes
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateReglasAplicaA() {
  try {
    console.log('🔄 Actualizando reglas con campo aplicaA...\n');

    // Obtener todas las reglas
    const reglas = await prisma.reglas_negocio.findMany();

    console.log(`📋 Encontradas ${reglas.length} reglas\n`);

    let actualizadas = 0;
    let yaConfiguradas = 0;

    for (const regla of reglas) {
      const config = regla.configuracion;

      // Si ya tiene aplicaA configurado, saltar
      if (config.aplicaA) {
        yaConfiguradas++;
        console.log(`⏭️ ${regla.codigo}: Ya tiene aplicaA = ${config.aplicaA}`);
        continue;
      }

      // Asignar valor por defecto inteligente según el nombre/código de la regla
      let aplicaA = 'TODOS'; // Por defecto

      const nombreLower = (regla.nombre + regla.codigo).toLowerCase();

      if (nombreLower.includes('item') || nombreLower.includes('linea') || nombreLower.includes('producto')) {
        aplicaA = 'LINEAS';
      } else if (nombreLower.includes('impuesto') || nombreLower.includes('tax') || nombreLower.includes('iva')) {
        aplicaA = 'IMPUESTOS';
      } else if (nombreLower.includes('documento') || nombreLower.includes('factura') || nombreLower.includes('comprobante')) {
        aplicaA = 'DOCUMENTO';
      }

      // Actualizar
      config.aplicaA = aplicaA;

      await prisma.reglas_negocio.update({
        where: { id: regla.id },
        data: {
          configuracion: config,
          updatedAt: new Date()
        }
      });

      actualizadas++;
      console.log(`✅ ${regla.codigo}: aplicaA = ${aplicaA}`);
    }

    console.log('\n📊 RESUMEN:');
    console.log(`   Actualizadas: ${actualizadas}`);
    console.log(`   Ya configuradas: ${yaConfiguradas}`);
    console.log(`   Total: ${reglas.length}`);

    console.log('\n💡 Valores asignados:');
    console.log('   LINEAS: Reglas con "item", "linea" o "producto" en el nombre');
    console.log('   IMPUESTOS: Reglas con "impuesto", "tax" o "iva" en el nombre');
    console.log('   DOCUMENTO: Reglas con "documento", "factura" o "comprobante" en el nombre');
    console.log('   TODOS: Resto de reglas (se aplican a todo)');

    console.log('\n⚠️ IMPORTANTE: Revisa las reglas en la UI y ajusta manualmente si es necesario');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateReglasAplicaA();
