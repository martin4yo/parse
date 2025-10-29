const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verificarProductos() {
  try {
    const productos = await prisma.parametroMaestro.findMany({
      where: { tipo_campo: 'codigo_producto' },
      take: 10,
      orderBy: { id: 'asc' }
    });
    
    console.log('\n=== VERIFICACIÓN DE PRODUCTOS IMPORTADOS ===\n');
    console.log(`Total encontrados con tipo_campo='codigo_producto': ${productos.length}`);
    console.log('\nPrimeros 10 productos:\n');
    
    productos.forEach((p, index) => {
      console.log(`${index + 1}. Código: ${p.codigo}`);
      console.log(`   Nombre: ${p.nombre}`);
      console.log(`   Tipo Producto (valor_padre): ${p.valor_padre || 'N/A'}`);
      console.log(`   Cuenta Contable (JSON): ${p.parametros_json?.cuenta_contable || 'N/A'}`);
      console.log(`   ---`);
    });
    
    // Contar por tipo de producto
    const porTipo = await prisma.parametroMaestro.groupBy({
      by: ['valor_padre'],
      where: { tipo_campo: 'codigo_producto' },
      _count: true
    });
    
    console.log('\n=== RESUMEN POR TIPO DE PRODUCTO ===\n');
    porTipo.forEach(t => {
      console.log(`Tipo "${t.valor_padre || 'Sin tipo'}": ${t._count} productos`);
    });
    
    // Contar total
    const total = await prisma.parametroMaestro.count({
      where: { tipo_campo: 'codigo_producto' }
    });
    
    console.log(`\n✅ Total de productos en base de datos: ${total}`);
    
  } catch (error) {
    console.error('Error verificando productos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarProductos();