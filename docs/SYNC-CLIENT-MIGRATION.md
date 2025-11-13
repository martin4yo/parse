# Migración del Sync-Client para Sincronización Incremental

**Fecha:** Noviembre 2025
**Versión Backend:** 2.0.0 con soporte incremental por fecha/ID

---

## 🎯 Objetivo

Actualizar el **sync-client** (proyecto separado) para aprovechar la nueva sincronización incremental implementada en el backend.

---

## 📦 Cambios Necesarios en el Sync-Client

### 1. Base de Datos SQL Server - Tabla de Control

Agregar columna para rastrear el último ID sincronizado:

```sql
-- Si la tabla sync_control ya existe:
ALTER TABLE sync_control
ADD ultimo_id_bajado BIGINT NULL;

-- O crear desde cero:
CREATE TABLE sync_control (
  tabla NVARCHAR(100) PRIMARY KEY,
  ultima_subida DATETIME2,           -- Para upload incremental
  ultima_bajada DATETIME2,           -- Para download incremental por fecha
  ultimo_id_bajado BIGINT NULL       -- NUEVO: Para download incremental por ID
);
```

---

### 2. Configuración de Tablas

Las tablas de bajada ahora soportan estos campos adicionales:

```json
{
  "tablasBajada": [
    {
      "nombre": "Proveedores",
      "primaryKey": "id",
      "incremental": true,           // ← Activar sync incremental
      "campoFecha": "updatedAt",     // ← NUEVO: Campo de timestamp (opcional)
      "campoId": "id",               // ← NUEVO: Campo de ID (opcional)
      "process": {
        "query": "..."
      }
    }
  ]
}
```

**Nota**: Al menos `campoFecha` O `campoId` debe estar configurado para sincronización incremental.

---

### 3. Módulo de Download - Lógica Actualizada

#### Antes (sincronización completa siempre):
```javascript
async function downloadTable(tabla, apiClient, tenantId) {
  const url = `/api/sync/download/${tenantId}?tabla=${tabla.nombre}`;
  const response = await apiClient.get(url);
  await applyDataToSQLServer(tabla.nombre, response.data);
}
```

#### Después (sincronización incremental):
```javascript
async function downloadTable(tablaConfig, apiClient, tenantId) {
  const { nombre, incremental, campoFecha, campoId } = tablaConfig;

  // 1. Obtener última sincronización de SQL Server (si es incremental)
  let ultimaSync = null;
  let ultimoId = null;

  if (incremental) {
    const control = await sqlServer.query(`
      SELECT ultima_bajada, ultimo_id_bajado
      FROM sync_control
      WHERE tabla = @tabla
    `, { tabla: nombre });

    if (control && control.length > 0) {
      // Convertir fecha a formato ISO
      ultimaSync = control[0].ultima_bajada?.toISOString();
      ultimoId = control[0].ultimo_id_bajado;
    }
  }

  // 2. Construir URL con parámetros incrementales
  let url = `/api/sync/download/${tenantId}?tabla=${nombre}`;

  if (incremental) {
    if (campoFecha && ultimaSync) {
      url += `&ultimaSync=${encodeURIComponent(ultimaSync)}`;
      console.log(`[DOWNLOAD] ${nombre} - Sincronización incremental por FECHA desde ${ultimaSync}`);
    }
    if (campoId && ultimoId) {
      url += `&ultimoId=${ultimoId}`;
      console.log(`[DOWNLOAD] ${nombre} - Sincronización incremental por ID > ${ultimoId}`);
    }
  }

  // 3. Llamar al endpoint
  const response = await apiClient.get(url);

  if (!response.success) {
    throw new Error(`Error descargando ${nombre}: ${response.error}`);
  }

  console.log(`[DOWNLOAD] ${nombre} - Tipo: ${response.syncType}, Registros: ${response.data.length}`);

  // 4. Aplicar datos al SQL Server
  const registrosAplicados = await applyDataToSQLServer(
    nombre,
    response.data,
    response.schema
  );

  // 5. Actualizar sync_control SOLO si fue exitoso
  if (incremental && response.data.length > 0) {
    let maxId = null;

    if (campoId && response.data.length > 0) {
      // Obtener el ID máximo de los datos descargados
      maxId = Math.max(...response.data.map(row => row[campoId] || 0));
    }

    await sqlServer.query(`
      MERGE sync_control AS target
      USING (SELECT @tabla AS tabla) AS source
      ON target.tabla = source.tabla
      WHEN MATCHED THEN
        UPDATE SET
          ultima_bajada = GETDATE(),
          ultimo_id_bajado = CASE
            WHEN @maxId IS NOT NULL THEN @maxId
            ELSE target.ultimo_id_bajado
          END
      WHEN NOT MATCHED THEN
        INSERT (tabla, ultima_bajada, ultimo_id_bajado)
        VALUES (@tabla, GETDATE(), @maxId);
    `, { tabla: nombre, maxId });

    console.log(`[DOWNLOAD] ${nombre} - Control actualizado: ultima_bajada=${new Date().toISOString()}, ultimo_id_bajado=${maxId}`);
  }

  return {
    tabla: nombre,
    syncType: response.syncType,
    registros: response.data.length,
    registrosAplicados
  };
}
```

---

### 4. Inicialización de Sync Control

Al iniciar el cliente por primera vez, inicializar registros:

```javascript
async function initializeSyncControl(tablasConfig) {
  console.log('[INIT] Inicializando sync_control...');

  for (const tabla of tablasConfig.tablasBajada) {
    await sqlServer.query(`
      IF NOT EXISTS (SELECT 1 FROM sync_control WHERE tabla = @tabla)
      BEGIN
        INSERT INTO sync_control (tabla, ultima_subida, ultima_bajada, ultimo_id_bajado)
        VALUES (@tabla, NULL, NULL, NULL)
      END
    `, { tabla: tabla.nombre });
  }

  console.log(`[INIT] Sync control inicializado para ${tablasConfig.tablasBajada.length} tablas`);
}
```

---

### 5. Logs Mejorados

Incluir información del tipo de sincronización:

```javascript
const log = {
  tabla: nombre,
  direccion: 'download',
  fase: 'process',
  ejecutadoEn: 'destino',
  estado: 'exitoso',
  registrosAfectados: response.data.length,
  mensaje: `Sincronización ${response.syncType} completada${response.syncType === 'incremental' ? ` (${ultimaSync ? 'fecha' : ''}${ultimaSync && ultimoId ? '+' : ''}${ultimoId ? 'id' : ''})` : ''}`,
  duracionMs: duracion,
  metadatos: {
    syncType: response.syncType,
    ultimaSync: ultimaSync,
    ultimoId: ultimoId,
    registrosDescargados: response.data.length,
    registrosAplicados: registrosAplicados
  },
  fechaInicio: inicioFecha,
  fechaFin: new Date()
};

// Enviar al backend
await apiClient.post(`/api/sync/logs/${tenantId}`, { logs: [log] });
```

---

## 🔄 Flujo Completo de Download Incremental

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Cliente lee sync_control                                 │
│    SELECT ultima_bajada, ultimo_id_bajado                   │
│    WHERE tabla = 'Proveedores'                              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Cliente construye URL con parámetros                     │
│    /download/tenant?tabla=Proveedores&                      │
│    ultimaSync=2025-11-08T10:00:00Z&ultimoId=1500            │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend filtra registros                                 │
│    WHERE updatedAt > '2025-11-08T10:00:00Z'                 │
│    AND id > 1500                                            │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Backend devuelve datos filtrados                         │
│    { success: true, syncType: "incremental",                │
│      data: [45 registros], ... }                            │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Cliente aplica datos a SQL Server                        │
│    INSERT/UPDATE en tabla Proveedores                       │
│    (45 registros aplicados)                                 │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Cliente actualiza sync_control                           │
│    UPDATE sync_control                                      │
│    SET ultima_bajada = GETDATE(),                           │
│        ultimo_id_bajado = 1545  -- MAX(id) de datos         │
│    WHERE tabla = 'Proveedores'                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Consideraciones Importantes

### 1. Transaccionalidad

Asegúrate de que la actualización de `sync_control` esté condicionada al éxito:

```javascript
try {
  await sqlServer.beginTransaction();

  // Aplicar datos
  await applyDataToSQLServer(nombre, data, schema);

  // Actualizar control
  await updateSyncControl(nombre, maxId);

  await sqlServer.commit();
} catch (error) {
  await sqlServer.rollback();
  console.error('Error aplicando datos, rollback ejecutado');
  throw error;
}
```

### 2. Manejo de Errores

Si falla la aplicación de datos, **NO actualices** `sync_control`. La próxima ejecución reintentará:

```javascript
if (!response.success) {
  // NO actualizar sync_control
  throw new Error(`Error en download: ${response.error}`);
}
```

### 3. Reinicio Manual (Sync Completa)

Permite forzar una sincronización completa:

```sql
-- Resetear para que la próxima sea completa
UPDATE sync_control
SET ultima_bajada = NULL, ultimo_id_bajado = NULL
WHERE tabla = 'Proveedores';

-- O eliminar el registro
DELETE FROM sync_control WHERE tabla = 'Proveedores';
```

### 4. Primera Ejecución

Si no hay registro en `sync_control`, el backend automáticamente hará sincronización completa.

### 5. Validación de Configuración

Validar que la configuración sea consistente:

```javascript
function validateTablaConfig(tabla) {
  if (tabla.incremental) {
    if (!tabla.campoFecha && !tabla.campoId) {
      throw new Error(
        `Tabla ${tabla.nombre}: incremental=true requiere campoFecha O campoId`
      );
    }
  }
}
```

---

## 📊 Ventajas de la Sincronización Incremental

| Métrica | Sync Completa | Sync Incremental | Mejora |
|---------|---------------|------------------|--------|
| Datos transferidos | 100% (ej: 10,000 registros) | ~5% (ej: 500 registros) | -95% |
| Tiempo de ejecución | 60 segundos | 3 segundos | -95% |
| Carga en SQL Server | Alta | Baja | -90% |
| Carga en PostgreSQL | Alta | Baja | -90% |
| Ancho de banda | 5 MB | 250 KB | -95% |

---

## 🧪 Testing

### Prueba 1: Sincronización Incremental por Fecha
```javascript
// 1. Ejecutar sync completa
await downloadTable(tablaConfig, apiClient, tenantId);
// Resultado: syncType='completa', 10000 registros

// 2. Modificar 3 registros en PostgreSQL
await updateProveedores([id1, id2, id3]);

// 3. Ejecutar sync incremental
await downloadTable(tablaConfig, apiClient, tenantId);
// Resultado: syncType='incremental', 3 registros
```

### Prueba 2: Sincronización Incremental por ID
```javascript
// 1. Sincronizar hasta ID 1000
await downloadTable(tablaConfig, apiClient, tenantId);

// 2. Insertar nuevos registros con ID > 1000
await insertProveedores([1001, 1002, 1003]);

// 3. Ejecutar sync incremental
await downloadTable(tablaConfig, apiClient, tenantId);
// Resultado: syncType='incremental', 3 registros (ID > 1000)
```

### Prueba 3: Forzar Sincronización Completa
```javascript
// 1. Eliminar control
await sqlServer.query('DELETE FROM sync_control WHERE tabla = @tabla', { tabla: 'Proveedores' });

// 2. Ejecutar sync
await downloadTable(tablaConfig, apiClient, tenantId);
// Resultado: syncType='completa', 10000 registros
```

---

## 📝 Checklist de Migración

- [ ] Actualizar tabla `sync_control` en SQL Server (agregar columna `ultimo_id_bajado`)
- [ ] Modificar función `downloadTable()` para enviar parámetros `ultimaSync` y `ultimoId`
- [ ] Actualizar lógica de construcción de URL con query params
- [ ] Implementar actualización de `sync_control` después de aplicar datos
- [ ] Agregar validación de configuración (`campoFecha` o `campoId` requeridos)
- [ ] Inicializar `sync_control` para tablas nuevas
- [ ] Mejorar logs para incluir tipo de sincronización
- [ ] Probar sincronización incremental por fecha
- [ ] Probar sincronización incremental por ID
- [ ] Probar sincronización por ambos criterios
- [ ] Verificar manejo de errores (no actualizar control si falla)
- [ ] Documentar procedimiento de reset manual

---

## 🆘 Troubleshooting

### Problema: Siempre hace sync completa

**Causa**: No se están enviando los parámetros `ultimaSync` o `ultimoId`

**Solución**:
1. Verificar que `tablaConfig.incremental = true`
2. Verificar que `sync_control` tiene datos para la tabla
3. Revisar logs del cliente para ver la URL construida

### Problema: No se actualizan registros modificados

**Causa**: El campo de fecha no se actualiza en PostgreSQL al modificar registros

**Solución**:
1. Asegurar que PostgreSQL tiene un trigger que actualice `updatedAt`
2. O usar sincronización por ID en lugar de fecha

### Problema: Error "El parámetro ultimaSync no es una fecha válida"

**Causa**: Formato de fecha incorrecto

**Solución**:
```javascript
// Correcto (ISO 8601):
ultimaSync = new Date(fechaSQL).toISOString();
// "2025-11-08T15:30:00.000Z"

// Incorrecto:
ultimaSync = fechaSQL.toString();
// "Fri Nov 08 2025 15:30:00"
```

---

## 📞 Contacto

Para dudas sobre la implementación, revisar:
- **Backend docs**: `frontend/src/app/(protected)/sync-admin/README.md`
- **API Reference**: Sección "Sincronización Incremental en Download"
- **Endpoint**: `GET /api/sync/download/:tenantId`
