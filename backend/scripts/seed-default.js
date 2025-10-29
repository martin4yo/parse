#!/usr/bin/env node

/**
 * Script para crear tenant por defecto y usuario superuser
 *
 * Uso:
 * node scripts/seed-default.js
 *
 * Variables de entorno opcionales:
 * SUPERUSER_EMAIL=admin@rendiciones.com
 * SUPERUSER_PASSWORD=Admin123!
 * TENANT_NAME="Empresa Demo"
 * TENANT_CUIT="20123456789"
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🏢 Creando tenant por defecto y usuario superuser...');

  try {
    // Configuración por defecto (puede ser sobrescrita por variables de entorno)
    const config = {
      // Datos del tenant
      tenantData: {
        slug: 'empresa-demo',
        nombre: process.env.TENANT_NAME || 'Empresa Demo',
        cuit: process.env.TENANT_CUIT || '20123456789',
        razonSocial: process.env.TENANT_RAZON_SOCIAL || 'Empresa Demo S.A.',
        plan: 'Mythic',
        activo: true,
        esDefault: true,
        configuracion: {
          moneda_defecto: 'ARS',
          iva_defecto: 21,
          logo_url: null
        },
        limites: {
          max_usuarios: 100,
          max_rendiciones_mes: 1000,
          storage_mb: 10240
        }
      },
      // Datos del superuser
      superuserData: {
        email: process.env.SUPERUSER_EMAIL || 'admin@rendiciones.com',
        password: process.env.SUPERUSER_PASSWORD || 'Admin123!',
        nombre: 'Super',
        apellido: 'Admin',
        superuser: true,
        activo: true
      }
    };

    // 1. Verificar si ya existe el tenant
    const existingTenant = await prisma.tenants.findUnique({
      where: { slug: config.tenantData.slug }
    });

    let tenant;
    if (existingTenant) {
      console.log(`✅ Tenant '${config.tenantData.nombre}' ya existe.`);
      tenant = existingTenant;
    } else {
      // Crear tenant
      tenant = await prisma.tenants.create({
        data: config.tenantData
      });
      console.log(`✅ Tenant creado: ${tenant.nombre} (${tenant.slug})`);
    }

    // 2. Verificar si ya existe el superuser
    const existingUser = await prisma.users.findUnique({
      where: { email: config.superuserData.email }
    });

    let user;
    if (existingUser) {
      console.log(`✅ Usuario superuser '${config.superuserData.email}' ya existe.`);
      user = existingUser;

      // Actualizar para asegurar que sea superuser y esté asociado al tenant
      await prisma.users.update({
        where: { id: user.id },
        data: {
          superuser: true,
          tenantId: tenant.id,
          activo: true
        }
      });
      console.log(`✅ Usuario actualizado como superuser y asociado al tenant.`);
    } else {
      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(config.superuserData.password, 10);

      // Crear superuser
      user = await prisma.users.create({
        data: {
          ...config.superuserData,
          password: hashedPassword,
          tenantId: tenant.id
        }
      });
      console.log(`✅ Usuario superuser creado: ${user.email}`);
    }

    // 3. Resumen
    console.log('\n🎉 Configuración completada:');
    console.log('─'.repeat(50));
    console.log(`📁 Tenant: ${tenant.nombre}`);
    console.log(`   - ID: ${tenant.id}`);
    console.log(`   - Slug: ${tenant.slug}`);
    console.log(`   - CUIT: ${tenant.cuit}`);
    console.log(`   - Plan: ${tenant.plan}`);
    console.log('');
    console.log(`👤 Usuario Superuser: ${user.email}`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Nombre: ${user.nombre} ${user.apellido}`);
    console.log(`   - Superuser: ${user.superuser}`);
    console.log(`   - Tenant ID: ${user.tenantId}`);
    console.log('');
    console.log('🔐 Credenciales de acceso:');
    console.log(`   Email: ${config.superuserData.email}`);
    console.log(`   Password: ${config.superuserData.password}`);
    console.log('');
    console.log('💡 Puedes cambiar estas credenciales desde la interfaz de administración.');
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Error durante la configuración:', error);

    // Mostrar errores específicos más amigables
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('email')) {
        console.error('El email del usuario ya está en uso.');
      } else if (error.meta?.target?.includes('cuit')) {
        console.error('El CUIT del tenant ya está en uso.');
      } else if (error.meta?.target?.includes('slug')) {
        console.error('El slug del tenant ya está en uso.');
      }
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Función de ayuda
function showHelp() {
  console.log(`
🏢 Script de configuración inicial - Rendiciones App

Este script crea:
- Un tenant por defecto con configuración empresarial
- Un usuario superuser con acceso administrativo

OPCIONES:
  --help              Muestra esta ayuda

VARIABLES DE ENTORNO:
  SUPERUSER_EMAIL     Email del superuser (default: admin@rendiciones.com)
  SUPERUSER_PASSWORD  Password del superuser (default: Admin123!)
  TENANT_NAME         Nombre del tenant (default: "Empresa Demo")
  TENANT_CUIT         CUIT del tenant (default: "20123456789")

EJEMPLOS:
  # Configuración básica
  node scripts/seed-default.js

  # Con variables personalizadas
  SUPERUSER_EMAIL="mi@empresa.com" \\
  SUPERUSER_PASSWORD="MiPassword123!" \\
  TENANT_NAME="Mi Empresa S.A." \\
  TENANT_CUIT="20987654321" \\
  node scripts/seed-default.js
`);
}

// Verificar argumentos
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Ejecutar
main();