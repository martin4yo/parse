const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllSchemas() {
  try {
    const configs = await prisma.sync_configurations.findMany();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`VERIFICACIÓN DE SCHEMAS - ${configs.length} configuración(es)`);
    console.log(`${'='.repeat(80)}\n`);

    for (const config of configs) {
      console.log(`📦 Tenant: ${config.tenantId}`);
      console.log(`   SQL Server: ${config.sqlServerHost}:${config.sqlServerPort}/${config.sqlServerDatabase}`);
      console.log(`   Activo: ${config.activo ? '✓' : '✗'}\n`);

      // Tablas de SUBIDA (Upload)
      const tablasSubida = config.configuracionTablas?.tablasSubida || [];
      if (tablasSubida.length > 0) {
        console.log(`   📤 TABLAS DE SUBIDA (${tablasSubida.length}):`);
        console.log(`   ${'─'.repeat(76)}`);

        for (const tabla of tablasSubida) {
          const hasSchema = tabla.schema && tabla.schema.columns && tabla.schema.columns.length > 0;
          const status = hasSchema ? '✓' : '⚠️ VACÍO';
          const columnsCount = tabla.schema?.columns?.length || 0;

          console.log(`   ${status} ${tabla.nombre}`);
          console.log(`      Primary Key: ${tabla.primaryKey || 'no definido'}`);
          console.log(`      Schema: ${hasSchema ? `SÍ (${columnsCount} columnas)` : 'VACÍO O NO DEFINIDO'}`);
          console.log(`      Incremental: ${tabla.incremental ? 'Sí' : 'No'}`);

          if (hasSchema) {
            console.log(`      Columnas:`);
            tabla.schema.columns.forEach(col => {
              console.log(`        • ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`);
            });
          }
          console.log('');
        }
      }

      // Tablas de BAJADA (Download)
      const tablasBajada = config.configuracionTablas?.tablasBajada || [];
      if (tablasBajada.length > 0) {
        console.log(`   📥 TABLAS DE BAJADA (${tablasBajada.length}):`);
        console.log(`   ${'─'.repeat(76)}`);

        for (const tabla of tablasBajada) {
          const hasSchema = tabla.schema && tabla.schema.columns && tabla.schema.columns.length > 0;
          const status = hasSchema ? '✓' : '⚠️ VACÍO';
          const columnsCount = tabla.schema?.columns?.length || 0;

          console.log(`   ${status} ${tabla.nombre}`);
          console.log(`      Primary Key: ${tabla.primaryKey || 'no definido'}`);
          console.log(`      Schema: ${hasSchema ? `SÍ (${columnsCount} columnas)` : 'VACÍO O NO DEFINIDO'}`);
          console.log(`      Process Query: ${tabla.process?.query ? 'SÍ' : 'NO'}`);

          if (tabla.process?.query) {
            const query = tabla.process.query.replace(/\s+/g, ' ').trim();
            const preview = query.length > 80 ? query.substring(0, 77) + '...' : query;
            console.log(`      Query: ${preview}`);
          }

          if (hasSchema) {
            console.log(`      Columnas:`);
            tabla.schema.columns.forEach(col => {
              console.log(`        • ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`);
            });
          }
          console.log('');
        }
      }

      if (tablasSubida.length === 0 && tablasBajada.length === 0) {
        console.log(`   ⚠️  No hay tablas configuradas\n`);
      }

      console.log(`${'='.repeat(80)}\n`);
    }

    // Resumen
    let totalTablas = 0;
    let tablasConSchemaVacio = 0;

    for (const config of configs) {
      const tablas = [
        ...(config.configuracionTablas?.tablasSubida || []),
        ...(config.configuracionTablas?.tablasBajada || [])
      ];

      totalTablas += tablas.length;

      for (const tabla of tablas) {
        const hasSchema = tabla.schema && tabla.schema.columns && tabla.schema.columns.length > 0;
        if (!hasSchema) {
          tablasConSchemaVacio++;
        }
      }
    }

    console.log(`📊 RESUMEN:`);
    console.log(`   Total de tablas configuradas: ${totalTablas}`);
    console.log(`   Tablas con schema vacío o sin definir: ${tablasConSchemaVacio}`);
    console.log(`   Tablas con schema correcto: ${totalTablas - tablasConSchemaVacio}`);

    if (tablasConSchemaVacio > 0) {
      console.log(`\n⚠️  ACCIÓN REQUERIDA: Ejecuta 'node scripts/fix-empty-schema.js' para arreglar schemas vacíos\n`);
    } else {
      console.log(`\n✓ Todos los schemas están correctos\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllSchemas();
