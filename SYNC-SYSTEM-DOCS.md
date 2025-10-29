# Sistema de Sincronización SQL Server ↔ PostgreSQL

**Documentación Completa del Sistema**

---

## 📖 Índice

1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Componentes](#componentes)
4. [Base de Datos](#base-de-datos)
5. [Flujo de Datos](#flujo-de-datos)
6. [Configuración](#configuración)
7. [Despliegue](#despliegue)
8. [Ejemplos de Uso](#ejemplos-de-uso)
9. [API Reference](#api-reference)

---

## Descripción General

Sistema ETL de 3 fases para sincronización bidireccional entre SQL Server (servidor del cliente) y PostgreSQL (backend centralizado).

### Características Principales

- **Ejecutable standalone**: Un solo .exe en el cliente, sin dependencias
- **ETL de 3 fases**: pre_process, process, post_process (SQL personalizable)
- **Bidireccional**: Upload (cliente → backend) y Download (backend → cliente)
- **Incremental o Full**: Configurable por tabla
- **Seguro**: Configuración encriptada AES-256-GCM
- **Configurable remotamente**: Administrado desde backend
- **Logging completo**: Local y remoto

---

## Arquitectura

### Vista Global

```
┌────────────────────────────────────────────────────────────────────┐
│                     CLIENTE (Windows Server)                       │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ax-sync-client.exe                                           │ │
│  │                                                              │ │
│  │  • Configuración local encriptada (sync-config.enc)         │ │
│  │  • Descarga config remota desde backend                     │ │
│  │  • Conecta a SQL Server local                               │ │
│  │  • Ejecuta ETL de 3 fases                                   │ │
│  │  • Envía/recibe datos via HTTP                              │ │
│  │  • Logs locales + envío al backend                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              ↕                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ SQL Server (Base de datos del cliente)                      │ │
│  │                                                              │ │
│  │  • Vistas para extracción (upload)                          │ │
│  │  • Tablas destino (download)                                │ │
│  │  • Stored procedures (pre/post process)                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS (puerto 80/443)
┌────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Linux)                             │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Node.js + Express                                            │ │
│  │                                                              │ │
│  │  Endpoints:                                                  │ │
│  │  • GET  /api/sync/config/:tenantId                          │ │
│  │  • POST /api/sync/upload/:tenantId                          │ │
│  │  • GET  /api/sync/download/:tenantId                        │ │
│  │  • POST /api/sync/logs/:tenantId                            │ │
│  │  • GET  /api/sync/health                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              ↕                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL                                                   │ │
│  │                                                              │ │
│  │  Tablas:                                                     │ │
│  │  • sync_configurations    (config por tenant)               │ │
│  │  • sync_logs             (logs de ejecuciones)              │ │
│  │  • parametros_maestros   (datos sincronizados)              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

### 1. Cliente (sync-client/)

#### Módulos Principales

| Módulo | Archivo | Responsabilidad |
|--------|---------|----------------|
| **Config Manager** | `src/config/configManager.js` | Gestión de configuración local y remota |
| **SQL Server Client** | `src/database/sqlServerClient.js` | Conexión y queries a SQL Server |
| **HTTP Client** | `src/utils/httpClient.js` | Comunicación con backend |
| **Phase Executor** | `src/sync/phaseExecutor.js` | Ejecuta fases ETL |
| **Uploader** | `src/sync/uploader.js` | Upload con 3 fases |
| **Downloader** | `src/sync/downloader.js` | Download con 3 fases |
| **Logger** | `src/utils/logger.js` | Logging local y cola para backend |
| **Encryption** | `src/utils/encryption.js` | AES-256-GCM |
| **CLI** | `src/index.js` | Interfaz de comandos |

#### Archivos Generados en Cliente

```
C:\sync\                          (directorio de instalación)
├── ax-sync-client.exe           (ejecutable standalone ~40MB)
├── sync-config.enc              (config local encriptada)
├── last-sync.json               (timestamps de última sync)
└── logs/
    ├── sync-combined.log        (todos los logs)
    └── sync-error.log           (solo errores)
```

### 2. Backend (backend/)

#### Nuevos Archivos

```
backend/
├── prisma/
│   └── schema.prisma           (modificado: +sync_configurations, +sync_logs)
└── src/
    └── routes/
        └── sync.js             (nuevo: endpoints de sincronización)
```

---

## Base de Datos

### Tablas Agregadas en PostgreSQL

#### sync_configurations

```prisma
model sync_configurations {
  id                    String    @id @default(cuid())
  tenantId              String    @unique

  // Credenciales SQL Server del cliente
  sqlServerHost         String
  sqlServerPort         Int       @default(1433)
  sqlServerDatabase     String
  sqlServerUser         String
  sqlServerPassword     String    // Encriptado

  // Configuración de tablas (JSON)
  configuracionTablas   Json      // { tablasSubida: [...], tablasBajada: [...] }

  version               Int       @default(1)
  ultimaModificacion    DateTime  @updatedAt
  activo                Boolean   @default(true)

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

#### sync_logs

```prisma
model sync_logs {
  id                    String    @id @default(cuid())
  tenantId              String
  configId              String?

  direccion             String    // 'upload' | 'download'
  tabla                 String
  fase                  String?   // 'pre_process' | 'process' | 'post_process'
  ejecutadoEn           String?   // 'origen' | 'destino'

  estado                String    // 'exitoso' | 'error' | 'parcial'
  registrosAfectados    Int?
  mensaje               String?
  errorDetalle          String?
  duracionMs            Int?

  metadatos             Json?

  fechaInicio           DateTime
  fechaFin              DateTime?
  createdAt             DateTime  @default(now())
}
```

### Índices Importantes

```sql
-- Para consultas de logs por tenant
CREATE INDEX idx_sync_logs_tenant_created ON sync_logs(tenantId, createdAt DESC);

-- Para búsqueda por tabla
CREATE INDEX idx_sync_logs_tabla ON sync_logs(tabla);

-- Para filtros por estado
CREATE INDEX idx_sync_logs_estado ON sync_logs(estado);
```

---

## Flujo de Datos

### Upload (Cliente → Backend)

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: pre_process                                             │
│ ────────────────────────────────────────────────────────────── │
│ Ejecuta: SQL en ORIGEN (SQL Server del cliente)                │
│ Ejemplo: EXEC sp_preparar_proveedores                          │
│          UPDATE flags SET sync_in_progress = 1                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: process                                                 │
│ ────────────────────────────────────────────────────────────── │
│ Ejecuta: Query en ORIGEN                                        │
│ Ejemplo: SELECT * FROM vista_proveedores                        │
│          WHERE updated_at > @ultimaSync                         │
│                                                                 │
│ Resultado: Array de objetos JSON                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ENVÍO HTTP                                                      │
│ ────────────────────────────────────────────────────────────── │
│ POST /api/sync/upload/:tenantId                                │
│ Body: { tabla: "proveedores", data: [...], timestamp: "..." }  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Procesa datos                                          │
│ ────────────────────────────────────────────────────────────── │
│ • Valida autenticación (X-API-Key)                             │
│ • Busca configuración del tenant                               │
│ • Ejecuta post_process si está en "destino" (PostgreSQL)       │
│ • Inserta/actualiza en parametros_maestros                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: post_process (opcional)                                 │
│ ────────────────────────────────────────────────────────────── │
│ Ejecuta: SQL en ORIGEN (si está configurado)                   │
│ Ejemplo: UPDATE flags SET ultima_sync = GETDATE()              │
│          DELETE FROM temp_proveedores                           │
└─────────────────────────────────────────────────────────────────┘
```

### Download (Backend → Cliente)

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: pre_process                                             │
│ ────────────────────────────────────────────────────────────── │
│ Ejecuta: SQL en DESTINO (SQL Server del cliente)               │
│ Ejemplo: IF NOT EXISTS (...)                                   │
│          CREATE TABLE plan_cuentas (...)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PETICIÓN HTTP                                                   │
│ ────────────────────────────────────────────────────────────── │
│ GET /api/sync/download/:tenantId?tabla=plan_cuentas            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Extrae datos                                           │
│ ────────────────────────────────────────────────────────────── │
│ • Ejecuta query configurado en process                         │
│ • Ejemplo: SELECT * FROM parametros_maestros                    │
│            WHERE tipo_campo = 'cuenta'                          │
│ • Devuelve: { data: [...], schema: {...} }                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: process                                                 │
│ ────────────────────────────────────────────────────────────── │
│ Cliente:                                                        │
│ • Verifica si tabla existe, sino la crea                       │
│ • Carga datos en tabla temporal: #temp_plan_cuentas_12345      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: post_process                                            │
│ ────────────────────────────────────────────────────────────── │
│ Ejecuta: SQL en DESTINO                                         │
│ Ejemplo: MERGE plan_cuentas AS target                          │
│          USING #temp_plan_cuentas_12345 AS source              │
│          ON target.codigo = source.codigo                       │
│          WHEN MATCHED THEN UPDATE SET ...                       │
│          WHEN NOT MATCHED THEN INSERT ...                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuración

### 1. Configuración del Tenant (Backend)

Ejemplo de registro en `sync_configurations`:

```sql
INSERT INTO sync_configurations (
  "tenantId",
  "sqlServerHost",
  "sqlServerPort",
  "sqlServerDatabase",
  "sqlServerUser",
  "sqlServerPassword",
  "configuracionTablas",
  "activo"
)
VALUES (
  'acme-corp-001',
  '192.168.1.100',
  1433,
  'EmpresaDB',
  'sync_user',
  'encrypted_password',
  '{
    "tablasSubida": [
      {
        "nombre": "vista_proveedores",
        "primaryKey": "id",
        "incremental": true,
        "campoFecha": "updated_at",
        "pre_process": {
          "enabled": true,
          "ejecutarEn": "origen",
          "sql": "EXEC sp_preparar_sync_proveedores"
        },
        "process": {
          "query": "SELECT id as codigo, razon_social as nombre, cuit, email, activo, updated_at FROM vista_proveedores WHERE updated_at > @ultimaSync OR @ultimaSync IS NULL"
        },
        "post_process": {
          "enabled": false
        }
      },
      {
        "nombre": "vista_productos",
        "primaryKey": "codigo",
        "incremental": false,
        "pre_process": {
          "enabled": false
        },
        "process": {
          "query": "SELECT codigo, descripcion, precio, activo FROM productos WHERE activo = 1"
        },
        "post_process": {
          "enabled": false
        }
      }
    ],
    "tablasBajada": [
      {
        "nombre": "plan_cuentas",
        "primaryKey": "codigo",
        "schema": {
          "columns": [
            {"name": "codigo", "type": "VARCHAR(20)", "nullable": false},
            {"name": "nombre", "type": "VARCHAR(200)", "nullable": false},
            {"name": "tipo", "type": "VARCHAR(50)", "nullable": true},
            {"name": "activo", "type": "BIT", "nullable": false}
          ]
        },
        "pre_process": {
          "enabled": true,
          "ejecutarEn": "destino",
          "sql": "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name=''plan_cuentas'') BEGIN CREATE TABLE plan_cuentas (codigo VARCHAR(20) PRIMARY KEY, nombre VARCHAR(200) NOT NULL, tipo VARCHAR(50), activo BIT NOT NULL DEFAULT 1) END"
        },
        "process": {
          "query": "parametros_maestros.tipo_campo=cuenta"
        },
        "post_process": {
          "enabled": true,
          "ejecutarEn": "destino",
          "sql": "MERGE plan_cuentas AS t USING {temp_table} AS s ON t.codigo = s.codigo WHEN MATCHED THEN UPDATE SET t.nombre = s.nombre, t.tipo = s.tipo, t.activo = s.activo WHEN NOT MATCHED BY TARGET THEN INSERT (codigo, nombre, tipo, activo) VALUES (s.codigo, s.nombre, s.tipo, s.activo) WHEN NOT MATCHED BY SOURCE THEN UPDATE SET t.activo = 0;"
        }
      }
    ]
  }'::jsonb,
  true
);
```

### 2. Inicialización en Cliente

```cmd
REM 1. Copiar ax-sync-client.exe a C:\sync\

REM 2. Establecer password
set SYNC_CONFIG_PASSWORD=Mi_Password_Super_Seguro_2024!

REM 3. Inicializar
cd C:\sync
ax-sync-client.exe init ^
  --url https://backend.miempresa.com ^
  --tenant acme-corp-001 ^
  --key sk_live_abc123xyz789

REM 4. Probar conexión
ax-sync-client.exe test
```

### 3. Programar Ejecución Automática

```cmd
REM Tarea programada cada 5 minutos
schtasks /create /tn "AX Sync - ACME Corp" ^
  /tr "C:\sync\ax-sync-client.exe sync" ^
  /sc minute /mo 5 ^
  /ru SYSTEM ^
  /f

REM Configurar variable de entorno en la tarea
REM Ir a: Task Scheduler → AX Sync - ACME Corp → Actions → Edit
REM Agregar en "Start in": C:\sync
REM En Command Prompt, establecer: set SYNC_CONFIG_PASSWORD=...
```

---

## Despliegue

### Backend

```bash
# 1. Agregar ruta en backend/src/index.js (o app.js)
const syncRoutes = require('./routes/sync');
app.use('/api/sync', syncRoutes);

# 2. Ejecutar migración de Prisma
cd backend
npx prisma migrate dev --name add_sync_tables

# 3. Generar cliente Prisma
npx prisma generate

# 4. Reiniciar servidor
pm2 restart backend
```

### Cliente

```cmd
REM Build (una sola vez en desarrollo)
cd sync-client
npm install
npm run build

REM Resultado: dist/ax-sync-client.exe

REM Despliegue en servidor cliente
1. Copiar ax-sync-client.exe a servidor
2. Ejecutar ax-sync-client.exe init ...
3. Configurar task scheduler
4. Ejecutar primera sync manual
```

---

## Ejemplos de Uso

### Ejemplo 1: Sincronizar Proveedores (Full Sync)

**Vista en SQL Server del cliente:**

```sql
CREATE VIEW vista_proveedores AS
SELECT
  id,
  razon_social,
  cuit,
  email,
  telefono,
  activo,
  GETDATE() as updated_at
FROM proveedores
WHERE activo = 1;
```

**Configuración en backend:**

```json
{
  "nombre": "vista_proveedores",
  "primaryKey": "id",
  "incremental": false,
  "process": {
    "query": "SELECT id as codigo, razon_social as nombre, cuit, email, telefono, activo FROM vista_proveedores"
  }
}
```

**Ejecución:**

```cmd
ax-sync-client.exe sync --upload-only
```

**Resultado:** Todos los proveedores activos se insertan/actualizan en `parametros_maestros` con `tipo_campo = 'proveedor'`.

### Ejemplo 2: Sincronizar Productos (Incremental)

**Vista en SQL Server:**

```sql
CREATE VIEW vista_productos_sync AS
SELECT
  codigo,
  descripcion,
  precio_lista,
  activo,
  fecha_modificacion
FROM productos;
```

**Configuración:**

```json
{
  "nombre": "vista_productos_sync",
  "primaryKey": "codigo",
  "incremental": true,
  "campoFecha": "fecha_modificacion",
  "process": {
    "query": "SELECT codigo, descripcion, precio_lista, activo, fecha_modificacion FROM vista_productos_sync WHERE fecha_modificacion > @ultimaSync"
  }
}
```

**Primera ejecución:** Sube todos los productos.
**Siguientes ejecuciones:** Solo los modificados desde última sync.

### Ejemplo 3: Descargar Plan de Cuentas con MERGE

**Configuración:**

```json
{
  "nombre": "plan_cuentas_erp",
  "primaryKey": "codigo",
  "schema": {
    "columns": [
      {"name": "codigo", "type": "VARCHAR(20)", "nullable": false},
      {"name": "nombre", "type": "VARCHAR(200)", "nullable": false},
      {"name": "nivel", "type": "INT", "nullable": false}
    ]
  },
  "pre_process": {
    "enabled": true,
    "ejecutarEn": "destino",
    "sql": "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='plan_cuentas_erp') CREATE TABLE plan_cuentas_erp (codigo VARCHAR(20) PRIMARY KEY, nombre VARCHAR(200), nivel INT)"
  },
  "process": {
    "query": "SELECT codigo, nombre, parametros_json->>'nivel' as nivel FROM parametros_maestros WHERE tipo_campo = 'cuenta' AND activo = true"
  },
  "post_process": {
    "enabled": true,
    "ejecutarEn": "destino",
    "sql": "MERGE plan_cuentas_erp AS target USING {temp_table} AS source ON target.codigo = source.codigo WHEN MATCHED THEN UPDATE SET nombre = source.nombre, nivel = source.nivel WHEN NOT MATCHED THEN INSERT (codigo, nombre, nivel) VALUES (source.codigo, source.nombre, source.nivel);"
  }
}
```

---

## API Reference

### Endpoints Backend

#### GET /api/sync/health

Health check del servicio.

**Response:**
```json
{
  "success": true,
  "status": "ok"
}
```

#### GET /api/sync/config/:tenantId

Obtiene configuración de sincronización.

**Headers:**
- `X-Tenant-Id`: ID del tenant
- `X-API-Key`: API key del tenant

**Response:**
```json
{
  "success": true,
  "id": "cuid123",
  "tenantId": "acme-001",
  "sqlServerHost": "192.168.1.100",
  "sqlServerPort": 1433,
  "sqlServerDatabase": "EmpresaDB",
  "sqlServerUser": "sync_user",
  "sqlServerPassword": "encrypted",
  "configuracionTablas": {
    "tablasSubida": [...],
    "tablasBajada": [...]
  },
  "version": 1,
  "ultimaModificacion": "2024-01-15T10:30:00Z"
}
```

#### POST /api/sync/upload/:tenantId

Sube datos del cliente al backend.

**Headers:**
- `X-Tenant-Id`: ID del tenant
- `X-API-Key`: API key

**Body:**
```json
{
  "tabla": "proveedores",
  "data": [
    {"codigo": "001", "nombre": "Proveedor A", "cuit": "20-12345678-9"},
    {"codigo": "002", "nombre": "Proveedor B", "cuit": "20-87654321-0"}
  ],
  "timestamp": "2024-01-15T10:35:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "tabla": "proveedores",
  "registrosInsertados": 2,
  "timestamp": "2024-01-15T10:35:05Z"
}
```

#### GET /api/sync/download/:tenantId?tabla=nombre

Descarga datos del backend al cliente.

**Headers:**
- `X-Tenant-Id`: ID del tenant
- `X-API-Key`: API key

**Query Params:**
- `tabla`: Nombre de la tabla a descargar

**Response:**
```json
{
  "success": true,
  "tabla": "plan_cuentas",
  "data": [
    {"codigo": "1.1.01", "nombre": "Caja", "tipo": "Activo"},
    {"codigo": "1.1.02", "nombre": "Banco", "tipo": "Activo"}
  ],
  "schema": {
    "columns": [
      {"name": "codigo", "type": "VARCHAR(20)", "nullable": false},
      {"name": "nombre", "type": "VARCHAR(200)", "nullable": false}
    ]
  },
  "timestamp": "2024-01-15T10:40:00Z"
}
```

#### POST /api/sync/logs/:tenantId

Envía logs de sincronización.

**Body:**
```json
{
  "logs": [
    {
      "direccion": "upload",
      "tabla": "proveedores",
      "fase": "process",
      "ejecutadoEn": "origen",
      "estado": "exitoso",
      "registrosAfectados": 25,
      "mensaje": "Datos extraídos exitosamente",
      "duracionMs": 1234,
      "fechaInicio": "2024-01-15T10:30:00Z",
      "fechaFin": "2024-01-15T10:30:01Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "logsInsertados": 1
}
```

---

## Mantenimiento

### Ver logs de sincronización

```sql
-- Últimas 50 sincronizaciones
SELECT
  tabla,
  direccion,
  estado,
  "registrosAfectados",
  "duracionMs",
  "fechaInicio"
FROM sync_logs
WHERE "tenantId" = 'acme-001'
ORDER BY "createdAt" DESC
LIMIT 50;

-- Errores recientes
SELECT
  tabla,
  fase,
  mensaje,
  "errorDetalle",
  "fechaInicio"
FROM sync_logs
WHERE "tenantId" = 'acme-001'
  AND estado = 'error'
  AND "createdAt" > NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC;

-- Estadísticas por tabla
SELECT
  tabla,
  direccion,
  COUNT(*) as total_ejecuciones,
  SUM(CASE WHEN estado = 'exitoso' THEN 1 ELSE 0 END) as exitosas,
  SUM(CASE WHEN estado = 'error' THEN 1 ELSE 0 END) as errores,
  AVG("duracionMs") as duracion_promedio_ms,
  SUM("registrosAfectados") as total_registros
FROM sync_logs
WHERE "tenantId" = 'acme-001'
  AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY tabla, direccion
ORDER BY tabla, direccion;
```

### Actualizar configuración

```sql
UPDATE sync_configurations
SET "configuracionTablas" = '{
  "tablasSubida": [...nuevo...],
  "tablasBajada": [...]
}'::jsonb
WHERE "tenantId" = 'acme-001';
```

El cliente detectará el cambio en `ultimaModificacion` y descargará la nueva config automáticamente.

---

## Próximos Desarrollos

1. **Frontend de Administración**
   - CRUD de configuraciones
   - Dashboard de sincronizaciones
   - Visualización de logs en tiempo real

2. **Mejoras de Performance**
   - Compresión de datos HTTP
   - Batch processing de logs
   - Pooling de conexiones

3. **Funcionalidades Avanzadas**
   - Retry automático con backoff exponencial
   - Webhooks para notificaciones
   - Soporte para múltiples bases de datos SQL Server
   - Sincronización de archivos (documentos, imágenes)

4. **Seguridad**
   - Rotación automática de API keys
   - Audit trail de cambios de configuración
   - Encriptación end-to-end de datos sensibles

---

**Última actualización:** 2024-01-15
**Versión del sistema:** 1.0.0
