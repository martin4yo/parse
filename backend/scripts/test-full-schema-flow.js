const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Mapea tipos de PostgreSQL a SQL Server
 */
function postgresTypeToSqlServer(pgType, charMaxLength, numericPrecision, numericScale, isPrimaryKey = false) {
  // Tipos de texto
  if (pgType === 'character varying' || pgType === 'varchar') {
    return charMaxLength ? `NVARCHAR(${charMaxLength})` : (isPrimaryKey ? 'NVARCHAR(450)' : 'NVARCHAR(MAX)');
  }
  if (pgType === 'character' || pgType === 'char') {
    return charMaxLength ? `NCHAR(${charMaxLength})` : 'NCHAR(50)';
  }
  if (pgType === 'text') {
    return isPrimaryKey ? 'NVARCHAR(450)' : 'NVARCHAR(MAX)';
  }

  // Tipos numéricos
  if (pgType === 'integer' || pgType === 'int4') return 'INT';
  if (pgType === 'bigint' || pgType === 'int8') return 'BIGINT';
  if (pgType === 'smallint' || pgType === 'int2') return 'SMALLINT';
  if (pgType === 'numeric' || pgType === 'decimal') {
    let precision = numericPrecision || 18;
    let scale = numericScale || 2;

    if (precision > 38) {
      if (precision > 50) {
        return 'FLOAT';
      }
      precision = 38;
      if (scale > precision) {
        scale = Math.min(scale, 18);
      }
    }

    if (scale > 18) {
      return 'FLOAT';
    }

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

async function generateSchemaFromTable(tableName, primaryKey = 'id') {
  try {
    // Obtener schema real desde information_schema de PostgreSQL
    const schemaInfo = await prisma.$queryRaw`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable
      FROM
        information_schema.columns
      WHERE
        table_schema = 'public'
        AND table_name = ${tableName}
      ORDER BY
        ordinal_position
    `;

    if (schemaInfo.length > 0) {
      // Normalizar primaryKey a array
      const pkColumns = Array.isArray(primaryKey) ? primaryKey : [primaryKey || 'id'];

      // Usar schema real de PostgreSQL
      const columns = schemaInfo.map(col => {
        const isPrimaryKey = pkColumns.includes(col.column_name);

        return {
          name: col.column_name,
          type: postgresTypeToSqlServer(
            col.data_type,
            col.character_maximum_length,
            col.numeric_precision,
            col.numeric_scale,
            isPrimaryKey
          ),
          nullable: col.is_nullable === 'YES'
        };
      });

      return { columns, primaryKey: primaryKey || 'id' };
    }
  } catch (error) {
    console.error(`Error obteniendo schema real de ${tableName}:`, error.message);
  }

  return null;
}

async function testFullSchemaFlow() {
  try {
    const tableName = 'rendicion_tarjeta_items';

    console.log('\n=== TEST: Flujo Completo de Generación de Schema ===\n');
    console.log(`Tabla: ${tableName}\n`);

    const schema = await generateSchemaFromTable(tableName, 'id');

    if (!schema) {
      console.log('❌ No se pudo generar schema');
      return;
    }

    console.log('✓ Schema generado exitosamente\n');
    console.log(`Total columnas: ${schema.columns.length}\n`);

    console.log('CREATE TABLE SQL que se generaría:\n');
    console.log('─'.repeat(80));

    const sqlColumns = schema.columns.map(col =>
      `  [${col.name}] ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`
    ).join(',\n');

    console.log(`CREATE TABLE [${tableName}] (`);
    console.log(sqlColumns);
    console.log(`, PRIMARY KEY (${schema.primaryKey})`);
    console.log(');\n');

    console.log('─'.repeat(80));
    console.log('\n=== Verificación de columnas críticas ===\n');

    const criticalCols = ['resumenTarjetaId', 'importeTotal', 'tenantId', 'cargaManual'];

    for (const colName of criticalCols) {
      const col = schema.columns.find(c => c.name === colName);
      if (col) {
        const status = col.nullable ? '✓ NULL' : '✓ NOT NULL';
        console.log(`${colName.padEnd(25)} ${col.type.padEnd(20)} ${status}`);
      }
    }

    console.log('\n=== Schema JSON para configuración ===\n');
    console.log(JSON.stringify(schema, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFullSchemaFlow();
