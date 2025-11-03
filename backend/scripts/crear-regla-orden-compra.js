const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglaOrdenCompra() {
  try {
    console.log('🚀 Creando regla para extraer Orden de Compra...\n');

    // Verificar si ya existe
    const existente = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'EXTRAER_ORDEN_COMPRA' }
    });

    const configuracion = {
      descripcion: 'Detecta "o.c:" o "O.C:" en la descripción y extrae el número de orden de compra',
      condiciones: [
        {
          campo: 'descripcion',
          operador: 'REGEX',
          valor: '[oO]\\.?[cC]\\.?\\s*:'
        }
      ],
      logicOperator: 'AND',
      transformacionesCampo: [
        {
          campo: '_tempOC',
          transformacion: 'CUSTOM_FUNCTION',
          funcionPersonalizada: `
            // Extraer número después de "o.c:" o "O.C:" desde descripcion
            const desc = arguments[0]?.descripcion || '';
            const match = desc.match(/[oO]\\.?[cC]\\.?\\s*:\\s*(\\d+)/i);
            return match ? match[1] : null;
          `
        }
      ],
      acciones: [
        {
          operacion: 'SET',
          campo: 'tipoOrdenCompra',
          valor: 'OC'
        },
        {
          operacion: 'CALCULATE',
          campo: 'ordenCompra',
          formula: '{_tempOC}'
        }
      ],
      stopOnMatch: false
    };

    if (existente) {
      console.log('⚠️ La regla EXTRAER_ORDEN_COMPRA ya existe. Actualizando...');

      const actualizada = await prisma.reglas_negocio.update({
        where: { codigo: 'EXTRAER_ORDEN_COMPRA' },
        data: {
          nombre: 'Extraer Orden de Compra de descripción',
          descripcion: 'Detecta "o.c:" en la descripción del producto y extrae el número de orden de compra',
          tipo: 'TRANSFORMACION',
          prioridad: 35,
          activa: true,
          configuracion,
          updatedAt: new Date()
        }
      });

      console.log('✅ Regla actualizada exitosamente!');
      console.log(`   ID: ${actualizada.id}`);
      console.log(`   Código: ${actualizada.codigo}`);
      console.log(`   Nombre: ${actualizada.nombre}`);

    } else {
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
    }

    console.log('\n📋 Configuración de la regla:');
    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'EXTRAER_ORDEN_COMPRA' }
    });
    console.log(JSON.stringify(regla.configuracion, null, 2));

    console.log('\n🎯 Cómo funciona:');
    console.log('   Entrada: "Bandejas Celusal 24x250 o.c: 57679"');
    console.log('   Detecta: "o.c:" (case-insensitive)');
    console.log('   Extrae: "57679" (número después de :)');
    console.log('   Aplica:');
    console.log('     ✓ tipoOrdenCompra = "OC"');
    console.log('     ✓ ordenCompra = "57679"');
    console.log('');
    console.log('💡 Nota: Esta regla tiene prioridad 35');
    console.log('   Se ejecuta después de Bandejas (40) pero antes de otras reglas');
    console.log('');
    console.log('🔍 Variaciones detectadas:');
    console.log('   - "o.c: 12345"');
    console.log('   - "O.C: 12345"');
    console.log('   - "oc: 12345"');
    console.log('   - "o.c.: 12345"');
    console.log('   - "OC: 12345"');

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
