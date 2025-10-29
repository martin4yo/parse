const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Mapea tipos de PostgreSQL a SQL Server
 */
function postgresTypeToSqlServer(pgType, charMaxLength, numericPrecision, numericScale) {
  // Tipos de texto
  if (pgType === 'character varying' || pgType === 'varchar') {
    return charMaxLength ? `NVARCHAR(${charMaxLength})` : 'NVARCHAR(MAX)';
  }
  if (pgType === 'character' || pgType === 'char') {
    return charMaxLength ? `NCHAR(${charMaxLength})` : 'NCHAR(50)';
  }
  if (pgType === 'text') {
    return 'NVARCHAR(MAX)';
  }

  // Tipos numéricos
  if (pgType === 'integer' || pgType === 'int4') return 'INT';
  if (pgType === 'bigint' || pgType === 'int8') return 'BIGINT';
  if (pgType === 'smallint' || pgType === 'int2') return 'SMALLINT';
  if (pgType === 'numeric' || pgType === 'decimal') {
    const precision = numericPrecision || 18;
    const scale = numericScale || 2;
    return `DECIMAL(${precision}, ${scale})`;
  }
  if (pgType === 'real' || pgType === 'float4') return 'REAL';
  if (pgType === 'double precision' || pgType === 'float8') return 'FLOAT';

  // Tipos booleanos
  if (pgType === 'boolean' || pgType === 'bool') return 'BIT';

  // Tipos de fecha/hora
  if (pgType === 'timestamp without time zone' || pgType === 'timestamp') return 'DATETIME2';
  if (pgType === 'timestamp with time zone' || pgType === 'timestamptz') return 'DATETIMEOFFSET';
  if (pgType === 'date') return 'DATE';
  if (pgType === 'time without time zone' || pgType === 'time') return 'TIME';

  // Tipos JSON
  if (pgType === 'json' || pgType === 'jsonb') return 'NVARCHAR(MAX)';

  // UUID
  if (pgType === 'uuid') return 'UNIQUEIDENTIFIER';

  // Tipo binario
  if (pgType === 'bytea') return 'VARBINARY(MAX)';

  // Default
  return 'NVARCHAR(MAX)';
}

async function listAllTablesWithSchemas() {
  try {
    console.log('\n' + '='.repeat(100));
    console.log('LISTADO COMPLETO DE TABLAS EN POSTGRESQL');
    console.log('='.repeat(100) + '\n');

    // Query para obtener todas las tablas y sus columnas
    const tables = await prisma.$queryRaw`
      SELECT
        t.table_name,
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_nullable,
        c.column_default,
        c.ordinal_position
      FROM
        information_schema.tables t
      LEFT JOIN
        information_schema.columns c ON t.table_name = c.table_name
      WHERE
        t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE '_prisma%'
      ORDER BY
        t.table_name, c.ordinal_position
    `;

    // Agrupar por tabla
    const tableMap = {};

    for (const row of tables) {
      if (!tableMap[row.table_name]) {
        tableMap[row.table_name] = [];
      }

      if (row.column_name) {
        tableMap[row.table_name].push({
          name: row.column_name,
          pgType: row.data_type,
          charMaxLength: row.character_maximum_length,
          numericPrecision: row.numeric_precision,
          numericScale: row.numeric_scale,
          nullable: row.is_nullable === 'YES',
          defaultValue: row.column_default,
          position: row.ordinal_position
        });
      }
    }

    const tableNames = Object.keys(tableMap).sort();

    console.log(`📊 Total de tablas encontradas: ${tableNames.length}\n`);

    // Mostrar cada tabla con su schema
    for (const tableName of tableNames) {
      const columns = tableMap[tableName];

      console.log('─'.repeat(100));
      console.log(`📋 TABLA: ${tableName}`);
      console.log('─'.repeat(100));
      console.log(`   Columnas: ${columns.length}\n`);

      // Buscar primary key
      const pkQuery = await prisma.$queryRaw`
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = ${tableName}::regclass
        AND i.indisprimary;
      `;

      const primaryKeys = pkQuery.map(pk => pk.column_name);
      const primaryKey = primaryKeys.length > 0 ? primaryKeys.join(', ') : 'NO DEFINIDO';

      console.log(`   🔑 Primary Key: ${primaryKey}\n`);

      // Mostrar columnas
      console.log('   COLUMNAS:');
      console.log('   ' + '─'.repeat(96));
      console.log('   ' +
        'Nombre'.padEnd(30) +
        'Tipo PostgreSQL'.padEnd(25) +
        'Tipo SQL Server'.padEnd(25) +
        'NULL'
      );
      console.log('   ' + '─'.repeat(96));

      for (const col of columns) {
        const sqlServerType = postgresTypeToSqlServer(
          col.pgType,
          col.charMaxLength,
          col.numericPrecision,
          col.numericScale
        );

        const isPK = primaryKeys.includes(col.name);
        const nameDisplay = isPK ? `🔑 ${col.name}` : `   ${col.name}`;

        console.log('   ' +
          nameDisplay.padEnd(30) +
          col.pgType.padEnd(25) +
          sqlServerType.padEnd(25) +
          (col.nullable ? 'YES' : 'NO')
        );
      }

      console.log('');

      // Generar JSON de configuración para sync
      const schemaConfig = {
        columns: columns.map(col => ({
          name: col.name,
          type: postgresTypeToSqlServer(
            col.pgType,
            col.charMaxLength,
            col.numericPrecision,
            col.numericScale
          ),
          nullable: col.nullable
        })),
        primaryKey: primaryKeys.length > 0 ? (primaryKeys.length === 1 ? primaryKeys[0] : primaryKeys) : 'id'
      };

      console.log('   📝 CONFIGURACIÓN PARA SYNC (JSON):');
      console.log('   ' + '─'.repeat(96));
      console.log(JSON.stringify(schemaConfig, null, 2).split('\n').map(line => '   ' + line).join('\n'));
      console.log('\n');
    }

    console.log('='.repeat(100));
    console.log('✓ Listado completado\n');

    // Resumen de tablas por categoría
    console.log('📦 TABLAS POR CATEGORÍA:\n');

    const categorias = {
      'Configuración/Maestros': [],
      'Rendiciones': [],
      'Documentos': [],
      'Cajas': [],
      'Sincronización': [],
      'Sistema': [],
      'Otros': []
    };

    for (const tableName of tableNames) {
      if (tableName.includes('parametros') || tableName.includes('maestros')) {
        categorias['Configuración/Maestros'].push(tableName);
      } else if (tableName.includes('rendicion')) {
        categorias['Rendiciones'].push(tableName);
      } else if (tableName.includes('documento')) {
        categorias['Documentos'].push(tableName);
      } else if (tableName.includes('caja')) {
        categorias['Cajas'].push(tableName);
      } else if (tableName.includes('sync')) {
        categorias['Sincronización'].push(tableName);
      } else if (tableName.includes('tenant') || tableName.includes('user')) {
        categorias['Sistema'].push(tableName);
      } else {
        categorias['Otros'].push(tableName);
      }
    }

    for (const [categoria, tablas] of Object.entries(categorias)) {
      if (tablas.length > 0) {
        console.log(`   ${categoria}:`);
        tablas.forEach(t => console.log(`     • ${t}`));
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllTablesWithSchemas();
