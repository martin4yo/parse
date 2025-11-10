# Frontend de Administración de Sincronización

Panel de administración web para gestionar configuraciones de sincronización SQL Server ↔ PostgreSQL.

## 📁 Estructura

```
sync-admin/
├── page.tsx                          # Lista de configuraciones
├── new/
│   └── page.tsx                      # Nueva configuración
├── [id]/
│   └── edit/
│       └── page.tsx                  # Editar configuración
├── sync-logs/
│   └── page.tsx                      # Dashboard de logs
└── components/
    └── SyncConfigForm.tsx            # Formulario reutilizable
```

## 🎯 Funcionalidades

### 1. Lista de Configuraciones (`/sync-admin`)

**Características:**
- Tabla con todas las configuraciones de sincronización
- Muestra: Tenant, SQL Server, Base de datos, cantidad de tablas configuradas
- Estados: Activo/Inactivo
- Acciones: Editar, Ver logs, Habilitar/Deshabilitar, Eliminar
- Botón para crear nueva configuración
- Botón de actualizar

**Endpoints usados:**
- `GET /api/sync/configurations` - Lista todas las configs
- `DELETE /api/sync/configurations/:id` - Elimina config
- `PUT /api/sync/configurations/:id` - Activa/desactiva config

### 2. Nueva Configuración (`/sync-admin/new`)

**Características:**
- Formulario completo para crear configuración
- Secciones:
  - **Conexión SQL Server**: Host, puerto, database, usuario, password
  - **Tablas de Subida** (Cliente → Backend):
    - Nombre tabla/vista
    - Primary key
    - Incremental o full sync
    - Query de extracción
  - **Tablas de Bajada** (Backend → Cliente):
    - Nombre tabla destino
    - Primary key
    - Tipo de campo (maestros_parametros)
    - Query de extracción
- Botón "Probar Conexión" para validar SQL Server
- Validaciones de campos requeridos

**Endpoints usados:**
- `POST /api/sync/configurations` - Crea nueva config
- `POST /api/sync/test-connection` - Prueba conexión SQL Server

### 3. Editar Configuración (`/sync-admin/[id]/edit`)

**Características:**
- Mismo formulario que nueva configuración
- Carga datos existentes
- Tenant no editable
- Password opcional (mantiene el actual si se deja vacío)
- Muestra nombre del tenant en el header

**Endpoints usados:**
- `GET /api/sync/configurations/:id` - Obtiene config
- `PUT /api/sync/configurations/:id` - Actualiza config
- `POST /api/sync/test-connection` - Prueba conexión

### 4. Dashboard de Logs (`/sync-admin/sync-logs`)

**Características:**
- **Estadísticas**:
  - Total de sincronizaciones (últimos 30 días)
  - Tasa de éxito en porcentaje
  - Última sincronización exitosa
- **Filtros**:
  - Por Tenant ID
  - Por tabla
  - Por estado (exitoso/error/parcial)
  - Límite de registros
- **Tabla de Logs**:
  - Fecha/hora
  - Tenant
  - Tabla
  - Dirección (upload/download con iconos)
  - Fase (pre_process/process/post_process)
  - Estado con badges de colores
  - Cantidad de registros afectados
  - Duración en ms
  - Mensaje y detalle de error
- Actualización manual
- Soporte para query params (ej: `?tenant=ABC123`)

**Endpoints usados:**
- `GET /api/sync/logs` - Lista logs con filtros
- `GET /api/sync/stats/:tenantId` - Estadísticas del tenant

## 🎨 Componentes UI Usados

- **Shadcn UI**:
  - Card, Button, Input, Label
  - Table, Badge, Switch
  - Select, Textarea, Tabs
  - DropdownMenu
- **Iconos Lucide**:
  - Database, Plus, Edit, Trash2
  - RefreshCw, ArrowUp, ArrowDown
  - CheckCircle, XCircle, AlertCircle

## 🔗 Navegación

```
/sync-admin              → Lista de configuraciones
/sync-admin/new          → Nueva configuración
/sync-admin/:id/edit     → Editar configuración
/sync-admin/sync-logs         → Dashboard de logs
/sync-admin/sync-logs?tenant=X → Logs filtrados por tenant
```

## 📝 Tipos TypeScript

Todos los tipos están definidos en:
```typescript
packages/web/src/types/sync.ts
```

Incluye:
- `SyncConfiguration`
- `SyncLog`
- `SyncStats`
- `TablaSubida`, `TablaBajada`
- `ConfiguracionTablas`
- Y más...

## 🚀 Uso

### Crear Nueva Configuración

1. Ir a `/sync-admin`
2. Click en "Nueva Configuración"
3. Completar datos de SQL Server
4. (Opcional) Probar conexión
5. Agregar tablas de subida/bajada
6. Guardar

### Editar Configuración

1. Desde `/sync-admin`, click en menú "..." → Editar
2. Modificar campos necesarios
3. Guardar cambios

### Ver Logs

1. Desde `/sync-admin`, click en menú "..." → Ver Logs
2. O ir directamente a `/sync-admin/sync-logs`
3. Aplicar filtros según necesidad
4. Ver detalles de cada ejecución

## 🔄 Sincronización Incremental en Download (Backend → Cliente)

**Implementado: Noviembre 2025**

### Descripción

El sistema ahora soporta **sincronización incremental** para tablas de bajada (download), permitiendo al cliente SQL Server obtener solo los registros nuevos o modificados desde la última sincronización exitosa.

### Modos de Sincronización Incremental

Se soportan **3 modos** configurables por tabla:

1. **Por Timestamp (campoFecha)** - Sincroniza registros modificados después de `ultimaSync`
   - Útil para tablas con campo de fecha de modificación (ej: `updatedAt`, `fechaModificacion`)
   - Ejemplo: `GET /api/sync/download/tenant?tabla=Proveedores&ultimaSync=2025-11-07T10:30:00Z`

2. **Por ID (campoId)** - Sincroniza registros con ID mayor que `ultimoId`
   - Útil para tablas con IDs autoincrementales o secuenciales
   - Ejemplo: `GET /api/sync/download/tenant?tabla=Productos&ultimoId=12500`

3. **Por Ambos (campoFecha + campoId)** - Más robusto, usa ambos criterios
   - Combina ambos filtros con AND
   - Ejemplo: `GET /api/sync/download/tenant?tabla=Facturas&ultimaSync=2025-11-07T10:30:00Z&ultimoId=5000`

### Configuración de Tabla de Bajada

```typescript
{
  nombre: "Proveedores",
  primaryKey: "id",
  incremental: true,           // ← Activar sincronización incremental
  campoFecha: "updatedAt",      // ← Campo de timestamp para filtrar (opcional)
  campoId: "id",                // ← Campo de ID para filtrar (opcional)
  process: {
    query: "SELECT * FROM proveedores WHERE \"tenantId\" = $1"
  }
}
```

**IMPORTANTE**: Debes configurar al menos `campoFecha` O `campoId` para que funcione la sincronización incremental.

### Cómo Funciona en el Cliente SQL Server

El cliente debe:

1. **Mantener registro de última sincronización**:
   ```sql
   CREATE TABLE sync_control (
     tabla NVARCHAR(100) PRIMARY KEY,
     ultima_bajada DATETIME2,
     ultimo_id_bajado BIGINT
   );
   ```

2. **Antes de sincronizar**, obtener los últimos valores:
   ```sql
   SELECT ultima_bajada, ultimo_id_bajado
   FROM sync_control
   WHERE tabla = 'Proveedores';
   ```

3. **Llamar al endpoint** con los parámetros:
   ```http
   GET /api/sync/download/mi-tenant?tabla=Proveedores&ultimaSync=2025-11-07T10:30:00Z&ultimoId=1000
   ```

4. **Después de aplicar los cambios exitosamente**, actualizar el control:
   ```sql
   UPDATE sync_control
   SET ultima_bajada = GETDATE(),
       ultimo_id_bajado = (SELECT MAX(id) FROM Proveedores)
   WHERE tabla = 'Proveedores';
   ```

### Respuesta del Endpoint

```json
{
  "success": true,
  "tabla": "Proveedores",
  "data": [...],
  "schema": {...},
  "syncType": "incremental",  // ← "incremental" o "completa"
  "timestamp": "2025-11-08T15:45:00.123Z"
}
```

### Ventajas

- ✅ **Menor tráfico de red**: Solo se transfieren registros nuevos/modificados
- ✅ **Mejor performance**: Queries más rápidas al filtrar por fecha/ID
- ✅ **Menor carga en el servidor**: Menos datos procesados por request
- ✅ **Flexibilidad**: Soporta timestamp, ID o ambos según la tabla
- ✅ **Backward compatible**: Si no se envían parámetros, hace sync completa

### Logs de Debugging

Los logs del backend muestran el modo de sincronización:

```
[SYNC DOWNLOAD] acme - Proveedores (INCREMENTAL desde 2025-11-07T10:30:00Z ID > 1000)
[SYNC DOWNLOAD INCREMENTAL] Proveedores - Modo: FECHA+ID, Desde: 2025-11-07T10:30:00Z, ID > 1000
[SYNC DOWNLOAD INCREMENTAL] Registros obtenidos: 45
```

---

## ⚠️ Pendientes

- [ ] Endpoint para listar tenants (usado en selector de tenant)
- [ ] Validación de queries SQL en frontend
- [ ] Editor de código con syntax highlighting para SQL
- [ ] Vista detallada de log individual (modal)
- [ ] Exportar logs a CSV/Excel
- [ ] Gráficos de tendencias de sincronización
- [ ] Notificaciones en tiempo real de sincronizaciones
- [ ] Configuración avanzada de fases (pre/post process)
