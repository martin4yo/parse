const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { encryptPassword, decryptPassword } = require('../utils/syncEncryption');
const { authenticateSyncClient, requireSyncPermission } = require('../middleware/syncAuth');

/**
 * Endpoints para sincronización con cliente SQL Server
 */

/**
 * GET /api/sync/health
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

/**
 * GET /api/sync/config/:tenantId
 * Obtiene la configuración de sincronización del tenant
 * Requiere autenticación con API key
 */
router.get('/config/:tenantId', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validar que el tenant del API key coincide con el solicitado
    if (req.syncClient.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder a este tenant'
      });
    }

    const config = await prisma.sync_configurations.findUnique({
      where: { tenantId }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada para este tenant'
      });
    }

    if (!config.activo) {
      return res.status(403).json({
        success: false,
        error: 'Sincronización deshabilitada para este tenant'
      });
    }

    // Desencriptar password para el cliente
    const configWithDecryptedPassword = {
      ...config,
      sqlServerPassword: decryptPassword(config.sqlServerPassword),
    };

    res.json({
      success: true,
      ...configWithDecryptedPassword,
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync/upload/:tenantId
 * Recibe datos del cliente para insertar en PostgreSQL
 */
router.post('/upload/:tenantId', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { tabla, data, timestamp } = req.body;

    if (!tabla || !data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros inválidos'
      });
    }

    console.log(`[SYNC UPLOAD] ${tenantId} - ${tabla}: ${data.length} registros`);

    // Obtener configuración para saber cómo procesar
    const config = await prisma.sync_configurations.findUnique({
      where: { tenantId }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }

    // Buscar configuración de tabla
    const tablaConfig = config.configuracionTablas.tablasSubida?.find(
      t => t.nombre === tabla
    );

    if (!tablaConfig) {
      return res.status(400).json({
        success: false,
        error: `Tabla ${tabla} no configurada para upload`
      });
    }

    // Insertar en maestros_parametros
    // (Aquí deberías implementar la lógica de post_process si está configurado en "destino")

    const isIncremental = tablaConfig.incremental || false;
    const result = await insertIntoMaestrosParametros(data, tenantId, tabla, isIncremental);

    res.json({
      success: true,
      tabla,
      registrosInsertados: result.insertedCount,
      registrosActualizados: result.updatedCount,
      registrosEliminados: result.deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/download/:tenantId
 * Envía datos al cliente para insertar en SQL Server
 */
router.get('/download/:tenantId', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { tabla } = req.query;

    if (!tabla) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro tabla requerido'
      });
    }

    console.log(`[SYNC DOWNLOAD] ${tenantId} - ${tabla}`);

    // Obtener configuración
    const config = await prisma.sync_configurations.findUnique({
      where: { tenantId }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }

    // Buscar configuración de tabla
    const tablaConfig = config.configuracionTablas.tablasBajada?.find(
      t => t.nombre === tabla
    );

    if (!tablaConfig) {
      return res.status(400).json({
        success: false,
        error: `Tabla ${tabla} no configurada para download`
      });
    }

    // Ejecutar query configurado en process
    let data = await executeDownloadQuery(tablaConfig, tenantId);

    // IMPORTANTE: Convertir DECIMALs a números estándar para evitar problemas de serialización
    // PostgreSQL DECIMAL(65,30) puede devolver objetos Decimal que causan overflow
    data = data.map(row => {
      const cleanRow = {};
      for (const [key, value] of Object.entries(row)) {
        // Convertir objetos Decimal/BigDecimal a número
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
          cleanRow[key] = parseFloat(value.toString());
        } else if (typeof value === 'bigint') {
          cleanRow[key] = Number(value);
        } else {
          cleanRow[key] = value;
        }
      }
      return cleanRow;
    });

    // Si no hay schema definido O está vacío, generarlo automáticamente desde PostgreSQL
    let schema = tablaConfig.schema;
    const schemaIsEmpty = !schema || !schema.columns || schema.columns.length === 0;

    if (schemaIsEmpty && data.length > 0) {
      console.log(`[SYNC DOWNLOAD] Generando schema para ${tabla} desde estructura PostgreSQL...`);
      schema = await generateSchemaFromTable(tabla, data[0], tablaConfig.primaryKey);
      console.log(`[SYNC DOWNLOAD] Schema auto-generado para ${tabla}:`, JSON.stringify(schema, null, 2));
    } else if (schema && !schemaIsEmpty) {
      console.log(`[SYNC DOWNLOAD] Usando schema predefinido para ${tabla} con ${schema.columns.length} columnas`);
    } else {
      console.log(`[SYNC DOWNLOAD] ADVERTENCIA: No hay schema ni datos para ${tabla}`);
    }

    res.json({
      success: true,
      tabla,
      data,
      schema,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en download:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync/logs/:tenantId
 * Recibe logs de sincronización del cliente
 */
router.post('/logs/:tenantId', requireSyncPermission('sync'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro logs inválido'
      });
    }

    console.log(`[SYNC LOGS] ${tenantId}: ${logs.length} logs`);

    // Obtener config ID
    const config = await prisma.sync_configurations.findUnique({
      where: { tenantId },
      select: { id: true }
    });

    // Insertar logs
    const insertedLogs = await prisma.sync_logs.createMany({
      data: logs.map(log => ({
        tenantId,
        configId: config?.id || null,
        direccion: log.direccion,
        tabla: log.tabla,
        fase: log.fase,
        ejecutadoEn: log.ejecutadoEn,
        estado: log.estado,
        registrosAfectados: log.registrosAfectados,
        mensaje: log.mensaje,
        errorDetalle: log.errorDetalle,
        duracionMs: log.duracionMs,
        metadatos: log.metadatos || null,
        fechaInicio: new Date(log.fechaInicio),
        fechaFin: log.fechaFin ? new Date(log.fechaFin) : null
      }))
    });

    res.json({
      success: true,
      logsInsertados: insertedLogs.count
    });
  } catch (error) {
    console.error('Error al guardar logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ENDPOINTS PARA ADMINISTRACIÓN (FRONTEND)
// ============================================

/**
 * GET /api/sync/configurations
 * Lista todas las configuraciones de sincronización
 */
router.get('/configurations', async (req, res) => {
  try {
    const configs = await prisma.sync_configurations.findMany({
      include: {
        tenant: {
          select: {
            nombre: true,
            cuit: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error al listar configuraciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/configurations/:id
 * Obtiene una configuración por ID
 */
router.get('/configurations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const config = await prisma.sync_configurations.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            nombre: true,
            cuit: true,
            slug: true
          }
        }
      }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }

    // No enviar password al frontend (por seguridad)
    const configWithoutPassword = {
      ...config,
      sqlServerPassword: '***encrypted***',
    };

    res.json({
      success: true,
      data: configWithoutPassword
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync/configurations
 * Crea una nueva configuración
 */
router.post('/configurations', async (req, res) => {
  try {
    const {
      tenantId,
      sqlServerHost,
      sqlServerPort,
      sqlServerDatabase,
      sqlServerUser,
      sqlServerPassword,
      configuracionTablas,
      activo
    } = req.body;

    // Validar campos requeridos
    if (!tenantId || !sqlServerHost || !sqlServerDatabase || !sqlServerUser || !sqlServerPassword) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes'
      });
    }

    // Verificar que el tenant existe
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant no encontrado'
      });
    }

    // Verificar que no exista configuración para este tenant
    const existingConfig = await prisma.sync_configurations.findUnique({
      where: { tenantId }
    });

    if (existingConfig) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una configuración para este tenant'
      });
    }

    // Encriptar password antes de guardar
    const encryptedPassword = encryptPassword(sqlServerPassword);

    const config = await prisma.sync_configurations.create({
      data: {
        tenantId,
        sqlServerHost,
        sqlServerPort: sqlServerPort || 1433,
        sqlServerDatabase,
        sqlServerUser,
        sqlServerPassword: encryptedPassword,
        configuracionTablas: configuracionTablas || { tablasSubida: [], tablasBajada: [] },
        activo: activo !== undefined ? activo : true
      },
      include: {
        tenant: {
          select: {
            nombre: true,
            cuit: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error al crear configuración:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sync/configurations/:id
 * Actualiza una configuración existente
 */
router.put('/configurations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sqlServerHost,
      sqlServerPort,
      sqlServerDatabase,
      sqlServerUser,
      sqlServerPassword,
      configuracionTablas,
      activo
    } = req.body;

    // Verificar que existe
    const existingConfig = await prisma.sync_configurations.findUnique({
      where: { id }
    });

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }

    const updateData = {};

    if (sqlServerHost) updateData.sqlServerHost = sqlServerHost;
    if (sqlServerPort) updateData.sqlServerPort = sqlServerPort;
    if (sqlServerDatabase) updateData.sqlServerDatabase = sqlServerDatabase;
    if (sqlServerUser) updateData.sqlServerUser = sqlServerUser;
    if (sqlServerPassword) {
      // Encriptar nuevo password
      updateData.sqlServerPassword = encryptPassword(sqlServerPassword);
    }
    if (configuracionTablas) updateData.configuracionTablas = configuracionTablas;
    if (activo !== undefined) updateData.activo = activo;

    const config = await prisma.sync_configurations.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            nombre: true,
            cuit: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sync/configurations/:id
 * Elimina una configuración
 */
router.delete('/configurations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.sync_configurations.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Configuración eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar configuración:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/logs
 * Obtiene logs de sincronización con filtros
 */
router.get('/logs', async (req, res) => {
  try {
    const { tenantId, tabla, estado, desde, hasta, limit = 100 } = req.query;

    const where = {};

    if (tenantId) where.tenantId = tenantId;
    if (tabla) where.tabla = tabla;
    if (estado) where.estado = estado;

    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const logs = await prisma.sync_logs.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit),
      include: {
        tenant: {
          select: {
            nombre: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/stats/:tenantId
 * Obtiene estadísticas de sincronización
 */
router.get('/stats/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { dias = 30 } = req.query;

    const fechaDesde = new Date();
    fechaDesde.setDate(fechaDesde.getDate() - parseInt(dias));

    // Total de logs por estado
    const logsPorEstado = await prisma.sync_logs.groupBy({
      by: ['estado'],
      where: {
        tenantId,
        createdAt: {
          gte: fechaDesde
        }
      },
      _count: {
        id: true
      }
    });

    // Logs por tabla
    const logsPorTabla = await prisma.sync_logs.groupBy({
      by: ['tabla', 'direccion'],
      where: {
        tenantId,
        createdAt: {
          gte: fechaDesde
        }
      },
      _count: {
        id: true
      },
      _sum: {
        registrosAfectados: true
      },
      _avg: {
        duracionMs: true
      }
    });

    // Última sincronización exitosa
    const ultimaSync = await prisma.sync_logs.findFirst({
      where: {
        tenantId,
        estado: 'exitoso'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: {
        porEstado: logsPorEstado,
        porTabla: logsPorTabla,
        ultimaSincronizacion: ultimaSync
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync/test-connection
 * Prueba conexión a SQL Server
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { host, port, database, user, password } = req.body;

    if (!host || !database || !user || !password) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros de conexión'
      });
    }

    // TODO: Implementar test real de conexión SQL Server
    // Por ahora, simulamos que funciona
    const sql = require('mssql');

    const config = {
      server: host,
      port: port || 1433,
      database,
      user,
      password,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000
      }
    };

    try {
      const pool = await sql.connect(config);
      await pool.close();

      res.json({
        success: true,
        message: 'Conexión exitosa'
      });
    } catch (sqlError) {
      res.status(400).json({
        success: false,
        error: `Error de conexión: ${sqlError.message}`
      });
    }
  } catch (error) {
    console.error('Error al probar conexión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// HELPERS ORIGINALES
// ============================================

/**
 * Helper: Inserta datos en maestros_parametros
 */
/**
 * Genera schema automáticamente desde estructura real de PostgreSQL
 * Consulta information_schema para obtener tipos y nullability correctos
 */
async function generateSchemaFromTable(tableName, sampleRow, primaryKey = 'id') {
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
            isPrimaryKey  // Pasar flag de PK
          ),
          nullable: col.is_nullable === 'YES'
        };
      });

      return { columns, primaryKey: primaryKey || 'id' };
    }
  } catch (error) {
    console.error(`[SYNC] Error obteniendo schema real de ${tableName}:`, error.message);
  }

  // Fallback: Inferir desde datos (menos preciso)
  return generateSchemaFromData(sampleRow, primaryKey);
}

/**
 * Genera schema desde datos (FALLBACK)
 * Infiere tipos de SQL Server basándose en los valores
 */
function generateSchemaFromData(sampleRow, primaryKey = 'id') {
  const columns = [];

  for (const [columnName, value] of Object.entries(sampleRow)) {
    let sqlServerType = 'NVARCHAR(MAX)'; // Default
    // SIEMPRE nullable por defecto para evitar problemas
    let nullable = true;

    if (value !== null) {
      // Inferir tipo según el valor
      if (typeof value === 'string') {
        // String: determinar longitud
        if (value.length <= 50) {
          sqlServerType = 'NVARCHAR(50)';
        } else if (value.length <= 255) {
          sqlServerType = 'NVARCHAR(255)';
        } else if (value.length <= 500) {
          sqlServerType = 'NVARCHAR(500)';
        } else {
          sqlServerType = 'NVARCHAR(MAX)';
        }
      } else if (typeof value === 'number') {
        // Número: integer vs decimal
        if (Number.isInteger(value)) {
          sqlServerType = 'INT';
        } else {
          sqlServerType = 'DECIMAL(18, 2)';
        }
      } else if (typeof value === 'boolean') {
        sqlServerType = 'BIT';
      } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(value)) {
        sqlServerType = 'DATETIME2';
      } else if (typeof value === 'object') {
        // JSON/Object
        sqlServerType = 'NVARCHAR(MAX)';
      }
    }

    columns.push({
      name: columnName,
      type: sqlServerType,
      nullable: nullable
    });
  }

  return {
    columns,
    primaryKey: primaryKey || 'id'
  };
}

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
    // SQL Server no permite PRIMARY KEY en NVARCHAR(MAX)
    // Usar NVARCHAR(450) para PKs (máximo para índices)
    return isPrimaryKey ? 'NVARCHAR(450)' : 'NVARCHAR(MAX)';
  }

  // Tipos numéricos
  if (pgType === 'integer' || pgType === 'int4') return 'INT';
  if (pgType === 'bigint' || pgType === 'int8') return 'BIGINT';
  if (pgType === 'smallint' || pgType === 'int2') return 'SMALLINT';
  if (pgType === 'numeric' || pgType === 'decimal') {
    let precision = numericPrecision || 18;
    let scale = numericScale || 2;

    // SQL Server máximo: DECIMAL(38, ...)
    // PostgreSQL permite hasta DECIMAL(1000, ...) pero SQL Server solo 38
    if (precision > 38) {
      // Para valores muy grandes, usar FLOAT es más seguro
      // DECIMAL(65,30) → FLOAT
      if (precision > 50) {
        return 'FLOAT';
      }
      precision = 38;
      // Si scale es mayor que precision, ajustar
      if (scale > precision) {
        scale = Math.min(scale, 18); // Limitar scale también
      }
    }

    // Para scale muy grandes (>18), mejor usar FLOAT
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

/**
 * Normaliza un valor a boolean nativo para PostgreSQL
 * Acepta: 1, 0, "1", "0", "true", "false", true, false
 */
function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;

  // Si ya es boolean, retornarlo
  if (typeof value === 'boolean') return value;

  // Si es número (BIT de SQL Server)
  if (typeof value === 'number') return value !== 0;

  // Si es string
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }

  // Por defecto, usar el defaultValue
  return defaultValue;
}

async function insertIntoMaestrosParametros(data, tenantId, tipoTabla, isIncremental = true) {
  // Mapear datos del cliente a maestros_parametros
  const registros = data.map(item => ({
    codigo: item.codigo || item.id,
    nombre: item.nombre || item.descripcion,
    descripcion: item.descripcion || null,
    tipo_campo: item.tipo_campo || tipoTabla, // Usar el valor del registro, no el nombre de la tabla
    valor_padre: item.valor_padre || null,
    orden: item.orden || 1,
    activo: normalizeBoolean(item.activo, true),
    tenantId,
    parametros_json: item.parametros_json || null
  }));

  if (registros.length === 0) {
    return { insertedCount: 0, updatedCount: 0, deletedCount: 0 };
  }

  // Obtener el tipo_campo del primer registro (todos deberían tener el mismo)
  const tipoCampo = registros[0].tipo_campo;

  let insertedCount = 0;
  let updatedCount = 0;

  // Fase 1: Upsert (crear o actualizar)
  for (const registro of registros) {
    const existing = await prisma.parametros_maestros.findUnique({
      where: {
        tipo_campo_codigo: {
          tipo_campo: registro.tipo_campo,
          codigo: registro.codigo
        }
      }
    });

    await prisma.parametros_maestros.upsert({
      where: {
        tipo_campo_codigo: {
          tipo_campo: registro.tipo_campo,
          codigo: registro.codigo
        }
      },
      update: {
        nombre: registro.nombre,
        descripcion: registro.descripcion,
        valor_padre: registro.valor_padre,
        orden: registro.orden,
        activo: registro.activo,
        parametros_json: registro.parametros_json,
        updatedAt: new Date()
      },
      create: registro
    });

    if (existing) {
      updatedCount++;
    } else {
      insertedCount++;
    }
  }

  let deletedCount = 0;

  // Fase 2: Si es sincronización COMPLETA, eliminar registros que ya no existen en origen
  if (!isIncremental) {
    const codigosRecibidos = registros.map(r => r.codigo);

    const deleteResult = await prisma.parametros_maestros.deleteMany({
      where: {
        tenantId,
        tipo_campo: tipoCampo,
        codigo: {
          notIn: codigosRecibidos
        }
      }
    });

    deletedCount = deleteResult.count;

    console.log(`[SYNC COMPLETA] ${tipoCampo}: ${insertedCount} nuevos, ${updatedCount} actualizados, ${deletedCount} eliminados`);
  } else {
    console.log(`[SYNC INCREMENTAL] ${tipoCampo}: ${insertedCount} nuevos, ${updatedCount} actualizados`);
  }

  return { insertedCount, updatedCount, deletedCount };
}

/**
 * Helper: Ejecuta query de download
 */
async function executeDownloadQuery(tablaConfig, tenantId) {
  // Si hay una query personalizada en process.query, ejecutarla
  if (tablaConfig.process?.query) {
    const query = tablaConfig.process.query;

    console.log(`[SYNC DOWNLOAD] Ejecutando query personalizada para ${tablaConfig.nombre}`);
    console.log(`[SYNC DOWNLOAD] Query:`, query);

    try {
      // Ejecutar query raw con parámetro de tenantId
      // La query debe incluir $1 para el tenantId si lo necesita
      const data = await prisma.$queryRawUnsafe(query, tenantId);

      console.log(`[SYNC DOWNLOAD] Registros obtenidos: ${data.length}`);
      return data;
    } catch (error) {
      console.error('[SYNC DOWNLOAD] Error ejecutando query:', error);
      throw new Error(`Error en query de download: ${error.message}`);
    }
  }

  // Fallback: Descargar de parametros_maestros (legacy)
  console.log(`[SYNC DOWNLOAD] Usando fallback para parametros_maestros`);
  const tipo_campo = tablaConfig.tipoCampo || tablaConfig.nombre;

  const data = await prisma.parametros_maestros.findMany({
    where: {
      tipo_campo,
      tenantId,
      activo: true
    }
  });

  return data;
}

module.exports = router;
