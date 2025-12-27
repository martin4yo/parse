const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllApiKeys() {
  try {
    const keys = await prisma.sync_api_keys.findMany({
      include: {
        tenants: {
          select: { slug: true, nombre: true, id: true }
        }
      }
    });

    console.log('\n=== TODAS LAS API KEYS DE SYNC ===\n');

    if (keys.length === 0) {
      console.log('❌ No hay API keys registradas\n');
      return;
    }

    for (const key of keys) {
      console.log(`Nombre: ${key.nombre}`);
      console.log(`  Tenant: ${key.tenants?.slug} (${key.tenants?.nombre})`);
      console.log(`  Tenant ID: ${key.tenantId}`);
      console.log(`  Activa: ${key.activo}`);
      console.log(`  Permisos:`, JSON.stringify(key.permisos));
      console.log(`  API Key (prefijo): ${key.apiKey?.substring(0, 10) || 'N/A'}...`);
      console.log(`  Key hash (prefijo): ${key.key?.substring(0, 15) || 'N/A'}...`);
      console.log('---');
    }

    console.log(`\nTotal: ${keys.length} API keys\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllApiKeys();
