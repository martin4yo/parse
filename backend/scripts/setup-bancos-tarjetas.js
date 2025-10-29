const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupBancosTarjetas() {
  console.log('🚀 Iniciando configuración de Bancos y Tarjetas...\n');

  try {
    // PASO 1: LIMPIEZA
    console.log('🗑️  Eliminando datos existentes...');

    // Eliminar asociaciones banco-tipo tarjeta
    await prisma.bancoTipoTarjeta.deleteMany({});
    console.log('  ✓ Asociaciones banco-tipo eliminadas');

    // Eliminar tipos de tarjeta
    await prisma.tipoTarjeta.deleteMany({});
    console.log('  ✓ Tipos de tarjeta eliminados');

    // Eliminar tarjetas
    await prisma.tarjeta.deleteMany({});
    console.log('  ✓ Tarjetas eliminadas');

    // Eliminar bancos
    await prisma.banco.deleteMany({});
    console.log('  ✓ Bancos eliminados\n');

    // PASO 2: CREAR TARJETAS (MARCAS)
    console.log('💳 Creando marcas de tarjetas...');

    const tarjetas = [
      { codigo: 'VISA', descripcion: 'Visa' },
      { codigo: 'MASTERCARD', descripcion: 'Mastercard' },
      { codigo: 'AMEX', descripcion: 'American Express' },
      { codigo: 'CABAL', descripcion: 'Cabal' },
      { codigo: 'NARANJA', descripcion: 'Naranja' },
      { codigo: 'MAESTRO', descripcion: 'Maestro' },
      { codigo: 'ARGENCARD', descripcion: 'Argencard' },
      { codigo: 'CENCOSUD', descripcion: 'Cencosud' },
      { codigo: 'NATIVA', descripcion: 'Nativa' },
      { codigo: 'TARJETA_SHOPPING', descripcion: 'Tarjeta Shopping' },
      { codigo: 'CLUB_LA_NACION', descripcion: 'Club La Nación' },
      { codigo: 'ITALCRED', descripcion: 'Italcred' },
      { codigo: 'CREDIMAS', descripcion: 'Credimás' },
      { codigo: 'QIDA', descripcion: 'Qida' },
      { codigo: 'TUYA', descripcion: 'Tuya' },
      { codigo: 'WALMART', descripcion: 'Walmart' },
      { codigo: 'CARREFOUR', descripcion: 'Carrefour' },
      { codigo: 'DINERS', descripcion: 'Diners Club' }
    ];

    // Crear las tarjetas y guardar sus IDs
    const tarjetasCreadas = {};
    for (const tarjeta of tarjetas) {
      const created = await prisma.tarjeta.create({ data: tarjeta });
      tarjetasCreadas[tarjeta.codigo] = created.id;
    }
    console.log(`  ✓ ${tarjetas.length} marcas de tarjetas creadas\n`);

    // PASO 3: CREAR TIPOS DE TARJETA
    console.log('🎯 Creando tipos de tarjetas...');

    const tiposTarjeta = [
      // VISA
      { codigo: 'VISA_CLASSIC', descripcion: 'Visa Classic', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_GOLD', descripcion: 'Visa Gold', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_PLATINUM', descripcion: 'Visa Platinum', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_SIGNATURE', descripcion: 'Visa Signature', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_INFINITE', descripcion: 'Visa Infinite', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_ELECTRON', descripcion: 'Visa Electron', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_INTERNACIONAL', descripcion: 'Visa Internacional', tarjetaId: tarjetasCreadas['VISA'] },
      { codigo: 'VISA_NACIONAL', descripcion: 'Visa Nacional', tarjetaId: tarjetasCreadas['VISA'] },

      // MASTERCARD
      { codigo: 'MC_STANDARD', descripcion: 'Mastercard Standard', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_GOLD', descripcion: 'Mastercard Gold', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_PLATINUM', descripcion: 'Mastercard Platinum', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_BLACK', descripcion: 'Mastercard Black', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_WORLD', descripcion: 'Mastercard World', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_WORLD_ELITE', descripcion: 'Mastercard World Elite', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_INTERNACIONAL', descripcion: 'Mastercard Internacional', tarjetaId: tarjetasCreadas['MASTERCARD'] },
      { codigo: 'MC_NACIONAL', descripcion: 'Mastercard Nacional', tarjetaId: tarjetasCreadas['MASTERCARD'] },

      // AMERICAN EXPRESS
      { codigo: 'AMEX_VERDE', descripcion: 'American Express Verde', tarjetaId: tarjetasCreadas['AMEX'] },
      { codigo: 'AMEX_GOLD', descripcion: 'American Express Gold', tarjetaId: tarjetasCreadas['AMEX'] },
      { codigo: 'AMEX_PLATINUM', descripcion: 'American Express Platinum', tarjetaId: tarjetasCreadas['AMEX'] },
      { codigo: 'AMEX_CENTURION', descripcion: 'American Express Centurion', tarjetaId: tarjetasCreadas['AMEX'] },
      { codigo: 'AMEX_BLUE', descripcion: 'American Express Blue', tarjetaId: tarjetasCreadas['AMEX'] },

      // CABAL
      { codigo: 'CABAL_CLASSIC', descripcion: 'Cabal Classic', tarjetaId: tarjetasCreadas['CABAL'] },
      { codigo: 'CABAL_GOLD', descripcion: 'Cabal Gold', tarjetaId: tarjetasCreadas['CABAL'] },
      { codigo: 'CABAL_PLATINUM', descripcion: 'Cabal Platinum', tarjetaId: tarjetasCreadas['CABAL'] },
      { codigo: 'CABAL_BLACK', descripcion: 'Cabal Black', tarjetaId: tarjetasCreadas['CABAL'] },

      // NARANJA
      { codigo: 'NARANJA_CLASICA', descripcion: 'Naranja Clásica', tarjetaId: tarjetasCreadas['NARANJA'] },
      { codigo: 'NARANJA_GOLD', descripcion: 'Naranja Gold', tarjetaId: tarjetasCreadas['NARANJA'] },
      { codigo: 'NARANJA_PLATINUM', descripcion: 'Naranja Platinum', tarjetaId: tarjetasCreadas['NARANJA'] },
      { codigo: 'NARANJA_VISA', descripcion: 'Naranja Visa', tarjetaId: tarjetasCreadas['NARANJA'] },
      { codigo: 'NARANJA_MASTERCARD', descripcion: 'Naranja Mastercard', tarjetaId: tarjetasCreadas['NARANJA'] },
      { codigo: 'NARANJA_AMEX', descripcion: 'Naranja American Express', tarjetaId: tarjetasCreadas['NARANJA'] },

      // MAESTRO
      { codigo: 'MAESTRO_STANDARD', descripcion: 'Maestro Standard', tarjetaId: tarjetasCreadas['MAESTRO'] },

      // ARGENCARD
      { codigo: 'ARGENCARD_CLASSIC', descripcion: 'Argencard Classic', tarjetaId: tarjetasCreadas['ARGENCARD'] },
      { codigo: 'ARGENCARD_GOLD', descripcion: 'Argencard Gold', tarjetaId: tarjetasCreadas['ARGENCARD'] },
      { codigo: 'ARGENCARD_PLATINUM', descripcion: 'Argencard Platinum', tarjetaId: tarjetasCreadas['ARGENCARD'] },

      // CENCOSUD
      { codigo: 'CENCOSUD_CLASSIC', descripcion: 'Cencosud Classic', tarjetaId: tarjetasCreadas['CENCOSUD'] },
      { codigo: 'CENCOSUD_GOLD', descripcion: 'Cencosud Gold', tarjetaId: tarjetasCreadas['CENCOSUD'] },
      { codigo: 'CENCOSUD_BLACK', descripcion: 'Cencosud Black', tarjetaId: tarjetasCreadas['CENCOSUD'] },

      // NATIVA
      { codigo: 'NATIVA_BASICA', descripcion: 'Nativa Básica', tarjetaId: tarjetasCreadas['NATIVA'] },
      { codigo: 'NATIVA_GOLD', descripcion: 'Nativa Gold', tarjetaId: tarjetasCreadas['NATIVA'] },

      // TARJETA SHOPPING
      { codigo: 'SHOPPING_CLASSIC', descripcion: 'Tarjeta Shopping Classic', tarjetaId: tarjetasCreadas['TARJETA_SHOPPING'] },

      // OTROS
      { codigo: 'LA_NACION_CLASSIC', descripcion: 'Club La Nación Classic', tarjetaId: tarjetasCreadas['CLUB_LA_NACION'] },
      { codigo: 'ITALCRED_CLASSIC', descripcion: 'Italcred Classic', tarjetaId: tarjetasCreadas['ITALCRED'] },
      { codigo: 'CREDIMAS_CLASSIC', descripcion: 'Credimás Classic', tarjetaId: tarjetasCreadas['CREDIMAS'] },
      { codigo: 'QIDA_CLASSIC', descripcion: 'Qida Classic', tarjetaId: tarjetasCreadas['QIDA'] },
      { codigo: 'TUYA_CLASSIC', descripcion: 'Tuya Classic', tarjetaId: tarjetasCreadas['TUYA'] },
      { codigo: 'WALMART_CLASSIC', descripcion: 'Walmart Classic', tarjetaId: tarjetasCreadas['WALMART'] },
      { codigo: 'CARREFOUR_CLASSIC', descripcion: 'Carrefour Classic', tarjetaId: tarjetasCreadas['CARREFOUR'] },
      { codigo: 'CARREFOUR_GOLD', descripcion: 'Carrefour Gold', tarjetaId: tarjetasCreadas['CARREFOUR'] },
      { codigo: 'DINERS_CLASSIC', descripcion: 'Diners Club Classic', tarjetaId: tarjetasCreadas['DINERS'] }
    ];

    // Crear los tipos de tarjeta y guardar sus IDs
    const tiposTarjetaCreados = {};
    for (const tipo of tiposTarjeta) {
      const created = await prisma.tipoTarjeta.create({ data: tipo });
      tiposTarjetaCreados[tipo.codigo] = created.id;
    }
    console.log(`  ✓ ${tiposTarjeta.length} tipos de tarjetas creados\n`);

    // PASO 4: CREAR BANCOS ARGENTINOS CON CÓDIGO DE 5 DÍGITOS
    console.log('🏦 Creando bancos argentinos...');

    const bancos = [
      // Bancos públicos nacionales
      { codigo: '00007', descripcion: 'Banco de Galicia y Buenos Aires S.A.U.' },
      { codigo: '00011', descripcion: 'Banco de la Nación Argentina' },
      { codigo: '00014', descripcion: 'Banco de la Provincia de Buenos Aires' },
      { codigo: '00015', descripcion: 'Industrial and Commercial Bank of China (ICBC)' },
      { codigo: '00016', descripcion: 'Banco Citibank N.A.' },
      { codigo: '00017', descripcion: 'BBVA Argentina S.A.' },
      { codigo: '00018', descripcion: 'Banco de la Provincia de Córdoba S.A.' },
      { codigo: '00020', descripcion: 'Banco de la Provincia de La Pampa SEM' },
      { codigo: '00027', descripcion: 'Banco Supervielle S.A.' },
      { codigo: '00029', descripcion: 'Banco de la Ciudad de Buenos Aires' },
      { codigo: '00030', descripcion: 'Central de la República Argentina' },
      { codigo: '00034', descripcion: 'Banco Patagonia S.A.' },
      { codigo: '00044', descripcion: 'Banco Hipotecario S.A.' },
      { codigo: '00045', descripcion: 'Banco de San Juan S.A.' },
      { codigo: '00060', descripcion: 'Banco del Tucumán S.A.' },
      { codigo: '00065', descripcion: 'Banco Municipal de Rosario' },
      { codigo: '00072', descripcion: 'Banco Santander Argentina S.A.' },
      { codigo: '00083', descripcion: 'Banco del Chubut S.A.' },
      { codigo: '00086', descripcion: 'Banco de Santa Cruz S.A.' },
      { codigo: '00093', descripcion: 'Banco de la Provincia del Neuquén S.A.' },
      { codigo: '00094', descripcion: 'Banco de la Provincia de Entre Ríos S.A.' },
      { codigo: '00097', descripcion: 'Banco Provincia de Tierra del Fuego' },
      { codigo: '00143', descripcion: 'Brubank S.A.U.' },
      { codigo: '00147', descripcion: 'Banco Interfinanzas S.A.' },
      { codigo: '00150', descripcion: 'HSBC Bank Argentina S.A.' },
      { codigo: '00158', descripcion: 'Openbank Argentina S.A.' },
      { codigo: '00191', descripcion: 'Banco Credicoop Cooperativo Limitado' },
      { codigo: '00198', descripcion: 'Banco de Valores S.A.' },
      { codigo: '00247', descripcion: 'Banco Roela S.A.' },
      { codigo: '00254', descripcion: 'Banco Mariva S.A.' },
      { codigo: '00259', descripcion: 'Banco Itaú Argentina S.A.' },
      { codigo: '00262', descripcion: 'Banco Comafi S.A.' },
      { codigo: '00266', descripcion: 'BNP Paribas' },
      { codigo: '00268', descripcion: 'Banco Provincia de Tierra del Fuego' },
      { codigo: '00269', descripcion: 'Banco de la República Oriental del Uruguay' },
      { codigo: '00277', descripcion: 'Banco Saenz S.A.' },
      { codigo: '00281', descripcion: 'Banco Meridian S.A.' },
      { codigo: '00285', descripcion: 'Banco Macro S.A.' },
      { codigo: '00299', descripcion: 'Banco Comafi S.A.' },
      { codigo: '00300', descripcion: 'Banco de Inversión y Comercio Exterior S.A.' },
      { codigo: '00301', descripcion: 'Banco Piano S.A.' },
      { codigo: '00305', descripcion: 'Banco Julio S.A.' },
      { codigo: '00309', descripcion: 'Banco Rioja S.A.U.' },
      { codigo: '00310', descripcion: 'Banco del Sol S.A.' },
      { codigo: '00311', descripcion: 'Nuevo Banco del Chaco S.A.' },
      { codigo: '00312', descripcion: 'Banco Voii S.A.' },
      { codigo: '00315', descripcion: 'Banco de Formosa S.A.' },
      { codigo: '00319', descripcion: 'Banco CMF S.A.' },
      { codigo: '00321', descripcion: 'Banco de Santiago del Estero S.A.' },
      { codigo: '00322', descripcion: 'Banco Industrial S.A.' },
      { codigo: '00325', descripcion: 'Banco de Corrientes S.A.' },
      { codigo: '00330', descripcion: 'Nuevo Banco de Santa Fe S.A.' },
      { codigo: '00331', descripcion: 'Banco Cetelem Argentina S.A.' },
      { codigo: '00332', descripcion: 'Banco de Servicios Financieros S.A.' },
      { codigo: '00336', descripcion: 'Banco Bradesco Argentina S.A.U.' },
      { codigo: '00338', descripcion: 'Banco de Servicios y Transacciones S.A.' },
      { codigo: '00339', descripcion: 'RCI Banque S.A.' },
      { codigo: '00340', descripcion: 'BACS Banco de Crédito y Securitización S.A.' },
      { codigo: '00341', descripcion: 'Más Ventas S.A.' },
      { codigo: '00384', descripcion: 'Wilobank S.A.' },
      { codigo: '00386', descripcion: 'Banco de Comercio S.A.' },
      { codigo: '00389', descripcion: 'Banco Columbia S.A.' },
      { codigo: '00426', descripcion: 'Banco BICA S.A.' },
      { codigo: '00431', descripcion: 'Banco Coinag S.A.' },
      { codigo: '00432', descripcion: 'Banco de Comercio S.A.' },
      { codigo: '00448', descripcion: 'Banco Dino S.A.' },
      { codigo: '00515', descripcion: 'Banco ICBC S.A.' }
    ];

    // Crear los bancos y guardar sus IDs
    const bancosCreados = {};
    for (const banco of bancos) {
      const created = await prisma.banco.create({ data: banco });
      bancosCreados[banco.codigo] = created.id;
    }
    console.log(`  ✓ ${bancos.length} bancos creados\n`);

    // PASO 5: CREAR ASOCIACIONES BANCO-TIPO TARJETA (EJEMPLOS)
    console.log('🔗 Creando asociaciones banco-tipo tarjeta...');

    // Ejemplos de asociaciones principales
    const asociaciones = [
      // Galicia
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['VISA_SIGNATURE'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['MC_BLACK'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['AMEX_GOLD'] },
      { bancoId: bancosCreados['00007'], tipoTarjetaId: tiposTarjetaCreados['AMEX_PLATINUM'] },

      // Santander
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['MC_BLACK'] },
      { bancoId: bancosCreados['00072'], tipoTarjetaId: tiposTarjetaCreados['AMEX_GOLD'] },

      // BBVA
      { bancoId: bancosCreados['00017'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00017'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00017'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00017'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00017'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },

      // ICBC
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['VISA_SIGNATURE'] },
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00015'], tipoTarjetaId: tiposTarjetaCreados['MC_BLACK'] },

      // Macro
      { bancoId: bancosCreados['00285'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00285'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00285'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00285'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00285'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00285'], tipoTarjetaId: tiposTarjetaCreados['AMEX_GOLD'] },

      // Banco Nación
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['NATIVA_BASICA'] },
      { bancoId: bancosCreados['00011'], tipoTarjetaId: tiposTarjetaCreados['NATIVA_GOLD'] },

      // HSBC
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['VISA_SIGNATURE'] },
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00150'], tipoTarjetaId: tiposTarjetaCreados['MC_BLACK'] },

      // Credicoop
      { bancoId: bancosCreados['00191'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00191'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00191'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00191'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00191'], tipoTarjetaId: tiposTarjetaCreados['CABAL_CLASSIC'] },
      { bancoId: bancosCreados['00191'], tipoTarjetaId: tiposTarjetaCreados['CABAL_GOLD'] },

      // Banco Provincia
      { bancoId: bancosCreados['00014'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00014'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00014'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00014'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00014'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },

      // Banco Ciudad
      { bancoId: bancosCreados['00029'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00029'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00029'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00029'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00029'], tipoTarjetaId: tiposTarjetaCreados['CABAL_CLASSIC'] },

      // Supervielle
      { bancoId: bancosCreados['00027'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00027'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00027'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00027'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },

      // Patagonia
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['VISA_CLASSIC'] },
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['VISA_GOLD'] },
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['VISA_PLATINUM'] },
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['MC_STANDARD'] },
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['MC_GOLD'] },
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['MC_BLACK'] },
      { bancoId: bancosCreados['00034'], tipoTarjetaId: tiposTarjetaCreados['AMEX_GOLD'] }
    ];

    let asociacionesCreadas = 0;
    for (const asociacion of asociaciones) {
      try {
        await prisma.bancoTipoTarjeta.create({ data: asociacion });
        asociacionesCreadas++;
      } catch (error) {
        console.log(`  ⚠️  No se pudo crear asociación ${asociacion.bancoId}-${asociacion.tipoTarjetaId}: ${error.message}`);
      }
    }
    console.log(`  ✓ ${asociacionesCreadas} asociaciones banco-tipo tarjeta creadas\n`);

    // RESUMEN FINAL
    console.log('✅ CONFIGURACIÓN COMPLETADA EXITOSAMENTE\n');
    console.log('📊 Resumen:');
    console.log(`  • ${tarjetas.length} marcas de tarjetas`);
    console.log(`  • ${tiposTarjeta.length} tipos de tarjetas`);
    console.log(`  • ${bancos.length} bancos argentinos`);
    console.log(`  • ${asociacionesCreadas} asociaciones banco-tipo tarjeta`);

  } catch (error) {
    console.error('❌ Error durante la configuración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
setupBancosTarjetas()
  .then(() => {
    console.log('\n✨ Script finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💀 Script finalizado con errores:', error.message);
    process.exit(1);
  });