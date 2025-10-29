const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verificarTodosLosImports() {
  try {
    console.log('\n=== VERIFICACIÓN COMPLETA DE PARÁMETROS MAESTROS ===\n');
    
    // 1. Productos
    const productos = await prisma.parametroMaestro.findMany({
      where: { tipo_campo: 'codigo_producto' },
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    const totalProductos = await prisma.parametroMaestro.count({
      where: { tipo_campo: 'codigo_producto' }
    });
    
    console.log('📦 PRODUCTOS (codigo_producto)');
    console.log(`Total: ${totalProductos} registros`);
    console.log('Primeros 5:');
    productos.forEach(p => {
      console.log(`  - ${p.codigo}: ${p.nombre} (Tipo: ${p.valor_padre}, Cuenta: ${p.parametros_json?.cuenta_contable || 'N/A'})`);
    });
    
    // 2. Cuentas Contables
    const cuentas = await prisma.parametroMaestro.findMany({
      where: { tipo_campo: 'cuenta_contable' },
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    const totalCuentas = await prisma.parametroMaestro.count({
      where: { tipo_campo: 'cuenta_contable' }
    });
    
    console.log('\n💳 CUENTAS CONTABLES (cuenta_contable)');
    console.log(`Total: ${totalCuentas} registros`);
    console.log('Primeras 5:');
    cuentas.forEach(c => {
      console.log(`  - ${c.codigo}: ${c.nombre}`);
    });
    
    // 3. Subcuentas
    const subcuentas = await prisma.parametroMaestro.findMany({
      where: { tipo_campo: 'subcuenta' },
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    const totalSubcuentas = await prisma.parametroMaestro.count({
      where: { tipo_campo: 'subcuenta' }
    });
    
    console.log('\n📂 SUBCUENTAS (subcuenta)');
    console.log(`Total: ${totalSubcuentas} registros`);
    console.log('Primeras 5:');
    subcuentas.forEach(s => {
      console.log(`  - ${s.codigo}: ${s.nombre} (Padre: ${s.valor_padre || 'N/A'})`);
    });
    
    // Resumen por valor_padre de subcuentas
    const subcuentasPorPadre = await prisma.parametroMaestro.groupBy({
      by: ['valor_padre'],
      where: { tipo_campo: 'subcuenta' },
      _count: true
    });
    
    console.log('\nDistribución de subcuentas por valor_padre:');
    subcuentasPorPadre.forEach(s => {
      console.log(`  - ${s.valor_padre}: ${s._count} subcuentas`);
    });
    
    // 4. Resumen general
    const totalGeneral = await prisma.parametroMaestro.count();
    
    console.log('\n=== RESUMEN GENERAL ===');
    console.log(`📦 Productos: ${totalProductos}`);
    console.log(`💳 Cuentas Contables: ${totalCuentas}`);
    console.log(`📂 Subcuentas: ${totalSubcuentas}`);
    console.log(`📊 TOTAL PARÁMETROS MAESTROS: ${totalGeneral}`);
    
    // 5. Verificar tipos de campo únicos
    const tiposCampo = await prisma.parametroMaestro.groupBy({
      by: ['tipo_campo'],
      _count: true
    });
    
    console.log('\n=== TODOS LOS TIPOS DE CAMPO ===');
    tiposCampo.forEach(t => {
      console.log(`  - ${t.tipo_campo}: ${t._count} registros`);
    });
    
  } catch (error) {
    console.error('Error verificando imports:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarTodosLosImports();