const { PrismaClient } = require('@prisma/client');

// Dos instancias de Prisma, una para cada BD
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/rendiciones_db'
    }
  }
});

const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/parse_db'
    }
  }
});

// Lista de modelos a migrar (orden importa por relaciones)
const modelos = [
  // Tablas base sin dependencias
  'profiles',
  'estados',
  'bancos',
  'monedas',
  'tenants',

  // Tablas con dependencias de primer nivel
  'planes',
  'users',
  'tipos_tarjeta',
  'tarjetas',
  'banco_tipo_tarjeta',
  'cajas',
  'atributos',
  'parametros_maestros',
  'parametros_relaciones',
  'reglas_negocio',
  'ai_prompts',
  'menu_items',
  'sync_configurations',
  'ai_provider_configs',
  'plan_features',

  // Tablas con dependencias de segundo nivel
  'user_cajas',
  'user_tarjetas_credito',
  'usuario_autorizantes',
  'valores_atributo',
  'delegacion_tarjetas',
  'user_atributos',
  'sync_api_keys',

  // Tablas de negocio
  'rendicion_tarjeta_cabecera',
  'resumen_tarjeta',
  'documentos_procesados',
  'documento_lineas',
  'documento_impuestos',
  'movimientos_tesoreria',
  'detalle_movimientos_tesoreria',
  'saldos_cajas',
  'resumen_tarjeta_concepto',

  // Tablas relacionadas con items
  'rendicion_tarjeta_items',
  'rendicion_tarjeta_detalle',
  'documentos_asociados',

  // Tablas de logs y jobs
  'reglas_ejecuciones',
  'sync_logs',
  'processing_jobs'
];

async function migrarModelo(nombreModelo) {
  try {
    console.log(`\n📦 Migrando: ${nombreModelo}`);

    // Obtener datos de la BD origen
    const datos = await sourcePrisma[nombreModelo].findMany();

    if (datos.length === 0) {
      console.log(`   ℹ️  Tabla vacía - omitiendo`);
      return { modelo: nombreModelo, registros: 0, error: null };
    }

    console.log(`   📊 ${datos.length} registros encontrados`);

    // Insertar en destino - intentar uno por uno si createMany falla
    let migrados = 0;
    try {
      const resultado = await targetPrisma[nombreModelo].createMany({
        data: datos,
        skipDuplicates: true
      });
      migrados = resultado.count;
    } catch (bulkError) {
      // Si falla el bulk insert, intentar uno por uno
      console.log(`   ⚠️  Bulk insert falló, intentando uno por uno...`);
      for (const registro of datos) {
        try {
          await targetPrisma[nombreModelo].create({ data: registro });
          migrados++;
        } catch (individualError) {
          // Silenciar errores individuales de duplicados
          if (!individualError.message.includes('Unique constraint')) {
            console.log(`   ⚠️  Error en registro: ${individualError.message.substring(0, 100)}`);
          }
        }
      }
    }

    console.log(`   ✅ ${migrados} registros migrados`);
    return { modelo: nombreModelo, registros: migrados, error: null };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message.substring(0, 200)}`);
    return { modelo: nombreModelo, registros: 0, error: error.message };
  }
}

async function main() {
  console.log('🔄 MIGRACIÓN DE DATOS: rendiciones_db → parse_db\n');
  console.log('═'.repeat(60));

  const resultados = [];
  let totalRegistros = 0;
  let errores = 0;

  for (const modelo of modelos) {
    const resultado = await migrarModelo(modelo);
    resultados.push(resultado);
    totalRegistros += resultado.registros;
    if (resultado.error) errores++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 RESUMEN DE MIGRACIÓN\n');

  // Tabla de resumen
  console.log('Modelo                              | Registros | Estado');
  console.log('-'.repeat(60));

  resultados.forEach(r => {
    const modelo = r.modelo.padEnd(35);
    const registros = r.registros.toString().padStart(9);
    const estado = r.error ? '❌ ERROR' : '✅ OK';
    console.log(`${modelo} | ${registros} | ${estado}`);
  });

  console.log('-'.repeat(60));
  console.log(`TOTAL: ${totalRegistros} registros migrados`);
  console.log(`Errores: ${errores} tablas con problemas`);
  console.log('\n✨ Migración completada!');
}

main()
  .catch(e => {
    console.error('💥 Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  });
