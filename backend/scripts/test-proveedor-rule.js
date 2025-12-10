/**
 * Test de la regla COMPLETAR_PROVEEDOR_POR_CUIT
 */
require('dotenv').config();
const BusinessRulesEngine = require('../src/services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRule() {
  const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939';

  // Simular un documento con CUIT
  const docData = {
    cuitProveedor: '30707174044',  // CUIT de MV GRAFICOS
    codigoProveedor: null
  };

  console.log('📋 Datos de entrada:');
  console.log('  cuitProveedor:', docData.cuitProveedor);
  console.log('  codigoProveedor:', docData.codigoProveedor);

  // Crear motor
  const engine = new BusinessRulesEngine(tenantId);
  await engine.loadRules('TRANSFORMACION');

  console.log('\n📋 Reglas cargadas:', engine.rules.length);
  engine.rules.forEach(r => {
    if (r.codigo.includes('PROVEEDOR')) {
      console.log('  -', r.codigo, '| aplicaA:', r.configuracion.aplicaA);
    }
  });

  // Aplicar reglas
  const resultado = await engine.applyRules(
    docData,
    {},
    {
      tipo: 'TRANSFORMACION',
      contexto: 'DOCUMENTO',
      logExecution: true
    }
  );

  console.log('\n📋 Resultado:');
  console.log('  codigoProveedor:', resultado.data.codigoProveedor);

  await prisma.$disconnect();
}

testRule().catch(e => console.error('Error:', e.message, e.stack));
