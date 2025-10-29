const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Parsear la URL de la base de datos
const DATABASE_URL = process.env.DATABASE_URL;
const dbConfig = {};

if (DATABASE_URL) {
  const url = new URL(DATABASE_URL);
  dbConfig.user = url.username;
  dbConfig.password = url.password;
  dbConfig.host = url.hostname;
  dbConfig.port = url.port || 5432;
  dbConfig.database = url.pathname.slice(1);
}

// Crear directorio de backups si no existe
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

// Generar nombre de archivo con timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);

// Configurar variables de entorno para pg_dump
const env = {
  ...process.env,
  PGPASSWORD: dbConfig.password
};

// Comando pg_dump con opciones recomendadas
const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} --clean --if-exists --no-owner --no-acl -f "${backupFile}"`;

console.log('🔵 Iniciando exportación de base de datos...');
console.log(`📁 Archivo: ${backupFile}`);

exec(command, { env }, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error al exportar la base de datos:', error.message);
    if (stderr) console.error('Detalles:', stderr);
    process.exit(1);
  }

  // Verificar que el archivo se creó
  if (fs.existsSync(backupFile)) {
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ Base de datos exportada exitosamente!');
    console.log(`📦 Tamaño del archivo: ${fileSizeMB} MB`);
    console.log(`📍 Ubicación: ${backupFile}`);
    console.log('\n📋 Instrucciones para tus colegas:');
    console.log('1. Copiar el archivo backup a backend/backups/');
    console.log('2. Ejecutar: npm run db:import');
  } else {
    console.error('❌ El archivo de backup no se creó correctamente');
    process.exit(1);
  }
});