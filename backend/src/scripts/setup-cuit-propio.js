/**
 * Script para configurar CUITs propios del tenant
 *
 * Los CUITs propios son los de las empresas del tenant (destinatarios en facturas de compra)
 * Se usan para identificar automáticamente cuál CUIT es del emisor y cuál del destinatario
 *
 * Ejecutar: node src/scripts/setup-cuit-propio.js
 *
 * Uso desde reglas:
 * - tipo_campo: 'cuit_propio'
 * - codigo: CUIT normalizado (ej: '30515969213')
 * - nombre: Razón social de la empresa
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Ejemplo de CUITs propios a configurar (modificar según necesidad)
const CUITS_PROPIOS_EJEMPLO = [
  {
    codigo: '30515969213', // CUIT normalizado (sin guiones)
    nombre: 'Industrias Químicas y Mineras Timbó S.A.',
    descripcion: 'Empresa principal del grupo',
    parametros_json: {
      cuitFormateado: '30-51596921-3',
      razonSocialAlternativa: ['IND. QUIMICA Y MINERA TIMBO S.A.', 'INDUSTRIAS QUIMICAS Y MINERAS TIMBO']
    }
  }
];

async function setupCuitPropio() {
  console.log('🔧 Configurando tipo de parámetro cuit_propio...\n');

  try {
    // Obtener el tenant default o el primero disponible
    const tenant = await prisma.tenants.findFirst({
      where: { activo: true }
    });

    if (!tenant) {
      console.log('❌ No se encontró ningún tenant activo');
      return;
    }

    console.log(`📋 Usando tenant: ${tenant.nombre} (${tenant.id})\n`);

    // Verificar si ya existen parámetros de tipo cuit_propio
    const existentes = await prisma.parametros_maestros.findMany({
      where: {
        tipo_campo: 'cuit_propio',
        tenantId: tenant.id
      }
    });

    if (existentes.length > 0) {
      console.log(`ℹ️ Ya existen ${existentes.length} CUITs propios configurados:`);
      existentes.forEach(c => console.log(`   - ${c.codigo}: ${c.nombre}`));
      console.log('\n✅ No se realizaron cambios. Para agregar más CUITs, edita este script.');
      return;
    }

    // Crear los parámetros de ejemplo
    console.log('📝 Creando parámetros cuit_propio de ejemplo...');

    for (const cuit of CUITS_PROPIOS_EJEMPLO) {
      await prisma.parametros_maestros.create({
        data: {
          codigo: cuit.codigo,
          nombre: cuit.nombre,
          descripcion: cuit.descripcion,
          tipo_campo: 'cuit_propio',
          orden: 1,
          activo: true,
          tenantId: tenant.id,
          parametros_json: cuit.parametros_json
        }
      });
      console.log(`   ✅ ${cuit.codigo}: ${cuit.nombre}`);
    }

    console.log('\n🎉 CUITs propios configurados correctamente!');
    console.log('\n📌 Uso en reglas de negocio:');
    console.log('   - Condición: LOOKUP con tipo_campo="cuit_propio"');
    console.log('   - Si el CUIT está en la lista → es el destinatario (empresa propia)');
    console.log('   - Si NO está → es el emisor (proveedor)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// También exportamos una función para agregar CUITs propios programáticamente
async function agregarCuitPropio(tenantId, cuit, nombre, opciones = {}) {
  const { descripcion = '', razonSocialAlternativa = [] } = opciones;

  // Normalizar CUIT (quitar guiones)
  const cuitNormalizado = cuit.replace(/-/g, '');

  const existente = await prisma.parametros_maestros.findFirst({
    where: {
      tipo_campo: 'cuit_propio',
      codigo: cuitNormalizado,
      tenantId
    }
  });

  if (existente) {
    console.log(`⏭️ CUIT ${cuitNormalizado} ya existe, actualizando...`);
    return await prisma.parametros_maestros.update({
      where: { id: existente.id },
      data: {
        nombre,
        descripcion,
        parametros_json: {
          cuitFormateado: cuit,
          razonSocialAlternativa
        }
      }
    });
  }

  return await prisma.parametros_maestros.create({
    data: {
      codigo: cuitNormalizado,
      nombre,
      descripcion,
      tipo_campo: 'cuit_propio',
      orden: 1,
      activo: true,
      tenantId,
      parametros_json: {
        cuitFormateado: cuit,
        razonSocialAlternativa
      }
    }
  });
}

// Función para verificar si un CUIT es propio del tenant
async function esCuitPropio(tenantId, cuit) {
  const cuitNormalizado = cuit.replace(/-/g, '');

  const existe = await prisma.parametros_maestros.findFirst({
    where: {
      tipo_campo: 'cuit_propio',
      codigo: cuitNormalizado,
      tenantId,
      activo: true
    }
  });

  return !!existe;
}

module.exports = { agregarCuitPropio, esCuitPropio };

// Ejecutar si se llama directamente
if (require.main === module) {
  setupCuitPropio();
}
