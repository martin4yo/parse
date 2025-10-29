const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglaMigracionDKT() {
  try {
    console.log('Insertando regla de migración DKT para CUIT y proveedorId...');

    // Regla: Asignación de Proveedor por CUIT en Migración DKT
    await prisma.reglaNegocio.upsert({
      where: { codigo: 'MIGRACION_DKT_CUIT_PROVEEDOR' },
      update: {},
      create: {
        codigo: 'MIGRACION_DKT_CUIT_PROVEEDOR',
        nombre: 'Migración DKT - Asignación Proveedor por CUIT',
        descripcion: 'Regla para asignar proveedorId basado en CUIT durante migración DKT. Si CUIT es todo 0s usa 9995, sino busca en parámetros maestros.',
        tipo: 'IMPORTACION_DKT',
        activa: true,
        prioridad: 1, // Alta prioridad para ejecutarse antes que otras reglas
        configuracion: {
          // Primero aplicar transformación para remover ceros iniciales
          transformacionesCampo: [
            {
              campo: 'item.cuitProveedor',
              transformacion: 'REMOVE_LEADING_ZEROS'
            }
          ],
          condiciones: [
            {
              campo: 'item.cuitProveedor',
              operador: 'IS_NOT_NULL',
              valor: ''
            }
          ],
          acciones: [
            {
              campo: 'proveedorId',
              operacion: 'LOOKUP_JSON',
              tipoCampo: 'proveedor',
              campoJSON: 'cuit',
              valorConsulta: '{item.cuitProveedor}',
              campoResultado: 'codigo',
              valorDefecto: '9995',
              condicionEspecial: {
                tipo: 'CUIT_ESPECIAL',
                codigoDefault: '9995'
              }
            }
          ],
          stopOnMatch: false
        }
      }
    });

    console.log('✅ Regla de migración DKT insertada correctamente');

    // Mostrar la regla creada
    const regla = await prisma.reglaNegocio.findUnique({
      where: { codigo: 'MIGRACION_DKT_CUIT_PROVEEDOR' }
    });

    console.log(`\n📋 Regla creada:`);
    console.log(`  - Código: ${regla.codigo}`);
    console.log(`  - Nombre: ${regla.nombre}`);
    console.log(`  - Prioridad: ${regla.prioridad}`);
    console.log(`  - Activa: ${regla.activa}`);
    console.log(`  - Configuración:`, JSON.stringify(regla.configuracion, null, 2));

  } catch (error) {
    console.error('❌ Error insertando regla de migración DKT:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  insertarReglaMigracionDKT();
}

module.exports = { insertarReglaMigracionDKT };