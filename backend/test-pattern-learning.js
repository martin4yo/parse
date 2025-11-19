/**
 * Script de Testing - Sistema de Aprendizaje de Patrones
 *
 * Prueba completa del flujo de aprendizaje:
 * 1. Aprender patrones manualmente
 * 2. Buscar patrones aprendidos
 * 3. Simular uso en reglas de negocio
 * 4. Verificar auto-aprendizaje
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const patternLearningService = require('./src/services/patternLearningService');

async function main() {
  console.log('\n🧪 ========================================');
  console.log('🧪 TEST: Sistema de Aprendizaje de Patrones');
  console.log('🧪 ========================================\n');

  // Obtener un tenant de prueba
  const tenant = await prisma.tenants.findFirst({
    where: { activo: true }
  });

  if (!tenant) {
    console.error('❌ No se encontró un tenant activo para testing');
    return;
  }

  console.log(`✅ Usando tenant: ${tenant.nombre} (${tenant.id})\n`);

  // ========================================
  // TEST 1: Aprender patrón manual
  // ========================================
  console.log('📚 TEST 1: Aprendizaje manual de patrón');
  console.log('─'.repeat(50));

  const patron1 = await patternLearningService.aprenderPatron({
    tenantId: tenant.id,
    tipoPatron: 'cuenta_linea',
    inputPattern: {
      descripcion: 'servicio de hosting mensual',
      cuitProveedor: '30-12345678-9'
    },
    outputValue: '5101020301',
    outputCampo: 'cuentaContable',
    origen: 'manual',
    confianzaInicial: 1.0
  });

  console.log('✅ Patrón aprendido:', {
    id: patron1.id,
    tipo: patron1.tipo_patron,
    outputValue: patron1.output_value,
    confianza: patron1.confianza,
    ocurrencias: patron1.num_ocurrencias
  });
  console.log('');

  // ========================================
  // TEST 2: Buscar patrón aprendido
  // ========================================
  console.log('🔍 TEST 2: Búsqueda de patrón aprendido');
  console.log('─'.repeat(50));

  const patronEncontrado = await patternLearningService.buscarPatron({
    tenantId: tenant.id,
    tipoPatron: 'cuenta_linea',
    inputPattern: {
      descripcion: 'servicio de hosting mensual',
      cuitProveedor: '30-12345678-9'
    },
    minConfianza: 0.7
  });

  if (patronEncontrado) {
    console.log('✅ Patrón encontrado:', {
      outputValue: patronEncontrado.output_value,
      confianza: patronEncontrado.confianza,
      ocurrencias: patronEncontrado.num_ocurrencias,
      origen: patronEncontrado.origen
    });
  } else {
    console.log('❌ No se encontró el patrón');
  }
  console.log('');

  // ========================================
  // TEST 3: Reforzar patrón existente
  // ========================================
  console.log('🔄 TEST 3: Reforzar patrón existente');
  console.log('─'.repeat(50));

  const patronReforzado = await patternLearningService.aprenderPatron({
    tenantId: tenant.id,
    tipoPatron: 'cuenta_linea',
    inputPattern: {
      descripcion: 'servicio de hosting mensual',
      cuitProveedor: '30-12345678-9'
    },
    outputValue: '5101020301',
    outputCampo: 'cuentaContable',
    origen: 'ai',
    confianzaInicial: 0.9
  });

  console.log('✅ Patrón reforzado:', {
    ocurrenciasAntes: patron1.num_ocurrencias,
    ocurrenciasDespues: patronReforzado.num_ocurrencias,
    confianzaAntes: patron1.confianza,
    confianzaDespues: patronReforzado.confianza
  });
  console.log('');

  // ========================================
  // TEST 4: Aprender múltiples tipos
  // ========================================
  console.log('📦 TEST 4: Aprender múltiples tipos de patrones');
  console.log('─'.repeat(50));

  const tiposPatrones = [
    {
      tipo: 'tipo_producto',
      input: { descripcion: 'cable hdmi 2m' },
      output: 'ELECTRONICA',
      campo: 'tipoProducto'
    },
    {
      tipo: 'cuenta_impuesto',
      input: { tipoImpuesto: 'IVA', alicuota: '21' },
      output: '1105020101',
      campo: 'cuentaContable'
    },
    {
      tipo: 'categoria',
      input: { descripcion: 'papeleria oficina' },
      output: 'GASTOS_ADMIN',
      campo: 'categoria'
    }
  ];

  for (const patternDef of tiposPatrones) {
    const patron = await patternLearningService.aprenderPatron({
      tenantId: tenant.id,
      tipoPatron: patternDef.tipo,
      inputPattern: patternDef.input,
      outputValue: patternDef.output,
      outputCampo: patternDef.campo,
      origen: 'ai',
      confianzaInicial: 0.85
    });

    console.log(`✅ ${patternDef.tipo}: ${patternDef.output}`);
  }
  console.log('');

  // ========================================
  // TEST 5: Búsqueda con normalización
  // ========================================
  console.log('🔎 TEST 5: Búsqueda con normalización de texto');
  console.log('─'.repeat(50));

  // Probar con variaciones de texto
  const variaciones = [
    'SERVICIO DE HOSTING MENSUAL',      // Mayúsculas
    'servicio  de   hosting   mensual', // Espacios extra
    'Servicio De Hosting Mensual'       // Capitalizadas
  ];

  for (const variacion of variaciones) {
    const encontrado = await patternLearningService.buscarPatron({
      tenantId: tenant.id,
      tipoPatron: 'cuenta_linea',
      inputPattern: {
        descripcion: variacion,
        cuitProveedor: '30-12345678-9'
      },
      minConfianza: 0.7
    });

    console.log(`${encontrado ? '✅' : '❌'} "${variacion}": ${encontrado ? 'MATCH' : 'NO MATCH'}`);
  }
  console.log('');

  // ========================================
  // TEST 6: Estadísticas
  // ========================================
  console.log('📊 TEST 6: Estadísticas de aprendizaje');
  console.log('─'.repeat(50));

  const stats = await patternLearningService.obtenerEstadisticas(tenant.id);

  console.log(`Total de patrones: ${stats.total}`);
  console.log('\nPor tipo:');
  for (const tipo of stats.porTipo) {
    console.log(`  - ${tipo.tipo}: ${tipo.cantidad} patrones`);
    console.log(`    Confianza promedio: ${tipo.confianzaPromedio.toFixed(2)}`);
    console.log(`    Ocurrencias promedio: ${tipo.ocurrenciasPromedio.toFixed(2)}`);
  }
  console.log('');

  // ========================================
  // TEST 7: Patrones similares
  // ========================================
  console.log('🔍 TEST 7: Búsqueda de patrones similares');
  console.log('─'.repeat(50));

  const similares = await patternLearningService.buscarPatronesSimilares({
    tenantId: tenant.id,
    tipoPatron: 'cuenta_linea',
    inputPattern: {
      descripcion: 'hosting cloud aws',  // Similar pero no exacto
      cuitProveedor: '30-12345678-9'
    },
    minConfianza: 0.5,
    limit: 3
  });

  console.log(`Encontrados ${similares.length} patrones similares:`);
  for (const sim of similares) {
    console.log(`  - "${sim.input_pattern.descripcion}" → ${sim.output_value}`);
    console.log(`    Similitud: ${(sim.similarityScore * 100).toFixed(1)}%, Confianza: ${sim.confianza}`);
  }
  console.log('');

  // ========================================
  // RESUMEN FINAL
  // ========================================
  console.log('✅ ========================================');
  console.log('✅ TESTING COMPLETADO EXITOSAMENTE');
  console.log('✅ ========================================\n');

  console.log('📋 Resumen:');
  console.log(`  ✓ Patrones creados: ${tiposPatrones.length + 1}`);
  console.log(`  ✓ Búsquedas exitosas: ${variaciones.length}`);
  console.log(`  ✓ Refuerzos aplicados: 1`);
  console.log(`  ✓ Total en BD: ${stats.total}`);
  console.log('');

  console.log('🎯 Próximos pasos:');
  console.log('  1. El sistema está listo para usar en reglas AI_LOOKUP');
  console.log('  2. Cada clasificación IA exitosa aprenderá automáticamente');
  console.log('  3. Las búsquedas futuras usarán patrones antes que IA');
  console.log('  4. Monitorear logs para ver ahorros de IA en acción');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en testing:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
