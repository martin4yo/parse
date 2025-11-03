const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglaOrdenCompra() {
  try {
    console.log('🚀 Creando regla final para extraer Orden de Compra...\n');

    // Eliminar regla anterior si existe
    await prisma.reglas_negocio.deleteMany({
      where: { codigo: 'EXTRAER_ORDEN_COMPRA' }
    });

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
        },
        {
          operacion: 'EXTRACT_REGEX',
          campo: 'ordenCompra',
          campoOrigen: 'descripcion',
          patron: '[oO]\\.?[cC]\\.?\\s*:\\s*(\\d+)',
          grupoCaptura: 1,
          valorDefecto: null
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

    console.log('✅ Regla creada exitosamente!');
    console.log(`   ID: ${nuevaRegla.id}`);
    console.log(`   Código: ${nuevaRegla.codigo}`);
    console.log(`   Nombre: ${nuevaRegla.nombre}`);
    console.log(`   Prioridad: ${nuevaRegla.prioridad}`);

    console.log('\n📋 Configuración de la regla:');
    console.log(JSON.stringify(configuracion, null, 2));

    console.log('\n🎯 Cómo funciona:');
    console.log('   Entrada: "Bandejas Celusal 24x250 o.c: 57679"');
    console.log('   Detecta: "o.c:" (case-insensitive)');
    console.log('   Extrae: "57679" (número después de :)');
    console.log('   Aplica:');
    console.log('     ✓ tipoOrdenCompra = "OC"');
    console.log('     ✓ ordenCompra = "57679"');
    console.log('');
    console.log('💡 Operación EXTRACT_REGEX:');
    console.log('   - campoOrigen: "descripcion"');
    console.log('   - patron: "[oO]\\\\.?[cC]\\\\.?\\\\s*:\\\\s*(\\\\d+)"');
    console.log('   - grupoCaptura: 1 (primer grupo entre paréntesis)');
    console.log('');
    console.log('🔍 Variaciones detectadas:');
    console.log('   - "o.c: 12345" → 12345');
    console.log('   - "O.C: 12345" → 12345');
    console.log('   - "oc: 12345" → 12345');
    console.log('   - "o.c.: 12345" → 12345');
    console.log('   - "OC: 12345" → 12345');

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
