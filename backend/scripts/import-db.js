const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Buscar archivos de backup disponibles
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  console.error('❌ No se encontró el directorio backups/');
  console.log('📁 Por favor, crea el directorio backend/backups/ y coloca el archivo de backup allí.');
  process.exit(1);
}

const backupFiles = fs.readdirSync(backupDir)
  .filter(file => file.endsWith('.sql'))
  .sort()
  .reverse(); // Más reciente primero

if (backupFiles.length === 0) {
  console.error('❌ No se encontraron archivos de backup en backups/');
  console.log('📁 Por favor, coloca el archivo .sql en backend/backups/');
  process.exit(1);
}

console.log('📋 Archivos de backup disponibles:\n');
backupFiles.forEach((file, index) => {
  const filePath = path.join(backupDir, file);
  const stats = fs.statSync(filePath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`${index + 1}. ${file} (${fileSizeMB} MB)`);
});

rl.question('\n🔢 Selecciona el número del archivo a importar (o Enter para el más reciente): ', (answer) => {
  let selectedFile;
  
  if (answer === '') {
    selectedFile = backupFiles[0];
  } else {
    const index = parseInt(answer) - 1;
    if (index >= 0 && index < backupFiles.length) {
      selectedFile = backupFiles[index];
    } else {
      console.error('❌ Selección inválida');
      rl.close();
      process.exit(1);
    }
  }

  const backupFile = path.join(backupDir, selectedFile);
  
  console.log(`\n⚠️  ADVERTENCIA: Esto reemplazará TODOS los datos en la base de datos ${dbConfig.database}`);
  
  rl.question('¿Estás seguro? (s/N): ', (confirm) => {
    if (confirm.toLowerCase() !== 's') {
      console.log('❌ Importación cancelada');
      rl.close();
      process.exit(0);
    }

    // Configurar variables de entorno para psql
    const env = {
      ...process.env,
      PGPASSWORD: dbConfig.password
    };

    // Comando psql para importar
    const command = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${backupFile}"`;

    console.log('\n🔵 Iniciando importación de base de datos...');
    console.log(`📁 Archivo: ${selectedFile}`);

    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error al importar la base de datos:', error.message);
        if (stderr && !stderr.includes('NOTICE')) {
          console.error('Detalles:', stderr);
        }
        rl.close();
        process.exit(1);
      }

      console.log('✅ Base de datos importada exitosamente!');
      console.log('\n📋 Próximos pasos:');
      console.log('1. Ejecutar: npm run db:generate (para sincronizar Prisma Client)');
      console.log('2. Reiniciar el servidor: npm run dev');
      
      rl.close();
    });
  });
});