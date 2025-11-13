const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../services/businessRulesEngine');

const prisma = new PrismaClient();

(async () => {
  try {
    const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939'; // Timbo

    // Obtener un impuesto de ejemplo
    const impuesto = await prisma.documento_impuestos.findFirst({
      where: {
        tenantId,
        tipo: 'IVA'
      }
    });

    if (!impuesto) {
      console.log('No se encontró ningún impuesto de IVA');
      await prisma.$disconnect();
      return;
    }

    console.log('=== TEST DE REGLA_IVA ===\n');
    console.log('Impuesto original:');
    console.log('  Tipo:', impuesto.tipo);
    console.log('  Descripción:', impuesto.descripcion);
    console.log('  Cuenta actual:', impuesto.cuentaContable);
    console.log('');

    // Inicializar motor de reglas
    const rulesEngine = new BusinessRulesEngine(tenantId);
    await rulesEngine.loadRules('TRANSFORMACION', true, prisma);

    console.log(`Reglas cargadas: ${rulesEngine.rules.length}`);

    // Mostrar reglas aplicables a IMPUESTOS
    const reglasImpuestos = rulesEngine.rules.filter(r => {
      const aplicaA = r.configuracion?.aplicaA || 'TODOS';
      return aplicaA === 'TODOS' || aplicaA === 'IMPUESTOS';
    });

    console.log(`Reglas aplicables a IMPUESTOS: ${reglasImpuestos.length}\n`);

    reglasImpuestos.forEach((regla, idx) => {
      console.log(`${idx + 1}. ${regla.nombre} (${regla.codigo})`);
      console.log(`   Prioridad: ${regla.prioridad}`);
      console.log(`   Aplica a: ${regla.configuracion?.aplicaA}`);
    });

    // Aplicar reglas al impuesto
    console.log('\n--- Aplicando reglas ---\n');

    const result = await rulesEngine.applyRules(
      impuesto,
      {},
      {
        tipo: 'TRANSFORMACION',
        contexto: 'IMPUESTO_DOCUMENTO',
        logExecution: true
      }
    );

    console.log('\nResultado:');
    console.log('  Reglas aplicadas:', result.rulesApplied);
    console.log('  Cuenta después de reglas:', result.data.cuentaContable);
    console.log('  ¿Se modificó?:', result.data.cuentaContable !== impuesto.cuentaContable);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
