const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTablasConfig() {
  try {
    // Primero listar todos los tenants con sync configurado
    const allConfigs = await prisma.sync_configurations.findMany({
      include: {
        tenants: {
          select: { slug: true, nombre: true, id: true }
        }
      }
    });

    console.log('\n=== TENANTS CON SYNC CONFIGURADO ===\n');
    allConfigs.forEach(c => {
      console.log(`- ${c.tenants.slug} (${c.tenants.nombre})`);
      console.log(`  ID: ${c.tenantId}`);
      console.log(`  Tablas Upload: ${c.configuracionTablas?.tablasSubida?.length || 0}`);
      console.log(`  Tablas Download: ${c.configuracionTablas?.tablasBajada?.length || 0}\n`);
    });

    // Ahora ver el detalle del tenant grupolb
    const config = await prisma.sync_configurations.findUnique({
      where: { tenantId: 'ef9d53eb-9c7c-4713-9565-0cd6f898dac6' }
    });

    if (!config) {
      console.log('❌ No se encontró configuración para el tenant');
      return;
    }

    console.log('\n=== CONFIGURACIÓN DE TABLAS PARA SYNC ===\n');

    const tablasSubida = config.configuracionTablas?.tablasSubida || [];
    const tablasBajada = config.configuracionTablas?.tablasBajada || [];

    console.log(`📤 TABLAS PARA UPLOAD: ${tablasSubida.length}`);
    console.log('='.repeat(60));
    tablasSubida.forEach((tabla, index) => {
      console.log(`\n${index + 1}. ${tabla.nombre}`);
      console.log(`   Primary Key: ${tabla.primaryKey || 'no definido'}`);
      console.log(`   Incremental: ${tabla.incremental ? 'Sí' : 'No'}`);
      console.log(`   Campo Fecha: ${tabla.campoFecha || 'N/A'}`);

      if (tabla.pre_process?.enabled) {
        console.log(`   Pre-process: Habilitado (${tabla.pre_process.ejecutarEn})`);
      }

      if (tabla.process?.query) {
        console.log(`   Process Query: ${tabla.process.query.substring(0, 80)}...`);
      }

      if (tabla.post_process?.enabled) {
        console.log(`   Post-process: Habilitado (${tabla.post_process.ejecutarEn})`);
      }
    });

    console.log(`\n\n📥 TABLAS PARA DOWNLOAD: ${tablasBajada.length}`);
    console.log('='.repeat(60));
    tablasBajada.forEach((tabla, index) => {
      console.log(`\n${index + 1}. ${tabla.nombre}`);
      console.log(`   Primary Key: ${tabla.primaryKey || 'no definido'}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTablasConfig();
