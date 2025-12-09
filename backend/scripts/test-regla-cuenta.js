/**
 * Test de la regla REGLA_CUENTA_CONTABLE_ITEMS
 */
require('dotenv').config();
const BusinessRulesEngine = require('../src/services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRule() {
  const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939';

  // Obtener la línea de prueba
  const linea = await prisma.documento_lineas.findFirst({
    where: { id: '88e90f1f-2908-4b09-a314-44d7d0575d25' }
  });

  console.log('📋 Datos de entrada:');
  console.log('  id:', linea.id);
  console.log('  codigoProducto:', linea.codigoProducto);
  console.log('  cuentaContable inicial:', linea.cuentaContable);

  // Crear instancia del motor
  const engine = new BusinessRulesEngine(tenantId);

  // Cargar reglas
  await engine.loadRules('TRANSFORMACION');

  console.log('\n📋 Reglas cargadas:', engine.rules.length);
  engine.rules.forEach(r => {
    console.log('  -', r.codigo, '| aplicaA:', r.configuracion.aplicaA);
  });

  // Aplicar reglas con log habilitado
  const resultado = await engine.applyRules(
    { ...linea },
    {},
    {
      tipo: 'TRANSFORMACION',
      contexto: 'LINEA_DOCUMENTO',
      logExecution: true
    }
  );

  console.log('\n📋 Resultado final:');
  console.log('  cuentaContable:', resultado.data.cuentaContable);
  console.log('  rulesApplied:', resultado.rulesApplied);

  await prisma.$disconnect();
}

testRule().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
});
