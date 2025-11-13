# Instrucciones para Deploy del Fix de Sync

## Problema Resuelto

Las tablas de sincronización tenían **schemas vacíos** (con 0 columnas), causando el error:
```
CREATE TABLE [rendicion_tarjeta_items] (, PRIMARY KEY (id));
```

## Archivos Modificados

1. **backend/src/routes/sync.js**
   - Detecta schemas vacíos automáticamente
   - Regenera schema desde los datos de PostgreSQL

2. **sync-client/** (ya recompilado)
   - Logs de depuración agregados
   - Binario actualizado en `dist/ax-sync-client.exe`

3. **Scripts nuevos:**
   - `backend/scripts/check-all-schemas.js` - Verificar schemas de todas las tablas
   - `backend/scripts/fix-empty-schema.js` - Eliminar schemas vacíos de la BD

## Pasos para Deploy en Servidor Linux

### 1. Subir archivos al servidor

```bash
# En tu máquina local, sube los cambios
git add .
git commit -m "Fix: Detectar y regenerar schemas vacíos automáticamente"
git push origin master

# O si prefieres subir directo via scp/ftp:
# scp backend/src/routes/sync.js usuario@servidor:/ruta/backend/src/routes/
# scp backend/scripts/*.js usuario@servidor:/ruta/backend/scripts/
```

### 2. En el servidor Linux

```bash
# Conectarse al servidor
ssh usuario@tu-servidor

# Ir al directorio del backend
cd /ruta/a/tu/backend

# Si subiste via git
git pull origin master

# Verificar schemas actuales
node scripts/check-all-schemas.js

# Arreglar schemas vacíos (si los hay)
node scripts/fix-empty-schema.js

# Reiniciar el backend
pm2 restart backend
# O si usas otro método:
# systemctl restart backend
# o kill el proceso y npm run start
```

### 3. Probar la sincronización

En tu máquina Windows con el sync-client:

```cmd
cd D:\Desarrollos\React\Rendiciones\sync-client\dist
ax-sync-client.exe sync
```

## Qué hace el fix

### Antes:
- Schema guardado con `{columns: []}` (vacío)
- Backend enviaba schema vacío al cliente
- Cliente intentaba crear tabla sin columnas → ERROR

### Después:
- Script elimina schemas vacíos de la BD
- Backend detecta schema vacío o undefined
- Backend genera schema automáticamente desde datos de PostgreSQL
- Cliente recibe schema correcto con todas las columnas
- Tabla se crea exitosamente

## Tablas Afectadas

Según el check, estas tablas tenían schema vacío:

1. **parametros_maestros** (Subida) - ✓ Arreglado
2. **rendicion_tarjeta_items** (Bajada) - ✓ Arreglado

## Verificación Post-Deploy

Después del deploy, verifica que todo funciona:

```bash
# En el servidor
node scripts/check-all-schemas.js

# Deberías ver algo como:
# ✓ rendicion_tarjeta_items (auto-generado)
# ✓ parametros_maestros (auto-generado)
```

## Logs para Debug

Si hay problemas, revisa los logs del backend:

```bash
pm2 logs backend --lines 100

# Deberías ver:
# [SYNC DOWNLOAD] Generando schema para rendicion_tarjeta_items desde datos...
# [SYNC DOWNLOAD] Schema auto-generado para rendicion_tarjeta_items: {...}
```

## Notas Importantes

- ⚠️ Los schemas se generan automáticamente la PRIMERA VEZ que se descarga la tabla
- ✅ Una vez generados, se usan para todas las sincronizaciones futuras
- 🔄 Si agregas columnas nuevas, elimina el schema en la BD para que se regenere
- 📝 Los tipos de datos se infieren desde PostgreSQL (NVARCHAR, INT, DATETIME2, etc.)

## Contacto

Si tienes problemas con el deploy, revisa:
1. Logs del backend: `pm2 logs backend`
2. Logs del sync-client: revisa la salida del exe
3. BD directamente: `node scripts/check-all-schemas.js`
