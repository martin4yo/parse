const fs = require('fs');
const path = require('path');

// Función para procesar archivos
function fixPrismaReferences(filePath) {
  console.log(`Procesando: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Reemplazar referencias incorrectas
  const replacements = [
    { from: /prisma\.user([^s])/g, to: 'prisma.users$1' },
    { from: /prisma\.tenant([^s])/g, to: 'prisma.tenants$1' },
    { from: /prisma\.profile([^s])/g, to: 'prisma.profiles$1' },
    { from: /prisma\.userAtributo/g, to: 'prisma.user_atributos' },
    { from: /prisma\.usersTarjetaCredito/g, to: 'prisma.users_tarjetas_credito' },
    { from: /prisma\.atributo([^s])/g, to: 'prisma.atributos$1' },
    { from: /prisma\.valorAtributo/g, to: 'prisma.valores_atributo' },
    { from: /prisma\.usuarioAutorizante/g, to: 'prisma.usuario_autorizantes' },
    { from: /prisma\.delegacion([^e])/g, to: 'prisma.delegaciones$1' },
    { from: /prisma\.delegacionTarjeta/g, to: 'prisma.delegacion_tarjetas' },
  ];

  replacements.forEach(({ from, to }) => {
    const before = content;
    content = content.replace(from, to);
    if (content !== before) {
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Corregido: ${filePath}`);
  } else {
    console.log(`✓ Sin cambios: ${filePath}`);
  }
}

// Archivos a procesar
const routesDir = path.join(__dirname, 'src', 'routes');
const files = [
  'delegaciones.js',
  'documentos.js',
  'exportar.js',
  'rendiciones.js',
  'userAtributos.js',
  'users.js',
  'userTarjetasCredito.js',
  'usuarioAutorizantes.js'
];

console.log('🔧 Iniciando corrección de referencias de Prisma...\n');

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  if (fs.existsSync(filePath)) {
    fixPrismaReferences(filePath);
  } else {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
  }
});

console.log('\n🎉 Corrección completada!');