const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verificarCuentasContables() {
  try {
    const cuentas = await prisma.parametroMaestro.findMany({
      where: { tipo_campo: 'cuenta_contable' },
      take: 10,
      orderBy: { id: 'asc' }
    });
    
    console.log('\n=== VERIFICACIÓN DE CUENTAS CONTABLES IMPORTADAS ===\n');
    console.log(`Total encontradas con tipo_campo='cuenta_contable': ${cuentas.length}`);
    console.log('\nPrimeras 10 cuentas:\n');
    
    cuentas.forEach((c, index) => {
      console.log(`${index + 1}. Código: ${c.codigo}`);
      console.log(`   Nombre: ${c.nombre}`);
      console.log(`   ---`);
    });
    
    // Contar total
    const total = await prisma.parametroMaestro.count({
      where: { tipo_campo: 'cuenta_contable' }
    });
    
    console.log(`\n✅ Total de cuentas contables en base de datos: ${total}`);
    
    // Verificar productos y cuentas juntos
    const totalProductos = await prisma.parametroMaestro.count({
      where: { tipo_campo: 'codigo_producto' }
    });
    
    console.log('\n=== RESUMEN GENERAL ===');
    console.log(`📦 Productos (codigo_producto): ${totalProductos}`);
    console.log(`💳 Cuentas Contables (cuenta_contable): ${total}`);
    console.log(`📊 Total de parámetros maestros: ${totalProductos + total}`);
    
  } catch (error) {
    console.error('Error verificando cuentas contables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarCuentasContables();