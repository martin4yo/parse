#!/usr/bin/env node
/**
 * Script para eliminar un tenant y todos sus datos relacionados
 *
 * Uso: node scripts/delete-tenant.js <slug>
 * Ejemplo: node scripts/delete-tenant.js empresa-demo
 *
 * ADVERTENCIA: Esta acción es IRREVERSIBLE. Todos los datos del tenant serán eliminados.
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Colores para la consola
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'si' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 's');
    });
  });
}

async function countRecords(tenantId) {
  const counts = {};

  // Tablas con tenantId
  const tables = [
    'ai_prompts',
    'ai_provider_configs',
    'api_connector_configs',
    'api_export_logs',
    'api_pull_logs',
    'api_sync_staging',
    'atributos',
    'document_detection_config',
    'documento_distribuciones',
    'documento_impuestos',
    'documento_lineas',
    'documentos_procesados',
    'menu_items',
    'oauth_api_logs',
    'oauth_clients',
    'parametros_maestros',
    'parametros_relaciones',
    'parse_api_logs',
    'patrones_aprendidos',
    'reglas_negocio',
    'sugerencias_ia',
    'sync_api_keys',
    'sync_clients',
    'sync_configurations',
    'sync_logs',
    'tenant_reglas_globales',
    'users',
    'webhooks'
  ];

  for (const table of tables) {
    try {
      const count = await prisma[table].count({
        where: { tenantId }
      });
      if (count > 0) {
        counts[table] = count;
      }
    } catch (error) {
      // Ignorar tablas que no existen o tienen estructura diferente
    }
  }

  return counts;
}

async function deleteTenantData(tenantId, dryRun = false) {
  const results = {};
  const action = dryRun ? 'Se eliminarían' : 'Eliminados';

  // Orden de eliminación (primero las tablas dependientes)
  const deleteOrder = [
    // Logs y datos secundarios primero
    { table: 'oauth_api_logs', label: 'OAuth API Logs' },
    { table: 'parse_api_logs', label: 'Parse API Logs' },
    { table: 'api_export_logs', label: 'API Export Logs' },
    { table: 'api_pull_logs', label: 'API Pull Logs' },
    { table: 'sync_logs', label: 'Sync Logs' },

    // Staging y clientes
    { table: 'api_sync_staging', label: 'API Sync Staging' },
    { table: 'sync_clients', label: 'Sync Clients' },

    // Webhooks de OAuth clients
    { table: 'webhooks', label: 'Webhooks', customWhere: async () => {
      // Obtener clientIds del tenant
      const clients = await prisma.oauth_clients.findMany({
        where: { tenantId },
        select: { clientId: true }
      });
      return { clientId: { in: clients.map(c => c.clientId) } };
    }},

    // OAuth y API keys
    { table: 'oauth_clients', label: 'OAuth Clients' },
    { table: 'sync_api_keys', label: 'Sync API Keys' },
    { table: 'sync_configurations', label: 'Sync Configurations' },

    // Configuraciones de conectores
    { table: 'api_connector_configs', label: 'API Connector Configs' },

    // Reglas y patrones
    { table: 'tenant_reglas_globales', label: 'Reglas Globales Tenant' },
    { table: 'sugerencias_ia', label: 'Sugerencias IA' },
    { table: 'patrones_aprendidos', label: 'Patrones Aprendidos' },
    { table: 'reglas_negocio', label: 'Reglas de Negocio' },

    // Documentos y sus detalles
    { table: 'documento_distribuciones', label: 'Documento Distribuciones' },
    { table: 'documento_impuestos', label: 'Documento Impuestos' },
    { table: 'documento_lineas', label: 'Documento Líneas' },
    { table: 'documentos_procesados', label: 'Documentos Procesados' },

    // Configuraciones
    { table: 'document_detection_config', label: 'Document Detection Config' },
    { table: 'menu_items', label: 'Menu Items' },

    // Parámetros
    { table: 'parametros_relaciones', label: 'Parámetros Relaciones' },
    { table: 'parametros_maestros', label: 'Parámetros Maestros' },

    // Atributos (primero user_atributos, luego valores, luego atributos)
    { table: 'user_atributos', label: 'User Atributos', customDelete: async () => {
      // Eliminar user_atributos de usuarios del tenant
      const users = await prisma.users.findMany({
        where: { tenantId },
        select: { id: true }
      });
      if (users.length > 0) {
        return await prisma.user_atributos.deleteMany({
          where: { userId: { in: users.map(u => u.id) } }
        });
      }
      return { count: 0 };
    }},
    { table: 'valores_atributo', label: 'Valores Atributo', customDelete: async () => {
      // Eliminar valores de atributos del tenant
      const atributos = await prisma.atributos.findMany({
        where: { tenantId },
        select: { id: true }
      });
      if (atributos.length > 0) {
        return await prisma.valores_atributo.deleteMany({
          where: { atributoId: { in: atributos.map(a => a.id) } }
        });
      }
      return { count: 0 };
    }},
    { table: 'atributos', label: 'Atributos' },

    // IA configs y prompts
    { table: 'ai_provider_configs', label: 'AI Provider Configs' },
    { table: 'ai_prompts', label: 'AI Prompts' },

    // Usuarios (al final, antes del tenant)
    { table: 'users', label: 'Usuarios' },
  ];

  for (const { table, label, customWhere, customDelete } of deleteOrder) {
    try {
      let count = 0;

      if (customDelete) {
        if (!dryRun) {
          const result = await customDelete();
          count = result.count;
        } else {
          // Para dry run, intentar contar
          count = '?';
        }
      } else {
        const where = customWhere ? await customWhere() : { tenantId };

        if (!dryRun) {
          const result = await prisma[table].deleteMany({ where });
          count = result.count;
        } else {
          try {
            count = await prisma[table].count({ where });
          } catch {
            count = '?';
          }
        }
      }

      if (count > 0 || count === '?') {
        results[table] = count;
        logStep(table, `${action}: ${count} ${label}`);
      }
    } catch (error) {
      if (!error.message.includes('does not exist') && !error.message.includes('Unknown arg')) {
        logWarning(`Error en ${table}: ${error.message}`);
      }
    }
  }

  return results;
}

async function deleteTenant(slug) {
  log('\n========================================', 'magenta');
  log('   SCRIPT DE ELIMINACIÓN DE TENANT', 'magenta');
  log('========================================\n', 'magenta');

  // 1. Buscar el tenant
  logStep('1', 'Buscando tenant...');

  const tenant = await prisma.tenants.findUnique({
    where: { slug },
    include: {
      planes: true,
      _count: {
        select: {
          users: true,
          documentos_procesados: true
        }
      }
    }
  });

  if (!tenant) {
    logError(`No se encontró ningún tenant con slug: "${slug}"`);
    process.exit(1);
  }

  // 2. Mostrar información del tenant
  log('\n📋 Información del Tenant:', 'cyan');
  console.log(`   ID: ${tenant.id}`);
  console.log(`   Slug: ${tenant.slug}`);
  console.log(`   Nombre: ${tenant.nombre}`);
  console.log(`   CUIT: ${tenant.cuit}`);
  console.log(`   Plan: ${tenant.planes?.nombre || 'Sin plan'}`);
  console.log(`   Activo: ${tenant.activo ? 'Sí' : 'No'}`);
  console.log(`   Usuarios: ${tenant._count.users}`);
  console.log(`   Documentos: ${tenant._count.documentos_procesados}`);

  // 3. Contar registros relacionados
  logStep('2', 'Contando registros relacionados...');
  const counts = await countRecords(tenant.id);

  if (Object.keys(counts).length > 0) {
    log('\n📊 Registros a eliminar:', 'yellow');
    let totalRecords = 0;
    for (const [table, count] of Object.entries(counts)) {
      console.log(`   ${table}: ${count}`);
      totalRecords += count;
    }
    console.log(`   ${'─'.repeat(30)}`);
    console.log(`   Total: ${totalRecords} registros`);
  }

  // 4. Confirmación
  log('\n' + '⚠️'.repeat(20), 'red');
  log('  ADVERTENCIA: Esta acción es IRREVERSIBLE', 'red');
  log('  Se eliminarán TODOS los datos del tenant', 'red');
  log('⚠️'.repeat(20) + '\n', 'red');

  const confirmed = await confirm(`¿Estás SEGURO de eliminar el tenant "${tenant.nombre}" (${slug})? [si/no]: `);

  if (!confirmed) {
    log('\n❌ Operación cancelada por el usuario', 'yellow');
    process.exit(0);
  }

  // 5. Segunda confirmación para tenants con muchos datos
  const totalDocs = tenant._count.documentos_procesados;
  if (totalDocs > 100) {
    const confirmed2 = await confirm(`\n⚠️  El tenant tiene ${totalDocs} documentos. ¿Confirmar eliminación? [si/no]: `);
    if (!confirmed2) {
      log('\n❌ Operación cancelada por el usuario', 'yellow');
      process.exit(0);
    }
  }

  // 6. Ejecutar eliminación
  log('\n🗑️  Iniciando eliminación...', 'cyan');
  console.log('');

  try {
    // Eliminar datos relacionados
    await deleteTenantData(tenant.id, false);

    // Eliminar el tenant
    logStep('tenant', 'Eliminando tenant...');
    await prisma.tenants.delete({
      where: { id: tenant.id }
    });
    logSuccess('Tenant eliminado');

    log('\n========================================', 'green');
    log('   ✅ TENANT ELIMINADO EXITOSAMENTE', 'green');
    log('========================================\n', 'green');

  } catch (error) {
    logError(`Error durante la eliminación: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log('Uso: node scripts/delete-tenant.js <slug>', 'yellow');
    log('Ejemplo: node scripts/delete-tenant.js empresa-demo', 'yellow');
    log('\nOpciones:', 'cyan');
    log('  --list    Listar todos los tenants disponibles', 'reset');
    log('  --dry-run Mostrar qué se eliminaría sin ejecutar', 'reset');
    process.exit(1);
  }

  if (args[0] === '--list') {
    const tenants = await prisma.tenants.findMany({
      select: {
        slug: true,
        nombre: true,
        activo: true,
        _count: {
          select: {
            users: true,
            documentos_procesados: true
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    log('\n📋 Tenants disponibles:\n', 'cyan');
    for (const t of tenants) {
      const status = t.activo ? '✅' : '❌';
      console.log(`  ${status} ${t.slug.padEnd(30)} ${t.nombre.padEnd(30)} (${t._count.users} usuarios, ${t._count.documentos_procesados} docs)`);
    }
    console.log('');
    process.exit(0);
  }

  const slug = args[0];
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    log('\n🔍 Modo DRY-RUN: Solo se mostrará qué se eliminaría\n', 'yellow');

    const tenant = await prisma.tenants.findUnique({
      where: { slug }
    });

    if (!tenant) {
      logError(`No se encontró ningún tenant con slug: "${slug}"`);
      process.exit(1);
    }

    await deleteTenantData(tenant.id, true);
    log('\n✅ Dry-run completado. No se eliminó nada.\n', 'green');
    process.exit(0);
  }

  await deleteTenant(slug);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
