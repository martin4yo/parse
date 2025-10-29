const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSyncConfig() {
  try {
    const configs = await prisma.sync_configurations.findMany();

    console.log(`\n=== CONFIGURACIONES DE SYNC (${configs.length}) ===\n`);

    for (const config of configs) {
      console.log(`Tenant: ${config.tenantId}`);
      console.log(`SQL Server: ${config.sqlServerHost}:${config.sqlServerPort}/${config.sqlServerDatabase}`);
      console.log(`Activo: ${config.activo}`);

      console.log(`\n--- Tablas de Bajada ---`);
      const tablasBajada = config.configuracionTablas?.tablasBajada || [];

      for (const tabla of tablasBajada) {
        console.log(`\nTabla: ${tabla.nombre}`);
        console.log(`  Primary Key: ${tabla.primaryKey || 'no definido'}`);
        console.log(`  Schema definido: ${tabla.schema ? 'SÍ' : 'NO'}`);

        if (tabla.schema) {
          console.log(`  Columnas (${tabla.schema.columns?.length || 0}):`);
          tabla.schema.columns?.forEach(col => {
            console.log(`    - ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`);
          });
        }

        console.log(`  Process Query: ${tabla.process?.query ? 'SÍ' : 'NO'}`);
        if (tabla.process?.query) {
          console.log(`  Query: ${tabla.process.query.substring(0, 100)}...`);
        }
      }

      console.log(`\n${'='.repeat(60)}\n`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncConfig();
