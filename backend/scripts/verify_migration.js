const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Q27G4B98@149.50.148.198:5432/parse_db'
    }
  }
});

async function verificar() {
  console.log('🔍 VERIFICACIÓN DE MIGRACIÓN - parse_db\n');
  console.log('═'.repeat(70));

  try {
    // Tablas clave para Parse
    const checks = [
      { nombre: 'Tenants', query: prisma.tenants.count() },
      { nombre: 'Users', query: prisma.users.count() },
      { nombre: 'AI Prompts', query: prisma.ai_prompts.count() },
      { nombre: 'Documentos Procesados', query: prisma.documentos_procesados.count() },
      { nombre: 'Documento Líneas', query: prisma.documento_lineas.count() },
      { nombre: 'Documento Impuestos', query: prisma.documento_impuestos.count() },
      { nombre: 'Reglas de Negocio', query: prisma.reglas_negocio.count() },
      { nombre: 'Parámetros Maestros', query: prisma.parametros_maestros.count() },
      { nombre: 'Sync Configurations', query: prisma.sync_configurations.count() },
      { nombre: 'Sync API Keys', query: prisma.sync_api_keys.count() },
      { nombre: 'Planes', query: prisma.planes.count() },
      { nombre: 'Plan Features', query: prisma.plan_features.count() }
    ];

    console.log('\n📊 CONTEO DE REGISTROS\n');
    console.log('Tabla                          | Registros');
    console.log('-'.repeat(70));

    for (const check of checks) {
      const count = await check.query;
      const nombre = check.nombre.padEnd(30);
      const countStr = count.toString().padStart(10);
      console.log(`${nombre} | ${countStr}`);
    }

    console.log('\n' + '═'.repeat(70));

    // Verificar prompts específicos
    console.log('\n🤖 PROMPTS DE IA DISPONIBLES\n');
    const prompts = await prisma.ai_prompts.findMany({
      select: {
        clave: true,
        nombre: true,
        tipo: true,
        activo: true
      }
    });

    if (prompts.length > 0) {
      prompts.forEach(p => {
        const activo = p.activo ? '✅' : '❌';
        console.log(`${activo} [${p.tipo || 'N/A'}] ${p.clave}: ${p.nombre}`);
      });
    } else {
      console.log('⚠️  No hay prompts configurados');
    }

    // Verificar documentos procesados
    console.log('\n📄 DOCUMENTOS PROCESADOS (Últimos 5)\n');
    const docs = await prisma.documentos_procesados.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        nombreArchivo: true,
        tipoArchivo: true,
        estadoProcesamiento: true,
        importeExtraido: true,
        tipoComprobanteExtraido: true,
        createdAt: true
      }
    });

    if (docs.length > 0) {
      docs.forEach(d => {
        const fecha = d.createdAt.toISOString().split('T')[0];
        const importe = d.importeExtraido || 0;
        const tipo = d.tipoComprobanteExtraido || 'N/A';
        console.log(`📁 ${d.nombreArchivo}`);
        console.log(`   Estado: ${d.estadoProcesamiento} | Tipo: ${tipo} | Importe: $${importe} | Fecha: ${fecha}`);
      });
    } else {
      console.log('ℹ️  No hay documentos procesados');
    }

    console.log('\n✅ Verificación completada exitosamente!');

  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verificar();
