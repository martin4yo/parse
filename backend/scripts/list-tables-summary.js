const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listTablesSummary() {
  try {
    console.log('\n' + '='.repeat(100));
    console.log('RESUMEN RÁPIDO DE TABLAS EN POSTGRESQL');
    console.log('='.repeat(100) + '\n');

    // Query para obtener todas las tablas con conteo de columnas
    const tables = await prisma.$queryRaw`
      SELECT
        t.table_name,
        COUNT(c.column_name) as column_count
      FROM
        information_schema.tables t
      LEFT JOIN
        information_schema.columns c ON t.table_name = c.table_name AND c.table_schema = 'public'
      WHERE
        t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE '_prisma%'
      GROUP BY
        t.table_name
      ORDER BY
        t.table_name
    `;

    // Obtener primary keys de todas las tablas
    const pkQuery = await prisma.$queryRaw`
      SELECT
        t.relname as table_name,
        a.attname as column_name
      FROM
        pg_index i
      JOIN
        pg_class t ON t.oid = i.indrelid
      JOIN
        pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE
        i.indisprimary
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY
        t.relname;
    `;

    // Mapear primary keys por tabla
    const pkMap = {};
    for (const pk of pkQuery) {
      if (!pkMap[pk.table_name]) {
        pkMap[pk.table_name] = [];
      }
      pkMap[pk.table_name].push(pk.column_name);
    }

    console.log('Tabla'.padEnd(40) + 'Columnas'.padEnd(12) + 'Primary Key');
    console.log('─'.repeat(100));

    for (const table of tables) {
      const pkColumns = pkMap[table.table_name] || [];
      const pk = pkColumns.length > 0 ? pkColumns.join(', ') : '❌ NO DEFINIDO';

      console.log(
        table.table_name.padEnd(40) +
        table.column_count.toString().padEnd(12) +
        pk
      );
    }

    console.log('─'.repeat(100));
    console.log(`\n📊 Total: ${tables.length} tablas\n`);

    // Categorizar tablas
    const categorias = {
      'Maestros/Configuración': [],
      'Rendiciones': [],
      'Documentos': [],
      'Cajas': [],
      'Sincronización': [],
      'Sistema/Usuarios': [],
      'Otros': []
    };

    for (const table of tables) {
      const name = table.table_name;

      if (name.includes('parametros') || name.includes('maestros') ||
          name.includes('bancos') || name.includes('monedas') ||
          name.includes('atributos') || name.includes('tarjetas') && !name.includes('rendicion')) {
        categorias['Maestros/Configuración'].push(name);
      } else if (name.includes('rendicion')) {
        categorias['Rendiciones'].push(name);
      } else if (name.includes('documento')) {
        categorias['Documentos'].push(name);
      } else if (name.includes('caja') || name.includes('saldo')) {
        categorias['Cajas'].push(name);
      } else if (name.includes('sync')) {
        categorias['Sincronización'].push(name);
      } else if (name.includes('user') || name.includes('tenant') || name.includes('profile')) {
        categorias['Sistema/Usuarios'].push(name);
      } else {
        categorias['Otros'].push(name);
      }
    }

    console.log('📦 TABLAS POR CATEGORÍA:\n');

    for (const [categoria, tablas] of Object.entries(categorias)) {
      if (tablas.length > 0) {
        console.log(`   ${categoria} (${tablas.length}):`);
        tablas.forEach(t => {
          const pkColumns = pkMap[t] || [];
          const pk = pkColumns.length > 0 ? pkColumns.join(', ') : '❌';
          console.log(`     • ${t.padEnd(40)} PK: ${pk}`);
        });
        console.log('');
      }
    }

    // Verificar configuración de sync actual
    console.log('='.repeat(100));
    console.log('📋 TABLAS CONFIGURADAS EN SYNC:');
    console.log('='.repeat(100) + '\n');

    const syncConfigs = await prisma.sync_configurations.findMany();

    if (syncConfigs.length === 0) {
      console.log('   ⚠️  No hay configuraciones de sync\n');
    } else {
      for (const config of syncConfigs) {
        const tablasSubida = config.configuracionTablas?.tablasSubida || [];
        const tablasBajada = config.configuracionTablas?.tablasBajada || [];

        console.log(`   Tenant: ${config.tenantId}`);
        console.log(`   📤 Subida: ${tablasSubida.map(t => t.nombre).join(', ') || 'ninguna'}`);
        console.log(`   📥 Bajada: ${tablasBajada.map(t => t.nombre).join(', ') || 'ninguna'}`);
        console.log('');
      }
    }

    console.log('='.repeat(100));
    console.log('\n💡 Para ver schema completo de una tabla específica:');
    console.log('   node scripts/list-all-tables-schemas.js > schemas.txt\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listTablesSummary();
