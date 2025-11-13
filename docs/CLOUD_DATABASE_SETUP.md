# Configuración de Base de Datos en la Nube

## 🌐 Conexión a PostgreSQL Remoto

### Para conectarte a la base de datos compartida:

1. **Obtén las credenciales del equipo**
   - Host del servidor PostgreSQL
   - Puerto (generalmente 5432)
   - Nombre de la base de datos
   - Usuario y contraseña

2. **Actualiza tu archivo .env local**
   ```bash
   # Copia el archivo de ejemplo
   cp .env.example .env
   
   # Edita con las credenciales reales
   DATABASE_URL="postgresql://usuario:contraseña@host:puerto/nombre_db"
   ```

3. **Sincroniza Prisma con la base remota**
   ```bash
   # Genera el cliente de Prisma
   npm run db:generate
   
   # Opcional: Ver la base de datos con Prisma Studio
   npm run db:studio
   ```

4. **Inicia el servidor**
   ```bash
   npm run dev
   ```

## 🔒 Seguridad Importante

- **NUNCA** subas el archivo `.env` con credenciales reales a Git
- **NUNCA** compartas las credenciales en canales públicos
- Usa variables de entorno diferentes para desarrollo y producción

## 🚀 Ventajas de usar base de datos en la nube

- ✅ Todos trabajan con los mismos datos
- ✅ Cambios en tiempo real
- ✅ No hay conflictos de sincronización
- ✅ Backups automáticos del proveedor
- ✅ Accesible desde cualquier lugar

## 📝 Para migrar datos existentes a la nube

### Opción 1: Usando Prisma (Recomendado)
```bash
# Desde tu base local, genera un backup de Prisma
npx prisma db pull
npx prisma migrate dev --create-only

# Cambia el DATABASE_URL a la base en la nube
# Luego aplica las migraciones
npx prisma migrate deploy
npx prisma db seed  # Si tienes datos de seed
```

### Opción 2: Exportación manual con pg_dump
```bash
# Exportar desde local
pg_dump -h localhost -U postgres -d rendiciones_db > backup.sql

# Importar a la nube
psql -h tu-servidor.com -U usuario -d rendiciones_db < backup.sql
```

### Opción 3: Usando el script de exportación
```bash
# Si tienes pg_dump instalado localmente
npm run db:export

# Luego importa el archivo .sql generado a tu servidor remoto
```

## 🛠️ Proveedores recomendados de PostgreSQL

### Gratuitos/Baratos para desarrollo:
- **Supabase** - 500 MB gratis, excelente para desarrollo
- **Neon** - 3 GB gratis con branching de base de datos
- **Render** - PostgreSQL gratis por 90 días
- **ElephantSQL** - 20 MB gratis (pequeño pero útil para pruebas)
- **Aiven** - Trial de 30 días

### Para producción:
- **AWS RDS**
- **Google Cloud SQL**
- **Azure Database for PostgreSQL**
- **DigitalOcean Managed Databases**
- **Heroku Postgres**

## 🔧 Solución de problemas

### Error de conexión
- Verifica que tu IP esté en la lista blanca del servidor
- Confirma que el puerto esté abierto (generalmente 5432)
- Revisa que SSL esté configurado correctamente si es requerido

### Timeout o lentitud
- La latencia puede ser mayor que con base de datos local
- Considera usar un servidor en tu región geográfica
- Implementa índices apropiados para mejorar performance

### Permisos insuficientes
- Asegúrate de que tu usuario tenga permisos CREATE/ALTER
- Para Prisma migrations necesitas permisos de DDL

## 📞 Soporte

Si tienes problemas con la conexión, contacta al administrador del proyecto para:
- Obtener las credenciales actualizadas
- Añadir tu IP a la lista blanca
- Verificar el estado del servidor