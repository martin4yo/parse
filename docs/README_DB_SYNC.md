# Sincronización de Base de Datos - Sistema de Rendiciones

## Para exportar tu base de datos (compartir con el equipo)

1. Asegúrate de tener PostgreSQL instalado con las herramientas de línea de comandos (pg_dump)
2. Ejecuta:
```bash
npm run db:export
```
3. Se creará un archivo en `backend/backups/backup_[fecha].sql`
4. Comparte este archivo con tus colegas

## Para importar la base de datos (colegas)

### Requisitos previos:
- PostgreSQL instalado localmente
- Herramientas de línea de comandos de PostgreSQL (psql)
- Node.js instalado

### Pasos:

1. **Configurar el archivo .env**
   - Copia `.env.example` a `.env` (si existe)
   - Actualiza `DATABASE_URL` con tus credenciales locales:
   ```
   DATABASE_URL="postgresql://[tu_usuario]:[tu_contraseña]@localhost:5432/rendiciones_db"
   ```

2. **Crear la base de datos (si no existe)**
   ```bash
   createdb rendiciones_db
   ```
   O usando psql:
   ```sql
   CREATE DATABASE rendiciones_db;
   ```

3. **Colocar el archivo de backup**
   - Crea la carpeta `backend/backups/` si no existe
   - Coloca el archivo `.sql` compartido en esta carpeta

4. **Importar los datos**
   ```bash
   npm run db:import
   ```
   - Se mostrará una lista de archivos disponibles
   - Selecciona el archivo a importar (o Enter para el más reciente)
   - Confirma la importación

5. **Sincronizar Prisma**
   ```bash
   npm run db:generate
   ```

6. **Iniciar el servidor**
   ```bash
   npm run dev
   ```

## Notas importantes

- **ADVERTENCIA**: La importación REEMPLAZA TODOS los datos existentes en la base de datos
- Los scripts utilizan `--no-owner` y `--no-acl` para evitar problemas de permisos entre diferentes sistemas
- El backup incluye la estructura completa y todos los datos
- Se recomienda hacer un backup antes de importar datos nuevos

## Solución de problemas

### Error: pg_dump o psql no encontrado
- Asegúrate de tener PostgreSQL instalado
- En Windows, añade la ruta de PostgreSQL al PATH del sistema (ej: `C:\Program Files\PostgreSQL\15\bin`)
- En Mac: `brew install postgresql`
- En Linux: `sudo apt-get install postgresql-client`

### Error de permisos
- Verifica que tu usuario tenga permisos para crear/modificar la base de datos
- Asegúrate de que las credenciales en `.env` sean correctas

### La base de datos no existe
- Crea la base de datos manualmente antes de importar:
  ```bash
  createdb rendiciones_db
  ```