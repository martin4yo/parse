const { Pool } = require('pg');

const sourcePool = new Pool({
  connectionString: 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/rendiciones_db'
});

const targetPool = new Pool({
  connectionString: 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/parse_db'
});

async function migrateTables() {
  try {
    console.log('🔍 Obteniendo lista de tablas de rendiciones_db...');

    // Obtener todas las tablas
    const tablesResult = await sourcePool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`📋 Tablas encontradas (${tables.length}):`);
    tables.forEach(t => console.log(`   - ${t}`));

    console.log('\n🚀 Iniciando migración...\n');

    for (const table of tables) {
      console.log(`📦 Migrando tabla: ${table}`);

      try {
        // 1. Obtener definición de la tabla
        const createTableQuery = await sourcePool.query(`
          SELECT
            'CREATE TABLE ' || quote_ident(tablename) || ' (' ||
            string_agg(
              quote_ident(attname) || ' ' ||
              format_type(atttypid, atttypmod) ||
              CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN atthasdef THEN ' DEFAULT ' || pg_get_expr(adbin, adrelid) ELSE '' END,
              ', '
            ) ||
            ')' as create_statement
          FROM pg_attribute
          LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum
          WHERE attrelid = quote_ident($1)::regclass
            AND attnum > 0
            AND NOT attisdropped
          GROUP BY tablename
        `, [table]);

        if (createTableQuery.rows.length > 0) {
          // 2. Crear tabla en destino
          await targetPool.query(createTableQuery.rows[0].create_statement);
          console.log(`   ✅ Estructura creada`);

          // 3. Copiar datos
          const dataResult = await sourcePool.query(`SELECT * FROM ${table}`);

          if (dataResult.rows.length > 0) {
            const columns = Object.keys(dataResult.rows[0]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

            for (const row of dataResult.rows) {
              const values = columns.map(col => row[col]);
              await targetPool.query(insertQuery, values);
            }

            console.log(`   ✅ ${dataResult.rows.length} registros copiados`);
          } else {
            console.log(`   ℹ️  Tabla vacía`);
          }
        }

        // 4. Copiar constraints y índices (simplificado)
        const indexesResult = await sourcePool.query(`
          SELECT indexdef
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = $1
            AND indexdef NOT LIKE '%_pkey%'
        `, [table]);

        for (const index of indexesResult.rows) {
          try {
            await targetPool.query(index.indexdef);
          } catch (err) {
            // Ignorar errores de índices duplicados
            if (!err.message.includes('already exists')) {
              console.log(`   ⚠️  Error en índice: ${err.message}`);
            }
          }
        }

        console.log(`   ✅ Tabla ${table} migrada completamente\n`);

      } catch (err) {
        console.error(`   ❌ Error migrando ${table}: ${err.message}\n`);
      }
    }

    console.log('✨ Migración completada!');

  } catch (err) {
    console.error('❌ Error en migración:', err);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

// Verificar que parse_db existe
async function verifyDatabase() {
  const adminPool = new Pool({
    connectionString: 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/postgres'
  });

  try {
    const result = await adminPool.query(`
      SELECT 1 FROM pg_database WHERE datname = 'parse_db'
    `);

    if (result.rows.length === 0) {
      console.error('❌ La base de datos parse_db no existe');
      console.log('Créala con: CREATE DATABASE parse_db;');
      process.exit(1);
    }

    console.log('✅ Base de datos parse_db verificada\n');
  } finally {
    await adminPool.end();
  }
}

async function main() {
  console.log('🔄 MIGRACIÓN: rendiciones_db → parse_db\n');
  await verifyDatabase();
  await migrateTables();
}

main();
