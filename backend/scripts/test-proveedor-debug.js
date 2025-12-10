/**
 * Debug de la regla COMPLETAR_PROVEEDOR_POR_CUIT
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const tenantId = '4b458e4f-f35d-47c4-a9d5-0960c1858939';

  // Ver la regla
  const regla = await prisma.reglas_negocio.findFirst({
    where: {
      tenantId,
      codigo: { contains: 'PROVEEDOR' }
    }
  });

  console.log('=== REGLA ENCONTRADA ===');
  console.log('Código:', regla?.codigo);
  console.log('Tipo:', regla?.tipo);
  console.log('Configuración:', JSON.stringify(regla?.configuracion, null, 2));

  // Buscar documento con CUIT
  const doc = await prisma.documentos_procesados.findFirst({
    where: {
      tenantId,
      cuitExtraido: { not: null },
      codigoProveedor: null
    }
  });

  if (doc) {
    console.log('\n=== DOCUMENTO ENCONTRADO ===');
    console.log('ID:', doc.id);
    console.log('cuitExtraido:', doc.cuitExtraido);
    console.log('cuitProveedor:', doc.cuitProveedor);
    console.log('codigoProveedor:', doc.codigoProveedor);
  } else {
    console.log('\nNo hay documentos sin codigoProveedor. Buscando cualquier doc...');
    const doc2 = await prisma.documentos_procesados.findFirst({
      where: { tenantId }
    });
    if (doc2) {
      console.log('ID:', doc2.id);
      console.log('cuitExtraido:', doc2.cuitExtraido);
      console.log('cuitProveedor:', doc2.cuitProveedor);
      console.log('codigoProveedor:', doc2.codigoProveedor);
    }
  }

  // Buscar proveedor con ese CUIT
  const docToUse = doc || await prisma.documentos_procesados.findFirst({ where: { tenantId } });
  const cuit = docToUse?.cuitExtraido || docToUse?.cuitProveedor;

  if (cuit) {
    const cuitNorm = cuit.replace(/[-\s]/g, '');
    console.log('\nCUIT normalizado:', cuitNorm);

    const proveedores = await prisma.parametros_maestros.findMany({
      where: {
        tenantId,
        tipo_campo: 'proveedor',
        activo: true
      }
    });

    console.log('\n=== PROVEEDORES EN BD (primeros 10) ===');
    let matchFound = false;
    for (const p of proveedores.slice(0, 10)) {
      const jsonCuit = p.parametros_json?.cuit;
      if (jsonCuit) {
        const normJsonCuit = String(jsonCuit).replace(/[-\s]/g, '').toUpperCase();
        console.log('Codigo:', p.codigo, '| CUIT JSON:', jsonCuit, '| Normalizado:', normJsonCuit);
        if (normJsonCuit === cuitNorm.toUpperCase()) {
          console.log('  ^^^ MATCH ENCONTRADO ^^^');
          matchFound = true;
        }
      }
    }

    if (!matchFound) {
      console.log('\n⚠️ No se encontró proveedor con CUIT:', cuit);
    }
  }

  await prisma.$disconnect();
}

test().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
});
