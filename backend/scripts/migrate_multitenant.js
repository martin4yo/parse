const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function runMigration() {
  const prisma = new PrismaClient();

  try {
    console.log('🚀 Iniciando migración multitenant...');

    // 1. Crear tabla tenants
    console.log('📁 Creando tabla tenants...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" TEXT PRIMARY KEY,
        "slug" TEXT UNIQUE NOT NULL,
        "nombre" TEXT NOT NULL,
        "cuit" TEXT UNIQUE NOT NULL,
        "razonSocial" TEXT,
        "direccion" TEXT,
        "telefono" TEXT,
        "email" TEXT,
        "plan" TEXT DEFAULT 'basic',
        "activo" BOOLEAN DEFAULT true,
        "fechaCreacion" TIMESTAMP DEFAULT NOW(),
        "fechaVencimiento" TIMESTAMP,
        "configuracion" TEXT DEFAULT '{}',
        "limites" TEXT DEFAULT '{}',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `;

    // 2. Insertar tenant por defecto
    console.log('🏢 Creando tenant por defecto...');
    const defaultTenantId = 'default-tenant-id';

    await prisma.$executeRaw`
      INSERT INTO "tenants" (
        "id",
        "slug",
        "nombre",
        "cuit",
        "razonSocial",
        "plan",
        "limites"
      ) VALUES (
        ${defaultTenantId},
        'empresa-default',
        'Empresa Default',
        '20-00000000-0',
        'Empresa Default S.A.',
        'enterprise',
        '{"usuarios": 1000, "documentos_mes": 10000, "storage_mb": 50000}'
      ) ON CONFLICT (slug) DO NOTHING
    `;

    console.log('🔧 Agregando columnas tenantId...');

    // 3. Agregar columnas tenantId con valor por defecto
    const tables = [
      'users',
      'documentos_procesados',
      'resumen_tarjeta',
      'rendicion_tarjeta_items',
      'rendicion_tarjeta_cabecera',
      'rendicion_tarjeta_detalle',
      'user_tarjetas_credito',
      'delegacion_tarjetas',
      'parametros_maestros',
      'parametros_relaciones'
    ];

    for (const table of tables) {
      console.log(`  - Procesando tabla ${table}...`);

      // Agregar columna
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT '${defaultTenantId}'
      `);

      // Actualizar registros existentes
      await prisma.$executeRawUnsafe(`
        UPDATE "${table}"
        SET "tenantId" = '${defaultTenantId}'
        WHERE "tenantId" IS NULL
      `);

      // Hacer NOT NULL
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${table}"
        ALTER COLUMN "tenantId" SET NOT NULL
      `);

      // Quitar valor por defecto
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${table}"
        ALTER COLUMN "tenantId" DROP DEFAULT
      `);
    }

    console.log('🔗 Creando índices...');

    // 4. Crear índices
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "idx_tenants_slug" ON "tenants"("slug")',
      'CREATE INDEX IF NOT EXISTS "idx_tenants_cuit" ON "tenants"("cuit")',
      'CREATE INDEX IF NOT EXISTS "idx_tenants_activo" ON "tenants"("activo")',
      'CREATE INDEX IF NOT EXISTS "idx_users_tenant" ON "users"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_documentos_tenant" ON "documentos_procesados"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_resumen_tenant" ON "resumen_tarjeta"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_rendicion_items_tenant" ON "rendicion_tarjeta_items"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_rendicion_cabecera_tenant" ON "rendicion_tarjeta_cabecera"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_rendicion_detalle_tenant" ON "rendicion_tarjeta_detalle"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_user_tarjetas_tenant" ON "user_tarjetas_credito"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_delegacion_tenant" ON "delegacion_tarjetas"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_parametros_maestros_tenant" ON "parametros_maestros"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "idx_parametros_relaciones_tenant" ON "parametros_relaciones"("tenantId")'
    ];

    for (const index of indexes) {
      await prisma.$executeRawUnsafe(index);
    }

    // 5. Verificación
    console.log('\n✅ Verificando migración...');

    const tenantCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "tenants"`;
    const userCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "users" WHERE "tenantId" IS NOT NULL`;
    const docCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "documentos_procesados" WHERE "tenantId" IS NOT NULL`;

    console.log(`📊 Tenants creados: ${tenantCount[0].count}`);
    console.log(`👥 Usuarios con tenant: ${userCount[0].count}`);
    console.log(`📄 Documentos con tenant: ${docCount[0].count}`);

    console.log('\n🎉 ¡Migración multitenant completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar migración
runMigration()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });