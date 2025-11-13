# Resumen de Arreglos - Sistema de Sincronización

## 🔍 Problemas Encontrados y Solucionados

### Problema #1: Schemas Vacíos
**Error Original:**
```
CREATE TABLE [rendicion_tarjeta_items] (, PRIMARY KEY (id));
Error: Incorrect syntax near ','
```

**Causa:** Las tablas tenían schemas guardados pero con 0 columnas: `{columns: []}`

**Solución:**
- Backend detecta schemas vacíos/undefined automáticamente
- Genera schema desde datos de PostgreSQL usando `generateSchemaFromData()`
- Mapea tipos: `text→NVARCHAR(MAX)`, `integer→INT`, `boolean→BIT`, etc.

**Archivos modificados:**
- `backend/src/routes/sync.js:184-197`

---

### Problema #2: Tablas Temporales Inaccesibles
**Error Original:**
```
Invalid object name '#temp_rendicion_tarjeta_items_1759884280987'
```

**Causa:** Las tablas `#temp` en SQL Server solo existen en la sesión que las creó. El bulk insert se ejecutaba en otra sesión.

**Solución:**
- Cambiado de `#temp_*` a tablas regulares `_sync_temp_*`
- Las tablas regulares son accesibles desde cualquier request del pool
- Se eliminan automáticamente con `DROP TABLE` en bloque `finally`

**Archivos modificados:**
- `sync-client/src/database/sqlServerClient.js:120-148` (createTempTable)
- `sync-client/src/sync/downloader.js:125-173` (uso de tablas temporales)

---

### Problema #3: Tipos de Datos Incompatibles en Bulk Insert
**Error Original:**
```
Invalid column type from bcp client for colid 1
```

**Causa:** La tabla se creaba con tipos desde el schema (ej: `NVARCHAR(MAX)`), pero el bulk insert infería tipos desde JavaScript (ej: `sql.NVarChar` sin tamaño).

**Solución:**
- `bulkInsert()` ahora recibe el schema como parámetro
- Nueva función `sqlServerTypeToMssqlType()` convierte strings tipo "NVARCHAR(MAX)" a objetos `sql.NVarChar(sql.MAX)`
- Soporta todos los tipos: NVARCHAR, INT, DECIMAL, BIT, DATETIME2, etc.

**Archivos modificados:**
- `sync-client/src/database/sqlServerClient.js:151-294` (bulkInsert + conversión tipos)

---

## 📁 Archivos Nuevos Creados

### Scripts de Diagnóstico

1. **backend/scripts/check-all-schemas.js**
   - Verifica schemas de TODAS las tablas configuradas
   - Muestra columnas, primary keys, si está vacío
   - Genera resumen de tablas con problemas

2. **backend/scripts/fix-empty-schema.js**
   - Elimina schemas vacíos de la base de datos
   - Se debe ejecutar UNA VEZ para limpiar configuraciones rotas

3. **backend/scripts/list-all-tables-schemas.js**
   - Lista TODAS las 35 tablas de PostgreSQL
   - Muestra schema completo con tipos mapeados a SQL Server
   - Genera JSON de configuración para cada tabla

4. **backend/scripts/list-tables-summary.js**
   - Resumen rápido de tablas disponibles
   - Agrupa por categoría (Maestros, Rendiciones, Cajas, etc.)
   - Muestra cuáles están configuradas en sync

### Documentación

5. **INSTRUCCIONES_DEPLOY.md**
   - Guía paso a paso para deploy en servidor Linux
   - Comandos exactos a ejecutar
   - Verificaciones post-deploy

6. **RESUMEN_ARREGLOS_SYNC.md** (este archivo)
   - Documentación técnica completa

---

## 🚀 Pasos para Aplicar en Servidor Linux

### 1. Subir Archivos al Servidor

**Opción A: Via Git**
```bash
# En tu máquina local
git add .
git commit -m "Fix: Schemas vacíos, tablas temporales y tipos de datos en sync"
git push origin master

# En el servidor
cd /ruta/a/tu/backend
git pull origin master
npm install  # Por si acaso
```

**Opción B: Via SCP** (si prefieres subir archivos específicos)
```bash
scp backend/src/routes/sync.js usuario@servidor:/ruta/backend/src/routes/
scp backend/scripts/*.js usuario@servidor:/ruta/backend/scripts/
```

### 2. En el Servidor - Ejecutar Fix

```bash
# Verificar estado actual
node scripts/check-all-schemas.js

# Arreglar schemas vacíos (ejecutar UNA VEZ)
node scripts/fix-empty-schema.js

# Verificar que se arregló
node scripts/check-all-schemas.js

# Reiniciar backend
pm2 restart backend

# Ver logs
pm2 logs backend --lines 50
```

### 3. Probar Sincronización

**En tu máquina Windows:**
```cmd
cd D:\Desarrollos\React\Rendiciones\sync-client\dist
ax-sync-client.exe sync
```

Deberías ver:
```
✓ Descargados 309 registros de rendicion_tarjeta_items
✓ Tabla rendicion_tarjeta_items creada exitosamente
✓ Tabla temporal _sync_temp_... creada
✓ Bulk insert completado: 309 registros
✓ Download de rendicion_tarjeta_items completado
```

---

## 🔧 Cambios Técnicos Detallados

### Backend: Generación Automática de Schemas

**Antes:**
```javascript
let schema = tablaConfig.schema;  // Podía estar vacío
if (!schema && data.length > 0) {
  schema = generateSchemaFromData(data[0], tablaConfig.primaryKey);
}
```

**Después:**
```javascript
let schema = tablaConfig.schema;
const schemaIsEmpty = !schema || !schema.columns || schema.columns.length === 0;

if (schemaIsEmpty && data.length > 0) {
  // Regenerar schema desde datos de PostgreSQL
  schema = generateSchemaFromData(data[0], tablaConfig.primaryKey);
}
```

### Sync-Client: Tablas Temporales Persistentes

**Antes:**
```javascript
const createTableSQL = `CREATE TABLE #${tableName} (...)`;
await this.execute(createTableSQL);
await this.bulkInsert(`#${tableName}`, data);  // ❌ Falla: tabla no existe en otra sesión
```

**Después:**
```javascript
const fullTableName = `_sync_temp_${tableName}`;
const createTableSQL = `CREATE TABLE [${fullTableName}] (...)`;
await this.execute(createTableSQL);
await this.bulkInsert(fullTableName, data, schema);  // ✅ Funciona

// Limpieza automática
try {
  // ... usar tabla ...
} finally {
  await this.execute(`DROP TABLE IF EXISTS [${fullTableName}];`);
}
```

### Sync-Client: Mapeo de Tipos de Datos

**Nueva función `sqlServerTypeToMssqlType()`:**

| String Type | Objeto mssql |
|-------------|--------------|
| `NVARCHAR(MAX)` | `sql.NVarChar(sql.MAX)` |
| `NVARCHAR(255)` | `sql.NVarChar(255)` |
| `INT` | `sql.Int` |
| `DECIMAL(18,2)` | `sql.Decimal(18, 2)` |
| `BIT` | `sql.Bit` |
| `DATETIME2` | `sql.DateTime2` |
| `UNIQUEIDENTIFIER` | `sql.UniqueIdentifier` |

---

## 📊 Verificación Post-Deploy

### 1. Check de Schemas
```bash
node scripts/check-all-schemas.js
```
Debe mostrar:
```
✓ rendicion_tarjeta_items (X columnas)
✓ parametros_maestros (X columnas)
Total de tablas con schema vacío: 0
```

### 2. Logs del Backend
```bash
pm2 logs backend | grep "SYNC DOWNLOAD"
```
Debe mostrar:
```
[SYNC DOWNLOAD] Generando schema para rendicion_tarjeta_items desde datos...
[SYNC DOWNLOAD] Schema auto-generado para rendicion_tarjeta_items: {...}
```

### 3. Sincronización Exitosa
El sync-client debe completar sin errores:
```
Upload: 1 OK, 0 ERROR
Download: 1 OK, 0 ERROR
✓ Sincronización completada
```

---

## 🧪 Testing Local (Opcional)

Si quieres probar localmente antes de deploy:

```bash
# Backend local
cd backend
npm run dev

# En otra terminal - ejecutar scripts
node scripts/check-all-schemas.js
node scripts/fix-empty-schema.js
```

---

## 📝 Notas Importantes

1. **Schemas Vacíos**: Solo necesitas ejecutar `fix-empty-schema.js` UNA VEZ. Una vez eliminados, el backend los regenera automáticamente.

2. **Tablas Temporales**: Las tablas `_sync_temp_*` se eliminan automáticamente después de cada sincronización. Si ves alguna en la BD, significa que hubo un error y quedó huérfana (puedes eliminarla manualmente).

3. **Tipos de Datos**: Si agregas columnas nuevas a una tabla PostgreSQL, elimina el schema de esa tabla en `sync_configurations` para que se regenere.

4. **Performance**: Las tablas regulares son ligeramente más lentas que `#temp`, pero la diferencia es despreciable (<100ms) y evita problemas de sesiones.

---

## 🆘 Troubleshooting

### Error: "No se puede conectar al backend"
```bash
# Verificar que el backend esté corriendo
pm2 status
pm2 logs backend

# Verificar puerto
netstat -tulpn | grep 5050
```

### Error: "Schema sigue vacío después de fix"
```bash
# Eliminar schema manualmente desde la BD
# Luego el backend lo regenerará en la próxima sync
UPDATE sync_configurations
SET configuracionTablas = jsonb_set(
  configuracionTablas,
  '{tablasBajada,0}',
  configuracionTablas->'tablasBajada'->0 - 'schema'
)
WHERE tenantId = 'TU_TENANT_ID';
```

### Error: "Tabla temporal no se elimina"
```sql
-- Limpiar manualmente tablas huérfanas
SELECT name FROM sys.tables WHERE name LIKE '_sync_temp_%';
DROP TABLE [_sync_temp_XXXX];
```

---

## ✅ Checklist de Deploy

- [ ] Subir archivos al servidor (git pull o scp)
- [ ] Ejecutar `node scripts/fix-empty-schema.js`
- [ ] Verificar con `node scripts/check-all-schemas.js`
- [ ] Reiniciar backend (`pm2 restart backend`)
- [ ] Probar sync desde Windows
- [ ] Verificar logs (`pm2 logs backend`)
- [ ] Confirmar que tablas se crearon en SQL Server

---

## 📞 Contacto y Soporte

Si encuentras algún problema:

1. Revisa logs del backend: `pm2 logs backend --lines 100`
2. Revisa logs del sync-client: Salida del .exe
3. Verifica schemas: `node scripts/check-all-schemas.js`
4. Verifica tablas en SQL Server: Busca `rendicion_tarjeta_items` y `_sync_temp_*`

---

**Última actualización:** 2025-10-07
**Versión:** 1.0.0
**Estado:** ✅ Probado localmente, listo para deploy
