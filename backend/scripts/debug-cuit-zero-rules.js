const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugCuitZeroRules() {
  console.log('🔍 Analizando reglas de CUIT "0"...\n');

  try {
    // 1. Verificar reglas de negocio relacionadas con CUIT
    const reglasNegocios = await prisma.reglaNegocio.findMany({
      where: {
        tipo: 'IMPORTACION_DKT',
        activa: true
      },
      orderBy: { prioridad: 'asc' }
    });

    console.log(`📋 Encontradas ${reglasNegocios.length} reglas relacionadas con CUIT:\n`);

    reglasNegocios.forEach(regla => {
      console.log(`🔹 Regla ID: ${regla.id}`);
      console.log(`   Código: ${regla.codigo}`);
      console.log(`   Nombre: ${regla.nombre}`);
      console.log(`   Tipo: ${regla.tipo}`);
      console.log(`   Prioridad: ${regla.prioridad}`);
      console.log(`   Configuración: ${JSON.stringify(regla.configuracion, null, 2)}`);
      console.log('');
    });

    // 2. Verificar si existe un proveedor con CUIT "0" en parametros_maestros
    const proveedorCuitCero = await prisma.parametroMaestro.findFirst({
      where: {
        tipo: 'proveedor',
        JSON: {
          path: ['cuit'],
          equals: '0'
        }
      }
    });

    console.log('🏢 Proveedor con CUIT "0" en parametros_maestros:');
    if (proveedorCuitCero) {
      console.log(`   ✅ ENCONTRADO - ID: ${proveedorCuitCero.id}`);
      console.log(`   Código: ${proveedorCuitCero.codigo}`);
      console.log(`   JSON: ${JSON.stringify(proveedorCuitCero.JSON, null, 2)}`);
    } else {
      console.log('   ❌ NO ENCONTRADO');
    }
    console.log('');

    // 3. Verificar todos los proveedores para entender el formato
    const todosProveedores = await prisma.parametroMaestro.findMany({
      where: { tipo: 'proveedor' },
      take: 5,
      orderBy: { id: 'asc' }
    });

    console.log('📝 Ejemplos de proveedores en parametros_maestros:');
    todosProveedores.forEach(proveedor => {
      console.log(`   ID: ${proveedor.id} | Código: ${proveedor.codigo}`);
      console.log(`   JSON: ${JSON.stringify(proveedor.JSON)}`);
    });
    console.log('');

    // 4. Buscar proveedores que podrían tener CUIT "0" o similar
    const proveedoresCuitSimilar = await prisma.parametroMaestro.findMany({
      where: {
        tipo: 'proveedor',
        OR: [
          { JSON: { path: ['cuit'], equals: 0 } }, // número
          { JSON: { path: ['cuit'], equals: '0' } }, // string
          { JSON: { path: ['cuit'], equals: '00' } },
          { JSON: { path: ['cuit'], equals: null } },
          { codigo: { contains: '0' } }
        ]
      }
    });

    console.log('🔍 Proveedores con CUIT similar a "0":');
    if (proveedoresCuitSimilar.length > 0) {
      proveedoresCuitSimilar.forEach(proveedor => {
        console.log(`   ID: ${proveedor.id} | Código: ${proveedor.codigo}`);
        console.log(`   JSON: ${JSON.stringify(proveedor.JSON)}`);
      });
    } else {
      console.log('   ❌ NO ENCONTRADOS');
    }
    console.log('');

    // 5. Verificar regla LOOKUP_JSON específica
    const reglaLookupJson = reglasNegocios.find(r =>
      r.configuracion?.accion?.tipo === 'LOOKUP_JSON' &&
      r.configuracion?.campo === 'proveedorId'
    );

    if (reglaLookupJson) {
      console.log('🔎 Análisis de regla LOOKUP_JSON:');
      console.log(`   Condición: ${JSON.stringify(reglaLookupJson.configuracion.condicion)}`);
      console.log(`   Acción: ${JSON.stringify(reglaLookupJson.configuracion.accion)}`);

      const accion = reglaLookupJson.configuracion.accion;
      if (accion) {
        console.log(`   Tabla: ${accion.tabla}`);
        console.log(`   Campo consulta: ${accion.campoConsulta}`);
        console.log(`   Campo resultado: ${accion.campoResultado}`);
        console.log(`   Campo JSON: ${accion.campoJson}`);
        console.log(`   Defecto: ${accion.defecto}`);
      }
    }

    // 6. Simular búsqueda LOOKUP_JSON
    console.log('\n🧪 Simulando búsqueda LOOKUP_JSON para CUIT "0":');

    // Simulación directa
    const resultadoDirecto = await prisma.$queryRaw`
      SELECT id, codigo, "JSON"
      FROM parametros_maestros
      WHERE tipo = 'proveedor'
      AND "JSON"->>'cuit' = '0'
      LIMIT 1
    `;

    console.log('   Resultado query directa:', resultadoDirecto);

    // Simulación con diferentes formatos
    const variacionesCuit = ['0', 0, '00', '000', null];

    for (const cuit of variacionesCuit) {
      const resultado = await prisma.parametroMaestro.findFirst({
        where: {
          tipo: 'proveedor',
          JSON: {
            path: ['cuit'],
            equals: cuit
          }
        }
      });

      console.log(`   CUIT ${JSON.stringify(cuit)}: ${resultado ? `✅ ID: ${resultado.id}` : '❌ No encontrado'}`);
    }

  } catch (error) {
    console.error('❌ Error en análisis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar análisis
debugCuitZeroRules();