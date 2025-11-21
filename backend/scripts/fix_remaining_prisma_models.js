const fs = require('fs');
const path = require('path');

const routesDir = './src/routes';

// Model name mappings based on the schema
const modelMappings = [
  // Already fixed
  { from: /prisma\.user([^s])/g, to: 'prisma.users$1' },
  { from: /prisma\.profile([^s])/g, to: 'prisma.profiles$1' },
  { from: /prisma\.atributo([^s])/g, to: 'prisma.atributos$1' },
  { from: /documentoProcesado/g, to: 'documentos_procesados' },

  // Additional potential issues
  { from: /prisma\.valorAtributo/g, to: 'prisma.valores_atributo' },
  { from: /prisma\.usuarioAutorizante/g, to: 'prisma.usuario_autorizantes' },
  { from: /prisma\.userAtributo/g, to: 'prisma.user_atributos' },
  { from: /prisma\.delegacionTarjeta/g, to: 'prisma.delegacion_tarjetas' },
  { from: /prisma\.tipoTarjeta/g, to: 'prisma.tipos_tarjeta' },
  { from: /prisma\.banco/g, to: 'prisma.bancos' },
  { from: /prisma\.tarjeta/g, to: 'prisma.tarjetas' },
  { from: /prisma\.resumenTarjeta/g, to: 'prisma.resumen_tarjeta' },
  { from: /prisma\.rendicionCabecera/g, to: 'prisma.rendicion_tarjeta_cabecera' },
  { from: /prisma\.rendicionItem/g, to: 'prisma.rendicion_tarjeta_items' },
  { from: /prisma\.rendicionDetalle/g, to: 'prisma.rendicion_tarjeta_detalle' },
  { from: /prisma\.userTarjetaCredito/g, to: 'prisma.users_tarjetas_credito' },
  { from: /prisma\.documentoAsociado/g, to: 'prisma.documentos_asociados' },
  { from: /prisma\.tenant([^s])/g, to: 'prisma.tenants$1' },
  { from: /prisma\.estado/g, to: 'prisma.estados' },
  { from: /prisma\.delegacion/g, to: 'prisma.delegaciones' },
  { from: /prisma\.reglaProcesamiento/g, to: 'prisma.reglas_procesamiento' },
  { from: /prisma\.parametro/g, to: 'prisma.parametros' },
  { from: /prisma\.job/g, to: 'prisma.jobs' }
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    modelMappings.forEach(mapping => {
      const before = content;
      content = content.replace(mapping.from, mapping.to);
      if (content !== before) {
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  let totalFixed = 0;

  files.forEach(file => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      totalFixed += processDirectory(filePath);
    } else if (file.endsWith('.js')) {
      if (fixFile(filePath)) {
        totalFixed++;
      }
    }
  });

  return totalFixed;
}

console.log('🔧 Fixing remaining Prisma model references...');
const fixedCount = processDirectory(routesDir);
console.log(`✨ Fixed ${fixedCount} files total`);

// Also fix middleware files
const middlewareDir = './src/middleware';
if (fs.existsSync(middlewareDir)) {
  const middlewareFixed = processDirectory(middlewareDir);
  console.log(`🛡️ Fixed ${middlewareFixed} middleware files`);
}