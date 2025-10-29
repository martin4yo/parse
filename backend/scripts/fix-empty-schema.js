const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEmptySchemas() {
  try {
    const configs = await prisma.sync_configurations.findMany();

    console.log(`\n=== ARREGLANDO SCHEMAS VACÍOS ===\n`);

    for (const config of configs) {
      console.log(`Tenant: ${config.tenantId}`);

      const configuracionTablas = config.configuracionTablas;
      let modified = false;

      // Arreglar tablas de bajada con schema vacío
      if (configuracionTablas.tablasBajada) {
        configuracionTablas.tablasBajada = configuracionTablas.tablasBajada.map(tabla => {
          if (tabla.schema && tabla.schema.columns && tabla.schema.columns.length === 0) {
            console.log(`  ✓ Eliminando schema vacío de tabla: ${tabla.nombre}`);
            const { schema, ...tablaWithoutSchema } = tabla;
            modified = true;
            return tablaWithoutSchema;
          }
          return tabla;
        });
      }

      // Arreglar tablas de subida con schema vacío
      if (configuracionTablas.tablasSubida) {
        configuracionTablas.tablasSubida = configuracionTablas.tablasSubida.map(tabla => {
          if (tabla.schema && tabla.schema.columns && tabla.schema.columns.length === 0) {
            console.log(`  ✓ Eliminando schema vacío de tabla: ${tabla.nombre}`);
            const { schema, ...tablaWithoutSchema } = tabla;
            modified = true;
            return tablaWithoutSchema;
          }
          return tabla;
        });
      }

      // Actualizar si hubo cambios
      if (modified) {
        await prisma.sync_configurations.update({
          where: { id: config.id },
          data: { configuracionTablas }
        });
        console.log(`  ✓ Configuración actualizada`);
      } else {
        console.log(`  - Sin cambios necesarios`);
      }

      console.log(`\n${'='.repeat(60)}\n`);
    }

    console.log('✓ Proceso completado');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmptySchemas();
