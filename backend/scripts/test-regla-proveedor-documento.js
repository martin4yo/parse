/**
 * Test de la regla COMPLETAR_PROVEEDOR_POR_CUIT en contexto de documento
 */
require('dotenv').config();
const BusinessRulesEngine = require('../src/services/businessRulesEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRule() {
  const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939';

  // Buscar un documento real con CUIT pero sin codigoProveedor
  const documento = await prisma.documentos_procesados.findFirst({
    where: {
      tenantId,
      cuitExtraido: { not: null },
      codigoProveedor: null
    },
    include: {
      documento_lineas: true,
      documento_impuestos: true
    }
  });

  if (!documento) {
    console.log('No hay documentos sin codigoProveedor. Buscando cualquier documento...');
    const doc2 = await prisma.documentos_procesados.findFirst({
      where: { tenantId },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    if (!doc2) {
      console.log('No hay documentos');
      return;
    }

    console.log('📋 Documento encontrado:');
    console.log('  id:', doc2.id);
    console.log('  cuitExtraido:', doc2.cuitExtraido);
    console.log('  codigoProveedor:', doc2.codigoProveedor);

    // Simular documento sin codigoProveedor
    doc2.codigoProveedor = null;

    const engine = new BusinessRulesEngine(tenantId);
    const result = await engine.applyRulesToDocument(doc2, {
      logExecution: true,
      contexto: 'TEST'
    });

    console.log('\n📋 Resultado:');
    console.log('  codigoProveedor después:', result.documento?.codigoProveedor);
    console.log('  reglasAplicadas.documento:', result.reglasAplicadas?.documento);

    await prisma.$disconnect();
    return;
  }

  console.log('📋 Documento encontrado:');
  console.log('  id:', documento.id);
  console.log('  cuitExtraido:', documento.cuitExtraido);
  console.log('  codigoProveedor ANTES:', documento.codigoProveedor);

  // Crear motor
  const engine = new BusinessRulesEngine(tenantId);

  // Aplicar reglas al documento completo
  const result = await engine.applyRulesToDocument(documento, {
    logExecution: true,
    contexto: 'TEST'
  });

  console.log('\n📋 Resultado:');
  console.log('  codigoProveedor DESPUÉS:', result.documento?.codigoProveedor);
  console.log('  reglasAplicadas.documento:', result.reglasAplicadas?.documento);

  await prisma.$disconnect();
}

testRule().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
});
