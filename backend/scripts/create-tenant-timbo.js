/**
 * Script para crear el tenant "timbo"
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createTenantTimbo() {
  try {
    console.log('🚀 Creando tenant "timbo"...\n');

    // Verificar si ya existe
    const existingTenant = await prisma.tenants.findUnique({
      where: { slug: 'timbo' }
    });

    if (existingTenant) {
      console.log('⚠️  El tenant "timbo" ya existe');
      console.log(`   ID: ${existingTenant.id}`);
      console.log(`   Nombre: ${existingTenant.nombre}`);
      console.log(`   CUIT: ${existingTenant.cuit}`);
      return existingTenant;
    }

    // Buscar el plan Common (si existe)
    const planCommon = await prisma.planes.findUnique({
      where: { codigo: 'Common' }
    });

    // Crear el tenant
    const tenantId = crypto.randomUUID();
    const now = new Date();

    const tenant = await prisma.tenants.create({
      data: {
        id: tenantId,
        nombre: 'Timbo',
        slug: 'timbo',
        cuit: '30123456789', // CUIT de ejemplo, cambiar si es necesario
        planId: planCommon?.id || null,
        activo: true,
        esDefault: false,
        updatedAt: now
      }
    });

    console.log('✅ Tenant creado exitosamente:');
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Nombre: ${tenant.nombre}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   CUIT: ${tenant.cuit}`);
    console.log(`   Plan: ${planCommon?.nombre || 'Sin plan'}`);

    return tenant;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
createTenantTimbo()
  .then(() => {
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
