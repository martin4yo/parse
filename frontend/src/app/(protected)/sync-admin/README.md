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

## ⚠️ Pendientes

- [ ] Endpoint para listar tenants (usado en selector de tenant)
- [ ] Validación de queries SQL en frontend
- [ ] Editor de código con syntax highlighting para SQL
- [ ] Vista detallada de log individual (modal)
- [ ] Exportar logs a CSV/Excel
- [ ] Gráficos de tendencias de sincronización
- [ ] Notificaciones en tiempo real de sincronizaciones
- [ ] Configuración avanzada de fases (pre/post process)
