const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const bancosArgentina = [
  { codigo: '00007', descripcion: 'BANCO DE GALICIA Y BUENOS AIRES S.A.' },
  { codigo: '00011', descripcion: 'BANCO DE LA NACION ARGENTINA' },
  { codigo: '00014', descripcion: 'BANCO DE LA PROVINCIA DE BUENOS AIRES' },
  { codigo: '00015', descripcion: 'INDUSTRIAL AND COMMERCIAL BANK OF CHINA' },
  { codigo: '00016', descripcion: 'CITIBANK N.A.' },
  { codigo: '00017', descripcion: 'BBVA ARGENTINA S.A.' },
  { codigo: '00018', descripcion: 'BANK OF AMERICA, NATIONAL ASSOCIATION' },
  { codigo: '00020', descripcion: 'BANCO DE LA PROVINCIA DE CORDOBA S.A.' },
  { codigo: '00027', descripcion: 'BANCO SUPERVIELLE S.A.' },
  { codigo: '00029', descripcion: 'BANCO DE LA CIUDAD DE BUENOS AIRES' },
  { codigo: '00034', descripcion: 'BANCO PATAGONIA S.A.' },
  { codigo: '00044', descripcion: 'BANCO HIPOTECARIO S.A.' },
  { codigo: '00045', descripcion: 'BANCO DE SAN JUAN S.A.' },
  { codigo: '00046', descripcion: 'BANCO DO BRASIL S.A.' },
  { codigo: '00060', descripcion: 'BANCO DEL TUCUMAN S.A.' },
  { codigo: '00065', descripcion: 'BANCO MUNICIPAL DE ROSARIO' },
  { codigo: '00072', descripcion: 'BANCO SANTANDER ARGENTINA S.A.' },
  { codigo: '00083', descripcion: 'BANCO DEL CHUBUT S.A.' },
  { codigo: '00086', descripcion: 'BANCO DE SANTA CRUZ S.A.' },
  { codigo: '00093', descripcion: 'BANCO DE LA PAMPA SOCIEDAD DE ECONOMIA MIXTA' },
  { codigo: '00094', descripcion: 'BANCO DE CORRIENTES S.A.' },
  { codigo: '00097', descripcion: 'BANCO PROVINCIA DEL NEUQUEN SOCIEDAD ANONIMA' },
  { codigo: '00143', descripcion: 'BRUBANK S.A.U.' },
  { codigo: '00147', descripcion: 'BANCO INTERFINANZAS S.A.' },
  { codigo: '00150', descripcion: 'HSBC BANK ARGENTINA S.A.' },
  { codigo: '00191', descripcion: 'BANCO CREDICOOP COOPERATIVO LIMITADO' },
  { codigo: '00198', descripcion: 'BANCO DE VALORES S.A.' },
  { codigo: '00247', descripcion: 'BANCO ROELA S.A.' },
  { codigo: '00254', descripcion: 'BANCO MARIVA S.A.' },
  { codigo: '00259', descripcion: 'BANCO ITAU ARGENTINA S.A.' },
  { codigo: '00262', descripcion: 'BANK OF CHINA LIMITED SUCURSAL BUENOS AIRES' },
  { codigo: '00266', descripcion: 'BNP PARIBAS' },
  { codigo: '00268', descripcion: 'BANCO PROVINCIA DE TIERRA DEL FUEGO' },
  { codigo: '00269', descripcion: 'BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY' },
  { codigo: '00277', descripcion: 'BANCO SAENZ S.A.' },
  { codigo: '00281', descripcion: 'BANCO MERIDIAN S.A.' },
  { codigo: '00285', descripcion: 'BANCO MACRO S.A.' },
  { codigo: '00299', descripcion: 'BANCO COMAFI S.A.' },
  { codigo: '00301', descripcion: 'BANCO PIANO S.A.' },
  { codigo: '00305', descripcion: 'BANCO JULIO S.A.' },
  { codigo: '00309', descripcion: 'BANCO RIOJA S.A. SOCIEDAD DE ECONOMIA MIXTA' },
  { codigo: '00310', descripcion: 'BANCO DEL SOL S.A.' },
  { codigo: '00311', descripcion: 'NUEVO BANCO DEL CHACO S.A.' },
  { codigo: '00312', descripcion: 'BANCO VOII S.A.' },
  { codigo: '00315', descripcion: 'BANCO DE FORMOSA S.A.' },
  { codigo: '00319', descripcion: 'BANCO CMF S.A.' },
  { codigo: '00321', descripcion: 'BANCO DE SANTIAGO DEL ESTERO S.A.' },
  { codigo: '00322', descripcion: 'BANCO INDUSTRIAL S.A.' },
  { codigo: '00325', descripcion: 'DEUTSCHE BANK S.A.' },
  { codigo: '00330', descripcion: 'NUEVO BANCO DE SANTA FE S.A.' },
  { codigo: '00331', descripcion: 'BANCO CETELEM ARGENTINA S.A.' },
  { codigo: '00332', descripcion: 'BANCO DE SERVICIOS FINANCIEROS S.A.' },
  { codigo: '00335', descripcion: 'BANCO COFIDIS S.A.' },
  { codigo: '00336', descripcion: 'BANCO BRADESCO ARGENTINA S.A.' },
  { codigo: '00338', descripcion: 'BANCO DE SERVICIOS Y TRANSACCIONES S.A.' },
  { codigo: '00339', descripcion: 'RCI BANQUE SUCURSAL ARGENTINA' },
  { codigo: '00340', descripcion: 'BACS BANCO DE CREDITO Y SECURITIZACION S.A.' },
  { codigo: '00341', descripcion: 'BANCO MASVENTAS S.A.' },
  { codigo: '00386', descripcion: 'NUEVO BANCO DE ENTRE RIOS S.A.' },
  { codigo: '00389', descripcion: 'BANCO COLUMBIA S.A.' },
  { codigo: '00426', descripcion: 'BANCO BICA S.A.' },
  { codigo: '00431', descripcion: 'BANCO COINAG S.A.' },
  { codigo: '00432', descripcion: 'BANCO DE COMERCIO S.A.' },
  { codigo: '00435', descripcion: 'BANCO SUCREDITO REGIONAL S.A.' },
  { codigo: '00448', descripcion: 'BANCO DINO S.A.' },
  { codigo: '00bind', descripcion: 'BIND BANCO INDUSTRIAL' },
  { codigo: '27285', descripcion: 'BANCO MACRO S.A. - LINK' }
];

async function seedBancos() {
  console.log('🏦 Iniciando carga de bancos de Argentina...');

  try {
    const bancosCreados = [];

    for (const banco of bancosArgentina) {
      const bancoExiste = await prisma.bancos.findUnique({
        where: { codigo: banco.codigo }
      });

      if (!bancoExiste) {
        const nuevoBanco = await prisma.bancos.create({
          data: {
            id: crypto.randomUUID(),
            codigo: banco.codigo,
            descripcion: banco.descripcion,
            activo: true,
            updatedAt: new Date()
          }
        });
        bancosCreados.push(nuevoBanco);
      } else {
        console.log(`⚠️  Banco ${banco.codigo} ya existe: ${banco.descripcion}`);
      }
    }

    console.log(`✅ ${bancosCreados.length} bancos argentinos creados exitosamente`);
    console.log(`📊 Total de bancos en la base: ${await prisma.bancos.count()}`);

  } catch (error) {
    console.error('❌ Error al cargar bancos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedBancos()
    .then(() => {
      console.log('🎉 Carga de bancos completada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error en la carga:', error);
      process.exit(1);
    });
}

module.exports = { seedBancos, bancosArgentina };