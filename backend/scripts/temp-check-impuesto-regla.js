const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReglaImpuesto() {
  try {
    // 1. Verificar la regla
    console.log('📋 1. VERIFICANDO REGLA IMPUESTO_IIBB_PBA_CUENTA:\n');
    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'IMPUESTO_IIBB_PBA_CUENTA' }
    });

    if (!regla) {
      console.log('❌ La regla NO existe en la BD');
      return;
    }

    console.log('✅ Regla encontrada:');
    console.log('   ID:', regla.id);
    console.log('   Tipo:', regla.tipo);
    console.log('   Activa:', regla.activa);
    console.log('   Prioridad:', regla.prioridad);
    console.log('   TenantId:', regla.tenantId || '(NULL - aplica a todos)');
    console.log('');
    console.log('📋 Configuración:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

    // 2. Verificar impuestos del último documento
    console.log('\n\n📊 2. VERIFICANDO IMPUESTOS DEL ÚLTIMO DOCUMENTO:\n');
    const doc = await prisma.documentos_procesados.findFirst({
      orderBy: { fechaProcesamiento: 'desc' },
      select: {
        id: true,
        nombreArchivo: true
      }
    });

    if (!doc) {
      console.log('❌ No hay documentos procesados');
      return;
    }

    console.log('📄 Documento:', doc.nombreArchivo);
    console.log('   ID:', doc.id);

    const impuestos = await prisma.documento_impuestos.findMany({
      where: { documentoId: doc.id },
      select: {
        id: true,
        tipo: true,
        descripcion: true,
        importe: true,
        cuentaContable: true,
        subcuenta: true
      }
    });

    console.log(`\n💰 Total de impuestos: ${impuestos.length}\n`);

    if (impuestos.length === 0) {
      console.log('⚠️ El documento no tiene impuestos registrados');
      return;
    }

    impuestos.forEach((imp, i) => {
      console.log(`   Impuesto ${i + 1}:`);
      console.log(`      Tipo: "${imp.tipo}"`);
      console.log(`      Descripción: "${imp.descripcion}"`);
      console.log(`      Importe: ${imp.importe}`);
      console.log(`      Cuenta: ${imp.cuentaContable || 'N/A'}`);
      console.log(`      Subcuenta: ${imp.subcuenta || 'N/A'}`);

      // Probar regex en tipo
      const regex = /ingresos\s+brutos.*buenos\s+aires|PBA|BS\s*AS/i;
      const matchTipo = regex.test(imp.tipo);
      const matchDesc = regex.test(imp.descripcion);

      console.log(`      ¿Regex match en tipo? ${matchTipo ? '✅ SÍ' : '❌ NO'}`);
      console.log(`      ¿Regex match en descripción? ${matchDesc ? '✅ SÍ' : '❌ NO'}`);
      console.log('');
    });

    // 3. Probar la regex manualmente
    console.log('\n🧪 3. PRUEBA DE REGEX:\n');
    const regexOriginal = /ingresos\s+brutos.*buenos\s+aires|PBA|BS\s*AS/i;

    const testCases = [
      'ingresos brutos provincia de buenos aires',
      'IIBB PBA',
      'IIBB BS AS',
      'Ingresos Brutos Buenos Aires',
      'Perc IIBB PBA',
      'Percepción IIBB Buenos Aires'
    ];

    testCases.forEach(test => {
      const match = regexOriginal.test(test);
      console.log(`   "${test}" → ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReglaImpuesto();
