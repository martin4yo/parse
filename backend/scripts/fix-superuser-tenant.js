#!/usr/bin/env node

/**
 * Script para asegurar que el superuser tenga un tenant por defecto
 * Este script asegura que siempre haya un tenant marcado como esDefault: true
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Verificando configuración de tenant por defecto para superusers...');

  try {
    // 1. Buscar si existe un tenant marcado como default
    let defaultTenant = await prisma.tenants.findFirst({
      where: { esDefault: true, activo: true }
    });

    if (!defaultTenant) {
      console.log('⚠️ No hay tenant marcado como por defecto');

      // Buscar el tenant "empresa-demo" o el primero disponible
      const candidateSlug = 'empresa-demo';
      defaultTenant = await prisma.tenants.findFirst({
        where: {
          slug: candidateSlug,
          activo: true
        }
      });

      if (!defaultTenant) {
        // Si no existe empresa-demo, tomar el primer tenant activo
        defaultTenant = await prisma.tenants.findFirst({
          where: { activo: true },
          orderBy: { createdAt: 'asc' }
        });
      }

      if (defaultTenant) {
        // Marcar este tenant como default
        await prisma.tenants.update({
          where: { id: defaultTenant.id },
          data: { esDefault: true }
        });
        console.log(`✅ Tenant "${defaultTenant.nombre}" marcado como por defecto`);
      } else {
        console.log('❌ No hay tenants activos en el sistema');
        return;
      }
    } else {
      console.log(`✅ Tenant por defecto ya existe: "${defaultTenant.nombre}"`);
    }

    // 2. Verificar superusers sin tenant
    const superusersWithoutTenant = await prisma.users.findMany({
      where: {
        superuser: true,
        tenantId: null
      }
    });

    if (superusersWithoutTenant.length > 0) {
      console.log(`🔧 Encontrados ${superusersWithoutTenant.length} superusers sin tenant asignado`);

      // Asignar el tenant por defecto a todos los superusers
      await prisma.users.updateMany({
        where: {
          superuser: true,
          tenantId: null
        },
        data: {
          tenantId: defaultTenant.id
        }
      });

      console.log(`✅ Asignado tenant "${defaultTenant.nombre}" a ${superusersWithoutTenant.length} superusers`);
    } else {
      console.log('✅ Todos los superusers tienen tenant asignado');
    }

    // 3. Mostrar resumen
    const allSuperusers = await prisma.users.findMany({
      where: { superuser: true },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        tenantId: true,
        tenant: {
          select: {
            nombre: true,
            slug: true
          }
        }
      }
    });

    console.log('\n📋 Resumen de superusers:');
    console.log('─'.repeat(60));
    allSuperusers.forEach(user => {
      const tenantInfo = user.tenant ? `${user.tenant.nombre} (${user.tenant.slug})` : 'SIN TENANT';
      console.log(`👤 ${user.nombre} ${user.apellido} (${user.email})`);
      console.log(`   Tenant: ${tenantInfo}`);
    });

    console.log('\n🎉 Configuración completada exitosamente');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();