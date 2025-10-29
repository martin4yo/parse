const { PrismaClient: LocalPrismaClient } = require('@prisma/client');
const { PrismaClient: RemotePrismaClient } = require('@prisma/client');

// Configurar cliente local
const localDb = new LocalPrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:Q27G4B98@localhost:5432/rendiciones_db"
    }
  }
});

// Configurar cliente remoto
const remoteDb = new RemotePrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:Q27G4B98@149.50.148.198:5432/rendiciones_db"
    }
  }
});

async function backupToCloud() {
  console.log('🔵 Iniciando backup de base local a la nube...\n');

  try {
    // Limpiar base remota primero
    console.log('🗑️  Limpiando base de datos remota...');
    
    // Eliminar en orden inverso a las dependencias
    await remoteDb.rendicionTarjetaDetalle.deleteMany({});
    await remoteDb.rendicionTarjetaItem.deleteMany({});
    await remoteDb.rendicionTarjetaCabecera.deleteMany({});
    await remoteDb.delegacionTarjeta.deleteMany({});
    await remoteDb.userTarjetaCredito.deleteMany({});
    await remoteDb.userAtributo.deleteMany({});
    await remoteDb.valorAtributo.deleteMany({});
    await remoteDb.parametroRelacion.deleteMany({});
    await remoteDb.resumenTarjeta.deleteMany({});
    await remoteDb.bancoTipoTarjeta.deleteMany({});
    await remoteDb.tipoTarjeta.deleteMany({});
    await remoteDb.tarjeta.deleteMany({});
    await remoteDb.banco.deleteMany({});
    await remoteDb.estado.deleteMany({});
    await remoteDb.atributo.deleteMany({});
    await remoteDb.parametroMaestro.deleteMany({});
    await remoteDb.user.deleteMany({});
    await remoteDb.profile.deleteMany({});
    
    console.log('✅ Base remota limpiada\n');

    // Copiar datos tabla por tabla (en orden de dependencias)
    
    // 1. Tablas sin dependencias
    console.log('📋 Copiando profiles...');
    const profiles = await localDb.profile.findMany();
    if (profiles.length > 0) {
      await remoteDb.profile.createMany({ data: profiles });
      console.log(`   ✓ ${profiles.length} profiles copiados`);
    }

    console.log('📋 Copiando usuarios...');
    const users = await localDb.user.findMany();
    if (users.length > 0) {
      await remoteDb.user.createMany({ data: users });
      console.log(`   ✓ ${users.length} usuarios copiados`);
    }

    console.log('📋 Copiando parámetros maestros...');
    const parametrosMaestros = await localDb.parametroMaestro.findMany();
    if (parametrosMaestros.length > 0) {
      await remoteDb.parametroMaestro.createMany({ data: parametrosMaestros });
      console.log(`   ✓ ${parametrosMaestros.length} parámetros maestros copiados`);
    }

    console.log('📋 Copiando atributos...');
    const atributos = await localDb.atributo.findMany();
    if (atributos.length > 0) {
      await remoteDb.atributo.createMany({ data: atributos });
      console.log(`   ✓ ${atributos.length} atributos copiados`);
    }

    console.log('📋 Copiando estados...');
    const estados = await localDb.estado.findMany();
    if (estados.length > 0) {
      await remoteDb.estado.createMany({ data: estados });
      console.log(`   ✓ ${estados.length} estados copiados`);
    }

    console.log('📋 Copiando bancos...');
    const bancos = await localDb.banco.findMany();
    if (bancos.length > 0) {
      await remoteDb.banco.createMany({ data: bancos });
      console.log(`   ✓ ${bancos.length} bancos copiados`);
    }

    console.log('📋 Copiando tarjetas...');
    const tarjetas = await localDb.tarjeta.findMany();
    if (tarjetas.length > 0) {
      await remoteDb.tarjeta.createMany({ data: tarjetas });
      console.log(`   ✓ ${tarjetas.length} tarjetas copiadas`);
    }

    // 2. Tablas con dependencias
    console.log('📋 Copiando tipos de tarjeta...');
    const tiposTarjeta = await localDb.tipoTarjeta.findMany();
    if (tiposTarjeta.length > 0) {
      await remoteDb.tipoTarjeta.createMany({ data: tiposTarjeta });
      console.log(`   ✓ ${tiposTarjeta.length} tipos de tarjeta copiados`);
    }

    console.log('📋 Copiando bancos-tipos tarjeta...');
    const bancosTipoTarjeta = await localDb.bancoTipoTarjeta.findMany();
    if (bancosTipoTarjeta.length > 0) {
      await remoteDb.bancoTipoTarjeta.createMany({ data: bancosTipoTarjeta });
      console.log(`   ✓ ${bancosTipoTarjeta.length} relaciones banco-tipo copiadas`);
    }

    console.log('📋 Copiando resúmenes de tarjeta...');
    const resumenes = await localDb.resumenTarjeta.findMany();
    if (resumenes.length > 0) {
      await remoteDb.resumenTarjeta.createMany({ data: resumenes });
      console.log(`   ✓ ${resumenes.length} resúmenes copiados`);
    }

    console.log('📋 Copiando parámetros relación...');
    const parametrosRelacion = await localDb.parametroRelacion.findMany();
    if (parametrosRelacion.length > 0) {
      await remoteDb.parametroRelacion.createMany({ data: parametrosRelacion });
      console.log(`   ✓ ${parametrosRelacion.length} parámetros relación copiados`);
    }

    console.log('📋 Copiando valores de atributo...');
    const valoresAtributo = await localDb.valorAtributo.findMany();
    if (valoresAtributo.length > 0) {
      await remoteDb.valorAtributo.createMany({ data: valoresAtributo });
      console.log(`   ✓ ${valoresAtributo.length} valores de atributo copiados`);
    }

    console.log('📋 Copiando atributos de usuario...');
    const userAtributos = await localDb.userAtributo.findMany();
    if (userAtributos.length > 0) {
      await remoteDb.userAtributo.createMany({ data: userAtributos });
      console.log(`   ✓ ${userAtributos.length} atributos de usuario copiados`);
    }

    console.log('📋 Copiando tarjetas de crédito de usuarios...');
    const userTarjetas = await localDb.userTarjetaCredito.findMany();
    if (userTarjetas.length > 0) {
      await remoteDb.userTarjetaCredito.createMany({ data: userTarjetas });
      console.log(`   ✓ ${userTarjetas.length} tarjetas de usuario copiadas`);
    }

    console.log('📋 Copiando delegaciones de tarjeta...');
    const delegaciones = await localDb.delegacionTarjeta.findMany();
    if (delegaciones.length > 0) {
      await remoteDb.delegacionTarjeta.createMany({ data: delegaciones });
      console.log(`   ✓ ${delegaciones.length} delegaciones copiadas`);
    }

    console.log('📋 Copiando cabeceras de rendición...');
    const cabeceras = await localDb.rendicionTarjetaCabecera.findMany();
    if (cabeceras.length > 0) {
      await remoteDb.rendicionTarjetaCabecera.createMany({ data: cabeceras });
      console.log(`   ✓ ${cabeceras.length} cabeceras de rendición copiadas`);
    }

    console.log('📋 Copiando items de rendición...');
    const items = await localDb.rendicionTarjetaItem.findMany();
    if (items.length > 0) {
      await remoteDb.rendicionTarjetaItem.createMany({ data: items });
      console.log(`   ✓ ${items.length} items de rendición copiados`);
    }

    console.log('📋 Copiando detalles de rendición...');
    const detalles = await localDb.rendicionTarjetaDetalle.findMany();
    if (detalles.length > 0) {
      await remoteDb.rendicionTarjetaDetalle.createMany({ data: detalles });
      console.log(`   ✓ ${detalles.length} detalles de rendición copiados`);
    }

    console.log('\n✅ ¡Backup completado exitosamente!');
    console.log('📊 Todos los datos han sido copiados a la base de datos en la nube.');

  } catch (error) {
    console.error('❌ Error durante el backup:', error.message);
    console.error('Detalles:', error);
    process.exit(1);
  } finally {
    await localDb.$disconnect();
    await remoteDb.$disconnect();
  }
}

// Ejecutar backup
backupToCloud();