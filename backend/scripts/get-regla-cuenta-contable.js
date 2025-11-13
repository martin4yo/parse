/**
 * Script para ver la configuración de REGLA_CUENTA_CONTABLE_ITEMS
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRegla() {
  try {
    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'REGLA_CUENTA_CONTABLE_ITEMS' }
    });

    if (!regla) {
      console.log('❌ No existe la regla REGLA_CUENTA_CONTABLE_ITEMS');
      return;
    }

    console.log('📋 REGLA_CUENTA_CONTABLE_ITEMS:');
    console.log('\nID:', regla.id);
    console.log('Nombre:', regla.nombre);
    console.log('Tipo:', regla.tipo);
    console.log('Activa:', regla.activa);
    console.log('\nConfiguración:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getRegla();
