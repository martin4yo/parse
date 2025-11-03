const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglaBandejas() {
  try {
    console.log('🚀 Creando regla para productos Bandejas...\n');

    // Verificar si ya existe
    const existente = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });

    if (existente) {
      console.log('⚠️ La regla PRODUCTO_BANDEJAS ya existe. Actualizando...');

      const actualizada = await prisma.reglas_negocio.update({
        where: { codigo: 'PRODUCTO_BANDEJAS' },
        data: {
          nombre: 'Clasificar producto Bandejas',
          descripcion: 'Detecta productos con "Bandeja" en la descripción y asigna tipo IN y código BANDE',
          tipo: 'TRANSFORMACION',
          prioridad: 40,
          activa: true,
          configuracion: {
            descripcion: 'Busca la palabra Bandeja en la descripción del producto',
            condiciones: [
              {
                campo: 'descripcion',
                operador: 'CONTAINS',
                valor: 'Bandeja'
              }
            ],
            logicOperator: 'AND',
            acciones: [
              {
                operacion: 'SET',
                campo: 'tipoProducto',
                valor: 'IN'
              },
              {
                operacion: 'SET',
                campo: 'codigoProducto',
                valor: 'BANDE'
              }
            ],
            stopOnMatch: true,
            transformacionesCampo: []
          },
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
          codigo: 'PRODUCTO_BANDEJAS',
          nombre: 'Clasificar producto Bandejas',
          descripcion: 'Detecta productos con "Bandeja" en la descripción y asigna tipo IN y código BANDE',
          tipo: 'TRANSFORMACION',
          prioridad: 40,
          activa: true,
          configuracion: {
            descripcion: 'Busca la palabra Bandeja en la descripción del producto',
            condiciones: [
              {
                campo: 'descripcion',
                operador: 'CONTAINS',
                valor: 'Bandeja'
              }
            ],
            logicOperator: 'AND',
            acciones: [
              {
                operacion: 'SET',
                campo: 'tipoProducto',
                valor: 'IN'
              },
              {
                operacion: 'SET',
                campo: 'codigoProducto',
                valor: 'BANDE'
              }
            ],
            stopOnMatch: true,
            transformacionesCampo: []
          },
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
      where: { codigo: 'PRODUCTO_BANDEJAS' }
    });
    console.log(JSON.stringify(regla.configuracion, null, 2));

    console.log('\n🎯 Cómo funciona:');
    console.log('   Cuando encuentra: "Bandejas Celusal 24x250 o.c: 57679"');
    console.log('   Aplica:');
    console.log('     ✓ tipoProducto = "IN"');
    console.log('     ✓ codigoProducto = "BANDE"');
    console.log('');
    console.log('💡 Nota: Esta regla se aplica a nivel de LÍNEA de documento');
    console.log('   (documento_lineas), con prioridad 40 (antes que otras reglas)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
crearReglaBandejas()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
