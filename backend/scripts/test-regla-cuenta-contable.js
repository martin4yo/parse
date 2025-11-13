/**
 * Verificar productos con cuenta_contable en parametros_maestros
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRegla() {
  try {
    console.log('🔍 Verificando productos con cuenta_contable...\n');

    // Buscar productos con cuenta_contable en JSON
    const productos = await prisma.parametros_maestros.findMany({
      where: {
        tipo_campo: 'codigo_producto',
        activo: true
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        parametros_json: true
      }
    });

    console.log(`📦 Total de productos: ${productos.length}\n`);

    let conCuenta = 0;
    let sinCuenta = 0;

    console.log('📋 PRODUCTOS CON CUENTA CONTABLE:\n');

    for (const prod of productos) {
      const cuentaContable = prod.parametros_json?.cuenta_contable;

      if (cuentaContable) {
        conCuenta++;
        console.log(`✅ ${prod.codigo} - ${prod.nombre}`);
        console.log(`   Cuenta: ${cuentaContable}`);
        console.log('');
      } else {
        sinCuenta++;
      }
    }

    console.log('\n📊 RESUMEN:');
    console.log(`   Con cuenta_contable: ${conCuenta}`);
    console.log(`   Sin cuenta_contable: ${sinCuenta}`);

    if (sinCuenta > 0) {
      console.log('\n⚠️ PRODUCTOS SIN CUENTA CONTABLE:\n');
      for (const prod of productos) {
        const cuentaContable = prod.parametros_json?.cuenta_contable;
        if (!cuentaContable) {
          console.log(`   - ${prod.codigo} - ${prod.nombre}`);
        }
      }
    }

    if (conCuenta > 0) {
      console.log('\n✅ La regla funcionará correctamente para los productos con cuenta_contable configurada');

      // Simular lookup
      console.log('\n🧪 SIMULACIÓN DE LOOKUP:');
      const primerProducto = productos.find(p => p.parametros_json?.cuenta_contable);
      if (primerProducto) {
        console.log(`\n   Si una línea tiene codigoProducto = "${primerProducto.codigo}"`);
        console.log(`   → La regla asignará cuentaContable = "${primerProducto.parametros_json.cuenta_contable}"`);
      }
    } else {
      console.log('\n⚠️ ADVERTENCIA: Ningún producto tiene cuenta_contable configurada');
      console.log('   Debes configurar cuenta_contable en el JSON de cada producto');
      console.log('\n💡 Ejemplo de JSON correcto:');
      console.log('   {');
      console.log('     "cuenta_contable": "1105020101",');
      console.log('     "categoria": "materiales",');
      console.log('     "otros_campos": "..."');
      console.log('   }');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRegla();
