const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglaOrdenCompra() {
  try {
    console.log('🚀 Creando regla mejorada para extraer Orden de Compra...\n');

    // Eliminar regla anterior si existe
    await prisma.reglas_negocio.deleteMany({
      where: { codigo: 'EXTRAER_ORDEN_COMPRA' }
    });

    // Nueva configuración usando CUSTOM_FUNCTION en la acción directamente
    const configuracion = {
      descripcion: 'Detecta "o.c:" o "O.C:" en la descripción y extrae el número de orden de compra',
      condiciones: [
        {
          campo: 'descripcion',
          operador: 'REGEX',
          valor: '[oO]\\.?[cC]\\.?\\s*:\\s*\\d+'
        }
      ],
      logicOperator: 'AND',
      transformacionesCampo: [],
      acciones: [
        {
          operacion: 'SET',
          campo: 'tipoOrdenCompra',
          valor: 'OC'
        }
      ],
      stopOnMatch: false
    };

    const nuevaRegla = await prisma.reglas_negocio.create({
      data: {
        id: uuidv4(),
        codigo: 'EXTRAER_ORDEN_COMPRA',
        nombre: 'Extraer Orden de Compra de descripción',
        descripcion: 'Detecta "o.c:" en la descripción del producto y extrae el número de orden de compra',
        tipo: 'TRANSFORMACION',
        prioridad: 35,
        activa: true,
        configuracion,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Regla base creada!');
    console.log(`   ID: ${nuevaRegla.id}`);
    console.log(`   Código: ${nuevaRegla.codigo}`);
    console.log('\n⚠️ NOTA: Esta regla solo marca tipoOrdenCompra = "OC"');
    console.log('Para extraer el número necesitamos extender el BusinessRulesEngine');
    console.log('con una nueva operación "EXTRACT_REGEX".\n');

    console.log('💡 Alternativa: Voy a crear una segunda versión con mejor estrategia...');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
crearReglaOrdenCompra()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
